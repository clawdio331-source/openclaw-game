export const PING_TYPES = Object.freeze({
  warn: {
    key: "1",
    label: "WARN",
    icon: "!",
    color: "#ffb36f",
    glow: "rgba(255, 179, 111, 0.45)"
  },
  safe: {
    key: "2",
    label: "SAFE",
    icon: "+",
    color: "#65f0d6",
    glow: "rgba(101, 240, 214, 0.45)"
  },
  risk: {
    key: "3",
    label: "RISK",
    icon: "X",
    color: "#ff6ea6",
    glow: "rgba(255, 110, 166, 0.45)"
  }
});

export const PING_TYPE_ORDER = ["warn", "safe", "risk"];

export const PING_COOLDOWN_MS = 1_100;
export const PING_LIFE_MS = 1_250;
export const PING_MAX_RADIUS = 260;
export const TRUST_REWARD_PER_CORRECT_PING = 3;

const PING_KEY_TO_TYPE = Object.freeze({
  "1": "warn",
  "2": "safe",
  "3": "risk"
});

export function keyToPingType(key) {
  return PING_KEY_TO_TYPE[key] ?? null;
}

export function isCorrectPingType(pingType, hazardType) {
  return pingType === hazardType;
}

export function applyPingBurstToHazards(hazards, ping) {
  const survivors = [];
  let clearedCount = 0;

  for (const hazard of hazards) {
    const dist = Math.hypot(hazard.x - ping.x, hazard.y - ping.y);
    const inRange = dist <= ping.radius + hazard.radius;
    const correctType = isCorrectPingType(ping.type, hazard.type);

    if (inRange && correctType) {
      clearedCount += 1;
      continue;
    }

    survivors.push(hazard);
  }

  return {
    hazards: survivors,
    clearedCount,
    trustDelta: clearedCount * TRUST_REWARD_PER_CORRECT_PING
  };
}
