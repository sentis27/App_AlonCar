# Plan Definitivo v3 — Presentación App_AlonCar

## Formato: 3 Presentaciones

| Presentación | Duración | Contenido | Momento |
|---|---|---|---|
| **Tramo 1** | ~10 min | Visión general: qué pediste, qué encontré, cómo lo resuelvo | Antes del café |
| **Tramo 2** | ~10 min | Profundidad: cada módulo, flujo de datos, IA, autorización | Después del café |
| **Bonus** | ~5 min (opcional) | Costos, valoración, modelo de negocio | Solo si engancharon |

---

# TRAMO 1: "La Visión" (~10 minutos, 11 diapositivas)

### T1-01 — Portada
- **App_AlonCar** — Sistema de Gestión de Costos Naval
- Subtítulo: "Propuesta para [nombre del astillero]"
- Tu nombre, fecha.

### T1-02 — Cronograma de la presentación
- Mostrar el recorrido completo de la reunión en una línea de tiempo visual:
  - ☕ **Tramo 1:** Visión general del sistema (~10 min)
  - ☕ **Pausa / Café**
  - ☕ **Tramo 2:** Cada módulo en detalle (~10 min)
- _"Primero les muestro qué es y por qué lo hice así. Después del café, entramos en cada módulo."_

### T1-03 — El pedido original
- Lo que pidieron:
  - ✅ Un sistema de costos más ágil, adaptable y seguro.
  - ✅ Un mapeo del flujo de información y procedimientos de carga.
  - ✅ Mejor orden y trazabilidad de los datos.
- _"Todo lo que van a ver está diseñado para responder exactamente a este pedido."_

### T1-04 — El sistema actual: las planillas
- Panorama de lo que existe hoy:
  - **12 planillas** interconectadas en Google Sheets (GS-001 a GS-012).
  - Cubren: horas, materiales, terceros, stock, compras, presupuestos, resumen gerencial.
  - Creadas internamente (por vos), funcionan, pero tienen limitaciones.
- Visual: diagrama mostrando las 12 planillas como nodos conectados con flechas (las dependencias cruzadas reales del INDICE_PLANILLAS.md).

### T1-05 — Qué información recolectamos y por qué
- Tabla clara de los 4 grandes grupos de datos y su propósito:

| Dato que recolectamos | Para qué lo usamos |
|---|---|
| **Horas de operarios** (reloj + imputación) | Calcular el costo de mano de obra por OT |
| **Materiales** (consumos de pañol + compras directas) | Calcular el costo de materiales por OT |
| **Terceros** (talleres externos, proveedores) | Calcular servicios de terceros por OT |
| **Datos de barcos, clientes, tarifas** | Organizar, presupuestar y facturar correctamente |

- _"Toda esta información ya la recolectamos hoy. El problema no es qué datos tenemos, sino cómo fluyen y se conectan."_

### T1-06 — Los problemas actuales
- Los puntos de dolor **reales**, sin inventar nada:
  - 🔴 **Dependencia de una persona:** Si el que sabe no está, el sistema se frena.
  - 🔴 **Sin conciliación automática:** No se detectan discrepancias entre reloj e imputación.
  - 🔴 **Información dispersa:** Para saber el costo real de una OT hay que cruzar 3-4 planillas manualmente.
  - 🔴 **Sin trazabilidad:** No se sabe quién cargó qué ni cuándo se modificó.
  - 🔴 **Capacitación difícil:** El personal nuevo no sabe qué cargar ni cómo.
  - 🔴 **Reportes lentos:** Armar un resumen gerencial lleva tiempo manual.
- _"Estos problemas no son culpa de nadie. Son el resultado natural de un sistema que creció más allá de lo que las planillas pueden manejar."_

### T1-07 — La solución: App_AlonCar (overview)
- Una oración: _"Un sistema que reemplaza las 12 planillas con una plataforma unificada, automatizada y con asistente inteligente."_
- Los 4 pilares (visual con íconos):
  1. 📊 **Orden** — Toda la información en un solo lugar, estructurada.
  2. ⚡ **Automatización** — Controles que hoy son manuales, el sistema los hace solo.
  3. 🎓 **Capacitación** — El sistema guía al personal mientras trabaja.
  4. 🤖 **Inteligencia** — Preguntale al sistema y te responde con datos reales.

