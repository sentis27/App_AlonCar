# SDD: reporte-horas (RegistroHoras_Aloncar_V2_WA)

**Cliente:** Aloncar · **Versión fuente:** 3.0 (Julio 2026) · **Estado:** Producción — canal migrado a WhatsApp (Evolution API) · **Fuente:** `SDD_RegistroHoras_Aloncar_V2_WA_v3.0.pdf`

## 1. Objetivo del flujo

Transforma reportes de trabajo redactados en lenguaje natural por los encargados del astillero en registros estructurados, normalizados y auditables dentro del sistema de control de horas de Aloncar. Actúa como capa de comprensión semántica entre el lenguaje informal del taller (mensajes de WhatsApp con errores ortográficos, abreviaturas, formatos heterogéneos, datos implícitos) y la estructura tabular rígida que requiere la planilla de control de horas para fines contables, estadísticos y de facturación.

### 1.1 Objetivo primario
Eliminar la carga manual de transcripción de reportes de horas, reduciendo tiempo operativo, errores de transcripción, y centralizando la información en un sistema único de registro.

### 1.2 Objetivos secundarios
- Arquitectura desacoplada que permita migrar el almacenamiento de catálogos desde Google Sheets hacia Supabase sin reescribir la lógica de negocio.
- Mecanismo de auditoría granular: reconstruir cómo se procesó cada mensaje, qué decisiones tomó el agente de IA, y qué datos quedaron sin resolver.
- Canal de entrada intercambiable (WhatsApp vía Evolution API desde V2_WA) sin afectar el resto del flujo — separación diseñada desde V1.
- Reducir la fricción para los encargados: deben poder reportar como ya lo hacen hoy, sin aprender un formato nuevo.

## 2. Problema de negocio que resuelve

### 2.1 Situación actual
Los supervisores de personal reportan diariamente las horas trabajadas por sus equipos vía mensajes informales (WhatsApp, llamadas, papel). Un encargado de registrar interpreta el contenido, identifica barcos, órdenes de trabajo, operarios, rubros y horas, y vuelca esa información manualmente a una planilla de control.

### 2.2 Dolores identificados

| Dolor | Impacto |
|---|---|
| Cuello de botella humano | Una sola persona concentra el conocimiento de interpretación. Si falta, la carga se acumula. |
| Riesgo de error de transcripción | Errores manuales en horas, operario u OT impactan directamente sobre facturación y costos. |
| Pérdida de trazabilidad | El mensaje informal se pierde una vez transcripto. No queda registro auditable del input crudo. |
| Inconsistencia de nomenclatura | Errores ortográficos y abreviaturas no normalizadas se propagan a la planilla. |
| Velocidad de carga limitada | El tiempo de procesamiento por mensaje es alto y no escala con el volumen del astillero. |
| Conocimiento tácito no formalizado | Las reglas de interpretación viven en la cabeza del encargado. |

### 2.3 Hipótesis de solución
Un agente de IA con catálogos del dominio en contexto puede replicar el 80-90% del trabajo interpretativo del encargado, dejando como excepciones flageadas únicamente los casos verdaderamente ambiguos. La capa de validación cruzada determinística sobre los catálogos garantiza que ningún dato escrito en planilla esté fuera del conjunto canónico de entidades del negocio.

*El sistema no reemplaza al encargado de control: lo libera del trabajo repetitivo de transcripción y lo posiciona como revisor de excepciones, donde su criterio aporta más valor.*

## 3. Contexto operacional

### 3.1 Dominio del negocio
Aloncar es un astillero que ejecuta reparaciones y mantenimientos sobre embarcaciones (barcos), organizando el trabajo en órdenes de trabajo (OT). Sobre cada OT se asignan operarios propios (grupo ASTILLERO) o contratistas externos (grupo propio: TOBARES, RAMON ARANDA, AVALOS, etc.). El trabajo se ejecuta por rubros (raschinaje, calderería, carpintería, mecánica, pintura, pala, grúa, etc.). Cada operario tiene un rubro principal en el catálogo, pero puede ejecutar tareas de otros rubros según la necesidad operativa.

### 3.2 Actores del sistema

El reporte de horas atraviesa una cadena de actores antes de llegar al sistema. Solo uno de ellos queda registrado como emisor en el log.

| Actor | Rol en el sistema |
|---|---|
| Supervisor de personal de planta | Genera el reporte primario de horas de su equipo y lo envía por WhatsApp al encargado de registrar. No interactúa con el sistema. |
| Encargado de registrar (emisor WhatsApp) | Recibe los reportes por WhatsApp del supervisor de planta y los publica en el grupo de WhatsApp autorizado. Único actor que el sistema captura como `usuario_emisor` en el log. |
| Sistema (RegistroHoras_Aloncar_V2_WA) | Interpreta el mensaje, normaliza entidades, valida contra catálogos y escribe registros estructurados. |
| Encargado de control de horas | Revisa la planilla destino, atiende filas marcadas con R y corrige. |
| Supervisor | Aprueba la planilla finalizada para facturación y liquidación. |
| Administrador de catálogos | Mantiene actualizados los catálogos de personal, barcos, rubros y órdenes de trabajo. |

**Trazabilidad del emisor:** el sistema registra el número de teléfono (`participantPn`) del usuario de WhatsApp que publica el mensaje — el encargado de registrar — no al supervisor de planta que originó el reporte. El diseño soporta múltiples emisores sin cambios de código.

### 3.3 Volumen estimado y frecuencia
- Frecuencia de mensajes: diaria, con picos al final del día laboral.
- Volumen estimado: 5 a 30 mensajes por día.
- Catálogo de personal: ~200 entradas (solo ACTIVO se cargan, ~160 en la práctica).
- Catálogo de barcos: decenas de embarcaciones activas en cualquier momento.
- Catálogo de rubros: cerrado, ~30 rubros estandarizados.
- Catálogo de OTs activas: filtrado dinámicamente, decenas a baja centena.

## 4. Alcance (dentro / fuera de alcance)

### 4.1 Dentro de alcance (V1 — implementado)
- Recepción de mensajes desde el grupo de WhatsApp autorizado (`remoteJid: 120363410988413748@g.us`) vía webhook de Evolution API.
- Filtrado de mensajes del propio bot para evitar loops de auto-respuesta.
- Extracción de fecha del mensaje; rechazo bloqueante si no se encuentra fecha.
- Carga de catálogos de personal (solo ACTIVO), barcos, rubros y OTs activas desde Google Sheets.
- Extracción semántica de entidades por LLM (gpt-4o-mini) con catálogos en contexto.
- Validación cruzada determinística contra catálogos, incluyendo selección de OT por habilitación real (columna G).
- Cálculo de distribución de horas en normales / 50% / 100% según calendario y tipo de operario.
- Escritura quirúrgica en la planilla de horas detectando la última fila real (columna B), con marcador R para revisión.
- Escritura del `mensaje_id` (columna AD) y del motivo de revisión del sistema (columna AE), separado de las observaciones de obra (columna T).
- Registro paralelo en hoja de log con trazabilidad completa del procesamiento.
- Respuesta de confirmación al emisor en el mismo grupo de WhatsApp.

### 4.2 Fuera de alcance (V1, candidatos a versiones posteriores)
- Validación de cumplimiento de target diario de horas por operario (lógica diseñada, implementación diferida).
- Trigger alternativo por WhatsApp vía Evolution API (preparado, sin conectar).
- Sistema de alertas por rol a jefes de obra / supervisores (nodo E9b, diferido a V2.1 — ver Anexo D).
- Migración de catálogos, log y planilla destino a Supabase.
- Mecanismo de retry asíncrono para mensajes incompletos (sistema de pendientes con reanudación).
- Interfaz web para revisión y corrección de filas marcadas con R.
- Reglas de negocio por OT (rubros permitidos por tipo de orden), pendientes de mapeo en el proyecto de aplicación.

## 5. Entradas del sistema

### 5.1 Entrada principal: mensaje WhatsApp
Mensaje de texto plano publicado en el grupo de WhatsApp autorizado (`remoteJid: 120363410988413748@g.us`) por el encargado de registrar. El payload de Evolution API (webhook) anida los datos del mensaje bajo `body.event`.

| Atributo | Ubicación en payload | Uso |
|---|---|---|
| `text` | `body.event.text` | Procesamiento por LLM + persistencia en log. |
| `user` | `body.event.user` | Trazabilidad del emisor (encargado de registrar). Soporta múltiples usuarios. |
| `ts` | `body.event.ts` | Construcción del `mensaje_id` de auditoría. |
| `channel` | `body.event.channel` | Filtro de seguridad (debe ser `C0B6K792PED`). |
| `bot_id` | `body.event.bot_id` | Si está presente, el mensaje es del bot y se descarta (evita loop). |

