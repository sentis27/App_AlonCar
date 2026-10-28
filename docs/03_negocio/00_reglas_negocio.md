# ⚓ Reglas de Negocio Transversales

Este documento consolida las reglas operativas y de negocio que aplican de forma global a todos los módulos del sistema (Activos, Recursos, Operaciones, Logística, Comercial y Analítica).

## 1. Gestión de Trabajos Internos y de Infraestructura

Las labores propias de mantenimiento del astillero (ej. mantenimiento de predio, reparación de equipos, operación de varadero) tienen un impacto directo en el consumo de recursos (pañol, horas de personal) pero no se facturan a un cliente externo. Para mantener la contabilidad aislada y permitir la analítica de costos, aplican las siguientes reglas:

### 1.1. El Cliente Interno "ASTILLERO"
Todos los trabajos, proyectos o consumos propios deben imputarse obligatoriamente a un cliente y barco ficticio denominado **"ASTILLERO"**. 
- Esta separación estructural asegura que los costos operativos internos nunca se mezclen accidentalmente en anexos de facturación comercial.
- Aplica para todo: desde OTs de mantenimiento continuo hasta OTs de proyectos internos (ej. "Construcción Galpón Nuevo") o trabajos de garantías cruzadas.

### 1.2. Agrupación Analítica Dinámica (Sin Nomenclatura Manual)
El sistema **no** requiere que el usuario agregue el año o período manualmente al nombre de la OT (ej. **NO** es necesario escribir "MANTENIMIENTO PREDIO - 2026").
- **Nombre estándar:** La OT se nombra de manera simple y constante a lo largo del tiempo (ej. "MANTENIMIENTO PREDIO").
- **Corte analítico automático:** Al consultar el *Comparador de Obras* o los reportes del módulo de Analítica, el sistema agrupa y separa los costos por año automáticamente leyendo la fecha real de la imputación (la fecha en que se cargaron las horas o los materiales). Esto permite comparar de forma nativa el costo anual de mantenimiento entre 2025, 2026 y 2027 sin ensuciar la base de datos con decenas de OTs duplicadas por calendario.

## 2. Comunicación Interna en Órdenes de Trabajo (Botón "Ampliar")
En la ficha detallada de cada Orden de Trabajo (M3), se incluye un botón interactivo **"Ampliar"**:
- **Función:** Permite a cualquier supervisor u operario solicitar una aclaración formal de texto libre al Jefe de Obra responsable sobre tareas específicas o alcance no especificado.
- **Flujo:** La consulta genera una notificación interna dirigida al Jefe de Obra y queda registrada como un hilo de comunicación adjunto a la OT para trazabilidad futura.

---

## 3. Reglas de Pañol y Retiros de Materiales (M4 Logística)

### 3.1. Separación de Roles: Pañolero vs. Administración
- El Pañolero (responsable de la entrega física de materiales) **no visualiza** el campo `Centro de Costo` ni montos monetarios (son datos administrativos/contables).
- **Datos visibles para el Pañolero:**
  1. **Stock Disponible Real** del material seleccionado.
  2. **Leyenda `"Material sin control de stock"`** si el ítem no posee seguimiento de inventario.
  3. **Vitalidad del Material:** Indicador calculado en días/semanas basado en los retiros promedio de las últimas semanas versus el stock disponible.
  4. **Selección de Operario que Retira:** Selector activo (dropdown) con autocomplete para elegir la persona real que retira el material.
  5. **Fecha Editable:** Valor por defecto = `Hoy`, pero permite modificación manual para registros retrospectivos.

### 3.2. Botón Directo "Solicitar Compra" desde Pañol
Si el stock es insuficiente o crítico, el pañolero cuenta con el botón **"Solicitar Compra"**:
- Crea automáticamente una fila en `purchase_orders` (M4b).
- Completa por defecto: `requested_by` = Pañolero, `ship_id` = `ASTILLERO`, `work_order_id` = `STOCK`.
- Deja el campo `quantity` y `supplier_id` abiertos para que el Encargado de Compras complete la gestión.

### 3.3. Deducción Automática de Unidades por Nomenclatura
El campo manual de unidades no es necesario en el formulario; el sistema deduce la unidad automáticamente según el nombre estandarizado del material:
- Contiene `"x Metro"` $\rightarrow$ Unidad: **Metros** (ej. planchuelas, caños, ángulos, macizos).
- Contiene `"x Kilo"` $\rightarrow$ Unidad: **Kilos** (ej. bronce).
- Contiene `"Lado x Lado"` $\rightarrow$ Unidad: **Dimensiones / Placa**.
- Sin sufijo de medida $\rightarrow$ Unidad: **Unitario** (piezas, repuestos).

### 3.4. Carga Múltiple de Materiales por Remito de Pañol
El formulario de Pañol permite seleccionar la OT una sola vez y agregar una grilla con **múltiples materiales** en la misma transacción, generando un único remito interno de salida. Al seleccionar la OT, la interfaz muestra en pantalla la **descripción completa del trabajo** para ayudar al pañolero a verificar la OT correcta.

---

## 4. Flujo de Compras y Automatización de Pedidos a Proveedores (M4b Compras)

### 4.1. Visibilidad y Doble Modo de Interfaz
- **Modo Solicitud Simple (Personal de Pañol / Obra):** Formulario y grilla operativos. Para facilitar el cotejo en el portón al recibir el camión con el remito físico, el pañolero **visualiza la columna PROVEEDOR** y dispone de filtro por proveedor. El selector de **ESTADO ES EDITABLE** con las opciones de recepción física: `PEDIR`, `RECIBIDO` (ingreso a pañol), `RECIB.COMP.DIRECT` (entrega directa al buque), `PEDIDO INCOMPLETO` (recepción parcial), `RECIBIDO 2` (material provisto por armador), `CANCELADOS` y `SE COMPRA?`. Se ocultan datos comerciales sensibles como cotizaciones del sistema y comparadores económicos.
- **Modo Gestión Completa (Encargado de Compras y Supervisión):** Despliega la totalidad de columnas analíticas, proveedores, cotizaciones comparadas, fechas estimadas de entrega, botones de WhatsApp Web y acciones de recepción masiva.
- **KPIs Superiores Interactivos (Filtros en 1 Clic por Grupos y Subgrupos):** Seis tarjetas conmutables con sub-botones independientes: 🟡 *Por Emitir* (`PEDIR` / `SOLICITUD`), 🟣 *Cotizaciones* (`COTIZAR`, `COTIZA.SOLICITUD`, `COTIZACION`, `COTIZA.APROBADA`), 🔵 *En Proveedor* (`PEDIDO` y `PEDIDO INCOMPLETO`), ❓ *SE COMPRA?*, 🟢 *Recibidos* (Pañol / Obra / Facturados) y 🚨 *Gases P-02*.

