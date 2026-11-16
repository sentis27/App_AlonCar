---
id: PLAN-001
tipo: plan-auditoria
estado: activo
fecha: 2026-11-15
vinculado_a: ERR-006
---
# PLAN-001 — Informe Anti-Loop de Auditoría (`SKL-017`) y Unificación Horas ⇄ Pañol

> **Ficha ejecutiva rápida:** [ERR-006: Auditoría borró listas y lógica de operarios en /horas](../../02_errores/ERR-006-auditoria-borro-listas-y-logica-operarios-horas.md)

## 1. Por qué entramos en loop cuando audita un agente (`SKL-017`)
La auditoría previa (`be2614f`, replicada luego al partir subpaneles en `7387729`) optimizó el código mirando solo **tres señales locales**: cantidad de líneas (`<= 300 L`), `oxlint` y `vite build`.
Cuando la IA reemplaza JSX largo por fragmentos más cortos bajo esa presión:
- **Supone que la verbosidad es "deuda"** y simplifica selectores complejos (`<select>` con `<optgroup>`, filtros en cascada, inicializadores) convirtiéndolos en `<input>` genéricos.
- **Corta referencias cruzadas en el DOM** (`<input list="...">` queda apuntando a `<datalist id="...">` eliminado porque está al pie del monolito).
- **Rompe contratos silenciosos en memoria** que Vite no detecta en build (`allQuincenaWorkers` pasando strings en vez de `{ name, type }`, `ships` sin pasar al hook para inicializar `selectedShipId`).

**Resultado exacto del loop:** La bitácora marcaba `🟢 RESUELTO (<250 L)` mientras producción perdía listas completas primero en **Barcos** (`d94de1f`) y luego en **Horas** (`ERR-006`). Si la próxima auditoría revisa archivos nuevos creados para resolver esto sin leer `ERR-006` ni entender por qué existen, vuelve a simplificarlos y reaparece el mismo bug al día siguiente.

---

## 2. Mapa de Regresiones Detectadas en `/horas` (`be2614f` ➔ `7387729`)

| # | Dónde ocurrió | Contrato roto al modularizar | Impacto real en operación |
| :---: | :--- | :--- | :--- |
| **1** | `LaborLogs.jsx` ➔ `LaborCrewRow.jsx`, `LaborLogsTableRow.jsx`, `LaborControlDiarioPanel.jsx` | Se eliminaron `<datalist id="all-workers-datalist">` y `<datalist id="rubros-list-carga">` del pie de página al extraer subcomponentes. | Ni Cuadrilla, ni edición inline de grilla inferior, ni Control Diario mostraban opciones al editar Operario o Rubro. |
| **2** | `LaborCargaPanel.jsx` ➔ `LaborCrewGridSection.jsx` ➔ `LaborCrewRow.jsx` | No se pasó `dbWorkers` a la grilla de Cuadrilla; `applyOperarioRowFieldUpdate` dejó de resolver `worker_type`, `default_rubro`, `allowed_trades` y jornada `9h/8h`. | Imposible desplegar la sábana filtrable ni auto-completar oficio/tipo/horas al elegir una persona. |
| **3** | `useLaborCargaCrewState.js` (`L19`, `L52`) | No recibió `ships` para inicializar `selectedShipId` ni conectó `allocationEngine.js` (`[H]` `can_impute_hours` + `🔓 Expandir`). | El `1° Barco` se veía seleccionado en HTML pero valía `''` en React; la lista de operarios no aplicaba habilitación de Barco/OT. |
| **4** | `LaborLogs.jsx` (`L115-L122`) vs `LaborSabanaPanel.jsx` | `allQuincenaWorkers` pasó a devolver strings ordenados en vez de `{ name, type }`. | Badges de tipo (`Astillero`/`Taller`/`Contratista`) rotos en Sábana Quincenal. |

---

## 3. Estándar Canónico: Lógica Pañol Aplicada a Horas
Para evitar soluciones improvisadas, **Horas (`M3b`)** adopta exactamente el contrato estructural de **Pañol (`M4`)**:
1. **Motor único (`app/src/lib/allocationEngine.js`):**
   - Pañol filtra con `filterEligiblePersonnel(workers, { permissionField: 'can_withdraw_materials' })` (`[P]`).
   - Horas filtra con `filterEligiblePersonnel(dbWorkers, { permissionField: 'can_impute_hours' })` (`[H]`), deduplicando operarios con doble fila de oficio (caso real `"Alanis, Carlos"`: `CALDERERIA` + `RASCHINAJE` ➔ `allowedTrades` combinados).
2. **Habilitación estricta por Barco/OT + `🔓 Expandir / 🔒 Contraer`:**
   - `getEnabledWorkersAndContractors(shipId, workOrderId, workItems, eligible, { workOrders, strictShipFilter: true })`.
   - Muestra `-- Habilitados en Barco (N) --` por defecto (priorizando el grupo elegido en cabecera) y botón sticky `🔓 Expandir (Ver totalidad de operarios y contratistas)` etiquetando `(Sin OT en barco)` en el padrón ampliado.
3. **Menú Sábana Portal (`LaborSearchableSelect.jsx`, patrón `MaterialAutocompleteInput.jsx`):**
   - Portal en `document.body` (`overflow-x-auto` seguro), abre sábana completa al foco, filtro vivo sin tildes/mayúsculas, navegación `↑↓ · Enter · Esc · Tab` y `onBlur` blindado.

---

## 4. Plan de Implementación y Blindaje Permanente (4 Etapas)

| Etapa | Responsable / Superficie | Acción concreta | Criterio de cierre |
| :---: | :--- | :--- | :--- |
| **Etapa 1** | Código `/horas` (`laborWorkerCatalog.js`, `laborRowOptions.js`, `LaborSearchableSelect.jsx`, `LaborSharedDatalists.jsx`, `LaborCrewRow.jsx`, `useLaborCargaCrewState.js`, `LaborLogs.jsx`) | Restaurar listas, aplicar motor Pañol `[H]` + `🔓 Expandir`, corregir inicialización de `selectedShipId` y `{ name, type }` en Sábana, todo `< 270 L`. | Test Node real vs Supabase (`> 0` operarios y barcos) + `vite build` + `oxlint` `0` errors. |
| **Etapa 2** | Guardián automático (`app/scripts/repo-hygiene.mjs`) | Agregar `checkDatalistIntegrity()`: verifica en todo `app/src/` que cada `list="..."` / `list: '...'` literal tenga su `<datalist id="...">` definido. | `npm.cmd run check:hygiene` pasa con `datalists: OK` y falla si alguien borra un `<datalist>`. |
| **Etapa 3** | Regla de Auditoría (`SKILL.md` de `SKL-017`) | Incorporar Pecado #6 (*Amputación por Refactor*) y check de **Paridad Funcional** al Modo 2 antes de aprobar splits `< 300 L`. | Auditor lee `SKL-017` y verifica controles, props e inicializadores antes de reducir líneas. |
| **Etapa 4** | Documentación vinculada (`ERR-006`, `INDICE_METADATOS.md`, `BITACORA_DELTAS_SESION.md`) | Indexar `ERR-006` y `PLAN-001` para lectura de 15 seg y trazabilidad sin rutas locales absolutas. | `npm.cmd run check:hygiene` en `exit 0` con alertas `0` en archivos del delta. |