### 5.2 Entradas secundarias: catálogos de dominio
El sistema lee, en cada ejecución, los catálogos que definen el universo de entidades válidas mediante el sub-workflow `CargarCatalogos`, que lee de solo dos spreadsheets; la planilla de horas queda exclusivamente como destino de escritura. Detalle completo de fuentes/columnas/filtros en el Anexo C.

| Catálogo | Fuente actual | Contenido y filtro |
|---|---|---|
| Personal | `B.D.NewSystemm` → `PersonalClasificacionCostos` | Nombre, grupo, U$/hora, rubro principal. Solo registros con ESTADO = ACTIVO. |
| Rubros | `B.D.NewSystemm` → `BaseDatosP/PlanillasRegistro`, col C | Lista cerrada. Fuente de verdad de la cual se exporta `RUBROS_OtrosDesplegables_IMPORTADA`. |
| Barcos | `LISTA_TRABAJOS` → `UNIFICADO`, col A | Valores únicos no vacíos, filtrados por estado de OT = "En ejecución/En curso". |
| OTs activas | `LISTA_TRABAJOS` → `UNIFICADO` | Tuplas (barco, OT, descripción, contratistas, comentario, jefe de obra), estado = "En ejecución/En curso". |

*Los rubros se leen de su fuente de origen (`B.D.NewSystemm`), no del export derivado, eliminando la dependencia de que el export se haya ejecutado. La lógica del flujo no asume nada sobre el medio de almacenamiento: el contrato es que `CargarCatalogos` devuelve siempre un objeto JSON con la misma forma.*

## 6. Salidas del sistema

### 6.1 Salida primaria: filas en planilla de horas
Cada tarea identificada genera una fila en `HORAS_PLANILLAS_DE_REGISTRO`. **Regla de consolidación:** una fila por combinación única de (fecha, operario, barco, OT, rubro); múltiples menciones de la misma combinación se suman en horas y concatenan en observaciones.

**Ejemplo de consolidación:** "Operario B — raschinaje — Caliz — achique sentina — 3h" (mañana) + "Operario B — raschinaje — Caliz — achique sentina — 2h" (tarde) → sin consolidar serían 2 filas (3h y 2h); consolidado: 1 sola fila con 5h totales y observaciones concatenadas.

| Col | Header | Contenido |
|---|---|---|
| A | APROBACIÓN | "R" si la fila requiere revisión; vacío en caso contrario. |
| B | FECHA | Fecha de ejecución reportada, formato DD/MM/YYYY. Ancla para detectar última fila real. |
| C | BARCO | Nombre canónico del barco (del catálogo). |
| D | ORDEN DE TRABAJO | OT canónica, seleccionada por habilitación real (no solo por texto). |
| E | CONTRATISTA | Nombre canónico del operario o contratista ejecutor. |
| F | TIPO TRAB | HORA (default) / PRESUPUESTO / CONTROL, inferido del comentario de la OT (RN-14). |
| G | NORMAL | Horas dentro del target diario. |
| H | H. AL 50% | Horas extras hasta 4h. |
| I | H. AL 100% | Horas extras por encima de 4h. |
| J | RUBRO | Rubro del trabajo (del mensaje, no del catálogo de personal). |
| K-R | (omitidas) | No se escriben. |
| S | N P.R. | Calculada por fórmula nativa. No se escribe. |
| T | OBSERVACIONES | Descripción de la tarea (del mensaje) con corrección ortográfica. |
| AD | mensaje_id | Identificador del mensaje originador. Trazabilidad bidireccional con el log. |
| AE | MOTIVO_REVISION_SISTEMA | Diagnóstico del sistema sobre por qué la fila quedó con R. Separado de las observaciones de obra. |

*Separación T vs AE: la columna T contiene solo lo que dijo el humano (observación de obra); la columna AE contiene solo el razonamiento del sistema (por qué quedó marcada con R). Evita que el revisor tenga que leer texto técnico cuando solo quiere ver el comentario de obra.*

### 6.2 Salida secundaria: fila en hoja de log
Cada mensaje procesado genera exactamente una fila en `LOG_PROCESAMIENTO` — una entrada por ejecución, sin importar cuántas filas haya generado en la planilla principal.

| Campo | Significado |
|---|---|
| `mensaje_id` | Identificador único = timestamp del mensaje + hash del texto crudo. |
| `fecha_procesamiento` | Cuándo se ejecutó el flujo. |
| `fecha_reportada` | Fecha extraída del mensaje. |
| `usuario_emisor` | Número de teléfono (`participantPn`) del usuario de WhatsApp que publicó el mensaje. |
| `mensaje_literal` | Texto crudo del mensaje, sin modificar. |
| `salida_agente_texto` | Versión legible de las tareas extraídas (barco\|OT\|contratista). |
| `no_reconocido` | Resumen de fragmentos no resueltos. |
| `resumen_agente` | Análisis breve del LLM sobre la completitud del mensaje. |
| `total_filas` | Cantidad de filas escritas en la planilla principal. |
| `filas_review` | Cantidad de filas marcadas con R. |
| `llm_model` | Modelo utilizado (gpt-4o-mini). |
| `prompt_version` | Versión del prompt (gestionada desde el nodo Set - PromptConfig). |
| `tokens_in` / `tokens_out` | Métricas de costo y volumen. |

### 6.3 Salida terciaria: respuesta de confirmación
Mensaje de respuesta en WhatsApp que confirma al emisor: cantidad de filas registradas, filas en revisión y datos no resueltos. Cierra el ciclo de feedback con el encargado.

## 7. Reglas de negocio

*Viven en código determinístico o en validaciones cruzadas posteriores a la extracción semántica. No están sujetas a interpretación del LLM.*

### 7.1 Reglas de horas

**RN-01 — Target diario según calendario y tipo de operario**
- Lunes a viernes, operario propio (grupo ASTILLERO): target = 9 horas.
- Lunes a viernes, contratista externo: target = 8 horas.
- Sábado y domingo: target = 0 (todo lo reportado es hora extra).

**RN-02 — Distribución de horas extra**
- Las primeras 4 horas extra se imputan a la columna H. AL 50%.
- A partir de la quinta hora extra inclusive, a la columna H. AL 100%.

```
horas_normal = min(horas_totales, target)
horas_extra  = max(0, horas_totales - target)
horas_50     = min(horas_extra, 4)
horas_100    = max(0, horas_extra - 4)
```

*Dependencia conocida: el cálculo de target depende de saber si el operario es ASTILLERO o externo. Si el operario no resuelve contra el catálogo, el sistema no puede determinar el target y por defecto asume 8h (externo), produciendo un 8+1 en lugar de 9+0 para propios no reconocidos. La fila queda marcada con R, por lo que el revisor corrige; horas mal distribuidas siempre van acompañadas de R por operario no resuelto.*

**RN-03 — Multiplicación de horas por operarios múltiples**
Cuando un bloque menciona más de un operario para una misma tarea ("Operario D Operario E 2 horas limpieza"), las horas se imputan a cada operario individualmente (2h a cada uno), reflejando que ambos trabajaron en paralelo.

### 7.2 Reglas de matching de entidades

**RN-04 — Matching de operario**
El operario reportado debe matchear contra un nombre canónico del catálogo. Orden de preferencia: (1) match exacto sin sensibilidad a mayúsculas/acentos; (2) match parcial sobre apellido o nombre; (3) desambiguación por rubro si hay homónimos; (4) si persiste la ambigüedad, el campo queda nulo y la fila se marca con R. Los homónimos sin desambiguar requieren revisión humana del mensaje original.

**RN-05 — Matching de barco**
El barco se identifica por mención literal. Si no aparece explícito, se deduce: (1) por arrastre de contexto del bloque; (2) por cruce de rubro del operario, OTs habilitadas y descripción de la tarea. Si la deducción produce varias opciones o ninguna, la fila se marca con R pero se carga la mayor cantidad posible de datos conocidos (operario, horas, descripción, tipo, rubro). Cargar parcialmente reduce el tiempo de corrección manual.

**RN-06 — Matching de OT por habilitación (no solo por texto)**
El 98% de los mensajes no menciona explícitamente la OT. Deducción en dos filtros: primero por similitud textual entre la tarea y la columna Descripcion de las OTs del barco; luego, de esas candidatas, se conservan solo las que habilitan al operario o su grupo (`ASTILLERO.{rubro}`) en la columna G. Solo si queda exactamente una OT habilitada se resuelve; si quedan varias, es ambigüedad real (R); si ninguna habilita, la OT queda sin resolver (R), pero el resto de los datos se cargan.

