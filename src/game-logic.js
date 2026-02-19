export const RUN_DURATION_MS = 60_000;
export const MAX_TRUST = 100;
export const MIN_TRUST = 0;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function createRunState() {
  return {
    elapsedMs: 0,
    trust: MAX_TRUST,
    ended: false,
    endReason: null
  };
}

export function getTimeLeftMs(state) {
  return Math.max(0, RUN_DURATION_MS - state.elapsedMs);
}

export function applyTrustDelta(state, delta) {
  if (state.ended) {
    return state;
  }

  const trust = clamp(state.trust + delta, MIN_TRUST, MAX_TRUST);
  const next = {
    ...state,
    trust
  };

  return resolveRunEnd(next);
}

export function advanceRunClock(state, deltaMs) {
  if (state.ended) {
    return state;
  }

  const next = {
    ...state,
    elapsedMs: Math.min(RUN_DURATION_MS, state.elapsedMs + Math.max(0, deltaMs))
  };

  return resolveRunEnd(next);
}

export function resolveRunEnd(state) {
  if (state.ended) {
    return state;
  }

  if (state.trust <= MIN_TRUST) {
    return {
      ...state,
      trust: MIN_TRUST,
      ended: true,
      endReason: "trust"
    };
  }

  if (state.elapsedMs >= RUN_DURATION_MS) {
    return {
      ...state,
      elapsedMs: RUN_DURATION_MS,
      ended: true,
      endReason: "timeout"
    };
  }

  return state;
}
