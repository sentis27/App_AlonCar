# Módulo 4b: Compras y Proveedores

> **Módulo:** M4b — Compras & Logística de Insumos  
> **Estado:** ✅ Implementado y Operativo  
> **Ruta en App:** `/compras`  
> **Referencia Legacy:** Planilla GS-006 (`1k1BBl1pAf8HlGfiNzSt5xGHpkgQw1dD3tWERTYhu3MY`)  
> **Migración SQL:** `0024_create_suppliers_and_purchase_orders.sql`

---

## 1. Visión General

El **Módulo de Compras (M4b)** digitaliza integralmente la planilla GS-006 del astillero, optimizando el circuito diario de aprovisionamiento de materiales, gases industriales, fijaciones y consumibles.

Resuelve la convivencia armónica entre dos circuitos fundamentales del astillero:
1. **Compras para Stock / Pañol (`VIA_PANOL`):** Al recibirse (`RECIBIDO`), incrementan automáticamente el stock físico en `public.materials.current_stock`.
2. **Compras Directas para Obra (`DIRECT`):** Adquiridas específicamente para un buque (`ship_id`) y una orden de trabajo (`work_order_id`). Al recibirse (`RECIB.COMP.DIRECT`), **no tocan stock de pañol** e impactan directamente en el costo vivo de la obra.

---

## 2. Componentes de UI y Estándares Mandatorios

El módulo cumple estrictamente los dos estándares de interfaz tipo Hoja de Cálculo:

### 2.1. Inmovilización de Encabezados (Sticky Header tipo Excel)
La cabecera de la tabla permanece congelada en la parte superior (`sticky top-0 z-20 bg-slate-950`) durante todo el desplazamiento vertical de la grilla, permitiendo leer columnas y acceder a los selectores maestros sin perder el contexto.

### 2.2. Selección Libre de Filas + Barra Flotante Reactiva de Totales
Ubicada en la base de la pantalla (`fixed bottom-4 left-4 right-4 md:left-64 z-40 bg-slate-950/95`):
- **Modo interactivo dual:**
  - `📌 Selección Manual: N pedidos` (cuando el usuario tilda casillas a su antojo, con botón `✕ Limpiar`).
  - `🌐 Todo el filtro: N pedidos` (muestra métricas globales del conjunto filtrado).
- **Métricas reactivas vivas:**
  - Cantidad total de insumos (`Σ Cant`).
  - Sumatoria total en pesos (`Σ AR$`).
  - Sumatoria total en dólares (`Σ US$` calculada con el tipo de cambio quincenal oficial configurado en `macro_variables`).
  - Promedio de costo unitario (`Ø`).
- **Acciones en lote:**
  - `[ 🛒 Pedir Agrupado (N) ]`: Agrupa los seleccionados por proveedor, genera el pedido formal en español y abre directamente una conversación de WhatsApp Web con el contacto comercial registrado.
  - `[ ✅ Recibir (N) ]`: Marca los ítems como recibidos, derivando a Pañol o Buque según corresponda.

---

## 3. Modelo de Base de Datos

### 3.1. Tabla `public.suppliers` (Catálogo Unificado de Proveedores)
Catálogo dinámico que alimenta a Compras, Pañol (circuitos de gases) y Terceros:

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `UUID PK` | Identificador único |
| `name` | `TEXT UNIQUE` | Nombre / Razón Social |
| `trade` | `TEXT` | Rubro principal (Ferretería, Gases, Tornería, Pintura, etc.) |
| `cuit_cuil` | `TEXT` | CUIT/CUIL fiscal |
| `phone` | `TEXT` | Teléfono / WhatsApp para envíos automáticos |
| `email` | `TEXT` | Correo comercial |
| `payment_method` | `TEXT` | `CONTADO` o `CUENTA_CORRIENTE` |
| `billing_timing` | `TEXT` | `DIA`, `INICIO_DE_MES` o `ALEATORIO` |
| `billing_medium` | `TEXT` | `EMAIL`, `WHATSAPP` o `EN_MANO` |
| `is_gas_supplier` | `BOOLEAN` | Flag para el circuito de gases Regla P-02 |
| `client_number` | `TEXT` | Número de cliente (ej. `2234867` para Air Liquide) |
| `order_cutoff_day` | `TEXT` | Día y hora límite de pedido (ej. `Martes antes de las 12:00`) |
| `delivery_day` | `TEXT` | Día de entrega acordado (ej. `Miércoles`) |