*Corrige un comportamiento erróneo de la versión inicial, donde el sistema tomaba la primera coincidencia textual sin verificar habilitación. Ejemplo real: un calderero reportando "parche sentina" matcheaba la OT SENTINA (que solo habilita raschinaje) en vez de CALDERERIA VARIOS (que sí lo habilita y también menciona sentina en su descripción). La validación de habilitación ahora elige la OT correcta o marca R, en lugar de escribir un dato incorrecto sin señalarlo.*

**RN-07 — Validación cruzada match_contratista**
Una vez asignada una tupla (barco, OT, operario, rubro), el sistema verifica que el operario o su grupo (`ASTILLERO.{rubro}`) figure en la columna G de UNIFICADO para esa OT. Tras la corrección de RN-06, esta validación es una verificación de auditoría adicional, ya que la habilitación se aplica durante la selección de OT.

**RN-08 — Rubro: origen y desambiguación**
El rubro a escribir en la columna J es el mencionado o inferido del mensaje, NUNCA el del catálogo de personal. El rubro del catálogo solo se usa como tie-breaker cuando hay ambigüedad de operario homónimo.

### 7.3 Reglas de procesamiento textual

**RN-09 — Corrección ortográfica conservadora**
El LLM corrige errores ortográficos evidentes en español al generar OBSERVACIONES ("limpiesa" → "limpieza"). No reinterpreta contenido: si una palabra es ambigua, preserva el original.

**RN-10 — Trazabilidad del fragmento original**
Cada tarea extraída lleva un campo `raw_block` con el fragmento literal del mensaje del cual fue derivada. Permite reconstruir auditorías y validar interpretaciones.

### 7.4 Reglas de control de flujo

**RN-11 — Fecha bloqueante**
Si el mensaje no contiene una fecha reconocible, el sistema no lo procesa. Responde al emisor solicitando que agregue la fecha y reenvíe el mensaje completo. No se guarda estado intermedio en V1.

**RN-12 — Marcador R con escritura parcial**
Toda fila que carezca de al menos un campo obligatorio (fecha, barco, OT, operario, rubro, horas) se marca con "R". El marcador no impide la escritura: la fila se escribe con todos los campos conocidos con certeza, y las celdas vacías solo donde no se pudo completar.

**RN-13 — Contenido no resuelto preservado**
Cuando el LLM identifica fragmentos que no pudo asociar a ninguna fila, se genera una fila adicional con APROBACIÓN=R y el contenido literal en OBSERVACIONES. Ningún dato del mensaje se pierde silenciosamente.

**RN-13b — Barco faltante a nivel fila**
A diferencia de la fecha (bloqueante a nivel mensaje), el barco es atributo de cada fila. Si una tarea no tiene barco deducible, esa fila se marca con R y se carga con lo conocido, pero el resto de las filas del mensaje se procesan con normalidad.

**RN-14 — Inferencia del tipo de trabajo**
El tipo de trabajo (columna F destino) se infiere del texto de la columna Comentario de UNIFICADO para la OT correspondiente:
- Comentario vacío o sin mención relevante → HORA (default).
- Comentario con referencia a presupuesto ("Presupuesto", "PRC", "presu") → PRESUPUESTO.
- Comentario con referencia a control de horas → CONTROL.

## 8. Flujo lógico operacional

### 8.1 Diagrama lógico (V2_WA implementado)

```
[Webhook Evolution API]
  → [If - FiltroGrupoEvolution] remoteJid == grupo autorizado AND messageType == conversation
      -- FALSE --> DESCARTE SIN ACCIÓN
      -- TRUE  --> [E1] ExtractAndValidate (lee body.data, filtra fromMe, extrae fecha)
          → [IF - Tiene Fecha]
              -- NO --> [E1b - Solicitar Fecha WA] --> FIN
              -- SI --> [E2] CargarCatalogos (sub-workflow) [SWAP]
                  → [Set] PromptConfig (prompt_version + template editable)
                  → [E3a] PrepararPrompt --> [E3b] OpenAI --> [E3c] ParseLLMResponse
                  → [E4] ValidacionCruzada v1.2 (matching + OT por habilitación + OT por palabras clave + split de horas)
                  → [E5] CalcularHoras (astillero cap 9h / contratistas sin cap)
                  → [E6] ConsolidarFilas
                  → [E6b] PrepararLecturaColB --> [GET] LeerColumnaB
                  → [E7a] PrepararSheet (detecta última fila real, arma rango)
                  → [E7b] UpdatePlanilla (PUT por rango, no append)
                  → [E8] EscribirLog
                  → [E9 - ResponderUsuario WA] [SWAP]
                  → [E9b] GenerarYEnviarAlertas [DIFERIDO V2.1]
```

### 8.2 Descripción funcional por etapa

**Webhook Evolution API — Recepción WhatsApp [SWAP]**
- *Qué hace:* punto de entrada. Webhook genérico de n8n registrado en la instancia `OnliwAI Oficial` de Evolution API (path: `85200613-2036-47e0-889a-f42ca5132735`). Recibe todos los eventos de la instancia (mensajes, ACKs, presencia, etc.) sin filtrar.
- *Por qué se diseñó así:* toda la lógica de filtrado se movió al nodo siguiente, manteniendo el webhook como punto de recepción puro e intercambiable.
- *Requisito de infraestructura:* el flujo del agente de sesiones que comparta la misma instancia `OnliwAI Oficial` debe estar desactivado para que todos los eventos ingresen a este flujo.

**If — FiltroGrupoEvolution**
- *Qué hace:* primer filtro de la cadena. Evalúa dos condiciones AND: `$json.body.data.key.remoteJid === "120363410988413748@g.us"` (restringe al grupo autorizado) y `$json.body.data.messageType === "conversation"` (descarta audio, imagen, sticker, sistema, etc.). TRUE avanza a E1; FALSE descarta sin acción ni respuesta.
- *Por qué se diseñó así:* separa el filtrado (declarativo, UI) de la extracción (imperativo, código). Cambiar el grupo autorizado no requiere tocar E1.

**E1 — ExtractAndValidate**
- *Qué hace:* lee el texto desde `body.data.message.conversation`, aplica protección anti-loop (`key.fromMe === true` → error `MENSAJE_PROPIO_IGNORADO`), y extrae la fecha con regex (patrones DD/MM, DD-MM, DD de mes). Mapea al contrato interno:

  | Campo interno | Origen Evolution API |
  |---|---|
  | `rawText` | `body.data.message.conversation` |
  | `userId` | `body.data.key.participantPn` (o `key.participant`) |
  | `userName` | `body.data.pushName` |
  | `messageTs` | `body.data.messageTimestamp` |
  | `remoteJid` | `body.data.key.remoteJid` |
  | `instanceName` | `body.instance` |

- *Por qué se diseñó así:* E1 es el único nodo que conoce el formato del canal de entrada. Todos los nodos posteriores consumen el contrato interno normalizado. Un cambio de canal solo requiere reescribir E1. `remoteJid` se propaga hasta E9 para que la respuesta llegue al mismo grupo que originó el mensaje.

**E1b — Solicitar Fecha WA**
- *Qué hace:* si E1 no encuentra fecha, envía un mensaje al grupo de WhatsApp (Evolution API, nodo `evolutionApi`) pidiendo al emisor que agregue la fecha y reenvíe el mensaje completo. El flujo termina sin escribir en la planilla.
- *Por qué se diseñó así:* no se persiste estado de mensaje pendiente; el costo de reenvío es bajo. Usa `remoteJid` propagado por E1 para responder al grupo correcto.

**E2 — CargarCatalogos [SWAP]**
- *Qué hace:* sub-workflow que lee personal, rubros, barcos y OTs activas, y devuelve un objeto JSON estándar. Lee de dos spreadsheets (`B.D.NewSystemm` y `LISTA_TRABAJOS`).
- *Por qué se diseñó así:* punto crítico de la migración futura a Supabase. Mientras el contrato JSON de salida se mantenga, los nodos internos pueden reemplazarse sin tocar el flujo principal.

**Set — PromptConfig**
- *Qué hace:* define `prompt_version` y `prompt_template` como valores editables desde la UI, con placeholders (`{{PERSONAL}}`, `{{RUBROS}}`, `{{BARCOS}}`, `{{OTS}}`) que E3a reemplaza con los catálogos.
- *Por qué se diseñó así:* extrae el prompt del código JavaScript a un lugar visible y editable sin programar. Cada cambio incrementa `prompt_version`, registrado en el log para A/B testing y rollback.

