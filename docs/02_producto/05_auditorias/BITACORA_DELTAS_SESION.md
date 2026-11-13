# ⏱️ Bitácora de Auditorías Delta de Cierre de Sesión (Ledger Acumulativo)

> **Gobernado por SKL-017 (Modo 2: Auditoría Delta Diaria)**  
> **Propósito:** Registro cronológico de las **últimas 5 sesiones** de cierre previas al commit. Las entradas anteriores están archivadas en [archivo/BITACORA_2026-11.md](archivo/BITACORA_2026-11.md).

---

<!-- Las nuevas entradas de cierre se agregan aquí arriba -->

## [2026-11-13] Sesión de Cierre — Fix Ancho w-full y Visibilidad de Columna Acciones en Personal y Tarifas (`ERR-005`)
- **Hora:** 18:43 ART | **Agente:** Antigravity | **Revisor:** Usuario
- **Superficie evaluada (delta exclusivo del chat):**
  * Modificados (2): `app/src/pages/Personal.jsx` (`152L`, `max-w-7xl mx-auto` ➔ `w-full` en `L64`), `app/src/components/personal/PersonalNominaPanel.jsx` (`2953L`, compactación `px-2`/`px-1.5` y `whitespace-nowrap` en `Acciones` `L1629`, `L2238`). Diff: `+27 / -27`.
  * Docs cierre: `ERR-005`, `docs/02_producto/README.md`, `INDICE_METADATOS.md`, `TAREAS_PENDIENTES.md`, `BITACORA_DELTAS_SESION.md`.
- **Blast Radius:** Localizado (`Personal.jsx` en `App.jsx:7`; `PersonalNominaPanel.jsx` en `Personal.jsx:5,127`).
- **Tracker Anti-Rot:** `0` pecados nuevos (`Personal.jsx` `152L < 250L`, `supabase.from` nuevos `0`, `bareOnBlur` `0`, hardcodes nuevos `0`). Deuda previa intacta en `PersonalNominaPanel.jsx` (`2953L`, `5` `.from(`).
- **Trazabilidad Supabase:** Sin cambios de esquema; prueba previa `fetchPersonalData()` devolvió `workers: 397`, `rateCards: 97`, `roles: 10`.
- **Verificación Runtime & Build:** `oxlint.cmd` en ambos archivos (`0` errores, `4` warnings previos) | `npm.cmd run build` PASS (`2097` módulos en `5.00s`, `0` errores). Pendiente QA visual autenticado.
- **Veredicto Final:** 🟢 **APROBADO PARA COMMIT** | **Alcance Git:** Commits atómicos exclusivos sobre `HEAD` `ae968d2`.
---

## [2026-11-13] Sesión de Cierre — M4 Pañol: Cascada Naval, Gases (Doble Imputación & Recambio +0) y Trazabilidad Gaseras (`0038`–`0040`)
- **Hora:** 18:35 ART | **Agente:** Antigravity | **Revisor:** Usuario
- **Superficie evaluada (`17` archivos app/migrations + docs `DEC-023`):**
  * Modificados (`9`): `Panol.jsx` (`233L`), `PanolHeader.jsx` (`162L`), `PanolMovimientosPanel.jsx` (`1038L`), `PanolStockPanel.jsx` (`834L`), `PanolModals.jsx` (`1966L`), `allocationEngine.js` (`484L`), `panolConstants.js` (`837L`), `panolService.js` (`1206L`), `AdminAlertsCompliancePanel.jsx` (`389L`, filtro `maria_jose`).
  * Nuevos (`8`): `MaterialAutocompleteInput.jsx` (`315L`), `GasDeliveryInlinePanel.jsx` (`119L`), `GasFinalReturnModal.jsx` (`270L`), `GasSupplierMovementModal.jsx` (`551L`), `GasTraceabilityGrid.jsx` (`828L`), `0038_panol_compliance_requirements.sql` (`79L`), `0039_gas_tx_link_and_indexes.sql` (`12L`), `0040_gas_supplier_traceability.sql` (`40L`).
