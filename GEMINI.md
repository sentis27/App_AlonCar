---
version: 2.0
last_updated_by: antigravity
last_updated: 2026-11-27
source_of_truth: GEMINI.md
---

# 🧭 PROTOCOLO UNIFICADO (`sgai-core` + AlonCar)
Fuente Única de Verdad; aplicar en **cada turno**.

## 1. Sesión, Regla de Oro y Seguridad
- **Inicio:** `git pull`; validar `version` vs `main` (si difiere, frenar); revisar `INDICE_PLANILLAS.md` / `workflows/_meta/INDEX.md` si aplica.
- **Regla de Oro:** prohibido crear/editar sin mostrar propuesta y esperar aprobación explícita.
- **Higiene (`0` tok):** al cerrar correr `sync:meta` + `check:hygiene` (`app/`); sugerir **chat nuevo** tras `push` o cerca de `~70k–80k` tok.
- **Seguridad:** cero credenciales/tokens en texto plano (`docs/01_infraestructura/03_seguridad_credenciales.md`).

## 2. Core `sgai-core` — Router (`SKL-016`) y Pipeline (F1–F4)
| Pedido / Capa | Activación | Cierre |
| :--- | :--- | :--- |
| UI cosmético/JSX (sin BD/servicios) | **Nivel 0** (`SKL-016`): `read_file ≤100L` | Edición + `build` (cierre 3L) |
| Datos/módulos/tablas · 2+ capas | `where -- <mod>` + `SKL-014` · `SKL-008` | Esquema citado · Checklist vivo |
| UI / Grillas `CARGA_EDICION` | `SKL-012` (+ `SKL-013`) | Top-Down, teclado, `useSpreadsheetGrid` |
| Lógica / repos / schemas | `SKL-009`+`SKL-015`+`SKL-007` | Node `data>0` + `build` + `lint` |
| Auditoría / Refactor / Pieza 3 Capas | `SKL-017` / `SKL-018` / `SKL-019` | Paridad, 3 Capas, `check:hygiene --strict` |
| Nuevo módulo · n8n · Docker/BE | §4 · `SKL-001` · `docs/archivo/skills_referencia/` | `00_INDICE` · JSON+SDD · 4 capas |

- **F1 (ODD):** Tool #1 empírico (`where -- <mod>`, `read_file`/`run_command`, `select('*').limit(1)`). Prohibido editar a ciegas.
- **F2 (`.githooks` + `check:hygiene --strict`):** límites `200L` (`schemas/repositories`), `250L` (`lib/hooks/services/pages`), `300L` (`components`); 3 Capas (`SKL-019`, `FL-001..027`: `Canonical*`, Menú Acordeón, Zona 3, Fecha AR `UTC-3` `dateTimeCanonical.js`, Excel/Sheets); Supabase solo en `repositories/` (`_baseRepository`+Zod); `auditService`; `onBlur={() => fn()}`; cero React en `lib/`, UI->`repositories/`, clases React o imports UI cruzados.
- **F3–F4:** Node (`error===null`, `data.length>0`) + `build` + `lint` + `vitest`; cerrar con `🎯 Objetivo`, `🚫 Fuera de alcance`, Checklist vivo y §5.

## 3. Pack AlonCar — Contratos Reales Supabase (Prohibido adivinar)
> Usar `npm.cmd run where -- <mod>` antes de `00_INDICE_DE_MODULOS_Y_CLASIFICACION.md` / `INDICE_PLANILLAS.md`; validar tablas nuevas con `select('*').limit(1)` y Zod `registerTrapKeys`.

| Tabla (PK) | Columnas verificadas | Trampas (NO existen) |
| :--- | :--- | :--- |
| `workers` (`id`) | `name, category, trade, hourly_rate_ars, hourly_rate_usd, work_group, admin_center, status, phone, dni, consumables, consumables_discount_pct, safety_elements, can_withdraw_materials, can_impute_hours, can_charge_third_party, is_foreman` | `first_name`, `last_name` |
| `system_settings` (`key`) | `key, value (jsonb), updated_at, updated_by` (`upsert onConflict:'key'`) | `id`, `app_settings` |
| `organization_roles` (`role_key`) | `role_key, role_title, holder_name, department` | `id` |
| `rate_cards` (`id`) | `period, year, month, quincena, admin_center, entity_name, rate_oficial_ars, rate_oficial_usd, has_ayudante, rate_ayudante_ars, rate_ayudante_usd, dollar_rate` | — |
| `ships` / `work_orders` (`id`) | `ships`: buques/estadías · `work_orders`: `ship_id, ot_number, description, contractors, foreman_name, work_type, status` | — |
| `labor_logs` (`id`) | `worker_id` (FK `workers(id)`), `worker_name, ship_id, work_order_id, work_item_id, hours_worked, date_logged` | `worker_id` NO apunta a `profiles(id)` |
| `third_party_services` (`id`) | `contractor_id` (FK `workers(id)`), `contractor_name, ship_id, work_order_id, work_item_id, amount_ars, amount_usd` | — |
| `work_item_contractors` (`work_item_id, worker_id`) | Puente N:M `work_items(id)` ↔ `workers(id)` vía trigger `trg_work_items_sync_contractors` | — |
| `purchase_orders` (`id`) | `material_id, material_name_raw, requested_by` (FK `workers(id)`), `requested_by_name, courier_worker_id, ship_id, work_order_id, observations` | `notes` |
| `audit_logs` (`id`) | `action, entity_type, entity_id, entity_name, details (jsonb), performed_by, created_at` | `entity`, `table_name` |

## 4. Módulos, Commits y Cierre (`SKL-006`)
- Todo módulo nuevo se clasifica antes (`CARGA_EDICION` Gallo + `audit_logs` vs `METRICAS_ANALISIS` Gallina) e indexa en `00_INDICE`; tabs solo en Sidebar Acordeón (Zona 1 sin tiras/selector de rol; Gallina sin scroll salvo hojas).
- Commits `tipo: descripción corta` atómicos; **push solo con confirmación explícita**. Cierre: `npm.cmd run sync:meta && npm.cmd run check:hygiene` (prohibido leer `INDICE_METADATOS.md` completo manualmente).

## 5. Formato Obligatorio de Respuesta
Inicio: `> **[Gobernanza AlonCar]** Arquetipo: CARGA_EDICION | METRICAS_ANALISIS` + `> **Skills y Estándares activos:** [...]` y `🔧 Técnico:` / `💡 En simple:`.
Propuesta: `🎯 Objetivo:` · `🚫 Fuera de alcance:` · `🔧 Propuesta / Checklist:`.
Cierre: **Nivel 0** (3 líneas + `build OK`) · **Nivel 1+** (`### 🔍 Trazabilidad de Cumplimiento Mecánico` + tabla `### Control de calidad — Entrega (SKL-007)`).
