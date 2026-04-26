import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

export interface EngineConfig {
  exchange: { type: string; testnet: boolean; privateKey?: string };
  strategy: {
    type: string;
    symbol: string;
    levels: number;
    range_pct: number;
    total_allocation: number;
    rebalance_threshold_pct: number;
  };
  bot_config: Record<string, unknown>;
  risk_management: {
    stop_loss_enabled: boolean;
    stop_loss_pct: number;
    take_profit_enabled: boolean;
    take_profit_pct: number;
    max_drawdown_pct: number;
    max_position_size_pct: number;
    rebalance: { price_move_threshold_pct: number };
  };
  log_level: string;
}

type YamlRoot = {
  name?: string;
  active?: boolean;
  exchange?: { type?: string; testnet?: boolean };
  account?: { max_allocation_pct?: number };
  grid?: {
    symbol?: string;
    levels?: number;
    price_range?: { mode?: string; auto?: { range_pct?: number } };
  };
  risk_management?: Record<string, unknown>;
  monitoring?: { log_level?: string };
  private_key_file?: string;
  testnet_key_file?: string;
  mainnet_key_file?: string;
  private_key?: string;
  testnet_private_key?: string;
  mainnet_private_key?: string;
};

function findActiveConfig(botsDir: string): string | null {
  if (!fs.existsSync(botsDir)) return null;
  const files = fs
    .readdirSync(botsDir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .sort();
  for (const f of files) {
    const full = path.join(botsDir, f);
    const raw = yaml.load(fs.readFileSync(full, "utf8")) as YamlRoot;
    if (raw && raw.active === true) return full;
  }
  return null;
}

function parseYamlFile(configPath: string): YamlRoot {
  const text = fs.readFileSync(configPath, "utf8");
  return yaml.load(text) as YamlRoot;
}

const BASE_ALLOCATION_USD = 1000.0;

export function validateConfigFile(configPath: string): void {
  const root = parseYamlFile(configPath);
  if (!root.name) throw new Error("Missing name");
  if (!root.exchange?.type) throw new Error("Missing exchange.type");
  if (!root.grid?.symbol) throw new Error("Missing grid.symbol");
}

export function loadEngineConfig(configPath: string): EngineConfig {
  const root = parseYamlFile(configPath);
  if (root.active === false) {
    console.warn("⚠️  Config has active: false; runner may still start if invoked.");
  }
  const maxAlloc = root.account?.max_allocation_pct ?? 20.0;
  const totalAllocation =
    BASE_ALLOCATION_USD * (Math.max(1, Math.min(100, maxAlloc)) / 100.0);
  const gr = root.grid;
  if (!gr?.symbol) throw new Error("grid.symbol required");
  const rangePct = gr.price_range?.auto?.range_pct ?? 10.0;
  const rm = root.risk_management ?? {};
  const rebal = (rm["rebalance"] as Record<string, unknown>) ?? {};
  const envTestnet = process.env["HYPERLIQUID_TESTNET"]?.toLowerCase();
  const testnetFromEnv =
    envTestnet === "true" ? true : envTestnet === "false" ? false : undefined;
  return {
    exchange: {
      type: root.exchange?.type ?? "hyperliquid",
      testnet: testnetFromEnv ?? root.exchange?.testnet ?? true,
    },
    strategy: {
      type: "basic_grid",
      symbol: gr.symbol,
      levels: gr.levels ?? 10,
      range_pct: rangePct,
      total_allocation: totalAllocation,
      rebalance_threshold_pct: Number(
        rebal["price_move_threshold_pct"] ?? 15.0
      ),
    },
    bot_config: {
      name: root.name,
      private_key_file: root.private_key_file,
      testnet_key_file: root.testnet_key_file,
      mainnet_key_file: root.mainnet_key_file,
      private_key: root.private_key,
      testnet_private_key: root.testnet_private_key,
      mainnet_private_key: root.mainnet_private_key,
    },
    risk_management: {
      stop_loss_enabled: Boolean(rm["stop_loss_enabled"]),
      stop_loss_pct: Number(rm["stop_loss_pct"] ?? 5.0),
      take_profit_enabled: Boolean(rm["take_profit_enabled"]),
      take_profit_pct: Number(rm["take_profit_pct"] ?? 20.0),
      max_drawdown_pct: Number(rm["max_drawdown_pct"] ?? 15.0),
      max_position_size_pct: Number(rm["max_position_size_pct"] ?? 30.0),
      rebalance: {
        price_move_threshold_pct: Number(
          rebal["price_move_threshold_pct"] ?? 15.0
        ),
      },
    },
    log_level: (root.monitoring?.log_level as string) ?? "INFO",
  };
}

export function resolveConfigPath(cliArg: string | undefined): string {
  if (cliArg) return path.resolve(cliArg);
  const botsDir = path.join(process.cwd(), "bots");
  const found = findActiveConfig(botsDir);
  if (!found) {
    throw new Error(
      "No config path and no active config in ./bots. Pass a path or set active: true in a YAML under bots/."
    );
  }
  return found;
}
