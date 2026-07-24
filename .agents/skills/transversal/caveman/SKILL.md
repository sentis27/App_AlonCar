---
name: caveman
description: Activates compressed communication mode in Claude Code to reduce output tokens while preserving exact code, paths, and error messages. Use at the start of long development sessions; must be deactivated before writing any repository file.
---

# Caveman

## What it does
- Activates a compressed communication mode in Claude Code.
- Reduces output tokens by roughly 65%, while keeping code, paths, and error messages exact and unabridged.

## When to activate
- At the start of development sessions expected to be long or token-heavy.

## Mandatory rule
- Deactivate before writing any repository file (SDD, README, CLAUDE.md, INDEX, or any other file written to disk).
- Reactivate once the write is complete.

## Why
- Compressed mode is for conversational efficiency, not for file content. Writing repo files while compression is active risks losing precision in code, paths, or documentation prose.
