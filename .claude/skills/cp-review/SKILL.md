---
name: cp-review
description: Review a teammate's CampusProof pull request against the contracts, lane ownership and hackathon integrity rules, then leave one concise review.
argument-hint: <pr-number>
disable-model-invocation: true
allowed-tools: Bash(gh pr view *) Bash(gh pr diff *) Bash(gh pr checks *) Bash(gh pr review *) Bash(gh pr comment *)
---

# Review PR #$ARGUMENTS

!`gh pr view $ARGUMENTS`

!`gh pr checks $ARGUMENTS`

!`gh pr diff $ARGUMENTS`

Check in this order and stop at the first blocker category:

1. **Integrity** (blocker):
   - no per-university special cases or whitelists;
   - no fake progress;
   - tiers and points only from `lib/scoring`;
   - every photo keeps `sourcePageUrl`, `retrievedAt`, and a date;
   - no stock sources;
   - no secrets.
2. **Contracts** (blocker):
   - exported names and types of stub modules unchanged, unless agreed with P1;
   - `lib/types.ts` changes justified and all call sites updated;
   - no new npm dependency without P1.
3. **Lane ownership:** files outside the author's lane (`docs/module-map.md`).
4. **Robustness:**
   - AbortSignal and a timeout on every external call;
   - Wikimedia only via `wikimediaFetch`;
   - failures degrade instead of crashing;
   - no server-only imports in `"use client"` files;
   - EventSource closed on terminal events.
5. **Tests and CI:** new logic has tests; `check` is green; the preview works.

Leave ONE review in Russian: `✅ можно мержить`, or `⚠️ мелочи` (list), or `⛔ блокеры` (list with `file:line` and a suggested fix).

- **No blockers:** `gh pr review $ARGUMENTS --approve --body-file -`
- **Blockers:** `gh pr review $ARGUMENTS --request-changes --body-file -`
