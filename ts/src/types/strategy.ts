export enum SignalType {
  BUY = "buy",
  SELL = "sell",
  HOLD = "hold",
  CLOSE = "close",
}

export interface TradingSignal {
  signalType: SignalType;
  asset: string;
  size: number;
  price?: number;
  reason: string;
  metadata: Record<string, unknown>;
}

export interface MarketData {
  asset: string;
  price: number;
  volume24h: number;
  timestamp: number;
  bid?: number;
  ask?: number;
  volatility?: number;
}

export interface Position {
  asset: string;
  size: number;
  entryPrice: number;
  currentValue: number;
  unrealizedPnl: number;
  timestamp: number;
}

export interface TradingStrategy {
  name: string;
  isActive: boolean;
  start(): void;
  stop(): void;
  generateSignals(
    marketData: MarketData,
    positions: Position[],
    balance: number
  ): TradingSignal[];
  onTradeExecuted(
    signal: TradingSignal,
    executedPrice: number,
    executedSize: number
  ): void;
  onError(error: unknown, context: Record<string, unknown>): void;
  getStatus(): Record<string, unknown>;
}
