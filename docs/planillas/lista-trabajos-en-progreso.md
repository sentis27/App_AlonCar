# Mapeo Legacy: LISTA DE TRABAJOS EN PROGRESO (Aprobado)

> [!IMPORTANT]
> **Fuentes de información cruzadas:** Descripción detallada del usuario (sesión 2026-07-21), lectura directa vía API (Google Sheets — valores, fórmulas, metadatos de pestañas), análisis del Manual de Usuario interno de la planilla, y descarga completa del código Apps Script (scriptId: `1ANNsx012RUwCV_vvpBFzgw06YpKsz1FZdvODQZpDo9yqsUaqoK2g_drW`).

---

## PARTE A: Diseño Técnico (Para IA / App)

### 1. Clasificación de la Planilla
- **Tipo de Planilla:** TIPO D (Híbrida)
- **Justificación:** Es simultáneamente:
  - **Entrada:** Registro operativo de trabajos (hoja UNIFICADO — carga manual de barco, OT, descripción, estado, contratista, jefe de obra).
  - **Transformación:** Fórmulas de alertas (cols N-Q), código único concatenado (col R), numeración automática de OT (col K via Apps Script), lookup de SlackChannel (col U via VLOOKUP).
  - **Salida:** Hoja ALERTAS (dashboard de alertas por barco y estado), disparador de automatización n8n (aviso de nuevas OTs via Slack).
  - **Base de datos auxiliar:** Hojas ValidacionBarcos (registro de barcos), OT.ABC (catálogo de descripciones tabuladas), B.D.IMPORTADA (lista de contratistas).
> Confianza: CONFIRMADO

### 2. Identidad y Contexto de Negocio
- **ID Planilla:** GS-003
- **Nombre Técnico/Funcional:** LISTA_TRABAJOS_EN_PROGRESO
- **URL / ID:** `https://docs.google.com/spreadsheets/d/1RgD94M9lW9cMDoOTJEydb0F-_nepNz-0djR1F9fYGBE/edit`
- **Departamento Propietario:** Operaciones / Dirección de Obra
- **Usuarios Principales y Rol:**
  - **Andrés (Administración/Operaciones):** Único usuario actual de carga. Registra cada trabajo nuevo, actualiza estados, asigna contratistas y jefes de obra.
  - **Jefes de Obra (ALE C, PABLO NOVARA, HUGO, MARTIN O):** Proveen las descripciones de trabajos y reportan avances. No editan directamente la planilla.
  - **Gerencia:** Consume las alertas y reportes para toma de decisiones.
- **Propósito Principal:** Es el **cerebro operativo del astillero**. Registra TODOS los trabajos activos, su estado en el ciclo de vida (desde pendiente hasta facturado), y alimenta las otras planillas de costos (HORAS, MATERIALES, TERCEROS) con la estructura de barcos y órdenes de trabajo. Es la fuente de verdad de "qué se está haciendo, para quién, y en qué estado está".
- **Frecuencia de Uso:** Diaria (múltiples veces al día).
- **Integraciones Manuales Actuales:**
  - **Entrada:** Descripciones de trabajos llegan verbal o por WhatsApp desde jefes de obra. Barcos se seleccionan de lista interna (ValidacionBarcos). Contratistas se cargan manualmente (B.D.IMPORTADA con IMPORTRANGE roto).
  - **Salida:** Datos de barcos y OTs se exportan (via IMPORTRANGE de otras planillas que consumen esta) hacia HORAS (GS-001) y MATERIALES (GS-002) para alimentar sus menús desplegables. Descripciones se copian/pegan manualmente hacia la planilla de Anexo de Factura para generar remitos y facturas.
> Confianza: CONFIRMADO

### 3. Estructura Visual y Navegación
- **Hojas Existentes (7 pestañas):**
  - **TAB-001:** MANUAL USUARIO (Guía interna de uso — solo lectura)
  - **TAB-002:** UNIFICADO (Registro principal de trabajos — **hoja crítica**)
  - **TAB-003:** ALERTAS (Dashboard de alertas por barco + conteo de estados)
  - **TAB-004:** ValidacionBarcos (Base de datos de barcos — alimenta dropdown col A)
  - **TAB-005:** LOG.OTs (Auditoría de cambios via Apps Script)
  - **TAB-006:** OT. ABC (Catálogo de descripciones tabuladas de OTs estándar)
  - **TAB-007:** B.D.IMPORTADA (Lista de contratistas — IMPORTRANGE roto, carga manual)
  - *Hojas eliminadas (referenciadas en Manual Usuario pero ya no existen):* (Trabajos&Contratistas)Activos, Export.Contrtst.New.Systm, TRANS.TRABAJOS
- **Fila Real de Encabezados:** Fila 1 y fila 5 en UNIFICADO (fila 1 = encabezados técnicos, filas 2-4 = contexto/plantilla para lectura humana, fila 5 = duplicado de encabezados). Los datos comienzan en **fila 6**.
- **Dashboard / Sumatorias Superiores:** No hay sumatorias en UNIFICADO. La hoja ALERTAS funciona como dashboard.
- **Enlaces Rápidos Identificados:** Ninguno detectado.
- **Elementos Visuales Destacados:** Código de colores en pestañas documentado en hoja MANUAL USUARIO (verde=registro, amarillo=alertas, azul=exportación, naranja=importación, gris=transformación, morado=auditoría, rojo=automatizaciones).
> Confianza: CONFIRMADO

### 4. Estructura de Datos y Columnas