- **Blast Radius:** `allocationEngine.js` (usado también en `TercerosModals.jsx` y `tercerosService.js`) y `panolService.js` (`services/index.js`), sin regresiones en compilación (`2097` módulos).
- **Tracker Anti-Rot:** Candados 1–5 **CUMPLE** (`Panol.jsx` `233L < 250L`, `0` hardcodes nuevos, `0` `.from(` nuevos en JSX, `15` llamadas `auditService` en `panolService.js`, `0` `bareOnBlur`). Deuda previa observada: `PanolModals.jsx` (`1966L`) y `panolService.js` (`1206L`).
- **Verificación Runtime & Build:** `npm.cmd run lint` (`0` errores, `329` warnings en `135` files) | `npm.cmd run build` PASS (`2097` módulos en `5.96s`) | E2E vivo Supabase (`0038`–`0040` aplicadas vía `run_sql.mjs`; `3` movimientos de gaseras + edición inline + `3` `audit_logs`, stock `GAS OXIGENO INDUSTRIAL TUBO` intacto `145 === 145`, limpieza hecha).
- **Veredicto Final:** 🟢 **APROBADO PARA COMMIT** | **Alcance Git:** Lote Pañol/Gases + `DEC-023` separado atómicamente de los `2` archivos previos de Personal (working tree).
---

## [2026-11-13] Sesión de Cierre — Módulo Resumen Gerencial (GS-004), Comparador Canvas y Remito Comercial Nivel Alfa
- **Hora:** 18:16 ART | **Agente:** Antigravity | **Revisor:** Usuario
- **Superficie evaluada (Lote A — `GS-004` + docs):**
  * Modificados (4): `App.jsx`, `Sidebar.jsx`, `auditService.js`, `00_INDICE_DE_MODULOS_Y_CLASIFICACION.md`.
  * Nuevos (16): `ResumenGerencial.jsx` (`180L`), `useResumenGerencialState.js` (`229L`), `drydockCatalogConstants.js` (`353L`), `managerialSummaryService.js` (`1015L`), y `12` componentes en `components/resumenGerencial/` (`AlfaRateCardModal`, `ComparadorNivel2OtTable`, `ComparadorObrasCanvasPanel`, `CostSheetChrome`, `RemitoComercialAlfaPanel`, `ResumenGerencialHeader`, `ResumenHojaHorasPanel`, `ResumenHojaMaterialesPanel`, `ResumenHojaTercerosPanel`, `ResumenMatrizOtsPanel`, `ResumenObraCostosPanel`, `SvgDonutCard`).
- **Blast Radius:** `60` refs internas `GS-004` + `100` refs en core compartido (`Sidebar` / `auditService`).
- **Tracker Anti-Rot:** Página en `180L < 250L`, `0` `.from(` en JSX, `0` `bareOnBlur` en `19` archivos; `ELEM. SEGURIDAD (REF. ASTILLERO)` separado del Total US$ y exclusión `work_type = 'PRESUPUESTO'` (`DEC-013`). Subpaneles ricos >250L (`RemitoComercialAlfaPanel` `931L`, `ResumenObraCostosPanel` `563L`, `ComparadorObrasCanvasPanel` `527L`, etc.).
- **Trazabilidad Supabase:** Mutaciones vía `managerialSummaryService.js` con registro en `audit_logs`.
- **Verificación Runtime & Build:** `oxlint.cmd` en `19` archivos (`0` errores, `31` warnings) | `npm.cmd run build` PASS (`2095` módulos en `7.45s`) | Node live vs Supabase (`NONO PASCUAL` `directTotalUsd: 17190.32` en `6` OTs; `anon` sin sesión `laborLogs: 0` y `materials: 0`, pendiente QA autenticado).
- **Veredicto Final:** 🟢 **APROBADO PARA COMMIT** | **Alcance Git:** Lote A separado del trabajo previo sin commitear (Lote B).
---

