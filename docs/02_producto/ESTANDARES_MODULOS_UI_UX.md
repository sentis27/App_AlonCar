# 📐 Guía Maestra de Estándares de Arquitectura, UI y UX para Módulos (ERP AlonCar)

> **Regla Mandatoria:** Esta guía es la fuente de verdad técnica y visual para la creación y rediseño de cualquier módulo del ERP AlonCar.
> La IA o cualquier desarrollador debe consultar y aplicar obligatoriamente este checklist antes de codificar.
> **Objetivo primordial:** Ofrecer la máxima ergonomía y velocidad operativa de Google Sheets / Microsoft Excel combinada con una identidad visual naval clara, limpia y de alto impacto visual.

---

## 1. Arquitectura Visual de 4 Zonas (Cromática Centralizada en index.css)
Cada pantalla del sistema se estructura sin excepción en marcos visuales con acentos de color estandarizados:

| Zona | Clase CSS | Identidad Visual | Componentes y Función |
| :--- | :--- | :--- | :--- |
| **Zona 1: Contexto & Terminales** | `.alon-zone-context` | Borde izquierdo Azul Cielo (`sky-400`), fondo `slate-900/90` con tinte azulado. | Título del módulo, migas de pan (`Breadcrumbs`), selector de terminal de trabajo por puesto (Jorge Sentis, María José, Jefe de Obra) y botón de alta principal. |
| **Zona 2: Radar de KPIs y Alertas** | `.alon-zone-kpis` | Borde izquierdo Ámbar (`amber-400`), marco cálido de monitoreo en vivo. | Radar superior de tarjetas interactivas compactas. Clic en cualquier tarjeta filtra la planilla en 1 toque. |
| **Zona de Carga Rápida** | `.alon-zone-entry` | Borde izquierdo Índigo (`indigo-400`), fondo violeta oscuro. | Formularios integrados en pantalla para carga continua sin modales invasivos (ej. ingreso de lote diario). |
| **Zona 3: Barra de Control** | `.alon-zone-toolbar` | Borde izquierdo Cian (`cyan-400`), marco técnico estilo control deck. | Pestañas internas de navegación, selectores de filtrado en cascada, botones **Deshacer (`Ctrl+Z`) / Rehacer (`Ctrl+Y`)**, conmutador de vista (Filas vs. Fichas) y buscador rápido (`Ctrl+F`). |
| **Zona 4: Hoja de Cálculo Interactiva** | `.alon-zone-grid` | Borde superior Esmeralda (`emerald-400`), fondo oscuro de alta legibilidad. | Contenedor con foco interactivo (`tabIndex={0}`) que aloja la tabla editable. |
| **Cinta de Estado y Fórmulas** | `.alon-grid-ribbon` | Barra superior dentro de la Zona 4. | Coordenadas de celda activa con ícono GPS, barra de cálculos en vivo (Suma, Promedio, Recuento) y recordatorio de atajos. |
| **Cabecera Fija de Tabla** | `.alon-grid-thead` | Fondo oscuro `slate-950` con tipografía `slate-300`, fijación sticky (`top-0 z-20`). | Títulos de columna con indicador `✎` en aquellas que admiten edición rápida. |

---

## 2. Radar de KPIs y Alertas: Reglas de Diseño, Ergonomía y Color

Para maximizar el espacio útil de la pantalla y permitir al usuario encontrar datos en milisegundos:

### A. Jerarquía de Títulos
- **Título Principal del Radar:** `RADAR DE KPIs Y ALERTAS OPERATIVAS` con tipografía destacada y tamaño incrementado (+2 puntos respecto al texto base, tamaño 16px / `text-base font-black tracking-wider`).
- **Subtítulo Aclaratorio:** `• Clic en cualquier tarjeta para filtrar` presentado como comentario secundario, tenue e itálico (`text-slate-400 text-xs italic font-normal`), separado del título principal.

### B. Tamaño Compacto de las Casillas (Menor Altura, Más Filas Visibles)
- **Altura reducida:** Las tarjetas de KPI deben ser compactas (padding vertical contenido, ej. `p-3` o `py-2.5 px-3.5`).
- **Objetivo:** Ocupar la menor altura posible para que la Zona 4 (la planilla) gane espacio vertical, permitiendo ver más filas de datos en pantalla sin necesidad de hacer scroll.

### C. Tipografía Grande y de Alto Impacto
- El título/nombre de cada métrica dentro de la casilla debe tener un tamaño de letra grande (aprox. 15-16px, `font-black` / `font-extrabold`), con número de alto contraste al lado o debajo, de modo que el ojo ubique inmediatamente el valor buscado.

### D. Cromatismo Único por Tarjeta (No Repetir Colores en KPIs)
- **PROHIBIDO repetir colores entre tarjetas de KPI dentro de un mismo radar.**
- Cada casilla debe contar con su propia paleta y acento cromático distintivo para diferenciación instantánea:
  - *Tarjeta 1:* Ámbar / Dorado cálido (ej. Alertas / Faltas de OT)
  - *Tarjeta 2:* Cian / Turquesa (ej. Estados iniciales / Por emitir / En Varadero)
  - *Tarjeta 3:* Púrpura / Violeta (ej. Cotizaciones / Evaluaciones)
  - *Tarjeta 4:* Azul Eléctrico (ej. En proveedor / En muelle)
  - *Tarjeta 5:* Verde Esmeralda (ej. Autorizados / Completados)
  - *Tarjeta 6:* Rosa / Carmín / Fucsia (ej. Alertas críticas / Costos sin OT)

