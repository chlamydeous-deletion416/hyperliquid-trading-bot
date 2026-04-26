import {
  HttpTransport,
  InfoClient,
  ExchangeClient,
} from "@nktkas/hyperliquid";
import type { OrderSuccessResponse } from "@nktkas/hyperliquid/api/exchange";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import type { ExchangeAdapter } from "../../types/exchange.js";
import {
  OrderSide,
  OrderType,
  OrderStatus,
  type Order,
  type Balance,
  type MarketInfo,
} from "../../types/exchange.js";
import type { Position } from "../../types/strategy.js";

type MetaUniverse = {
  name: string;
  szDecimals: number;
  isDelisted?: true;
};

function ensure0x(key: string): Hex {
  const k = key.startsWith("0x") ? key : `0x${key}`;
  return k as Hex;
}

function roundPrice(asset: string, price: number): string {
  if (asset === "BTC") return String(Math.floor(price));
  return price.toFixed(2);
}

function formatSize(sz: number, szDecimals: number): string {
  return sz.toFixed(szDecimals);
}

function orderOid(res: OrderSuccessResponse): string {
  const st = res.response.data.statuses[0]!;
  if (typeof st === "string")
    throw new Error(`Unexpected order status: ${st}`);
  if ("error" in st) throw new Error(String(st.error));
  if ("resting" in st) return String(st.resting.oid);
  if ("filled" in st) return String(st.filled.oid);
  throw new Error("No oid in order response");
}

export class HyperliquidAdapter implements ExchangeAdapter {
  exchangeName = "Hyperliquid";
  isConnected = false;
  private transport!: HttpTransport;
  private info!: InfoClient;
  private exchange!: ExchangeClient;
  private address!: Hex;
  private meta: { universe: MetaUniverse[] } | null = null;

  constructor(
    private readonly privateKey: string,
    private readonly testnet: boolean
  ) {}

  private getAssetIndex(coin: string): number {
    if (!this.meta) throw new Error("not connected");
    const i = this.meta.universe.findIndex((u) => u.name === coin);
    if (i < 0) throw new Error(`Unknown asset: ${coin}`);
    return i;
  }

  private getSzDecimals(coin: string): number {
    if (!this.meta) throw new Error("not connected");
    const u = this.meta.universe.find((x) => x.name === coin);
    return u?.szDecimals ?? 5;
  }

