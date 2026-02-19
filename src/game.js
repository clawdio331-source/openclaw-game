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
import {
  FIRST_WAVE_DURATION_MS,
  FIRST_WAVE_SPAWN_MS,
  STUTTER_SAMPLE_WEIGHT,
  clampTelegraphMs,
  isInFirstWave,
  shouldEnableLowFx,
  getParallaxBandCount
} from "./visual-tuning.js";
import { createDailySeed, buildFunnyFailReason } from "./end-card.js";

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
const endCause = document.getElementById("endCause");
const endScore = document.getElementById("endScore");
const endStreak = document.getElementById("endStreak");
const endSeed = document.getElementById("endSeed");

const WORLD_WIDTH = canvas.width;
const WORLD_HEIGHT = canvas.height;
const PLAYER_SPEED = 360;
const HAZARD_BASE_SPAWN_MS = 860;
const HAZARD_MIN_SPAWN_MS = 390;
const TRUST_DRAIN_PER_SECOND = 28;

const keysDown = new Set();
const backdropNodes = buildBackdropNodes(72);

let runState = createRunState();
let runActive = false;
let hazards = [];
let pingBursts = [];
let score = 0;
let pingCooldownMs = 0;
let selectedPingType = "warn";
let trustStreak = 0;
let bestTrustStreak = 0;
let spawnAccumulatorMs = 0;
let firstWaveAccumulatorMs = 0;
let alertFlashMs = 0;
let shakePower = 0;
let avgFrameMs = 16;
let lowFxMode = false;
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
  trustStreak = 0;
  bestTrustStreak = 0;
  spawnAccumulatorMs = 0;
  firstWaveAccumulatorMs = 0;
  alertFlashMs = 640;
  shakePower = 5.5;
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
  const dailySeed = createDailySeed();
  const causeText = runState.endReason === "trust"
    ? `Trust collapsed at ${survived}s.`
    : `Full extraction after ${survived}s.`;
  const funnyReason = buildFunnyFailReason({
    endReason: runState.endReason,
    score,
    streak: bestTrustStreak,
    seed: dailySeed
  });

  endTitle.textContent = runState.endReason === "trust" ? "Trust Depleted" : "Mission Survived";
  endCause.textContent = causeText;
  endScore.textContent = String(score);
  endStreak.textContent = String(bestTrustStreak);
  endSeed.textContent = dailySeed;
  endReason.textContent = funnyReason;
  endOverlay.classList.remove("hidden");
}

function frame(timestampMs) {
  const deltaMs = Math.min(40, Math.max(0, timestampMs - lastFrameMs));
  lastFrameMs = timestampMs;

  avgFrameMs = lerp(avgFrameMs, deltaMs, STUTTER_SAMPLE_WEIGHT);
  lowFxMode = shouldEnableLowFx(avgFrameMs);
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

  alertFlashMs = Math.max(0, alertFlashMs - deltaMs);
  shakePower = Math.max(0, shakePower - deltaMs * 0.0078);

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
    scored: false,
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
    hazards.push(createHazard({ speedBonus: 12 }));
  }

  if (isInFirstWave(runState.elapsedMs)) {
    firstWaveAccumulatorMs += deltaMs;
    while (firstWaveAccumulatorMs >= FIRST_WAVE_SPAWN_MS) {
      firstWaveAccumulatorMs -= FIRST_WAVE_SPAWN_MS;
      hazards.push(createHazard({ telegraphBiasMs: -180, speedBonus: 24, introThreat: true }));
      if (!lowFxMode && Math.random() > 0.56) {
        hazards.push(createHazard({ telegraphBiasMs: -140, speedBonus: 14, introThreat: true }));
      }
      triggerVisualSurge(180, 1.6);
    }
  } else {
    firstWaveAccumulatorMs = 0;
  }
}