### T1-08 — Vista rápida de los módulos
- Los 7 módulos como bloques visuales interconectados (hexágonos o tarjetas):
  - 🚢 M1: Barcos y Clientes
  - 👷 M2: Personal y Talleres
  - 📋 M3: Órdenes de Trabajo y Costos
  - 📦 M4: Pañol, Compras y Stock
  - 💰 M5: Presupuestos y Facturación
  - 🔒 M6: Cierre y Auditoría
  - 📊 M7: Analítica y BI
- _"En el Tramo 2 vamos a entrar en cada uno. Ahora les quiero mostrar cómo se vería usar el sistema."_

### T1-09 — VIDEO: Visión de la app en uso (48 seg)
- Se reproduce el video (las pantallas del sistema en acción).
- Login → Dashboard → OT → Carga asistida → Análisis → Alerta automática.
- Sin hablar durante el video. Dejar que la imagen impacte.
- Al terminar: _"Así de simple sería el día a día."_

### T1-10 — Por qué esta solución es robusta y pensada a futuro
- Desde el punto de vista de **diseño** (no técnico):
  - ✅ **Modular:** Cada área del astillero tiene su módulo independiente, pero todos se conectan.
  - ✅ **Escalable:** Si mañana quieren agregar cuentas corrientes, sueldos o vacaciones, se agrega un módulo sin romper nada.
  - ✅ **Auditable:** Cada acción queda registrada. Nadie puede cambiar datos sin dejar huella.
  - ✅ **Con IA integrada:** No es un capricho, es una ventaja competitiva real (se explica en Tramo 2).
- _"No diseñé un parche. Diseñé un sistema que puede crecer con el astillero."_

### T1-11 — Cierre Tramo 1 / Transición al café
- Resumen visual de lo cubierto.
- _"Esto fue la visión general. Después del café, entramos en detalle: qué hace cada módulo, qué planilla reemplaza, y cómo la IA puede cambiar la forma en que toman decisiones."_
- ☕ **PAUSA**

---

# TRAMO 2: "La Profundidad" (~10 minutos, 14 diapositivas)

### T2-01 — Módulo 1: Barcos y Clientes
- **¿Qué hace?** Gestión centralizada de barcos como activos y sus propietarios (razones sociales).
- **¿Qué planilla reemplaza?** Parte de **GS-008 (BD_NEWSYSTEMM)** — la base de datos maestra actual que alimenta a casi todas las demás planillas.
- **Problema que resuelve:** Hoy el historial de un barco está disperso en múltiples hojas. Con App_AlonCar, entrás al barco y ves: todas sus visitas, todas sus OTs, todo su costo histórico en un solo lugar.
- **Mejora concreta:** _"¿Cuánto nos costó el Barco X en los últimos 2 años? Hoy esa respuesta lleva horas. Con el sistema, son 3 clics."_

### T2-02 — Módulo 2: Personal y Talleres
- **¿Qué hace?** Registro de operarios (internos y externos), talleres, proveedores y tarifarios con vigencia.
- **¿Qué planilla reemplaza?** Parte de **GS-008 (BD_NEWSYSTEMM)** + datos de talleres en **GS-005 (TERCEROS)**.
- **Problema que resuelve:** Hoy los tarifarios se actualizan manualmente y no se guarda historial. Un operario externo puede no estar vinculado a su taller.
- **Mejora concreta:** _"Cambio de tarifa = nueva tarjeta de tarifa, pero la anterior se conserva. Siempre sabés cuánto se pagó en cada momento."_

### T2-03 — Módulo 3: Operaciones y Control de Costos (El Motor)
- **¿Qué hace?** Órdenes de Trabajo, registro de asistencia, imputación de horas, centros de costo. El "Triángulo del Costo" (MO + Materiales + Terceros = Costo Total OT).
- **¿Qué planillas reemplaza?**
  - **GS-001 (HORAS_PLANILLAS_DE_REGISTRO)** — Registro y control de horas.
  - **GS-003 (LISTA_TRABAJOS_EN_PROGRESO)** — OTs activas y su estado.
  - **GS-009 y GS-010 (RECONCILIACIÓN)** — Cruce horas vs. materiales.
- **Problema que resuelve:** Hoy la conciliación reloj vs. imputación no existe o es manual. Las discrepancias se descubren tarde (o nunca).
- **Mejora concreta:** _"El sistema detecta automáticamente si Juan marcó 8 horas en el reloj pero solo se imputaron 4 a la OT. Alerta al gerente el mismo día."_
- Visual: Diagrama del Triángulo del Costo.

