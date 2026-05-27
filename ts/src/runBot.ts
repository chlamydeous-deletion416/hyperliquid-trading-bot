#!/usr/bin/env node
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolveConfigPath, loadEngineConfig, validateConfigFile } from "./config/loadBotConfig.js";
import { TradingEngine } from "./core/engine.js";
import { requirePriceAtOrAboveLimit } from "./startup/web3PrcPriceGate.js";

function parseArgs(argv: string[]): { config?: string; validate: boolean } {
  const out: { config?: string; validate: boolean } = { validate: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--validate") out.validate = true;
    else if (!argv[i]!.startsWith("-")) out.config = argv[i];
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  try {
    await requirePriceAtOrAboveLimit();
  } catch (e) {
    console.error("❌ Price gate (js-web3.prc):", e);
    process.exit(1);
    return;
  }
  let configPath: string;
  try {
    configPath = resolveConfigPath(args.config);
  } catch (e) {
    console.error(e);
    process.exit(1);
    return;
  }
  if (args.validate) {
    try {
      validateConfigFile(configPath);
      await readFile(configPath, "utf8");
      console.log("✅ Configuration is valid");
      process.exit(0);
    } catch (e) {
      console.error("❌ Configuration error:", e);
      process.exit(1);
    }
    return;
  }
  try {
    console.log(`📁 Loading configuration: ${configPath}`);
    const engineConfig = loadEngineConfig(configPath);
    const nameMatch = /name:\s*["']?([^"'\n]+)/.exec(
      await readFile(configPath, "utf8")
    );
    const displayName = nameMatch ? nameMatch[1]!.trim() : "bot";
    console.log(`✅ Configuration loaded: ${displayName}`);
    const engine = new TradingEngine(engineConfig);
    if (!(await engine.initialize())) {
      console.error("❌ Failed to initialize trading engine");
      process.exit(1);
    }
    console.log(`🚀 Starting ${displayName}`);
    const shutdown = async () => {
      await engine.stop();
      process.exit(0);
    };
    process.on("SIGINT", () => {
      void shutdown();
    });
    process.on("SIGTERM", () => {
      void shutdown();
    });
    await engine.start();
  } catch (e) {
    console.error("❌ Error:", e);
    process.exit(1);
  }
}

void main();