### 3.2. Tabla `public.purchase_orders` (Registro de Pedidos)
Depuración de GS-006 de 32 a **24 columnas operativas**:

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `UUID PK` | Identificador único |
| `charge_type` | `TEXT` | `DIRECT`, `VIA_PANOL`, `STANDBY` |
| `order_date` | `DATE` | Fecha de carga del pedido |
| `ship_id` | `UUID FK → ships` | Buque destino (o `ASTILLERO` para stock) |
| `work_order_id` | `UUID FK → work_orders` | OT destino (o `STOCK` para stock) |
| `requested_by_name` | `TEXT` | Persona o sector solicitante |
| `material_id` | `UUID FK → materials` | Vínculo al catálogo maestro (nullable si es nuevo) |
| `material_name_raw` | `TEXT` | Nombre textual ingresado (preservado para trazabilidad) |
| `is_new_material` | `BOOLEAN` | `true` si no existe en B.D. (alerta de alta formal) |
| `quantity` | `NUMERIC` | Cantidad solicitada |
| `unit_measure` | `TEXT` | Unidad de medida (Unidad, Kilos, Bolsón, Metros, etc.) |
| `supplier_id` | `UUID FK → suppliers` | Proveedor seleccionado |
| `supplier_quoted_price` | `NUMERIC` | Precio cotizado por proveedor (AR$) |
| `system_unit_price` | `NUMERIC` | Precio vigente en catálogo maestro (AR$) |
| `status` | `TEXT` | Estado del pedido (`PEDIR`, `PEDIDO`, `COTIZACION`, etc.) |
| `is_reconciled` | `BOOLEAN` | Conciliado con factura ("Línea Morada") |
| `reconciled_at` | `TIMESTAMPTZ` | Momento de la conciliación contable |
| `reconciled_by` | `TEXT` | Supervisor que auditó |
| `invoice_number` | `TEXT` | Número de factura o remito asociado |
| `fortnight_period` | `TEXT` | Quincena contable (`YYYY-MM-Q1` / `YYYY-MM-Q2`) |

---

## 4. Funcionalidades Especiales

### 4.1. Línea Morada de Conciliación de Facturas
Reemplaza el pintado manual de filas en hojas de cálculo:
- El supervisor presiona **"Conciliar"** en un pedido de un proveedor.
- Ingresa el número de factura o remito.
- El sistema marca automáticamente esa compra y todas las anteriores pendientes de ese proveedor como conciliadas (`is_reconciled = true`).
- Se dibuja una línea divisoria morada gruesa con el sello de auditoría.
- Un conmutador *"🟣 Ocultar Conciliados"* permite filtrar las filas ya cerradas para mantener la vista limpia.

### 4.2. Gestor Documental Integrado (1 Clic)
- Botón `📎` en cada fila para subir comprobantes (PDF, JPG, PNG, DOC).
- Normalización automática de nombres: `{descripcion}_{proveedor}.{ext}`.
- Almacenamiento estructurado en Supabase Storage: `compras/cotizaciones/{año}/{rubro}/{archivo}`.
- Indexado en `public.purchase_documents` para búsquedas cruzadas y recuperación rápida.

### 4.3. Alta Formal de Materiales (🔒 Solo Supervisor)
- Cuando un operario escribe un material no existente, se marca con la insignia `⚠️ Alta`.
- El supervisor accede a un modal con prefijos técnicos estandarizados (`BULON`, `CAÑO`, `CHAPA`, `ELECTRODO`), define el rubro y precio base, e inserta el ítem en `public.materials`, actualizando automáticamente la orden de compra.

### 4.4. Regla P-02: Circuito de Gases Industriales
- **Air Liquide:** Alerta en KPI superior: *Martes antes de las 12:00 hs* para canje semanal de vacíos al `0810-222-5272` (Cliente `2234867`), con entrega los miércoles.
- **Praxair Linde:** Pedido quincenal los lunes, con entrega los martes.
- **Ferremat:** Proveedor de contingencia para emergencias.
