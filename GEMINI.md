# 🧭 PROTOCOLO DE GOBERNANZA ARQUITECTÓNICA ALONCAR ERP

Como IA asistente del proyecto AlonCar ERP, estás **OBLIGADA** a consultar y obedecer este protocolo de gobernanza en **CADA TURNO** antes de proponer soluciones o modificar código.

---

## 0. Regla de Bloqueo Absoluto para Nuevos Módulos
1. **PROHIBICIÓN TOTAL DE PROGRAMAR SIN CLASIFICACIÓN:**  
   Si el usuario solicita crear un nuevo módulo o vista sin indicar explícitamente su clasificación, la IA tiene **TERMINANTEMENTE PROHIBIDO** escribir una sola línea de código JSX o crear archivos.
2. **PREGUNTA OBLIGATORIA INMEDIATA:**  
   La IA debe detenerse de inmediato y formular la siguiente pregunta:  
   > *"¿A qué clasificación pertenece el nuevo módulo: `CARGA_EDICION` (Gallo) o `METRICAS_ANALISIS` (Gallina)?"*
3. **REGISTRO EN EL ÍNDICE:**  
   Una vez declarada la clasificación por el usuario, el módulo debe registrarse en `docs/02_producto/estandares/00_INDICE_DE_MODULOS_Y_CLASIFICACION.md` y heredar **automáticamente** el kit de componentes canónicos correspondiente.

---

## 1. Regla Rectoral de Clasificación Funcional: "Gallo o Gallina"
Toda pantalla, vista o requerimiento del sistema se clasifica estrictamente por su **FUNCIÓN**, nunca por el nombre del módulo:

### A. ARQUETIPO: `CARGA_EDICION` (TRANSACCIONAL / GALLO)
* **Definición:** Cualquier pantalla donde el usuario agregue, modifique celdas, duplique, borre o cargue registros (ejemplos: *Compras, Pañol, Terceros, Horas, Personal, Barcos, OTs*, y futuros como *Cuenta Corriente, Facturación, Adelantos*).
* **DOCUMENTOS OBLIGATORIOS A CONSULTAR ANTES DE TOCAR CÓDIGO:**
  0. `docs/02_producto/estandares/00_INDICE_DE_MODULOS_Y_CLASIFICACION.md`
  1. `docs/02_producto/estandares/01_CLASIFICACION_FUNCIONAL_GALLO_O_GALLINA.md`
  2. `docs/02_producto/estandares/02_ARQUITECTURA_VISUAL_4_ZONAS_Y_COLORES.md`
  3. `docs/02_producto/estandares/03_BUSCADOR_OMNICANAL_CRAWLER_PROFUNDO.md`
  4. `docs/02_producto/estandares/04_ESTANDAR_CARGA_THEAD_RIBBON_Y_BOTONES.md`
  5. `docs/02_producto/estandares/05_BARRA_INFERIOR_FLOTANTE_CALCULOS_Y_LIMPIEZA.md`
  6. `docs/02_producto/estandares/06_COMPONENTES_CANONICOS_MODALES.md`

* **KIT CANÓNICO HEREDADO (PROHIBIDO DUPLICAR JSX EN PÁGINAS):**
  1. `KpiRadar.jsx` ➔ Zona 2 (Radar de tarjetas cromáticas con filtro por clic)
  2. `CrawlerSearchBar.jsx` ➔ Zona 3 (Buscador omnicanal con atajos Ctrl+F / Esc y pulso crawler)
  3. `GridRibbon.jsx` ➔ Zona 4.A (Cinta [⚡ MODO PLANILLA] + [+ Insertar Fila] + [📥 Exportar CSV/Excel])
  4. `GridStatusBarBottom.jsx` ➔ Zona 5 (Barra flotante con Filtro Activo + [✕ Limpiar Todo] + Sheets-like)
  5. `ShipWorkOrderPickerModal.jsx` ➔ Disparador 1 (Doble clic Barco/OT)
  6. `ContractorPickerModal.jsx` ➔ Disparador 2 (Doble clic Contratista)
  7. `exportEngine.js` ➔ Motor universal de exportación a Excel / Sheets (.csv con BOM)

* **REGLAS INVIOLABLES DE CARGA:**
  - **Cabeceras Sticky (`thead`):** Indicador `✎` obligatorio en toda columna editable.
  - **Buscador Omnicanal:** `CrawlerSearchBar` + `searchEngine.js` (`buildUniversalSearchCorpus`).
  - **Los 3 Disparadores Canónicos:**
    1. Doble clic Buque/Destino ➔ `ShipWorkOrderPickerModal`
    2. Doble clic Contratista/Persona ➔ `ContractorPickerModal` (OT en blanco = padrón completo; OT asignada = filtrado por OT con fallback al padrón completo)
    3. Clic en Lápiz (✏️) ➔ Modal integral de fila completa
  - **Barra Inferior Flotante:** `GridStatusBarBottom` con Badge `[⚠️ Filtro Activo (X de Y)  [✕ Limpiar Todo]]` + Agregaciones dinámicas (`Σ`, `Ø`) y **`RECUENTO: N celdas`** cuando se seleccionan celdas de texto.
  - **Prohibición:** Terminantemente prohibido crear inputs nativos, datalists o selects crudos en las celdas o toolbars para reemplazar estos componentes.

### B. ARQUETIPO: `METRICAS_ANALISIS` (ANALÍTICO / GALLINA)
* **Definición:** Pantallas de visualización agregada, auditoría, comparación de obras o tableros ejecutivos (ejemplos: *Dashboard, AdminDashboard, Comparador de Obras, Auditoría de Stock, Reconciliación*).
* **REGLAS ANALÍTICAS:** Solo lectura, sin celdas editables `✎`, filtros multidimensionales, gráficos y reportes exportables.

---

## 2. Protocolo de Respuesta Obligatorio
En tu primera línea de análisis antes de proponer soluciones o modificar código, debes indicar explícitamente:
> **[Gobernanza AlonCar]** Arquetipo detectado: `CARGA_EDICION` | `METRICAS_ANALISIS`  
> **Estándares aplicados:** `[Lista de documentos de estandares/ consultados]`

---

## 3. Protocolo de Modularidad para Nuevas Utilidades
1. **Para agregar una utilidad global a todas las pantallas:**  
   Basta con indicar *"Agregá a la barra superior / inferior / buscador la función de [X]"*. La IA debe modificar **exclusivamente el componente canónico correspondiente** (`GridRibbon`, `GridStatusBarBottom`, `CrawlerSearchBar`, etc.), propagando la utilidad instantáneamente a todas las pantallas sin tocar los módulos uno por uno.
2. **Para crear un módulo nuevo:**  
   Si ya fue clasificado conforme a la Regla 0, la pantalla debe componerse ensamblando las piezas canónicas existentes sin reinventar JSX ni escribir estilos repetidos.
