import test from "node:test";
import assert from "node:assert/strict";
import {
  TELEGRAPH_MIN_MS,
  TELEGRAPH_MAX_MS,
  clampTelegraphMs,
  FIRST_WAVE_DURATION_MS,
  isInFirstWave,
  shouldEnableLowFx,
  getParallaxBandCount
} from "../src/visual-tuning.js";

test("telegraph timing stays below 1 second and clamps correctly", () => {
  assert.ok(TELEGRAPH_MAX_MS < 1000);
  assert.equal(clampTelegraphMs(50), TELEGRAPH_MIN_MS);
  assert.equal(clampTelegraphMs(5_000), TELEGRAPH_MAX_MS);
});

test("first wave window is exactly first 10 seconds", () => {
  assert.equal(isInFirstWave(0), true);
  assert.equal(isInFirstWave(FIRST_WAVE_DURATION_MS), true);
  assert.equal(isInFirstWave(FIRST_WAVE_DURATION_MS + 1), false);
});

test("low FX mode threshold and parallax fallback", () => {
  assert.equal(shouldEnableLowFx(16), false);
  assert.equal(shouldEnableLowFx(22), true);
  assert.ok(getParallaxBandCount(true) < getParallaxBandCount(false));
});