### T2-04 — Módulo 4: Logística y Suministros (Pañol)
- **¿Qué hace?** Catálogo de materiales, inventario con stock en tiempo real, órdenes de compra, registro de consumos por OT.
- **¿Qué planillas reemplaza?**
  - **GS-002 (MATERIALES_PLANILLAS_REGISTRO)** — Registro de materiales.
  - **GS-006 (COMPRAS_PLANILLAS_REGISTRO)** — Registro de compras.
  - **GS-007 (CONTROL_DE_STOCK)** — Control de inventario.
- **Problema que resuelve:** Hoy al retirar material del pañol, el stock se actualiza manualmente (o no se actualiza). Las compras directas a obra no siempre se imputan a la OT correcta.
- **Mejora concreta:** _"Retirás 10 latas de pintura del pañol → el stock baja automáticamente. Si baja del mínimo, alerta. Si es compra directa, impacta directo en el costo de la OT."_

### T2-05 — Módulo 5: Comercial (Presupuestos y Facturación)
- **¿Qué hace?** Presupuestos dinámicos, anexos de factura (liquidación final), cálculo automático de IVA con switch MO/Materiales.
- **¿Qué planillas reemplaza?**
  - **GS-011 (DETALLE_DE_PRESUPUESTOS)** — Presupuestos.
  - **GS-012 (PROTOTIPO_MODELO_PUESTA_EN_SECO)** — Modelo de cotización.
  - Parte de **GS-004 (RESUMEN_GERENCIAL)** — Datos de facturación.
- **Problema que resuelve:** Hoy armar un presupuesto y después la liquidación final son procesos separados que no se cruzan automáticamente con el costo real.
- **Mejora concreta:** _"El presupuesto se clona inteligentemente al anexo de factura. Si el costo real cambió, se ajusta. El IVA se calcula solo: mano de obra exenta, materiales al 21%."_

### T2-06 — Módulo 6: Cierre y Auditoría
- **¿Qué hace?** Data Locking automático (OT facturada = nadie toca), archivo histórico por barco/visita/OT, registro de auditoría completo.
- **¿Qué planilla reemplaza?** Parte de **GS-004 (RESUMEN_GERENCIAL)** — El cierre y archivo hoy es manual.
- **Problema que resuelve:** Hoy no hay garantía de que un dato histórico no fue modificado después del cierre. No hay forma de saber quién cambió qué.
- **Mejora concreta:** _"Una vez que la OT se factura, el sistema la bloquea. Nadie puede editarla. Y queda registrado: quién la creó, quién la cerró, quién la facturó."_

### T2-07 — Módulo 7: Analítica y BI (Business Intelligence)
- **¿Qué hace?** Dashboard interactivo con cruce libre de variables, vistas guardadas por usuario, exportación a Excel/PDF.
- **¿Qué mejora?** Hoy el resumen gerencial (**GS-004**) es una planilla estática. Con el módulo de BI, el gerente arrastra variables y cruza datos en tiempo real.
- **Mejora concreta:** _"¿Quiero saber el costo por metro cuadrado de pintura en los últimos 6 meses cruzado con la cantidad de operarios? Lo armo en el canvas, lo guardo como 'mi vista', y la próxima vez ya está lista."_

### T2-08 — El flujo de la información (Manual de procedimientos)
- Diagrama visual completo: cómo fluye un dato desde que nace hasta que se archiva.
- Ejemplo concreto con el flujo de una OT:
  1. Se crea la OT (M3) → vinculada a un Barco (M1) y un Cliente (M1)
  2. Se asignan operarios (M2) → se registra asistencia (M3)
  3. Se imputan horas (M3) → el sistema concilia con el reloj
  4. Se retiran materiales del pañol (M4) → stock se actualiza
  5. Se registran servicios de terceros (M3)
  6. Costo total = MO + Materiales + Terceros
  7. Se genera presupuesto / anexo (M5) → IVA automático
  8. Se cierra y bloquea (M6) → archivo histórico
- _"Este es el manual de procedimientos que me pidieron. El sistema obliga a seguir este flujo."_

### T2-09 — Niveles de autorización y control de acceso
- Quién puede hacer qué:

| Rol | Puede | No puede |
|---|---|---|
| **Operario / Carga** | Cargar horas, registrar consumos, consultar OTs asignadas | Modificar tarifas, cerrar OTs, ver costos globales |
| **Supervisor** | Todo lo anterior + aprobar imputaciones, ver alertas, consultar reportes de su área | Cerrar definitivamente, facturar, modificar presupuestos |
| **Gerencia** | Todo lo anterior + cerrar OTs, facturar, acceder a BI, ver costos globales, auditar | — (acceso total) |
| **Administrador del sistema** | Configuración, tarifas, usuarios, permisos | — (acceso técnico) |

