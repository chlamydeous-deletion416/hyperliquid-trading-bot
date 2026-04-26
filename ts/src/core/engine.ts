import type { ExchangeAdapter } from "../types/exchange.js";
import {
  OrderSide,
  OrderType,
  OrderStatus,
  type Order,
} from "../types/exchange.js";
import {
  type MarketData,
  type Position,
  type TradingSignal,
  SignalType,
} from "../types/strategy.js";
import type { TradingStrategy } from "../types/strategy.js";
import { HyperliquidMarketData } from "../exchanges/hyperliquid/marketData.js";
import { getPrivateKey } from "./keyManager.js";
import {
  RiskManager,
  RiskAction,
  type AccountMetrics,
} from "./riskManager.js";
import type { EngineConfig } from "../config/loadBotConfig.js";
import { createHyperliquidAdapter } from "../exchanges/hyperliquid/adapter.js";
import { createBasicGrid } from "../strategies/grid/basicGrid.js";

function logLevel(name: string): void {
  const n = (name as string) || "INFO";
  const order = { DEBUG: 0, INFO: 1, WARNING: 2, ERROR: 3 } as const;
  void order[n as keyof typeof order];
}

export class TradingEngine {
  private running = false;
  private strategy: TradingStrategy | null = null;
  private exchange: ExchangeAdapter | null = null;
  private marketData: HyperliquidMarketData | null = null;
  private risk: RiskManager | null = null;
  private currentPositions: Position[] = [];
  private pending = new Map<string, Order>();
  private executedTrades = 0;
  private totalPnl = 0;

  constructor(private readonly config: EngineConfig) {
    logLevel(config.log_level);
  }

  async initialize(): Promise<boolean> {
    try {
      const ex = this.config.exchange;
      const testnet = ex.testnet;
      const pk = getPrivateKey(testnet, this.config.bot_config);
      if (ex.type !== "hyperliquid" && ex.type !== "hl") {
        console.error("Only hyperliquid is supported in this build.");
        return false;
      }
      this.exchange = createHyperliquidAdapter(pk, testnet);
      if (!(await this.exchange.connect())) return false;
      this.marketData = new HyperliquidMarketData(testnet);
      if (!(await this.marketData.connect())) return false;
      const st = this.config.strategy;
      this.strategy = createBasicGrid("basic_grid", {
        symbol: st.symbol,
        levels: st.levels,
        range_pct: st.range_pct,
        total_allocation: st.total_allocation,
        rebalance_threshold_pct: st.rebalance_threshold_pct,
      });
      this.strategy.start();
      this.risk = new RiskManager({
        risk_management: this.config.risk_management,
      });
      return true;
    } catch (e) {
      console.error("init failed:", e);
      return false;
    }
  }

  async start(): Promise<void> {
    if (!this.strategy || !this.exchange || !this.marketData) {
      throw new Error("Engine not initialized");
    }
    this.running = true;
    const sym = this.config.strategy.symbol;
    await this.marketData.subscribePriceUpdates(sym, (md) =>
      this.onPriceUpdate(md)
    );
    await this.tradingLoop();
  }

  private async tradingLoop(): Promise<void> {
    while (this.running) {
      await new Promise((r) => setTimeout(r, 60_000));
      const now = Date.now() / 1000;
      for (const [id, o] of this.pending) {
        if (now - o.createdAt > 3600) this.pending.delete(id);
      }
    }
  }

  private async onPriceUpdate(marketData: MarketData): Promise<void> {
    if (!this.running || !this.strategy || !this.exchange) return;
    try {
      this.currentPositions = await this.exchange.getPositions();
      const bal = await this.exchange.getBalance("USD");
      if (this.risk) {
        const m = await this.exchange.getAccountMetrics();
        const am: AccountMetrics = {
          totalValue: m["totalValue"]!,
          totalPnl: m["totalPnl"]!,
          unrealizedPnl: m["unrealizedPnl"]!,
          realizedPnl: m["realizedPnl"]!,
          drawdownPct: m["drawdownPct"]!,
          positionsCount: m["positionsCount"]!,
          largestPositionPct: m["largestPositionPct"]!,
        };
        const ev = this.risk.evaluateRisks(
          this.currentPositions,
          { [marketData.asset]: marketData },
          am
        );
        for (const e of ev) {
          await this.runRiskEvent(e);
        }
      }
      const signals = this.strategy.generateSignals(
        marketData,
        this.currentPositions,
        bal.available
      );
      for (const s of signals) {
        await this.executeSignal(s);
      }
    } catch (e) {
      console.error("price update error:", e);
    }
  }

  private async runRiskEvent(
    e: import("./riskManager.js").RiskEvent
  ): Promise<void> {
    if (!this.exchange) return;
    console.warn(`Risk: ${e.reason}`);
    if (e.action === RiskAction.CLOSE_POSITION) {
      await this.exchange.closePosition(e.asset);
    } else if (e.action === RiskAction.REDUCE_POSITION) {
      const positions = await this.exchange.getPositions();
      const p = positions.find((x) => x.asset === e.asset);
      if (p) await this.exchange.closePosition(e.asset, Math.abs(p.size) * 0.5);
    } else if (e.action === RiskAction.CANCEL_ORDERS) {
      const n = await this.exchange.cancelAllOrders();
      console.log(`cancelled ${n} orders`);
    } else if (e.action === RiskAction.PAUSE_TRADING) {
      if (this.strategy) this.strategy.isActive = false;
    } else if (e.action === RiskAction.EMERGENCY_EXIT) {
      const pos = await this.exchange.getPositions();
      for (const p of pos) {
        await this.exchange.closePosition(p.asset);
      }
      await this.exchange.cancelAllOrders();
      if (this.strategy) this.strategy.isActive = false;
    }
  }

  private async executeSignal(signal: TradingSignal): Promise<void> {
    if (!this.exchange || !this.strategy) return;
    if (
      signal.signalType === SignalType.BUY ||
      signal.signalType === SignalType.SELL
    ) {
      await this.placeFromSignal(signal);
    } else if (signal.signalType === SignalType.CLOSE) {
      if (signal.metadata["action"] === "cancel_all") {
        const n = await this.exchange.cancelAllOrders();
        console.log(`rebalance: cancelled ${n} orders`);
      }
    }
  }

  private async placeFromSignal(signal: TradingSignal): Promise<void> {
    if (!this.exchange || !this.strategy) return;
    const id = `order_${Date.now()}`;
    const o: Order = {
      id,
      asset: signal.asset,
      side:
        signal.signalType === SignalType.BUY ? OrderSide.BUY : OrderSide.SELL,
      size: signal.size,
      orderType: signal.price ? OrderType.LIMIT : OrderType.MARKET,
      price: signal.price,
      status: OrderStatus.SUBMITTED,
      filledSize: 0,
      averageFillPrice: 0,
      createdAt: Date.now() / 1000,
    };
    const exId = await this.exchange.placeOrder(o);
    o.exchangeOrderId = exId;
    this.pending.set(id, o);
    this.executedTrades += 1;
    const px = o.price ?? 0;
    this.strategy.onTradeExecuted(signal, px, o.size);
  }

  async stop(): Promise<void> {
    this.running = false;
    this.strategy?.stop();
    if (this.exchange) {
      try {
        const n = await this.exchange.cancelAllOrders();
        if (n) console.log(`cancelled ${n} orders on shutdown`);
      } catch (e) {
        console.error("cancel on stop:", e);
      }
    }
    await this.marketData?.disconnect();
    if (this.exchange) await this.exchange.disconnect();
  }
}
