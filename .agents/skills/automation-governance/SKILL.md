---
name: automation-governance
description: Governs changes to n8n workflows in production. Activates automatically when a modification is proposed to a workflow marked `activo` or `activo-sin-SDD` in workflows/_meta/INDEX.md, or when the user explicitly requests a governance check. Applies in both Claude Code and Antigravity sessions.
---

# Automation Governance

## When to activate
- A modification keyword ("modificar", "cambiar", "mejorar", "arreglar", "actualizar") is applied to a workflow whose Estado in `workflows/_meta/INDEX.md` is `activo` or `activo-sin-SDD`.
- The user explicitly asks for this review.

## What to do
1. Read the affected workflow's `SDD.md` in full before evaluating any proposal.
2. Check the proposal against every documented business rule (RN-*) in that SDD.
3. Confirm the proposal accounts for the workflow's critical dependencies.
4. Validate versioning: changes use `NombreWorkflow_v{n+1}` — never overwrite an existing version.

## If risk is detected
- Stop before any file is written.
- Report which rule, dependency, or versioning convention is at risk, citing the SDD section.
- Wait for explicit user confirmation before continuing.
