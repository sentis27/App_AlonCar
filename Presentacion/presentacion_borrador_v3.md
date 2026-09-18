# Borrador v2 — Presentación App_AlonCar
*Filmina por filmina. Revisá, editá, y avisame qué cambiar.*

---

## TRAMO 1: "La Visión" (~10 minutos)

---

### T1-01 — Portada
- **App_AlonCar** — Sistema de Gestión y Análisis de Costos Navales
- Subtítulo: "Propuesta para Astillero AlonCar"
- Tu nombre, Sábado 19 de septiembre de 2026.

---

### T1-02 — Agenda
- ☕ **Tramo 1:** Visión general del sistema (~10 min)
- ☕ **Pausa / Café**
- ☕ **Tramo 2:** Cada módulo en detalle (~10 min)

*"Primero les muestro qué es y por qué lo hice así. Después del café, entramos en cada módulo."*

---

### T1-03 — El Pedido Original
- Lo que se pidió:
  - Un sistema de costos más ágil, adaptable y seguro.
  - Un mapeo del flujo de información (manual de procedimientos de carga).
  - Mejor orden y trazabilidad de los datos.
- *"Todo lo que van a ver fue diseñado para responder exactamente a esto."*

---

### T1-04 — El Sistema Actual: Las 12 Planillas
Hoy el astillero determina sus costos de obra sobre una red de 12 planillas interconectadas en Google Sheets:

| # | Planilla | Función principal |
|---|----------|-------------------|
| 1 | **Horas** | Registro diario de horas trabajadas por operario, rubro y OT. Fuente de verdad para liquidación de sueldos. |
| 2 | **Materiales** | Registro de cada retiro del pañol: qué material, para qué obra, quién lo retiró, quién paga. |
| 3 | **Lista de Trabajos** | El "cerebro operativo": todas las OTs activas, su estado, contratista y jefe de obra asignado. |
| 4 | **Resumen Gerencial** | Tablero maestro: cruza horas + materiales + terceros para ver el costo real de cada obra y emitir el remito al cliente. |
| 5 | **Terceros** | Central de carga de costos de talleres externos (facturas, remitos, presupuestos PRC). |
| 6 | **Compras** | Registro de pedidos de materiales, cotizaciones, estados de entrega y comparación de precios con proveedores. |
| 7 | **Control de Stock** | Balance del inventario: entradas (compras) menos salidas (retiros de pañol). Auditoría física y cálculo de vitalidad. |
| 8 | **Base de Datos Central** | Padrón maestro de personal, talleres, rubros, tarifarios hora/hombre y permisos. Alimenta a todas las demás planillas. |
| 9 | **BD Nuevas Planillas** | Intermediaria: distribuye validaciones de barcos, OTs y personal hacia Horas, Materiales y Terceros. |
| 10 | **Reconciliación Horas vs Materiales** | Auditoría quincenal: cruza retiros de pañol contra horas cargadas para detectar materiales sin trabajo asignado. |
| 11 | **Detalle de Presupuestos** | Padrón de contratos (PRC) con métricas de avance, horas estimadas y peso. |
| 12 | **Prototipo Puesta en Seco** | Modelo de cotización estandarizado para servicios de varadero con tarifario Nivel Alfa. |

Estas planillas fueron creadas internamente y son la evidencia de que **ya existe la disciplina de carga y el conocimiento del negocio**. El desafío no es recolectar los datos, sino cómo fluyen: hoy exige un "ping-pong" manual entre planillas (ej. cruzar materiales comprados vs. consumos y stock, o armar un resumen gerencial cruzando 4 fuentes distintas).

---

### T1-05 — La Solución: App_AlonCar (Panorama)
Un sistema unificado que reemplaza las 12 planillas por una arquitectura de módulos interconectados.

**Los 4 pilares:**
1. 📊 **Orden** — Toda la información en una sola base de datos. Sin copiar/pegar entre planillas.
2. ⚡ **Automatización** — Controles que hoy se hacen a mano (congelamiento del dólar, separación de consumibles por contratista, conciliación quincenal) los hace el sistema.
3. 🎓 **Capacitación** — El sistema guía al usuario mientras trabaja: qué comprobante usar, cómo cargar, qué significa cada campo.
4. 🤖 **Inteligencia** — Preguntale al sistema y te responde con datos reales. Creale un procedimiento y lo estandariza.

---