**E3a/E3b/E3c — Extracción LLM**
- *Qué hace:* E3a arma el prompt inyectando los catálogos. E3b llama a la API de OpenAI (gpt-4o-mini, structured output JSON). E3c parsea la respuesta y la fusiona con los datos del mensaje.
- *Por qué se diseñó así:* el structured output garantiza formato estable. Few-shot examples en el prompt enseñan a manejar los formatos heterogéneos de los encargados.

**E4 — ValidacionCruzada (v1.2)**
- *Qué hace:* valida cada tarea del LLM contra catálogos (operario, barco, rubro); selección de OT en dos modos — **modo texto:** si el LLM propone `ot_candidata`, busca por texto exacto o substring filtrando por habilitación de col G (RN-06); **modo keywords (nuevo en v1.2):** si no hay `ot_candidata`, usa `palabras_clave` (o extrae keywords de `observacion`) para puntuar todas las OTs del barco — 1 match → directo; 2 matches empatados → se mantienen ambos (split de horas); 3+ empatados → filtra por habilitación de col G. Cuando hay más de una OT ganadora, genera N filas con horas/N cada una, marcadas R. Infiere `tipo_trab` (RN-14); determina `needs_review` y `motivo_revision`.
- *Por qué se diseñó así:* convierte la inferencia probabilística del LLM en verdad verificable contra catálogos. El modo keywords resuelve el caso frecuente donde el encargado no menciona el nombre exacto de la OT. La regla escalonada de habilitación filtra ruido solo donde el ruido puede ser un problema real (3+ candidatas), sin descartar trabajo real en dos OTs simultáneas (2 candidatas).

**E5 — CalcularHoras**
- *Qué hace:* aplica RN-01 y RN-02 en código determinístico según tipo de operario. **Personal astillero:** cap de 9h normales por jornada; excedente hasta 4h → horas_50; más de 4h → horas_100; fin de semana: todo excedente. **Contratistas:** sin cap; todo va a horas_normal; horas_50/horas_100 siempre vacíos; las horas ya vienen acumuladas del LLM (N personas × hs c/u = 1 fila con total).
- *Por qué se diseñó así:* los contratistas facturan por horas totales sin distinción normal/extra. Aplicarles el cap del personal propio generaba filas incorrectas al 50%. La aritmética nunca queda en manos del LLM.

**E6 — ConsolidarFilas**
- *Qué hace:* agrupa por (fecha, operario, barco, OT, rubro). Suma horas, concatena observaciones de obra y motivos de revisión en arrays separados, expande operarios múltiples.
- *Por qué se diseñó así:* la consolidación es determinística, no depende del LLM. La separación de observaciones (T) y motivo de revisión (AE) ocurre aquí.

**E6b / GET — Detección de última fila**
- *Qué hace:* E6b prepara la URL para leer solo la columna B de la hoja HORAS. El nodo GET hace la lectura. E7a recorre esos valores de atrás hacia adelante para encontrar la última fila con FECHA real.
- *Por qué se diseñó así:* resuelve que el método `append` de Sheets cuenta las fórmulas arrastradas (columna S) como datos, escribiendo en filas equivocadas. Anclar a la columna B (que solo se llena con un registro real) da control exacto.

**E7a — PrepararSheet**
- *Qué hace:* calcula el rango de destino (`A{n+1}:AE{n+m}`) y arma la matriz de 31 columnas, escribiendo solo A-J, T, AD, AE y dejando intactas K-S (incluida la fórmula de S).
- *Por qué se diseñó así:* la escritura es quirúrgica: el flujo controla la fila exacta, no la heurística de Sheets.

**E7b — UpdatePlanilla**
- *Qué hace:* escribe las filas vía PUT a `values/{rango}` con `valueInputOption=USER_ENTERED`, en lugar de append.
- *Por qué se diseñó así:* el update por rango respeta la fila calculada y no salta a posiciones equivocadas. Requiere que la hoja tenga filas físicas disponibles (ver Sección 14, Lecciones de implementación).

**E8 — EscribirLog**
- *Qué hace:* genera una fila en `LOG_PROCESAMIENTO` con toda la trazabilidad del mensaje (operación append).
- *Por qué se diseñó así:* la hoja de log convive con la planilla destino para facilitar auditorías cruzadas. Se revisará al migrar a Supabase.

**E9 — ResponderUsuario WA [SWAP]**
- *Qué hace:* envía confirmación al grupo de WhatsApp (Evolution API, `instanceName: OnliwAI Oficial`) con el resumen armado por E9a. Lee `remoteJid` propagado por E1. El campo con el texto conserva internamente el nombre `_slack_text` por compatibilidad; el contenido es idéntico al de V1 (Markdown con emoji).
- *Por qué se diseñó así:* el feedback inmediato cierra el ciclo y permite detectar problemas en caliente. Al leer `remoteJid` de E1, la respuesta siempre va al mismo grupo que originó el mensaje.

**E9b — GenerarYEnviarAlertas [DIFERIDO V2.1]**
- *Qué hace:* nodo placeholder. Especificado pero no implementado — ver Anexo D.
- *Por qué se diseñó así:* depende del catálogo de contactos por rol, que vivirá en Supabase.

## 9. Estructura de datos

### 9.1 Contrato de salida del sub-workflow CargarCatalogos

```json
{
  "personal": [
    { "nombre": "Apellido, Nombre", "grupo": "ASTILLERO", "rubro": "MAQUINISTA", "usd_hora": "<monto>" }
  ],
  "rubros": ["RASCHINAJE", "CALDERERIA", "PALA", "MECANICA", "..."],
  "barcos": ["CALIZ", "LOBO", "ARTESANAL", "..."],
  "ots_activas": [
    {
      "barco": "CALIZ",
      "ot": "TOBERA",
      "descripcion": "...",
      "contratistas_col_g": "TOBARES, ASTILLERO.PALA",
      "comentario": "...",
      "jefe_obra": "..."
    }
  ]
}
```

### 9.2 Schema de salida del LLM
Schema JSON forzado vía structured output en la API de OpenAI. Cada tarea incluye `raw_block`, `barco`, `ot_candidata`, `operario`, `rubro`, `horas`, `observacion`, y campos de matching (`match_barco`, `match_operario`, `match_rubro`, `match_ot`, `confidence`). A nivel mensaje: `campos_no_resueltos` y `resumen_agente`.

### 9.3 Estructura enriquecida post-validación
Después de E4 y E5, cada item se enriquece con campos derivados:

| Campo | Origen | Significado |
|---|---|---|
| `barco_canonico` / `operario_canonico` / `ot_canonica` / `rubro_canonico` | E4 | Entidad canónica resuelta del catálogo, o null si no resolvió. |
| `match_contratista` | E4 | `valid_astillero` \| `valid_external` \| `mismatch` \| `not_found` \| `not_applicable` |
| `tipo_trab` | E4 | HORA \| PRESUPUESTO \| CONTROL (inferido del comentario de la OT, RN-14). |
| `needs_review` | E4 | true si algún campo obligatorio falta o si hay inconsistencia. |
| `motivo_revision` | E4 | Texto del diagnóstico del sistema (va a la columna AE). |
| `deduced_fields` | E4 | Campos cuyo match no fue exacto. |
| `horas_normal` / `horas_50` / `horas_100` | E5 | Distribución de horas calculada. |

## 10. Relaciones entre entidades

### 10.1 Diagrama lógico de entidades

```
BARCO *---* ORDEN_TRABAJO (relación N:M vía tabla puente)
                |
     par (barco, OT) asignado a
                v
   CONTRATISTA(*) o GRUPO_ASTILLERO.RUBRO
                | ejecuta
                v
REGISTRO_HORA (vincula OPERARIO + BARCO + OT + RUBRO + FECHA + HORAS + TIPO_TRABAJO)
                ^
                |
OPERARIO --> GRUPO_DE_TRABAJO --> RUBRO (principal)
```

