import {
  RUN_DURATION_MS,
  createRunState,
  getTimeLeftMs,
  applyTrustDelta,
  advanceRunClock
} from "./game-logic.js";
import {
  PING_TYPES,
  PING_TYPE_ORDER,
  PING_COOLDOWN_MS,
  PING_LIFE_MS,
  PING_MAX_RADIUS,
  keyToPingType,
  applyPingBurstToHazards
} from "./ping-system.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const introOverlay = document.getElementById("introOverlay");
const endOverlay = document.getElementById("endOverlay");
const startRunButton = document.getElementById("startRunButton");
const restartRunButton = document.getElementById("restartRunButton");
const trustFill = document.getElementById("trustFill");
const meter = document.querySelector(".meter");
const timeLeft = document.getElementById("timeLeft");
const endTitle = document.getElementById("endTitle");
const endReason = document.getElementById("endReason");
const endScore = document.getElementById("endScore");

const WORLD_WIDTH = canvas.width;
const WORLD_HEIGHT = canvas.height;
const PLAYER_SPEED = 360;
const HAZARD_BASE_SPAWN_MS = 900;
const HAZARD_MIN_SPAWN_MS = 440;
const TRUST_DRAIN_PER_SECOND = 28;

const keysDown = new Set();

let runState = createRunState();
let runActive = false;
let hazards = [];
let pingBursts = [];
let score = 0;
let pingCooldownMs = 0;
let selectedPingType = "warn";
let spawnAccumulatorMs = 0;
let lastFrameMs = performance.now();
let visualClockMs = 0;

const player = {
  x: WORLD_WIDTH * 0.5,
  y: WORLD_HEIGHT * 0.58,
  radius: 18
};

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "w", "a", "s", "d", "1", "2", "3"].includes(key) || event.key === " ") {
    event.preventDefault();
  }
  keysDown.add(key);

  const chosenType = keyToPingType(key);
  if (chosenType) {
    selectedPingType = chosenType;
  }

  if ((key === " " || event.code === "Space") && !event.repeat) {
    triggerPing();
  }
});

window.addEventListener("keyup", (event) => {
  keysDown.delete(event.key.toLowerCase());
});

startRunButton.addEventListener("click", startRun);
restartRunButton.addEventListener("click", startRun);

updateHud();
requestAnimationFrame(frame);

function startRun() {
  runState = createRunState();
  runActive = true;
  hazards = [];
  pingBursts = [];
  score = 0;
  pingCooldownMs = 0;
  selectedPingType = "warn";
  spawnAccumulatorMs = 0;
  visualClockMs = 0;

  player.x = WORLD_WIDTH * 0.5;
  player.y = WORLD_HEIGHT * 0.58;

  introOverlay.classList.add("hidden");
  endOverlay.classList.add("hidden");
  updateHud();
}

function endRun() {
  runActive = false;
  const survived = (runState.elapsedMs / 1000).toFixed(1);
  const reasonText = runState.endReason === "trust"
    ? "Trust collapsed to zero before extraction."
    : "You held the line for the full 60 seconds.";

  endTitle.textContent = runState.endReason === "trust" ? "Trust Depleted" : "Mission Survived";
  endReason.textContent = `${reasonText} Total survival time: ${survived}s`;
  endScore.textContent = `Hazards neutralized: ${score}`;
  endOverlay.classList.remove("hidden");
}

function frame(timestampMs) {
  const deltaMs = Math.min(40, Math.max(0, timestampMs - lastFrameMs));
  lastFrameMs = timestampMs;
  visualClockMs += deltaMs;

  if (runActive) {
    update(deltaMs);
  }

  render();
  updateHud();
  requestAnimationFrame(frame);
}

function update(deltaMs) {
  runState = advanceRunClock(runState, deltaMs);
  if (runState.ended) {
    endRun();
    return;
  }

  updatePlayer(deltaMs);
  updatePingCooldown(deltaMs);
  spawnHazards(deltaMs);
  updateHazards(deltaMs);
  updatePingBursts(deltaMs);

  if (runState.ended) {
    endRun();
  }
}

function updatePlayer(deltaMs) {
  const up = keysDown.has("w") || keysDown.has("arrowup");
  const down = keysDown.has("s") || keysDown.has("arrowdown");
  const left = keysDown.has("a") || keysDown.has("arrowleft");
  const right = keysDown.has("d") || keysDown.has("arrowright");

  let axisX = 0;
  let axisY = 0;
  if (left) axisX -= 1;
  if (right) axisX += 1;
  if (up) axisY -= 1;
  if (down) axisY += 1;

  if (axisX === 0 && axisY === 0) {
    return;
  }

  const length = Math.hypot(axisX, axisY) || 1;
  const step = (PLAYER_SPEED * deltaMs) / 1000;
  player.x += (axisX / length) * step;
  player.y += (axisY / length) * step;

  player.x = clamp(player.x, player.radius, WORLD_WIDTH - player.radius);
  player.y = clamp(player.y, player.radius, WORLD_HEIGHT - player.radius);
}

