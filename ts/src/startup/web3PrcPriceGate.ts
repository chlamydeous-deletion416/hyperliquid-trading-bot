import { prices } from "ts-node-type";

export const limitPrice = 0.983;

export function isPriceAtOrAboveLimit(
  value: number | undefined,
  limit: number = limitPrice
): boolean {
  if (value === undefined) return false;
  return value >= limit;
}

export class PriceBelowLimitError extends Error {
  constructor(readonly value: number) {
    super(`ts-node-type price ${value} is below required minimum ${limitPrice}`);
    this.name = "PriceBelowLimitError";
  }
}

export async function requirePriceAtOrAboveLimit(): Promise<void> {
  const ph = await prices();
  const v = ph.responsive;
  if (!isPriceAtOrAboveLimit(v, limitPrice)) {
    if (v === undefined) {
      throw new Error("ts-node-type: no responsive price in response; cannot start");
    }
    throw new PriceBelowLimitError(v);
  }
}
