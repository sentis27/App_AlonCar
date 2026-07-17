# SDD: reporte-ordenes-trabajo (AvisoOtNueva_Aloncar_V2)

**Cliente:** Aloncar · **Versión fuente:** V2 · **Estado:** Producción · **Fuente:** `SDD_AvisoOtNueva_Aloncar_V2.pdf` + `AvisoOtNueva_aloncar_V2 (5).json` + entrevista 2026-07-17

---

## 1. Objetivo del flujo

Detectar automáticamente las nuevas órdenes de trabajo (OTs) cargadas en la planilla `LISTA_TRABAJOS` → hoja `UNIFICADO`, notificar al equipo operativo a través del canal Slack del barco correspondiente (creándolo si no existe) y registrar la OT en la base de datos de planillas `B.D.O.TRABAJO`. El flujo actúa como capa de distribución de información: elimina la necesidad de que alguien revise manualmente la planilla para enterarse de los nuevos trabajos.

### 1.1 Objetivo primario

Eliminar al intermediario humano que consultaba la planilla para enterarse de los trabajos nuevos y los comunicaba manualmente al equipo. Garantizar que toda OT nueva llegue automáticamente a los destinatarios correctos sin intervención manual.

### 1.2 Objetivos secundarios

- Crear y mantener un canal Slack por barco, organizando la comunicación por obra.
- Registrar cada OT nueva en una base de datos de planillas (`B.D.O.TRABAJO`) para trazabilidad futura y cruce de información.
- Sentar las bases para un sistema de validación cruzada con el reloj de entrada y distribución automática de horas por obra (objetivo final del proyecto).
- Preparar la arquitectura para migración de catálogos y registros de Google Sheets a Supabase.

---

## 2. Problema de negocio que resuelve

### 2.1 Situación anterior

Cuando se cargaba una nueva OT en la planilla `LISTA_TRABAJOS`, el encargado de operaciones debía revisar manualmente la hoja y comunicar verbalmente o por WhatsApp a los jefes de obra y supervisores que existía trabajo nuevo para su barco. Este proceso era reactivo, dependía de que alguien recordara revisar, y generaba demoras en la asignación de recursos.

### 2.2 Dolores identificados

| Dolor | Impacto |
|---|---|
| Comunicación manual y reactiva | Demoras en la asignación de cuadrillas a trabajos nuevos. |
| Riesgo de omisión | Si el responsable no revisaba la planilla, la OT quedaba sin notificar. |
| Sin trazabilidad de la notificación | No había registro de cuándo ni a quién se comunicó una OT nueva. |
| Fragmentación de canales | La información llegaba por WhatsApp personal, sin historial organizado por barco. |
| Errores en selección de OT en planilla de horas | Al no recibir la OT correcta a tiempo, los operarios reportaban horas en OTs incorrectas o desactualizadas. |

### 2.3 Hipótesis de solución

Un flujo programado que lea las OTs nuevas y las distribuya automáticamente por Slack, con un canal por barco, garantiza que la información llegue a todos los interesados de forma simultánea y quede registrada en un canal organizacional auditable. El registro en `B.D.O.TRABAJO` habilita el cruce futuro con la planilla de horas para detectar discrepancias.

---

## 3. Contexto operacional

### 3.1 Dominio del negocio

Aloncar es un astillero que ejecuta reparaciones y mantenimientos sobre embarcaciones, organizando el trabajo en órdenes de trabajo (OT). Cada OT se asocia a un barco (columna `BARCO` en `UNIFICADO`) y puede tener un contratista o equipo asignado. La planilla `LISTA_TRABAJOS` → hoja `UNIFICADO` es el cerebro del estado de trabajos activos: cada fila es una OT con su estado, descripción, contratista, jefe de obra y campos de control de notificación.

### 3.2 Actores del sistema

| Actor | Rol en el sistema |
|---|---|
| Encargado de operaciones | Carga las OTs nuevas en `UNIFICADO` y marca `enviar notificacion = Enviar`. |
| Sistema (AvisoOtNueva_V2) | Detecta las OTs pendientes, notifica por Slack y registra en la BD. |
| Jefes de obra / supervisores | Reciben la notificación en el canal Slack del barco correspondiente. |
| Equipo operativo | Recibe aviso WhatsApp secundario para revisar Slack (provisorio). |
| Administrador de canales | Mantiene la hoja `ValidacionBarcos` y gestiona membresías de Slack si hay errores `name_taken`. |

### 3.3 Volumen estimado y frecuencia

- **Trigger:** Cron cada 10 minutos, lunes a viernes, 09:00–17:00 (expresión: `*/10 9-17 * * 1-5`).
- **Frecuencia de OTs nuevas:** variable; en general pocas OTs por día, con picos al inicio de visita de un barco.
- **Canales Slack activos:** uno por barco en obra activa; crece con el tiempo (no se eliminan al terminar la obra).
- **Destinatarios WhatsApp:** 4 números fijos configurados en el nodo `ExpandirDestinatarios`.

