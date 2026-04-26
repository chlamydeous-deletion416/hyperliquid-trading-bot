import {
  type TradingStrategy,
  type TradingSignal,
  type MarketData,
  type Position,
  SignalType,
} from "../../types/strategy.js";

export enum GridState {
  INITIALIZING = "initializing",
  ACTIVE = "active",
  REBALANCING = "rebalancing",
  STOPPED = "stopped",
}

export interface GridConfigShape {
  symbol: string;
  levels: number;
  range_pct: number;
  total_allocation: number;
  min_price?: number;
  max_price?: number;
  rebalance_threshold_pct: number;
}

export interface GridLevel {
  price: number;
  size: number;
  levelIndex: number;
  isBuyLevel: boolean;
  isFilled: boolean;
}

export function createGridLevels(
  minPrice: number,
  maxPrice: number,
  currentPrice: number,
  numLevels: number,
  totalAllocationUsd: number
): GridLevel[] {
  if (numLevels < 2) {
    throw new Error("levels must be >= 2 for geometric grid");
  }
  const sizePerLevelUsd = totalAllocationUsd / numLevels;
  const priceRatio = (maxPrice / minPrice) ** (1 / (numLevels - 1));
  const levels: GridLevel[] = [];
  for (let i = 0; i < numLevels; i++) {
    const price = minPrice * priceRatio ** i;
    const sizeBtc = sizePerLevelUsd / price;
    const isBuyLevel = price < currentPrice;
    levels.push({
      price,
      size: sizeBtc,
      levelIndex: i,
      isBuyLevel,
      isFilled: false,
    });
  }
  return levels;
}

export class BasicGridStrategy implements TradingStrategy {
  name: string;
  isActive = true;
  private state = GridState.INITIALIZING;
  private centerPrice: number | null = null;
  private gridLevels: GridLevel[] = [];
  private lastRebalanceTime = 0;
  private totalTrades = 0;
  private totalProfit = 0;
  private readonly grid: GridConfigShape;

  constructor(name: string, raw: Record<string, unknown>) {
    this.name = name;
    this.grid = {
      symbol: (raw["symbol"] as string) ?? "BTC",
      levels: (raw["levels"] as number) ?? 10,
      range_pct: (raw["range_pct"] as number) ?? 10,
      total_allocation: (raw["total_allocation"] as number) ?? 1000,
      min_price: raw["min_price"] as number | undefined,
      max_price: raw["max_price"] as number | undefined,
      rebalance_threshold_pct: (raw["rebalance_threshold_pct"] as number) ?? 15,
    };
  }

  start(): void {
    this.isActive = true;
  }

  stop(): void {
    this.isActive = false;
  }

  onError(_err: unknown, _ctx: Record<string, unknown>): void {
    return;
  }

  generateSignals(
    marketData: MarketData,
    _positions: Position[],
    balance: number
  ): TradingSignal[] {
    void _positions;
    void balance;
    if (!this.isActive) return [];
    const signals: TradingSignal[] = [];
    const current = marketData.price;
    if (this.state === GridState.INITIALIZING) {
      signals.push(...this.initializeGrid(current));
    } else if (
      this.state === GridState.ACTIVE &&
      this.shouldRebalance(current)
    ) {
      signals.push(...this.rebalanceGrid(current));
    }
    return signals;
  }

  private initializeGrid(currentPrice: number): TradingSignal[] {
    this.centerPrice = currentPrice;
    const { minPrice, maxPrice } = this.rangeBounds(currentPrice);
    this.gridLevels = createGridLevels(
      minPrice,
      maxPrice,
      currentPrice,
      this.grid.levels,
      this.grid.total_allocation
    );
    const signals: TradingSignal[] = [];
    for (const level of this.gridLevels) {
      if (level.isBuyLevel && level.price < currentPrice) {
        signals.push({
          signalType: SignalType.BUY,
          asset: this.grid.symbol,
          size: level.size,
          price: level.price,
          reason: `Grid buy at ${level.price.toFixed(2)}`,
          metadata: { levelIndex: level.levelIndex, gridType: "initial" },
        });
      } else if (!level.isBuyLevel && level.price > currentPrice) {
        signals.push({
          signalType: SignalType.SELL,
          asset: this.grid.symbol,
          size: level.size,
          price: level.price,
          reason: `Grid sell at ${level.price.toFixed(2)}`,
          metadata: { levelIndex: level.levelIndex, gridType: "initial" },
        });
      }
    }
    this.state = GridState.ACTIVE;
    return signals;
  }

  private rangeBounds(center: number): { minPrice: number; maxPrice: number } {
    if (this.grid.min_price != null && this.grid.max_price != null) {
      return { minPrice: this.grid.min_price, maxPrice: this.grid.max_price };
    }
    const half = center * (this.grid.range_pct / 100);
    return { minPrice: center - half, maxPrice: center + half };
  }

  private shouldRebalance(current: number): boolean {
    if (this.centerPrice == null) return false;
    const move =
      (Math.abs(current - this.centerPrice) / this.centerPrice) * 100;
    return move > this.grid.rebalance_threshold_pct;
  }

  private rebalanceGrid(current: number): TradingSignal[] {
    this.state = GridState.REBALANCING;
    const cancel: TradingSignal[] = [
      {
        signalType: SignalType.CLOSE,
        asset: this.grid.symbol,
        size: 0,
        reason: "rebalance",
        metadata: { action: "cancel_all" },
      },
    ];
    this.state = GridState.INITIALIZING;
    const init = this.initializeGrid(current);
    this.lastRebalanceTime = Date.now() / 1000;
    return [...cancel, ...init];
  }

  onTradeExecuted(
    signal: TradingSignal,
    executedPrice: number,
    executedSize: number
  ): void {
    this.totalTrades += 1;
    const li = signal.metadata["levelIndex"];
    if (typeof li === "number" && li < this.gridLevels.length) {
      const level = this.gridLevels[li]!;
      level.isFilled = true;
      if (signal.signalType === SignalType.SELL) {
        const buyApprox = executedPrice * 0.99;
        this.totalProfit += (executedPrice - buyApprox) * executedSize;
      }
    }
  }

  getStatus(): Record<string, unknown> {
    return {
      name: this.name,
      active: this.isActive,
      state: this.state,
      centerPrice: this.centerPrice,
      levels: this.gridLevels.length,
      totalTrades: this.totalTrades,
      totalProfit: this.totalProfit,
      lastRebalance: this.lastRebalanceTime,
    };
  }
}

export function createBasicGrid(
  name: string,
  strategyConfig: Record<string, unknown>
): BasicGridStrategy {
  return new BasicGridStrategy(name, strategyConfig);
}
