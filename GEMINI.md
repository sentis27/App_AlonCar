---
version: 1.4
last_updated_by: antigravity
last_updated: 2026-11-13
source_of_truth: GEMINI.md
---

# 🧭 PROTOCOLO DE GOBERNANZA UNIFICADO — ALONCAR ERP

Fuente Única de Verdad para Antigravity, Claude Code y cualquier agente en este repo. Ejecutar en **cada turno** antes de proponer o editar.

## 1. Sesión, Regla de Oro y Seguridad
- **Inicio obligatorio:** correr `git pull`; verificar que `version` del frontmatter coincida con `main` (si difiere, frenar); reportar estado de `INDICE_PLANILLAS.md` y `workflows/_meta/INDEX.md` si aplica.
- **Regla de Oro de Disco:** prohibido crear o modificar archivos en disco de forma unilateral; mostrar propuesta en el chat y esperar aprobación explícita del usuario.
- **Higiene de sesión:** correr `npm.cmd run check:hygiene` (`app/`) antes de cerrar; sugerir abrir un **chat nuevo** después de cada `push` importante o al superar `~130k` tokens de contexto.
- **Seguridad:** nunca credenciales, tokens o API keys en texto plano (usar placeholders; ver `docs/01_infraestructura/03_seguridad_credenciales.md`).

## 2. Router (`SKL-016`) y Pipeline Mecánico (4 Fases)

| Pedido / Capa | Skill Obligatoria | Primer Tool Call | Condición de Cierre |
| :--- | :--- | :--- | :--- |
| UI cosmético/JSX (sin BD ni servicios) | **Nivel 0** (`SKL-016` Fast-Track) | `read_file` acotado (`≤ 100 L`) | Edición puntual + `npm.cmd run build` (sin índices ni Supabase). |
| Datos, tablas o columnas | `SKL-014` | `read_file` / `run_command` (F1) | Cero asunciones; esquema verificado citado. |
| 2+ tareas o varias capas | `SKL-008` | `read_file` / `run_command` | Tabla de etapas (*Fast-Track* o *Freno por Riesgo*). |
| UI, formularios y flujos | `SKL-012` | `read_file` | Vector Único, Top-Down y compresión dimensional. |
| Grillas editables (`CARGA_EDICION`) | `SKL-013` | `read_file` | Teclado 100%, in-situ, motor `useSpreadsheetGrid.js`. |
| Código / lógica / persistencia | `SKL-009` + `SKL-015` + `SKL-007` | `run_command` / `read_file` | Test runtime Node `data > 0` + `build` + Reporte. |
| Auditoría o cierre pre-commit | `SKL-017` (+ `SKL-006`) | `git status -s` / `read_file` | LCOM/CBO o dictamen en `BITACORA_DELTAS_SESION.md`. |
| Nuevo módulo o pantalla | Regla §4 + `SKL-009` | **NINGUNO** sin clasificar | Preguntar si es `CARGA_EDICION` o `METRICAS_ANALISIS`. |
| Workflows n8n (`workflows/**`) | `SKL-001` | `read_file` (`INDEX.md` + `SDD.md`) | JSON listos; nunca `activo` sin SDD (`PLANTILLA.md`). |
| Docker / Backend Node+PG | `SKL-010` + `SKL-011` | `read_file` de `SKL-010`/`011` | `${APP_SLUG}`, 4 capas y `env.js` fail-fast. |

**Pipeline inviolable:**
1. **F1 — Inspección empírica:** Tool Call #1 obligatorio (`read_file`/`run_command`; prohibido `write_file`/`edit_file`). Verificar columnas (`select('*').limit(1)`) y fuente usada por otras planillas.
2. **F2 — Intervención modular (`SKL-009`) + 5 Candados Anti-Rot:**
   1. **Caja Nueva:** `<=250L` en páginas; toda pestaña, subpanel, modal o motor (`>150L`) nace en `app/src/components/` o `app/src/lib/`.
   2. **Cero Hardcode:** prohibido arrays estáticos o duplicar catálogos/lógica; fuente única en Supabase / `app/src/lib/`.
   3. **Cero SQL en Vista:** prohibido `supabase.from()` directo en JSX; mutar vía `app/src/lib/` o `services/`.
   4. **Trazabilidad:** toda mutación en grillas invoca `auditService.logCellChange/logRowAction`.
   5. **onBlur Blindado:** todo input editable usa `onBlur={() => commitFn()}` (jamás pasar evento `e`).
