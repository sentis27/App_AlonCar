---
name: rtk
description: Compresses Bash command output before it reaches the context window. Use for git log, git status, test output, and npm/pip install logs. Does not apply to native Claude Code tools (Read, Grep, Glob).
---

# RTK

## What it does
- Compresses the output of Bash commands before it enters the conversation context.

## Where it applies
- `git log`, `git status`
- Test suite output
- `npm install` / `pip install` output

## Where it does not apply
- Native Claude Code tools: Read, Grep, Glob. RTK only wraps Bash output, not these tools.

## Maintenance
- Measure real savings with `rtk gain`.
- If savings do not exceed 20% over a week, evaluate uninstalling.