### 4.2. Edición Rápida en Celda por Doble Clic (Estilo Excel / Sheets)
Para evitar la lentitud de abrir modales en tareas rutinarias con muchos datos:
- **$/U Proveedor:** Doble clic $\rightarrow$ celda se convierte en input numérico in-situ $\rightarrow$ `Enter` o `Blur` guarda inmediatamente en Supabase y actualiza totales.
- **Proveedor:** Doble clic $\rightarrow$ menú select desplegable de proveedores $\rightarrow$ selección guarda al instante.
- **Cantidad:** Doble clic $\rightarrow$ input numérico $\rightarrow$ `Enter` guarda.
- **Solicita:** Doble clic $\rightarrow$ input de texto $\rightarrow$ `Enter` guarda.
- **Urgencia:** Un solo clic conmuta cíclicamente: `Sin Apuro` $\rightarrow$ `Urgente` $\rightarrow$ `Próxima Salida`.

### 4.3. Carga de Pedidos Multi-Material
- **Cabecera Compartida:** Selección única de Buque, Orden de Trabajo (OT con descripción técnica completa visible), Fecha de Pedido (doble clic abre calendario nativo `showPicker()`), Solicitante (por defecto "PAÑOL" u operario con permiso de retiro) y Nivel de Urgencia.
- **Líneas Dinámicas:** Botón `[ ➕ Agregar Material ]` para cargar múltiples ítems bajo la misma OT en un solo envío.

### 4.4. Deducción Automática y Forzada de la Unidad de Medida
Inferencia estricta por texto en compras (`lado x lado` $\rightarrow$ `m2`, `x metro` $\rightarrow$ `metro lineal`, `x kg` $\rightarrow$ `kg`, `x m3` $\rightarrow$ `m3`, resto $\rightarrow$ `unidad`) con edición manual bloqueada en la orden para garantizar consistencia con stock.
> [!IMPORTANT]
> **Regla Futura para el Módulo Pañol:** En la gestión de Pañol y alta de nuevos insumos, la unidad de medida se deducirá automáticamente pero será editable por el supervisor para subsanar errores de origen, con **alerta obligatoria** si el material posee control de stock activo.

### 4.5. Circuito de Pedido Incompleto (Split & Reclamo)
Cuando el pañolero recibe una cantidad inferior a la solicitada (ej. llegan 18 de 20):
1. Selecciona el estado **`PEDIDO INCOMPLETO`** en la fila.
2. Se abre el modal de recepción parcial donde ingresa las unidades recibidas (`18`), el sistema calcula el faltante (`2`), se exige el **Nº de Remito** y se permite adjuntar fotos de la entrega y el remito.
3. **Bifurcación Limpia (Split):**
   - El registro original pasa a cantidad `18` en estado `RECIBIDO` (o `RECIB.COMP.DIRECT`), sumando stock al pañol o imputando costo a la obra.
   - Se crea automáticamente una orden hija por las `2` unidades con estado `PEDIDO INCOMPLETO` y referencia al remito.
4. **Reclamo en Compras:** Al presionar pedir agrupado sobre órdenes incompletas, se redacta automáticamente el reclamo oficial para WhatsApp solicitando fecha de despacho del saldo faltante.

### 4.6. Alerta y Notificación Gerencial "SE COMPRA?"
Al marcar un ítem en duda técnica/financiera con el estado `SE COMPRA?`:
- El sistema alerta a los destinatarios configurados en Administración: **Hugo Sentis** (Gerente General), **Martín Sentis** (Gerente de Operaciones) y al **Jefe de Obra** asignado a la OT.
- Permite disparar la consulta por WhatsApp con los datos del material, buque y costo estimado para autorizar o desestimar la compra.

### 4.7. Configuración de Compradores y Despacho WhatsApp Web
- **Dos Compradores Oficiales (Configurables desde `/admin`):** Teléfonos móviles de Jorge Sentis y Andrés gestionados centralizadamente en `system_settings`.
- **Normalización Argentina:** Celulares convertidos automáticamente a formato internacional `549...`.
- **Fallback para Líneas Fijas / 0810 (Air Liquide):** Detección automática y renderizado de botón de llamada telefónica directa (`tel:08102225272`) exhibiendo el Nº de Cliente (`2234867`).

### 4.8. Conciliación de Facturas ("Línea Morada")
- Cada compra cuenta con un estado de conciliación (`is_reconciled`).
- Mediante la acción *"✅ Conciliar hasta aquí"* por proveedor, el supervisor ingresa el número de factura/remito y marca en bloque esa compra y todas las anteriores pendientes de ese proveedor con línea divisoria morada y sello de auditoría.

### 4.9. Proveedores: Doble Vista y Multirubro
- **Doble Vista:** Tabla con encabezado inmovilizado (`sticky top-0 z-20 bg-slate-950`) vs Fichas ejecutivas (Cards).
- **KPIs de Proveedores:** Filtros rápidos en 1 clic para detectar proveedores sin teléfono, sin email, sin rubro asignado o proveedores de gases bajo Regla P-02.
- **Multirubro (`trades TEXT[]`):** Admite asociar múltiples especialidades a un mismo proveedor mediante selector interactivo con etiquetas (chips) y creación in-situ de nuevos rubros.

---

## 5. Estándar de Idioma de la Plataforma (UI / UX)
Toda la interfaz de usuario (UI), notificaciones, alertas, mensajes del asistente de IA y exportaciones (PDF, Excel) deben estar estricta y obligatoriamente en **ESPAÑOL**. 
- **Cero tolerancia al Spanglish:** Términos como "Dashboard", "Work Order", "Submit", "Loading" deben traducirse a sus equivalentes precisos en español (ej. Panel de Control, Orden de Trabajo, Enviar, Cargando). 
- El personal del astillero, desde pañol hasta gerencia, requiere una herramienta nativa en su idioma que no genere fricción cognitiva.

---

## 6. Gestor Documental de Compras (M4c)

### 6.1. Adjunto Inteligente y Clasificación Documental
El operario de compras no necesita organizar carpetas externas ni copiar links. Desde la grilla o las tarjetas dispone de un botón para adjuntar o administrar comprobantes con clasificación tipificada:
1. `FACTURA`: Factura fiscal comercial vinculada al pedido.
2. `REMITO`: Remito oficial de entrega del transportista o pañol.
3. `COTIZACION_MATERIAL`: Presupuesto de insumos (acceso público general en compras).
4. `COTIZACION_MANO_OBRA`: Presupuesto de mano de obra y subcontratos (`is_confidential_labor = true`, visibilidad restringida exclusivamente a Supervisión y Gerencia).
5. `FICHA_TECNICA`: Manuales o fichas técnicas de especificación naval.
6. `IMAGEN_MUESTRA`: Fotografías de piezas dañadas, croquis o muestras para cotización.

