# 🧩 Componentes Canónicos y los 3 Disparadores Inmutables

Para garantizar curva de aprendizaje cero y reutilización real de código, todo módulo del **Arquetipo Transaccional / Carga de Datos** implementa exactamente los mismos 3 disparadores canónicos.

---

## 1. Los 3 Disparadores Inmutables

```
┌─────────────────────────────────┬─────────────────────────────────┬─────────────────────────────────┐
│       DISPARADOR 1: BARCO       │    DISPARADOR 2: CONTRATISTA    │       DISPARADOR 3: LÁPIZ       │
│      (Doble Clic en Celda)      │      (Doble Clic en Celda)      │       (Clic en Botón ✏️)         │
├─────────────────────────────────┼─────────────────────────────────┼─────────────────────────────────┤
│ Abre `ShipWorkOrderPickerModal` │ Abre `ContractorPickerModal`    │ Abre Modal de Fila Completa     │
│ • Selecciona Buque y OT         │ • Asigna Operario o Contratista │ • Audita todos los datos        │
│ • Permite "⚠️ Dejar OT en blanco"│ • Regla dura de padrón completo │ • Edición integral multirrenglón│
└─────────────────────────────────┴─────────────────────────────────┴─────────────────────────────────┘
```

---

## 2. Disparador 1: Selector Canónico de Buque y OT (`ShipWorkOrderPickerModal`)
* **Ubicación:** `app/src/components/ShipWorkOrderPickerModal.jsx`
* **Comportamiento:**
  - Paso 1: Buscador y selección de Buque / Destino.
  - Paso 2: OTs del buque seleccionado (priorizando arriba las OTs vinculadas al contratista actual).
  - **Casilla de Permisión OT en blanco:** Si la obra no tiene OT abierta o el material ingresa antes de la apertura, mantiene marcada la opción *"⚠️ Dejar OT en blanco"*, guardando `work_order_id = null` y sumando +1 al KPI "⚠️ Falta Cargar OT".

---

## 3. Disparador 2: Selector Canónico de Contratista (`ContractorPickerModal`)
* **Ubicación:** `app/src/components/ContractorPickerModal.jsx`
* **Reglas Duras Inmutables:**
  1. **Si la OT está en blanco (`!work_order_id`):** Despliega el **PADRÓN COMPLETO** de operarios habilitados de Astillero y contratistas externos. Prohibido filtrar a cero o bloquear la celda.
  2. **Si la OT está asignada (`work_order_id`):** Presenta los operarios y contratistas asignados a esa OT en `work_items`.
  3. **Fallback Automático de Seguridad:** Si el filtrado por OT no tuviera contratistas asignados (0 resultados), el motor aplica fallback instantáneo al padrón completo para que el usuario **NUNCA** quede con una lista vacía o trabada.
  4. **Preservación del Valor Actual:** Si el contratista cargado en la fila no figura en la lista filtrada, se incorpora con el badge *(Actual en fila)* para evitar pérdidas de datos.
  5. **Búsqueda Instantánea en Vivo:** Permite buscar por nombre, gremio o empresa con navegación por teclado (`Enter`, `Esc`, flechas).

---

## 4. Disparador 3: Modal de Fila Completa (Botón Lápiz ✏️)
* **Objetivo:** Ofrecer la auditoría y edición completa de toda la información de la fila en una sola ventana:
  - `MultiWithdrawalModal` en Pañol
  - `OrderFormModal` en Compras
  - `WorkItemModal` en Obras / Terceros
* **Permite revisar y modificar en bloque:** Buque, OT, contratista, fecha, renglones de materiales/servicios, cantidades, centro de costo, notas y adjuntos.