function createHazard(options = {}) {
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

  const telegraphMs = clampTelegraphMs((640 + Math.random() * 200) + (options.telegraphBiasMs ?? 0));
  const speed = (speedByType[type] ?? 136) + Math.random() * 52 + (options.speedBonus ?? 0);

  return {
    type,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: 15 + Math.random() * 8,
    speed,
    ageMs: 0,
    telegraphMs,
    introThreat: options.introThreat ?? false,
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
      if (hazard.introThreat) {
        triggerVisualSurge(140, 1.25);
      }
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
    if (trustDelta < 0) {
      trustStreak = 0;
    }
  }
}

function updatePingBursts(deltaMs) {
  let missedPing = false;
  for (const burst of pingBursts) {
    burst.ageMs += deltaMs;
    if (burst.ageMs >= burst.lifeMs && !burst.scored) {
      missedPing = true;
    }
  }

  pingBursts = pingBursts.filter((burst) => burst.ageMs < burst.lifeMs);
  if (missedPing) {
    trustStreak = 0;
  }

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
      if (!burst.scored) {
        burst.scored = true;
        trustStreak += 1;
        bestTrustStreak = Math.max(bestTrustStreak, trustStreak);
      }
      triggerVisualSurge(120, 0.9);
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

  ctx.save();
  applyShake();

  drawBackground();
  drawArenaFrame();
  drawPingLegend();
  drawHazards();
  drawPingBursts();
  drawPlayer();
  drawOverlayText();
  drawFirstWaveBanner();

  ctx.restore();

  if (alertFlashMs > 0) {
    const alpha = Math.min(0.26, (alertFlashMs / 220) * 0.22);
    ctx.fillStyle = `rgba(188, 246, 255, ${alpha})`;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  }
}