### 6.2. Ciclo de Vida Documental Completo (`DocActionModal`)
Cada archivo cuenta con 4 acciones operativas directas:
- **👁️ Ver / Descargar:** Acceso seguro al binario en Supabase Storage.
- **✏️ Modificar Metadatos:** Edición de descripción, tipo de documento y confidencialidad.
- **🔄 Reemplazar Archivo:** Sustitución del archivo físico en el bucket conservando el registro relacional.
- **🗑️ Eliminar:** Borrado sincronizado en Storage y en la tabla `purchase_documents`.

### 6.3. Nomenclatura y Almacenamiento Automático
- **Renombrado Automático:** El sistema renombra el archivo subido sin intervención humana utilizando la fórmula: `{descripcion}-{proveedor}.{extension}`.
- **Estructura de Carpetas:** El archivo se almacena en Supabase Storage: `cotizaciones/{año}/{rubro}/{archivo_normalizado}`. El año se toma automáticamente y el rubro hereda del módulo de materiales.

---

## 7. Mano de Obra y Registro de Horas (M3 Operaciones)

### 7.1. Jornada Laboral del Personal Propio (Astillero)
- **Jornada Estándar Diaria:** La jornada regular y obligatoria para el personal propio del astillero es de **9 horas diarias** (lunes a viernes).
- **Excepción de Feriados (8 horas):** Durante jornadas feriadas, la jornada estándar es de **8 horas**. Esta condición se explicita anotando `"Feriado"` en el campo de **Rubro** del registro diario. El sistema interpreta automáticamente esta indicación y ajusta la cuota de cumplimiento de la jornada a 8 horas para ese operario y día.
- **Semáforo de Cumplimiento en Auditoría Diaria:**
  - 🟢 **Completa:** Horas normales igualan la cuota requerida (9 hs en días regulares o 8 hs en feriados).
  - 🔵 **Completa con Extras:** Horas normales completas sumadas a Horas Extras (al 50% y/o al 100%).
  - 🟡 **Incompleta:** Horas normales registradas mayores a 0 pero inferiores a la cuota obligatoria (alerta visual con horas faltantes).
  - 🔴 **Sin Carga:** 0 horas imputadas en el día laborable, con atajo de carga rápida de jornada en un clic.

### 7.2. Clasificación Estricta del Personal en Tres Tipos
El personal y prestadores se clasifican formalmente en tres categorías operativas:
1. **`Astillero`:** Personal en nómina propia. Sujeto a regla obligatoria de jornada diaria (9h / 8h feriado).
2. **`Taller`:** Talleres externos y empresas proveedoras de servicios industriales. No están sujetos a cuota fija diaria; registran horas a destajo o según avance de tarea.
3. **`Contratista`:** Personal tercerizado o contratistas independientes. No están sujetos a cuota fija diaria.

### 7.3. Centro de Costo de Mano de Obra (100% "CLIENTE")
- Para todas las horas operativas de producción registradas en buques y OTs, el Centro de Costo es invariablemente **`CLIENTE`**.
- Con el propósito de blindar el proceso frente a errores humanos, este valor se encuentra preestablecido de manera fija en el sistema y no se expone como campo editable en las interfaces de carga.

### 7.4. Corrección e Intervención In-Situ Transversal
- Toda vista operativa (Carga de Cuadrilla, Control Diario de Nómina y Sábana Quincenal) debe permitir la edición directa (✏️), adición in-situ y corrección de horas sin obligar a cambiar de contexto ni navegar a pantallas complejas.
- En la Sábana Quincenal, el clic sobre un operario o sobre una celda numérica de jornada abre de forma inmediata la edición y auditoría detallada de la imputación correspondiente.

### 7.5. Selección Desacoplada de Barco y OT con Descripción Asistida Obligatoria
- **Selectores Desacoplados y en Cascada:** En todas las interfaces y ventanas modales donde se asignen o modifiquen horas (Carga de Cuadrilla, Modal de Imputación Rápida en Control Diario, Modal de Edición Completa desde Control Diario o Sábana Quincenal), el **Barco / Embarcación** y la **Orden de Trabajo (OT)** se seleccionan en dos campos independientes. Al elegir un barco, el selector de OTs filtra automáticamente solo las tareas activas de dicha embarcación.
- **Asistencia Visual con Alcance de la OT:** Siempre que se seleccione una OT, el sistema debe exhibir de forma destacada la descripción y el alcance del trabajo (`work_orders.description`), brindando asistencia inmediata al operador para verificar que la imputación corresponda con la labor real ejecutada a bordo.

### 7.6. Sistema de Revisión, Auditoría y Aprobación de Imputaciones (S, R, RR, RRR)
- **Ciclo de Estados de Aprobación:**
  - `''` *(Vacío / Sin revisar)*: Estado inicial tras la imputación de horas.
  - `'S'` *(Aprobado)*: Imputación regular validada directamente por supervisión.
  - `'R'` *(🔴 Requiere Revisión - Alerta Operario)*: Imputación observada por el supervisor con inconsistencias (ej. horas excesivas, rubro erróneo o discrepancia de OT). Dispara la alerta roja para que el operario intervenga y subsane el error.
  - `'RR'` *(🟡 Horas Corregidas - Alerta Supervisor)*: Imputación corregida por el operario. Dispara la alerta amarilla para que el supervisor verifique la corrección y dé el visto bueno final.
  - `'RRR'` *(🔵 Aprobación Definitiva)*: Visto bueno final del supervisor tras auditar la corrección `RR`, cerrando el ciclo de revisión.
- **Auditoría Independiente por Imputación (OT):** Cuando una jornada diaria agrupa múltiples OTs para un mismo operario, cada línea es auditable y calificable de manera individual. El supervisor puede observar una OT (`R`) mientras aprueba otra (`S`).
- **Separación Estricta de Métricas:** Los contadores y bandejas de `R` y `RR` operan de forma segregada. La transición de `R` a `RR` descuenta de la bandeja roja y suma a la amarilla, garantizando una asignación de responsabilidades inequívoca.
- **Acciones Masivas en Lote y Señalización Visual:** Soporte para selección múltiple (checkboxes individuales y selector maestro diario) con barra flotante de cambio de estado en 1 clic. Señalización en Sábana Quincenal mediante aros y puntos de color (`🔴` para R, `🟡` para RR).

### 7.7. Tarifario Quincenal, Categorías Oficiales y Análisis de Costos de Mano de Obra
- **Periodicidad e Histórico Inmutable por Quincena:**
  - El sistema mantiene un registro histórico estricto de tarifas por quincena (`YYYY-MM-1Q` y `YYYY-MM-2Q`), ordenadas cronológicamente por calendario (año, mes y primera quincena `1Q` antes de segunda quincena `2Q`).
  - La actualización de nuevos valores sindicales o tarifas de contratistas correspondientes a períodos vigentes o futuros **nunca altera de forma retroactiva** las quincenas ya cerradas, órdenes de trabajo históricas o reportes analíticos pasados.
