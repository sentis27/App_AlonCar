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

### Step 1: Automated Hygiene & Metadata Sync (`0` tokens)
Run `npm.cmd run sync:meta` followed by `npm.cmd run check:hygiene` (inside `app/`) and `git status -s` in the terminal.
- `sync:meta` automatically adds new active `.md` rows, removes orphan rows, and updates `Última revisión` for modified files in `INDICE_METADATOS.md`.
- **NEVER manually read `INDICE_METADATOS.md` in full** during session close — rely on `sync:meta` + `check:hygiene`.
- `check:hygiene` automatically validates:
  - Zero absolute local-user paths or `file:` URIs, and zero broken Markdown links.
  - 100% sync between active `.md` files and `INDICE_METADATOS.md`, and zero duplicate `DEC-`/`ERR-` IDs.
  - Live-doc size alert (`> 15 KB` on `TAREAS_PENDIENTES.md` or `BITACORA_DELTAS_SESION.md` triggers historical rotation).
  - **Modularity ceiling (`≤ 300 L`):** every file created or modified in `app/src/components/`, `app/src/hooks/`, `app/src/lib/`, or `app/src/services/` must stay `≤ 300 L` (or must not grow if it was already legacy `> 300 L`).
  - `oxlint` (`0` errors) and `vite build`.
- From `git status -s` / `git diff --name-only`, list strictly the session delta (created, modified, renamed/deleted files and decisions made in chat).
*Rule:* Do NOT manually read all 20 control documents at session close. Rely on `check:hygiene` and inspect/update **only** what the delta touches or what `check:hygiene` flags.

### Step 2: Delta-Only Control Docs Update
1. `INDICE_METADATOS.md` is already kept in sync by `npm.cmd run sync:meta` (Step 1); inspect only if `check:hygiene` flags a custom anomaly.
2. Update `TAREAS_PENDIENTES.md`, `docs/02_producto/05_auditorias/BITACORA_DELTAS_SESION.md`, `workflows/_meta/INDEX.md`, or `docs/MATRIZ_RESPONSABILIDAD_DATOS.md` ONLY if the session delta actually changed tasks, modules, workflows, or schema contracts.
3. If `check:hygiene` alerts that `TAREAS_PENDIENTES.md` or `BITACORA_DELTAS_SESION.md` exceeds `15 KB`, rotate historical `[x]` / old sessions to `docs/archivo/` / `docs/02_producto/05_auditorias/archivo/`.

### Step 3: Trigger `product-collector` (Only If Applicable)
While reviewing the session delta, invoke `product-collector` ONLY if at least one of the following occurred:
- An architectural decision was made and justified.
- An error was solved with a validated solution.
- A new conceptual understanding or validated step-by-step process was established.

### Step 4: Dependency Check on Modified Files
Only for files modified in `git status -s`:
- Verify any new Markdown links, `Depende de` entries in `INDICE_METADATOS.md`, and that no credentials/secrets were introduced.
- Verify any new skill is under `.agents/skills/` and registered in `.agents/skills/SKILLS_REGISTRY.md`.

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

### Step 6: Hygiene Re-Check & Session Hygiene Rule
- Re-run `npm.cmd run sync:meta && npm.cmd run check:hygiene` after updating docs and confirm `exit 0` with zero errors.
- **Session Hygiene Rule:** Always suggest opening a **new clean chat** after each major `push` or when context approaches `~70k–80k` tokens to prevent `O(N²)` context snowball and re-compaction costs.

*Final Rule:* Do not close the session until the user approves the closure summary.
