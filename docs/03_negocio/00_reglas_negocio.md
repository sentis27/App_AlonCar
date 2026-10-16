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

### 4.1. Visibilidad por Nivel de Acceso
- **Nivel Carga / Pañolero:** Solo visualiza el formulario de necesidad (Material, Cantidad solicitada, Solicitante). No ve estadísticas de precios ni datos de proveedores.
- **Nivel Encargado de Compras:** Visualiza gráficos comparativos de precios, estadísticas históricas de compras por proveedor y estado de cotizaciones.

### 4.2. Motor de Automatización de Envíos a Proveedores
1. **Selección Múltiple:** El Encargado de Compras tilda los materiales en estado `PEDIR`.
2. **Disparo de Algoritmo ("Pedir Materiales"):** El sistema agrupa automáticamente los materiales seleccionados según su proveedor asignado (ej. 3 materiales a *Cerremaq*, 2 a *Ferretería Florida*).
3. **Generación de Mensaje:** Consulta el medio de contacto registrado en `suppliers` (Email o WhatsApp) y redacta un mensaje formal con el listado agrupado.
4. **Transición de Estado:** Las solicitudes seleccionadas cambian su estado de `PEDIR` a `PEDIDO`.
5. **Trazabilidad de Auditoría:** El log del sistema registra si el pedido fue realizado por la automatización (`created_by_automation = true`) o manualmente por un operario.

---

## 5. Estándar de Idioma de la Plataforma (UI / UX)
Toda la interfaz de usuario (UI), notificaciones, alertas, mensajes del asistente de IA y exportaciones (PDF, Excel) deben estar estricta y obligatoriamente en **ESPAÑOL**. 
- **Cero tolerancia al Spanglish:** Términos como "Dashboard", "Work Order", "Submit", "Loading" deben traducirse a sus equivalentes precisos en español (ej. Panel de Control, Orden de Trabajo, Enviar, Cargando). 
- El personal del astillero, desde pañol hasta gerencia, requiere una herramienta nativa en su idioma que no genere fricción cognitiva.

---

## 6. Gestor Documental de Compras (M4c)

### 6.1. Adjunto Inteligente (1 Clic)
El operario de compras no necesita organizar carpetas externas ni copiar links. Debe disponer de un botón "Adjuntar Cotización" en cada línea de compra que permita subir un archivo (PDF, DOC, etc.) completando únicamente una descripción breve.

### 6.2. Nomenclatura y Almacenamiento Automático
- **Renombrado Automático:** El sistema renombra el archivo subido sin intervención humana utilizando la fórmula: `{descripcion}-{proveedor}.{extension}`.
- **Estructura de Carpetas:** El archivo se almacena en el sistema (Supabase Storage) simulando la estructura del Drive legacy: `cotizaciones/{año}/{rubro}/{archivo_normalizado}`. El año se toma automáticamente y el rubro hereda del módulo de materiales.

### 6.3. Buscador Histórico Indexado
Las cotizaciones no quedan huérfanas; se indexan en una base de datos relacional (`purchase_documents`), permitiendo búsquedas cruzadas por rubro, proveedor, año y descripción. Esto es fundamental para alimentar el Comparador de Precios (M4b).

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


