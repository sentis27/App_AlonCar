# 📋 ÍNDICE CENTRAL DE MÓDULOS, SUBMÓDULOS Y CLASIFICACIÓN FUNCIONAL ("GALLO O GALLINA")

> **Fuente Única de Verdad (Single Source of Truth):**  
> Este documento registra el padrón canónico e indexado de **todos los módulos, submódulos, pestañas, tablas de base de datos y herramientas de visualización/análisis** del AlonCar ERP.  
> Sirve como mapa estructural para:
> 1. **El Usuario / Dirección Operativa**
> 2. **Agentes de Ingeniería IA (Antigravity / Claude)**
> 3. **El futuro Asistente de IA integrado dentro de la App**

---

## 0. Protocolo Pre-Flight Contra el "Vicio de Memoria" (Inviolable)

1. **PROHIBICIÓN DE TRABAJAR DE MEMORIA:**  
   Ningún agente de IA puede enumerar módulos, asumir qué tablas existen o diseñar una solución transversal sin **leer primero este archivo (`00_INDICE_DE_MODULOS_Y_CLASIFICACION.md`), `docs/00_ARQUITECTURA_TABLAS_Y_FOLIOS.md` e `INDICE_PLANILLAS.md`**.
2. **INDEXACIÓN OBLIGATORIA DE NUEVOS COMPONENTES:**  
   Cada vez que se cree un módulo, submódulo de carga, pestaña o herramienta de visualización/análisis (sea Gallo o Gallina), **DEBE registrarse en las tablas de las Secciones 2.A o 2.B de este documento** indicando su ruta, pestaña, tabla(s) Supabase asociadas y vínculo con la base de datos de auditoría (`audit_logs`).

---

## 1. Definición Canónica de Arquetipos y Kits Heredados

Cualquier cambio que el usuario solicite aplicar a un arquetipo se define **aquí una sola vez** y se implementa en los componentes canónicos correspondientes, propagándose al 100% de los módulos y submódulos que lo heredan.

### 🐓 A. ARQUETIPO: `CARGA_EDICION` (Transaccional / Gallo)
* **Definición:** Pantallas y submódulos de carga, modificación in-situ o por modal, pegado masivo, duplicación o eliminación de registros. Referencia canónica indiscutible: `app/src/pages/Compras.jsx`.
* **Prohibición de Tablas Estándar:** Prohibido crear pantallas con `<table>` estándar o estilos aislados; toda planilla usa obligatoriamente `app/src/hooks/useSpreadsheetGrid.js` y modifica mejoras transversales únicamente en el motor o componente canónico.
* **Kit de Herramientas Canónicas Heredadas (Obligatorio en el 100% de las pantallas y pestañas de este tipo; prohibido duplicar en páginas):**
  1. `KpiRadar.jsx` ➔ **Zona 2 (`.alon-zone-kpis`, `amber-400`):** Radar cromático con bordes/fondos únicos por tarjeta (nunca bordes grises inactivos), encabezado `📊 RADAR DE KPIS Y ALERTAS OPERATIVAS • Clic en cualquier tarjeta para filtrar` y filtro por clic. Prohibido usar la palabra "Filtrar".
  2. `CrawlerSearchBar.jsx` + `searchEngine.js` ➔ **Zona 3 (`.alon-zone-toolbar`, `cyan-400`):** Buscador omnicanal con atajos `Ctrl+F` / `Esc`, botón `[↩ Deshacer (Ctrl+Z)]`, pulso crawler e indexación de texto y valores numéricos/decimales.
  3. `GridRibbon.jsx` + `exportEngine.js` ➔ **Zona 4 (`.alon-zone-grid`, borde superior `emerald-400`):** Cinta con coordenadas GPS (`Navigation`), `[⚡ MODO PLANILLA]`, cálculos en vivo (Suma, Promedio, Recuento), Deshacer/Rehacer (`Ctrl+Z`/`Ctrl+Y`), `[+ Insertar Fila en #N]` y `[📥 Exportar]`.
  4. **Columna 0 Canónica (`#` + Checkbox) & Thead Sticky (`.alon-grid-thead`) con `✎`** ➔ Ancho fijo `w-8`/`w-10`: en `thead` checkbox maestro apilado sobre `#`; en `tbody` checkbox individual + botón `#` interactivo con resaltado corporativo `bg-cyan-950/30` al seleccionarse; toda columna editable lleva glifo `✎`.
  5. **Disparadores Modales Canónicos** ➔ `ShipWorkOrderPickerModal.jsx` (doble clic Buque/Destino/OT), `ContractorPickerModal.jsx` (doble clic Contratista/Persona), Lápiz `✏️` (modal de fila).
  6. `GridStatusBarBottom.jsx` ➔ **Zona 5:** Barra flotante con Badge `[⚠️ Filtro Activo (X de Y) [✕ Limpiar Todo]]`, agregaciones dinámicas (`RECUENTO`, `Σ SUMA`, `Ø PROM`) y acciones masivas al seleccionar filas (`selectedRowIds.size > 0`).
  7. `useSpreadsheetGrid.js` + `GridContextMenu.jsx` ➔ Navegación direccional (`Enter`, `Shift+Enter`, `Tab`, `Shift+Tab`, flechas), selección espacial de celdas/rangos, selección canónica de filas (`selectedRowIds`, `toggleSelectRow`, `toggleSelectAll`), Paste Matrix 2D con sanitización de tipos, Fill-handle (`■`), borrado (`Supr`/`Backspace`), Undo/Redo 50 pasos (`Ctrl+Z`/`Ctrl+Y`) y menú contextual (`onContextMenu`) con Copiar celda/fila, Pegar, Insertar arriba/abajo, Duplicar, Limpiar y visor modal de `audit_logs`.
  8. **Vínculo Obligatorio con Trazabilidad (`app/src/lib/auditService.js` ➔ `audit_logs`)** ➔ Toda edición in-situ (`logCellChange`), pegado masivo (`logBatchPaste`), alta o baja de fila (`logRowAction`) en `CARGA_EDICION` registra en `audit_logs` con blindaje anti-objeto (`typeof val === 'object'`).