### T1-06 — Arquitectura Modular
- **M1: Barcos y Clientes** — Historial completo del activo (todas las visitas, todas las OTs, todo el costo histórico en un solo lugar).
- **M2: Personal y Talleres** — Tarifarios con vigencia, gestión de proveedores de compras, contratistas, personal del astillero.
- **M3: Operaciones y Costos** — Control de OTs, horas, imputaciones, conciliación automática. El "Triángulo del Costo" en vivo.
- **M4: Logística (Pañol y Compras)** — Inventario vivo, retiros con descuento automático, órdenes de compra, alertas de stock.
- **M5: Comercial** — Presupuestos, remito al cliente con separación automática MO (exenta) / Materiales (gravados al 21%).
- **M6: Cierre y Auditoría** — Data Locking (OT facturada = nadie la toca), archivo histórico, registro de quién hizo qué.
- **M7: Analítica e IA** — Comparador de obras, evaluación de contratistas, asistente de procedimientos.

---

### T1-07 — Cierre Tramo 1 / Transición al café
- *"Esto fue la visión general. Después del café, entramos en detalle: qué hace hoy cada planilla, qué problemas tiene, y cómo el sistema los resuelve."*
- ☕ **PAUSA**

---
---

## TRAMO 2: "La Profundidad" (~10 minutos)

---

### T2-01 — Planilla de Horas (→ Módulo Operaciones)

**Actualmente:**
- El operario carga horas en una planilla de 10 pestañas donde conviven el formulario de carga, tablas importadas de otras planillas (listas de barcos, OTs, valores hora), fórmulas de alerta y el resumen para liquidación de sueldos.
- La conversión a dólares depende de un valor escrito a mano en una celda. Cada quincena hay que congelar los valores manualmente: copiar columnas enteras, pegar como valores, y actualizar el dólar. Si se hace mal, los costos históricos se deforman.
- Coexisten dos tablas de valor hora/hombre (`B.D PARA HORAS` y `ImportNewB.DCostosH/h`) y no está claro cuál manda.
- La hoja de CONTROL DESCANSOS fue abandonada porque la carga manual era tan engorrosa que nadie la usaba.
- Si hay que cargar a 5 operarios que hicieron el mismo trabajo, hay que repetir toda la carga 5 veces. Y si el mismo trabajo se repite al día siguiente, hay que volver a cargar todo desde cero.

**Mejora:**
- El operario ve un formulario limpio: barco, OT, operario, rubro, horas. El rubro se carga manualmente porque es flexible por día (un calderero puede pintar un día, o un contratista pintor puede ayudar con el raschinaje). El resto (valor hora, conversión a dólares, centro de costo) se resuelve invisible en el backend.
- **Carga múltiple:** Se cargan los datos de un operario y con el botón "Agregar Operario al Mismo Trabajo" se suman rápidamente los demás que participaron del mismo trabajo sin repetir barco, OT ni rubro.
- **Replicar carga de ayer:** Muchos trabajos duran varios días. Con un botón se replican las cargas del día anterior, ahorrando tiempo y evitando repetir lo mismo todos los días.
- El congelamiento quincenal es un botón: "Cerrar Quincena" → el sistema congela precios, guarda el tipo de cambio con fecha y quincena, y genera el resumen de liquidación automáticamente.
- Una sola tabla de tarifarios con historial de vigencia. Siempre sabés qué tarifa aplicaba en cada momento.

> 📸 **[Filmina siguiente: Mockup de la interfaz de carga de horas]**

---

### T2-02 — Planilla de Materiales / Pañol (→ Módulo Logística)

**Actualmente:**
- Cada retiro del pañol se carga en una planilla de 11 pestañas. El pañolero selecciona el material de una lista, carga la cantidad, y el sistema le muestra el stock disponible importado desde otra planilla.
- La lógica de "quién paga" el consumible (cliente o contratista) se resuelve con una fórmula que cruza 3 hojas distintas. Hoy es un SI/NO: o paga todo el cliente o paga todo el contratista. No admite porcentajes parciales.
- Cada quincena hay que generar un informe manual de consumibles por contratista para descontarlo de la liquidación. Este proceso toma entre 1,5 y 2 horas cada vez, se hace con filtros manuales, y no tiene trazabilidad formal.
- Al actualizar el precio de un material se pierde la fecha del precio anterior. No hay historial de precios.
- Existen columnas muertas heredadas del diseño original (NORMALES, HORAS AL 50%, HORAS AL 100%) que ensucian la planilla sin aportar nada.
- El supervisor recibe por WhatsApp cada 2 horas un resumen de retiros vs. stock (automatización n8n ya funcionando).