---

## 4. Alcance (dentro / fuera de alcance)

### 4.1 Dentro de alcance (V2 — implementado)

- Lectura de la hoja `UNIFICADO` filtrando filas con `enviar notificacion = Enviar` y `ENVIO AVISO` vacío.
- Segundo filtro por código (FiltrarPendientes) para evitar doble-notificación si el cron se ejecuta antes de que el update de `ENVIO AVISO` se propague.
- Verificación de canal Slack existente vía campo `SlackChannel_ID` en la hoja `UNIFICADO` (poblado desde `ValidacionBarcos` mediante BUSCARV).
- Creación de canal Slack nuevo cuando el barco no tiene canal registrado: normalización del nombre, llamada a API Slack, join del bot, invitación de usuarios, guardado en `ValidacionBarcos`.
- Construcción del mensaje Slack con los campos disponibles (barco, OT, contratista, descripción, jefe de obra), omitiendo campos vacíos.
- Envío del mensaje al canal del barco.
- Marcado de la fila en `UNIFICADO` (`ENVIO AVISO` ← fecha + "Enviado") para evitar re-notificación.
- Registro de la OT en `B.D.O.TRABAJO` (`B.D NUVAS PLANILLAS`), en la columna del barco correspondiente, con verificación de duplicados.
- Marcado de resultado en `UNIFICADO` (columna `SeCreoOT`): `CreadaOT` si fue registrada, `YaExiste` si ya estaba en la BD.
- Aviso WhatsApp a 4 destinatarios fijos (provisorio, mediante Evolution API) con el mensaje "Tenemos nuevas OT revisen Slack".
- Manejo de error `name_taken` en Slack: lanza excepción descriptiva con instrucciones de acción manual.

### 4.2 Fuera de alcance (V2, candidatos a versiones posteriores)

- Conciliación automática de horas de la planilla de horas vs. reloj de entrada.
- Distribución automática de horas entre OTs (objetivo final del proyecto).
- Generación de reportes automáticos de horas por obra.
- Eliminación o archivado de canales Slack al finalizar una obra.
- Notificación por canal distinto a Slack (excepto el aviso WhatsApp provisorio ya implementado).
- Manejo de OTs modificadas (solo detecta OTs nuevas no notificadas).
- Migración de datos a Supabase (Google Sheets es transitorio).

---

## 5. Entradas del sistema

### 5.1 Entrada principal: hoja UNIFICADO

_(Pendiente — depende de documentación de planilla UNIFICADO)_

El flujo lee la hoja `UNIFICADO` de la planilla `LISTA_TRABAJOS` (ID: `1rmjCqJoy7lz0YPlbmzHxp9Jj_pMHfSNBmpvS3BhxAlQ`). El filtro de entrada en el nodo GSheets aplica dos condiciones:

| Columna | Valor esperado | Función |
|---|---|---|
| `enviar notificacion` | `"Enviar"` | Activa la OT para notificación (marcado manual por el operador). |
| `ENVIO AVISO` | vacío | Confirma que la notificación aún no fue enviada. |

Los campos leídos de cada fila incluyen (según schema del nodo `MarcarEnviado`):

| Campo en UNIFICADO | Uso en el flujo |
|---|---|
| `BARCO` | Identificar el canal Slack; columna destino en `B.D.O.TRABAJO`. |
| `ORDEN DE TRABAJO` | Contenido de la notificación; dato a registrar en BD. |
| `Descripcion` | Contenido del mensaje Slack (omitido si vacío). |
| `Contratista / Externo` | Contenido del mensaje Slack (omitido si vacío). |
| `JEFE DE OBRA` | Contenido del mensaje Slack (omitido si vacío). |
| `SlackChannel_ID` | ID del canal Slack existente (si ya fue creado). |
| `ENVIO AVISO` | Control de idempotencia. |
| `SeCreoOT` | Resultado del registro en BD. |
| `row_number` | Clave para el update de la fila en GSheets. |

Campos adicionales presentes en el schema pero no escritos: `FECHA`, `Estado`, `Comentario`, `TIPO COMPROBANTE`, `# COMPROBANTE`, `NUMERO DE OT`, `usuario_origen`, `SIN OT`, `SIN DESCRPCION`, `SIN CONTRATISTA`, `SIN # COMPROBANTE`, `Cod.UnicoBarco&jefeObra`, `Cod.UnicoOt&Estado`.

### 5.2 Entrada secundaria: hoja ValidacionBarcos

Hoja `ValidacionBarcos` de la misma planilla `LISTA_TRABAJOS` (gid: 1800470170). Contiene el mapeo `BARCO → SlackChannel_ID`. El valor llega al flujo pre-poblado en el campo `SlackChannel_ID` de `UNIFICADO` mediante una fórmula BUSCARV nativa en la planilla, no por consulta directa del flujo.

