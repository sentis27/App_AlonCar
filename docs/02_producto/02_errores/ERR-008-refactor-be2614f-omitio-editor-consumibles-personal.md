---
id: ERR-008
tipo: error
fase: 3
estado: borrador
fecha: 2026-11-27
modulo: /personal
plan: PLAN-001
---
# Refactor `be2614f` omitió selector de % de consumibles en Personal y faltaba edición inline

> **Lectura rápida (15 seg):** Qué pasó: desapareció la carga de % de consumibles en Personal · Dónde: `be2614f` (`Personal.jsx` -> `PersonalNominaPanel.jsx`) heredado en `PersonalWorkerFormModal.jsx` y `PersonalNominaRow.jsx` · Por qué: omisión de bloque UI al modularizar + columna sin edición inline + etiqueta ambigua `0% (OBRA)`.  
> **Ampliar diagnóstico y plan completo:** [PLAN-001: Blindaje Anti-Regresiones de Auditoría (SKL-017)](../05_auditorias/planes/PLAN-001-blindaje-anti-regresiones-auditoria-skl017.md)

## Qué pasó / Dónde / Por qué
- **Error (qué):** En `/personal` (**Nómina de Operarios**), se perdió el selector de porcentaje de descuento de **Consumibles** (`0%` a `100%` entre Contratista y Obra) al crear o editar un operario/contratista, y en la vista planilla la columna `Consumibles` era de solo lectura (sin edición directa con doble clic). Además, el badge `0% (OBRA)` generaba confusión visual frente a `100% OBRA`.
- **Dónde ocurrió:** Commit `be2614f` (partición de `app/src/pages/Personal.jsx` en `app/src/components/personal/PersonalNominaPanel.jsx`) y luego mantenido en `app/src/components/personal/PersonalWorkerFormModal.jsx` (`88d15df` / `f407bac`) y `app/src/components/personal/PersonalNominaRow.jsx`. El nuevo menú lateral (`77dfcca`) **no** fue la causa.
- **Por qué ocurrió (causa raíz):**
  1. **Omisión de bloque UI durante modularización (`be2614f`):** el estado (`consumables_discount_pct`, `consumables`), los helpers de guardado (`app/src/lib/personalNominaFormHelpers.js`), el esquema Zod (`app/src/schemas/workers.schema.js`) y la columna en Supabase siguieron activos, pero el sub-bloque visual del Bloque 4 (*Consumibles de Pañol*) no fue copiado al extraer el formulario.
  2. **Ausencia de contrato inline en grilla:** `NOMINA_COLUMNS` (`app/src/lib/personalNominaHelpers.js`) no incluía `consumables_discount_pct`, impidiendo editar in-situ desde la tabla.
  3. **Desfase texto vs porcentaje (`workCostRules.js`):** en `resolveConsumablesDiscountPct`, la etiqueta `'CLIENTE'` tiene prioridad sobre `consumables_discount_pct`; si no se sincronizan ambos campos (`consumables` y `consumables_discount_pct`) al guardar, el costo real aplicado puede diferir del porcentaje mostrado.

## Solución aplicada
- **Modal Zero-Scroll (`FL-020`):** Creado `app/src/components/personal/PersonalWorkerConsumablesField.jsx` e integrado en el Paso 3 de `app/src/components/personal/PersonalWorkerFormModal.jsx` (con ayuda actualizada en `app/src/lib/help/personalShipsHelp.js`). Para `ASTILLERO` propio fija `100% OBRA` (`0%` descuento, mientras EPP sigue `0%` obra / referencia Astillero); para `CONTRATISTA`/`TALLER` ofrece presets (`100%`, `60%`, `50%`, `0%`), slider y campo numérico.
- **Edición In-Situ en Grilla (`SKL-013`):** Agregado `consumables_discount_pct` en `NOMINA_COLUMNS`, creada celda `app/src/components/personal/PersonalNominaConsumablesCell.jsx` (doble clic, input numérico, presets rápidos, Fill Handle, `Ctrl+Z` y auditoría en `audit_logs`) y cableada en `app/src/components/personal/PersonalNominaRow.jsx` y `app/src/components/personal/PersonalNominaTable.jsx` (`Consumibles ✎`), mostrando `100% OBRA`, `100% CONT.` o `X% C / Y% O`.
- **Sincronización estricta:** `buildConsumablesFields` en `app/src/lib/personalNominaFormHelpers.js` sincroniza `consumables_discount_pct` y `consumables` en cada guardado (modal e inline) y bloquea `ASTILLERO` en `0 / 'CLIENTE'`.
- **Verificación:** Tests unitarios y de contrato en `app/tests/unit/personalConsumables.test.js`, runtime Node contra Supabase (`workers`), `vite build`, `oxlint` y `check:hygiene`.

## Regla anti-regresión (Cómo detectarlo / Evitar loop)
- Al extraer o refactorizar un formulario (`SKL-018`), cruzar cada campo del payload (`buildWorkerSavePayload`) contra un control visible o regla explícita en los componentes del modal; ningún campo editable del payload puede quedar huérfano sin UI.
- La batería `app/tests/unit/personalConsumables.test.js` verifica mecánicamente que `PersonalWorkerFormModal.jsx` incluya `PersonalWorkerConsumablesField`, que `NOMINA_COLUMNS` y `PersonalNominaTable.jsx` expongan `consumables_discount_pct` (`Consumibles ✎`), y que no reaparezca la etiqueta confusa `0% (OBRA)`.