### 10.2 Cardinalidad y reglas relacionales
- **La relación entre BARCO y OT es de muchos a muchos.** Muchas OTs son de catálogo, estandarizadas, que aplican a varios barcos (VARADERO para todo barco que sube a seco, SENTINA para todo barco que limpia su sentina). Permite estadística por tipo de trabajo. En consecuencia, la deducción de OT se filtra siempre por barco (RN-06).
- Una OT tiene asignados uno o más CONTRATISTAS o grupos ASTILLERO.RUBRO en la columna G de UNIFICADO, para un barco dado.
- Un OPERARIO pertenece a un único GRUPO_DE_TRABAJO; un grupo tiene múltiples operarios.
- Un OPERARIO tiene un RUBRO principal, pero puede ejecutar tareas de otros rubros (many-to-many en la práctica).
- Un REGISTRO_HORA vincula OPERARIO + BARCO + OT + RUBRO + FECHA + HORAS + **TIPO_TRABAJO** (columna F).

### 10.3 Notas para migración a modelo relacional
Al migrar a Supabase, entidades candidatas a tablas con claves foráneas: `barcos`, `operarios`, `grupos_trabajo`, `rubros`, `ordenes_trabajo`, `ot_asignaciones` (tabla puente entre barco y OT, dado que la relación es N:M), `registros_horas` (con `tipo_trabajo` explícito), `log_procesamiento`. La estructura de UNIFICADO, donde un par (barco, OT) es una fila, ya está en formato long y mapea bien a `ot_asignaciones`.

## 11. Manejo de errores

*Filosofía: nunca silenciar un error de interpretación. Los errores se exteriorizan al usuario o quedan visibles en la planilla con el marcador R, pero no se ocultan.*

### 11.1 Categorías de error y manejo

| Categoría | Detección | Manejo |
|---|---|---|
| Fecha ausente | Regex sin match en E1. | Mensaje al emisor pidiendo fecha; flujo termina sin escribir. |
| Campo obligatorio vacío | `needs_review = true` en E4. | Fila escrita con R; motivo en columna AE. |
| OT sin habilitación | Ninguna candidata textual habilita al operario (RN-06). | Fila escrita con R; OT vacía; motivo en AE. |
| Mensaje del bot | `body.event.bot_id` presente en E1. | Se descarta con error controlado (evita loop). |
| Fragmento no asociado | El LLM lo reporta en `campos_no_resueltos`. | Fila adicional con R y texto literal en OBSERVACIONES. |
| Falla del LLM | Error de OpenAI. | Error capturado en E3c; fila de log marcada; mensaje al emisor. |
| Falla de Google Sheets | Error de la API (protección, grid limit). | Error visible; requiere intervención (ver Sección 14). |

### 11.2 Política de degradación
El sistema favorece la degradación parcial sobre la falla total. Es preferible escribir 5 filas correctas y 2 con R que rechazar el mensaje completo — el encargado ya envió el mensaje; reenviarlo entero tiene un costo alto.

### 11.3 Auditoría y trazabilidad

**Principios de trazabilidad:**
- Mensaje literal preservado: el texto crudo se almacena íntegro en el log.
- Decisiones del agente registradas: cada fila lleva los campos `match_*` y `motivo_revision` que explican cómo se resolvió cada entidad.
- Vinculación cruzada: `mensaje_id` (columna AD) permite saltar desde una fila de la planilla al log y a todas sus filas hermanas.
- Trazabilidad de costos: `tokens_in` y `tokens_out` por mensaje.
- Versionado de prompt: `prompt_version` registra qué versión del agente generó qué resultado.

**Gestión de versiones del prompt:** el prompt completo (rol, reglas, few-shot e instrucciones) vive en el nodo Set - PromptConfig, con `prompt_version` y `prompt_template` editables desde la UI. Los catálogos se inyectan dinámicamente en E3a vía placeholders; el resto es fijo y versionado. Flujo recomendado para cambiar el prompt:
1. Antes de cambiar, correr el test de regresión (10-20 mensajes de referencia) con la versión actual.
2. Hacer el cambio e incrementar la versión (v1.1 → v1.2).
3. Correr los mismos tests con la nueva versión.
4. Si mejora, deployar. Si empeora, revertir al texto anterior.

**Campo `mensaje_id` en planilla destino:** incluido en el alcance V1 — la planilla registra el `mensaje_id` originador de cada fila en la columna AD, habilitando trazabilidad bidireccional entre planilla y log.

## 12. Dependencias críticas

### 12.1 Dependencias técnicas externas

| Dependencia | Función | Riesgo si falla |
|---|---|---|
| Evolution API (WhatsApp) | Recepción de mensajes (webhook) y respuesta al emisor. | Bloqueo total del trigger. |
| OpenAI API | Extracción semántica. | Bloqueo del procesamiento; sin alternativa inmediata. |
| Google Sheets API | Lectura de catálogos (`B.D.NewSystemm`, `LISTA_TRABAJOS`) y escritura (HORAS). | Bloqueo total de lectura y persistencia. |
| n8n self-hosted | Plataforma de ejecución (Docker, v2.4.7). | Caída del orquestador detiene el sistema. |
| Evolution API | (Futuro) WhatsApp; hoy no activa. | Sin impacto en V1. |

> **Nota de fidelidad a la fuente:** el PDF original lista "Evolution API" dos veces en esta tabla — una vez como canal activo crítico y otra como "(Futuro) WhatsApp; hoy no activa", lo cual es inconsistente con el resto del documento (que describe a WhatsApp/Evolution API como el canal ya migrado y en producción desde V2_WA). Es probable que sea un remanente no actualizado de la versión anterior (V1, basada en Slack). Se transcribe tal cual figura en la fuente, sin corregir, para no alterar el documento original.

### 12.2 Dependencias funcionales internas
- Calidad y vigencia del catálogo de personal: nuevos operarios deben ingresarse (y marcarse ACTIVO) antes de aparecer en mensajes.
- Calidad de la columna G de UNIFICADO: las asignaciones de contratistas deben mantenerse actualizadas para que RN-06 y RN-07 funcionen.
- Convención de nomenclatura estable en el catálogo de personal: si cambia el formato de nombres, el matching degrada.
- Disponibilidad de filas físicas en la hoja HORAS: la escritura por rango requiere que la hoja tenga filas vacías disponibles (ver Sección 14).

### 12.3 Punto único de falla más sensible
*El catálogo de personal en `B.D.NewSystemm` es el punto único de falla más sensible. Si se corrompe, se renombra masivamente o se reorganiza, el sistema pierde su capacidad de matching. Como red de seguridad se propone un snapshot diario (no implementado en V1; ver Sección 17, Recomendaciones arquitectónicas).*

## 13. Escalabilidad futura

### 13.1 Ejes de escalabilidad
- **Volumen:** escalar a cientos de mensajes/día requiere caching de catálogos, procesamiento concurrente y, eventualmente, base de datos transaccional.
- **Canales de entrada:** el Webhook está diseñado para ser intercambiable. Agregar WhatsApp, email u otro canal solo requiere normalizar al objeto interno estándar.
- **Persistencia de catálogos:** `CargarCatalogos` absorbe la fuente. Migrar a Supabase implica reescribir solo ese sub-workflow.
- **Persistencia de registros:** E7a/E7b pueden migrar de Sheets a Supabase de forma similar.
- **Complejidad semántica:** si los catálogos superan ~3000 entradas, migrar a tool calling o RAG en lugar de catálogos en contexto.

### 13.2 Roadmap propuesto

| Hito | Cambio | Trigger del cambio |
|---|---|---|
| V1.1 | Correcciones post-MVP: OT por habilitación, escritura por rango, prompt editable, columna AE. | Implementado tras validación del MVP. |
| V1.2 | Reglas de negocio por OT (rubros permitidos por tipo de orden). | Cuando se mapee la lógica de negocio del proyecto de aplicación. |
| V1.3 | Mecanismo de pendientes para mensajes incompletos. | Si el % de mensajes rechazados por fecha es alto. |
| V2.0 | Migración de catálogos a Supabase, incluida tabla de contactos por rol. | Cuando esté listo el modelo relacional. |
| V2.1 | Activación de alertas por rol (E9b). Migración del trigger a WhatsApp. | Tras disponer de la tabla de contactos y validar Evolution API. |
| V2.2 | Migración de planilla destino a base de datos + UI. | Cuando la planilla sea cuello de botella. |

## 14. Lecciones de implementación (post-MVP)

*Problemas concretos encontrados durante la puesta en producción del MVP y sus soluciones. Referencia para mantenimiento y para futuros flujos del astillero.*

**Trigger de Slack: credencial y handshake.** El nodo Slack Trigger nativo requiere credencial tipo "Slack API" (Access Token + Signing Secret), distinta de "Slack OAuth2 API". En n8n 2.4.7 el trigger no permitía seleccionar la credencial OAuth2 existente. Solución: nodo Webhook genérico con Event Subscriptions de Slack. Slack valida la URL con un challenge que el endpoint debe responder (patrón: Webhook con respuesta "Using Respond to Webhook Node" + nodo Respond to Webhook leyendo el challenge por referencia explícita). El bot debe ser invitado explícitamente al canal con `/invite @nombrebot`.