**Mejora:**
- Formulario de retiro simplificado: barco, OT, material (con autocompletado e imagen de referencia del producto), cantidad. El resto se calcula solo.
- La regla de "quién paga" admite porcentajes parametrizables por contratista (ej. 60% cliente / 40% contratista), eliminando la doble imputación manual que hoy se hace en la planilla de Terceros.
- Informe quincenal de consumibles por contratista se genera en 1 clic, con aprobación humana y envío automático al contratista por WhatsApp o correo electrónico, en formato PDF.
- Historial de precios completo: cada cambio queda registrado con fecha, valor anterior, valor nuevo, tipo de cambio y quién lo modificó.
- Stock en tiempo real calculado desde la base de datos, no importado de otra planilla.

> 📸 **[Filmina siguiente: Mockup de la interfaz de retiro de materiales del pañol]**

---

### T2-03 — Planilla de Compras (→ Módulo Logística)

**Actualmente:**
- Planilla de 7 pestañas que registra cada pedido de compra. Tiene un flujo de estados complejo con 14 estados posibles (PEDIR, PEDIDO, COTIZACIÓN, RECIBIDO, etc.) y 8 columnas muertas heredadas.
- Cuando un material no existe en la base de datos, el operario lo escribe a mano. El supervisor luego lo busca, lo copia y lo pega en la base de datos maestra. Hay 6 materiales pendientes de alta en este momento.
- La comparación de precios (precio cotizado por el proveedor vs. precio registrado en el sistema) existe pero no muestra el % de variación ni la fecha de la última actualización del precio.
- Si el supervisor quiere saber a qué proveedor le compró más veces un material, tiene que filtrar manualmente y contar a ojo.
- La revisión de facturas se marca pintando una fila de color morado ("de ahí para atrás ya está controlado").

**Mejora:**
- Alta de materiales nuevos con autocompletado y nomenclatura estandarizada. El supervisor da de alta con un formulario formal (nombre, rubro, precio, categoría).
- Comparación de precios con indicador visual automático (⬆️ +15% / ⬇️ -5%) y fecha de última actualización.
- Estadística de proveedores on-demand: un botón que muestra "Ferremat 60%, Casa Carlitos 30%, Otros 10%" para ese material.
- Conciliación de facturas con checkpoint: "Conciliar hasta aquí" → marca todas las compras anteriores de ese proveedor como verificadas, reemplazando la fila morada.

> 📸 **[Filmina siguiente: Mockup de la interfaz de gestión de compras]**

---

### T2-04 — Control de Stock (→ Módulo Logística)

**Actualmente:**
- Consolida entradas (compras) y salidas (retiros de pañol) para calcular el stock físico. Tiene una hoja de auditoría donde el pañolero registra stock del sistema vs. stock real contado a mano.
- Si hay diferencia, el pañolero tiene que ir a otra pestaña, hacer la resta mental, y cargar el ajuste compensatorio manualmente.
- La hoja "Cálculo de Pedido" proyecta cuándo se agotará cada material, pero es pesada porque se calcula con fórmulas de Sheets.

**Mejora:**
- Auditoría en lote por rubro: seleccionás "Planchuelas y Caños" → el sistema trae todos los ítems con su stock teórico → cargás la cantidad real → el ajuste se calcula y aplica en 1 clic.
- Valorización del inventario: cuánto dinero hay inmovilizado en stock y cuánto se "perdió" o "ganó" tras un ajuste.
- Cálculo de vitalidad del material (días de inventario restante) como dashboard en tiempo real, no como fórmula pesada.

> 📸 **[Filmina siguiente: Mockup de la interfaz de auditoría de stock]**

---

### T2-05 — Planilla de Terceros (→ Módulo Operaciones)

**Actualmente:**
- Central de carga de costos de talleres externos. Cada factura (FCR), remito (RMO) o presupuesto (PRC) se registra manualmente.
- La base de proveedores está duplicada: existe una copia local en esta planilla (`BD_Talleres`) y otra en la Base de Datos Central. Si el encargado de personal da de alta a un taller, el administrativo tiene que crearlo de nuevo acá a mano.
- El cambio de dólar se hace manual: sobreescribir la celda, congelar los valores anteriores con copiar/pegar. Si se actualiza antes de exportar los datos, los costos históricos se deforman.
- Para verificar que los materiales entregados a un taller coinciden con lo que el taller cobró, hay que tipear el nº de remito en una pestaña de búsqueda y comparar visualmente.
- Existe un script completo (`procesarDatosPampaNaval()`) que fue creado exclusivamente porque no había una herramienta que multiplique Kilos procesados × Tarifa Acordada (USD) por quincena para un solo taller. Ese script implementa en código lo que en Supabase se resuelve con una consulta SQL simple.

