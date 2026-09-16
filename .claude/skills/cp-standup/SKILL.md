---
name: cp-standup
description: Summarize CampusProof team progress for a checkpoint sync (13:00 / 16:00 / 19:00 / 22:00) — milestones, open PRs, CI on main, blockers, and which cut rule to apply.
disable-model-invocation: true
allowed-tools: Bash(gh api *) Bash(gh pr list *) Bash(gh issue list *) Bash(gh issue view *) Bash(gh run list *)
---

# Checkpoint summary

## Milestones

!`gh api "repos/{owner}/{repo}/milestones?state=all" --jq '.[] | "\(.title): open \(.open_issues), closed \(.closed_issues)"'`

## Open pull requests

!`gh pr list --state open`

## Blocked issues

!`gh issue list --state open --label blocked`

## CI on main

!`gh run list --branch main --limit 3`

Write a short Russian summary (≤15 lines):

- **Per milestone:** done vs open, and who owns the open items (labels P1–P4).
- **PRs:** those waiting for review or with failing checks, and who should act.
- **Blockers:** who is blocked and what unblocks them.
- **Plan check:** compare the current time with `docs/plan-thursday.md` §5 and §8, and name the cut rule to apply now, if any.
