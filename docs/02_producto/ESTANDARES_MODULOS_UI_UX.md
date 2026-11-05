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

---

## 8. Pila Universal de Reversibilidad 100% (`Ctrl+Z` / `Ctrl+Y`)
- **Principio Fundamental:** *"Ninguna acción destructiva, cambio de estado, descarte o edición puede ser de un solo sentido."*
- **Soporte Polimórfico en `useSpreadsheetGrid`:**
  - Toda mutación debe registrarse en la pila universal de deshacer mediante `grid.pushUndoAction`:
    1. **Edición de celdas o columnas:** `{ colKey, previousValues, newValuesMap, actionLabel }`.
    2. **Mutaciones multi-columna o en bloque:** `[{ rowId, colId, oldValue, newValue }]`.
    3. **Operaciones compuestas o asíncronas:** `{ undoFn: async () => ..., redoFn: async () => ..., actionLabel }`.
- **Reversión Simétrica:** Al presionar `Ctrl+Z`, la acción debe revertir de forma atómica tanto la base de datos (Supabase) como el estado visual de React, garantizando que el usuario pueda equivocarse y retroceder sin pérdida de información (ej. descartar alta de catálogo, fletes, conciliaciones masivas o duplicaciones de fila).

---

## 9. Zona 5: Barra de Estado Inferior con Estadísticas Vivas (Google Sheets / Excel)
- **Principio:** La barra inferior fija al pie de la pantalla es el centro de auditoría y cálculo instantáneo del operador.
- **Comportamiento Reactivo Dual:**
  - **Estado en Reposo (Sin selección):** Exhibe el resumen consolidado de la vista o filtro activo (`Cantidad de registros`, `Σ Cantidades`, `Σ Totales en moneda local y extranjera`).
  - **Estado Activo (Rango de Celdas o Filas Tildadas):** Conmuta instantáneamente a **Métricas de Selección Viva**:
    - **Celdas Numéricas:** Despliega píldoras de alto contraste con `Recuento: N`, `Σ SUMA: $...`, `Ø PROMEDIO: $...`, `MÍN: $...`, `MÁX: $...`.
    - **Celdas de Texto:** Despliega `Recuento: N celdas seleccionadas`.
    - **Filas Tildadas:** Muestra el subtotal específico de las filas seleccionadas y los botones de acción masiva correspondientes.

---

## 10. Celdas Compuestas con Edición In-Situ Multi-Campo y Protección de Alertas
- **Edición In-Situ Multi-Renglón:**
  - Cuando una celda alberga información principal y complementaria (ej. Nombre de Material + Observación / Aclaración técnica de obra), el doble clic (o `Enter`) **NO debe abrir un modal de pantalla completa**.
  - En su lugar, despliega una **tarjeta compacta in-situ de 2 renglones** dentro de la propia celda:
    - Renglón 1: Campo principal con autocompletado / datalist.
    - Renglón 2: Campo secundario (observaciones, notas técnicas).
    - Teclas de navegación: `Tab` salta entre campos, `Enter` guarda ambos valores en Supabase, `Esc` cancela.
- **Jerarquía y Convivencia de Alertas (Regla de No Ocultamiento):**
  - Las alertas de estado técnico emitidas por el sistema (ej. `🔴 SIN ALTA EN CATÁLOGO`, `⚠️ SIN OT`, `Falta Comprobante`) **jamás pueden ser pisadas ni ocultadas** por una observación escrita por el usuario.
  - La alerta debe renderizarse en su propio badge o indicador permanente, conviviendo limpiamente con el texto libre de observaciones en renglón independiente.

---

