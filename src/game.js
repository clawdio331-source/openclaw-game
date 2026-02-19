import {
  RUN_DURATION_MS,
  createRunState,
  getTimeLeftMs,
  applyTrustDelta,
  advanceRunClock
} from "./game-logic.js";

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
const ACTION_COOLDOWN_MS = 1_200;
const HAZARD_BASE_SPAWN_MS = 900;
const HAZARD_MIN_SPAWN_MS = 440;
const TRUST_DRAIN_PER_SECOND = 28;

const keysDown = new Set();

let runState = createRunState();
let runActive = false;
let hazards = [];
let pulses = [];
let score = 0;
let actionCooldownMs = 0;
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
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "w", "a", "s", "d"].includes(key) || event.key === " ") {
    event.preventDefault();
  }
  keysDown.add(key);

  if ((key === " " || event.code === "Space") && !event.repeat) {
    triggerPulse();
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
  pulses = [];
  score = 0;
  actionCooldownMs = 0;
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
  updateActionCooldown(deltaMs);
  spawnHazards(deltaMs);
  updateHazards(deltaMs);
  updatePulses(deltaMs);

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

function updateActionCooldown(deltaMs) {
  actionCooldownMs = Math.max(0, actionCooldownMs - deltaMs);
}

function triggerPulse() {
  if (!runActive || actionCooldownMs > 0) {
    return;
  }

  actionCooldownMs = ACTION_COOLDOWN_MS;
  pulses.push({
    x: player.x,
    y: player.y,
    ageMs: 0,
    lifeMs: 350,
    maxRadius: 180
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

  const speed = 130 + Math.random() * 75;
  return {
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

function updatePulses(deltaMs) {
  for (const pulse of pulses) {
    pulse.ageMs += deltaMs;
  }

  pulses = pulses.filter((pulse) => pulse.ageMs < pulse.lifeMs);

  if (pulses.length === 0 || hazards.length === 0) {
    return;
  }

  const survivors = [];
  for (const hazard of hazards) {
    let removed = false;
    for (const pulse of pulses) {
      const radius = (pulse.ageMs / pulse.lifeMs) * pulse.maxRadius;
      const dist = Math.hypot(hazard.x - pulse.x, hazard.y - pulse.y);
      if (dist <= radius + hazard.radius) {
        removed = true;
        score += 1;
        runState = applyTrustDelta(runState, 1.5);
        break;
      }
    }
    if (!removed) {
      survivors.push(hazard);
    }
  }
  hazards = survivors;
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
  drawHazards();
  drawPulses();
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
    if (!hazard.active) {
      const progress = clamp(hazard.ageMs / hazard.telegraphMs, 0, 1);
      const radius = lerp(44, hazard.radius + 6, progress);
      ctx.beginPath();
      ctx.strokeStyle = `rgba(255, 186, 92, ${0.4 + Math.sin(hazard.ageMs * 0.02) * 0.2})`;
      ctx.lineWidth = 3;
      ctx.arc(hazard.x, hazard.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }

    const glow = 0.45 + Math.sin(hazard.ageMs * 0.02) * 0.2;
    ctx.beginPath();
    ctx.fillStyle = `rgba(255, 108, 108, ${glow})`;
    ctx.arc(hazard.x, hazard.y, hazard.radius + 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = "#ff7b7b";
    ctx.arc(hazard.x, hazard.y, hazard.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPulses() {
  for (const pulse of pulses) {
    const progress = pulse.ageMs / pulse.lifeMs;
    const radius = pulse.maxRadius * progress;
    ctx.beginPath();
    ctx.strokeStyle = `rgba(117, 246, 186, ${1 - progress})`;
    ctx.lineWidth = 6 - progress * 4;
    ctx.arc(pulse.x, pulse.y, radius, 0, Math.PI * 2);
    ctx.stroke();
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

  const pulseText = actionCooldownMs <= 0
    ? "Pulse: READY [SPACE]"
    : `Pulse Cooldown: ${(actionCooldownMs / 1000).toFixed(1)}s`;
  ctx.fillStyle = actionCooldownMs <= 0 ? "rgba(126, 240, 181, 0.95)" : "rgba(255, 185, 122, 0.95)";
  ctx.fillText(pulseText, WORLD_WIDTH - 280, WORLD_HEIGHT - 26);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(a, b, t) {
  return a + (b - a) * clamp(t, 0, 1);
}