**Loop de auto-respuesta del bot.** Tras conectar el trigger, el bot entró en loop: su propia respuesta "falta fecha" disparaba una nueva ejecución. El payload de esos mensajes incluye `body.event.bot_id`. Solución: filtrar en E1 — si `body.event.bot_id` está presente (o `subtype = bot_message`), el mensaje se descarta.

**Estructura del payload: `body.event`.** El texto del mensaje no está en la raíz del payload sino anidado en `body.event.text`. El código de E1 debe leer desde `body.event`, no desde la raíz (idem `user`, `ts`, `channel`).

**Referencias entre nodos Code: `$input` vs nodo por nombre.** Lección recurrente: un nodo Code con `$input.first().json` toma el JSON del nodo inmediatamente anterior. Insertar un nodo nuevo entre dos existentes rompe silenciosamente cualquier Code posterior que use `$input`. La forma robusta es referenciar el nodo de datos por nombre explícito, ej. `$('E2 - CargarCatalogos').first().json`. Este error apareció dos veces (E3a y E7a) tras insertar los nodos Set - PromptConfig y GET - LeerColumnaB.

**Escritura en planilla: protección, append y grid limits.**
- Celdas protegidas: la hoja tenía rangos protegidos que bloqueaban la escritura. Resuelto agregando la cuenta de servicio a los permisos del rango en Datos → Hojas y rangos protegidos.
- `append` salta filas: cuenta las fórmulas arrastradas (columna S) como datos y escribe después de ellas, no después de la última fila real. Reemplazado por escritura por rango (update PUT) anclada a la última fila con valor en columna B.
- Grid limits: la escritura por rango falla si la hoja no tiene filas físicas disponibles (error "exceeds grid limits"). Hay que extender la hoja con filas vacías; mantener siempre un margen libre.
- `matchingColumns` en append: la operación `appendOrUpdate` requiere el parámetro `matchingColumns`. Para el log, que solo agrega, conviene usar `append` simple.

**Colapso de items en sub-workflows.** En `CargarCatalogos`, los nodos Code - Collapse1 y Collapse2 colapsan los N items de un catálogo en 1 solo, evitando que el siguiente nodo de lectura se ejecute una vez por cada fila. No transforman datos, solo controlan la cardinalidad. Los datos reales se recuperan después con `$('GS - Leer ...').all()` en el nodo BuildCatalog.

**Migración Slack → WhatsApp: convivencia de canales.** El workflow V2_WA mantiene en paralelo la rama Slack original (Webhook + E1b Slack + E9 Slack) junto a la rama nueva de WhatsApp (Webhook1 + If-FiltroGrupoEvolution + E1b WA + E9 WA). La rama Slack queda inactiva en producción pero no fue eliminada, para facilitar un eventual rollback sin reconfiguración. El campo `_slack_text` en E9a conserva su nombre por compatibilidad con la rama Slack existente; el contenido es el mismo, solo cambia el canal de envío.

**Horas de contratistas: acumulación N×hs vs N filas.** Hasta V1.2, el prompt generaba N filas para "N personas X hs c/u", y E5 capaba cada fila a 8/9h, produciendo horas al 50% que no correspondían (los contratistas no tienen régimen de horas extra). Solución doble: el prompt ahora genera 1 fila con horas = N×hs, y E5 aplica el branch sin cap para todos los operarios de tipo "contratista".

**Sincronización placeholder `<<>>` vs `{{}}`.** El nodo Set-PromptConfig almacena `prompt_template` con el prefijo "=" que hace que n8n interprete el campo como expresión. La sintaxis nativa de expresiones de n8n es `{{…}}`, idéntica a los placeholders del prompt. n8n evaluaba y borraba los placeholders antes de que E3a pudiera reemplazarlos, dejando las secciones de catálogo vacías en el system prompt. Solución: cambiar los placeholders a `<<…>>` (ángulos), que n8n no interpreta como expresión propia.

## KPIs (opcional)

*Indicadores calculables desde `LOG_PROCESAMIENTO` sin instrumentación adicional.*

### KPIs de procesamiento

| KPI | Objetivo |
|---|---|
| Mensajes procesados por día | Monitorear volumen. |
| Filas escritas por mensaje (promedio) | Detectar variaciones inusuales. |
| Tasa de filas con R | < 15% saludable; > 30% requiere intervención (prompt, catálogos). |
| Tiempo de procesamiento promedio | < 10 segundos por mensaje. |
| Tasa de mensajes sin fecha | < 5% saludable. |

### KPIs de costo y calidad
- Costo de LLM por mensaje y costo total mensual (vía tokens del log).
- Tasa de mismatch en `match_contratista` (< 10%; valores altos indican catálogo desactualizado).
- Tasa de mensajes sin tareas extraíbles (< 2%).

### Implementación recomendada
Para V1, los KPIs se materializan en una hoja `KPI_DASHBOARD` en la misma planilla, con fórmulas (COUNTIF, AVERAGEIF, SUMIF) sobre `LOG_PROCESAMIENTO`. Objetivo de mediano plazo: persistir estos KPIs en una base relacional (Supabase). No se recomienda construir esa base desde el inicio — el volumen actual no lo justifica. La hoja es suficiente hasta superar ~10.000 registros en el log.

## Riesgos operativos (opcional)

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| Drift del LLM (cambio de comportamiento de gpt-4o-mini). | Media | Alto | Versionado de prompt; pinning del modelo; tests de regresión. |
| Alucinación de operarios o barcos inexistentes. | Baja | Alto | Validación cruzada en E4; filas fuera de catálogo se marcan con R. |
| Costo de OpenAI fuera de presupuesto. | Baja | Medio | Tracking de tokens en log; alertas por umbral. |
| Loop de auto-respuesta del bot. | Resuelto | Alto | Filtro de `body.event.bot_id` en E1. |
| Filas duplicadas por reenvío del mismo mensaje. | Media | Bajo | Detección por `messageTs`; idempotencia opcional vía hash. |
| Hoja HORAS sin filas físicas disponibles. | Media | Medio | Extender filas manualmente; alerta de umbral propuesta (Sección 17). |
| Cambios de esquema en catálogos sin coordinación. | Alta | Alto | Documentar contrato `CargarCatalogos` (Anexo C); tests sobre el sub-workflow. |

## Recomendaciones arquitectónicas (opcional)

### Decisiones de diseño que conviene preservar
- Separación entre extracción semántica y validación determinística: el LLM interpreta lenguaje ambiguo; la aritmética, consolidación y validación contra catálogos viven en código. Base de la confiabilidad.
- Sub-workflows como puntos de migración: `CargarCatalogos` aísla la dependencia con Sheets. Mantener esta abstracción es clave para que la migración a Supabase sea de bajo riesgo.
- Trazabilidad por defecto: el log se diseñó como ciudadano de primera clase, permitiendo auditoría barata y A/B testing del prompt.
- Validación bloqueante de fecha: protege la integridad del registro horario.
- Selección de OT por habilitación, no por texto: evita escribir OTs incorrectas sin señalarlas. Es preferible una R explícita a un dato falso silencioso.

### Recomendaciones a corto plazo
- Implementar un test de regresión semántica: 10-20 mensajes con su output esperado, ejecutado antes de cambiar el prompt.
- Mantener actualizado el contrato `CargarCatalogos` documentado en el Anexo C.
- Establecer una alerta automática si la tasa de filas con R supera 30% en 24 horas.
- Agregar una validación en E7a que alerte cuando queden menos de ~500 filas físicas libres en la hoja HORAS.

### Recomendaciones a mediano plazo
- Migrar el catálogo de personal a Supabase: primer candidato natural por ser el más crítico y menos volátil.
- Implementar un dashboard (Looker Studio o similar) sobre `LOG_PROCESAMIENTO` y `KPI_DASHBOARD`.
- Diseñar el mecanismo de pendientes documentando casos de uso y de error.
- **Propuesta (no implementada):** snapshot diario del catálogo de personal. Flujo n8n independiente, programado diariamente (ej. 23:59 hs), que: (1) lee la hoja de personal completa; (2) la escribe en una hoja de respaldo (`SNAPSHOT_PERSONAL_AAAA-MM-DD` o sobrescribiendo `SNAPSHOT_PERSONAL_LAST`); (3) opcionalmente compara con el día anterior y registra diferencias en `DIFF_PERSONAL`. Al migrar a Supabase, el versionado por fila reemplaza este mecanismo.