3. **F3 — Runtime real (`SKL-007`):** prohibido validar solo con `includes` o `build`; ejecutar prueba real en Node (`error === null` y `data.length > 0`) + `npm run build` + `npm run lint`.
4. **F4 — Reporte:** cerrar con Trazabilidad y tabla Control de Calidad (`§5`).

## 3. Contratos Reales Supabase (Prohibido adivinar)
> **Pre-Flight Anti-Memoria:** leer `docs/02_producto/estandares/00_INDICE_DE_MODULOS_Y_CLASIFICACION.md` e `INDICE_PLANILLAS.md` antes de listar módulos/tablas. Para otras tablas, correr `select('*').limit(1)` en F1.

| Tabla | PK | Columnas verificadas | Trampas (NO existen) |
| :--- | :--- | :--- | :--- |
| `workers` | `id` | `name`, `category`, `trade`, `hourly_rate_ars`, `hourly_rate_usd`, `work_group`, `admin_center`, `status`, `phone`, `dni`, `consumables`, `consumables_discount_pct`, `safety_elements`, `can_withdraw_materials`, `can_impute_hours`, `can_charge_third_party`, `is_foreman` | `first_name`, `last_name` |
| `system_settings` | `key` | `key`, `value` (jsonb), `updated_at`, `updated_by` (`upsert` `onConflict: 'key'`) | `id`, tabla `app_settings` |
| `organization_roles` | `role_key` | `role_key`, `role_title`, `holder_name`, `department` | `id` |
| `rate_cards` | `id` | `period`, `year`, `month`, `quincena`, `admin_center`, `entity_name`, `rate_oficial_ars`, `rate_oficial_usd`, `has_ayudante`, `rate_ayudante_ars`, `rate_ayudante_usd`, `dollar_rate` | — |
| `ships` / `work_orders` | `id` | `ships`: buques/estadías · `work_orders`: `ship_id`, `ot_number`, `description`, `contractors`, `foreman_name`, `work_type`, `status` | — |
| `audit_logs` | `id` | `action`, `entity_type`, `entity_id`, `entity_name`, `details` (jsonb), `performed_by`, `created_at` | `entity`, `table_name` |

## 4. Módulos ERP, Commits, Cierre y Registros
- **Bloqueo de nuevo módulo/pantalla:** prohibido programar sin preguntar si es `CARGA_EDICION` (Gallo, vinculado a `audit_logs`) o `METRICAS_ANALISIS` (Gallina) e indexarlo en `00_INDICE_DE_MODULOS_Y_CLASIFICACION.md`.
- **Estándares y Catálogo:** `CARGA_EDICION` (`useSpreadsheetGrid.js`, 5 Zonas `index.css`, ref. `Compras.jsx`) y `METRICAS_ANALISIS` viven en `00_INDICE_DE_MODULOS_Y_CLASIFICACION.md` y `estandares/01..07`; n8n en `SKL-001`; Docker/Backend en `SKL-010`/`SKL-011`; skills en `.agents/skills/SKILLS_REGISTRY.md`; agentes: `automation-governance-architect`, `database-optimizer`, `graphify`.
- **Commits y Push:** `tipo: descripción corta` (`feat`, `fix`, `docs`, `refactor`), un commit por tarea atómica; **push solo con confirmación explícita en el chat**.
- **Cierre de sesión (`SKL-006`):** correr `npm.cmd run check:hygiene` (`app/`) y actualizar solo el delta en `INDICE_METADATOS.md`, `workflows/_meta/INDEX.md`, `TAREAS_PENDIENTES.md` o `docs/MATRIZ_RESPONSABILIDAD_DATOS.md`.

## 5. Formato Obligatorio de Respuesta
**Inicio de cada turno:**
> **[Gobernanza AlonCar]** Arquetipo: `CARGA_EDICION` | `METRICAS_ANALISIS`  
> **Skills y Estándares activos:** `[SKL-016 Router ➔ SKL-00X, Estándar 0X...]`

**Cierre con cambios (`SKL-007`):** incluir `### 🔍 Trazabilidad de Cumplimiento Mecánico` (1. Inspección F1/`SKL-014`, 2. Fuente compartida F2, 3. Runtime F3) y:
```markdown
### Control de calidad — Entrega (SKL-007)
**Estado general:** CUMPLIDO | PARCIAL | BLOQUEADO
| ID | Requisito (intención) | Estado | Evidencia comprobable |
| :--- | :--- | :--- | :--- |
| R1 | ... | CUMPLIDO | `archivo:línea` + salida de prueba real |
**Barrido de clase:** ... · **Impacto en otros módulos:** ... · **Pendientes y su motivo:** ...
```