**(TAB-002) UNIFICADO** — Hoja principal. Datos desde fila 6. Encabezado en fila 1/5.
| Col | Nombre | Tipo | Ingreso | Notas / Fórmulas Clave |
|---|---|---|---|---|
| A | BARCO | String | LISTA_SIMPLE | Validación de datos contra hoja ValidacionBarcos col A |
| B | FECHA | Date | MANUAL | Fecha de creación del trabajo |
| C | ORDEN DE TRABAJO | String | MANUAL_LIBRE | Nombre descriptivo de la OT (ej: "CAMBIO MOTOR", "VARADERO"). NO es un número secuencial |
| D | Descripcion | String | MANUAL_LIBRE | Texto largo. Detalle específico del trabajo. Soporta saltos de línea |
| E | Estado | Enum | LISTA_SIMPLE | Valores actuales: "En ejecución/En curso", "Pendiente Inicio/Ejecución", "Facturado - CERRADO.", "Remito realizado/Pdte. firma.", "Trabajo Finalizado/Pdte. Remito", "DESESTIMADO", "Finalizado costo final de obra". **Pendiente de simplificación** (ver Parte B) |
| F | Comentario | String | MANUAL_LIBRE | Texto libre auxiliar: presupuestos, materiales esperados, notas especiales |
| G | Contratista / Externo | String | MANUAL_LIBRE | Uno o más contratistas separados por coma. **Debería** ser LISTA_DINAMICA desde B.D.IMPORTADA pero el IMPORTRANGE está roto. Se carga a mano actualmente |
| H | TIPO COMPROBANTE | Enum | MANUAL_LIBRE | Valores posibles: Remito, Factura, PRC. **No habilitado actualmente** — pensado para vincular con comprobantes fiscales |
| I | # COMPROBANTE | String | MANUAL_LIBRE | Número interno del comprobante. **No habilitado actualmente** |
| J | JEFE DE OBRA | String | LISTA_SIMPLE | Validación de datos manual (sin B.D. formal). Valores observados: ALE C, PABLO NOVARA, HUGO, MARTIN O |
| K | NUMERO DE OT | Number | SCRIPT | Generado por Apps Script. Debería ser un consecutivo por barco pero **no funciona correctamente**. Lógica actual asigna un número que no refleja la relación muchos-trabajos-a-una-OT |
| L | usuario_origen | String | MANUAL/AUTO | Email o ID del usuario que creó el registro. Actualmente vacío (solo lo usa Andrés) |
| M | enviar notificacion | Enum | MANUAL | "Enviar" o "noEnviar". Disparador manual para la automatización n8n de aviso de nuevas OTs via Slack |
| N | SIN OT | Formula | FORMULA | `=IFERROR(IF(A6="";""​;IF(AND(D6<>"";E6="En ejecución/En curso.";C6="");"S/OT";"C/OT")))` — Alerta si tiene descripción y estado activo pero **falta nombre de OT** |
| O | SIN DESCRPCION | Formula | FORMULA | `=IFERROR(IF(A6="";""​;IF(AND(C6<>"";E6<>"DESESTIMADO";D6="");"S/DESCRPCN";"C/DESCRPCN")))` — Alerta si tiene OT pero **falta descripción** |
| P | SIN CONTRATISTA | Formula | FORMULA | `=IFERROR(IF(A6="";""​;IF(AND(C6<>"";E6<>"DESESTIMADO";D6<>"";G6="");"S/CONTRATISTA";"C/CONTRATISTA")))` — Alerta si tiene OT+descripción pero **falta contratista** |
| Q | SIN # COMPROBANTE | Formula | FORMULA | `=IF(OR(E6="Remito realizado/Pdte. firma."; E6="Facturado - CERRADO.");IF(I6="";"S/#";"OK");"")` — Alerta solo cuando el estado es "Remito realizado" o "Facturado" y **falta número de comprobante** |
| R | Cod.UnicoBarco&jefeObra | String | MANUAL/FORMULA | Concatenación de BARCO;OT;Estado. Usado para cruce con otras planillas. **El usuario indica que ya no es relevante** con sistema interconectado |
| S | Cod.UnicoOt&Estado | String | — | Vacío en todos los registros observados. Sin uso actual |
| T | ENVIO AVISO | String | AUTOMATICO | Escrito por n8n: "DD/MM/YYYY, Enviado" — timestamp del envío de notificación |
| U | SlackChannel_ID | String | FORMULA | `=IF(A6="";"";VLOOKUP(A6;ValidacionBarcos!A:B;2;FALSE))` — Busca el canal de Slack del barco para enviar la notificación |
| V | SeCreoOT | String | AUTOMATICO | Escrito por n8n: "CreadaOT" (nueva OT) o "YaExiste" (trabajo agregado a OT existente) |

**(TAB-003) ALERTAS** — Dashboard. Columna A dinámica vía `SORT(UNIQUE(FILTER(...)))`.
| Col | Nombre | Fórmula |
|---|---|---|
| A | BARCO | `=SORT(UNIQUE(FILTER(UNIFICADO!A6:A;UNIFICADO!E6:E="En ejecución/En curso")))` — Lista dinámica de barcos con trabajos activos |
| B | FALTA ORDEN DE TRABAJO | `=IF(A3="";"";COUNTIFS(UNIFICADO!N$6:N;"S/OT";UNIFICADO!A$6:A;A3))` — Cuenta alertas S/OT por barco |
| C | FALTA DESCRIPCION | `=IF(B3="";"";COUNTIFS(UNIFICADO!O$6:O;"S/DESCRPCN";UNIFICADO!A$6:A;A3))` |
| D | FALTA CONTRATISTA | `=IF(A3="";"";COUNTIFS(UNIFICADO!P$6:P;"S/CONTRATISTA";UNIFICADO!$A$6:$A;A3))` |
| E | FALTA NUMERO DE COMPROBANTE | `=IF(A3="";"";COUNTIFS(UNIFICADO!Q$6:Q;"S/#";UNIFICADO!$A$6:$A;A3))` |
| F | En ejecución/En curso. | `=COUNTIFS(UNIFICADO!$E$6:$E;$F$2;UNIFICADO!$A$6:$A;$A3)` — Cuenta trabajos por estado por barco |
| G | Facturado - CERRADO. | `=COUNTIFS(UNIFICADO!$E$6:$E;$G$2;UNIFICADO!$A$6:$A;$A3)` |
| H | Pendiente Inicio/Ejecución. | `=COUNTIFS(...)` |
| I | Remito realizado/Pdte. firma. | `=COUNTIFS(...)` |
| J | Trabajo Finalizado/Pdte. Remito | `=COUNTIFS(...)` |