- **Cotización US$ Quincenal Congelada (Solo Lectura en Planillas):**
  - El tipo de cambio oficial del período se exhibe de forma fija/congelada en las planillas como valor de referencia para conversiones.
  - Su edición queda estrictamente restringida al Administrador Central desde el Panel Maestro, evitando modificaciones accidentales durante la carga de jornales.
- **Las 5 Categorías Sindicales Oficiales de Astillero y Código de Colores:**
  - Las 5 categorías oficiales base para el personal propio son:
    1. `AYUDANTE`: Fondo Celeste / Cyan flúor (`#00E5FF`), texto oscuro.
    2. `OFICIAL`: Fondo Verde flúor (`#00E676`), texto oscuro.
    3. `1/2 OFICIAL`: Fondo Magenta / Fucsia (`#FF00D4`), texto blanco.
    4. `APRENDIZ`: Fondo Amarillo flúor (`#FFEA00`), texto oscuro.
    5. `OFICIAL BLACK`: Fondo Negro (`#000000`), texto blanco.
  - *Regla de Depuración:* **MANDADOS** no constituye una categoría salarial; es un rubro operativo. Su valor se imputa bajo la categoría contractual correspondiente del operario.
  - *Consistencia Visual:* Esta paleta de colores se replica uniformemente en la columna *Categoría* del Padrón de Personal, facilitando la identificación visual inmediata.
- **Sincronización Automática al Padrón de Personal:**
  - La actualización de valores en el Tarifario Quincenal sincroniza inmediatamente y sin consulta adicional las tarifas de los operarios vinculados en la tabla de nómina, eliminando margen de error u omisión humana.
- **Interfaz de Carga Unificada por Centro Administrativo:**
  - Si se selecciona **`ASTILLERO`**: Se despliegan las 5 categorías oficiales para la carga del valor hora AR$ y cálculo automático en US$.
  - Si se selecciona **`CONTRATISTA`**: Se despliega la nómina de contratistas.
    - Si el contratista ofrece ayudante (ej. *RAMON ARANDA*, *AVALOS*, *TOBARES*), se habilita la carga dual de Oficial y Ayudante.
    - Si el contratista factura con tarifa única plana (ej. *DAMIAN*, *PINTOR JUAREZ*, *TANO*, *CARLOS VIDONDO*, *CHACANO*), el campo de `Ayudante` se bloquea con candado 🔒 y advertencia explicativa, permitiendo únicamente editar `Oficial`.
  - **Exclusión de `TALLERES`:** No utilizan tarifa horaria fija; operan por cotización y remito (circuito `RPF/RMO ──► FCR`) gestionados técnicamente con la *Oficina Técnica & Subcontratos*.
- **Desvinculación de Nombres Hardcodeados (Roles Organizacionales Dinámicos):**
  - Todas las referencias a puestos y responsables (ej. *Responsable de Liquidación de Sueldos*, *Dirección Operativa*, *Oficina Técnica & Subcontratos*) se resuelven dinámicamente mediante la tabla `public.organization_roles`. Esto elimina la deuda técnica ante futuros recambios de personal sin alterar el código ni la base de datos.
- **Dashboard de Análisis de Variación Quincenal & FX:**
  - Módulo analítico para Gerencia, Contaduría y Liquidación que permite contrastar la evolución salarial y cambiaria en ventanas de tiempo gerenciales.
  - Calcula automáticamente:
    1. Variación en porcentaje (%) y pesos ($) de la mano de obra.
    2. Variación en porcentaje (%) y dólares (US$) de la mano de obra.
    3. Brecha paritaria vs ritmo de devaluación del tipo de cambio oficial.

### 7.8. Módulo Gerencial de Análisis de Variación: Reglas de Cálculo, Semáforo de Negociación y Ficha por Contratista
Para evitar la sobrecarga cognitiva de tablas masivas y suministrar argumentos objetivos de negociación a la Dirección Operativa y Gerencia General, el sistema implementa cuatro pilares analíticos automatizados:

1. **Pilar A: Ventanas Temporales Ejecutivas (Presets Dinámicos):**
   - El sistema calcula los períodos de apertura (base) y cierre (actual) sin requerir selección manual punto a punto:
     - `1 Mes (2 Quincenas)`: Penúltima quincena registrada vs. última quincena vigente.
     - `Trimestre (6 Quincenas)`: 3 meses calendario retrospectivos.
     - `Semestre (12 Quincenas)`: 6 meses calendario retrospectivos.
     - `Año Completo / YTD`: Desde la primera quincena del año en curso hasta la fecha.
     - `Rango Libre`: Auditoría libre punto a punto entre cualquier par de quincenas históricas.

2. **Pilar B: Fórmulas Matemáticas de Comparación y Brecha:**
   - **Variación Nominal en Pesos (AR$):**
     $$\Delta \text{AR\%} = \frac{\text{Tarifa Actual AR\$} - \text{Tarifa Base AR\$}}{\text{Tarifa Base AR\$}} \times 100$$
   - **Variación Real en Moneda Fuerte (US$ - Impacto en Presupuesto de Obra):**
     $$\Delta \text{US\%} = \frac{\text{Tarifa Actual US\$} - \text{Tarifa Base US\$}}{\text{Tarifa Base US\$}} \times 100$$
     *(Donde $\text{Tarifa US\$} = \text{Tarifa AR\$} / \text{Cotización Dólar Oficial de la Quincena}$)*.
   - **Brecha Paritaria contra el Ancla Testigo (Astillero Oficial):**
     $$\text{Brecha vs Astillero} = \Delta \text{AR\%}_{\text{Contratista}} - \Delta \text{AR\%}_{\text{Oficial Astillero}}$$
     Representa cuántos puntos porcentuales subió el contratista por encima (o por debajo) del personal en nómina propia.
   - **Dispersión Inter-Pares por Rubro:**
     $$\text{Media Rubro} = \frac{\sum \text{Tarifa Contratistas del mismo Rubro}}{N_{\text{Contratistas del Rubro}}}$$
     Permite comparar si un contratista específico está desfasado respecto a sus pares de oficio (ej. Calderería, Pintura, Tornería).

3. **Pilar C: Criterios y Matriz de Decisión del Semáforo de Negociación:**
   Cada prestador se clasifica automáticamente según el siguiente árbol de decisión:
   - 🔴 **ALERTA ROJA (Disparo de Costo / Desvío Excesivo):**
     - Si $\text{Brecha vs Astillero} > +5.0\%$ (el contratista subió más de 5 puntos por encima del gremio oficial).
     - O si $\Delta \text{US\%} > +10.0\%$ (su hora en dólares aumentó más de un 10%, encareciendo los presupuestos navales en moneda dura).
     - *Acción sugerida:* Llamado de atención a Dirección Operativa para renegociar o topear la tarifa horaria.
   - 🟡 **AMARILLO (En Parámetro / Acompaña Paritarias):**
     - Si $-2.0\% \le \text{Brecha vs Astillero} \le +5.0\%$.
     - Y $-5.0\% \le \Delta \text{US\%} \le +10.0\%$.
     - *Acción sugerida:* Tarifa en equilibrio razonable con la inflación y los acuerdos sindicales.
   - 🟢 **VERDE (Favorable / Licuado):**
     - Si $\text{Brecha vs Astillero} < -2.0\%$ (aumentó significativamente menos que el sindicato de Astillero).
     - O si $\Delta \text{US\%} < 0.0\%$ (el valor en dólares bajó producto de la devaluación cambiaria).
     - *Acción sugerida:* Costo favorable y holgura de margen para el astillero.