## [2026-11-13] Sesión de Cierre — OTs (Folio/Presupuestos), Contratos & Seguridad Personal, Tesorería Graciela y Alertas María José (`1331aeb`, `68e9f50`)
- **Hora:** 00:19 ART | **Agente:** Antigravity | **Revisor:** Usuario
- **Superficie evaluada (commits `1331aeb`, `68e9f50` + docs):**
  * `1331aeb`: `monotonicFolioEngine.js`, `workOrdersConstants.js`, `workOrdersService.js`, `WorkOrdersModals.jsx`, `WorkOrdersUnificadoPanel.jsx`, `MariaJoseBudgetAlertsCard.jsx` (6 archivos, `+795/-174`).
  * `68e9f50`: `0037_workers_contracts_and_safety_cleanup.sql`, `workCostRules.js`, `contractorDeductionsService.js`, `personalService.js`, `PersonalNominaPanel.jsx`, `PersonalTarifarioPanel.jsx`, `MariaJoseContractAlertsCard.jsx`, `TesoreriaDeduccionesPanel.jsx`, `Tesoreria.jsx`, `Sidebar.jsx`, `App.jsx`, `AdminAlertsCompliancePanel.jsx`, `Dashboard.jsx` (13 archivos, `+1914/-58`).
- **Blast Radius:** Existencial (`14` consumidores `monotonicFolioEngine.js`, `13` `workOrdersConstants.js`, sin regresiones) + Localizado en Tesorería/Alertas.
- **Tracker Anti-Rot:** `0` pecados nuevos tras limpieza Fast-Track (`PersonalTarifarioPanel` con `useMemo`, `PersonalNominaPanel` extraído a `personalService.js`); SQL `0037` pendiente en SQL Editor (con fallback defensivo `SKL-015`).
- **Trazabilidad Supabase:** Verificada (`workOrdersService.js` x15, `contractorDeductionsService.js:338`, `PersonalNominaPanel.jsx` x6).
- **Verificación Runtime & Build:** `npx oxlint` (`0` errores) | `npm run build` PASS (`1.93s`).
- **Veredicto Final:** 🟢 **APROBADO PARA COMMIT** | **Commits:** `1331aeb`, `68e9f50` + cierre docs `2026-11-13`.
---

## [2026-11-12] Sesión de Cierre — Fix Pantalla en Negro Barco/OT (Terceros) & Consolidación Regla Naval OTs (`be899a3`)
- **Hora:** 17:43 ART | **Agente:** Antigravity | **Revisor:** Usuario
- **Superficie evaluada (commit `be899a3` + docs):**
  * `app/src/components/ShipWorkOrderPickerModal.jsx`: Reubicación de `useMemo` (`selectedWo`, `previewScope`) sobre `if (!isOpen) return null`, eliminando crash `rules-of-hooks` en Terceros, más regla naval y preview hover.
  * `app/src/components/terceros/TercerosModals.jsx`: Comparación `String(wo.ship_id) === String(formData.ship_id)` e integración de `WorkOrderSelectorWithHover` y `WorkOrderScopeHoverCard`.
  * OTs consolidados en `be899a3`: `CloseWorkOrderTreeModal.jsx`, `WorkOrderScopeHoverCard.jsx`, `WorkOrderSelectorWithHover.jsx`, `workOrdersConstants.js`, `workOrdersService.js`, `PanolModals.jsx`, `LaborModals.jsx`.
- **Blast Radius:** Sistémico controlado (`ShipWorkOrderPickerModal` compartido por Terceros, Horas, Pañol y Compras).
- **Tracker Anti-Rot:** `0` pecados (`oxlint --deny=rules-of-hooks`: `0` errores).
- **Trazabilidad Supabase:** `auditService` en `tercerosService.js` (`saveShipWoPickerService`) y `workOrdersService.js`.
- **Verificación Runtime & Build:** `npm run build` PASS en `3.32s` (`2069` módulos, `0` errores).
- **Veredicto Final:** 🟢 **APROBADO PARA COMMIT** | **Commit:** `be899a3` + cierre docs `2026-11-12` (`ERR-004`).
---
