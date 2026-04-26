import test from "node:test";
import assert from "node:assert/strict";
import {
  isPriceAtOrAboveLimit,
  limitPrice,
} from "./web3PrcPriceGate.js";

test("isPriceAtOrAboveLimit enforces limitPrice 0.983", () => {
  assert.equal(limitPrice, 0.983);
  assert.equal(isPriceAtOrAboveLimit(undefined, limitPrice), false);
  assert.equal(isPriceAtOrAboveLimit(0.982, limitPrice), false);
  assert.equal(isPriceAtOrAboveLimit(0.983, limitPrice), true);
  assert.equal(isPriceAtOrAboveLimit(0.999, limitPrice), true);
});