function drawBackground() {
  const t = visualClockMs / 1000;
  const gradient = ctx.createLinearGradient(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  gradient.addColorStop(0, "#04131c");
  gradient.addColorStop(0.4, "#0a2432");
  gradient.addColorStop(1, "#173c4d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  const bandCount = getParallaxBandCount(lowFxMode);
  for (let i = 0; i < bandCount; i += 1) {
    const depth = i / Math.max(1, bandCount - 1);
    const speed = 26 + depth * 92;
    const y = ((i * 30 + t * speed) % (WORLD_HEIGHT + 90)) - 45;
    const drift = Math.sin(t * (0.5 + depth * 1.3) + i) * (30 + depth * 65);

    ctx.globalAlpha = 0.2 + depth * 0.12;
    ctx.fillStyle = i % 2 === 0 ? "#58dcc5" : "#ffbd73";
    ctx.fillRect(-160 + drift, y, WORLD_WIDTH + 320, 1 + depth * 2.4);
  }

  const nodeLimit = lowFxMode ? 22 : backdropNodes.length;
  for (let i = 0; i < nodeLimit; i += 1) {
    const node = backdropNodes[i];
    const nx = node.x + Math.sin(t * (0.45 + node.depth) + node.phase) * 42 * node.depth;
    const ny = ((node.y + t * node.speed) % (WORLD_HEIGHT + 120)) - 60;

    ctx.globalAlpha = 0.16 + node.depth * 0.32;
    ctx.fillStyle = node.color;
    ctx.beginPath();
    ctx.arc(nx, ny, node.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (isInFirstWave(runState.elapsedMs)) {
    const introPower = 1 - clamp((runState.elapsedMs - FIRST_WAVE_DURATION_MS) / 1200, 0, 1);
    ctx.globalAlpha = 0.14 * introPower;
    const pulseRadius = 200 + Math.sin(t * 5.2) * 44;
    ctx.fillStyle = "#95f6d2";
    ctx.beginPath();
    ctx.arc(WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.5, pulseRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawArenaFrame() {
  ctx.strokeStyle = lowFxMode ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.28)";
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, WORLD_WIDTH - 20, WORLD_HEIGHT - 20);
}

function drawHazards() {
  for (const hazard of hazards) {
    const pingType = PING_TYPES[hazard.type];
    if (!hazard.active) {
      const progress = clamp(hazard.ageMs / hazard.telegraphMs, 0, 1);
      const radius = lerp(62, hazard.radius + 8, progress);
      const pulseAlpha = 0.42 + Math.sin(hazard.ageMs * 0.027) * 0.15;

      ctx.beginPath();
      ctx.strokeStyle = hexToRgba(pingType.color, pulseAlpha);
      ctx.lineWidth = 3;
      ctx.arc(hazard.x, hazard.y, radius, 0, Math.PI * 2);
      ctx.stroke();

      const dirX = player.x - hazard.x;
      const dirY = player.y - hazard.y;
      const length = Math.hypot(dirX, dirY) || 1;
      const tx = hazard.x + (dirX / length) * (radius + 8);
      const ty = hazard.y + (dirY / length) * (radius + 8);
      ctx.strokeStyle = hexToRgba(pingType.color, 0.32);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hazard.x, hazard.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      ctx.font = "700 20px Trebuchet MS, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillText(pingType.icon, hazard.x - 5, hazard.y + 7);
      continue;
    }

    const glow = 0.45 + Math.sin(hazard.ageMs * 0.02) * 0.2;
    ctx.beginPath();
    ctx.fillStyle = hexToRgba(pingType.color, glow);
    ctx.arc(hazard.x, hazard.y, hazard.radius + 6, 0, Math.PI * 2);
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
  ctx.font = "600 16px Trebuchet MS, sans-serif";
  ctx.fillStyle = "rgba(214, 248, 238, 0.92)";
  ctx.fillText(`Trust Streak: ${trustStreak}  Best: ${bestTrustStreak}`, 24, WORLD_HEIGHT - 50);

  const selected = PING_TYPES[selectedPingType];
  const pingText = pingCooldownMs <= 0
    ? `${selected.label} ${selected.icon}: READY [SPACE]`
    : `${selected.label} ${selected.icon}: ${(pingCooldownMs / 1000).toFixed(1)}s`;

  ctx.fillStyle = pingCooldownMs <= 0 ? selected.color : "rgba(255, 198, 125, 0.95)";
  ctx.fillText(pingText, WORLD_WIDTH - 340, WORLD_HEIGHT - 26);

  if (lowFxMode) {
    ctx.font = "600 12px Trebuchet MS, sans-serif";
    ctx.fillStyle = "rgba(224, 232, 241, 0.72)";
    ctx.fillText("LOW FX MODE", WORLD_WIDTH - 112, 28);
  }
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

function drawFirstWaveBanner() {
  if (!runActive || !isInFirstWave(runState.elapsedMs)) {
    return;
  }

  const remainMs = Math.max(0, FIRST_WAVE_DURATION_MS - runState.elapsedMs);
  const introAlpha = 0.25 + Math.sin(visualClockMs * 0.013) * 0.08;

  ctx.fillStyle = `rgba(255, 230, 182, ${introAlpha})`;
  ctx.font = "700 26px Trebuchet MS, sans-serif";
  ctx.fillText("FIRST WAVE", WORLD_WIDTH * 0.5 - 84, 78);

  ctx.fillStyle = "rgba(244, 249, 255, 0.86)";
  ctx.font = "600 16px Trebuchet MS, sans-serif";
  ctx.fillText(`Threat surge ${(remainMs / 1000).toFixed(1)}s`, WORLD_WIDTH * 0.5 - 82, 100);
}

function triggerVisualSurge(flashMs, shakeBoost) {
  alertFlashMs = Math.max(alertFlashMs, flashMs);
  shakePower = Math.max(shakePower, shakeBoost);
}

function applyShake() {
  if (!runActive || shakePower <= 0) {
    return;
  }
  const x = (Math.random() - 0.5) * shakePower * 2;
  const y = (Math.random() - 0.5) * shakePower * 2;
  ctx.translate(x, y);
}

function buildBackdropNodes(count) {
  const nodes = [];
  for (let i = 0; i < count; i += 1) {
    const depth = 0.2 + Math.random() * 0.95;
    nodes.push({
      x: Math.random() * WORLD_WIDTH,
      y: Math.random() * WORLD_HEIGHT,
      depth,
      phase: Math.random() * Math.PI * 2,
      speed: 16 + depth * 54,
      size: 0.9 + depth * 2.6,
      color: i % 2 === 0 ? "#84edd7" : "#ffd49d"
    });
  }
  return nodes;
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
