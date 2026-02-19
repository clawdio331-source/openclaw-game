# OpenClaw Panic Protocol

Short-session 2D prototype for human + OpenClaw agent play.

## Current Prototype (G-001)

Implements the core run loop:
- move with `WASD` or arrow keys
- one action button (`Space`) for pulse blast
- always-visible Trust meter
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