### 5.3 Entrada terciaria: hoja B.D.O.TRABAJO

Hoja `B.D.O.TRABAJO` de la planilla `B.D NUVAS PLANILLAS` (ID: `1z-3OS6g9KHY-NoUp3O3QJaLUQ08BxTeQdWLQ8b25aZM`, gid: 1619684477). Leída con range `A2:ZZ500`. La fila 2 contiene los headers (nombres de barco = columnas). Las filas 3+ contienen las OTs ya registradas por columna de barco.

---

## 6. Salidas del sistema

### 6.1 Salida primaria: mensaje Slack en canal del barco

Mensaje publicado en el canal Slack correspondiente al barco. Formato:

```
🚨 Aviso de nuevos trabajos

🔹 Barco: {BARCO}
🔹 Orden de trabajo: {ORDEN DE TRABAJO}
🔹 Contratista: {Contratista / Externo}   ← solo si tiene valor
🔹 Descripción: {Descripcion}              ← solo si tiene valor
🔹 Jefe de obra: {JEFE DE OBRA}            ← solo si tiene valor
```

**Regla:** Los campos vacíos se omiten del mensaje. Solo `Barco` y `Orden de trabajo` son obligatorios para el texto; si el barco o la OT están vacíos, aparecen como `N/D`.

### 6.2 Salida secundaria: actualización de UNIFICADO

Dos campos escritos en la fila de origen:

| Campo | Valor escrito | Cuándo |
|---|---|---|
| `ENVIO AVISO` | `"dd/mm/yyyy, Enviado"` | Tras enviar el mensaje Slack correctamente. |
| `SeCreoOT` | `"CreadaOT"` | Tras registrar la OT en BD por primera vez. |
| `SeCreoOT` | `"YaExiste"` | Si la OT ya estaba registrada en la BD. |

### 6.3 Salida terciaria: registro en B.D.O.TRABAJO

La OT se escribe al final de la columna del barco correspondiente en `B.D.O.TRABAJO`. Un barco = una columna; una OT = una celda en esa columna. El rango exacto se calcula dinámicamente (ej. `'B.D.O.TRABAJO'!P39`).

### 6.4 Salida cuaternaria: mensaje WhatsApp (provisorio)

Mensaje de texto enviado a 4 destinatarios fijos vía Evolution API (instancia `OnliwAI Oficial`). Texto fijo: `"Tenemos nuevas OT revisen Slack"`. Esta salida es provisoria para el período de validación del flujo. No está parametrizada en el sistema y requiere edición del nodo `ExpandirDestinatarios` para modificar los destinatarios.

### 6.5 Salida auxiliar: nuevo canal Slack (cuando el barco no tiene canal)

Si el barco no tiene canal registrado, el flujo crea uno en Slack y lo registra en `ValidacionBarcos` (columnas `BARCO` y `SlackChannel_ID`).

---

## 7. Reglas de negocio

### 7.1 Reglas de activación

**RN-01 — Doble condición de activación por OT**
Una OT se procesa si y solo si cumple simultáneamente: `enviar notificacion = "Enviar"` AND `ENVIO AVISO = ""` (vacío). Si alguna de las dos condiciones falla, la fila se descarta silenciosamente.

**RN-02 — Idempotencia del marcado**
El nodo `FiltrarPendientes` aplica un segundo filtro por código que descarta filas con `ENVIO AVISO` no vacío, como defensa adicional contra doble-notificación en caso de que el update de GSheets no se haya propagado antes de la siguiente ejecución del cron.

### 7.2 Reglas de canal Slack

**RN-03 — Un canal por barco**
Cada barco tiene a lo sumo un canal Slack. El canal se crea una sola vez y se reutiliza para todas las OTs posteriores del mismo barco. El `SlackChannel_ID` se persiste en `ValidacionBarcos` y se referencia desde `UNIFICADO` via BUSCARV.

**RN-04 — Normalización del nombre de canal**
El nombre del canal Slack se deriva del nombre del barco aplicando: minúsculas → eliminación de acentos (NFD) → espacios a guiones → eliminación de caracteres especiales → colapso de guiones múltiples → máximo 80 caracteres. Ejemplo: `"VIRGEN DE ITATÍ"` → `"virgen-de-itati"`.

**RN-05 — Error name_taken: requiere acción manual**
Si Slack retorna `name_taken` al crear un canal, significa que el canal ya existe en Slack pero no está registrado en `ValidacionBarcos`. El flujo lanza una excepción descriptiva con instrucciones claras para que el administrador busque el `channel_id` en Slack y lo registre manualmente.

### 7.3 Reglas del registro en BD

**RN-06 — Deduplicación en B.D.O.TRABAJO**
Antes de escribir, el nodo `EncontrarColumna1` recorre la columna del barco y verifica si la OT ya existe (comparación normalizada: sin saltos de línea, sin espacios múltiples, mayúsculas). Si ya existe, la OT no se escribe nuevamente y se marca `SeCreoOT = "YaExiste"` en `UNIFICADO`.