- **Mejora concreta:** _"Cada persona ve solo lo que necesita. Y el sistema registra quién hizo cada acción. Si alguien cargó mal un dato, sabemos quién, cuándo y qué cambió."_

### T2-10 — IA integrada: Asistente de preguntas y respuestas
- **¿Qué es?** Una sección del sistema donde el usuario puede hacer preguntas en lenguaje natural sobre toda la información cargada.
- **Ejemplos reales:**
  - _"¿Cuál es el costo acumulado del Barco Libertad en esta visita?"_ → Respuesta inmediata con desglose.
  - _"¿Qué operarios trabajaron más de 8 horas ayer?"_ → Lista con detalle.
  - _"¿Qué materiales están por debajo del stock mínimo?"_ → Alerta con cantidades.
  - _"¿Cuál fue la rentabilidad promedio de las OTs del último trimestre?"_ → Gráfico comparativo.
- **Por qué funciona:** Toda la información está interrelacionada en una sola base de datos. La IA simplemente la consulta y la presenta de forma comprensible.
- _"No hace falta ser experto en planillas para obtener una respuesta. Preguntás y el sistema te contesta."_

### T2-11 — Módulo de Conocimiento y Procedimientos (IA)
- **¿Qué es?** No es solo un buscador de datos. Es un asistente completo para crear y consultar manuales de procedimientos del astillero.
- **Parte 1: Creación de procedimientos (El Asistente Redactor)**
  - Un gerente plantea un problema y una solución rápida (ej. "Archivar remitos por fecha en la carpeta roja").
  - La IA toma ese texto informal y lo redacta como un documento formal de procedimiento (objetivo, alcance, pasos, responsables).
  - El gerente aprueba → La IA lo guarda, detecta qué áreas están involucradas y les envía una notificación.
- **Parte 2: Consulta (El Asistente Operativo)**
  - Un empleado tiene una duda: *"¿Cómo archivo los remitos?"*
  - El sistema busca en todos los procedimientos aprobados y le da la respuesta exacta paso a paso.
- **Mejora concreta:** _"Se acabó el 'yo no sabía cómo se hacía'. El conocimiento de la empresa queda guardado, estandarizado y al alcance de todos."_

### T2-12 — ¿Qué significa esto para la gerencia?
- No es un robot que reemplaza personas. Es una herramienta que:
  - 🔍 **Estandariza:** Transforma el conocimiento informal (que está en la cabeza de unos pocos) en manuales formales sin esfuerzo.
  - ⏱️ **Ahorra tiempo:** Un reporte o un manual que hoy lleva horas, se arma en segundos.
  - 🎯 **Capacita al personal 24/7:** Guía en la carga de OTs, explica comprobantes, responde dudas de procedimientos.
- _"La IA no reemplaza al gerente. Le saca el trabajo administrativo pesado y le da superpoderes."_

### T2-13 — Visión a futuro: qué más puede conectar
- Hoy resolvemos **costos de obra**. Pero la arquitectura permite conectar:
  - 📑 Cuentas corrientes de clientes y proveedores
  - 💵 Liquidación de sueldos y vacaciones
  - 📊 Control integral de proyectos
  - 🔧 Mantenimiento preventivo de equipos
- _"No es una promesa. Es una posibilidad real del diseño. Cada nuevo módulo se conecta sin romper lo que ya funciona."_
- Sin exagerar. Solo plantar la semilla.

### T2-14 — Cierre y preguntas
- Resumen visual: El sistema actual (12 planillas dispersas) → App_AlonCar (1 plataforma unificada).
- _"Esto es lo que diseñé para resolver lo que me pidieron. ¿Preguntas?"_
- Abrir a la conversación. Si preguntan por costos → sacar la Presentación Bonus.

---

# PRESENTACIÓN BONUS: "Los Números" (solo si engancharon)

### B-01 — Estado del desarrollo
| Aspecto | Estado |
|---|---|
| Diseño de módulos y reglas de negocio | ✅ Completo |
| Mapeo de las 12 planillas (todas documentadas) | ✅ Completo |
| Infraestructura técnica | ✅ Funcionando |
| Interfaces de usuario | 🔧 En desarrollo |
| Automatizaciones y alertas | 🔧 En desarrollo |
| Testing y puesta en marcha | 📋 Pendiente |

