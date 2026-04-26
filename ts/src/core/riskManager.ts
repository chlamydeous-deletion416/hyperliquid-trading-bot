import type { MarketData, Position } from "../types/strategy.js";
import type { EngineConfig } from "../config/loadBotConfig.js";

export enum RiskAction {
  NONE = "none",
  CLOSE_POSITION = "close_position",
  REDUCE_POSITION = "reduce_position",
  CANCEL_ORDERS = "cancel_orders",
  PAUSE_TRADING = "pause_trading",
  EMERGENCY_EXIT = "emergency_exit",
}

export interface RiskEvent {
  ruleName: string;
  asset: string;
  action: RiskAction;
  reason: string;
  severity: string;
  metadata: Record<string, unknown>;
  timestamp: number;
}

export interface AccountMetrics {
  totalValue: number;
  totalPnl: number;
  unrealizedPnl: number;
  realizedPnl: number;
  drawdownPct: number;
  positionsCount: number;
  largestPositionPct: number;
}

type RiskConfig = EngineConfig["risk_management"];

class StopLossRule {
  name = "stop_loss" as const;
  enabled: boolean;
  lossPct: number;
  constructor(cfg: { enabled: boolean; loss_pct: number }) {
    this.enabled = cfg.enabled;
    this.lossPct = cfg.loss_pct;
  }
  evaluate(
    positions: Position[]
  ): RiskEvent[] {
    if (!this.enabled) return [];
    const out: RiskEvent[] = [];
    for (const position of positions) {
      if (position.entryPrice <= 0) continue;
      const denom = position.entryPrice * Math.abs(position.size);
      if (denom === 0) continue;
      const lossPct = (Math.abs(position.unrealizedPnl) / denom) * 100;
      if (position.unrealizedPnl < 0 && lossPct >= this.lossPct) {
        out.push({
          ruleName: this.name,
          asset: position.asset,
          action: RiskAction.CLOSE_POSITION,
          reason: `Stop loss: ${lossPct.toFixed(2)}% >= ${this.lossPct}%`,
          severity: "HIGH",
          metadata: { unrealizedPnl: position.unrealizedPnl },
          timestamp: Date.now() / 1000,
        });
      }
    }
    return out;
  }
}

class TakeProfitRule {
  name = "take_profit" as const;
  enabled: boolean;
  profitPct: number;
  constructor(cfg: { enabled: boolean; profit_pct: number }) {
    this.enabled = cfg.enabled;
    this.profitPct = cfg.profit_pct;
  }
  evaluate(positions: Position[]): RiskEvent[] {
    if (!this.enabled) return [];
    const out: RiskEvent[] = [];
    for (const position of positions) {
      if (position.entryPrice <= 0 || position.unrealizedPnl <= 0) continue;
      const denom = position.entryPrice * Math.abs(position.size);
      const profitPct = (position.unrealizedPnl / denom) * 100;
      if (profitPct >= this.profitPct) {
        out.push({
          ruleName: this.name,
          asset: position.asset,
          action: RiskAction.CLOSE_POSITION,
          reason: `Take profit: ${profitPct.toFixed(2)}% >= ${this.profitPct}%`,
          severity: "MEDIUM",
          metadata: {},
          timestamp: Date.now() / 1000,
        });
      }
    }
    return out;
  }
}

class DrawdownRule {
  name = "max_drawdown" as const;
  maxDrawdownPct: number;
  enabled = true;
  constructor(cfg: { max_drawdown_pct: number }) {
    this.maxDrawdownPct = cfg.max_drawdown_pct;
  }
  evaluate(m: AccountMetrics): RiskEvent[] {
    if (m.drawdownPct >= this.maxDrawdownPct) {
      return [
        {
          ruleName: this.name,
          asset: "ACCOUNT",
          action: RiskAction.EMERGENCY_EXIT,
          reason: `Max drawdown ${m.drawdownPct.toFixed(2)}% >= ${this.maxDrawdownPct}%`,
          severity: "CRITICAL",
          metadata: {},
          timestamp: Date.now() / 1000,
        },
      ];
    }
    return [];
  }
}

class PositionSizeRule {
  name = "max_position_size" as const;
  maxPositionSizePct: number;
  enabled = true;
  constructor(cfg: { max_position_size_pct: number }) {
    this.maxPositionSizePct = cfg.max_position_size_pct;
  }
  evaluate(
    positions: Position[],
    m: AccountMetrics
  ): RiskEvent[] {
    if (m.totalValue <= 0) return [];
    const out: RiskEvent[] = [];
    for (const p of positions) {
      const pct = (p.currentValue / m.totalValue) * 100;
      if (pct >= this.maxPositionSizePct) {
        out.push({
          ruleName: this.name,
          asset: p.asset,
          action: RiskAction.REDUCE_POSITION,
          reason: `Position ${pct.toFixed(2)}% >= ${this.maxPositionSizePct}%`,
          severity: "MEDIUM",
          metadata: { positionPct: pct },
          timestamp: Date.now() / 1000,
        });
      }
    }
    return out;
  }
}

type Rule =
  | StopLossRule
  | TakeProfitRule
  | DrawdownRule
  | PositionSizeRule;

export class RiskManager {
  private rules: Rule[] = [];
  private eventHistory: RiskEvent[] = [];

  constructor(
    private readonly engineConfig: {
      risk_management: RiskConfig;
    }
  ) {
    const rc = engineConfig.risk_management;
    if (rc.stop_loss_enabled) {
      this.rules.push(
        new StopLossRule({
          enabled: true,
          loss_pct: rc.stop_loss_pct,
        })
      );
    }
    if (rc.take_profit_enabled) {
      this.rules.push(
        new TakeProfitRule({
          enabled: true,
          profit_pct: rc.take_profit_pct,
        })
      );
    }
    this.rules.push(
      new DrawdownRule({ max_drawdown_pct: rc.max_drawdown_pct })
    );
    this.rules.push(
      new PositionSizeRule({
        max_position_size_pct: rc.max_position_size_pct,
      })
    );
  }

  evaluateRisks(
    positions: Position[],
    marketData: Record<string, MarketData>,
    accountMetrics: AccountMetrics
  ): RiskEvent[] {
    const all: RiskEvent[] = [];
    for (const rule of this.rules) {
      try {
        if (rule instanceof DrawdownRule) {
          all.push(...rule.evaluate(accountMetrics));
        } else if (rule instanceof PositionSizeRule) {
          all.push(...rule.evaluate(positions, accountMetrics));
        } else if (rule instanceof StopLossRule) {
          all.push(...rule.evaluate(positions));
        } else if (rule instanceof TakeProfitRule) {
          all.push(...rule.evaluate(positions));
        }
        void marketData;
      } catch (e) {
        all.push({
          ruleName: "system",
          asset: "SYSTEM",
          action: RiskAction.NONE,
          reason: `Rule error: ${e}`,
          severity: "LOW",
          metadata: { error: String(e) },
          timestamp: Date.now() / 1000,
        });
      }
    }
    this.eventHistory.push(...all);
    return all;
  }

  getStatus(): Record<string, unknown> {
    return {
      rules: this.rules.length,
      recentEvents1h: this.eventHistory.filter(
        (e) => Date.now() / 1000 - e.timestamp < 3600
      ).length,
    };
  }
}
