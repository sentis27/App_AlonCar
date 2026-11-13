---
id: DEC-023
tipo: decision
fecha: 2026-11-13
modulo: M4 · Pañol Central & Control de Gases (/panol)
estado: aprobado_e_implementado
autor: Operación / Pañol Central
---

# DEC-023: Pañol Multi-Material — Cascada Naval, Doble Imputación de Gases (`Recambio +0`) y Trazabilidad de Gaseras

## 1. Contexto de Negocio
Durante la puesta a punto operativa del menú de carga del Pañol (`MultiWithdrawalModal`) y de la pestaña **Control de Gases**, se detectaron tres necesidades críticas de operación diaria:
1. El selector inline de materiales quedaba encerrado en un recorte visual pequeño; además faltaba completar la cascada naval (`Barco ➔ Contratista habilitado ➔ OT`) con opción de expandir a contratistas sin OT en ese barco y canalizar solicitudes de habilitación `[P]` hacia el Administrador (**Jorge Sentis**).
2. Al entregar tubos del rubro `GASES` (tanto al crear un retiro como al editar una fila existente), debía reflejarse simultáneamente el gasto en `inventory_transactions` (costo en obra / descuento a contratista) y el movimiento físico del cilindro en `gas_cylinder_movements` — manteniendo **inviolable** que el `RECAMBIO_1X1` deja la deuda neta del contratista en **`+0`**, mientras la **Devolución Final** se ejecuta desde **Control de Gases** sin generar un falso gasto en la planilla de retiros.
3. Hacía falta registrar ingresos/egresos con las **gaseras/proveedores** (ej. cargas iniciales de patio, devolución de vacíos y retiros/pedidos extraordinarios) con una **tabla cronológica de trazabilidad editable y auditada**, sin duplicar ni saltear el circuito comercial de **Compras**.

## 2. Decisiones Aprobadas
1. **Cascada Naval en Pañol + Portal de Materiales (`MaterialAutocompleteInput.jsx`):**
   - El buscador inteligente de materiales se renderiza mediante React `createPortal` para mantenerse siempre visible fuera de los límites del modal y soporta navegación por teclado.
   - La casilla `(⚠️ Sin OT)` arranca **destildada por defecto**.
   - Al elegir un Barco, el selector de Operario/Contratista prioriza contratistas habilitados en OTs activas de ese buque (`allocationEngine.js`) con la acción **Expandir todos los contratistas**. Al elegir uno sin OT en el barco, `(⚠️ Sin OT)` se tilda automáticamente y el botón **Solicitar Alta** envía alerta formal a `admin` (**Jorge Sentis**), respaldado por los requisitos `REQ_PANOL_HABILITACION_OPERARIO`, `REQ_PANOL_APERTURA_OT` y `REQ_PANOL_RETIRO_SIN_OT` (`0038_panol_compliance_requirements.sql`).
2. **Doble Imputación Vinculada de Gases en Creación y Edición (`0039_gas_tx_link_and_indexes.sql`):**
   - Al cargar o editar cualquier material del rubro `GASES` en Pañol (`GasDeliveryInlinePanel.jsx` dentro de `PanolModals.jsx`), el guardado vincula `gas_cylinder_movements.inventory_transaction_id ➔ inventory_transactions.id` (`panolService.js`).
   - Permite corregir marca entregada, marca devuelta u operación desde Modo Edición manteniendo sincronizados el gasto en obra (`inventory_transactions`), el stock (`materials.current_stock`) y la cuenta corriente de cilindros (`gas_cylinder_movements`).
3. **Regla Inviolable `RECAMBIO_1X1 = +0` y Devolución Final en Control de Gases:**
   - **Regla estricta:** en `RECAMBIO_1X1` (trajo 1 vacío, se llevó 1 lleno) el saldo neto de deuda del contratista varía en **`+0`** (`calculateGasStats`), exhibiendo un indicador/sub-detalle de recambios por marca sin inflar la deuda.
   - La **Devolución Final** (`DEVOLUCION_FINAL`) se ejecuta desde **Acciones** en `Control de Gases` (`GasFinalReturnModal.jsx`), eligiendo qué cilindro(s) específico(s) devuelve el contratista, sin impactar `inventory_transactions` ni `materials.current_stock` (devolver un tubo vacío es una gestión de envases, no un consumo/gasto de pañol).
4. **Flujo de Gaseras Aislado de Compras (`0040_gas_supplier_traceability.sql`):**
   - `SALDO_INICIAL_PATIO`, `INGRESO_PROVEEDOR` y `DEVOLUCION_PROVEEDOR` (`GasSupplierMovementModal.jsx`) registran movimientos físicos de patio por proveedor/gasera y tipo de gas (`contractor_name` nullable, `remito_number`, `cylinder_condition` por defecto **`VACIO`** con opción **`LLENO`** / **`VACIO`**).
   - **Regla de frontera con Compras:** las adquisiciones/recargas de gas ingresan siempre por el módulo **Compras** (`purchase_orders`), por lo que los movimientos de patio de gaseras **no modifican** `materials.current_stock`. Los recuperos, devueltos, desorden o ajustes excepcionales de stock quedan diferidos a una futura **Puerta General de Desorden / Recuperados / Controles de Stock**.
5. **Tabla Cronológica Unificada de Trazabilidad (`GasTraceabilityGrid.jsx`):**
   - Construida sobre el motor canónico `useSpreadsheetGrid`, muestra tanto entregas/recambios/devoluciones de contratistas como ingresos/egresos de gaseras y saldos iniciales, permitiendo edición inline y anulación auditadas obligatoriamente en `audit_logs`.