4. **Pilar D: Gráfico Dinámico de Fluctuación Temporal vs. 3 Anclas Determinísticas:**
   - **Las 3 Anclas Determinísticas de Costo de Alon Car:**
     1. 💵 **Dólar Oficial FX:** Tipo de cambio de referencia fijado para el período.
     2. ⚓ **Paritaria Sindical Astillero:** Pauta de aumento salarial del personal propio (categoría Oficial de planta como ancla testigo).
     3. 📊 **Inflación Mensual Oficial (%):** Reportada mensualmente por el Administrador en el Dashboard central. **Regla dura:** El porcentaje de inflación reportado para el mes rige y se hereda automáticamente para la 1ª y 2ª quincena (1Q y 2Q) de dicho mes en todas las liquidaciones y curvas del sistema.
   - **Lienzo Gráfico Multivariable:**
     Superpone la curva del **Contratista / Personal evaluado** (o promedio general) frente a las 3 anclas a lo largo del tiempo (Eje X: Quincenas), permitiendo conmutar entre:
     - **Variación Acumulada (%):** Normalizado desde la quincena base (0%) para identificar de un vistazo si la tarifa le ganó o perdió a la inflación, al gremio o al dólar.
     - **Valores Nominales (AR$/h):** Comparativa directa de tarifas horarias en moneda corriente.
   - **Diagnóstico Ejecutivo Automatizado:**
     Genera la conclusión gerencial resumiendo si el contratista se encuentra en zona de desvío presupuestario ($\text{Brecha} > +5\%$), en parámetro operativo o en zona de conveniencia/licuación cambiaria.




---

### 7.9 Dashboard del Administrador & Matriz Dinámica de Puestos y Seguridad (Gobierno de Accesos)

El **Dashboard del Administrador** (`/admin`) centraliza la gobernanza operativa, los parámetros macroeconómicos y el control de accesos de la organización Alon Car:

1. **Matriz Interactiva de Puestos y Permisos Modulares (Opción A):**
   - **Mapeo Puesto - Responsable:** Cada rol organizativo (`organization_roles`) define el cargo, el responsable titular designado, su departamento (`Dirección`, `Operaciones`, `Administración`, `Taller`, `Finanzas`), y su nivel de seguridad (`ADMINISTRADOR`, `DIRECCION`, `SUPERVISOR`, `AUDITOR`, `OPERATIVO`).
   - **Matriz de Seguridad Modular (1 Clic):** La grilla visual presenta columnas para cada sección del sistema:
     - 🚢 **Barcos y Obras** (`barcos`)
     - 📋 **Órdenes de Trabajo** (`ots`)
     - ⏱️ **Carga de Horas** (`horas`)
     - 📦 **Pañol y Materiales** (`panol`)
     - 👥 **Padrón de Personal** (`personal`)
     - 💵 **Tarifario Quincenal** (`tarifario`)
     - 📈 **Análisis FX & Desvíos** (`analisis`)
     - 🛡️ **Panel Administrador** (`admin`)
   - Cada celda funciona como un conmutador inmediato:
     - `[✓ Activo]` (Badge destacado en color del módulo): Módulo habilitado para el puesto.
     - `[-- Bloqueado]` (Badge tenue): Módulo restringido.
     - Un clic actualiza directamente el array `allowed_sections` en Supabase con feedback visual.
   - **Presets de Asignación Rápida:** Al crear o editar puestos, el administrador dispone de plantillas preconfiguradas:
     - *Director / Admin:* Acceso total a todos los módulos.
     - *Dirección Operativa:* Barcos, OTs, Horas, Personal, Tarifario y Análisis.
     - *Liquidación & RRHH:* Horas, Personal, Tarifario y Análisis.
     - *Supervisión de Obra & Pañol:* Barcos, OTs, Horas y Pañol.
     - *Auditoría / Tesorería:* Horas, Tarifario y Análisis FX.

2. **Parámetros Macroeconómicos Quincenales e Inmutabilidad de Cierres:**
   - **Fijación de Variables Macro (`macro_variables`):**
     - **Inflación Mensual Oficial (%):** La inflación es de frecuencia estrictamente mensual y rige para ambas quincenas (1Q y 2Q) del respectivo mes.
     - **Ajuste Manual de Dólar por Quincena ($ / USD):** El tipo de cambio oficial de referencia admite ajuste manual e independiente para cada quincena (`dollar_rate_1q` y `dollar_rate_2q`), reflejando la cotización pactada o de cierre de cada período.
     - **Métricas de Variación respecto al Mes Anterior:**
       - $\Delta\% \text{ Dólar} = \frac{\text{Dólar Quincena Actual} - \text{Dólar Mes Anterior}}{\text{Dólar Mes Anterior}} \times 100$
       - $\Delta \text{ Inflación (p.p.)} = \text{Inflación Mes Actual} - \text{Inflación Mes Anterior}$
   - **Candado de Inmutabilidad de Quincena (`is_locked_1q`, `is_locked_2q`, `rate_cards.is_locked`):**
     - Al completar la liquidación y conciliación quincenal, el Administrador puede accionar el candado **"Cerrar / Bloquear Quincena"**.
     - Una quincena bloqueada (`is_locked = TRUE`) queda inmutable contra modificaciones retroactivas de horas, retiros de materiales o tarifas pactadas.
     - Solo un rol con jerarquía `ADMINISTRADOR` puede desbloquearla para ajustes excepcionales debidamente auditados.

3. **Radar Operativo de Consistencia y Desvíos:**
   - Monitoreo en tiempo real de 3 disparadores clave:
     1. **Prestadores en Semáforo Rojo:** Contratistas cuya tarifa horaria superó en >5% la pauta de Astillero o cuya tarifa en US$ subió >10%.
     2. **Retiros de Pañol sin Horas Imputadas:** Personal o contratistas que retiraron insumos/consumibles de pañol en el período pero no registraron horas de trabajo.
     3. **Partes de Horas Observados:** Horas quincenales en estado pendiente de auditoría o rectificación por supervisión.

