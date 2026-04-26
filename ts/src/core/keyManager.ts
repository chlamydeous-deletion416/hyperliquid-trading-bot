import fs from "node:fs";
import type { PathLike } from "node:fs";

function readFileTrim(path: PathLike): string | undefined {
  try {
    return fs.readFileSync(path, "utf8").trim();
  } catch {
    return undefined;
  }
}

function getEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

export function getPrivateKey(
  testnet: boolean,
  botConfig: Record<string, unknown> = {}
): string {
  const network = testnet ? "testnet" : "mainnet";
  const fromBot = testnet
    ? (botConfig["testnet_private_key"] as string | undefined)
    : (botConfig["mainnet_private_key"] as string | undefined);
  if (fromBot) return fromBot;

  const envKey = testnet
    ? "HYPERLIQUID_TESTNET_PRIVATE_KEY"
    : "HYPERLIQUID_MAINNET_PRIVATE_KEY";
  const fromEnv = getEnv(envKey);
  if (fromEnv) return fromEnv;

  const legacy = getEnv("HYPERLIQUID_PRIVATE_KEY");
  if (legacy) return legacy;

  const fileVar = testnet
    ? "HYPERLIQUID_TESTNET_KEY_FILE"
    : "HYPERLIQUID_MAINNET_KEY_FILE";
  const fromFileEnv = getEnv(fileVar);
  if (fromFileEnv) {
    const k = readFileTrim(fromFileEnv);
    if (k) return k;
  }

  const botFile = testnet
    ? (botConfig["testnet_key_file"] as string | undefined)
    : (botConfig["mainnet_key_file"] as string | undefined);
  if (botFile) {
    const k = readFileTrim(botFile);
    if (k) return k;
  }

  const legacyFile = getEnv("HYPERLIQUID_PRIVATE_KEY_FILE");
  if (legacyFile) {
    const k = readFileTrim(legacyFile);
    if (k) return k;
  }

  throw new Error(
    `No private key for ${network}. Set ${envKey} or use key file variables (see .env.example).`
  );
}
