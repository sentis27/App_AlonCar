# 🧭 PROTOCOLO DE GOBERNANZA ARQUITECTÓNICA ALONCAR ERP

Como IA asistente del proyecto AlonCar ERP, estás **OBLIGADA** a consultar y obedecer este protocolo de gobernanza en **CADA TURNO** antes de proponer soluciones o modificar código.

---

## 1. Regla Rectoral de Clasificación Funcional: "Gallo o Gallina"
Toda pantalla, vista o requerimiento del sistema se clasifica estrictamente por su **FUNCIÓN**, nunca por el nombre del módulo:

### A. ARQUETIPO 1: TRANSACCIONAL (CARGA, EDICIÓN Y OPERACIÓN DE DATOS)
* **Definición:** Cualquier pantalla donde el usuario agregue, modifique celdas, duplique, borre o cargue registros (ejemplos: *Compras, Pañol, Terceros, Horas*, y futuros como *Cuenta Corriente, Facturación, Adelantos*).
* **DOCUMENTOS OBLIGATORIOS A CONSULTAR ANTES DE TOCAR CÓDIGO:**
  1. `docs/02_producto/estandares/01_CLASIFICACION_FUNCIONAL_GALLO_O_GALLINA.md`
  2. `docs/02_producto/estandares/02_ARQUITECTURA_VISUAL_4_ZONAS_Y_COLORES.md`
  3. `docs/02_producto/estandares/03_BUSCADOR_OMNICANAL_CRAWLER_PROFUNDO.md`
  4. `docs/02_producto/estandares/04_ESTANDAR_CARGA_THEAD_RIBBON_Y_BOTONES.md`
  5. `docs/02_producto/estandares/05_BARRA_INFERIOR_FLOTANTE_CALCULOS_Y_LIMPIEZA.md`
  6. `docs/02_producto/estandares/06_COMPONENTES_CANONICOS_MODALES.md`

* **REGLAS INVIOLABLES DE CARGA:**
  - **Cabeceras Sticky (`thead`):** Indicador `✎` obligatorio en toda columna editable.
  - **Buscador Omnicanal:** Crawler profundo que barre todas las columnas, notas, comprobantes y PDFs adjuntos.
  - **Los 3 Disparadores Canónicos:**
    1. Doble clic Buque/Destino ➔ `ShipWorkOrderPickerModal`
    2. Doble clic Contratista/Persona ➔ `ContractorPickerModal` (OT en blanco = padrón completo; OT asignada = filtrado por OT con fallback al padrón completo)
    3. Clic en Lápiz (✏️) ➔ Modal integral de fila completa
  - **Barra Inferior Flotante:** Badge `[⚠️ Filtro Activo (X de Y)  [✕ Limpiar Todo]]` + Agregaciones dinámicas (`Σ`, `Ø`) y **`RECUENTO: N celdas`** cuando se seleccionan celdas de texto.
  - **Prohibición:** Terminantemente prohibido crear inputs nativos, datalists o selects crudos en las celdas para reemplazar estos componentes.

### B. ARQUETIPO 2: ANALÍTICO (CONSULTA, ANÁLISIS, COMPARACIÓN Y DECISIÓN)
* **Definición:** Pantallas de visualización agregada, auditoría, comparación de obras o tableros ejecutivos (ejemplos: *Tablero de OTs, Resumen Gerencial, Comparador de Obras, Auditoría de Stock, Reconciliación*).
* **REGLAS ANALÍTICAS:** Solo lectura, sin celdas editables `✎`, filtros multidimensionales, gráficos y reportes exportables.

---

## 2. Protocolo de Respuesta Obligatorio
En tu primera línea de análisis antes de modificar código, debes indicar explícitamente:
> **[Gobernanza AlonCar]** Arquetipo detectado: `CARGA_DE_DATOS` | `ANALISIS_DE_DATOS`  
> **Estándares aplicados:** `[Lista de documentos de estandares/ consultados]`
