# 📋 ÍNDICE CENTRAL DE MÓDULOS Y CLASIFICACIÓN FUNCIONAL ("GALLO O GALLINA")

> **Fuente Única de Verdad (Single Source of Truth):**  
> Este documento registra el padrón canónico de todas las vistas del AlonCar ERP.  
> Los componentes y reglas NO se definen repetidos por módulo: cada módulo **hereda** automáticamente el kit completo de su arquetipo.

---

## 1. Definición Canónica de Arquetipos y Kits Heredados

Cualquier cambio que el usuario solicite aplicar a un arquetipo se define **aquí una sola vez** y se implementa en los componentes canónicos correspondientes, propagándose a todos los módulos que lo heredan.

### 🐓 A. ARQUETIPO: `CARGA_EDICION` (Transaccional / Gallo)
* **Definición:** Pantallas de carga, modificación, duplicación, eliminación o procesamiento interactivo de registros.
* **Kit de Herramientas Canónicas Heredadas (Obligatorio en el 100% de las pantallas de este tipo):**
  1. `KpiRadar.jsx` ➔ Zona 2 (Radar cromático con filtrado instantáneo por clic).
  2. `CrawlerSearchBar.jsx` + `searchEngine.js` ➔ Zona 3 (Buscador omnicanal con atajos `Ctrl+F` / `Esc`, pulso crawler, indexación de texto y valores numéricos/decimales).
  3. `GridRibbon.jsx` + `exportEngine.js` ➔ Zona 4.A (Cinta con `[⚡ MODO PLANILLA]`, botón `[+ Insertar Fila]`, y botón universal `[📥 Exportar CSV/Excel]`).
  4. **Thead Sticky con `✎`** ➔ Zona 4.B (Toda columna editable in-situ o por modal DEBE llevar el glifo `✎` en su cabecera).
  5. **Disparadores Modales Canónicos** ➔ `ShipWorkOrderPickerModal.jsx` (doble clic Buque/OT), `ContractorPickerModal.jsx` (doble clic Contratista con fallback), Lápiz `✏️` (modal de fila).
  6. `GridStatusBarBottom.jsx` ➔ Zona 5 (Barra flotante fija con Badge `[⚠️ Filtro Activo (X de Y) [✕ Limpiar Todo]]` + Sheets math dinámico: `RECUENTO: N celdas` para texto, `Σ SUMA` / `Ø PROM` para números).
  7. **Spreadsheet Engine** ➔ Manejo de navegación por teclado, selección múltiple, copiar/pegar y undo/redo.

---

### 🥚 B. ARQUETIPO: `METRICAS_ANALISIS` (Analítico / Gallina)
* **Definición:** Pantallas de visualización agregada, tableros ejecutivos, matrices de decisión, conciliación o comparación de obras.
* **Kit de Herramientas Canónicas Heredadas:**
  1. Paneles de filtros analíticos multidimensionales de solo lectura (Período, Obra, Buque, Contratista).
  2. Gráficos interactivos, tarjetas de KPI consolidadas y matrices de auditoría/costos.
  3. Botón de exportación o reporte ejecutivo (Excel/PDF).
  4. **Restricción:** Solo lectura; NO contiene celdas editables `✎`, ni modo planilla, ni inputs de inserción de transacciones.

---

## 2. Padrón Oficial de Módulos del Sistema

| Módulo / Archivo | Ruta React | Clasificación Funcional | Kit Heredado | Estado de Estandarización |
| :--- | :--- | :--- | :--- | :--- |
| **`Compras.jsx`** | `/compras` | `CARGA_EDICION` (Gallo) | Kit Transaccional Completo | ✅ Estandarizado |
| **`Panol.jsx`** | `/panol` | `CARGA_EDICION` (Gallo) | Kit Transaccional Completo | ✅ Estandarizado |
| **`LaborLogs.jsx`** | `/horas` | `CARGA_EDICION` (Gallo) | Kit Transaccional Completo | ✅ Estandarizado |
| **`Terceros.jsx`** | `/terceros` | `CARGA_EDICION` (Gallo) | Kit Transaccional Completo | ✅ Estandarizado (Reparado error de filtros) |
| **`Personal.jsx`** | `/personal` | `CARGA_EDICION` (Gallo) | Kit Transaccional Completo | ✅ Estandarizado (Crawler tarifas 10/10.13, Ribbon y Barra) |
| **`Ships.jsx`** | `/barcos` | `CARGA_EDICION` (Gallo) | Kit Transaccional Completo | ✅ Estandarizado (Crawler eslora 180, Ribbon y Barra) |
| **`WorkOrders.jsx`** | `/ots` | `CARGA_EDICION` (Gallo) | Kit Transaccional Completo | ✅ Estandarizado (Crawler, Ribbon, Barra y thead ✎) |
| **`Dashboard.jsx`** | `/` | `METRICAS_ANALISIS` (Gallina) | Kit Analítico Completo | ✅ Conforme |
| **`AdminDashboard.jsx`** | `/admin` | `METRICAS_ANALISIS` (Gallina) | Kit Analítico Completo | ✅ Conforme |
| **`ModulePlaceholder.jsx`** | `/comparador` | `METRICAS_ANALISIS` (Gallina) | Kit Analítico Completo | ⏳ En espera de especificación |

---

## 3. Protocolo Bloqueante Inviolable para Nuevos Módulos

1. **PROHIBICIÓN ABSOLUTA DE GENERAR CÓDIGO A CIEGAS:**  
   Si el usuario solicita crear un nuevo módulo (por ejemplo: *"Creá el módulo de Cuenta Corriente"* o *"Agregá la pantalla de Adelantos"*), la IA tiene **TERMINANTEMENTE PROHIBIDO** escribir una sola línea de código JSX o crear el archivo sin conocer su clasificación.

2. **PREGUNTA OBLIGATORIA:**  
   Si el usuario no indicó explícitamente el arquetipo en su instrucción, la IA **DEBE DETENERSE INMEDIATAMENTE** y preguntar:
   > *"¿A qué clasificación pertenece el nuevo módulo: `CARGA_EDICION` (Gallo) o `METRICAS_ANALISIS` (Gallina)?"*

3. **REGISTRO EN EL ÍNDICE:**  
   Una vez respondida la clasificación:
   - Se da de alta en la tabla de este documento (`00_INDICE_DE_MODULOS_Y_CLASIFICACION.md`).
   - El módulo hereda automáticamente el Kit de Componentes Canónicos correspondiente.
   - Queda prohibido escribir componentes a medida o JSX duplicado para funciones ya resueltas en el kit.