* **Arquitectura de 5 Zonas (`app/src/index.css`) y Regla de Edición Total:** Zona 1 `.alon-zone-context` (`sky-400`, badge versión, pestañas compactas y botón principal) + Zonas 2–5 arriba descritas. Toda celda visible es editable con doble clic (`Enter`/`F2`), `showPicker()` en fechas/selects y Fill-handle (`■`). Todo `onBlur` se declara como `onBlur={() => commitFn()}`. Entregar siempre con `Fit-to-Viewport` (cero scroll horizontal de ventana), `npm run build` y `npm run lint` limpios.

---

### 🥚 B. ARQUETIPO: `METRICAS_ANALISIS` (Visualización y Análisis / Gallina)
* **Definición:** Pantallas, pestañas o modales de visualización agregada, tableros ejecutivos, auditoría de trazabilidad, matrices de decisión, conciliación o comparación de obras.
* **Kit de Herramientas Canónicas Heredadas:**
  1. Paneles de filtros analíticos multidimensionales (Período, Obra/OT, Buque, Usuario, Módulo, Rubro).
  2. Tarjetas de KPI ejecutivas, curvas comparativas, matrices de costos y visores de diferencias (Diff Viewers).
  3. Botón de exportación de reporte ejecutivo o bitácora (Excel/CSV/PDF).
  4. Indexación explícita de las tablas de base de datos que alimentan cada visualización (para trazabilidad técnica y consulta del Asistente de IA). Cuando una pestaña administrativa gestione catálogos consumidos por planillas, debe leer y escribir sobre un módulo exportable único en `app/src/lib/`.

---

## 2.A Padrón Oficial Indexado de Módulos y Submódulos Transaccionales (`CARGA_EDICION` — Gallo)

Todos los módulos y submódulos listados a continuación son hojas de edición activa y **están obligatoriamente vinculados a `auditService.js` (`audit_logs`)**:

| # | Módulo / Archivo | Ruta React | Submódulo / Pestaña (`activeTab`) | Tabla(s) Supabase | Identificador de Auditoría (`entity_type`) | Estado de Estandarización & Auditoría |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1.1** | **`WorkOrders.jsx`** | `/ots` | **1. Vista Unificada / OTs Activas** (`unificado` / `ots`) | `work_orders` | `work_orders` | ✅ Estandarizado + Auditado |
| **1.2** | **`WorkOrders.jsx`** | `/ots` | **2. Catálogo de Trabajos / Tareas (OT.ABC)** (`unificado` / modal plantilla) | `work_order_tasks` | `work_order_tasks` | ✅ Estandarizado + Auditado |
| **2.1** | **`Personal.jsx`** | `/personal` | **1. Nómina / Padrón de Operarios** (`nomina`) | `workers` | `workers` | ✅ Estandarizado + Auditado |
| **2.2** | **`Personal.jsx`** | `/personal` | **2. Tarifario Quincenal** (`tarifario`) | `rate_cards` | `rate_cards` | ✅ Estandarizado + Auditado |
| **2.3** | **`Personal.jsx`** | `/personal` | **3. Grupos de Trabajo / Cuadrillas** (modal/asignación) | `work_groups` | `work_groups` | ✅ Estandarizado + Auditado |
| **3.1** | **`LaborLogs.jsx`** | `/horas` | **1. Carga Diaria de Horas / Partes** (`carga`) | `daily_labor_logs` | `daily_labor_logs` | ✅ Estandarizado + Auditado |
| **3.2** | **`LaborLogs.jsx`** | `/horas` | **2. Control Diario de Imputaciones** (`control_diario`) | `daily_labor_logs` | `daily_labor_logs` | ✅ Estandarizado + Auditado |
| **4.1** | **`Compras.jsx`** | `/compras` | **1. Registro de Compras y Pedidos** (`compras`) | `purchase_orders`, `purchase_order_items` | `purchase_orders` | ✅ Estandarizado + Auditado |
| **4.2** | **`Compras.jsx`** | `/compras` | **2. Padrón Maestro de Proveedores** (`proveedores`) | `suppliers` | `suppliers` | ✅ Estandarizado + Auditado |
| **4.3** | **`Compras.jsx`** | `/compras` | **3. Gestor Documental de Compras** (`documentos`) | `purchase_documents` | `purchase_documents` | ✅ Estandarizado + Auditado |
| **5.1** | **`Panol.jsx`** | `/panol` | **1. Stock, Inventario y Movimientos (Vales/Remitos)** (`planillas`) | `inventory_transactions`, `materials`, `compliance_alerts`, `worker_permission_requests` | `inventory_transactions` | ✅ Estandarizado + Auditado |
| **5.2** | **`Panol.jsx`** | `/panol` | **2. Catálogo Maestro de Materiales** (`catalogo`) | `materials` | `materials` | ✅ Estandarizado + Auditado |
| **5.3** | **`Panol.jsx`** | `/panol` | **3. Control de Gases Industriales & Trazabilidad Gaseras** (`gases` · `GasTraceabilityGrid`) | `gas_cylinder_movements`, `materials`, `suppliers`, `inventory_transactions` | `gas_cylinder_movements` | ✅ Estandarizado + Auditado |
| **5.4** | **`Panol.jsx`** | `/panol` | **4. Entrega de EPP y Ropa de Trabajo** (`epp`) | `ppe_deliveries` | `ppe_deliveries` | ✅ Estandarizado + Auditado |
| **6.1** | **`Ships.jsx`** | `/barcos` | **1. Padrón de Buques / Embarcaciones** (`buques`) | `ships` | `ships` | ✅ Estandarizado + Auditado |
| **6.2** | **`Ships.jsx`** | `/barcos` | **2. Estadías y Movimientos de Muelle** (`movimientos`) | `ship_stays` | `ship_stays` | ✅ Estandarizado + Auditado |
| **6.3** | **`Ships.jsx`** | `/barcos` | **3. Padrón de Armadores / Razón Social** (`armadores`) | `owners` | `owners` | ✅ Estandarizado + Auditado |
| **7.1** | **`Terceros.jsx`** | `/terceros` | **1. Servicios de Terceros y Facturación** (`filas` / `fichas`) | `third_party_services` | `third_party_services` | ✅ Estandarizado + Auditado |
| **7.2** | **`Terceros.jsx`** | `/terceros` | **2. Padrón de Talleres / Contratistas** (`ContractorPickerModal`) | `workshops` | `workshops` | ✅ Estandarizado + Auditado |
| **8.1** | **`AdminDashboard.jsx`** | `/admin` | **1. Gestión de Rubros & Oficios** (`rubros`) | `system_settings` (`master_trades`) | `system_settings` | ✅ Estandarizado + Auditado |
| **8.2** | **`AdminDashboard.jsx`** | `/admin` | **2. Matriz de Puestos & Permisos** (`matriz`) | `user_roles`, `profiles` | `user_roles` | ✅ Estandarizado + Auditado |
| **8.3** | **`AdminDashboard.jsx`** | `/admin` | **3. Variables Macroeconómicas** (`macro`) | `macro_variables` | `macro_variables` | ✅ Estandarizado + Auditado |
| **9.1** | **`ResumenGerencial.jsx`** + **`RemitoComercialAlfaPanel.jsx`** | `/resumen-gerencial?tab=remito` | **3. Remito Comercial & Tarifario Nivel Alfa** (`remito` · Autoalimentado) | `system_settings` (`remito_comercial_por_buque`, `drydock_rate_card_alfa`) + lectura de `ship_stays`, `work_orders`, `inventory_transactions`, `labor_logs`, `third_party_services` | `remito_comercial` · `resumen_gerencial_config` | ✅ Estandarizado + Auditado |