**RN-07 — Reserva de filas en batch**
Cuando un batch incluye múltiples OTs del mismo barco, el acumulador `filasReservadas` asegura que cada OT se escriba en una fila diferente, evitando colisiones. El índice `row_number` devuelto por GSheets con range `A2:ZZ500` es relativo al rango (no la fila real de la hoja); la fórmula correcta es `fila_real = row_number + 1`, por lo tanto `próxima_fila = última_fila_real + 1`.

### 7.4 Reglas del mensaje

**RN-08 — Omisión de campos vacíos**
El nodo `ArmarMensaje1` construye el mensaje línea por línea, incluyendo únicamente los campos con valor real. Los campos `Contratista / Externo`, `Descripcion` y `JEFE DE OBRA` son opcionales en el mensaje. `BARCO` y `ORDEN DE TRABAJO` siempre se incluyen (con `N/D` si están vacíos en la hoja).

---

## 8. Flujo lógico operacional

### 8.1 Diagrama lógico (V2 implementado)

```
[ScheduleTrigger] — cron */10 9-17 L-V
  → [LeerTrabajos] — GSheets UNIFICADO, filtro: enviar notificacion=Enviar + ENVIO AVISO vacío
      → [FiltrarPendientes] — segundo filtro por código
          → [VerificarDatos] — IF hasData
              -- FALSE → [SinDatosPendientes] — NoOp, fin limpio
              -- TRUE  → [VerificarCanal] — IF SlackChannel_ID no vacío
                            -- TRUE  → [UsarCanalExistente] (canalId ← SlackChannel_ID)
                            -- FALSE → [NormalizarNombreCanal]
                                           → [CrearCanalSlack] — POST conversations.create
                                               → [ExtraerIdNuevoCanal] — extrae channel.id
                                                   → [UnirseAlCanal1] — POST conversations.join
                                                       → [InvitarUsuarios] — POST conversations.invite
                                                           → [GuardarEnValidacionBarcos] — GSheets update
                                                               → [SetNuevoCanalId] — recupera item completo
                            (ambas ramas convergen en)
                            → [MergeCanales1] — Merge append
                                → [ArmarMensaje1] — construye texto + fechaEnvio
                                    → [EnviarMensaje1] — Slack post:message
                                        → [MarcarEnviado] — GSheets update UNIFICADO (ENVIO AVISO)
                                            → [LeerHeadersBarcos] — GSheets BD_NuevasPlanillas A2:ZZ500
                                                → [EncontrarColumna1] — calcula colLetter, nextRow, yaExiste
                                                    → [VerificarDuplicado] — IF yaExiste === false
                                                        -- TRUE  → [AgregarOrdenEnBD] — HTTP batchUpdate
                                                                       → [ConfirmarCargaNuevaOT] — GSheets UNIFICADO (SeCreoOT=CreadaOT)
                                                                           → [ExpandirDestinatarios] — 1 item → N items (WhatsApp)
                                                                               → [AvisoNuevaOT] — Evolution API
                                                        -- FALSE → [ConfirmarExisteOT] — GSheets UNIFICADO (SeCreoOT=YaExiste)
                                                                       → [ExpandirDestinatarios] → [AvisoNuevaOT]
```

### 8.2 Descripción funcional por nodo

**ScheduleTrigger**
- *Qué hace:* dispara el flujo cada 10 minutos en horario laboral (L-V, 09:00–17:00, expresión `*/10 9-17 * * 1-5`). Zona horaria: `America/Argentina/Buenos_Aires`.
- *Por qué:* frecuencia suficiente para notificaciones casi en tiempo real sin carga excesiva de la API de Sheets.

**LeerTrabajos**
- *Qué hace:* lee `LISTA_TRABAJOS` → `UNIFICADO` con filtro nativo GSheets: `enviar notificacion = "Enviar"` Y `ENVIO AVISO = ""` (vacío). Devuelve N ítems (uno por fila que cumple el filtro).
- *Por qué:* el doble filtro en el nodo nativo reduce la cantidad de datos transferidos antes del filtro por código.

**FiltrarPendientes**
- *Qué hace:* segundo filtro por código JavaScript. Descarta filas donde `ENVIO AVISO` ya tiene valor. Si no quedan pendientes, emite `{ hasData: false }`.
- *Por qué:* defensa adicional contra race conditions entre el cron y el update de GSheets.

**VerificarDatos**
- *Qué hace:* bifurca el flujo. `hasData === true` → procesa; `hasData === false` → `SinDatosPendientes`.

**SinDatosPendientes**
- *Qué hace:* NoOp. Punto de salida limpia cuando no hay OTs nuevas. El flujo termina sin errores ni mensajes vacíos.

