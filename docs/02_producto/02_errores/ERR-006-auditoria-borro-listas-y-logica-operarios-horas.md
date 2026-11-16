---
id: ERR-006
tipo: error
fase: 3
estado: borrador
fecha: 2026-11-15
modulo: /horas
plan: PLAN-001
---
# Auditoría SKL-017 eliminó `<datalist>` y lógica de selección de operarios en `/horas`

> **Lectura rápida (15 seg):** Si volvés a auditar `/horas` o refactors `< 300 L`, **leé esto antes de simplificar o borrar código**.  
> **Ampliar diagnóstico y plan completo:** [PLAN-001: Blindaje Anti-Regresiones de Auditoría (SKL-017)](../05_auditorias/planes/PLAN-001-blindaje-anti-regresiones-auditoria-skl017.md)

## Qué pasó / Dónde / Por qué
- **Error (qué):** En `/horas` (**Cuadrilla de Trabajo**, grilla inline y **Control Diario**) no se desplegaba ninguna lista al elegir **Operario** ni **Rubro**, bloqueando la carga diaria.
- **Dónde ocurrió:** Commit `be2614f` (partición de `app/src/pages/LaborLogs.jsx`) ➔ heredado en `7387729` (`LaborCargaPanel.jsx` ➔ `LaborCrewRow.jsx` y `LaborLogsTableRow.jsx`).
- **Por qué ocurrió (fallo de auditoría, no de negocio):**
  1. **Recorte ciego de DOM:** al extraer paneles para bajar de `250 L`, se borraron `<datalist id="all-workers-datalist">` y `<datalist id="rubros-list-carga">` dejando `list="..."` huérfanos en 3 componentes.
  2. **Reemplazo destructivo sin paridad funcional:** el selector original de Cuadrilla tenía lista por centro/especialidad y pasó a ser un `<input>` sin `dbWorkers` ni conexión a `allocationEngine.js` (lógica estándar de **Pañol**).
  3. **Validación incompleta (`vite build` ≠ funcionamiento):** compilaba bien porque JSX no chequea strings `list="..."` contra `<datalist>`, ni verifica pérdida de `selectedShipId` inicial o `allQuincenaWorkers` convertido de `{ name, type }` a strings. *(Antecedente gemelo en Barcos: `d94de1f`).*

## Solución aplicada
- `app/src/lib/laborWorkerCatalog.js` + `laborRowOptions.js`: reutilizan `allocationEngine.js` (`can_impute_hours`) con filtros `-- Habilitados en Barco --` + `🔓 Expandir` y auto-relleno de `worker_type`/`rubro`/`horas`.
- `app/src/components/labor/LaborSearchableSelect.jsx`: menú Portal (`bg-slate-950`) con sábana scrolleable al foco y filtro en vivo insensible a tildes/mayúsculas.
- `app/src/components/labor/LaborSharedDatalists.jsx`: restaura ambos `<datalist>` en `LaborLogs.jsx` para grilla inline, Control Diario y modales.

## Regla anti-regresión (Cómo detectarlo / Evitar loop)
1. **No asumir que un selector explícito, cascada o `<datalist>` es "código redundante"**: el código previo respondía a reglas navales reales (habilitación por barco/OT + préstamo operativo).
2. **Al particionar un módulo, preservar contratos 1:1:** `id`/`list`, props (`dbWorkers`, `ships`), shapes (`{ name, type }`) e inicializadores (`selectedShipId`).
3. **Fuente única compartida:** Operarios en **Horas** usan el mismo motor de **Pañol** (`allocationEngine.js` con `[H] can_impute_hours` + `🔓 Expandir`), nunca un `<input>` vacío.
4. **Guardián automático (`repo-hygiene.mjs`):** `checkDatalistIntegrity()` bloquea futuros `<input list="...">` huérfanos antes de aprobar el cierre.