**(TAB-004) ValidacionBarcos** — Base de datos de barcos.
| Col | Nombre | Tipo | Ingreso | Notas |
|---|---|---|---|---|
| A | BARCO | String | MANUAL | Nombre del barco. ~60 registros. Fuente de verdad para la lista desplegable de UNIFICADO col A |
| B | SlackChannel_ID | String | MANUAL | ID del canal de Slack para notificaciones. Solo ~20 barcos tienen canal asignado |
| C | razon_social_id | String | — | Vacío. Debería conectar con planilla de clientes (futura) |
| D | matricula | String | — | Vacío. Debería conectar con planilla de clientes (futura) |

**(TAB-005) LOG.OTs** — Auditoría via Apps Script.
| Col | Nombre | Tipo | Notas |
|---|---|---|---|
| A | Fecha y hora | DateTime | Timestamp del evento |
| B | Barco | String | Barco afectado |
| C | Número de OT | Number | Número asignado |
| D | Código Único | String | Concatenación BARCO;OT;Estado |
| E | Usuario | String | Email del usuario (ej: tspqingresos@gmail.com) |
| F | Acción | String | "OT generado" o "Código generado" |

**(TAB-006) OT. ABC** — Catálogo de descripciones estándar.
- Columna A contiene nombres de tipos de trabajo estándar de varadero (SERVICIOS, VARADERO, RET. SERV. NO CONTAMINANTES, SONDAJES ULTRASONICOS, PROTECCION GALVANICA, TOMAS DE MAR, VALVULAS DE CASCO, etc.).
- Debajo de cada nombre hay párrafos con la descripción detallada que se copia/pega en UNIFICADO col D.
- Columna K contiene una lista adicional de tipos de OT (VARADERO, RET. SERV. NO CONTAMINANTES, SONDAJES ULTRASONICOS, PROTECCION GALVANICA, TOMAS DE MAR, VALVULAS DE CASCO E INTERMEDIARIAS, POCETES DE ACHIQUE, DESMONTE LINEA EJE Y TIMON, LINEA DE EJE, LINEA DE TIMON, CARENADO DE CASCO, SUPER ESTRUCTURA Y CUBIERTA, Anclas y Cadenas, TANQUES, SENTINA).

**(TAB-007) B.D.IMPORTADA** — Lista de contratistas.
- **Celda A1:** Muestra `#REF!` — IMPORTRANGE roto.
- **Celda A2:** "PERSONAL PARA LISTA DE TRABAJOS" (título).
- **Desde A3:** Lista manual de ~48 contratistas/grupos de trabajo, duplicados en col A y B (ej: "ASTILLERO.CALDERERIA", "ASTILLERO.RASCHINAJE", "AVALOS", "ELECTRICIDAD NAVAL SA", "RAMON", etc.).
- **Categorías observadas:** Personal interno del astillero (ASTILLERO.*), talleres externos (TECO TALLER, CAITO TALLER, FUNDICION, etc.), contratistas individuales (AVALOS, RAMON, TANO, etc.), servicios especializados (ELECTRICIDAD NAVAL SA, FRIGORISTA, ARENADO).

> Confianza: CONFIRMADO

