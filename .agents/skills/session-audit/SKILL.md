---
name: session-audit
description: Audits the repository state at the end of a work session. Use when the user says "cerramos", "fin de sesión", "actualiza el sistema", or gives any signal that the task is done. MUST be executed before officially closing the session.
---

# Session Audit Skill

This skill defines how Antigravity must close a work session, ensuring the repository is consistent, updated, and ready for the next session.
Do not assume a fixed structure; read the actual project state.

## When to use this skill
- The user indicates the session is over (e.g., "cerramos", "fin de sesión", "qué quedó pendiente").
- Files were created, renamed, or moved during the session.
- New instructions, modules, or architecture decisions were defined.
- ALWAYS execute this before saying goodbye, even if not explicitly requested.

## How to use it

### Step 1: Session Inventory
Run `git status` and `git diff` in the terminal to strictly list:
- Created files
- Modified files
- Renamed/Moved files
- New folders
- Decisions made in chat that were not documented in files.
*Rule:* If uncertain about a file's scope, ask the user before proceeding.

### Step 2: Read the Repository Map
Open `INDICE_CENTRAL.md` and extract:
- List of registered documents and their paths.
- The declared (or inferred) role of each document.
- Current project phase.
Compare against the `git status` output:
- Are there new files not in the index?
- Are there index entries that no longer exist?
- Does the folder structure match the index?
*Rule:* Never assume the index is updated. Always compare.

### Step 3: Detect Control Documents
Dynamically detect which documents serve a control role based on:
- **Criteria A:** Declared role in the index.
- **Criteria B:** Name pattern (TAREAS_, ROADMAP_, GUIA_, ESTADO_, REGISTRO_).
- **Criteria C:** Content pattern (checkboxes, tracking dates).
- **Criteria D:** Touched today and affects multiple parts of the project.
Once identified, validate them:
- Tasks: Are completed tasks checked? Are new tasks added?
- Roadmap: Is today's progress reflected?
- Instructions: Are new session instructions incorporated?

### Step 4: Internal Consistency Check
- No broken cross-references.
- Paths are relative to the root.
- No credentials or sensitive data in new files.
- If new skills were created, they must be in `.agents/skills/`.

### Step 5: Generate the Closure Summary
Output this exact block for user review:

═══════════════════════════════════════════
  RESUMEN DE CIERRE — [DATE] — [TODAY's TASK]
═══════════════════════════════════════════

**COMPLETED THIS SESSION:**
- [list]

**MODIFIED FILES:**
- [path] → [what changed]

**CREATED FILES:**
- [path] → [purpose]

**VERIFIED CONTROL DOCUMENTS:**
- [name] → [✓ Updated | ⚠ Needs adjustment | — No changes needed]

**NEW DOCUMENTS WITHOUT ASSIGNED ROLE:**
- [list if any]

**BLOCKERS FOR NEXT SESSION:**
- [list if any]

**SUGGESTED NEXT TASK:**
- [based on task document]
═══════════════════════════════════════════
*Final Rule:* Do not close the session until the user approves this summary.
