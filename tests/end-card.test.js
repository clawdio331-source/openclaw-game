import test from "node:test";
import assert from "node:assert/strict";
import { createDailySeed, buildFunnyFailReason } from "../src/end-card.js";

test("daily seed is stable for same date", () => {
  const day = new Date("2026-02-19T12:00:00Z");
  const seedA = createDailySeed(day);
  const seedB = createDailySeed(day);
  assert.equal(seedA, seedB);
  assert.match(seedA, /^20260219-\d{4}$/);
});

test("daily seed changes with day", () => {
  const seedA = createDailySeed(new Date("2026-02-19T12:00:00Z"));
  const seedB = createDailySeed(new Date("2026-02-20T12:00:00Z"));
  assert.notEqual(seedA, seedB);
});

test("funny reason is deterministic for same inputs", () => {
  const payload = { endReason: "trust", score: 17, streak: 4, seed: "20260219-5555" };
  const lineA = buildFunnyFailReason(payload);
  const lineB = buildFunnyFailReason(payload);
  assert.equal(lineA, lineB);
  assert.match(lineA, /Score 17, streak 4/);
});
