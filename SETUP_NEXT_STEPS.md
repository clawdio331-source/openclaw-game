# Next Steps (Beginner Runbook)

## 1) Create the GitHub repo in the browser

1. Open GitHub and sign in.
2. Click **New repository**.
3. Repository name: `openclaw-game`
4. Set visibility as you prefer (`Private` is fine).
5. Do **not** initialize with README, `.gitignore`, or license.
6. Click **Create repository**.

## 2) Connect local repo to GitHub

Replace `<YOUR_GITHUB_USERNAME>` with your real username:

```bash
cd /Users/bisbis/Desktop/openclaw-game
git remote add origin git@github.com:<YOUR_GITHUB_USERNAME>/openclaw-game.git
git push -u origin main
git push -u origin codex/staging
git push -u origin opus/staging
```

If SSH is not configured, use HTTPS instead:

```bash
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/openclaw-game.git
```

## 3) Protect main branch in GitHub

1. Repo -> **Settings** -> **Branches** -> **Add branch protection rule**
2. Branch name pattern: `main`
3. Enable:
   - Require a pull request before merging
   - Require approvals (1)
   - Require status checks to pass (select `validate`)
   - Do not allow bypassing the above settings
4. Save changes

## 4) Start your two-agent loop

### Codex session

Use workspace:

`/Users/bisbis/Desktop/openclaw-game-codex`

Prompt source:

`/Users/bisbis/Desktop/openclaw-game/ops/CODEX_BUILDER_PROMPT.md`

### Opus session (in Antigravity)

Use workspace:

`/Users/bisbis/Desktop/openclaw-game-opus`

Prompt source:

`/Users/bisbis/Desktop/openclaw-game/ops/OPUS_REVIEWER_PROMPT.md`

## 5) Emergency stop

```bash
touch /Users/bisbis/Desktop/openclaw-game/ops/PAUSE
git -C /Users/bisbis/Desktop/openclaw-game add ops/PAUSE
git -C /Users/bisbis/Desktop/openclaw-game commit -m "chore: pause agent loop"
git -C /Users/bisbis/Desktop/openclaw-game push
```