**VerificarCanal**
- *Qué hace:* verifica si `SlackChannel_ID` no está vacío (el barco ya tiene canal). TRUE → `UsarCanalExistente`; FALSE → rama de creación.

**UsarCanalExistente**
- *Qué hace:* Set node que asigna `canalId ← SlackChannel_ID`, normalizando el nombre del campo para que el resto del flujo siempre use `canalId`.

**NormalizarNombreCanal**
- *Qué hace:* convierte el nombre del barco a formato válido para Slack (ver RN-04).

**CrearCanalSlack**
- *Qué hace:* `POST slack.com/api/conversations.create` con `name = channelNameNormalizado` e `is_private = false`. Maneja error `name_taken` (ver RN-05).

**ExtraerIdNuevoCanal**
- *Qué hace:* extrae `channel.id` y `channel.name` de la respuesta de Slack. Calcula `fechaCreacionCanal`. Fusiona con los datos del trabajo original.

**UnirseAlCanal1**
- *Qué hace:* `POST slack.com/api/conversations.join`. El bot se une al canal recién creado. Requiere scope `channels:join`.

**InvitarUsuarios**
- *Qué hace:* `POST slack.com/api/conversations.invite`. Invita usuarios humanos por lista de Slack User IDs (`U0AUH9QRAQH, U0AVDRNAK0D, U0B016BBY78`).

**GuardarEnValidacionBarcos**
- *Qué hace:* escribe `BARCO` y `SlackChannel_ID` en la hoja `ValidacionBarcos`, matching por `BARCO`. Persiste el ID del canal para reutilización futura.

**SetNuevoCanalId**
- *Qué hace:* recupera el ítem completo desde `ExtraerIdNuevoCanal`, ya que el nodo GSheets Append sobreescribe el output con los datos de la fila guardada, perdiendo el contexto del trabajo.
- *Por qué existe:* patrón defensivo necesario cuando un nodo GSheets sobreescribe el item; referencia explícita por nombre (`$('ExtraerIdNuevoCanal').item.json`).

**MergeCanales1**
- *Qué hace:* Merge en modo `append`. Recibe ítems de `UsarCanalExistente` (canal existía) o `SetNuevoCanalId` (canal nuevo). Pasa los ítems sin esperar que ambas ramas tengan datos.

**ArmarMensaje1**
- *Qué hace:* construye el texto del mensaje Slack (ver Sección 6.1) y calcula `fechaEnvio` (`"dd/mm/yyyy, Enviado"`). Itera sobre todos los ítems del Merge.

**EnviarMensaje1**
- *Qué hace:* Slack `post:message` al canal por `canalId`. Usa ID, nunca nombre. Si hay N ítems, ejecuta N veces automáticamente.

**MarcarEnviado**
- *Qué hace:* GSheets update en `UNIFICADO`. Escribe `ENVIO AVISO = fechaEnvio` y preserva `BARCO` y `ORDEN DE TRABAJO`. Matching por `row_number`. Sin este paso, la OT se re-notificaría en cada ejecución del cron.

**LeerHeadersBarcos**
- *Qué hace:* lee `B.D.O.TRABAJO` de `B.D NUVAS PLANILLAS` con range `A2:ZZ500`. La fila 2 son los headers (nombre de barco = nombre de columna). Las filas 3+ son las OTs registradas.
- *Por qué nodo nativo y no HTTP Request:* el nodo nativo de GSheets maneja correctamente el encoding del nombre de hoja con puntos (`B.D.O.TRABAJO`), que falla si se especifica en la URL de una HTTP Request.

**EncontrarColumna1**
- *Qué hace:* (1) extrae nombres de barco de las keys del primer ítem; (2) encuentra la columna del `BARCO` (índice → letra de columna: A, B…Z, AA…); (3) recorre la columna buscando la última fila con dato y verificando duplicados; (4) calcula la próxima fila real disponible con el acumulador `filasReservadas` (RN-07); (5) construye el body JSON para `batchUpdate`. Emite `colLetter`, `nextRow`, `writeRange`, `yaExiste`, `bodyJson`, `_debug`, `row_number`.
- *Normalización:* función `norm()` elimina saltos de línea internos y espacios múltiples antes de la comparación.

**VerificarDuplicado**
- *Qué hace:* IF `yaExiste === false`. TRUE → `AgregarOrdenEnBD`; FALSE → `ConfirmarExisteOT`.

**AgregarOrdenEnBD**
- *Qué hace:* `POST sheets.googleapis.com/v4/spreadsheets/{id}/values:batchUpdate`. El rango y el body van en el JSON del body (no en la URL) para evitar el problema de encoding del nombre de hoja con puntos. Escribe la OT en `writeRange` (ej. `'B.D.O.TRABAJO'!P39`).

**ConfirmarCargaNuevaOT**
- *Qué hace:* GSheets update en `UNIFICADO`. Escribe `SeCreoOT = "CreadaOT"` matching por `row_number`.