4. **Perfiles de Puesto, Misiones y Vinculaciones Inter-Departamentales:**
   - La tabla `organization_roles` documenta para cada función directiva y administrativa:
     - `job_mission`: Misión y propósito fundamental en el astillero.
     - `key_responsibilities`: Array de tareas y responsabilidades operativas.
     - `departmental_links`: Flujos de insumos, entregables (handoffs), coordinaciones y controles con otras áreas.
     - `reports_to`: Línea jerárquica directa.
   - **Circuito Operativo en 5 Etapas Determinísticas:**
     - Etapa 1: Negociación y Fijación de Tarifas (Dirección Operativa - Hugo Obregozo).
     - Etapa 2: Carga en ERP & Apertura de OTs (Administración - María José + Jefes de Obra).
     - Etapa 3: Ejecución, Registro Diario & Pañol (Supervisión - Jorge + Pañol Rodrigo/Mariano + Sabrina). **Regla Dura:** Prohibido retirar materiales sin horas asignadas en la OT.
     - Etapa 4: Auditoría Técnica y Cotejo de Facturación (Oficina Técnica - Omar + María José).
     - Etapa 5: Auditoría Financiera, Retenciones & Pago (Tesorería - Graciela).

5. **⚠️ Tarea Pendiente - Revisión Visual y Rediseño de Experiencia (UX):**
   - **Observación del Usuario:** La presentación visual actual del Circuito Operativo y la Ficha de Puestos genera sobrecarga visual o no convence en su disposición estética actual.
   - **Acción Pendiente:** Realizar una sesión de rediseño visual para sintetizar la información, mejorar la jerarquía gráfica de las tarjetas, y presentar las funciones y vinculaciones inter-departamentales de manera más limpia, elegante y ejecutiva.

6. **✅ Ajustes Operativos y de UI Implementados:**
   - **Personal y Tarifas (Tarifario Quincenal):** En la tabla *"Tarifas Guardadas en el Sistema"*, columna **Centro de Costo** (`admin_center`) ubicada después de **Dólar** y antes de **Acción**.
   - **Carga de Horas (Cuadrilla de Trabajo):** Alineación corregida en la fila de carga individual de operario.
   - **Carga de Horas (Auditoría Estado R):** Casilla de texto libre dinámica al seleccionar estado **`R`** (`review_reason` / `worker_response`).

---

## 8. Módulo de Órdenes de Trabajo (OT), Permiso "3ros" y Vinculación con Terceros (GS-003)

### 8.1. Arquitectura Contenedor OT (`work_orders`) vs. Trabajo (`work_items`)
- **La Orden de Trabajo (OT) como Contenedor:** Se abre para un barco con un número consecutivo propio de esa embarcación (`ot_number`, ej. `OT-1`, `OT-2` por barco) y un nombre general (Tabulada desde `OT.ABC` o Libre).
- **Nivel del Estado Operativo:** El estado del ciclo de vida reside en cada **Trabajo individual (`work_items`)**:
  - `Pendiente de inicio`
  - `En ejecución` *(único estado habilitado para imputar horas, materiales y costos)*
  - `Finalizado`
  - `Pendiente remito`
  - `Remito realizado/Pdte firma`
  - `Finalizado costo final de obra`
  - `Facturado`
  - `Desestimado`
- **Estado Calculado de la OT:** El estado general de la OT se calcula automáticamente a partir de los estados de sus trabajos. Una OT **no puede cerrarse** mientras tenga algún trabajo en estado `"En ejecución"`.

### 8.2. OT Tabulada (`OT.ABC`) vs. OT Libre
- **OT Tabulada:** El usuario elige una plantilla del **Catálogo de Trabajos (`OT.ABC`)** (clasificado en grupos *Renovación* e *Intermediaria*), lo cual precarga el nombre de la OT y la guía de descripción técnica.
- **OT Libre:** El usuario escribe manualmente el nombre de la OT y la descripción del trabajo.

### 8.3. Lista de Jefes de Obra desde el Padrón de Personal
- La lista de Jefes de Obra (incluyendo a **Hugo**, **Martín**, **Alejandro** y **Pablo**) proviene dinámicamente del *Padrón Operativo de Personas y Talleres* (`public.workers` donde `is_foreman = true`), permitiendo marcar o desmarcar quiénes son Jefes de Obra directamente desde el módulo de Personal y Tarifas.

### 8.4. Permiso `"3ros"` (Terceros) y Autocarga Condicional de PRC `$0` en Terceros
- **Diminutivo `"3ros"` en el Padrón (`/personal`):** En la tabla *"Padrón Operativo de Personas y Talleres"*, columna **PERMISOS**, se incorpora el botón interactivo **`3ros`** (junto a `P` de Pañol y `H` de Horas) para habilitar o deshabilitar a un contratista/taller en la carga de presupuestos de Terceros (`can_charge_third_party`).
- **Condición Estricta para Cargar PRC `$0` a Terceros desde un Trabajo de OT:**
  - Si en un trabajo se selecciona **más de un contratista** (ej. `PINTOR JUAREZ` y `Raschinaje`), el sistema **no habilita** la opción de cargar PRC a Terceros.
  - Si se selecciona **un único contratista** (ej. solo `PINTOR JUAREZ`), el sistema verifica en el Padrón si tiene activo el permiso **`3ros`**. Solo si cumple ambas condiciones (1 único contratista + permiso `3ros` activo) habilita la creación automática del registro en Terceros en estado `PRC` con importe `$0`.
- **Doble Observación en Terceros (`third_party_services`):**
  1. **Observaciones Directas (`direct_observations`):** Reciben automáticamente lo escrito en el campo `Descripción` del trabajo al crearse desde la OT y quedan vinculadas a dicho trabajo.
  2. **Observaciones Específicas (`specific_observations`):** Campo independiente para anotaciones cargadas directamente desde el módulo propio de Terceros.

### 8.5. Separación / Independización de un Trabajo de su Contenedor OT
- Cuando un trabajo (`work_items`) inicia dentro de un Contenedor OT compartido y posteriormente requiere individualidad operativa o comercial, el usuario puede accionar **✂️ Separar / Independizar Trabajo** desde la *Planilla Unificada*, *Contenedores OT*, *Ficha 360°* o el modal de edición.
- **2 Modalidades de Destino:**
  1. **Crear nueva OT independiente para el mismo barco:** Asigna automáticamente el próximo `OT-N` correlativo del barco, permitiendo elegir nombre **Tabulado** (`OT.ABC`) o **Libre**.
  2. **Mover a otra OT existente del mismo barco:** Reasigna el trabajo a otro contenedor ya abierto en esa embarcación.
- **Arrastre Transaccional y Trazabilidad:** El sistema migra el `work_order_id` del trabajo y arrastra automáticamente sus registros vinculados en Terceros (`third_party_services`), Horas (`labor_logs` con `work_item_id`) y Pañol (`inventory_transactions` con `work_item_id`), dejando constancia en la bitácora de auditoría de ambas OTs.

