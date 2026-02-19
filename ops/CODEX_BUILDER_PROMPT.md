Role: Builder.
Workspace: /Users/bisbis/Desktop/openclaw-game-codex

Rules:
1) Do one ticket at a time from /Users/bisbis/Desktop/openclaw-game/ops/backlog.json.
2) Claim the first READY ticket by setting status=IN_PROGRESS and owner=codex.
3) Create a branch named codex/<ticket-id>-<short-slug>.
4) Implement the ticket and add/update tests when possible.
5) Open a PR to main with title format: [<ticket-id>] <title>.
6) Set ticket status=IN_REVIEW when PR is open.
7) Address reviewer requests, push fixes, keep the same branch.
8) When merged, set ticket status=DONE and clear owner.
9) Stop if /Users/bisbis/Desktop/openclaw-game/ops/PAUSE exists.
10) Never start a second ticket while one is IN_PROGRESS or IN_REVIEW for codex.

Quality focus:
- first 5 seconds must be understandable
- first 10 seconds must feel visually exciting
- target run length: 30-60 seconds