### Antipatrones a evitar
- No agregar lógica de negocio dentro del prompt del LLM (cálculo de horas, decisiones de aprobación, reglas de OT). El LLM extrae; el código decide.
- No usar `append` en la planilla destino cuando hay fórmulas arrastradas: cuentan como datos y rompen el posicionamiento. Usar escritura por rango anclada a columna B.
- No depender de posiciones de columna por número en lógica futura; preferir headers cuando sea posible.
- No mezclar lógica de canal (Slack/WhatsApp) con lógica de negocio. E1 normaliza; el resto del flujo no debe saber qué canal existe.
- No usar `$input.first()` en nodos Code que vengan después de un nodo insertado: referenciar el nodo de origen por nombre explícito.

## Anexos (opcional)

### Anexo A — Glosario operativo

| Término | Definición |
|---|---|
| Astillero | Instalación de construcción, reparación y mantenimiento de embarcaciones. |
| Barco | Embarcación que ingresa al astillero. Unidad de agrupación primaria de los trabajos. |
| Orden de Trabajo (OT) | Definición de una tarea. Muchas OTs son de catálogo (VARADERO, SENTINA) y aplican a varios barcos; la relación barco-OT es muchos a muchos. |
| Rubro | Categoría de trabajo (raschinaje, calderería, carpintería, mecánica, pintura, pala, grúa, etc.). |
| Operario propio | Empleado del astillero. Grupo de trabajo = ASTILLERO. Target 9h L-V. |
| Contratista externo | Persona o empresa subcontratada. Grupo distinto a ASTILLERO. Target 8h L-V. |
| Encargado de registrar | Persona que recibe los reportes por WhatsApp y los publica en el grupo autorizado. Emisor registrado en el log. |
| Marcador R | Identificador en columna APROBACIÓN que señala que la fila requiere revisión humana. |
| Habilitación | Que un operario/grupo figure en la columna G de UNIFICADO para una OT, lo que lo autoriza a trabajarla. |
| `match_*` | Familia de campos de auditoría que registran cómo se resolvió cada entidad (exact, fuzzy, deduced, none). |
| `motivo_revision` | Diagnóstico del sistema sobre por qué una fila quedó con R (columna AE). |
| `raw_block` | Fragmento literal del mensaje original que dio lugar a una fila específica. |
| Contrato CargarCatalogos | Forma estable de los catálogos en JSON, independiente de su fuente real. |

### Anexo B — Ejemplos de mensajes y output esperado

**B.1 Ejemplo: mensaje de operador de pala**

Mensaje recibido: *"22-5 Pala sacar tobera de cáliz y llevar al fondo 30 minutos tobares. Pala tirar chapa en desguace Ávalos 1 hora Pala llevar oxígeno a don Vicente 30 minutos nieri."*

Interpretación esperada:
- Fecha: 22/05/{año}. Rubro común: PALA. Operario ejecutor: Operario A (maquinista, deducido por rubro PALA).
- Línea 1: barco CALIZ, OT deducida (TOBERA), 0.5h.
- Línea 2: barco AVALOS, OT deducida, 1h.
- Línea 3: barco DON VICENTE, OT deducida, 0.5h.

**B.2 Ejemplo: reporte multi-operario por equipo**

Mensaje recibido (fragmento): *"RaschinesBruno e hugo Achique y limpieza centina Caliz 9 hs Martin ezequiel Achique pozo. Pezca Lobo 1 hs"*

Interpretación esperada:
- Rubro contextual: RASCHINAJE.
- Bloque 1: dos operarios (Operario B y Operario C), barco CALIZ, OT achique/limpieza, 9h cada uno. OBSERVACIONES corregido a "Achique y limpieza sentina".
- Bloque 2: dos operarios (Operario D y Operario E), barco LOBO, OT achique pozo, 1h cada uno.
- Cualquier ambigüedad de homónimos se resuelve por rubro contextual (RN-04 punto 3); si no resuelve, queda con R.

**B.3 Ejemplo: corrección de OT por habilitación (caso real)**

Mensaje recibido (fragmento): *"16/6 Operario F, vuoso parche sentina 9hr"*.

Operario F es del grupo ASTILLERO con rubro CALDERERIA. En el barco DON VICENTE VUOSO existen varias OTs cuya descripción menciona "sentina": OT SENTINA (habilita solo ASTILLERO.RASCHINAJE) y OT CALDERERIA VARIOS (habilita ASTILLERO.CALDERERIA, descripción incluye "Parche en sentina").

Interpretación esperada: el sistema descarta SENTINA (no habilita calderería) y resuelve CALDERERIA VARIOS, la única que habilita al operario. La versión inicial escribía SENTINA por coincidencia textual; RN-06 corrige esto.

### Anexo C — Contrato de datos CargarCatalogos

Especifica las fuentes, columnas y filtros que alimentan el sub-workflow `CargarCatalogos` sobre Google Sheets. El contrato de salida (forma del JSON) se mantiene estable; lo que cambiará al migrar a Supabase es la capa de lectura.

**C.1 Spreadsheets involucradas**

| Spreadsheet | ID | Rol |
|---|---|---|
| B.D.NewSystemm | `1OHFCkWKOwaknei6eV6wBZrEXHlye2QK3RJUqC0yDT-4` | Fuente de personal y rubros. |
| LISTA_TRABAJOS | `1rmjCqJoy7lz0YPlbmzHxp9Jj_pMHfSNBmpvS3BhxAlQ` | Fuente de barcos y OTs activas (hoja UNIFICADO). |
| HORAS_PLANILLAS_DE_REGISTRO | `19SFRudDicJ2gKPCWW-UDu2J7-JlpZlrW46TX1DBgmuw` | Solo escritura: planilla destino y log. No se lee como catálogo. |

**C.2 Catálogo: Personal**

Fuente: `B.D.NewSystemm` → hoja `PersonalClasificacionCostos`. Filtro: solo registros con ESTADO (columna H) = ACTIVO.

| Columna | Header | Campo JSON |
|---|---|---|
| A | NOMBRE | `nombre` |
| B | GRUPO DE TRABAJO | `grupo` |
| C | U$/HORA | `usd_hora` |
| D | RUBRO | `rubro` |
| H | ESTADO | (filtro) |

**C.3 Catálogo: Rubros**

Fuente: `B.D.NewSystemm` → hoja `BaseDatosP/PlanillasRegistro`, columna C. Es la fuente de verdad; `RUBROS_OtrosDesplegables_IMPORTADA` es un export derivado, no se usa como fuente de lectura.

**C.4 Catálogo: Barcos**

Fuente: `LISTA_TRABAJOS` → `UNIFICADO`, columna A. Filtro: valores únicos no vacíos, solo filas con estado (columna E) = "En ejecución/En curso".

**C.5 Catálogo: OTs activas**

Fuente: `LISTA_TRABAJOS` → `UNIFICADO`. Filtro: estado (columna E) = "En ejecución/En curso" (distinto del filtro de AvisoOtNueva, columna L, que es otra vista de la misma hoja).

| Columna | Header | Campo JSON |
|---|---|---|
| A | BARCO | `barco` |
| C | ORDEN DE TRABAJO | `ot` |
| D | Descripcion | `descripcion` |
| G | Contratista / Externo | `contratistas_col_g` |
| F | Comentario | (infiere `tipo_trab`, RN-14) |
| H | JEFE DE OBRA | `jefe_obra` |
| E | Estado | (filtro) |

*Tipo de trabajo: se infiere del texto de la columna Comentario (F) según RN-14. Vacío → HORA; mención de presupuesto → PRESUPUESTO; mención de control → CONTROL. No es una columna numérica dedicada sino una lectura semántica del comentario.*

**C.6 Referencia de headers de UNIFICADO**

| Col | Header | Col | Header |
|---|---|---|---|
| A | BARCO | K | usuario_origen |
| B | FECHA | L | enviar notificacion |
| C | ORDEN DE TRABAJO | M | ENVIO AVISO |
| D | Descripcion | T | SlackChannel_ID |
| E | Estado | U | SeCreoOT |
| F | Comentario | | |
| G | Contratista / Externo | | |
| H | JEFE DE OBRA | | |
| J | NUMERO DE OT | | |

### Anexo D — Sistema de alertas por rol (diferido a V2.1)

