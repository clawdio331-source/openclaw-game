# Codex + Opus Loop (Hands-Off Mode)

## Role Split

- Codex: builder (writes feature code)
- Opus: critic/reviewer (finds issues, requests fixes, approves)

## Safety Rule

Never have both agents editing the same branch at once.

## Queue File

Work is pulled from `ops/backlog.json`.

Status flow:

- `READY` -> `IN_PROGRESS` -> `IN_REVIEW` -> `DONE`
- `BLOCKED` when waiting on external input

## Branch Rules

- Feature branch: `codex/<ticket-id>-<slug>`
- Reviewer can comment but should not implement features

## Merge Rules

- PR required
- 1 approval required
- CI checks required
- auto-merge on green

## Pause Switch

Create a file at `ops/PAUSE` to stop both agents from taking new tickets.

