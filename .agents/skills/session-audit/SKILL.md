---
name: session-audit
description: Audits the repository state at the end of a work session. Use when the user says "cerramos", "fin de sesión", "actualiza el sistema", or gives any signal that the task is done. MUST be executed before officially closing the session.
---

# Session Audit Skill

This skill defines how Antigravity must close a work session, ensuring the repository is consistent, updated, and ready for the next session.
Do not assume a fixed structure; read the actual project state and the metadata index.

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

### Step 2: Read the Metadata Index
Open `INDICE_METADATOS.md` and parse the metadata table. Extract:
- All rows where `Comportamiento-IA` is NOT `ninguno` — these are control documents.
- The current `Estado` and `Fase` of each document.
- The `Depende de` column for dependency tracking.

Also open `INDICE_CENTRAL.md` for narrative context:
- List of registered documents and their paths.
- Current project phase.

Compare against the `git status` output:
- Are there new files not in the metadata index?
- Are there index entries that no longer exist on disk?
- Does the folder structure match the index?
*Rule:* Never assume the index is updated. Always compare.

### Step 3: Process Control Documents
Filter the metadata table: select rows where `Comportamiento-IA` != `ninguno`.
For each row, execute the behavior in left-to-right precedence order:

- **`consultar-siempre`**: Read the document before processing other behaviors.
- **`auditar-tareas`**: Verify completed tasks are checked, new tasks are added.
- **`auditar-avances`**: Verify today's progress is reflected in the roadmap.
- **`auditar-reglas`**: Verify agent instructions are consistent with session decisions.
- **`auditar-decisiones`**: Verify decisions made in chat are documented.
- **`auditar-dependencias`**: Verify cross-references are not broken (see Step 4).
- **`validar-integridad`**: Verify the document conforms to its own schema.
- **`ignorar-en-auditoria`**: Skip this document entirely.

Respect the `Lectura` column:
- `completo`: Read the entire file.
- `cambios`: Read only if `Última revisión` is within the last 24 hours.
- `primera-vez`: Read fully only in the first session, then treat as `cambios`.
- `ignorar`: Do not read.

### Step 4: Dependency Detection and Consistency Check
For each file modified during this session (from `git status`):
1. Search for Markdown links: `[text](path/to/file.md)` — register as dependency.
2. Search for textual references: literal mentions of filenames (e.g., `TAREAS_PENDIENTES.md`).
3. Search for skill imports: mentions of `.agents/skills/` paths.
4. Search for file path literals: `docs/01_infraestructura/...` and similar.
5. Cross-check against the `Depende de` column in `INDICE_METADATOS.md`:
   - If a new dependency is found, update the column.
   - If a dependency no longer exists, remove it.
6. If a file that other documents depend on was modified, flag those dependents for review.

Additionally verify:
- No broken cross-references (links pointing to non-existent files).
- Paths are relative to the root.
- No credentials or sensitive data in new files.
- If new skills were created, they must be in `.agents/skills/`.

### Step 5: Update Metadata and Generate Closure Summary
**Auto-update `INDICE_METADATOS.md`:**
- For each file processed during the audit, update `Última revisión` to today's date.
- For each new file detected in `git status`, add a new row with appropriate metadata.
  - If the `Tipo` or `Comportamiento-IA` cannot be inferred, ask the user.
- Update the `Depende de` column with any dependencies detected in Step 4.

**Output this exact block for user review:**

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

**DEPENDENCIES DETECTED/UPDATED:**
- [file] now depends on: [list]
- [file] is depended on by: [list]
- ALERTS: [if a critical file changed, list dependents that may need review]

**NEW DOCUMENTS WITHOUT ASSIGNED ROLE:**
- [list if any]

**BLOCKERS FOR NEXT SESSION:**
- [list if any]

**SUGGESTED NEXT TASK:**
- [based on task document]
═══════════════════════════════════════════

### Step 6: Metadata Integrity Validation
Before closing, validate `INDICE_METADATOS.md` itself:
- [ ] Every file listed in the table exists on disk.
- [ ] Every file on disk (in `docs/`, `.agents/skills/`, and root `.md` files) is listed in the table.
- [ ] `Última revisión` dates are not in the future and not impossibly old.
- [ ] All values in `Tipo`, `Comportamiento-IA`, `Lectura`, `Fase`, and `Estado` columns use valid vocabulary terms.
- [ ] `schema-version` header matches the expected version (currently `1.0`).

If inconsistencies are found, alert the user but do NOT block the audit.

*Final Rule:* Do not close the session until the user approves the closure summary.
