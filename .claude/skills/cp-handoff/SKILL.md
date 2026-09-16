---
name: cp-handoff
description: Save progress to GitHub so a teammate or another AI session on another computer can continue exactly where this one stopped — push the branch and post a structured handoff comment on the issue.
argument-hint: <issue-number>
disable-model-invocation: true
allowed-tools: Bash(git status *) Bash(git log *) Bash(git diff *) Bash(git add *) Bash(git commit *) Bash(git push -u origin *) Bash(gh issue comment *) Bash(gh pr view *)
---

# Handoff for issue #$ARGUMENTS

!`git status --short --branch`

!`git log --oneline -8`

1. Nothing may live only on this computer. Commit work in progress (`wip(<lane>): …`) and run `git push -u origin HEAD`. Never push to `main`.
2. Post the handoff comment (≤25 lines, no secrets): `gh issue comment $ARGUMENTS --body-file -`. Write it in Russian with these sections:
   - **Статус:** готово / в процессе / заблокировано
   - **Ветка / PR:** name and link
   - **Что сделано:** files and functions
   - **Что осталось:** checklist
   - **Как проверить:** commands, URLs, test names
   - **Решения и подводные камни:** what was tried, what didn't work, why
   - **Блокеры:** who or what is needed
3. Show the user the comment URL.