### 5. Lógica de Validaciones y Alertas
- **Alertas en UNIFICADO (Columnas N-Q):**
  - No evalúan simplemente si la celda está vacía, sino que aplican lógica condicional cruzada:
    - **Col N (S/OT):** Solo marca alerta si hay descripción Y estado activo PERO falta nombre de OT.
    - **Col O (S/DESCRPCN):** Solo marca alerta si hay OT Y el estado NO es DESESTIMADO PERO falta descripción.
    - **Col P (S/CONTRATISTA):** Solo marca alerta si hay OT + descripción Y estado NO es DESESTIMADO PERO falta contratista.
    - **Col Q (S/#):** Solo marca alerta si el estado es "Remito realizado" o "Facturado" PERO falta número de comprobante.
  - Patrón: Escalonamiento lógico progresivo. Cada alerta asume que los campos anteriores ya están completos.
- **Dashboard ALERTAS:** Consolida todas las alertas por barco con COUNTIFS. También cuenta trabajos por estado por barco (cols F-J), permitiendo ver de un vistazo cuántos trabajos activos, pendientes, facturados, etc. tiene cada barco.
- **Validaciones de Datos:**
  - Col A (BARCO): Lista desde ValidacionBarcos!A:A.
  - Col E (Estado): Lista predefinida de valores.
  - Col J (JEFE DE OBRA): Lista manual sin base de datos formal.
  - Col M (enviar notificacion): "Enviar" / "noEnviar".
> Confianza: CONFIRMADO

### 6. Lógica de Código (Apps Script)
- **¿Posee código atado (`.gs`)?**: Sí
- **Script ID:** `1ANNsx012RUwCV_vvpBFzgw06YpKsz1FZdvODQZpDo9yqsUaqoK2g_drW`
- **Archivos detectados (6):**
  - `appsscript.json` — Configuración. Timezone: America/Argentina/Buenos_Aires. Runtime: V8.
  - `SepararContratista.gs` — **HUÉRFANO.** Referencia hojas eliminadas.
  - `TransportDatosEjecucucion.gs` — **HUÉRFANO.** Referencia hoja eliminada.
  - `GenerarListaBarcoAndOT.gs` — **HUÉRFANO.** Referencia hoja eliminada.
  - `generarNumerosYCodigosUnicos.gs` — **ACTIVO.** Función principal de numeración.
  - `Botones#Ot/trazabilidad.gs` — Wrappers para botones manuales.

- **Funciones Detectadas:**

  **1. `generarNumerosYCodigosUnicos()` — ACTIVA**
  - **Qué hace:** Recorre UNIFICADO desde fila 6. Para cada fila con barco pero SIN número de OT (col K vacía), calcula el siguiente número consecutivo **por barco** (busca el máximo existente para ese barco y suma 1). También genera un código único concatenando `BARCO;OT;Estado` en col R si está vacío.
  - **Escribe en:** Col K (número OT), Col R (código único), hoja LOG.OTs (auditoría).
  - **Lógica de numeración:** `mapaOTporBarco[barco] = MAX(números existentes para ese barco) + 1`. Es un consecutivo global por barco, NO por OT. Esto significa que cada nuevo trabajo recibe un número distinto incluso si pertenece a la misma OT.
  - **Auditoría:** Escribe en LOG.OTs: [Fecha, Barco, NúmeroOT, CódigoÚnico, Email, Acción]. Usa `Session.getActiveUser().getEmail()` con fallback `"n8n-bot"`.
  - **Trigger:** NO tiene trigger automático. Se ejecuta manualmente via botón (`botonGenerarCodigosUnicos()`).
  - **Problema confirmado:** La numeración no agrupa trabajos bajo una misma OT. Si "CAMBIO MOTOR" tiene 3 trabajos, cada uno recibe un número distinto (63, 65, etc. en los datos observados) en vez de compartir uno solo.

  **2. `sincronizarDesdeHojaActivos()` — HUÉRFANA**
  - **Qué hace:** Lee datos de la hoja `(Trabajos&Contratistas)Activos`, separa contratistas múltiples (separados por coma) en filas individuales, y escribe el resultado en `Export.Contrtst.New.Systm`.
  - **Estado:** ❌ Las hojas `(Trabajos&Contratistas)Activos` y `Export.Contrtst.New.Systm` **ya no existen**. El código no hace nada.
  - **Restricción horaria:** Solo ejecuta L-V de 08:00 a 17:00.

  **3. `generarHojaTransformada()` — HUÉRFANA**
  - **Qué hace:** Lee UNIFICADO, filtra trabajos en estado "En ejecución/En curso", y genera una hoja `TRANS.TRABAJOS` con columnas reducidas (Barco, Fecha, OT, Contratista, Jefe Obra, Usuario, Código Único).
  - **Estado:** ❌ La hoja `TRANS.TRABAJOS` **fue eliminada**. Si se ejecuta, se recrearía automáticamente (`insertSheet`).

  **4. `generarExportPorBarco()` — HUÉRFANA**
  - **Qué hace:** Agrupa OTs activas por barco y las escribe en columnas (un barco por columna) en la hoja `Export.Ot.P/B.D.New.Systm`. Excluye estados: DESESTIMADO, Facturado, Pendiente Inicio, Finalizado/Pdte Remito.
  - **Estado:** ❌ La hoja `Export.Ot.P/B.D.New.Systm` **no existe**. Si se ejecuta, se recrearía.

  **5. `botonGenerarCodigosUnicos()` y `botonGenerarExportBarco()` — Wrappers**
  - Simplemente llaman a las funciones principales. Diseñados para asignarse a botones en la planilla.

- **Triggers Activos:** Ningún trigger automático detectado (no hay `onEdit`, `onOpen`, ni time-driven). Todas las funciones se ejecutan vía botones manuales.
- **Restricciones Ocultas:**
  - `sincronizarDesdeHojaActivos` tiene restricción horaria (L-V 08:00-17:00).
  - `generarHojaTransformada` también tiene restricción horaria idéntica.
  - `generarExportPorBarco` NO tiene restricción horaria.
- **Riesgos Detectados:**
  - **3 de 4 funciones son huérfanas** — referencian hojas eliminadas. No causan error (retornan silenciosamente si la hoja no existe) pero ocupan espacio y confunden.
  - **Numeración no agrupa OTs** — problema confirmado en el código: asigna consecutivo global por barco, no reutiliza número cuando la OT ya existe.
  - **Email de servicio visible:** `tspqingresos@gmail.com` aparece en LOG.OTs porque es el email de la cuenta de Google que ejecuta el script.
  - **Lectura de 3000 filas hardcodeada** en `sincronizarDesdeHojaActivos` — ineficiente si se reactivara.
> Confianza: CONFIRMADO

### 7. Mapa Relacional de Dependencias (CRÍTICO)

**Dependencias Entrantes (De dónde consume):**
| Planilla Origen | ID Spreadsheet | Hoja Origen | Qué Importa | Lógica de Negocio |
|---|---|---|---|---|
| B.D.NewSystemm | Desconocido — pendiente detección | — | Lista de contratistas (B.D.IMPORTADA) | **IMPORTRANGE ROTO** — celda A1 muestra `#REF!`. Se carga manualmente. Debería traer personal clasificado por tipo (interno/externo/taller) |
| Planilla de Clientes (futura) | Desconocido — pendiente creación | — | Razón social y matrícula (ValidacionBarcos cols C-D) | Campos vacíos. Pendiente de implementación |

**Dependencias Salientes (Quién la consume):**
| Consumidor | ID Spreadsheet | Qué Consume | Para Qué |
|---|---|---|---|
| HORAS_PLANILLAS_DE_REGISTRO (GS-001) | `1QbU6NnKpfTZYlLYa3SIEQSnt5PFfE4xj31U9Zuvl7t0` | Barcos y OTs (via IMPORTRANGE a B.D.IMPORTADA) | Alimenta los menús desplegables de Barco → OT en la hoja HORAS |
| MATERIALES_PLANILLAS_REGISTRO (GS-002) | `15KJs46bgxM6NmME_vLd4XZc7EetKtQgtGDbhbCbKcSI` | Barcos y OTs (via IMPORTRANGE a B.D.IMPORTADA) | Alimenta los menús desplegables de Barco → OT en la hoja MATERIALES |
| n8n: Aviso de nuevas OTs | — | Hoja UNIFICADO (col M=Enviar, cols A-E, col U=SlackChannel) | Envía notificación via Slack cuando se crea una nueva OT o se agrega un trabajo a una existente |
| Planilla de Anexo de Factura | Desconocido — pendiente mapeo | Descripciones (col D), costos consolidados | Manual: copiar/pegar descripciones para generar remitos y facturas |
| Planilla de TERCEROS | Desconocido — pendiente mapeo | OTs y contratistas externos | Para vincular costos de talleres externos con las OTs |

> Confianza: CONFIRMADO

### Automatización n8n Activa

**Flujo: Aviso de nuevas Órdenes de Trabajo (via Slack)**
| Componente | Descripción |
|---|---|
| **Trigger** | Polling o webhook sobre hoja UNIFICADO |
| **Condición** | Col M = "Enviar" |
| **Lectura** | Barco (A), OT (C), Descripción (D), Estado (E), SlackChannel_ID (U) |
| **Envío** | Mensaje a canal de Slack específico del barco |
| **Marca** | Escribe en col T: "DD/MM/YYYY, Enviado". Escribe en col V: "CreadaOT" o "YaExiste" |
| **Estado** | Activo en producción. Registrado en workflows/ del repo |

> Confianza: CONFIRMADO

### 8. Validaciones y Constraints de Negocio

| Regla de Negocio / Constraint | Entidad / Tabla Responsable en SQL | Estado Actual en el Astillero |
|---|---|---|
| Una OT agrupa múltiples trabajos. Relación muchos-a-uno (Trabajos → OT) | WorkOrder + WorkItem (gap) | **Vacío de control.** No hay distinción formal entre OT y Trabajo. Cada fila es un "trabajo" pero la col C contiene el nombre de la OT, que se repite en múltiples filas |
| Una OT no puede cerrarse si tiene trabajos en estado "En ejecución" | WorkOrder (status computed from WorkItems) | **Vacío de control.** No existe contador ni bloqueo. El cierre es manual y sin validación |
| Un trabajo que NO esté en estado "En ejecución" (ej. "Finalizado", "Pendiente remito", etc.) debe bloquear estrictamente la carga de horas, materiales, terceros y compras para ese trabajo específico | WorkItem.status → TimeImput + Consumption + ThirdParty + Purchase (FK constraint) | **Vacío de control.** Hoy no hay bloqueo. El único estado que debe permitir carga de costos es "En ejecución", pero actualmente se pueden imputar costos en cualquier estado |
| Un trabajo marcado como "Pendiente remito" debe generar alerta para el operario encargado de remitos | WorkItem.status → NotificationRule | **Vacío de control.** No hay alerta automática para generar remitos |
| Un contratista solo puede ser asignado si existe en la base de datos | Worker/Workshop FK constraint | **Vacío de control.** Se escribe a mano sin validación |
| Todo trabajo debe tener: Barco + OT + Descripción + Contratista antes de estar "En ejecución" | WorkItem (NOT NULL constraints) | **Control parcial.** Las alertas (cols N-Q) detectan faltantes pero no bloquean la carga |
| No se puede facturar sin número de comprobante | WorkItem.status + InvoiceAttachment | **Control parcial.** Alerta en col Q pero no bloquea el cambio de estado |

> Confianza: CONFIRMADO

### 9. Requerimientos de Migración a Supabase/n8n
> **REGLA:** Toda tabla implicada DEBE mapearse contra una entidad del catálogo en `INDICE_PLANILLAS.md`.

**Entidades del catálogo implicadas:**
- `WorkOrder` (M3) ← La OT como agrupador de trabajos. Col C de UNIFICADO (nombre descriptivo).
- `Ship` (M1) ← Barcos. Col A de UNIFICADO + hoja ValidacionBarcos completa.
- `Owner` (M1) ← Razón social. ValidacionBarcos col C (vacío hoy, futura conexión con planilla de clientes).
- `Worker` (M2) ← Contratistas internos y externos. Col G de UNIFICADO + B.D.IMPORTADA.
- `Workshop` (M2) ← Talleres externos. Subconjunto de contratistas (TECO TALLER, CAITO TALLER, FUNDICION, TORNERIA, etc.).
- `CostCenter` (M3) ← Implícito: cada trabajo genera costos que se imputan a la OT del barco.
- `InvoiceAttachment` (M5) ← Cols H-I (tipo y número de comprobante), flujo de remitos/facturas.
- `AuditTrail` (M6) ← Hoja LOG.OTs.
- `Quote` (M5) ← Descripciones tabuladas de OT.ABC que alimentan presupuestos estándar.

**Gaps de Roadmap detectados:**
- **`WorkItem` (entidad nueva necesaria):** Hoy no existe en el catálogo. Cada fila de UNIFICADO es un **trabajo individual** dentro de una OT. La OT agrupa trabajos. Necesitamos una entidad `WorkItem` con FK a `WorkOrder`. Esto es **CRÍTICO** porque toda la lógica de estados, bloqueos, y conteo de trabajos activos depende de esta separación.
- **`Foreman` / `ProjectManager` (entidad nueva o campo en Worker):** Los jefes de obra (col J) no son contratistas ni operarios — son supervisores. Necesitan una entidad propia o un rol diferenciado dentro de `Worker`. Relaciones: un jefe de obra supervisa muchos trabajos, muchas OTs, y muchos barcos. Múltiples jefes de obra pueden supervisar un mismo barco (uno de carpintería, otro de calderería).
- **`WorkOrderTemplate` (entidad nueva):** La hoja OT.ABC contiene descripciones estándar tabuladas que se repiten (VARADERO, TOMAS DE MAR, VALVULAS DE CASCO, etc.). Candidata a una tabla de templates que auto-complete la descripción al seleccionar un tipo de OT predefinida.
- **`AppUser` (entidad nueva — transversal):** El usuario menciona la necesidad de una base de datos de usuarios de la aplicación con roles, accesos por sección, y trazabilidad de quién carga cada dato. No puede ser solo por email porque "algunos correos lo usan dos personas".
- **`SlackIntegration` (campo en Ship o tabla separada):** ValidacionBarcos col B almacena el canal de Slack de cada barco. En Supabase, esto podría ser un campo en la tabla `Ship` o una tabla de integraciones.

**Campos a Conservar:**
- BARCO (A), FECHA (B), ORDEN DE TRABAJO (C), Descripcion (D), Estado (E), Comentario (F), Contratista/Externo (G), JEFE DE OBRA (J), NUMERO DE OT (K — con lógica corregida), enviar notificacion (M).

**Campos a Descartar (Basura):**
| Campo | Justificación |
|---|---|
| H (TIPO COMPROBANTE) | No habilitado. Se resolverá como FK en `InvoiceAttachment` |
| I (# COMPROBANTE) | No habilitado. Ídem |
| L (usuario_origen) | Vacío. Se reemplaza por auditoría automática en Supabase (campo `created_by` con FK a `AppUser`) |
| N-Q (Alertas) | Serán reemplazadas por validaciones en Supabase (constraints NOT NULL, triggers, RLS) |
| R (Cod.UnicoBarco&jefeObra) | Concatenación manual para cruce. Innecesario con JOINs SQL |
| S (Cod.UnicoOt&Estado) | Vacío. Sin uso |
| T (ENVIO AVISO) | Metadata de n8n. Se reemplaza por tabla de logs de notificaciones |
| U (SlackChannel_ID) | VLOOKUP. Se resuelve con JOIN a tabla Ship |
| V (SeCreoOT) | Metadata de n8n. Se reemplaza por tabla de logs |

**Campos Faltantes (Necesarios a futuro):**
- `work_order_id` (FK a WorkOrder) — Reemplaza el nombre textual de la OT.
- `work_item_status` — Estado del trabajo individual (separado del estado de la OT).
- `work_order_status` — Estado computed de la OT (basado en conteo de WorkItems activos).
- `active_work_items_count` — Contador de trabajos activos en una OT.
- `total_cost` — Costo consolidado (horas + materiales + terceros) por OT.
- `assigned_workers[]` — Array de contratistas (hoy es texto libre separado por comas).
- `foreman_id` — FK a tabla de jefes de obra.
- `created_by` — FK a AppUser.
- `updated_at` — Timestamp de última modificación.
- `closed_at` — Timestamp de cierre de OT.

**Transformaciones Necesarias:**
- Separar la entidad WorkOrder de WorkItem (hoy ambos conviven en la misma fila).
- Normalizar contratistas: de texto libre con comas ("ASTILLERO.CALDERERIA, ASTILLERO.RASCHINAJE") a tabla intermedia `work_item_workers` (M:N).
- Normalizar jefes de obra: crear tabla `Foreman` o rol en `Worker`.
- Migrar descripciones tabuladas (OT.ABC) a tabla `WorkOrderTemplate`.
- Implementar máquina de estados para WorkItem y WorkOrder con transiciones validadas.
- Conectar ValidacionBarcos con tabla de clientes (Owner) para completar razón social y matrícula.

**Automatizaciones Candidatas (n8n):**
| Flujo | Estado | Descripción |
|---|---|---|
| Aviso nuevas OTs (Slack) | **Ya implementado** | Migrar lectura a Supabase. Trigger por INSERT en work_items en vez de polling |
| Generación automática de remitos | **Candidato CRÍTICO** | Cuando un trabajo pasa a "Pendiente remito", auto-generar documento con descripción + costos consolidados. Reducir trabajo manual de copiar/pegar |
| Alerta de trabajos sin datos completos | Candidato | Reemplazar las fórmulas de alertas (cols N-Q) por notificaciones push a los jefes de obra responsables |
| Cierre automático de OT | **Candidato CRÍTICO** | Cuando todos los WorkItems de una OT pasan a "Finalizado", cambiar el estado de la OT a "Cerrada" y bloquear carga de costos. Generar resumen de costos para el gerente de ventas |
| Resumen de costos por OT para facturación | **Candidato CRÍTICO** | Al cerrar una OT, consolidar: descripción (desde esta planilla) + costo horas (GS-001) + costo materiales (GS-002) + costo terceros (pendiente mapeo). Enviar al gerente de ventas |
| Auto-completar descripción desde template | Candidato | Al seleccionar un tipo de OT tabulada (de OT.ABC), auto-llenar la descripción |
| Notificación a contratistas externos | Candidato (baja prioridad) | Cuando un trabajo se asigna a un taller externo, notificar y alertar sobre envío de materiales pendiente |

> Confianza: CONFIRMADO

---

## PARTE B: Lógica de Negocio (Para Humanos)

### Propósito y Uso en la Vida Real
Esta planilla es el **sistema nervioso central del astillero**. Todo trabajo que se realiza — desde una reparación menor de una válvula hasta un varadero completo con halaje, arenado y pintado — nace aquí. Es la primera planilla que se abre al día, y la que más se consulta.

Su función fundamental es responder a cinco preguntas clave:
1. **¿Qué se está haciendo?** → Descripción del trabajo.
2. **¿Para quién?** → Barco + Razón Social.
3. **¿En qué estado está?** → Desde "Pendiente" hasta "Facturado".
4. **¿Quién lo está haciendo?** → Personas y contratistas que ejecutan el trabajo.
5. **¿Quién es responsable de ese trabajo?** → Jefe de obra asignado.

### El Concepto Clave: Orden de Trabajo vs. Trabajo

Esta es la abstracción más importante de todo el sistema y la que más dolores de cabeza causa actualmente:

- Una **Orden de Trabajo (OT)** es un contenedor lógico. Se abre para un barco con un tema general (ej: "CAMBIO MOTOR").
- Dentro de esa OT pueden nacer **múltiples trabajos** a lo largo del tiempo. Hoy se necesita desmontar la carpintería. Mañana descubren que hay que cambiar una chapa. Pasado mañana hay que alinear el motor. Son 3 trabajos distintos, pero todos bajo la misma OT "CAMBIO MOTOR" del barco "DON VICENTE VUOSO".
- **Hoy en la planilla:** Cada trabajo es una fila. La OT se repite textualmente en la columna C. No hay un número de OT que los vincule formalmente (la columna K intenta hacerlo pero falla).
- **La consecuencia:** Cerrar una OT es un dolor porque no existe un mecanismo que cuente cuántos trabajos están activos. Si uno de los 3 trabajos se termina, el jefe de obra reporta "Finalizado", pero la OT sigue abierta porque los otros 2 siguen en curso. Hoy esto se maneja de cabeza — Andrés sabe mentalmente qué OTs tienen trabajos pendientes.

### El Ciclo de Vida de un Trabajo (Máquina de Estados)

```
Pendiente de inicio
    ↓
En ejecución ←─── (puede recibir costos: horas, materiales, terceros)
    ↓
Finalizado ─────── (el trabajo terminó, pero la OT puede seguir abierta)
    ↓ (si requiere remito)              ↓ (si es tabulada/dique)
Pendiente remito                    Finalizado costo final de obra
    ↓                                   ↓
Remito realizado/Pdte firma         Anexo de factura (externo)
    ↓                                   ↓
Facturado ──────── (estado final)   Facturado ──── (estado final)

Desestimado ───── (en cualquier punto, se descarta)
```

**Dos caminos hacia la facturación:**
1. **Camino A (con remito individual):** Trabajo finalizado → se genera un remito por trabajo → el dueño del barco lo firma → se factura individualmente.
2. **Camino B (con anexo de factura global):** Para trabajos de varadero tabulados, no se hace remito individual. Se genera un "Anexo de Factura" que es un resumen de TODOS los trabajos de esa estadía del barco, con sus costos consolidados. Se envía junto con la factura.

### El Bloqueo que Falta y la Pantalla Interactiva de Carga de Costos (Pañol, Horas y Terceros)

Hoy, cuando un trabajo pasa a "Finalizado" (o cualquier estado que no sea "En ejecución"), **nada impide** que un carpintero o contratista retire materiales del pañol, impute horas o cargue gastos de terceros/compras a esa OT. El único estado que debe permitir ingresar costos es **"En ejecución"**; cualquier otro estado debe bloquear la imputación de manera estricta.

Para solucionar esto en el día a día y eliminar la ambigüedad en los puntos de carga de costos (Pañol, Registro de Horas y Carga de Terceros), el flujo de la **pantalla interactiva de carga de datos** funcionará con la siguiente lógica en cascada:

1. **Selección de Barco y Contratista/Persona:** En el día a día, el primer dato más obvio y fácil de obtener es el **Barco**. El segundo dato, igualmente claro y directo, es la **persona o contratista** que está retirando el material, reportando las horas o cargando el servicio tercero.
2. **Filtrado dinámico de OTs disponibles:** Al ingresar esos dos datos (por ejemplo, seleccionar el barco *Don Vicente Vuoso* y el contratista *Ramón*), el sistema desplegará en la lista **únicamente las órdenes de trabajo activas (En ejecución) para las cuales está habilitado o asignado ese contratista en ese barco**.
3. **Descripción flotante (Ayuda memoria en vivo):** Cuando el pañolero o el encargado de horas seleccione una de las OTs de la lista desplegable (ej. *Cubierta*), aparecerá automáticamente en pantalla un panel o cuadro flotante con la **descripción detallada del trabajo** (leyendo qué se está haciendo exactamente en ese trabajo). 
4. **Eliminación del margen de error:** Esta ayuda memoria visual en tiempo real le permite al operario confirmar de inmediato que está cargando el costo a la orden de trabajo correcta. Al resolverse la selección de manera tan guiada y precisa, prácticamente se **elimina la necesidad de automatizaciones que envíen avisos o recordatorios de órdenes de trabajo**, ya que no habrá margen de error durante el registro.

En resumen, el sistema en los puntos de imputación verificará en tiempo real el estado (`WorkItem` activo en "En ejecución"), filtrará las opciones según la persona/contratista y brindará la descripción flotante como ayuda memoria para garantizar la integridad del dato desde el origen.

### Los Jefes de Obra

Son una pieza clave del flujo pero no tienen presencia formal en el sistema. Hoy son solo un texto en la columna J. En la realidad:
- Un jefe de obra **supervisa** múltiples trabajos en múltiples barcos.
- Un barco puede tener **múltiples jefes de obra** (uno de carpintería, otro de calderería).
- Los jefes de obra son quienes **proveen la información**: descripciones de trabajo, reportes de avance, indicación de que un trabajo terminó.
- Son los principales **destinatarios de las alertas**: "Falta descripción del trabajo X del barco Y".

### Las Descripciones Tabuladas (OT.ABC) y la Oportunidad

La hoja OT.ABC es un tesoro oculto. Contiene descripciones estándar para los ~15 tipos de trabajo más comunes en un varadero (VARADERO, TOMAS DE MAR, VALVULAS DE CASCO, PROTECCION GALVANICA, etc.). Hoy, el usuario debe ir manualmente a esa hoja, buscar el tipo de trabajo, copiar la descripción, y pegarla en UNIFICADO col D.

**Visión de mejora:** Un selector "Tipo de OT" con dos opciones:
1. **OT tabulada:** Selecciono de una lista (VARADERO, TOMAS DE MAR, etc.) y la descripción se auto-completa.
2. **OT libre:** Escribo una descripción personalizada.

### La Conexión con Facturación (Vista Panorámica)

Esta planilla es el punto de partida del ciclo comercial:
1. **Nace aquí:** Trabajo registrado con barco + OT + descripción.
2. **Se alimenta en otros lados:** Las planillas de HORAS (GS-001), MATERIALES (GS-002), y TERCEROS (pendiente) registran costos contra esta OT.
3. **Se cierra aquí:** Cuando todos los trabajos finalizan, la OT se cierra.
4. **Se factura afuera:** El gerente de ventas toma la descripción (de aquí) + los costos consolidados (de las otras 3 planillas) y genera el Anexo de Factura con el precio final de venta.

Hoy, el paso 4 es 100% manual: copiar descripciones, sumar costos a mano, pegar en otra planilla con formato especial. El sistema nuevo debería generar esto automáticamente al cerrar una OT.

### Deuda Técnica y Dolores Críticos

1. **IMPORTRANGE roto (B.D.IMPORTADA):** La lista de contratistas debería venir automáticamente de B.D.NewSystemm. Está roto (`#REF!`). Se carga a mano. Funciona porque no cambia frecuentemente, pero es frágil.
2. **Numeración de OT inútil (col K):** El script asigna un número consecutivo pero no agrupa trabajos bajo la misma OT. Genera confusión.
3. **Hojas eliminadas con código huérfano:** (Trabajos&Contratistas)Activos, Export.Contrtst.New.Systm, TRANS.TRABAJOS fueron eliminadas pero sus funciones .gs probablemente siguen en el proyecto.
4. **Contratistas como texto libre:** Múltiples contratistas se separan con comas en una sola celda. Imposible hacer reporting preciso por contratista.
5. **Sin historial de estados:** No hay log de cuándo un trabajo pasó de "En ejecución" a "Finalizado". Solo el estado actual.
6. **Manual de Usuario desactualizado:** Menciona hojas y columnas que ya no existen. Las letras de columna del manual no coinciden con la planilla actual.
7. **Jefes de obra sin base de datos:** Se agregan ad-hoc a la validación de datos sin registro formal.

### Visión de Mejora (Rumbo a la App)

1. **Separar WorkOrder de WorkItem:** El cambio arquitectónico más importante. Permite implementar conteo de trabajos activos, cierre automático de OT, y bloqueos.
2. **Formulario simplificado para crear trabajos:** Seleccionar barco → seleccionar OT existente o crear nueva → elegir tipo (tabulada o libre) → completar descripción → asignar contratistas (multi-select) → asignar jefe de obra. Todo lo demás (número OT, alertas, notificaciones) es automático.
3. **Máquina de estados con bloqueos:** Transiciones de estado validadas. Al pasar a "Finalizado", disparar verificación de trabajos activos en la OT. Al pasar a "Pendiente remito", disparar generación automática del documento de remito.
4. **Consolidación de costos en tiempo real:** Vista de OT que muestra en vivo: costo de horas + costo de materiales + costo de terceros = costo total. Sin necesidad de ir a copiar/pegar de otras planillas.
5. **Dashboard de alertas inteligente:** Reemplazar la hoja ALERTAS por un panel con notificaciones proactivas, filtrado por jefe de obra, con acciones directas (ej: botón "Agregar descripción").
6. **Auditoría robusta:** Reemplazar LOG.OTs con un `AuditTrail` completo en Supabase que registre cada cambio de campo, no solo la creación.
7. **Selector de contratistas normalizado:** Multi-select desde tabla `Worker`/`Workshop` con categorización (interno/externo/taller).
8. **Pantalla interactiva de carga con descripción flotante:** Interfaz especializada para Pañol, Carga de Horas y Terceros que filtra OTs por Barco + Contratista y muestra el texto del trabajo de forma flotante como ayuda memoria.

> Confianza: CONFIRMADO