**Mejora:**
- Base de proveedores unificada: se crea en un solo lugar y está disponible en todas las estaciones (Horas, Materiales, Terceros, Compras).
- Al cargar el "Nº Remito Aloncar", la interfaz muestra automáticamente una tarjeta con los materiales exactos retirados del pañol bajo ese remito. Verificación instantánea, sin cambiar de pestaña.
- Generación automática del registro PRC $0 cuando se crea un trabajo de terceros: hereda barco, OT, proveedor y descripción. Elimina la doble carga manual.
- Rubro autocompletado: al seleccionar el proveedor/taller en el formulario, el rubro se completa automáticamente porque ya está tabulado en la base de datos de proveedores. Sin necesidad de cargarlo manualmente cada vez.

> 📸 **[Filmina siguiente: Mockup de la interfaz de carga de terceros]**

---

### T2-06 — Lista de Trabajos (→ Módulo Operaciones)

**Actualmente:**
- El "cerebro operativo" del astillero: cada OT activa con su estado, contratista y jefe de obra.
- Hoy la carga la hace una sola persona (Jorge). Las descripciones de trabajos llegan verbal o por WhatsApp desde los jefes de obra.
- El IMPORTRANGE que traía la lista de contratistas está roto. Se cargan a mano.
- El generador automático de número de OT (Apps Script) no funciona correctamente.
- Tiene 7 estados de OT distintos (En ejecución, Pendiente, Facturado, Remito realizado, Trabajo Finalizado, Desestimado, Finalizado costo final). Algunos son redundantes o confusos.

**Mejora:**
- Cualquier usuario autorizado puede crear una OT desde su rol (no depende de una sola persona).
- Numeración automática confiable de OTs.
- Estados simplificados y claros con transiciones controladas. Por ejemplo, una OT no puede pasar a "Facturado" si tiene alertas pendientes como: horas sin aprobar, materiales sin OT asignada, comprobantes de terceros pendientes de factura (RPF), o discrepancias detectadas en la reconciliación quincenal.
- **Descripción de la OT visible como ayuda:** Cuando el operario abre una OT para cargar horas o materiales, la descripción detallada del trabajo aparece inmediatamente en pantalla, para que sepa de qué trata sin tener que preguntar.
- **Habilitación de OT por contratista:** Cada OT se habilita específicamente para los contratistas autorizados a trabajar en ella. Esto reduce errores de carga (no se puede imputar a una OT que no te corresponde) y fuerza el preaviso del alcance del trabajo antes de habilitar la orden. Sin esta habilitación, la OT no aparece en las opciones del contratista.
- Las descripciones de trabajos y estados alimentan automáticamente a Horas, Materiales y Terceros sin IMPORTRANGE.

> 📸 **[Filmina siguiente: Mockup del tablero de gestión de OTs]**

---

### T2-07 — Base de Datos Central (→ Módulo Personal y Talleres)

**Actualmente:**
- Padrón maestro de 173 registros (operarios propios, contratistas, talleres).
- El tarifario hora/hombre mezcla categorías salariales (`AYUDANTE`, `OFICIAL`) con nombres de talleres (`AVALOS`, `TECO TALLER`) en la misma tabla para que el BUSCARV funcione. Es una deuda técnica que dificulta el mantenimiento.
- El tipo de cambio se importaba desde otra planilla. Si esa importación fallaba, todos los costos en dólares de todas las planillas quedaban en cero.
- Los cambios de estado (ACTIVO/INACTIVO) se registran en un log automático, lo cual es bueno, pero el log vive dentro de la misma planilla.

**Mejora:**
- Tarifarios separados: una tabla para categorías salariales, otra para tarifas por taller. Cada una con vigencia temporal (la tarifa anterior se conserva, no se sobreescribe).
- Tipo de cambio centralizado en un "Dashboard Maestro del Supervisor": se configura una vez por quincena y todas las conversiones lo toman automáticamente.
- Alta unificada de personal: se da de alta en un solo lugar y queda habilitado en todos los módulos según sus permisos.

