import test from "node:test";
import assert from "node:assert/strict";
import {
  RUN_DURATION_MS,
  createRunState,
  getTimeLeftMs,
  applyTrustDelta,
  advanceRunClock
} from "../src/game-logic.js";

test("run starts with full trust and full 60s time", () => {
  const state = createRunState();
  assert.equal(state.trust, 100);
  assert.equal(getTimeLeftMs(state), RUN_DURATION_MS);
  assert.equal(state.ended, false);
});

test("run ends by timeout at 60 seconds", () => {
  let state = createRunState();
  state = advanceRunClock(state, RUN_DURATION_MS - 1);
  assert.equal(state.ended, false);
  state = advanceRunClock(state, 1);
  assert.equal(state.ended, true);
  assert.equal(state.endReason, "timeout");
  assert.equal(getTimeLeftMs(state), 0);
});

test("run ends immediately when trust reaches zero", () => {
  let state = createRunState();
  state = applyTrustDelta(state, -99);
  assert.equal(state.ended, false);
  state = applyTrustDelta(state, -1);
  assert.equal(state.ended, true);
  assert.equal(state.endReason, "trust");
  assert.equal(state.trust, 0);
});

test("trust is clamped between 0 and 100", () => {
  let state = createRunState();
  state = applyTrustDelta(state, 25);
  assert.equal(state.trust, 100);
  state = applyTrustDelta(state, -300);
  assert.equal(state.trust, 0);
});
