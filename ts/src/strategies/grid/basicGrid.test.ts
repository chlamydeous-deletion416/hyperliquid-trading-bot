import test from "node:test";
import assert from "node:assert/strict";
import { createGridLevels } from "./basicGrid.js";

test("createGridLevels uses geometric spacing and correct count", () => {
  const min = 90_000;
  const max = 110_000;
  const center = 100_000;
  const n = 5;
  const alloc = 1000;
  const levels = createGridLevels(min, max, center, n, alloc);
  assert.equal(levels.length, n);
  assert.ok(levels[0]!.price >= min * 0.999);
  assert.ok(levels[n - 1]!.price <= max * 1.001);
  const usdPer = alloc / n;
  for (const L of levels) {
    const impliedUsd = L.size * L.price;
    assert.ok(Math.abs(impliedUsd - usdPer) < 1, `per-level usd ${impliedUsd}`);
  }
});
