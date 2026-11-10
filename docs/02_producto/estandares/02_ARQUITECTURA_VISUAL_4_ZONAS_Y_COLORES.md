# 🎨 Arquitectura Visual de 4 Zonas y Sistema Cromático

Toda pantalla del ERP AlonCar adopta la estética naval oscura de alta legibilidad, enmarcada en 4 zonas delimitadas por bordes laterales de color específicos.

---

## 1. Mapa de Bordes Cromáticos por Zona

| Zona | Clase Base | Color de Acento | Identidad Visual y Rol |
| :--- | :--- | :--- | :--- |
| **Zona 1: Contexto** | `.alon-zone-context` | Azul Cielo (`border-l-sky-400`) | Título principal del módulo, migas de pan (`Breadcrumbs`), conmutador de modo y botón de alta principal. |
| **Zona 2: Radar de KPIs** | `.alon-zone-kpis` | Ámbar Cálido (`border-l-amber-400`) | Monitoreo en vivo de métricas críticas y alertas operativas. *(Opcional: si un módulo funcionalmente no requiere KPIs, esta zona se omite por completo)*. |
| **Zona 3: Toolbar de Control** | `.alon-zone-toolbar` | Cian Eléctrico (`border-l-cyan-400`) | Buscador omnicanal profundo, selectores rápidos de filtrado, botones Deshacer (`Ctrl+Z`) y Rehacer (`Ctrl+Y`). |
| **Zona 4: Planilla Sheets** | `.alon-zone-grid` | Borde Superior Esmeralda (`border-t-emerald-500/60`) | Hoja de cálculo interactiva con cabecera sticky, celdas interactivas y fill-down. |

---

## 2. Reglas Mandatorias para la Zona 2: Radar de KPIs y Alertas

Cuando un módulo requiere Zona de KPIs (como Compras o Pañol):

### A. Cromatismo Único por Tarjeta (Prohibido Repetir Colores)
Cada tarjeta debe tener su propio acento cromático para que el usuario identifique el estado de un vistazo:
- **Alerta Crítica / Falta OT:** Rojo Carmín (`border-rose-500/50 bg-rose-950/30 text-rose-300`)
- **Estado Inicial / Por Emitir:** Amarillo Ámbar (`border-amber-500/50 bg-amber-950/30 text-amber-300`)
- **Evaluaciones / Cotizaciones:** Violeta Eléctrico (`border-purple-500/50 bg-purple-950/30 text-purple-300`)
- **En Proveedor / Logística:** Azul Cobalto (`border-blue-500/50 bg-blue-950/30 text-blue-300`)
- **En Consulta / Se Compra?:** Rosa Fucsia (`border-pink-500/50 bg-pink-950/30 text-pink-300`)
- **Alta Catálogo / Faltantes:** Magenta (`border-fuchsia-500/50 bg-fuchsia-950/30 text-fuchsia-300`)
- **Completados / Recibidos:** Verde Esmeralda (`border-emerald-500/50 bg-emerald-950/30 text-emerald-300`)
- **Auditoría / Costos:** Bordo / Terracota (`border-red-600/50 bg-red-950/30 text-red-300`)

### B. Jerarquía y Tipografía Extragrande
- El número métrico debe ser el elemento más visible (`text-xl font-black font-mono`).
- Título conciso arriba (`text-xs font-bold uppercase tracking-wider`).
- Padding vertical contenido (`p-3` o `py-2.5 px-3.5`) para no robar espacio a la planilla.

### C. Prohibición de la Palabra "Filtrar"
- **PROHIBIDO** incluir badges o textos que digan "Filtrar". Toda la tarjeta es un botón interactivo. Al hacer clic se ilumina con `ring-2 ring-current` y filtra la planilla en 1 toque.

---

## 3. Reglas Mandatorias para el Bloque Operativo Unificado (Zona 3 + Zona 4)

En toda la arquitectura del ERP AlonCar rige la regla de oro de ergonomía operativa: **Zona 3 y Zona 4 funcionan como UN SOLO BLOQUE indivisible (`.alon-workspace-block`). Nunca esconder el buscador omnicanal (`CrawlerSearchBar`) ni permitir que la Zona 3 tape la cinta `GridRibbon` o los títulos de columnas (`thead`).**

### A. Prohibición de `sticky` Aislado y Uso Obligatorio de `.alon-workspace-block`
- **PROHIBIDO** aplicar `sticky top-0` únicamente a `.alon-zone-toolbar` dejando `.alon-zone-grid` suelto como hermano (*"Trampa del Hermano Sticky"*), ya que eso provoca que la tabla se deslice por debajo de la Zona 3 y esconda los títulos de columna.
- Toda vista `CARGA_EDICION` debe envolver `.alon-zone-toolbar` (Zona 3) y `.alon-zone-grid` (Zona 4) dentro de `<div className="alon-workspace-block">` (`sticky top-0 z-20 flex flex-col gap-2.5`).
- Cuando el operario desciende hacia la planilla de datos, la Zona 1 (Contexto) y la Zona 2 (KPIs) se desplazan hacia arriba para ceder espacio, y el bloque unificado **Zona 3 + Zona 4 se ancla completo en el borde superior** con separación constante (`gap-2.5` = `10px`).

