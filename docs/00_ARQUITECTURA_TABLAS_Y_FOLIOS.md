# 🧭 Padrón Maestro de Arquitectura de Tablas y Folios Operativos (# DNI de Fila)

> **Fuente Única de Verdad para Tablas y Secuencias:**  
> Este documento centraliza el inventario completo de bases de datos, claves primarias, modelos de persistencia y la especificación del **Folio Operativo Inviolable (`#` DNI de Fila)** de AlonCar ERP.  
> Sirve como referencia técnica inmediata para:
> 1. Dirección y usuarios operativos
> 2. Agentes de IA (Antigravity / Claude Code)
> 3. El Copiloto / Asistente IA integrado en la aplicación

---

## 1. El Concepto Arquitectónico: DNI de Fila (# Folio Monótono Inviolable)

### A. La Falla del Índice Visual Momentáneo (`rowIndex + 1`)
Tradicionalmente, las grillas numéricas en entornos web renderizan el índice visual del array en memoria: `{rowIndex + 1}`.  
En planillas operativas que se ordenan de forma descendente (lo más reciente al tope), esto genera una severa colisión operativa:
1. Al insertar una nueva fila arriba, el nuevo registro toma el número `# 1`.
2. Todos los registros históricos se desplazan: lo que era `# 1` pasa a ser `# 2`, y lo que era `# 5` pasa a ser `# 6`.
3. Al aplicar filtros en el buscador crawler o filtrar por buque/quincena, la fila `# 5` cambia a `# 1` o `# 2`.
4. **Consecuencia:** Es imposible que un operario le diga al jefe de taller *"Revisá la fila 5"* porque la fila 5 cambia de identidad constantemente.

### B. El Estándar Canónico de Folio Inviolable
A partir de este estándar, el número en la **Columna 0 (`#`)** es un **Folio Monótono Inviolable (`_rowSeq` / Folio DNI)**:
* **Correlativo histórico:** El primer registro de la historia del astillero en esa tabla es el **`# 1`**, el segundo el **`# 2`** y así sucesivamente.
* **Invariabilidad:** Una vez asignado el folio `# 5`, ese registro será el `# 5` para siempre, sin importar si la lista se ordena ascendente o descendente, o si se filtra por cualquier columna en el buscador crawler.
* **Crecimiento continuo (Siempre Sumando):** Al presionar `[+ Fila en Blanco]` o dar de alta un registro, la nueva fila toma **`max(folio) + 1`** (ej. si hay 22 registros, la nueva fila nace como `# 23`, **NUNCA `# 1`**).

---

## 2. Padrón Oficial de Tablas, Submódulos y Estrategia de Folios

| Módulo ERP | Submódulo / Pestaña | Archivo Pantalla | Tabla Real en Supabase | Clave Primaria (PK) | Campo de Fecha Base | Estrategia de Folio DNI (`_rowSeq`) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Órdenes de Trabajo** | Planilla Unificada OTs | `app/src/pages/WorkOrders.jsx` | `work_orders` / `work_items` | `id` (uuid) | `created_at` / `start_date` | Folio monótono de tarea de obra (1...N) |
| **Personal** | Padrón de Operarios | `app/src/pages/Personal.jsx` | `workers` | `id` (uuid) | `created_at` | Folio correlativo de legajo/nómina (1...N) |
| **Personal** | Tarifario Quincenal | `app/src/pages/Personal.jsx` | `rate_cards` | `id` (uuid) | `year`, `month`, `quincena` | Folio de acuerdo tarifario (1...N) |
| **Carga de Horas** | Carga Diaria de Partes | `app/src/pages/LaborLogs.jsx` | `labor_logs` | `id` (uuid) | `work_date`, `created_at` | Folio de imputación de horas (1...N) |
| **Compras** | Pedidos y Materiales | `app/src/pages/Compras.jsx` | `purchase_orders` | `id` (uuid) | `order_date`, `created_at` | Folio de orden de compra (1...N) |
| **Compras** | Padrón de Proveedores | `app/src/pages/Compras.jsx` | `suppliers` | `id` (uuid) | `created_at` | Folio de legajo de proveedor (1...N) |
| **Pañol** | Planilla de Retiros | `app/src/pages/Panol.jsx` | `inventory_transactions` | `id` (uuid) | `transaction_date`, `created_at` | Folio de vale de retiro pañolero (1...N) |
| **Pañol** | Catálogo de Stock | `app/src/pages/Panol.jsx` | `materials` | `id` (uuid) | `created_at` | Folio de código SKU / catálogo (1...N) |
| **Barcos y Obras** | Flota de Buques | `app/src/pages/Ships.jsx` | `ships` | `id` (uuid) | `created_at` | Folio de buque en flota (1...N) |
| **Barcos y Obras** | Estadías y Muelle | `app/src/pages/Ships.jsx` | `ship_stays` | `id` (uuid) | `entry_date`, `created_at` | Folio de estadía portuaria (1...N) |
| **Barcos y Obras** | Padrón de Armadores | `app/src/pages/Ships.jsx` | `owners` | `id` (uuid) | `created_at` | Folio de empresa armadora (1...N) |
| **Terceros** | Comprobantes y Servicios | `app/src/pages/Terceros.jsx` | `third_party_services` | `id` (uuid) | `service_date`, `created_at` | Folio de comprobante de terceros (1...N) |
| **Panel Admin** | Variables Macro | `app/src/pages/AdminDashboard.jsx` | `rate_cards` / `macro_variables` | `id` (uuid) | `year`, `month` | Folio mensual de variables macro (1...N) |

---

## 3. Motor Canónico: `app/src/lib/monotonicFolioEngine.js`

El motor de folios opera como fuente única de verdad para el cálculo, sellado y actualización de folios:
1. `assignMonotonicFolios(items, options)`: Recibe la lista cruda de Supabase, la ordena por su fecha histórica de creación ascendente y le sella `_rowSeq = 1...N` de forma permanente.
2. `getNextMonotonicFolio(items)`: Calcula el próximo correlativo disponible (`Math.max(...folios) + 1`).
3. `stampNewRecordWithFolio(newRecord, items)`: Inyecta el nuevo folio inviolable al crear un registro o insertar una fila en blanco.

---

## 4. Representación en UI (Columna 0 de Grilla)

En todas las planillas de AlonCar ERP, la celda de la Columna 0 `#` se implementa de la siguiente manera:

```jsx
<button
  type="button"
  onClick={(e) => {
    e.stopPropagation()
    handleOpenRowMenu(row, rowIndex, e)
  }}
  className="font-mono text-[9px] font-bold px-1 py-0.5 rounded transition-all cursor-pointer hover:bg-cyan-950/90 hover:text-cyan-300"
  title={`Fila #${row._rowSeq || rowIndex + 1} (DNI Inviolable de Registro) • Clic para menú contextual`}
>
  {row._rowSeq || rowIndex + 1}
</button>
```

Al filtrar, ordenar o insertar filas, el número renderizado proviene de `row._rowSeq`, garantizando que la referencia jamás mute.
