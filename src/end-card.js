function hashString(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
}

function toDayStamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function createDailySeed(date = new Date()) {
  const dayStamp = toDayStamp(date);
  const shard = (hashString(`openclaw:${dayStamp}`) % 9000) + 1000;
  return `${dayStamp}-${shard}`;
}

const TRUST_FAILURE_LINES = [
  "Agent confidence leaked out through the emergency snack hatch.",
  "You filed a 14-page panic memo and forgot to hit send.",
  "OpenClaw mistook your calm breathing for a system crash.",
  "The hazard looked harmless until it read your search history."
];

const SURVIVAL_LINES = [
  "You survived, but accounting says your heroics were off-budget.",
  "Mission complete. HR still wants to discuss your \"battle jazz\" playlist.",
  "Extraction succeeded. The hazards are requesting a rematch.",
  "You won. The incident report calls it \"mostly intentional.\""
];

export function buildFunnyFailReason({ endReason, score, streak, seed }) {
  const source = `${seed}:${endReason}:${score}:${streak}`;
  const index = hashString(source) % 4;
  const line = endReason === "trust" ? TRUST_FAILURE_LINES[index] : SURVIVAL_LINES[index];
  return `${line} (Score ${score}, streak ${streak})`;
}
