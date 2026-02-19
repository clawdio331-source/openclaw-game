# OpenClaw Panic Protocol

Short-session 2D prototype for human + OpenClaw agent play.

## Current Prototype (G-004)

Implements the core run loop plus ping system:
- move with `WASD` or arrow keys
- select ping type with `1` (WARN), `2` (SAFE), `3` (RISK)
- deploy selected ping with one action button (`Space`)
- pings are cooldown-bound and time-limited with distinct color/icon VFX
- matching ping-to-threat correctly increases Trust
- always-visible Trust meter
- first 10 seconds run an explicit "first wave" visual surge with parallax motion and threat telegraphs
- end card appears after every run with score, trust streak, daily seed, and a funny fail line
- run ends at `60s` or immediately when Trust hits `0`

## Run Locally

1. Start a local static server from repo root:
```bash
python3 -m http.server 4173
```
2. Open:
`http://localhost:4173/index.html`

## Test

```bash
npm test
```

## Repo Workflow

- `Codex` implements tickets.
- `Opus` reviews tickets.
- `main` is protected and only changed via approved PR + passing checks.

See `ops/LOOP.md` for the loop details.