### 8.6. Las 3 Fechas Oficiales de la Orden de Trabajo
Cada Orden de Trabajo gestiona y exhibe tres hitos temporales diferenciados:
1. **Fecha de Creación (`created_at`):** Se asigna automáticamente con la fecha `HOY()` al abrir el formulario *"Cargar Trabajo / Nueva OT"*.
2. **Fecha de Inicio Real (`MIN`):** Se calcula automáticamente tomando la primera fecha registrada en todo el sistema para esa OT, ya sea por **Carga de Horas** (`labor_logs.date_logged`), **Retiro de Materiales / Pañol** (`inventory_transactions.transaction_date`) o **Terceros** (`third_party_services.service_date` / `created_at`). Si aún no registra movimientos, muestra `"Sin iniciar"`.
3. **Fecha Final / Última Carga (`MAX`):** Se calcula automáticamente tomando la última fecha cargada a esa OT entre Horas, Materiales o Terceros.
- **Visualización:** En las tarjetas de **Contenedores OT por Barco**, junto al bloque de *Horas Imputadas*, se exhibe la tira de 4 indicadores (`Horas Imp. | F. Creación | F. Inicio | F. Final`), además de la columna dedicada en la *Planilla Unificada* y el desglose en la *Ficha 360°*.

### 8.7. Bloqueo de Carga y Filtrado en Cascada (`1º Barco → 2º Contratista Habilitado → 3º OT en Ejecución`) — Regla Transversal para Horas, Materiales y Terceros
- **Alcance Transversal Obligatorio:** Esta arquitectura de bloqueo y filtrado en cascada rige de forma idéntica para los **3 módulos receptores de costos** del sistema:
  1. **Carga de Horas (`LaborLogs.jsx` — `public.labor_logs`)** *(Implementado y validado en producción)*.
  2. **Materiales / Pañol (`public.inventory_transactions`)** *(Obligatorio aplicar con esta misma lógica al desarrollar/actualizar el módulo)*.
  3. **Terceros (`public.third_party_services`)** *(Obligatorio aplicar con esta misma lógica en todas sus vistas de carga)*.
- **Regla de Bloqueo por Estado:** Únicamente los trabajos (`public.work_items`) en estado **`"En ejecución"`** habilitan la carga de datos en Horas, Materiales o Terceros. Los estados *Pendiente de inicio*, *Detenido*, *Cancelado*, *Finalizado*, *Pendiente remito* o *Facturado* bloquean la recepción de nuevos costos.
- **Cascada Estricta de 3 Pasos + Bloqueo en Detalle Inferior:**
  1. **Paso 1 — Seleccionar Barco (`ship_id`):** El usuario elige la embarcación.
  2. **Paso 2 — Seleccionar Contratista / Grupo Habilitado (`selectedContractorGroup`):** El selector filtra automáticamente mostrando **únicamente** los contratistas/grupos incluidos en el array `contractors` de los `work_items` en estado `"En ejecución"` de ese barco (ej. `ASTILLERO.MECANICA`, `ASTILLERO.RASCHINAJE`, `TECO TALLER`).
     - *Filtro adicional por Permiso de Padrón según Módulo:*
       - En **Horas**: Verificar `can_charge_hours = true` (`[H]`).
       - En **Materiales / Pañol**: Verificar `can_withdraw_panol = true` (`[P]`) + Regla dura de Pañol (no permitir retiro si no está habilitado en la OT en ejecución).
       - En **Terceros**: Verificar `can_charge_third_party = true` (`[3ros]`).
  3. **Paso 3 — Seleccionar Orden de Trabajo Habilitada (`work_order_id` y `work_item_id`):** El selector filtra automáticamente mostrando **únicamente** las OTs de ese barco donde el contratista elegido en el Paso 2 está habilitado en estado `"En ejecución"`, desplegando debajo la descripción específica de ese `work_item` (`DEC-016` ayuda memoria) y su modalidad (`HORA`, `PRESUPUESTO`, `CONTROL`).
  4. **Paso 4 — Bloqueo del Selector de Persona/Prestador en la Grilla Inferior:**
     - Si en el Paso 2 se eligió un subgrupo propio **`ASTILLERO.<RUBRO>`** (ej. `ASTILLERO.MECANICA`, `ASTILLERO.RASCHINAJE`, `ASTILLERO.CALDERERIA`, `ASTILLERO.CARPINTERIA`), el selector de operario/retirante de abajo debe ser un `<select>` cerrado que filtre exclusivamente a los operarios de `public.workers` (`admin_center = 'ASTILLERO'`) pertenecientes a ese oficio (`trade`).
     - Si en el Paso 2 se eligió un **Contratista o Taller externo** (ej. `TECO TALLER`, `PINTOR JUAREZ`, `RAMON ARANDA`), la fila inferior queda bloqueada exclusivamente en ese contratista/taller (y su ayudante si aplica), impidiendo elegir o escribir otro nombre.

#### 🛠️ Registro Técnico de Problemas Detectados y Solución Aplicada (Guía Obligatoria para Materiales y Terceros)
Durante la implementación y prueba real en **Carga de Horas** con el buque `NONO PASCUAL` (`OT-1 POCETES DE ACHIQUE`), se detectaron y resolvieron 3 problemas críticos que **no deben repetirse** al construir/ampliar los módulos de **Materiales** y **Terceros**:
1. **Problema 1 — Fallo silencioso en la consulta a `public.work_items` por columna de ordenamiento inexistente:**
   - *Causa:* Se invocó `supabase.from('work_items').select('*').order('row_number', { ascending: true })`. Como la tabla `public.work_items` no posee la columna `row_number` (su columna es `created_at`), Supabase devolvió error `400` y `itemsRes.data` quedó `null`. Al existir un fallback `if (workItems.length === 0) return ['ASTILLERO.GENERAL']`, el fallo quedó oculto mostrando únicamente `ASTILLERO.GENERAL` en vez de los contratistas reales (`ASTILLERO.MECANICA`, `ASTILLERO.RASCHINAJE`, `TECO TALLER`).
   - *Solución aplicada:* Ordenar siempre `public.work_items` por **`created_at`** (`.order('created_at', { ascending: true })`) y **no incluir fallbacks ficticios** (`ASTILLERO.GENERAL`) cuando `workItems` está vacío, de modo que si un barco no tiene trabajos en ejecución se muestre explícitamente `"🔒 Sin contratistas habilitados (En ejecución)"`.