## 11. Búsqueda Universal en Dos Capas (Datos Operativos + Metadatos y Texto Digital de Adjuntos)
- **Principio:** Los operadores buscan registros usando palabras que recuerdan de distintas etapas (el comisionista del flete, el proveedor, una palabra de la cotización o el nombre del archivo).
- **Alcance del Buscador:**
  1. **Capa 1 (Datos de la Entidad y Logística):** Debe buscar en campos propios y relaciones clave (Material, Buque, OT, Solicitante, Proveedor, Factura, Remito y **Nombre del Transporte/Flete**).
  2. **Capa 2 (Archivos Adjuntos sin consumo de IA - Nivel 1 y Nivel 2):**
     - **Nivel 1 (Metadatos):** Busca en el nombre de archivo (`original_filename`), descripción cargada por el usuario y tipo de documento.
     - **Nivel 2 (Texto digital extraído de PDFs):** Al adjuntar un PDF digital, el cliente extrae el texto tipográfico del documento de forma nativa (0 tokens de IA, 0 costo) y lo almacena en `extracted_text`. El buscador principal cruza coincidencias contra este texto para localizar pedidos a partir de palabras internas de presupuestos o facturas.

---

## 12. Acciones al Pie de Tabla, Duplicación en 1-Clic y Copiar/Pegar Filas
- **Principio:** En listados extensos, el usuario no debe ser obligado a desplazarse hasta el tope superior para ingresar un nuevo registro ni a tipear manualmente datos recurrentes.
- **Estándar:**
  - **Fila de Inserción Rápida al Pie:** Al final de la tabla debe situarse el botón `[ ➕ Nuevo Registro / Pedido ]` que inserta una fila en blanco con fecha de hoy y enfoca automáticamente el campo principal para tipear sin tocar el mouse.
  - **Duplicación en 1-Clic (`<Copy />`):** En la columna de *Acciones* de cada fila, incluir el botón de clonar que crea una copia exacta del registro con fecha de hoy al final de la grilla (con soporte para revertir con `Ctrl+Z`).
  - **Copiar y Pegar Fila Completa (`Ctrl+C` / `Ctrl+V`):** El motor `useSpreadsheetGrid` debe permitir copiar una fila seleccionada y pegarla sobre una fila vacía o de destino rellenando todos sus atributos automáticamente.
  - **Acceso Dual al Pie:** Junto a la inserción rápida, proveer un enlace secundario para abrir el modal completo si se requiere carga masiva o parametrizada.

---

## 13. Auditoría y Consistencia de Costo Directo vs Stock (Condiciones Necesarias y Suficientes)
- **Principio:** *"Toda compra nace para Stock/Pañol hasta que se demuestre lo contrario. Solo compras vinculadas a un buque específico de cliente se imputan como costo directo."*
- **Reglas de Negocio Estándar:**
  1. **Destino por Defecto = PAÑOL (`charge_type: 'VIA_PANOL'`):** Toda nueva solicitud o fila rápida nace asignada a Pañol con Buque = `ASTILLERO / STOCK` y OT = `null`.
  2. **Desacople Buque / OT en Destino Directo:** Solo cuando el operador cambia explícitamente a `DIRECTO` se exige la vinculación obligatoria a un **Buque de obra específico** (distinto de Astillero). La Orden de Trabajo (OT) puede quedar temporalmente en blanco (`null`) si la OT de producción aún no fue abierta, sin bloquear la compra.
  3. **Condiciones Necesarias y Suficientes para Costo Directo:**
     Para que una compra se afecte directamente al costo contable de una obra debe cumplir estrictamente dos condiciones simultáneas: `destino == DIRECTO` y `estado == RECIB.COMP.DIRECT`.
- **Detección Automática de Incoherencias (Radar de KPIs):**
  - La tarjeta de radar `7. AUDITORÍA COSTO DIRECTO` fiscaliza y cuenta en tiempo real los siguientes errores contables:
    - **Infracción A:** Pedido con destino `DIRECTO` pero sin Buque de obra específico asignado (o buque = Astillero).
    - **Infracción B:** Pedido con Buque de obra asignado recibido como `RECIB.COMP.DIRECT` pero cuyo destino figura como `PAÑOL` u otro destino no directo.
    - **Infracción C:** Pedido con Buque de obra asignado y destino `DIRECTO`, pero recibido con estado `RECIBIDO` o `RECIBIDO 2` (omitiendo la afectación contable directa del gasto a la obra).
  - Al cliquear la tarjeta, la grilla se filtra instantáneamente mostrando únicamente las órdenes en infracción para su corrección en 1 toque.

---