### E. Prohibición de la Palabra "Filtrar"
- **PROHIBIDO** colocar la palabra "Filtrar" o badges internos con el texto "Filtrar" dentro de las casillas.
- Toda la tarjeta es un botón interactivo completo. Cuando una tarjeta está activa filtrando la planilla, se indica mediante un badge sutil `ACTIVO` o `FILTRANDO` en la esquina, o un borde iluminado (`ring-2`).

---

## 3. Indicador de Celda Activa con Ícono GPS / Ubicación
- En la cinta superior de la planilla (`.alon-grid-ribbon`), la celda activa debe incluir un **ícono de ubicación GPS** (`Navigation` o `MapPin` de `lucide-react`) junto a la coordenada:
  ```jsx
  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-mono text-xs font-bold">
    <Navigation className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400/20" />
    <span>Fila {activeCell.rowIndex + 1} · {colDef.label}</span>
  </div>
  ```
- Esto garantiza que el operador sepa instantáneamente en qué posición de la cuadrícula se encuentra.

---

## 4. Comportamiento Universal de Fechas (Regla del Calendario)
- **Cero ingresos de fecha manuales a ciegas:**
  - En cualquier módulo, pantalla, subsección, formulario o celda de tabla donde se cargue o modifique una fecha, **debe abrirse automáticamente un calendario interactivo**.
- **En grillas (tabla principal):** El doble clic (o presionar `Enter`/`F2` sobre la celda activa) activa un `<input type="date" autoFocus />` e invoca inmediatamente `el.showPicker()` en el callback `ref` al montarse para desplegar el calendario visual nativo sin requerir un clic extra.
- Al confirmar la fecha (`Enter` o pérdida de foco), se valida el formato `YYYY-MM-DD`, se actualiza en base de datos y se añade a la pila de deshacer (`Ctrl+Z`).

---

## 5. Barra de Cálculos en Vivo en Selección Múltiple (Excel Status Bar)
- Al seleccionar un rango de celdas numéricas (mediante arrastre con mouse o con `Shift + Flechas`):
- La cinta de la grilla (`.alon-grid-ribbon`) calcula y proyecta automáticamente en vivo:
  - **Σ Suma:** Total acumulado de los valores numéricos seleccionados (ej. sumatoria de costos de mano de obra de varios contratistas, total de horas, etc.).
  - **x̄ Promedio:** Media de las celdas numéricas seleccionadas.
  - **# Recuento:** Cantidad de celdas con datos.
  - **Mín / Máx:** Valores extremos dentro del rango.
- Si la selección contiene una sola celda o celdas de texto, muestra la ayuda de atajos habitual.

---

## 6. Ergonomía de Teclado y Atajos de Hoja de Cálculo

Todo módulo con grilla de datos debe instanciar el hook `useSpreadsheetGrid`:

### A. Tecla `Esc` (Escape) Inteligente
- **En barra de búsqueda (`Ctrl+F`):** Si el usuario buscó un término y no hay coincidencias (o terminó su búsqueda), al presionar `Esc` **se borra todo el texto de búsqueda y los filtros activos**, restaurando de inmediato la grilla completa (idéntico al comportamiento de Excel y Google Sheets).
- **En celdas en edición:** `Esc` cancela la edición y restaura el valor original sin guardar.
- **En selección múltiple:** `Esc` limpia el rango y deja únicamente la celda activa.

### B. Atajos Universales
- **Flechas (`↑`, `↓`, `←`, `→`):** Desplazamiento natural entre celdas.
- **`Enter` o `F2`:** Activa la edición rápida inline (exactamente igual que el doble clic con mouse).
- **Tirador de esquina (Fill Handle `■`):** Pequeño cuadrado en la esquina inferior derecha de la celda activa para arrastrar y rellenar hacia abajo.
- **`Ctrl + D` (Fill Down):** Clona el valor de la celda superior hacia todas las filas seleccionadas hacia abajo.
- **`Ctrl + C` / `Ctrl + V`:** Copia y pega valores entre celdas o rangos.
- **`Ctrl + Z` / `Ctrl + Y`:** Deshacer y rehacer hasta 50 acciones por sesión y módulo (`sessionStorage`).
- **`Ctrl + F`:** Enfoca el buscador rápido del módulo sin activar la búsqueda nativa del navegador.

### C. Selector Naval Normalizado (`ShipWorkOrderPickerModal`)
- En columnas de Buque y Orden de Trabajo, la edición abre el selector en 2 pasos:
  1. Filtro y selección de Buque.
  2. Selección de Orden de Trabajo (OT) con soporte para dejar la **OT en blanco** (`work_order_id: null`) o imputar a `🏢 ASTILLERO — PAÑOL / STOCK GENERAL`.

---

## 7. Regla de Ancho de Pantalla (Cero Desborde Horizontal / Fit-to-Viewport)
- **PROHIBIDO generar scroll horizontal en la ventana ni en la tabla principal** en pantallas de escritorio estándar (1366px – 1920px).
- Toda tabla debe ajustarse al 100% del contenedor disponible (`w-full table-fixed` o paddings compactos `px-1.5 py-1.5`), empleando:
  - **Códigos cortos en selectores y estados:** Mostrar únicamente el código operativo corto en la celda (ej. `PEDIR`, `COTIZAR`, `RECIB.COMP.DIRECT`) y trasladar las explicaciones entre paréntesis al atributo `title` (leyenda emergente al acercar el mouse).
  - **Indicadores icónicos compactos:** Acciones de auditoría ocasional (como `Conciliado`) deben representarse con indicadores mínimos (ej. círculo violeta `🟣` de 16px con detalle al hacer clic/hover) en lugar de botones anchos con texto.
  - **Truncado inteligente (`truncate` + `title`):** Columnas de texto variable (Material, Buque/OT, Proveedor, Solicita) deben usar `truncate` con `max-w` controlado y mostrar el texto completo en `title` al pasar el cursor.