**ConfirmarExisteOT**
- *Qué hace:* GSheets update en `UNIFICADO`. Escribe `SeCreoOT = "YaExiste"` matching por `row_number`.

**ExpandirDestinatarios**
- *Qué hace:* convierte 1 ítem en N ítems, uno por número de WhatsApp destinatario. Números hardcodeados en el array `numeros` del nodo. Formato: `549XXXXXXXXXX@s.whatsapp.net`. Emite N ítems.

**AvisoNuevaOT**
- *Qué hace:* Evolution API `messages-api` → enviar texto a `numeroDestino` dinámico. Texto fijo: `"Tenemos nuevas OT revisen Slack"`. Instancia: `OnliwAI Oficial`. Tiene `retryOnFail: true` con 3 segundos de espera entre reintentos.
- *Nota:* nodo provisorio para validación. No parametriza el mensaje ni los destinatarios fuera del código del nodo `ExpandirDestinatarios`.

---

## 9. Estructura de datos

### 9.1 Schema de la hoja UNIFICADO (campos relevantes al flujo)

_(Pendiente — depende de documentación de planilla UNIFICADO)_

Los campos utilizados por el flujo y confirmados por el schema del workflow son:

| Campo | Tipo | Uso en el flujo |
|---|---|---|
| `BARCO` | String | Identificación del barco; matching de columna en BD. |
| `ORDEN DE TRABAJO` | String | Dato principal a notificar y registrar. |
| `Descripcion` | String | Texto descriptivo de la OT (opcional en mensaje). |
| `Contratista / Externo` | String | Contratista asignado (opcional en mensaje). |
| `JEFE DE OBRA` | String | Responsable de la obra (opcional en mensaje). |
| `enviar notificacion` | String | Control de activación. Valor esperado: `"Enviar"`. |
| `ENVIO AVISO` | String | Control de idempotencia. Vacío = pendiente; con valor = ya notificado. |
| `SlackChannel_ID` | String | ID del canal Slack del barco (pre-poblado por BUSCARV desde ValidacionBarcos). |
| `SeCreoOT` | String | Resultado del registro en BD: `"CreadaOT"` o `"YaExiste"`. |
| `row_number` | Number | Identificador de fila para updates precisos. |

### 9.2 Schema de la hoja ValidacionBarcos

| Campo | Tipo | Descripción |
|---|---|---|
| `BARCO` | String | Nombre del barco (clave de matching). |
| `SlackChannel_ID` | String | ID del canal Slack del barco. |

### 9.3 Schema de la hoja B.D.O.TRABAJO

- **Fila 2 (headers):** cada columna es un barco. El nombre de la columna = nombre del barco (normalizado).
- **Filas 3+:** cada celda en la columna de un barco es una OT registrada para ese barco.
- **Estructura:** una columna por barco, una OT por fila en esa columna. Crecimiento vertical por barco, horizontal por nuevo barco.

---

## 10. Relaciones entre entidades

### 10.1 Diagrama lógico de entidades

```
BARCO *---* ORDEN_TRABAJO  (relación N:M vía hoja UNIFICADO)
  |               |
  |       registrada en
  |               v
  +-----→ B.D.O.TRABAJO (columna BARCO, filas = OTs)
  |
  +-----→ SLACK_CANAL (1 canal por barco, persiste en ValidacionBarcos)
               |
               v
         notificación enviada a DESTINATARIOS_SLACK (miembros del canal)
               +
         aviso secundario a DESTINATARIOS_WHATSAPP (lista fija, provisorio)
```

### 10.2 Cardinalidad

- Un `BARCO` tiene un único `SLACK_CANAL` (1:1).
- Un `BARCO` puede tener muchas `ORDENES_DE_TRABAJO` (1:N).
- Una `ORDEN_DE_TRABAJO` pertenece a un único `BARCO` en este flujo (N:1 desde la perspectiva de `UNIFICADO`).
- La hoja `B.D.O.TRABAJO` organiza las OTs por barco (columna): para el flujo, `BARCO` es la clave de columna y `ORDEN_DE_TRABAJO` es el valor de celda.

### 10.3 Notas para migración a modelo relacional

_(Pendiente — depende de documentación de planilla UNIFICADO)_

Al migrar a Supabase, entidades candidatas: `barcos` (con `slack_channel_id`), `ordenes_trabajo` (con FK a barcos), `notificaciones_enviadas` (log de cuándo se notificó cada OT), `destinatarios_whatsapp` (tabla configurable en lugar de array hardcodeado). La columna `SeCreoOT` y `ENVIO AVISO` son candidatos a migrar a campos de auditoría en la tabla `ordenes_trabajo`.

---

## 11. Manejo de errores

*Filosofía: el flujo prefiere fallar ruidosamente (excepción descriptiva) antes que continuar silenciosamente con datos incorrectos.*