*Sección compuesta a partir de "11 bis. Sistema de alertas (fase diferida)" y "Anexo D — Catálogo de contactos por rol" del documento fuente: ambos describen la misma funcionalidad futura (nodo E9b) y se agrupan aquí por no tener un slot propio en la plantilla estándar.*

**Estado:** propuesta/diferido. La estructura queda especificada y preparada, pero su implementación se difiere a V2.1: depende del catálogo de contactos por rol, que requiere la base de datos de Supabase.

En V1, todas las filas con R quedan visibles en la planilla y el resumen general se envía al encargado de registrar (E9). El sistema de alertas por rol agregaría notificaciones segmentadas: cada responsable recibe únicamente lo que le compete.

**D.1 Matriz de alertas por rol**

| Dato faltante | Destinatario / Rol | Bloqueante |
|---|---|---|
| OT no deducida | Jefe de obra de esa OT (columna H de UNIFICADO) — JEFE DE OBRA | No — fila con R |
| Contratista no asignado | Jefe de obra de esa OT — JEFE DE OBRA | No — fila con R |
| Barco no deducible | Encargado de registrar — ENCARGADO DE REGISTRAR | No — fila con R (RN-13b) |
| Fecha ausente | Encargado de registrar — ENCARGADO DE REGISTRAR | Sí — corta el mensaje (RN-11) |
| Operario no reconocido | Supervisor — SUPERVISOR | No — fila con R |
| Otros casos no resueltos | Supervisor — SUPERVISOR | No — fila con R |

**D.2 Lógica de agrupación y envío.** Las alertas se agruparían inmediatamente después de procesar cada mensaje (nodo paralelo a E9), agrupadas por destinatario: si un jefe de obra tiene tres tareas con OT faltante, recibiría un único mensaje consolidado, no tres. Formato de mensaje ejemplo (jefe de obra): *"Jefe [Nombre]: Faltan detalles para las siguientes tareas: - [Barco] - [Operario] - [Rubro]: falta OT - [Barco] - [Operario] - [Rubro]: falta asignación de contratista. Por favor detalla en el canal [ID/nombre]."*

**D.3 Diseño de roles fijos, usuarios variables.** El subsistema desacopla el rol del usuario. Los roles (JEFE DE OBRA, ENCARGADO DE REGISTRAR, SUPERVISOR) son fijos; las personas que los ocupan y sus identificadores varían. El sistema resuelve en tiempo de ejecución qué usuario ocupa el rol relevante para cada alerta. Un cambio de personal solo requiere actualizar el catálogo de contactos, sin tocar la lógica del flujo.

**D.4 Estructura propuesta del catálogo de contactos**

Principio de diseño: el catálogo desacopla el rol del usuario que lo ocupa.

| Campo | Tipo | Descripción |
|---|---|---|
| `rol` | enum | JEFE DE OBRA \| ENCARGADO DE REGISTRAR \| SUPERVISOR. |
| `clave_vinculo` | string | Valor que vincula el rol a una entidad. Para JEFE DE OBRA, el nombre de la columna H de UNIFICADO. |
| `nombre_persona` | string | Nombre legible de la persona que ocupa el rol. |
| `usuario_slack_id` | string | ID de usuario Slack para mensaje directo. |
| `canal_slack_id` | string | Canal Slack donde se solicita el detalle (opcional). |
| `grupo_trabajo` | string | Grupo de trabajo del usuario. |
| `activo` | boolean | Permite desactivar un contacto sin borrarlo. |

**D.5 Resolución en tiempo de ejecución.** Para una fila con R por OT no deducida o contratista no asignado, el sistema tomaría el JEFE DE OBRA de la columna H de UNIFICADO para esa OT como `clave_vinculo` y obtendría el `usuario_slack_id`. Para barco faltante, resolvería ENCARGADO DE REGISTRAR. Para operario no reconocido u otros, SUPERVISOR. Si la clave no encuentra contacto, la alerta caería a un destinatario por defecto (a definir) y se registraría la ausencia.

**D.6 Pendientes de esta etapa**
- Definir la fuente y estructura definitiva de la tabla en Supabase.
- Cargar el mapeo rol → `usuario_slack_id` para cada jefe de obra, encargado y supervisor.
- Definir la lista de canales por rol.
- Definir el destinatario por defecto para casos sin contacto resuelto.

*Nota: los identificadores de destinatario serán números de WhatsApp en lugar de IDs de usuario Slack, dado que el sistema de alertas se implementará después de la migración de canal.*

### Anexo E — Mapa de nodos del flujo n8n implementado

Nodos del workflow principal `RegistroHoras_Aloncar_V2_WA` tal como quedó implementado.

**E.1 Workflow principal (V2_WA)**

| Nodo | Tipo n8n | Función |
|---|---|---|
| Webhook1 | webhook | Recibe todos los eventos de la instancia Evolution API. Path: `ce52f6c6-8614-4b02-89e0-692819f07de3`. |
| If - FiltroGrupoEvolution | if | Filtra por `remoteJid` del grupo autorizado AND `messageType == conversation`. Descarta todo lo demás. |
| E1 - ExtractAndValidate | code | Lee `body.data`, filtra `fromMe`, extrae fecha, genera `mensaje_id`, propaga `remoteJid`. |
| IF - Tiene Fecha | if | Bifurca según haya fecha o no. |
| E1b - Solicitar Fecha WA | evolutionApi | Pide fecha al emisor si falta. Responde al `remoteJid`. Termina. |
| E2 - CargarCatalogos | executeWorkflow | Invoca el sub-workflow de catálogos. |
| Set - PromptConfig | set | `prompt_version` + `prompt_template` editables. Placeholders `<<…>>`. |
| E3a - PrepararPrompt | code | Inyecta catálogos en el template. Reemplaza placeholders `<<…>>`. |
| E3b - OpenAI | httpRequest | Llama a la API de OpenAI (gpt-4o-mini). `max_tokens: 16000`. |
| E3c - ParseLLMResponse | code | Parsea el JSON del LLM. Detecta truncamiento (`finish_reason length`). |
| E4 - ValidacionCruzada | code | v1.2: matching exacto prioritario, OT por habilitación + OT por keywords con split de horas, `needs_review`, `motivo_revision`. |
| E5 - CalcularHoras | code | Astillero: cap 9h + overtime. Contratistas: sin cap, todo normal. |
| E6 - ConsolidarFilas | code | Agrupa por entidad; separa observación y `motivo_revision`. |
| E6b - PrepararLecturaColB | code | Arma URL para leer columna B de HORAS. |
| GET - LeerColumnaB | httpRequest | Lee columna B para detectar última fila real. |
| E7a - PrepararSheet | code | Calcula rango de escritura, arma matriz A:AE. horas_50/100 vacías si son cero. |
| E7b - UpdatePlanilla | httpRequest | Escribe por rango (PUT update). |
| E8 - EscribirLog | googleSheets | Append de una fila en LOG_PROCESAMIENTO. |
| E9a - PrepararRespuesta | code | Arma el texto de confirmación (campo `_slack_text` por compat.). |
| E9 - ResponderUsuario WA | evolutionApi | Envía confirmación al grupo de WhatsApp (`remoteJid` de E1). |
| E9b - Alertas PLACEHOLDER | noOp | Diferido a V2.1 (ver Anexo D). |

*Rama Slack (inactiva en producción, conservada para rollback): Webhook (path original) → If → E1b Solicitar Fecha1 (slack) → E9 ResponderUsuario (slack).*

**E.2 Sub-workflow CargarCatalogos**

| Nodo | Tipo n8n | Función |
|---|---|---|
| Trigger - ExecuteWorkflow | executeWorkflowTrigger | Punto de entrada del sub-workflow. |
| GS - Leer Personal | googleSheets | Lee `PersonalClasificacionCostos`. |
| Code - Collapse1 | code | Colapsa N items en 1 (control de cardinalidad). |
| GS - Leer Rubros | googleSheets | Lee `BaseDatosP/PlanillasRegistro`. |
| Code - Collapse2 | code | Colapsa N items en 1. |
| GS - Leer UNIFICADO | googleSheets | Lee UNIFICADO (barcos + OTs). |
| Code - BuildCatalog | code | Construye el objeto JSON de catálogos con todos los filtros. |

**Credenciales requeridas al importar:** Evolution API (nodos E1b WA y E9 WA), Google Sheets OAuth2 (lecturas y escrituras), OpenAI (E3b). El ID del sub-workflow debe cargarse en el nodo E2 tras importar `CargarCatalogos`. El webhook de la instancia `OnliwAI Oficial` en Evolution API debe apuntar al path `ce52f6c6-8614-4b02-89e0-692819f07de3`.