> 📸 **[Filmina siguiente: Mockup del panel de gestión de personal y tarifarios]**

---

### T2-08 — Resumen Gerencial y Comercial (→ Módulo Comercial + BI)

**Actualmente:**
- El tablero maestro donde el gerente cruza los 3 costos (Horas + Materiales + Terceros) para cada obra y arma el remito comercial al cliente.
- Para ver el costo real de una OT, el sistema internamente navega entre `CALC.GENERALES` (costo de la obra completa) y `CALC.OT` (costo filtrado por OT). El usuario final no necesita navegar entre estas hojas, pero la lógica de fondo depende de este cruce manual de pestañas internas. El resultado es que armar el remito comercial implica un ida y vuelta constante entre lo que costó la obra y lo que se le cobra al cliente.
- Las descripciones textuales de las tareas de Puesta en Seco y sus precios unitarios base (Tarifario Nivel Alfa) son editables solo por Gerencia.
- El resumen calcula: Total Exento (MO en USD), Total Gravado (Materiales en USD), IVA 21%, Total Remito a Cobrar, y Margen Global Real de Obra.

**Mejora:**
- Vista unificada en pantalla dividida: Panel Izquierdo = Costo Interno Real (automático), Panel Derecho = Remito Comercial (con tarifario pre-cargado). Todo en una sola pantalla, sin ida y vuelta.
- Los inputs cuantitativos de obra (días de varadero, horas de grúa, m³ de tanques, cantidad de válvulas, ánodos de zinc) se cargan una sola vez y el sistema calcula el total del remito.
- Emisión del remito en 1 clic (PDF/Excel idéntico al formato legacy).
- Margen global de obra visible en tiempo real mientras se cargan las cantidades.

> 📸 **[Filmina siguiente: Mockup de la vista dividida Costo Interno / Remito Comercial]**

---

### T2-09 — Analítica Avanzada: Comparador de Obras

**El problema hoy:**
Si quiero comparar cuánto costó la "Cubierta de madera" en 3 barcos distintos, tengo que abrir 3 resúmenes gerenciales, copiar números a mano y hacer cuentas en otra hoja.

**La solución:**
Un Canvas interactivo donde se arrastran barcos y OTs. El sistema muestra frente a frente:

| Métrica | Barco A | Barco B | Barco C |
|---------|---------|---------|---------|
| Costo Total Obra | $45.000 | $52.000 | $38.000 |
| Costo de Horas | $25.000 | $29.000 | $17.500 |
| Costo Materiales | $12.000 | $18.000 | $9.500 |
| Costo Terceros | $8.000 | $5.000 | $11.000 |

**Métricas por defecto:** Costo total, costo por rubro (horas, materiales, terceros), KG instalados, horas registradas, taller responsable.

**Métricas adicionales (ad-hoc):** El gerente inyecta valores al vuelo. Ej: ingresa "45 m²" para un barco y "60 m²" para otro → el sistema recalcula Costo/m², KG/m², Horas/m² automáticamente.

**Evaluación de contratistas:**
- **KG/Hora:** ¿Qué taller instala más kilos en menos tiempo?
- **Costo/KG:** ¿Qué contratista por presupuesto es comercialmente más competitivo?
- **Modalidad:** Distingue si el taller trabajó por hora o por presupuesto cerrado, y muestra ambos análisis.

> 📸 **[Filmina siguiente: Mockup del Comparador de Obras interactivo]**

---

### T2-10 — Reconciliación Automática (→ Módulo Cierre)

**Actualmente:**
- Dos planillas enteras (GS-009 y GS-010) dedicadas exclusivamente a cruzar horas contra materiales por quincena. Construyen llaves compuestas concatenando QUINCENA/BARCO.OT.CONTRATISTA y hacen un VLOOKUP para encontrar retiros de pañol sin horas de respaldo.
- Este cruce es manual, lento, y tiene filtros "hardcodeados" que excluyen ciertos talleres porque el sistema no podía manejarlos limpiamente.

**Mejora:**
- Todo esto se reemplaza por una consulta automática que corre al cerrar la quincena. El sistema detecta en segundos si hay retiros de materiales sin horas de trabajo asignadas, sin necesidad de planillas intermediarias ni llaves concatenadas.
- Si encuentra discrepancias, presenta una "Bandeja de Reconciliación" al supervisor con acciones in-situ: re-imputar el material, cargar las horas faltantes, o marcar como excepción justificada.

