---
name: legacy-mapping
description: Guides Antigravity in documenting existing Google Sheets, capturing their structure, logic, dependencies, and improvement potential for Supabase/n8n migration. Never assume; ask the user what cannot be detected via MCP.
---

# Legacy Mapping Skill

This skill ensures that legacy Google Sheets are meticulously documented without leaving empty fields, acting as the foundation for the business logic migration.

## When to use this skill
- The user shares a URL or spreadsheet name to document.
- There is a need to understand how a spreadsheet works before integrating it.
- A spreadsheet is slated for migration to Supabase or automation via n8n.
- The user mentions dependencies between spreadsheets.
- Potential improvements are detected while using a spreadsheet.

## How to use it (Step-by-Step Mapping Process)

### Step 0: Initial Orientation
Before opening the sheet, ask the user:
1. What is the technical/functional name of this sheet?
2. Do I have active MCP access for this sheet, or will I work solely on your description?
3. Is this a new mapping or are we updating an existing one?
*Rule:* If a mapping document already exists in the repository, read it first to avoid duplicating work.
*Rule:* Open `INDICE_PLANILLAS.md` first. Assign the next free `GS-0XX` ID and confirm whether this sheet (or its dependencies) are already registered there.

### Step 1: Spreadsheet Classification
Determine the type of sheet using these criteria. If unable to determine, ask the user.
- **TYPE A (Input):** Purpose: register/load operational data. Signals: forms, dropdowns, manual entry columns, ID fields, dates, editing users.
- **TYPE B (Transform):** Purpose: take data from other sources and transform it. Signals: heavy formulas, IMPORTRANGE, QUERY, VLOOKUP, few manual inputs.
- **TYPE C (Output):** Purpose: present processed info for decisions. Signals: dashboards, charts, KPIs, summaries, no editable cells.
- **TYPE D (Hybrid):** Has characteristics of multiple types. Document which sections fulfill which role.

### Step 2: Identity and Business Context
Gather base info via MCP; ask the user for what cannot be read automatically. Fill out the corresponding fields in the template: Name, URL, Type, Department, Main Users, Purpose, Manual integrations (where data comes from/goes to), and Frequency of use.
*Rule:* If the user does not know a field, write "Desconocido — pendiente de validación" with the date. **Never leave it blank.**

### Step 3: Visual Structure and Navigation
Document the "frontend". List existing sheets/tabs, the real header row (ignoring titles above), dashboards/summaries, quick links, and visual elements (colors/icons).

### Step 4: Data Structure and Columns
For each relevant tab, document column by column: Name, Data Type, Entry Method, and Key Formulas.
*Valid Data Types:* String, Number, Date, Boolean, Enum, Formula, Calculated.
*Entry Methods:* MANUAL_LIBRE, MANUAL_VALIDADO, LISTA_SIMPLE, LISTA_DINAMICA, FORMULA, IMPORTADO, SCRIPT, AUTOMATICO.
*Rule:* If an entry method is unclear, ask the user before continuing.

### Step 5: Validations and Alerts Logic
Document business rules: data validations, conditional formatting alerts, and control formulas.

### Step 6: Code Logic (Apps Script)
Check if it has `.gs` code. If yes, document detected functions, active triggers (onEdit, onOpen, time-driven), hidden constraints in the code, and detected risks (fragile logic, hardcoded emails).

### Step 7: Relational Map of Dependencies (CRITICAL)
Document incoming dependencies (this sheet consumes from others) and outgoing dependencies (others consume from this).
- *IMPORTRANGE:* Log source sheet, tab, exact range, and business logic.
- *QUERY/VLOOKUP:* Log internal dependency.
- *Manual copy/paste:* Log as manual dependency (candidate for n8n).
- *Export/Share:* Ask: "Who consumes data from this sheet?"
*Rule:* If you cannot detect dependencies via MCP, explicitly ask the user.

### Step 8: Migration Requirements
Map every candidate table against the entity catalog in `INDICE_PLANILLAS.md` (Ship, Worker, WorkOrder, CostCenter, Material, etc.). Do NOT invent standalone table names. If a piece of data does not fit any existing entity, log it as a **roadmap gap**, not as a new table. Then document: fields to keep, fields to discard (trash data), necessary transformations, and n8n automation candidates.

### Step 9: Observations, Problems, and Improvements
This block is MANDATORY.
Document: Detected frequent problems, Identified improvements (High, Medium, Low priority), Technical debt.
*Rule:* If the user doesn't mention improvements, ask: "Is there anything about this sheet you always wanted to change?" If an improvement is detected during ANY session, add it here before closing.

## General Decision Tree
- **User shares a new sheet:** Execute all 9 steps.
- **User mentions documented sheet:** Read existing doc first, ask what changed.
- **Undocumented dependency detected:** Add to Step 7 of the corresponding doc, notify user.
- **Improvement detected:** Add to Step 9 before session close.
- **User wants full relational map:** Consolidate dependencies from all mappings using `INDICE_PLANILLAS.md` as the consolidation layer.
- **Mapping completed or updated:** Update the corresponding row in `INDICE_PLANILLAS.md` (Type, Mapping Status, Target Module, dependencies).

## Unbreakable Rules
1. No field stays empty. Ask before continuing.
2. Never assume entry methods. Always verify.
3. Dependencies are as critical as the sheet itself.
4. The improvements block is mandatory.
5. Always read existing documents before creating new ones.
6. Every numbered section must carry a confidence tag (CONFIRMADO / INFERIDO / PENDIENTE).
7. After mapping, update the sheet's row in `INDICE_PLANILLAS.md` before closing the session.

**Location for output:**
Save generated mapping documents using the Spanish template located at `.agents/skills/legacy-mapping/recursos/template_mapeo.md` into `docs/planillas/[nombre-tecnico-planilla].md`.