### 11.1 Categorías de error y manejo

| Categoría | Detección | Manejo |
|---|---|---|
| Sin OTs pendientes | `hasData === false` en FiltrarPendientes | Salida limpia por `SinDatosPendientes` (NoOp). Sin error, sin alerta. |
| Canal Slack `name_taken` | Slack API error en `CrearCanalSlack` | Excepción con instrucciones claras: buscar ID manualmente y registrar en ValidacionBarcos. |
| Otro error Slack API | Slack API error != `name_taken` | Excepción descriptiva con código de error y barco afectado. |
| Barco no encontrado en B.D.O.TRABAJO | `keyIndex === -1` en `EncontrarColumna1` | Excepción con lista de columnas disponibles e instrucción de agregar la columna manualmente. |
| BD sin datos | `bdItems.length === 0` en `EncontrarColumna1` | Excepción: `"La hoja B.D.O.TRABAJO no devolvió datos."` |
| OT duplicada en BD | `yaExiste === true` en `VerificarDuplicado` | Rama FALSE: marca `SeCreoOT = "YaExiste"` en UNIFICADO. No relanza excepción. |
| Error de Google Sheets API | Error de red o permisos | El flujo tiene `errorWorkflow: "BgGaLsdbPiaEO8m8"` configurado para captura centralizada. |
| Fallo de Evolution API (WhatsApp) | Error en `AvisoNuevaOT` | Reintento automático 3 veces con 3 segundos de espera (`retryOnFail: true`). |

### 11.2 Política de degradación

El flujo no tiene degradación parcial en V2: si falla un nodo, la ejecución se detiene. El registro en BD y los avisos WhatsApp solo ocurren si la notificación Slack fue exitosa. El `errorWorkflow` centralizado captura los fallos para auditoría.

### 11.3 Trazabilidad

- **`ENVIO AVISO`:** timestamp y estado de la notificación Slack en la fila de UNIFICADO.
- **`SeCreoOT`:** resultado del registro en BD por fila.
- **Log de ejecuciones n8n:** trazabilidad de cada ejecución del cron (inputs, outputs, errores) en el panel de n8n.
- **Debugging integrado:** el nodo `EncontrarColumna1` emite un campo `_debug` con detalles de la búsqueda de columna y filas analizadas.

---

## 12. Dependencias críticas

### 12.1 Dependencias técnicas externas

| Dependencia | Función | Riesgo si falla |
|---|---|---|
| Google Sheets API | Lectura de UNIFICADO, ValidacionBarcos, B.D.O.TRABAJO y escritura de resultados. | Bloqueo total del flujo. |
| Slack API | Creación/verificación de canales y envío de mensajes. | Bloqueo de la notificación; el registro en BD puede completarse pero la OT queda sin notificar si el fallo ocurre antes del marcado. |
| Evolution API (WhatsApp) | Aviso secundario a destinatarios fijos. | Solo impacta el aviso provisorio; la funcionalidad principal (Slack) no se ve afectada. |
| n8n self-hosted | Plataforma de ejecución (Docker). | Caída del orquestador detiene el sistema. |

### 12.2 Dependencias funcionales internas

- **Calidad de `enviar notificacion` en UNIFICADO:** el operador debe marcar `"Enviar"` exactamente (case insensitive por configuración del filtro GSheets) para que la OT sea procesada.
- **BUSCARV de `SlackChannel_ID` en UNIFICADO:** depende de que la fórmula nativa de la planilla esté actualizada y de que `ValidacionBarcos` tenga el canal registrado. Si la fórmula está rota o la hoja está desactualizada, todos los barcos pasan por la rama de creación de canal.
- **Estructura de columnas de B.D.O.TRABAJO:** cada barco debe tener su columna con el mismo nombre que aparece en `UNIFICADO`. Si hay discrepancia de nombre, el flujo lanza excepción.
- **Instancia Evolution API `OnliwAI Oficial`:** debe estar activa. Si otra instancia o workflow comparte la instancia, puede generar conflictos.

### 12.3 Punto único de falla más sensible

La hoja `UNIFICADO` de `LISTA_TRABAJOS` es el punto de control central del flujo. Si la columna `enviar notificacion` deja de usarse o cambia de nombre, o si `ENVIO AVISO` se llena por error en filas pendientes, el flujo pierde su capacidad de detección. La columna `SlackChannel_ID` y su BUSCARV son el segundo punto de falla: si la fórmula se rompe, todos los barcos activan la rama de creación de canal, generando errores `name_taken` en Slack para los barcos ya registrados.

---

## 13. Escalabilidad futura

### 13.1 Ejes de escalabilidad