## 14. Asistente Inteligente de Proveedores y Métricas de Frecuencia de Compra
- **Principio:** Al solicitar un material, el operador debe recibir sugerencias inmediatas basadas en el comportamiento histórico real de compras para optimizar precios y tiempos.
- **Acceso In-Situ:** Botón `<Lightbulb />` en la columna de *Acciones* de cada fila.
- **Métricas y Análisis en Tiempo Real:**
  1. **Capa 1 (Histórico Exacto y Frase Completa):** Busca en el historial coincidencias exactas o de frase completa del material (`normName === normTarget` o contención directa). Si existen compras exactas, se toman exclusivamente esas para el cálculo.
     - **Prevención de Falsos Positivos por Medidas:** Jamás debe utilizarse un operador disyuntivo (`OR / some()`) sobre palabras sueltas, ya que incluiría artículos no relacionados que solo comparten una medida accesoria (por ejemplo, sumar una compra de `TUERCA 1/2` dentro del historial de `BULON 1/2`).
  2. **Capa 2 (Coincidencia Estricta por Tokens - Solo si Capa 1 arroja 0 compras):** Si no hay compras exactas, se tokeniza exigiendo que el **sustantivo principal** (tipo de artículo: `BULON`, `ELECTRODO`, `DISCO`) coincida obligatoriamente y que al menos el 75-80% de los tokens estén presentes.
  3. **Capa 3 (Fallback por Rubro):** Si no existen compras históricas del material, ofrece selector desplegable de Rubro + filtro de texto libre para listar los proveedores del sector con su frecuencia de compra general.
  4. **Métricas Consistentes y Legibles:** Las tarjetas deben expresar el recuento exacto de compras sobre el total (`X de Y compras (Z% de frecuencia)`) y el tab superior reflejar la cantidad total de compras históricas del material.
  5. **Carga en 1-Clic (`[ ⚡ Cargar Pedido ]`):** Asigna de inmediato el proveedor sugerido, último precio registrado y fecha de hoy (si estaba vacía), registrando la acción en la pila de deshacer para reversión inmediata con `Ctrl+Z`.

---

## 15. Logística Local y Despacho de Mandados por WhatsApp Web
- **Principio:** La coordinación de retiros de materiales en comercios locales debe realizarse de forma fluida, clara y sin jerga técnica interna que confunda al mandadero.
- **Parámetros del Proveedor:**
  - `is_local_supplier` (Boolean): Identifica si el proveedor está ubicado en la ciudad para retiro presencial.
  - `address` (Text): Dirección física del local comercial (ej: *Juan B. Justo 1420*).
- **Circuito de Despacho (`MandadosModal`):**
  - **Accesos:** Botón `[ 🛵 Pedido de Mandado ]` en la barra superior (con contador de pedidos locales pendientes) y `[ 🛵 Mandar a Retirar ({N}) ]` en la barra flotante de selección masiva.
  - **Selector de Mandadero:** Se conecta a la nómina de `Personal`, destacando operarios con rubro `MANDADOS` o con celular registrado.
  - **Mensaje Universal Formateado para WhatsApp Web:**
    - Saludo directo personalizado: `"buenas {nombre}, podes pasar a retirar por favor:"`.
    - Agrupación por **Proveedor y Dirección**: `📍 {NOMBRE PROVEEDOR} ({DIRECCIÓN}):`.
    - Ítems limpios: ` - {cantidad} {unidad} {material}` (**sin número de pedido `#123` ni nombres de OT**).
    - Cierre imperativo en negrita: `*⚠️ Por favor retirar remito/factura.*`.
    - Botones para copiar al portapapeles y abrir chat directo de WhatsApp con `wa.me`.

---

## 16. Automatizaciones Periódicas y Alertas Normativas en Panel Administrador
- **Principio:** Las reglas de corte semanales de proveedores (ej. Regla P-02 Air Liquide de pedidos antes del martes a las 12:00 hs) no deben ocupar espacio en los radares de compras operativas diarias.
- **Estándar:**
  - Migrar su administración a `ComprasSettingsPanel.jsx` en el Panel de Configuración General.
  - Permitir la configuración del teléfono celular del Administrador (`admin_alert_phone`), día, hora de notificación (09:00 hs) y mensaje predeterminado.
  - Incluir botón interactivo de prueba para validar el canal de comunicación desatendido en WhatsApp.