Timeline: 3-5 meses para la primera versión funcional.

### B-02 — Inversión para completar

| Concepto | Estimación |
|---|---|
| Horas-hombre restantes (~130h × US$18/h) | ~US$2.340 |
| Herramientas de IA (~4 meses) | ~US$170 |
| **Total para completar** | **~US$2.500** |

| Costos operativos mensuales | Costo/mes |
|---|---|
| Servidor (Hostinger VPS) | ~US$5-10 |
| Base de datos (Supabase) | US$0-25 |
| Otros servicios | ~US$2 |
| **Total operativo** | **~US$7-37** |

### B-03 — Valor de mercado vs. costo real

| Referencia | Rango |
|---|---|
| Lo que cobraría una consultora externa por un sistema así | US$20.000 - US$35.000 |
| Solo el relevamiento del negocio (un externo necesitaría meses) | US$5.000 - US$12.000 |
| **Costo real de este proyecto (conocimiento interno + IA)** | **~US$10.000** |

_"Un externo cobraría US$20.000+ solo por aprender cómo funciona el astillero antes de escribir una línea de código. Yo ya lo sé porque creé las planillas y opero el sistema todos los días."_

### B-04 — Modelo propuesto

**Opción A — Suscripción mensual (recomendada):**
- Cuota de US$150-200/mes todo incluido (uso, hosting, soporte, actualizaciones).
- Sin inversión inicial.
- _"El día que no sirva, lo cancelan."_

**Opción B — Compra:**
- Precio justo: US$10.000-12.000.
- No incluye soporte futuro. Cada mejora se cotiza aparte.
- El sistema tiene potencial enorme de crecimiento — cada extensión es un proyecto adicional.

---

# PLAN DEL VIDEO (sin cambios)

### Secuencia (48 segundos)

| Seg. | Pantalla | Qué se muestra |
|---|---|---|
| 00-05 | **Login** | Acceso limpio y seguro. |
| 05-12 | **Dashboard** | OTs activas, costos del día, alertas. |
| 12-20 | **Detalle de OT** | Barco, operarios, horas, materiales, costo. |
| 20-28 | **Carga asistida** | El sistema guía qué comprobante usar. |
| 28-35 | **Análisis / BI** | Costo presupuestado vs. real. Filtros. |
| 35-42 | **Asistente IA** | Pregunta: "¿Costo del Barco X?" → Respuesta inmediata. |
| 42-48 | **Cierre** | Logo + "Gestión inteligente para tu astillero." |

### Proceso
1. Generar mockups de cada pantalla (imágenes).
2. Revisarlas y corregirlas juntos.
3. Armar el video (presentación web animada para grabar, o imágenes para CapCut/Canva).

---

# ENTREGABLES

| # | Entregable | Formato | Depende de |
|---|---|---|---|
| 1 | Mockups de pantallas (7 imágenes) | Imágenes generadas | Aprobación de este plan |
| 2 | Tramo 1 (11 diapositivas) | HTML Reveal.js o PowerPoint | Mockups aprobados |
| 3 | Tramo 2 (14 diapositivas) | HTML Reveal.js o PowerPoint | Mockups aprobados |
| 4 | Presentación Bonus (4 diapositivas) | Mismo formato | Números finales |
| 5 | Video de visión (48 seg) | Web animada / imágenes | Mockups aprobados |
| 6 | Diagrama de flujo de información | Incluido en T2-08 | — |

---

## Open Questions

> [!IMPORTANT]
> **¿Puedo usar el nombre real del astillero?** Esto cambia la portada y el subtítulo.

> [!IMPORTANT]
> **¿Cuándo es la presentación?** Para saber cuánto tiempo tenemos.

> [!IMPORTANT]
> **¿Preferís las diapositivas como presentación web (HTML interactivo, se abre en el navegador) o como archivo PowerPoint?** La web se ve más moderna y el video se integra fácil. PowerPoint es más tradicional pero más portátil.

> [!IMPORTANT]
> **Sobre el asistente IA (T2-10):** Decís que "no debería ser difícil" tener Q&A con IA sobre los datos. Estoy de acuerdo — con toda la data en Supabase, se puede conectar un LLM (como Claude) que consulte la base y responda. Es viable y lo podemos incluir como feature real, no como promesa. ¿Querés que en la presentación lo mostremos como algo **que ya funciona** o como algo **que el sistema va a incluir**?
