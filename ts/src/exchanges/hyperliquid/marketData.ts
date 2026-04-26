import WebSocket from "ws";
import type { MarketData } from "../../types/strategy.js";

const wsUrl = (testnet: boolean) =>
  testnet
    ? "wss://api.hyperliquid-testnet.xyz/ws"
    : "wss://api.hyperliquid.xyz/ws";

type PriceCallback = (m: MarketData) => void | Promise<void>;

export class HyperliquidMarketData {
  private ws: WebSocket | null = null;
  private running = false;
  private readonly subscribed = new Set<string>();
  private readonly callbacks = new Map<string, PriceCallback[]>();
  private latest = new Map<string, MarketData>();

  constructor(private readonly testnet: boolean) {}

  async connect(): Promise<boolean> {
    try {
      this.ws = new WebSocket(wsUrl(this.testnet));
      await new Promise<void>((resolve, reject) => {
        this.ws!.once("open", () => resolve());
        this.ws!.once("error", reject);
      });
      this.running = true;
      this.ws.on("message", (raw: WebSocket.RawData) => {
        void this.onRawMessage(String(raw));
      });
      console.log(
        `✅ WebSocket (${this.testnet ? "testnet" : "mainnet"}): ${wsUrl(this.testnet)}`
      );
      return true;
    } catch (e) {
      console.error("❌ WebSocket connect failed:", e);
      return false;
    }
  }

  private async onRawMessage(text: string): Promise<void> {
    try {
      const data = JSON.parse(text) as {
        channel?: string;
        data?: { mids?: Record<string, string> };
      };
      if (data.channel === "allMids" && data.data?.mids) {
        await this.dispatchMids(data.data.mids);
      }
    } catch {
      return;
    }
  }

  private async dispatchMids(
    mids: Record<string, string>
  ): Promise<void> {
    for (const asset of this.subscribed) {
      const s = mids[asset];
      if (s === undefined) continue;
      const price = parseFloat(s);
      const md: MarketData = {
        asset,
        price,
        volume24h: 0,
        timestamp: Date.now() / 1000,
      };
      this.latest.set(asset, md);
      const cbs = this.callbacks.get(asset) ?? [];
      for (const cb of cbs) {
        try {
          const r = cb(md);
          if (r instanceof Promise) await r;
        } catch (e) {
          console.error("price callback error:", e);
        }
      }
    }
  }

  async subscribePriceUpdates(
    asset: string,
    callback: PriceCallback
  ): Promise<void> {
    if (!this.callbacks.has(asset)) this.callbacks.set(asset, []);
    this.callbacks.get(asset)!.push(callback);
    this.subscribed.add(asset);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({ method: "subscribe", subscription: { type: "allMids" } })
      );
    }
    console.log(`📊 Subscribed to ${asset} price updates`);
  }

  async disconnect(): Promise<void> {
    this.running = false;
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    console.log("🔌 WebSocket closed");
  }

  getStatus(): Record<string, unknown> {
    return {
      connected: this.running && this.ws?.readyState === WebSocket.OPEN,
      assets: [...this.subscribed],
      cached: this.latest.size,
    };
  }
}
