---
name: cp-task
description: Take a CampusProof GitHub issue end-to-end — claim it, create the lane branch, implement against the existing stub contract, test, and get it ready to ship. Use when asked to "take/work on issue #N".
argument-hint: <issue-number>
disable-model-invocation: true
allowed-tools: Bash(gh issue view *) Bash(gh issue edit *) Bash(gh issue comment *) Bash(git status *) Bash(git fetch *) Bash(git switch *) Bash(git pull --rebase *) Bash(npm run check) Bash(npm run fix) Bash(npx vitest *)
---

# Work on CampusProof issue #$ARGUMENTS

## Issue (auto-loaded)

!`gh issue view $ARGUMENTS --comments`

## Local state

!`git status --short --branch`

If the issue text above is missing, run `gh issue view $ARGUMENTS --comments` yourself.

## Steps

1. **Load context.** Read `AGENTS.md`, `docs/module-map.md`, and every file the issue names. Find the lane (P1–P4) from the issue label. You may edit **only that lane's files** (module map). If the task needs a change to `lib/types.ts` or a new npm package, STOP and tell the user to agree it with P1 first.
2. **Claim.** If nobody else is assigned: `gh issue edit $ARGUMENTS --add-assignee @me`, then comment in Russian: «Взял в работу, ветка `<branch>`». If someone else is assigned and recently active, stop and ask the user.
3. **Branch.** `git fetch origin`, then `git switch -c <lane>/<short-slug> origin/main` (for example `p2/dhash`). If the branch already exists: `git switch <branch>` and `git pull --rebase origin main`. Never work on `main`.
4. **Implement against the contract.** The module already exists and throws `NotImplementedError`. Replace the stub body, keep the exported name and its type. The pipeline already calls it through `lib/pipeline/deps.ts` — no extra wiring.
5. **Test.** Add or extend vitest tests in `tests/` for the new logic (pure functions first). For UI or pipeline work also run `npm run dev` and check `/search?q=KBTU`, `/search?q=demo&replay=1`, or `/dev/fixtures`.
6. **Verify.** `npm run fix`, then `npm run check` must pass. Don't disable tests or lint rules to make it pass.
7. **Update the issue.** Tick the checklist items you completed (edit the issue body), then run the `cp-ship` skill — or, if you stop earlier, run `cp-handoff`.

## Never

Per-university special cases · fake progress or hand-typed scores/tiers · reading or printing `.env*` · force-push · pushing to `main` · editing another lane's files without asking.