### B. Jerarquía Estricta de 2 Niveles Internos en Zona 3 (`.alon-zone-toolbar`)
Dentro de `.alon-zone-toolbar` los controles se organizan obligatoriamente en dos niveles compactos (`space-y-2.5`, altura máxima ~85px):
1. **Nivel 1 (Superior — Buscador Omnicanal):** Contiene el componente canónico `<CrawlerSearchBar />` ocupando la franja principal superior (`w-full`), siempre despejado y a la vista.
2. **Nivel 2 (Inferior — Filtros Rápidos y Reversión):** Contiene en una sola línea flexible las píldoras o selectores compactos de filtrado rápido y a la derecha los controles de reversión (`Undo / Redo`) y limpieza de filtros.

### C. Contenedor de Scroll Tabular Estandarizado (`.alon-grid-scroll`) y Presupuesto de Viewport
- Dentro de `.alon-zone-grid`, inmediatamente debajo de `<GridRibbon />`, el contenedor de la tabla debe utilizar la clase canónica `.alon-grid-scroll` (`max-h-[calc(100vh-340px)] overflow-y-auto overflow-x-auto`).
- **Ley de Presupuesto Vertical (`Height(Zona 3 + Gap + Zona 4 + pb-10) <= Height(<main>)`):** Al acotar `.alon-grid-scroll` a `max-h-[calc(100vh-340px)]` y el contenedor raíz de página a `pb-10`, `<main>` alcanza el final de su scroll vertical en el píxel exacto en que la Zona 3 toca el tope (`top: 0`). Esto hace físicamente imposible que la Zona 3 se esconda hacia arriba o que la Zona 4 se deslice por debajo de la Zona 3.
- La cabecera `<thead className="sticky top-0 z-20 alon-grid-thead">` permanece inmovilizada en el tope de `.alon-grid-scroll`, de modo que únicamente las filas del `<tbody>` hacen scroll vertical.

---

## 4. Estándar Canónico para Submenús y Modales de Carga (Chroma-Chunking & Viewport Budget)

Todo submenú o ventana modal de carga/edición con 4 o más campos (`Personal`, `Pañol`, `Órdenes de Trabajo`, `Terceros`, `Barcos y Obras`, etc.) debe cumplir obligatoriamente con las siguientes 4 leyes de ergonomía:

### A. Presupuesto de Viewport Cero-Scroll y Pie Fijo (`.alon-modal-card`)
- **PROHIBIDO** crear modales angostos de una sola columna (`max-w-lg` o `max-w-2xl`) que superen la altura de la pantalla y obliguen al operario a desplazarse verticalmente para completar el formulario o encontrar el botón de guardado.
- Todo modal complejo utiliza la estructura en `app/src/index.css`:
  - `.alon-modal-card`: Contenedor horizontal de alta densidad (`max-w-5xl`, `max-h-[90vh]`, `flex flex-col`, `overflow-hidden`).
  - `.alon-modal-header`: Cabecera compacta con título e indicador de recorrido por color y tecla `Tab`.
  - `.alon-modal-body`: Cuerpo en grilla bicolumna (`grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-start`), donde las listas dinámicas internas tienen su propio scroll acotado (`max-h-36` / `max-h-44` / `max-h-[340px]`).
  - `.alon-modal-footer`: Pie siempre visible (`sticky bottom-0`) con `Cancelar` y el botón primario de confirmación.

### B. Subdivisión Semántica por Color (Chroma-Chunking)
Cada etapa lógica del formulario se agrupa visualmente en un bloque numerado con borde cromático distintivo para que el operario identifique a primera vista en qué paso se encuentra:
- **`.alon-chunk-sky` (Cian/Sky):** Paso 1 — Origen naval, Cascada Barco ➔ Contratista ➔ OT o Identificación principal.
- **`.alon-chunk-amber` (Ámbar):** Centro administrativo, Modalidad de OT / Catálogo `OT.ABC` o Tipo de Comprobante.
- **`.alon-chunk-rose` (Rojo/Coral):** Rubro titular / Especialidad.
- **`.alon-chunk-indigo` (Índigo/Azul):** Datos personales, Medidas navales o Fechas y Observaciones.
- **`.alon-chunk-emerald` (Esmeralda):** Tarifas, Importes AR$/US$, Matriz de materiales o Detalle operativo y responsables.
- **`.alon-chunk-purple` (Púrpura):** Estado, Permisos (`P`, `H`, `3ros`, `JO`) o Números de comprobantes asociados.

### C. Vector Continuo de Teclado (`Tab` sin Trampas)
- El primer campo interactivo del Bloque 1 lleva `autoFocus`.
- Todos los botones secundarios, píldoras rápidas de autocompletado, enlaces de ayuda o botones de cierre (`X`) llevan obligatoriamente `tabIndex={-1}` para que al presionar `Tab` el foco salte exclusivamente entre los campos de entrada reales en orden numérico (`1 ➔ 2 ➔ 3... ➔ Confirmar`).