function updatePingCooldown(deltaMs) {
  pingCooldownMs = Math.max(0, pingCooldownMs - deltaMs);
}

function triggerPing() {
  if (!runActive || pingCooldownMs > 0) {
    return;
  }

  pingCooldownMs = PING_COOLDOWN_MS;
  pingBursts.push({
    type: selectedPingType,
    x: player.x,
    y: player.y,
    ageMs: 0,
    lifeMs: PING_LIFE_MS,
    maxRadius: PING_MAX_RADIUS
  });
}

function spawnHazards(deltaMs) {
  const progress = runState.elapsedMs / RUN_DURATION_MS;
  const spawnRate = lerp(HAZARD_BASE_SPAWN_MS, HAZARD_MIN_SPAWN_MS, progress);
  spawnAccumulatorMs += deltaMs;

  while (spawnAccumulatorMs >= spawnRate) {
    spawnAccumulatorMs -= spawnRate;
    hazards.push(createHazard());
  }
}

function createHazard() {
  const edge = Math.floor(Math.random() * 4);
  const type = PING_TYPE_ORDER[Math.floor(Math.random() * PING_TYPE_ORDER.length)];
  let x = 0;
  let y = 0;

  if (edge === 0) {
    x = Math.random() * WORLD_WIDTH;
    y = -40;
  } else if (edge === 1) {
    x = WORLD_WIDTH + 40;
    y = Math.random() * WORLD_HEIGHT;
  } else if (edge === 2) {
    x = Math.random() * WORLD_WIDTH;
    y = WORLD_HEIGHT + 40;
  } else {
    x = -40;
    y = Math.random() * WORLD_HEIGHT;
  }

  const speedByType = {
    warn: 138,
    safe: 124,
    risk: 156
  };
  const speed = (speedByType[type] ?? 135) + Math.random() * 62;
  return {
    type,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: 16 + Math.random() * 8,
    speed,
    ageMs: 0,
    telegraphMs: 700 + Math.random() * 300,
    active: false
  };
}

function updateHazards(deltaMs) {
  const dt = deltaMs / 1000;
  let trustDelta = 0;

  for (const hazard of hazards) {
    hazard.ageMs += deltaMs;
    if (!hazard.active && hazard.ageMs >= hazard.telegraphMs) {
      hazard.active = true;
    }

    if (!hazard.active) {
      continue;
    }

    const dx = player.x - hazard.x;
    const dy = player.y - hazard.y;
    const dist = Math.hypot(dx, dy) || 1;
    hazard.vx = (dx / dist) * hazard.speed;
    hazard.vy = (dy / dist) * hazard.speed;
    hazard.x += hazard.vx * dt;
    hazard.y += hazard.vy * dt;

    if (dist <= player.radius + hazard.radius) {
      trustDelta -= TRUST_DRAIN_PER_SECOND * dt;
    }
  }

  hazards = hazards.filter((hazard) => {
    return hazard.x > -120 && hazard.x < WORLD_WIDTH + 120 && hazard.y > -120 && hazard.y < WORLD_HEIGHT + 120;
  });

  if (trustDelta !== 0) {
    runState = applyTrustDelta(runState, trustDelta);
  }
}

function updatePingBursts(deltaMs) {
  for (const burst of pingBursts) {
    burst.ageMs += deltaMs;
  }

  pingBursts = pingBursts.filter((burst) => burst.ageMs < burst.lifeMs);

  if (pingBursts.length === 0 || hazards.length === 0) {
    return;
  }

  for (const burst of pingBursts) {
    const radius = (burst.ageMs / burst.lifeMs) * burst.maxRadius;
    const result = applyPingBurstToHazards(hazards, {
      x: burst.x,
      y: burst.y,
      type: burst.type,
      radius
    });

    if (result.clearedCount > 0) {
      hazards = result.hazards;
      score += result.clearedCount;
      runState = applyTrustDelta(runState, result.trustDelta);
      if (runState.ended) {
        return;
      }
    }
  }
}

function updateHud() {
  const trustPercent = clamp(runState.trust, 0, 100);
  trustFill.style.transform = `scaleX(${trustPercent / 100})`;
  meter.setAttribute("aria-valuenow", String(Math.round(trustPercent)));

  const trustHue = lerp(8, 145, trustPercent / 100);
  trustFill.style.filter = `hue-rotate(${trustHue - 145}deg)`;
  timeLeft.textContent = `${(getTimeLeftMs(runState) / 1000).toFixed(1)}s`;
}

function render() {
  ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  drawBackground();
  drawArenaFrame();
  drawPingLegend();
  drawHazards();
  drawPingBursts();
  drawPlayer();
  drawOverlayText();
}