2. **Problema 2 — Desconexión entre el selector del Paso 2 y los campos de carga inferiores:**
   - *Causa:* La función que sincronizaba la cuadrilla (`handleContractorGroupChange`) solo se disparaba en el evento manual `onChange` del `<select>`, pero no cuando el `useEffect` seleccionaba automáticamente el primer contratista habilitado al cambiar de barco. Además, el campo inferior de Operario era un `<input list="...">` abierto a toda la nómina.
   - *Solución aplicada:* Extraer la función `syncCrewWithContractor(nextContractor)` y llamarla tanto en el `onChange` manual como dentro del `useEffect` de cambio de barco; y reemplazar el `<input>` libre por un `<select>` controlado que filtra por el oficio de `ASTILLERO.<OFICIO>` (normalizando tildes y comparando con `workers.trade`, ej. `RASCHINAJE` $\rightarrow$ `RASCHIN`, `MECANICA` $\rightarrow$ `MECANICA`) o bloquea el nombre del contratista/taller externo.
3. **Problema 3 — Coexistencia de múltiples `work_items` con distintos contratistas dentro de un mismo Contenedor OT:**
   - *Causa:* En `NONO PASCUAL`, el contenedor `OT-1 — POCETES DE ACHIQUE` aloja dos trabajos distintos en ejecución: uno asignado a `['ASTILLERO.MECANICA', 'ASTILLERO.RASCHINAJE']` (modalidad `HORA`) y otro asignado a `['TECO TALLER']` (modalidad `PRESUPUESTO`). Si solo se filtra a nivel de `work_orders`, se pierde qué descripción y qué modalidad corresponden al contratista seleccionado.
   - *Solución aplicada:* Calcular `activeItemsForSelectedWo` filtrando los `work_items` de esa OT que contienen al `selectedContractorGroup`. Así, al cambiar en el Paso 2 entre `ASTILLERO.MECANICA` y `TECO TALLER` dentro de la misma `OT-1`, el sistema cambia automáticamente la descripción mostrada (`DEC-016`), la modalidad (`HORA` vs `PRESUPUESTO`) y guarda el `work_item_id` exacto en el registro insertado (`labor_logs.work_item_id`, `inventory_transactions.work_item_id`, `third_party_services.work_item_id`).

### 8.8. Alta In-Situ de Jefe de Obra y Depuración del Modal de OT
- **Alta In-Situ de Jefe de Obra (`+ Crear nuevo Jefe de Obra...`):** Al final del selector *"Jefe de Obra (Desde Padrón) \*"*, el usuario dispone de la opción **`+ Crear nuevo Jefe de Obra...`**, que despliega una caja rápida sin salir del modal de OT. Al confirmar, da de alta o actualiza a la persona en `public.workers` (`is_foreman = true`, `admin_center = 'ASTILLERO'`, `status = 'ACTIVO'`) y sincroniza su puesto en `public.organization_roles` (`department = 'Operaciones'`, `security_level = 'SUPERVISOR'`), dejándolo inmediatamente seleccionado en la OT.
- **Limpieza de Campos en Modal OT:** El campo de comentario se denomina limpiamente **`"Comentario Auxiliar"`** (sin referencias a columnas de Excel) y se elimina el campo redundante de *Nº Comprobante / Remito* de la creación de OT (gestionado exclusivamente en su circuito administrativo correspondiente).



### 8.9. Submódulo de Control de Gases y Cilindros Prestados (M4 Pañol y Compras)
- **Objetivo Operativo:** Controlar la entrega, devolución y canje de tubos de gases (Oxígeno, Baterías, CO2, Argón, Tubo Gas 45kg, Garrafas) con contratistas, talleres y proveedores, eliminando la necesidad de inspección física en patio para saber de qué proveedor es cada tubo vacío a reponer.
- **Proveedores Dinámicos desde Compras (`suppliers`):**
  - La lista de proveedores no es estática. Se alimenta dinámicamente del catálogo de Compras (`public.suppliers`), precargando los 3 proveedores reales actuales y sus circuitos operativos:
    1. `Air Liquide` (Habitual):
       - Ciclo: **Semanal**.
       - Pedido: **Martes antes de las 12:00 hs** (Mediodía). Teléfono Central: **`0810-222-5272`**, Nº Cliente Alon Car: **`2234867`**.
       - Entrega / Recepción en Astillero: **Miércoles**.
    2. `Praxair Linde` (Habitual):
       - Ciclo: **Quincenal** (1 lunes cada 15 días).
       - Pedido: **Lunes**. Vía Portal Web o llamado al representante comercial *(datos pendientes de confirmación)*.
       - Entrega / Recepción en Astillero: **Martes**.
    3. `Ferremat` (Emergencias):
       - Ciclo: **A demanda** cuando se quiebra el stock de seguridad antes de los días de entrega programada.
    4. `Propios Astillero Alon Car`:
       - Envases y garrafas propiedad fija del astillero.
  - Cualquier nuevo proveedor dado de alta en Compras queda disponible de forma automática para el pañolero.
- **Las 3 Operaciones de Trazabilidad de Envases (Submenú de Gases en Pañol):**
  - Cuando en el formulario de Pañol se selecciona un material perteneciente a la categoría/rubro `"GASES"`, el sistema despliega el submenú de trazabilidad con 3 botones de operación:
    1. **`[ Primera Entrega ]` (Nueva salida a obra sin devolución):**
       - Requiere: Proveedor del tubo lleno que se entrega (`supplier_delivered_id`).
       - Impacto: Suma `+1` tubo a la deuda acumulada del contratista y resta `-1` tubo lleno del stock en pañol de ese proveedor.
    2. **`[ Recambio (1 x 1) ]` (Mano a mano con soporte de cruce de marcas):**
       - Requiere: Proveedor del tubo vacío devuelto (`supplier_returned_id`) y Proveedor del tubo lleno entregado (`supplier_delivered_id`).
       - Impacto en Contratista: **Saldo total sin cambio (`0`)**, el contratista sigue debiendo la misma cantidad de envases, pero se actualiza la tenencia de la marca en su poder.
       - Impacto en Pañol: Suma `+1` tubo vacío al patio del proveedor entrante (listo para canje) y resta `-1` tubo lleno del stock del proveedor saliente.
    3. **`[ Devolución Final ]` (Reingreso de vacío por fin de trabajo):**
       - Requiere: Proveedor del envase devuelto (`supplier_returned_id`).
       - Impacto: Resta `-1` de la deuda del contratista y suma `+1` tubo vacío al patio de ese proveedor.
- **Dashboard del Pañolero ("DETALLE DE TUBOS CONTRATISTAS" Digital):**
  - **KPIs Superiores de Reposición por Proveedor:** Muestra en tiempo real los tubos vacíos acumulados por cada proveedor activo en Compras (ej: `Air Liquide: 10 vacíos`, `Praxair Linde: 4 vacíos`, `Ferremat: 2 vacíos`) con botón de acción directa `[ Generar Pedido de Reposición (N) ]`.
  - **Matriz de Saldos por Contratista (Tipo Sheets con Sticky Headers):** Rejilla con inmovilización vertical de encabezados (`sticky top-0 z-20 bg-slate-950`) que desglosa por fila a cada contratista y por columna a cada gas, con acceso a su bitácora histórica de retiros y devoluciones en 1 clic.
