---
name: cp-ship
description: Ship the current CampusProof branch as a pull request — rebase on main, format, run all checks, commit, push, open a PR that closes the issue, and enable auto-merge.
argument-hint: <issue-number>
disable-model-invocation: true
allowed-tools: Bash(git status *) Bash(git log *) Bash(git diff *) Bash(git fetch *) Bash(git pull --rebase *) Bash(git add *) Bash(git commit *) Bash(git push -u origin *) Bash(npm run fix) Bash(npm run check) Bash(gh pr create *) Bash(gh pr view *) Bash(gh pr merge *) Bash(gh pr checks *)
---

# Ship the current branch for issue #$ARGUMENTS

!`git status --short --branch`

!`git log --oneline origin/main..HEAD`

1. If the current branch is `main`, STOP: create a lane branch first (`cp-task`).
2. `git fetch origin` → `git pull --rebase origin main`. Resolve conflicts with the `cp-sync` rules.
3. `npm run fix`, then `npm run check`. Fix every failure properly.
4. Self-review `git diff origin/main...HEAD`: no secrets, no per-university special cases, no debugging leftovers, no files from another lane (except an agreed contract change).
5. Commit with a short English imperative message and lane prefix, e.g. `feat(p2): dHash and hamming distance`.
6. `git push -u origin HEAD`.
7. `gh pr create --fill-first --body "<body>"` where the body follows `.github/pull_request_template.md`, is written in Russian, and starts with `Closes #$ARGUMENTS`.
8. `gh pr merge --auto --squash` — GitHub merges it by itself as soon as the required `check` job is green.
9. Report to the user: the PR URL; that the Vercel preview link appears in the PR within ~2 minutes; exactly what to open or click to verify.