function drawBackground() {
  const t = visualClockMs / 1000;
  const gradient = ctx.createLinearGradient(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  gradient.addColorStop(0, "#061520");
  gradient.addColorStop(0.5, "#0b2435");
  gradient.addColorStop(1, "#183847");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  ctx.globalAlpha = 0.28;
  for (let i = 0; i < 26; i += 1) {
    const y = (i / 25) * WORLD_HEIGHT;
    const drift = Math.sin(t * 0.7 + i) * 38;
    ctx.fillStyle = i % 2 === 0 ? "#56d7be" : "#f9b871";
    ctx.fillRect(drift - 120, y, WORLD_WIDTH + 240, 1);
  }
  ctx.globalAlpha = 1;

  const introPower = 1 - clamp((runState.elapsedMs - 10_000) / 4_000, 0, 1);
  if (introPower > 0) {
    const pulseRadius = 220 + Math.sin(t * 6) * 24;
    ctx.globalAlpha = 0.22 * introPower;
    ctx.beginPath();
    ctx.fillStyle = "#5af1c4";
    ctx.arc(WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.48, pulseRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawArenaFrame() {
  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, WORLD_WIDTH - 20, WORLD_HEIGHT - 20);
}

function drawHazards() {
  for (const hazard of hazards) {
    const pingType = PING_TYPES[hazard.type];
    if (!hazard.active) {
      const progress = clamp(hazard.ageMs / hazard.telegraphMs, 0, 1);
      const radius = lerp(44, hazard.radius + 6, progress);
      ctx.beginPath();
      const pulseAlpha = 0.35 + Math.sin(hazard.ageMs * 0.02) * 0.16;
      ctx.strokeStyle = hexToRgba(pingType.color, pulseAlpha);
      ctx.lineWidth = 3;
      ctx.arc(hazard.x, hazard.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = "700 17px Trebuchet MS, sans-serif";
      ctx.fillStyle = pingType.color;
      ctx.fillText(pingType.icon, hazard.x - 4, hazard.y + 5);
      continue;
    }

    const glow = 0.45 + Math.sin(hazard.ageMs * 0.02) * 0.2;
    ctx.beginPath();
    ctx.fillStyle = hexToRgba(pingType.color, glow);
    ctx.arc(hazard.x, hazard.y, hazard.radius + 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = pingType.color;
    ctx.arc(hazard.x, hazard.y, hazard.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "700 16px Trebuchet MS, sans-serif";
    ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
    ctx.fillText(pingType.icon, hazard.x - 4, hazard.y + 5);
  }
}

function drawPingBursts() {
  for (const burst of pingBursts) {
    const progress = burst.ageMs / burst.lifeMs;
    const radius = burst.maxRadius * progress;
    const pingType = PING_TYPES[burst.type];
    ctx.beginPath();
    ctx.strokeStyle = hexToRgba(pingType.color, 1 - progress);
    ctx.lineWidth = 6 - progress * 4;
    ctx.arc(burst.x, burst.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = "700 20px Trebuchet MS, sans-serif";
    ctx.fillStyle = hexToRgba(pingType.color, 1 - progress * 0.6);
    ctx.fillText(pingType.icon, burst.x - 6, burst.y + 7);
  }
}

function drawPlayer() {
  ctx.beginPath();
  ctx.fillStyle = "#7ef0b5";
  ctx.arc(player.x, player.y, player.radius + 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.fillStyle = "#d8ffe8";
  ctx.arc(player.x, player.y, player.radius - 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawOverlayText() {
  ctx.fillStyle = "rgba(242, 250, 255, 0.94)";
  ctx.font = "600 22px Trebuchet MS, sans-serif";
  ctx.fillText(`Hazards Cleared: ${score}`, 24, WORLD_HEIGHT - 26);

  const selected = PING_TYPES[selectedPingType];
  const pingText = pingCooldownMs <= 0
    ? `${selected.label} ${selected.icon}: READY [SPACE]`
    : `${selected.label} ${selected.icon}: ${(pingCooldownMs / 1000).toFixed(1)}s`;

  ctx.fillStyle = pingCooldownMs <= 0 ? selected.color : "rgba(255, 198, 125, 0.95)";
  ctx.fillText(pingText, WORLD_WIDTH - 340, WORLD_HEIGHT - 26);
}

function drawPingLegend() {
  let offsetX = 22;
  const offsetY = 44;

  for (const type of PING_TYPE_ORDER) {
    const spec = PING_TYPES[type];
    const active = selectedPingType === type;
    const label = `[${spec.key}] ${spec.label} ${spec.icon}`;

    ctx.font = "700 15px Trebuchet MS, sans-serif";
    ctx.fillStyle = active ? spec.color : "rgba(240, 248, 255, 0.72)";
    ctx.fillText(label, offsetX, offsetY);
    offsetX += ctx.measureText(label).width + 18;
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(a, b, t) {
  return a + (b - a) * clamp(t, 0, 1);
}

function hexToRgba(hex, alpha) {
  const clean = hex.replace("#", "");
  const bigint = Number.parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