---

## 17. Numeración Ordinal de Fila Integrada (#) y Regla de Espacio Horizontal Óptimo
- **Principio:** Para facilitar la comunicación rápida entre operarios en taller y oficina (*"Revisá la fila 20 que hay una duda"*), cada fila de una grilla debe exhibir su número ordinal visible (`1, 2, ..., 20`).
- **Arquitectura de Columna Única (Checkbox + # Apilados):**
  - **Prohibido:** Crear una columna separada exclusivamente para el `#` cuando el ancho de la pantalla sea ajustado, ya que le resta entre 35px y 45px a columnas críticas como Material o Proveedor.
  - **Estándar:** En la primera columna de ancho fijo compacto (`w-8`), ubicar el checkbox de selección arriba y el número de fila `#` debajo en un contenedor flex vertical centrado:
    ```jsx
    <td className="py-1 px-1 text-center w-8 select-none">
      <div className="flex flex-col items-center justify-center gap-0.5">
        <button type="button" onClick={() => toggleSelectRow(row.id)}>
          {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-cyan-400" /> : <Square className="w-3.5 h-3.5" />}
        </button>
        <span className={`font-mono text-[9px] font-bold ${isSelected ? 'text-cyan-300' : 'text-slate-500 group-hover:text-cyan-400'}`}>
          {rowIndex + 1}
        </span>
      </div>
    </td>
    ```
  - **En Cabecera (`thead`):** El checkbox maestro de selección general arriba y el símbolo `#` tenue abajo.
  - **Aplica:** Universalmente a todas las grillas del ERP AlonCar (Compras, Personal, Pañol, Obras).

---

## 18. Resaltado Visual Amarillo de Coincidencias en Filtros y Búsqueda Inteligente (Celdas, Fletes y PDFs)
- **Principio:** Cuando el usuario filtra una grilla mediante la búsqueda general, el sistema no solo debe mostrar las filas coincidentes, sino **señalizar exactamente a los ojos dónde y por qué** se produjo la coincidencia.
- **Estándar de Iluminación Cromática:**
  1. **Celdas de Texto (Material, Proveedor, Buque, Solicitante):**
     - La celda activa recibe un fondo sutil amarillo ámbar (`bg-amber-400/20 ring-1 ring-inset ring-amber-400/50`).
     - El fragmento de texto exacto coincidente se envuelve en `<mark className="bg-yellow-400/80 text-slate-950 font-bold px-0.5 rounded shadow-sm">`.
  2. **Acciones y Fletes:**
     - Si el texto coincide con datos del transporte (ej. `"TAS"`), el botón de flete se enciende en ámbar vibrante (`bg-amber-500/40 border-2 border-amber-400 ring-2 ring-amber-400/60 font-bold`) con tooltip informativo.
  3. **Documentos Adjuntos y PDFs Digitales:**
     - Si la coincidencia provino de metadatos o texto OCR/PDF digital de un archivo adjunto, el botón del clip de documentos se ilumina en amarillo brillante con animación de pulso (`animate-pulse`) y tooltip explícito: `📄 Coincidencia en adjunto PDF: [archivo.pdf]`.

---

## 19. Barra de Acciones Masivas: Selector Dinámico de Estado en Bloque con Ctrl+Z
- **Principio:** Reemplazar botones rígidos de acción única (ej. sólo `"Recibir"`) por controles multipropósito de **Cambio de Estado en Bloque**.
- **Estándar:**
  - Al seleccionar 1 o más filas, la barra inferior flotante proyecta un selector desplegable con los estados disponibles del flujo (`PEDIR`, `PEDIDO`, `RECIBIDO`, `RECIB.COMP.DIRECT`) junto al botón de ejecución `[ Aplicar a (N) ]`.
  - El botón adopta dinámicamente el color corporativo del estado destino (Esmeralda para Recibido, Ámbar para Directo, Azul para Pedido, Cian para Pedir).
  - **Validación de Reglas de Negocio:** Valida automáticamente coherencia (ej. destino Directo vs Pañol) antes de impactar la base de datos.
  - **Reversión Obligatoria con Ctrl+Z:** Todo cambio en bloque registra el estado anterior de cada fila seleccionada en `pushUndoAction` para poder deshacer todo el bloque de una sola vez.

---

## 20. Inserción Contextual de Filas entre Filas Existentes
- **Principio:** Cuando se cargan pedidos y posteriormente se recuerda un ítem faltante, el operador debe poder insertarlo contiguo al pedido original para mantener coherencia visual y trazabilidad.
- **Estándar:**
  - Botón `➕` en la columna de *Acciones* de cada fila (`handleInsertOrderContext(po, rowIndex, 'below')`).
  - **Herencia Inteligente de Cabecera:** La nueva fila hereda automáticamente fecha, quincena, solicitante, destino (`DIRECTO/PAÑOL`), buque, OT y proveedor de la fila vecina.
  - **Foco Automático:** El cursor se posiciona inmediatamente en el campo de material con modo de edición activo.
  - **Garantía de Posición Relativa:** Interpola la marca de tiempo de creación entre la fila de referencia y su contigua para que permanezca en su posición exacta tras recargas.
  - **Soporte de Ctrl+Z:** Permite eliminar la fila creada al presionar `Ctrl+Z`.

---

## 21. Regla Canónica de Comportamiento en Celdas de Buque, Contratista y Botón Lápiz

Para garantizar una experiencia predecible, ergonómica y sin bloqueos de interfaz en todas las planillas operativas (Pañol, Compras, Horas y Terceros):

### A. Doble Clic en Barco / Buque (`ship_id`)
- **Objetivo:** Modificar el destino o buque de la fila y seleccionar la Orden de Trabajo correspondiente.
- **Comportamiento Estándar:**
  - Abre el modal enfocado `ShipWorkOrderPickerModal`.
  - Filtra y prioriza en la parte superior las OTs habilitadas en ese barco para el contratista u operario asignado en la fila.
  - **Permisión de OT en Blanco:** Si no hay ninguna OT vinculada o aún no fue abierta, mantiene marcada la opción *"⚠️ Dejar OT en blanco"* y permite guardar el buque inmediatamente, imputando `work_order_id = null` y sumando `+1` al KPI de alerta *"⚠️ Falta Cargar OT"*.

### B. Doble Clic en Operario o Contratista (`contractor_name` / `requested_by_name`)
- **Objetivo:** Asignar o sustituir la persona o contratista receptor del material o servicio.
- **Comportamiento Estándar (ContractorPickerModal):**
  - **Regla Mandatoria con OT en Blanco (`!work_order_id`):** Debe desplegar el **PADRÓN COMPLETO** de operarios propios autorizados (Astillero) y contratistas externos habilitados para el módulo. **Prohibido bloquear o vaciar la lista.**
  - **Regla Mandatoria con OT Asignada (`work_order_id`):** Presenta prioritariamente los operarios y contratistas vinculados a los ítems de esa OT/buque.
  - **Fallback de Seguridad Universal:** Si el filtrado por OT o buque arrojara 0 coincidencias, el motor aplica fallback automático al padrón completo para que el usuario **NUNCA** quede atrapado en una celda bloqueada o vacía.
  - **Preservación del Valor Actual:** Si el contratista cargado en la fila no figura en la lista filtrada, se incorpora automáticamente con el badge *(Actual en fila)* para evitar pérdida de datos o borrado accidental.

### C. Clic en el Botón Lápiz (✏️ - Edición de Fila Completa)
- **Objetivo:** Abrir la visión integral y auditoría profunda de toda la información cargada en la fila.
- **Comportamiento Estándar:**
  - Despliega el modal completo de la entidad (`MultiWithdrawalModal` en Pañol, `OrderFormModal` en Compras, `WorkItemModal` en Obras).
  - Permite revisar y modificar en un solo panel todos los datos: buque, OT, contratista, fecha, renglones de materiales, cantidades, centro de costo, observaciones técnicas y documentos de respaldo.
