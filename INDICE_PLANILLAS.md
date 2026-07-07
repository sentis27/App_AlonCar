# Índice de Planillas Legacy — App_AlonCar

> **schema-version:** 1.0
> **Propósito:** Grafo de planillas legacy como objetos de negocio. Tabla máquina para
> consolidar dependencias cruzadas y trazabilidad hacia los 6 módulos. NO reemplaza a
> los mapeos individuales en `docs/planillas/`; los indexa.
> **Regla de IA:** Cada vez que se complete o actualice un mapeo en `docs/planillas/`,
> actualizar la fila correspondiente aquí ANTES de cerrar la sesión.

## Vocabularios Controlados

### Tipo de Planilla
`A-entrada` · `B-transformacion` · `C-salida` · `D-hibrida`

### Estado de Mapeo
`no-iniciado` · `borrador` · `revision-negocio` · `confirmado`

### Módulo Destino
`M1-activos` · `M2-recursos` · `M3-operaciones` · `M4-logistica` · `M5-comercial` · `M6-cierre` · `transversal`

### Dependencias
IDs de planilla (`GS-0XX`) separados por `|`. `ninguno` si no aplica. `pendiente-deteccion` si no se analizó.

---

## Tabla de Planillas

| ID | Nombre Técnico | Tipo | Estado Mapeo | Módulo Destino | Depende de (consume) | Consumida por | Doc |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| GS-001 | HORAS_PLANILLAS_DE_REGISTRO | D-hibrida | borrador | M3-operaciones | pendiente-deteccion | pendiente-deteccion | docs/planillas/horas-planillas-de-registro.md |
| GS-002 | MATERIALES_PLANILLAS_REGISTRO | D-hibrida | borrador | M4-logistica | pendiente-deteccion | pendiente-deteccion | docs/planillas/materiales-planillas-registro.md |

---

## Catálogo de Entidades Objetivo (referencia para Step 8 de la skill)

Fuente de verdad: `TAREAS_PENDIENTES.md` → sección 2.1 Diseño de Módulos.
Toda tabla candidata en un mapeo DEBE referenciar una de estas entidades. Si un dato no
calza con ninguna, marcarlo como **gap de roadmap**, no inventar tabla nueva.

| Entidad | Módulo | Nombre en roadmap |
| :--- | :--- | :--- |
| Ship | M1 | Barco |
| Owner | M1 | Razón Social |
| Contact | M1 | Contacto |
| Worker | M2 | Operario |
| Workshop | M2 | Taller Externo |
| Supplier | M2 | Proveedor |
| RateCard | M2 | Tarifario |
| WorkOrder | M3 | Orden de Trabajo |
| Attendance | M3 | Registro de Asistencia |
| TimeImput | M3 | Imputación de Horas |
| CostCenter | M3 | Centro de Costo |
| Material | M4 | Catálogo / Material |
| Inventory | M4 | Inventario |
| PurchaseOrder | M4 | Orden de Compra |
| Consumption | M4 | Consumo |
| Quote | M5 | Presupuesto |
| InvoiceAttachment | M5 | Anexo de Factura |
| BillingItem | M5 | Liquidación |
| ClosureLog | M6 | Cierre por OT |
| AuditTrail | M6 | Auditoría |
| HistoricalData | M6 | Archivo histórico |
