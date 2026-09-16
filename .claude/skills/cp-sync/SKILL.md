---
name: cp-sync
description: Bring the current CampusProof branch up to date with main and resolve merge conflicts safely (lane ownership rules). Use in the morning, when main moved, or when a PR says the branch is out of date.
disable-model-invocation: true
allowed-tools: Bash(git status *) Bash(git fetch *) Bash(git stash *) Bash(git pull --rebase *) Bash(git rebase --continue) Bash(git add *) Bash(git diff *) Bash(git log *) Bash(npm ci) Bash(npm run check)
---

# Sync with main

!`git status --short --branch`

1. Never discard uncommitted work. Commit it (`wip(...)`) or `git stash`.
2. `git fetch origin` → `git pull --rebase origin main`.
3. Conflict rules:
   - **Your lane's files:** merge both sides carefully.
   - **Files owned by another lane** (see `docs/module-map.md`): take the version from `origin/main`.
   - **`package-lock.json`:** take `origin/main`'s version, then run `npm ci`.
   - **`lib/types.ts`:** keep every field from both sides and never drop someone else's addition. If the types disagree, stop and ask the user to involve P1.
4. If `package.json` changed on main, run `npm ci`.
5. `npm run check`.
6. Summarize for the user what landed on main since the branch point that matters for their task: `git log --oneline <old-base>..origin/main`.