> 📸 **[Filmina siguiente: Mockup de la Bandeja de Reconciliación del supervisor]**

---

### T2-11 — IA: Procedimientos y Conocimiento

**Parte 1 — El Redactor de Procedimientos:**
- El gerente plantea un problema en texto simple (ej. "Los remitos de pañol ahora se firman y van a la carpeta azul").
- La IA lo redacta como manual de procedimiento formal (objetivo, alcance, pasos, responsables).
- Se aprueba → se guarda → se notifica a las áreas involucradas.

**Parte 2 — El Asistente Operativo:**
- Un empleado duda: "¿Cómo archivo los remitos?" → le pregunta al chat del sistema.
- La IA busca en los manuales aprobados y responde con los pasos exactos.

**Parte 3 — Consultas de datos:**
- "¿Cuál es el costo acumulado del Barco Libertad?" → respuesta inmediata con desglose.
- "¿Qué materiales están por debajo del stock mínimo?" → lista con cantidades y alertas.

*"El conocimiento de la empresa queda guardado, estandarizado y al alcance de todos. Se acabó el 'yo no sabía cómo se hacía'."*

---

### T2-12 — ¿Qué significa esto para la gerencia?

- 🔍 **Estandariza:** Transforma el conocimiento informal (que hoy está en la cabeza de pocas personas) en patrimonio digital de la empresa.
- ⏱️ **Automatiza lo repetitivo:** Congelamiento del dólar, separación de consumibles, conciliación quincenal, informes de proveedores — todo lo que hoy lleva horas manuales.
- 🎯 **Decisiones con datos en tiempo real:** No del mes pasado. Del minuto. El Comparador de Obras y las métricas de productividad de contratistas le dan a la gerencia herramientas que hoy no existen.
- 🎓 **Capacita 24/7:** El sistema guía al personal nuevo sin necesidad de un manual de 50 páginas ni depender de que "el que sabe" esté disponible.

*"La IA no reemplaza al gerente. Le saca el trabajo administrativo pesado y le da superpoderes."*

---

### T2-13 — Visión a futuro

La arquitectura modular permite conectar nuevas áreas sin romper lo que ya funciona:
- 📑 Cuentas corrientes de clientes y proveedores (el esquema de base de datos ya está pre-armado).
- 💵 Liquidación de sueldos y vacaciones.
- 🔧 Mantenimiento preventivo de equipos.
- 📊 Control integral de proyectos.

*"No es una promesa. Es una posibilidad real del diseño."*

---

### T2-14 — Cierre y Preguntas
- *"Esto es lo que diseñé para resolver lo que me pidieron. ¿Preguntas?"*
- Si preguntan por costos → sacar la Presentación Bonus.

---
---

## PRESENTACIÓN BONUS: "Los Números" (solo si engancharon)

### B-01 — Estado del Desarrollo
| Aspecto | Estado |
|---------|--------|
| Diseño de módulos y reglas de negocio | ✅ Completo |
| Mapeo de las 12 planillas (todas documentadas) | ✅ Completo |
| Infraestructura técnica | ✅ Funcionando |
| Interfaces de usuario | 🔧 En desarrollo |
| Automatizaciones y alertas | 🔧 En desarrollo |
| Testing y puesta en marcha | 📋 Pendiente |

Timeline: 3-5 meses para la primera versión funcional.

### B-02 — Valor de Mercado vs. Costo Real
| Referencia | Rango |
|-----------|-------|
| Lo que cobraría una consultora por un sistema así | US$20.000 - US$35.000 |
| Solo el relevamiento del negocio (un externo meses aprendiendo) | US$5.000 - US$12.000 |
| **Costo real de este proyecto (conocimiento interno + IA)** | **~US$10.000** |

*"Un externo cobraría US$20.000+ solo por aprender cómo funciona el astillero antes de escribir una línea de código. Yo ya lo sé porque creé las planillas y opero el sistema todos los días."*

### B-03 — Modelo Propuesto
**Opción A — Suscripción mensual (recomendada):**
- Cuota mensual todo incluido (uso, hosting, soporte, actualizaciones).
- Sin inversión inicial.
- *"El día que no sirva, lo cancelan."*

**Opción B — Compra:**
- Precio justo basado en el valor de mercado.
- No incluye soporte futuro. Cada mejora se cotiza aparte.