  async connect(): Promise<boolean> {
    try {
      this.transport = new HttpTransport({ isTestnet: this.testnet });
      this.info = new InfoClient({ transport: this.transport });
      const account = privateKeyToAccount(ensure0x(this.privateKey));
      this.address = account.address;
      this.exchange = new ExchangeClient({
        transport: this.transport,
        wallet: account,
      });
      const m = await this.info.meta();
      this.meta = { universe: m.universe };
      await this.info.clearinghouseState({ user: this.address });
      this.isConnected = true;
      const net = this.testnet ? "testnet" : "mainnet";
      console.log(`✅ Connected to Hyperliquid (${net})`);
      console.log(`🔑 Wallet address: ${this.address}`);
      return true;
    } catch (e) {
      console.error("❌ Failed to connect to Hyperliquid:", e);
      this.isConnected = false;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.meta = null;
    console.log("🔌 Disconnected from Hyperliquid");
  }

  async getBalance(asset: string): Promise<Balance> {
    if (!this.isConnected) throw new Error("Not connected");
    const ch = await this.info.clearinghouseState({ user: this.address });
    const w = parseFloat(ch.withdrawable);
    if (asset === "USD" || asset === "USDC") {
      return { asset, available: w, locked: 0, total: w };
    }
    return { asset, available: 0, locked: 0, total: 0 };
  }

  async getMarketPrice(asset: string): Promise<number> {
    if (!this.isConnected) throw new Error("Not connected");
    const mids = await this.info.allMids();
    const p = mids[asset];
    if (p === undefined) throw new Error(`No mid for ${asset}`);
    return parseFloat(p);
  }

  async placeOrder(order: Order): Promise<string> {
    if (!this.isConnected) throw new Error("Not connected");
    const a = this.getAssetIndex(order.asset);
    const szd = this.getSzDecimals(order.asset);
    const isBuy = order.side === OrderSide.BUY;
    const minSize = 0.0001;
    const size = Math.max(
      minSize,
      Math.round(order.size * 10 ** szd) / 10 ** szd
    );
    if (order.orderType === OrderType.MARKET) {
      const mp = await this.getMarketPrice(order.asset);
      const adj = isBuy ? mp * 1.01 : mp * 0.99;
      const res = await this.exchange.order({
        orders: [
          {
            a,
            b: isBuy,
            p: roundPrice(order.asset, adj),
            s: formatSize(size, szd),
            r: false,
            t: { limit: { tif: "Ioc" } },
          },
        ],
        grouping: "na",
      });
      return orderOid(res);
    }
    const px = order.price ?? (await this.getMarketPrice(order.asset));
    const res = await this.exchange.order({
      orders: [
        {
          a,
          b: isBuy,
          p: roundPrice(order.asset, px),
          s: formatSize(size, szd),
          r: false,
          t: { limit: { tif: "Gtc" } },
        },
      ],
      grouping: "na",
    });
    return orderOid(res);
  }

  async cancelOrder(exchangeOrderId: string): Promise<boolean> {
    if (!this.isConnected) return false;
    const oid = Number(exchangeOrderId);
    const open = await this.info.openOrders({ user: this.address });
    const o = open.find((x) => x.oid === oid);
    if (!o) {
      console.error(`Order ${exchangeOrderId} not in open orders`);
      return false;
    }
    const a = this.getAssetIndex(o.coin);
    const res = await this.exchange.cancel({ cancels: [{ a, o: oid }] });
    if (res.status !== "ok") return false;
    const st = res.response.data.statuses[0]!;
    return st === "success";
  }

  async getOrderStatus(exchangeOrderId: string): Promise<Order> {
    return {
      id: exchangeOrderId,
      asset: "BTC",
      side: OrderSide.BUY,
      size: 0,
      orderType: OrderType.LIMIT,
      status: OrderStatus.SUBMITTED,
      filledSize: 0,
      averageFillPrice: 0,
      createdAt: Date.now() / 1000,
      exchangeOrderId,
    };
  }

  async getMarketInfo(asset: string): Promise<MarketInfo> {
    if (!this.meta) throw new Error("not connected");
    const u = this.meta.universe.find((x) => x.name === asset);
    if (!u) throw new Error(`Unknown ${asset}`);
    return {
      symbol: asset,
      baseAsset: asset,
      quoteAsset: "USD",
      minOrderSize: 1 / 10 ** u.szDecimals,
      pricePrecision: 2,
      sizePrecision: u.szDecimals,
      isActive: u.isDelisted !== true,
    };
  }

  async getOpenOrders(): Promise<Order[]> {
    if (!this.isConnected) return [];
    const open = await this.info.openOrders({ user: this.address });
    return open.map((o) => ({
      id: String(o.oid),
      asset: o.coin,
      side: o.side === "B" ? OrderSide.BUY : OrderSide.SELL,
      size: parseFloat(o.sz),
      orderType: OrderType.LIMIT,
      price: parseFloat(o.limitPx),
      status: OrderStatus.SUBMITTED,
      filledSize: 0,
      averageFillPrice: 0,
      createdAt: o.timestamp / 1000,
      exchangeOrderId: String(o.oid),
    }));
  }

  async cancelAllOrders(): Promise<number> {
    const orders = await this.getOpenOrders();
    let n = 0;
    for (const o of orders) {
      if (o.exchangeOrderId) {
        if (await this.cancelOrder(o.exchangeOrderId)) n += 1;
      }
    }
    return n;
  }

  async getPositions(): Promise<Position[]> {
    if (!this.isConnected) return [];
    const ch = await this.info.clearinghouseState({ user: this.address });
    const out: Position[] = [];
    for (const ap of ch.assetPositions) {
      const szi = parseFloat(ap.position.szi);
      if (szi === 0) continue;
      const entry = parseFloat(ap.position.entryPx);
      const px = await this.getMarketPrice(ap.position.coin);
      const val = Math.abs(szi) * px;
      const uPnl = parseFloat(ap.position.unrealizedPnl);
      out.push({
        asset: ap.position.coin,
        size: szi,
        entryPrice: entry,
        currentValue: val,
        unrealizedPnl: uPnl,
        timestamp: Date.now() / 1000,
      });
    }
    return out;
  }

  async closePosition(asset: string, size?: number): Promise<boolean> {
    if (!this.isConnected) return false;
    const positions = await this.getPositions();
    const p = positions.find((x) => x.asset === asset);
    if (!p) {
      console.error(`No position for ${asset}`);
      return false;
    }
    const a = this.getAssetIndex(asset);
    const szd = this.getSzDecimals(asset);
    const closeSz =
      size === undefined
        ? Math.abs(p.size)
        : Math.min(size, Math.abs(p.size));
    const long = p.size > 0;
    const isBuy = !long;
    const mp = await this.getMarketPrice(asset);
    const adj = isBuy ? mp * 1.01 : mp * 0.99;
    const res = await this.exchange.order({
      orders: [
        {
          a,
          b: isBuy,
          p: roundPrice(asset, adj),
          s: formatSize(closeSz, szd),
          r: true,
          t: { limit: { tif: "Ioc" } },
        },
      ],
      grouping: "na",
    });
    return res.status === "ok";
  }

  async getAccountMetrics(): Promise<Record<string, number>> {
    if (!this.isConnected) {
      return {
        totalValue: 0,
        totalPnl: 0,
        drawdownPct: 0,
        positionsCount: 0,
        largestPositionPct: 0,
        unrealizedPnl: 0,
        realizedPnl: 0,
      };
    }
    const ch = await this.info.clearinghouseState({ user: this.address });
    const total = parseFloat(ch.crossMarginSummary.accountValue);
    const positions = await this.getPositions();
    const pnl = positions.reduce((s, x) => s + x.unrealizedPnl, 0);
    const uPnl = parseFloat(ch.crossMarginSummary.totalRawUsd) || 0;
    const maxPct =
      total > 0
        ? Math.max(0, ...positions.map((p) => (p.currentValue / total) * 100))
        : 0;
    const drawdown = total > 0 && pnl < 0 ? Math.max(0, (-pnl / total) * 100) : 0;
    return {
      totalValue: total,
      totalPnl: pnl,
      unrealizedPnl: uPnl,
      realizedPnl: 0,
      drawdownPct: drawdown,
      positionsCount: positions.length,
      largestPositionPct: maxPct,
    };
  }

  async healthCheck(): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      await this.info.clearinghouseState({ user: this.address });
      return true;
    } catch {
      return false;
    }
  }

  getStatus(): Record<string, unknown> {
    return { exchange: this.exchangeName, connected: this.isConnected };
  }
}

export function createHyperliquidAdapter(
  privateKey: string,
  testnet: boolean
): ExchangeAdapter {
  return new HyperliquidAdapter(privateKey, testnet);
}
