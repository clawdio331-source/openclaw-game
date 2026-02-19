export const FIRST_WAVE_DURATION_MS = 10_000;
export const FIRST_WAVE_SPAWN_MS = 420;

export const TELEGRAPH_MIN_MS = 320;
export const TELEGRAPH_MAX_MS = 820;

export const BASE_PARALLAX_BANDS = 36;
export const LOW_FX_PARALLAX_BANDS = 18;

export const STUTTER_FRAME_MS = 20;
export const STUTTER_SAMPLE_WEIGHT = 0.08;

export function clampTelegraphMs(valueMs) {
  return Math.min(TELEGRAPH_MAX_MS, Math.max(TELEGRAPH_MIN_MS, valueMs));
}

export function isInFirstWave(elapsedMs) {
  return elapsedMs <= FIRST_WAVE_DURATION_MS;
}

export function shouldEnableLowFx(avgFrameMs) {
  return avgFrameMs >= STUTTER_FRAME_MS;
}

export function getParallaxBandCount(lowFxMode) {
  return lowFxMode ? LOW_FX_PARALLAX_BANDS : BASE_PARALLAX_BANDS;
}
