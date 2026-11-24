---
id: EST-008
tipo: protocolo
estado: activo
fecha: 2026-11-20
vinculado_a: ERR-006
---

# 🔒 Manifiesto de Funcionalidades Blindadas (`08_FEATURES_LOCK`)

> **Propósito (Candado #1 Anti-Regresión):** Registro oficial de funcionalidades probadas y aprobadas por el usuario que **NO pueden borrarse, simplificarse ni degradarse** al refactorizar, modularizar o agregar nuevas vistas.
>
> **Cumplimiento mecánico:** Cada fila marcada como `blindado` **DEBE** tener un contrato ejecutable en `app/tests/contracts/approvedFeatures.contract.test.js`, validado automáticamente en cada ejecución de `npm.cmd run check:hygiene` (Vitest + `repo-hygiene.mjs`).

---

## Vocabulario de Estados
- `blindado`: Funcionalidad aprobada y protegida por test de contrato activo (falla en rojo si se rompe).
- `pendiente_fix`: Regresión detectada y agendada para corrección; al repararse se cambia a `blindado` y su test se activa automáticamente.

---

## Tabla Maestra de Contratos Funcionales Blindados

| ID | Módulo | Funcionalidad / Invariante Blindado | Superficie Principal | Estado | Test de Contrato |
| :--- | :--- | :--- | :--- | :--- | :--- |
| FL-001 | Transversal | Bloqueo Zod de columnas trampa (`workers.first_name/last_name`, `labor_logs.profile_id`, `system_settings.id`, `organization_roles.id`, `audit_logs.entity/table_name`, `purchase_orders.notes`) | `app/src/schemas/index.js` | blindado | `FL-001` |
| FL-002 | Transversal | Toda OT renderizada mediante `CanonicalOtBadge` / `buildCanonicalOtBadgeData` incluye vista flotante (`tooltip`) completa y estado `Sin OT` | `app/src/components/canonical/CanonicalOtBadge.jsx` | blindado | `FL-002` |
| FL-003 | Transversal | Selector `CanonicalMaterialPicker` filtra sin tildes/mayúsculas por nombre, rubro y categoría, prioriza `startsWith` y formatea stock (`ok`/`critical`/`S/C`) | `app/src/components/canonical/CanonicalMaterialPicker.jsx` | blindado | `FL-003` |
| FL-004 | Pañol (`M4`) | Grilla `PanolCatalogGrid` conserva las columnas obligatorias (Material, Rubro, Categoría, Unidad, Peso, Stock Actual, Stock Mín., Lleva Stock, % Seg. Naval, Acciones) | `app/src/components/panol/PanolCatalogGrid.jsx` | blindado | `FL-004` |
| FL-005 | Compras (`M4b`) | Emisión agrupada WhatsApp (`BatchOrderWhatsAppModal` + `emitWhatsAppOrdersService`) actualiza `status: 'PEDIDO'` y audita en `auditService` | `app/src/services/comprasAuxService.js` | blindado | `FL-005` |
| FL-006 | Transversal | `ContractorPickerModal` conserva el fallback seguro al padrón completo cuando `work_order_id` está vacío o sin contratistas (Estándar 06) | `app/src/components/ContractorPickerModal.jsx` | blindado | `FL-006` |
| FL-007 | Transversal | Cero llamadas directas a `supabase.from()`, `supabase.rpc()` o `.storage.from()` fuera de `app/src/repositories/` | `app/scripts/repo-hygiene.mjs` | blindado | `FL-007` |
| FL-008 | Gobernanza | Paridad 1:1 entre todos los IDs `blindado` de este manifiesto y los tests ejecutados en `approvedFeatures.contract.test.js` | `app/tests/contracts/approvedFeatures.contract.test.js` | blindado | `FL-008` |
| FL-009 | Pañol (`M4`) | Botón 🛒 de Pedido Directo en Planilla de Retiros abre `QuickPurchaseModal` (`isOpen: true`) y guarda usando `observations` (sin `notes`) | `app/src/pages/Panol.jsx` | blindado | `FL-009` |
| FL-010 | Compras (`M4b`) | Alta desde Pañol (`/compras?nuevo=true`) evalúa `editingOrder?.id`, agrega en vivo los pedidos nuevos sin demora Realtime y limpia `searchParams` | `app/src/components/compras/ComprasPedidosModals.jsx` | blindado | `FL-010` |
| FL-011 | Pañol (`M4`) | Planilla de Retiros (`PanolMovimientosPanel`) muestra la Columna A de Stock disponible del material con semáforo (`current_stock` / `S/C`) | `app/src/components/panol/PanolMovimientosPanel.jsx` | blindado | `FL-011` |
| FL-012 | Pañol (`M4`) | Celda Material de Planilla usa `CanonicalMaterialPicker` (sin UUID crudo ni `datalist` básico) y Canasta de Costos usa `CanonicalOtBadge` con tooltip flotante | `app/src/components/panol/PanolMovimientosPanel.jsx` | blindado | `FL-012` |
| FL-013 | Compras (`M4b`) | `MandadosModal` / `dispatchMandadosService` pasa el estado a `PEDIDO` (preservando `PEDIDO INCOMPLETO`) al enviar WhatsApp y muestra `🛵` de inmediato | `app/src/components/compras/MandadosModal.jsx` | blindado | `FL-013` |
| FL-014 | Pañol / Transversal | `MultiWithdrawalModal` usa stepper vertical de 3 pasos (`StepHelpBadge`), miniatura ampliable a `5cm × 5cm` (`MaterialThumbnailZoom`), `CanonicalMaterialPicker` y `WorkOrderSelectorWithHover` con `CanonicalOtBadge` y texto flotante (sin bloque inline fijo) | `app/src/components/panol/MultiWithdrawalModal.jsx` | blindado | `FL-014` |
| FL-015 | Compras (`M4b`) | Grilla (`ComprasPedidoRow`), editor inline (`ComprasRowCells`) y formulario (`OrderFormModal`) usan `CanonicalOtBadge`, `WorkOrderSelectorWithHover` y `CanonicalMaterialPicker` (`allowFreeText`), sin `<datalist>` de materiales | `app/src/components/compras/ComprasPedidoRow.jsx` | blindado | `FL-015` |
| FL-016 | Terceros (`M5`) | Grilla (`TercerosFilasPanel`), tarjetas (`TercerosFichasPanel`) y auditoría (`TercerosModals`) renderizan OTs mediante `CanonicalOtBadge` con `workOrders`/`workItems` completos | `app/src/components/terceros/TercerosFilasPanel.jsx` | blindado | `FL-016` |
| FL-017 | Horas (`M3`) | Carga Diaria, Control Diario, Sábana Quincenal y Revisión usan `CanonicalOtBadge`; selectores de Cascada, Multi-OT y Reloj Facial usan `WorkOrderSelectorWithHover` | `app/src/components/labor/LaborLogsTableRow.jsx` | blindado | `FL-017` |
| FL-018 | Resumen Gerencial (`M6`) | Resumen de Obra (desktop + móvil), Matriz de OTs, 3 Hojas Solo Lectura, Remito Alfa y Comparador Nivel 2 usan `CanonicalOtBadge` con `canonicalTooltip` consolidado | `app/src/components/resumenGerencial/ResumenMatrizOtsPanel.jsx` | blindado | `FL-018` |
| FL-019 | Transversal (`OT 3 Capas`) | Pieza replicable OT soldada en 3 capas: consulta canónica única (`listCanonicalWorkOrders`/`listCanonicalWorkItems` en todos los módulos), motor único (`isClosedWorkItemStatus` + `formatWorkOrderTooltipCanonical` con estado de OT, sin doble `OT #OT-`, y `❌` + tachado en los 4 estados cerrados incluyendo `Finalizado costo final de obra` con estado visible) y `CanonicalOtBadge` también en `PanolMovimientosPanel` | `app/src/repositories/workItemsRepository.js` | blindado | `FL-019` |
| FL-020 | Transversal (`Stepper Zero-Scroll`) | Pieza replicable de menús de carga en 3 capas: registro centralizado (`businessHelpRegistry.js`), motor de anclaje (`computeStepHelpPosition` con apertura hacia arriba en últimos pasos sin scroll) y UI única (`CanonicalStepperModal` + `StepHelpBadge` en portal `document.body`) aplicada a Pañol, Horas (4 modos), Órdenes de Trabajo, Compras, Terceros, Personal y Barcos | `app/src/components/canonical/CanonicalStepperModal.jsx` | blindado | `FL-020` |
| FL-021 | Transversal (`Menú Acordeón 3 Capas`) | Navegación de submódulos unificada en Menú Lateral Acordeón colapsable (`navigationCatalog.js` con 11 módulos / 30 submódulos + `useModuleTab.js` + `CanonicalSidebarModuleGroup.jsx` + `CanonicalActiveSubmoduleBadge.jsx`), eliminando los 30 botones de pestañas y 7 selectores manuales de Terminal/Rol de Zona 1 (perspectiva derivada vía `resolveUserRolePerspective`) | `app/src/lib/navigationCatalog.js` | blindado | `FL-021` |
| FL-022 | Transversal (`Motor Permisos Etapa 5`) | Filtrado automático de Menú Acordeón, guardián de rutas (`ProtectedRoute` + `?tab=`) y capacidades operativas por puesto (`permissionsEngine.js` ↔ `organization_roles.allowed_sections` ↔ `AuthContext.jsx`), Matriz de 11 módulos y 30 submódulos + campo `email` en `/admin` (`RolePermissionsEditorBlock.jsx`) y acceso por puesto activo en `Login.jsx` | `app/src/lib/permissionsEngine.js` | blindado | `FL-022` |

---

## Procedimiento para Blindar una Nueva Funcionalidad Aprobada

1. Cuando el usuario confirma *"esto quedó aprobado"*, agregar una fila `FL-NNN` con estado `blindado` en la tabla superior (o cambiar `pendiente_fix` ➔ `blindado`).
2. Agregar o activar el test correspondiente con el mismo ID (`FL-NNN`) en `app/tests/contracts/approvedFeatures.contract.test.js`.
3. Ejecutar `npm.cmd run check:hygiene` en `app/` y confirmar salida `OK` en verde.