---

## 2.B Padrón Oficial Indexado de Módulos, Submódulos y Herramientas de Visualización (`METRICAS_ANALISIS` — Gallina)

Cada sistema de visualización, tablero analítico o visor de auditoría está indexado con las tablas exactas que consume para garantizar trazabilidad total y alimentar el contexto del Asistente de IA de la aplicación:

| # | Módulo / Componente | Ruta / Ubicación | Submódulo / Herramienta de Visualización | Tablas Supabase Consumidas (Origen de Datos) | Propósito Analítico y Métricas que Expone | Estado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **A.1** | **`AdminDashboard.jsx`** + **`AdminAuditLedger.jsx`** | `/admin` (Pestaña `auditoria`) | **Libro de Auditoría & Trazabilidad Global** | `audit_logs` | **Hoja Maestra de Trazabilidad:** Registra el 100% de las cargas y ediciones del ERP. Expone métricas de uso por planilla, ranking de actividad por usuario, tasa de correcciones/errores, filtros por fecha/módulo/operación y visor de diferencias (`old_value` vs `new_value`) con exportación CSV/Excel. | ✅ Activo |
| **A.2** | **`GridContextMenu.jsx`** | Transversal (Clic derecho en cualquier grilla `CARGA_EDICION`) | **Modal Historial de Cambios por Registro/Celda** | `audit_logs` (filtrado por `entity_id`) | **Trazabilidad In-Situ:** Permite auditar en tiempo real quién creó o modificó una fila/celda específica, cuándo lo hizo y qué valor tenía antes, sin salir de la planilla operativa. | ✅ Activo |
| **A.3** | **`Dashboard.jsx`** | `/` (Inicio) | **Tablero Ejecutivo Central & Radar Macro** | `ships`, `work_orders`, `materials`, `daily_labor_logs`, `macro_variables` | **Resumen Operativo General:** Conteos en vivo de flota activa, OTs en curso, catálogo de insumos, evolución de dólar oficial/operativo e inflación mensual fijada por gerencia. | ✅ Activo |
| **A.4** | **`Personal.jsx`** | `/personal` (Pestaña `analisis`) | **Tablero de Análisis de Costos de Personal vs Inflación** | `workers`, `rate_cards`, `daily_labor_logs`, `macro_variables` | **Inteligencia Salarial:** Compara la evolución de tarifas horarias quincenales contra la inflación mensual acumulada y el dólar, desglosando masa salarial por rubro, categoría y centro de costo. | ✅ Activo |
| **A.5** | **`LaborLogs.jsx`** | `/horas` (Pestaña `sabana_quincenal`) | **Sábana Quincenal de Horas & Liquidación Operativa** | `daily_labor_logs`, `workers`, `rate_cards`, `work_orders`, `ships` | **Matriz de Cierre Quincenal:** Consolida las horas normales, extras 50% y extras 100% por operario y día de la quincena, cruzándolas con el tarifario vigente para pre-liquidación y control de desvíos. | ✅ Activo |
| **A.6** | **`WorkOrders.jsx`** | `/ots` (Modal Ficha 360° / DEC-011) | **Ficha 360° de Orden de Trabajo & Cierre de Costos** | `work_orders`, `work_order_tasks`, `daily_labor_logs`, `inventory_movements`, `purchase_orders`, `third_party_services` | **Contabilidad Analítica por Obra:** Consolida en una sola vista todos los costos imputados a una OT (Mano de Obra propia + Materiales retirados de Pañol + Compras Directas + Facturas de Terceros). | ✅ Activo |
| **A.7** | **`AdminDashboard.jsx`** | `/admin` (Pestaña `alertas`) | **Monitor de Cumplimiento & Alertas Operativas** | `work_orders`, `purchase_orders`, `daily_labor_logs`, `inventory`, `third_party_services` | **Auditoría Preventiva de Reglas de Negocio:** Detecta desvíos operativos en vivo (compras sin OT o precio, partes de horas sin validar, stock crítico, servicios de terceros sin remito). | ✅ Activo |
| **A.8** | **`AdminDashboard.jsx`** | `/admin` (Pestaña `ia`) | **Panel de Gobernanza IA & Telemetría de Prompts** | `system_settings` (`ai_governance`), `audit_logs` | **Control del Copiloto / Asistente IA:** Supervisa las reglas de extracción, diccionarios de sinónimos navales y comportamiento de los agentes inteligentes del sistema. | ✅ Activo |
| **A.9** | **`ResumenGerencial.jsx`** + **`resumenGerencial/*`** | `/resumen-gerencial` (`/comparador` redirige) | **Resumen Gerencial GS-004 (`1. Resumen de Obra & Costos` + `RESUMEN 2` + 3 Hojas Solo Lectura `MATERIALES`/`HORAS`/`TERCEROS` + `2. Comparador de Obras Canvas`)** | `ships`, `ship_stays`, `owners`, `work_orders`, `work_items`, `labor_logs`, `rate_cards`, `inventory_transactions`, `materials`, `purchase_orders`, `third_party_services`, `workers`, `macro_variables`, `system_settings` | **Resumen Ejecutivo & Benchmarking:** Consolida costo directo real (`Materiales + Consumibles + Terceros + Horas Aprobadas + "R"`), expone `ELEM. SEGURIDAD (REF. ASTILLERO)` sin sumarlo al `TOTAL US$` (`workCostRules.js`), navegación rápida 3x2 a hojas auditables solo lectura y Canvas multidimensional (Nivel 1 apilado / ratios + Nivel 2 OT-OT + m² Ad-Hoc). | ✅ Activo |
| **A.10** | **`Tesoreria.jsx`** + **`TesoreriaDeduccionesPanel.jsx`** | `/tesoreria` | **Tesorería & Extracción de Descuentos a Contratistas (Graciela)** | `inventory_transactions`, `materials`, `workers`, `ships`, `work_orders`, `rate_cards` | **Liquidación Automática Quincenal:** Seleccionada la quincena, extrae y agrupa Consumibles (`%` contrato) y `ELEM.SEGURIDAD` cobrables por contratista, excluyendo automáticamente los retiros exentos por zona gris (`safety_items = 'ASTILLERO'`) y exportando CSV/Excel. Base para futuros controles de pagos, adelantos y Terceros de Graciela. | ✅ Activo |

