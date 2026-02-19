import test from "node:test";
import assert from "node:assert/strict";
import {
  keyToPingType,
  isCorrectPingType,
  applyPingBurstToHazards,
  TRUST_REWARD_PER_CORRECT_PING
} from "../src/ping-system.js";

test("key mapping selects ping types", () => {
  assert.equal(keyToPingType("1"), "warn");
  assert.equal(keyToPingType("2"), "safe");
  assert.equal(keyToPingType("3"), "risk");
  assert.equal(keyToPingType("9"), null);
});

test("correct ping type clears hazards in range and increases trust", () => {
  const hazards = [
    { type: "warn", x: 100, y: 100, radius: 20 },
    { type: "safe", x: 500, y: 500, radius: 20 }
  ];

  const result = applyPingBurstToHazards(hazards, {
    type: "warn",
    x: 100,
    y: 100,
    radius: 120
  });

  assert.equal(result.clearedCount, 1);
  assert.equal(result.hazards.length, 1);
  assert.equal(result.hazards[0].type, "safe");
  assert.equal(result.trustDelta, TRUST_REWARD_PER_CORRECT_PING);
});

test("wrong ping type does not clear hazard", () => {
  const hazards = [{ type: "risk", x: 100, y: 100, radius: 20 }];
  const result = applyPingBurstToHazards(hazards, {
    type: "safe",
    x: 100,
    y: 100,
    radius: 150
  });

  assert.equal(isCorrectPingType("safe", "risk"), false);
  assert.equal(result.clearedCount, 0);
  assert.equal(result.hazards.length, 1);
  assert.equal(result.trustDelta, 0);
});

test("out of range hazards are not cleared", () => {
  const hazards = [{ type: "warn", x: 100, y: 100, radius: 20 }];
  const result = applyPingBurstToHazards(hazards, {
    type: "warn",
    x: 400,
    y: 400,
    radius: 40
  });

  assert.equal(result.clearedCount, 0);
  assert.equal(result.hazards.length, 1);
});