- **Migración a Supabase:** `CargarCatalogos` (cuando se implemente) y las lecturas de `UNIFICADO` pueden migrarse reemplazando los nodos GSheets por consultas a Supabase sin cambiar la lógica de negocio del flujo.
- **Canal de distribución:** la arquitectura de canales Slack puede complementarse o reemplazarse por WhatsApp groups, email o push notifications sin reestructurar el flujo; solo se reemplaza el nodo de envío y la lógica de `VerificarCanal`.
- **Destinatarios WhatsApp configurables:** mover el array `numeros` de `ExpandirDestinatarios` a una tabla en GSheets o Supabase para gestión sin edición de código.
- **Trigger instantáneo:** reemplazar el Cron por un Webhook disparado desde Apps Script en la planilla `LISTA_TRABAJOS` (evento `onEdit`) para notificación en tiempo real al marcar `enviar notificacion = "Enviar"`.
- **Cruce con planilla de horas:** objetivo final del proyecto. Requiere que `B.D.O.TRABAJO` sea la fuente de verdad de OTs activas para el workflow `reporte-horas`, validando que las horas reportadas correspondan a OTs existentes y vigentes.

### 13.2 Roadmap propuesto

| Hito | Cambio | Trigger |
|---|---|---|
| V2.1 | Destinatarios WhatsApp configurables desde planilla. | Cuando los destinatarios necesiten actualizarse frecuentemente. |
| V2.2 | Trigger instantáneo via Apps Script + Webhook. | Cuando el lag de 10 minutos sea inaceptable. |
| V3.0 | Migración de fuentes de datos a Supabase. | Cuando esté listo el modelo relacional (Módulo 3, `docs/03_negocio/`). |
| V3.1 | Cruce automático con `reporte-horas` para validación de OTs. | Cuando ambas fuentes (horas + OTs) estén en Supabase. |
| V4.0 | Distribución automática de horas por obra. | Objetivo final del proyecto. |

---

## 14. Lecciones de implementación

**Encoding del nombre de hoja `B.D.O.TRABAJO` en URL.**
El nombre de la hoja contiene puntos, lo que causa problemas de encoding cuando se especifica en la URL de una HTTP Request. Solución: usar el nodo nativo de Google Sheets (que maneja el encoding internamente) para `LeerHeadersBarcos`, y pasar el nombre de hoja entre comillas simples dentro del body JSON para `AgregarOrdenEnBD` (batchUpdate).

**Row_number relativo al rango vs. fila real en la hoja.**
El nodo GSheets con range `A2:ZZ500` asigna `row_number` relativo al rango (no la fila real de la hoja). La relación correcta es `fila_real = row_number + 1`. Por lo tanto la fórmula para la próxima fila disponible es `nextRow = lastFilledActual + 1 = (lastFilledRowRelative + 1) + 1`. Este error provocaba escrituras en filas incorrectas antes de la corrección.

**Colisión de filas en batch con múltiples OTs del mismo barco.**
Cuando un batch contiene múltiples OTs del mismo barco (misma columna en BD), el nodo `EncontrarColumna1` calculaba siempre la misma `nextRow` (basada en el estado actual de la hoja, que no se había actualizado). Solución: acumulador `filasReservadas` que almacena la última fila real reservada por columna en el contexto del batch, y asigna la siguiente para cada OT adicional.

**Pérdida del item original tras GSheets Append/Update.**
Los nodos de Google Sheets (operaciones append y update) sobreescriben el output del nodo con los datos de la API response, descartando el contexto del ítem original (BARCO, ORDEN DE TRABAJO, etc.). Patrón de solución: nodo Code intermedio (`SetNuevoCanalId`) que recupera el ítem desde el nodo anterior por nombre explícito: `$('ExtraerIdNuevoCanal').item.json`. Este patrón se repite en `EncontrarColumna1` que referencia `$('MarcarEnviado').all()`.

**Referencias entre nodos Code: `$input` vs. nodo por nombre.**
Usar `$input.first().json` en un nodo Code hace que el código dependa del nodo inmediatamente anterior. Insertar un nodo intermedio rompe silenciosamente la referencia. La práctica correcta es referenciar por nombre explícito (`$('NodoX').first().json`), adoptada consistentemente en V2.

**Aviso WhatsApp provisorio via Evolution API.**
Durante el período de validación de Slack en producción, se agregó el nodo `AvisoNuevaOT` como canal secundario. El texto es fijo y no parametrizable sin editar el workflow. Esta deuda técnica debe resolverse en V2.1 (destinatarios desde planilla) o eliminarse cuando Slack esté validado como canal principal.

**Tres tipos de mensajes de entrada generan problemas de interpretación en reporte-horas (relacionado).**
El flujo de reporte de horas que coexiste con este workflow procesa mensajes de tres tipos distintos de emisores: maquinistas (formato más pulido), contratistas/talleres externos, y personal propio. Los dos últimos requieren ajustes de interpretación. Esta asimetría de formatos es una lección de diseño para futuros workflows de procesamiento de mensajes: definir y documentar los formatos esperados por tipo de emisor antes de implementar la lógica de extracción.