---

## 3. Protocolo Bloqueante Inviolable para Nuevos Módulos, Submódulos o Herramientas

1. **PROHIBICIÓN ABSOLUTA DE GENERAR CÓDIGO A CIEGAS:**  
   Si el usuario solicita crear un nuevo módulo, pestaña o herramienta, la IA tiene **TERMINANTEMENTE PROHIBIDO** escribir código sin antes verificar su clasificación (`CARGA_EDICION` o `METRICAS_ANALISIS`).

2. **PREGUNTA OBLIGATORIA (SI HAY AMBIGÜEDAD):**  
   > *"¿A qué clasificación pertenece el nuevo componente: `CARGA_EDICION` (Gallo - con vínculo obligatorio a `audit_logs`) o `METRICAS_ANALISIS` (Gallina - indexado con sus tablas de origen)?"*

3. **REGISTRO Y VINCULACIÓN AUTOMÁTICA:**  
   - Si es **`CARGA_EDICION` (Gallo)**: Se registra en la **Sección 2.A**, hereda el Kit Transaccional Completo (`useSpreadsheetGrid`, `GridContextMenu`, Columna 0, Ribbon, StatusBar) y **se conecta obligatoriamente a `auditService.js`** para que cada alta, baja o modificación alimente `audit_logs`.
   - Si es **`METRICAS_ANALISIS` (Gallina)**: Se registra en la **Sección 2.B** detallando qué tablas de Supabase consume y qué métricas calcula, dejándolo documentado para el usuario, el agente de desarrollo y el Asistente IA de la aplicación.
