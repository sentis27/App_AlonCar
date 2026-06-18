# Mapeo Legacy: HORAS PLANILLAS DE REGISTRO

> [!IMPORTANT]
> **Fuentes de información cruzadas:** Descripción del usuario (sesión 2026-06-17), documento técnico SDD_RegistroHoras_Aloncar_V1_v2.0 (PDF anexo), y lectura directa vía MCP (Google Sheets API).

---

## 1. Clasificación de la Planilla
- **Tipo de Planilla:** TIPO D (Híbrida)
- **Justificación:** Combina entrada de datos operativos (hoja HORAS — registro manual diario de horas trabajadas), transformación (hojas de importación que cruzan datos con otras planillas mediante IMPORTRANGE y fórmulas), y salida (hoja ALERTAS — dashboard de control, y RESUMEN.QUINCENA — vista de liquidación). La hoja principal (HORAS) es claramente de entrada (TYPE A), pero el sistema completo funciona como un organismo híbrido.

---

## 2. Identidad y Contexto de Negocio
- **Nombre Técnico/Funcional:** HORAS_PLANILLAS_DE_REGISTRO
- **URL / ID:** `https://docs.google.com/spreadsheets/d/1QbU6NnKpfTZYlLYa3SIEQSnt5PFfE4xj31U9Zuvl7t0/edit`
- **Departamento Propietario:** Operaciones / Administración
- **Usuarios Principales y Rol:**
  - **Operario de carga:** Registra diariamente las horas trabajadas por cada contratista/operario en cada barco y orden de trabajo.
  - **Supervisor:** Revisa las horas cargadas usando el sistema de aprobación "R" (R = requiere revisión, RR = corregido por operario, RRR = revisión cerrada).
  - **Liquidador de sueldos:** Consume el resumen quincenal para calcular salarios.
- **Propósito Principal:** Llevar un registro contable de la cantidad de horas que trabajan los operarios con sus respectivos rubros. Permite cruzar información para saber costos por rubro (calderería, pintura, etc.), estimar costos, y determinar qué trabajo es por hora y cuál por presupuesto. Es la fuente de verdad para la liquidación de sueldos.
- **Frecuencia de Uso:** Diaria (carga de horas), quincenal (liquidación de sueldos).
- **Integraciones Manuales Actuales:**
  - **Entrada manual:** El operario copia nombres de la hoja LISTA PERSONAL y los pega en la hoja HORAS.
  - **Entrada automatizada (n8n):** Existe un flujo implementado (RegistroHoras_Aloncar_V1) que recibe mensajes de Slack, los procesa con OpenAI, y escribe automáticamente en las columnas A:AE de la hoja HORAS. Las columnas AD y AE son escritas exclusivamente por esta automatización.
  - **Exportación:** El RESUMEN.QUINCENA es consumido por el liquidador de sueldos desde otra planilla.

---

## 3. Estructura Visual y Navegación
- **Hojas Existentes (10 pestañas):**

| # | Nombre | Filas | Columnas | Rol |
|---|--------|-------|----------|-----|
| 0 | ALERTAS | 999 | 26 | Dashboard de control de datos faltantes |
| 1 | LISTA PERSONAL | 992 | 27 | Borrador para copiar/pegar operarios |
| 2 | HORAS | 78 | 31 | **Hoja principal** — Registro de horas |
| 3 | RESUMEN.QUINCENA | 1002 | 26 | Resumen para liquidación de sueldos |
| 4 | B.D.IMPORTADA | 1000 | 45 | Importa barcos vs órdenes de trabajo |
| 5 | RUBROS_OtrosDesplegables_IMPORTADA | 1000 | 26 | Importa rubros y lista de personal |
| 6 | IMPORT.AVANCE_OBRA | 1000 | 26 | Importa números de presupuesto |
| 7 | B.D PARA HORAS | 1000 | 26 | Importa valor hora/hombre por operario |
| 8 | CONTROL DESCANSOS | 996 | 22 | Registro de descansos (en deuda técnica) |
| 9 | ImportNewB.DCostosH/h | 1000 | 26 | Nueva versión unificada de costos (mejora en progreso) |

- **Fila Real de Encabezados:** Fila 2 en la hoja HORAS (la fila 1 contiene el contador de revisiones y el título del barco activo). En RESUMEN.QUINCENA los encabezados están en fila 4.
- **Dashboard / Sumatorias Superiores:**
  - Celda B1 de HORAS: Contador de celdas con "R" en la columna A (horas que requieren revisión).
  - Hoja ALERTAS: Vista rápida de tareas pendientes por datos faltantes (horas sin rubro, sin OT, sin tipo de trabajo, sin centro de costo, etc.).
- **Enlaces Rápidos Identificados:**
  - ALERTAS contiene enlaces "VER" e "IR AL INDICE" para navegar a secciones específicas.
- **Elementos Visuales Destacados:**
  - Sistema de aprobación por letras "R" en columna A (rojo = pendiente, amarillo = en revisión, verde = cerrada).
  - Alertas con formato condicional que marcan celdas incompletas.

---

## 4. Estructura de Datos y Columnas

### Hoja: HORAS (Principal)
| Columna | Nombre | Tipo de Dato | Método de Ingreso | Función / Fórmulas Clave |
| :--- | :--- | :--- | :--- | :--- |
| A | APROBACION | Enum | MANUAL_VALIDADO | Valores: S (aprobado), R (requiere revisión), RR (corregido), RRR (revisión cerrada) |
| B | FECHA | Date | MANUAL_LIBRE / AUTOMATICO | Fecha del día trabajado |
| C | BARCO | String | LISTA_DINAMICA | Nombre del barco. Alimentado por B.D.IMPORTADA vía Apps Script (menú desplegable condicional) |
| D | ORDEN DE TRABAJO | String | LISTA_DINAMICA | OT asociada al barco seleccionado. Menú condicional dependiente de columna C |
| E | CONTRATISTA | String | LISTA_DINAMICA | Nombre del operario/contratista. Alimentado por RUBROS_OtrosDesplegables_IMPORTADA |
| F | TIPO TRABAJO | Enum | LISTA_SIMPLE | Valores: HORA, PRESUPUESTO, CONTROL |
| G | NORMALES | Number | MANUAL_LIBRE / AUTOMATICO | Horas normales trabajadas |
| H | H. AL 50% | Number | MANUAL_LIBRE / AUTOMATICO | Horas extras al 50% |
| I | H. AL 100% | Number | MANUAL_LIBRE / AUTOMATICO | Horas extras al 100% |
| J | RUBRO | String | LISTA_DINAMICA | Rubro del operario (CALDERERIA, MECANICA, PINTURA, etc.). Alimentado por RUBROS_OtrosDesplegables_IMPORTADA |
| K | MATERIAL | String | MANUAL_LIBRE | No computa para horas. Campo auxiliar. |
| L | CANTIDAD | Number | MANUAL_LIBRE | No computa para horas. Campo auxiliar. |
| M | PRECIO/UNI | Number | FORMULA / IMPORTADO | Valor unitario por hora. Traído de B.D PARA HORAS |
| N | COSTO TOTAL | Calculated | FORMULA | `= G * M` (aproximado). Multiplicación de horas por valor unitario |
| O | PESO | Number | MANUAL_LIBRE | No computa para esta planilla |
| P | CENTRO DE COSTO | Enum | LISTA_SIMPLE | Por defecto siempre "CLIENTE". Otros valores: ASTILLERO |
| Q | CATEGORIA | String | MANUAL_LIBRE | No influye en el cómputo de horas |
| R | TIPO DE COMPROBANTE | Enum | MANUAL_VALIDADO | Valores: PRC (presupuesto) o vacío |
| S | N PRC | String | MANUAL_LIBRE | Número de presupuesto vinculado |
| T | OBSERVACIONES | String | MANUAL_LIBRE | Notas del operario para el supervisor |
| U | MARCA TEMPORAL | Date | AUTOMATICO | Timestamp de cuándo se cargó el registro. Permite medir delay de carga (24-36 hs típicamente) |
| V | SIN RUBRO | Formula | FORMULA | Alerta para hoja ALERTAS. Evalúa si J está vacío |
| W | SIN O.T | Formula | FORMULA | Alerta para hoja ALERTAS. Evalúa si D está vacío |
| X | SIN TIP.TRABAJO | Formula | FORMULA | Alerta para hoja ALERTAS. Evalúa si F está vacío |
| Y | SIN CENT.COST | Formula | FORMULA | Alerta para hoja ALERTAS. Evalúa si P está vacío |
| Z | SIN COSTO VALORIZADO | Formula | FORMULA | Alerta para hoja ALERTAS. Evalúa si N está vacío o en 0 |
| AA | COSTO.MAL CARGADA | Formula | FORMULA | Alerta para hoja ALERTAS. Verifica coherencia del costo |
| AB | SIN Nº PRC | Formula | FORMULA | Alerta para hoja ALERTAS. Si R=PRC pero S está vacío |
| AC | CODIGO BUSQUEDA Nº DE PRESUPUESTO | Formula | FORMULA | Complementa columna S. Vinculado a otra hoja de avance de obra |
| AD | mensaje_id | String | AUTOMATICO | Escrito exclusivamente por el flujo n8n (RegistroHoras_Aloncar_V1). Identifica el mensaje de Slack que generó la fila |
| AE | MOTIVO_REVISION_SISTEMA | String | AUTOMATICO | Escrito por n8n. Explica por qué el sistema marcó la fila para revisión |

### Hoja: ALERTAS
| Columna | Nombre | Tipo de Dato | Método de Ingreso | Función |
| :--- | :--- | :--- | :--- | :--- |
| B | Categoría de alerta | String | FORMULA | Ej: "HORAS SIN RUBRO", "HORAS SIN O.T" |
| C | Cantidad | Number | FORMULA | Cuenta celdas con alerta activa en HORAS (cols V-AB) |
| D | Enlace | String | Link | Botón "VER" que navega a la sección correspondiente |

### Hoja: RESUMEN.QUINCENA
| Columna | Nombre | Tipo de Dato | Método de Ingreso | Función |
| :--- | :--- | :--- | :--- | :--- |
| A | CONTRATISTA | String | IMPORTADO | Nombre del operario |
| B | NORMALES | Number | FORMULA | Acumulado de horas normales de la quincena |
| C | 50% | Number | FORMULA | Acumulado de horas al 50% |
| D | 100% | Number | FORMULA | Acumulado de horas al 100% |
| E | AUSENC. JUSTIFICADAS | Number | FORMULA | Días de ausencia justificada |
| F | AUSENC. INJUSTIFICADAS | Number | FORMULA | Días de ausencia injustificada |
| H-W | Día 1 a Día 16 | Number | FORMULA | **Deuda técnica:** Intento de desglose diario dentro de la quincena para detectar días con pocas horas. No completamente funcional. |

### Hoja: B.D.IMPORTADA
Matriz barcos (fila 1) × órdenes de trabajo (filas 2+). 45 columnas, cada columna es un barco y sus filas contienen las OTs asociadas. Alimenta el menú desplegable condicional de Apps Script.

### Hoja: RUBROS_OtrosDesplegables_IMPORTADA
| Columna | Nombre | Fuente |
| :--- | :--- | :--- |
| A | RUBRO | Importado desde B.D.NewSystemm → BaseDatosP/PlanillasRegistro, columna C |
| B | PERSONAL | Importado desde B.D.NewSystemm → PersonalClasificacionCostos |

### Hoja: IMPORT.AVANCE_OBRA
| Columna | Nombre | Función |
| :--- | :--- | :--- |
| A | CODIGO | Concatenación Barco.OT.Contratista para búsqueda |
| B | CLIENTE | Nombre del barco/cliente |
| C | ORDEN TRABAJO | OT asociada |
| D | CONTRATISTA | Contratista asociado |
| E | Nº PRC | Número de presupuesto |

### Hoja: B.D PARA HORAS
| Columna | Nombre | Función |
| :--- | :--- | :--- |
| A | PERSONAL | Nombre del operario |
| B | U$/HORA | Valor hora/hombre en USD |
| D-E | VALOR DOLAR / tasa | Referencia del tipo de cambio (fila 1) |

### Hoja: CONTROL DESCANSOS (Deuda técnica — sin uso activo)
| Columna | Nombre | Función |
| :--- | :--- | :--- |
| A | FECHA | Fecha del registro |
| B | CONTRATISTA | Nombre del operario |
| C-D | INICIO/FIN DESCANSO | Horarios de descanso |
| E | LUGAR DE DESCANSO | Ubicación |
| F-G | INICIO/SALIDA ALMUERZO | Horarios de almuerzo |
| I | RUBRO | Rubro del operario (contiene errores #REF!) |
| J | Estado Reporte | Estado de generación |

### Hoja: ImportNewB.DCostosH/h (Mejora en progreso)
| Columna | Nombre | Función |
| :--- | :--- | :--- |
| A | GRUPO DE TRABAJO | Nombre del operario o grupo |
| B | U$/HORA | Costo por hora |
| C | RUBRO | Rubro asociado |
| D | CENTRO ADMINISTRATIVO | Centro de costo administrativo |
| E | CONSUMIBLES | Categoría de consumibles |
| F | ELEM_SEGURIDAD | Elementos de seguridad |

---

## 5. Lógica de Validaciones y Alertas
- **Validaciones de Datos:**
  - Columna A (APROBACION) → Solo acepta: S, R, RR, RRR → Controla el flujo de revisión supervisor ↔ operario
  - Columna C (BARCO) → Lista dinámica generada por Apps Script desde B.D.IMPORTADA → Restringe a barcos activos
  - Columna D (ORDEN DE TRABAJO) → Lista condicional dependiente de columna C → Solo muestra OTs del barco seleccionado
  - Columna F (TIPO TRABAJO) → Valores: HORA, PRESUPUESTO, CONTROL → Determina si requiere Nº PRC
  - Columna R (TIPO DE COMPROBANTE) → Si = "PRC", entonces columna S (Nº PRC) es obligatoria

- **Alertas Visuales (Columnas V a AB):**
  - Columna V: SIN RUBRO → Si J vacío → Marca "C.R" (campo requerido) o vacío
  - Columna W: SIN O.T → Si D vacío → Marca "COMPLETO" o genera alerta
  - Columna X: SIN TIP.TRABAJO → Si F vacío → Genera alerta "C.TP"
  - Columna Y: SIN CENT.COST → Si P vacío → Genera alerta "C.CC"
  - Columna Z: SIN COSTO VALORIZADO → Si N = 0 o vacío → Genera alerta "C.CV"
  - Columna AA: COSTO MAL CARGADA → Verifica coherencia entre horas y costo → Marca "OK" o alerta
  - Columna AB: SIN Nº PRC → Si R = "PRC" y S vacío → Genera alerta "C.NºPRC"

- **Fórmulas de Control Clave:**
  - Celda B1 (HORAS): `=COUNTIF(A:A,"R")` — Contador global de filas que requieren revisión
  - Hoja ALERTAS: Cada fila cuenta las alertas activas de las columnas V-AB de HORAS

---

## 6. Lógica de Código (Apps Script)
- **¿Posee código atado (`.gs`)?**: Sí
- **Funciones Detectadas (según SDD v2.0):**
  - `onEdit(e)`: Trigger principal. Al editar la columna C (BARCO) en la hoja HORAS, regenera la lista desplegable condicional de la columna D (ORDEN DE TRABAJO) basándose en los datos de B.D.IMPORTADA.
  - Lógica de menú desplegable condicional: Simula el comportamiento de listas dependientes de Excel usando rangos con nombre y validaciones de datos dinámicas.
- **Triggers Activos:** `onEdit` (instalable o simple)
- **Restricciones Ocultas:**
  - La lógica de OT por barco depende de que B.D.IMPORTADA esté actualizada y sincronizada.
  - El script asume una estructura fija de la matriz barcos × OTs en B.D.IMPORTADA.
- **Riesgos Detectados:**
  - **Fragilidad:** Si se renombra la hoja B.D.IMPORTADA o se cambia la estructura de columnas, el script rompe silenciosamente.
  - **Rendimiento:** El `onEdit` se ejecuta en cada edición de cualquier celda, no solo de la columna C. Podría agregar latencia.
  - **Oportunidad de reemplazo:** Toda esta lógica de desplegables condicionales será innecesaria cuando se migre a Supabase, donde las relaciones barco → OT serán consultas SQL nativas.

---

## 7. Mapa Relacional de Dependencias (CRÍTICO)

### Dependencias Entrantes (Esta planilla consume de):
| Planilla Origen | ID Spreadsheet | Hoja Origen | Columnas/Rango | Lógica de Negocio |
| :--- | :--- | :--- | :--- | :--- |
| B.D.NewSystemm | `1OHFCkWKOwaknei6eV6wBZrEXHlye2QK3RJUqC0yDT-4` | PersonalClasificacionCostos | A (nombre), B (grupo), C (USD/hora), D (rubro), H (estado=ACTIVO) | Alimenta catálogo de personal activo, rubros y costos |
| B.D.NewSystemm | `1OHFCkWKOwaknei6eV6wBZrEXHlye2QK3RJUqC0yDT-4` | BaseDatosP/PlanillasRegistro | Columna C | Fuente de verdad de los rubros disponibles |
| LISTA_TRABAJOS | `1rmjCqJoy7lz0YPlbmzHxp9Jj_pMHfSNBmpvS3BhxAlQ` | UNIFICADO | A (barco), C (OT), D (descripcion), E (estado), F (comentario), G (contratista), H (jefe obra) | Fuente de barcos y OTs activas. Filtro: estado = "En ejecución/En curso" |
| Planilla de Avance de Obra | Desconocido — pendiente de validación (2026-06-17) | — | CODIGO, CLIENTE, OT, CONTRATISTA, Nº PRC | Alimenta números de presupuesto para vincular horas con PRC |
| Planilla de Liquidación de Sueldos | Desconocido — pendiente de validación (2026-06-17) | — | Resumen quincenal | Consume el resumen de horas para calcular sueldos |

### Dependencias Salientes (Quién consume esta planilla):
| Planilla Destino | Hoja Destino | Qué Exporta | Para qué lo usa |
| :--- | :--- | :--- | :--- |
| Planilla de Liquidación de Sueldos | Desconocido — pendiente de validación | RESUMEN.QUINCENA completo | Calcular sueldos basados en horas normales, 50% y 100% |
| Planilla de Análisis/Estadísticas | Desconocido — pendiente de validación | Horas por rubro, por barco, por OT | Análisis de costos operativos y estadísticas de producción |
| Flujo n8n (RegistroHoras_Aloncar_V1) | HORAS (escritura) + LOG_PROCESAMIENTO | Escribe filas completas A:AE + log | Automatización de carga de horas desde Slack |

### Automatización n8n Activa (según SDD v2.0):
| Componente | Descripción |
| :--- | :--- |
| **Trigger** | Webhook Slack (mensaje del operario con horas del día) |
| **Procesamiento** | OpenAI (gpt-4o-mini) parsea el mensaje de texto libre |
| **Validación cruzada** | Matching de operario, OT por habilitación, tipo de trabajo, needs_review |
| **Cálculo** | Distribución horas normal/50%/100% según calendario |
| **Escritura** | PUT por rango en HORAS (columnas A:AE) |
| **Log** | Append en hoja LOG_PROCESAMIENTO |
| **Respuesta** | Confirmación al operario por Slack |
| **Sub-workflow** | CargarCatalogos: lee personal, rubros, barcos y OTs desde las planillas fuente |

---

## 8. Requerimientos de Migración a Supabase/n8n

### Tablas Implicadas en Supabase:
| Tabla Propuesta | Origen | Descripción |
| :--- | :--- | :--- |
| `time_entries` | Hoja HORAS (cols A-U) | Registro central de horas trabajadas |
| `workers` | B.D.NewSystemm → PersonalClasificacionCostos | Catálogo de operarios con rubro y costo/hora |
| `work_categories` (rubros) | B.D.NewSystemm → BaseDatosP/PlanillasRegistro | Catálogo de rubros |
| `ships` | LISTA_TRABAJOS → UNIFICADO col A | Catálogo de barcos |
| `work_orders` | LISTA_TRABAJOS → UNIFICADO | Catálogo de OTs con relación a barco |
| `budgets` (presupuestos) | Avance de Obra | Números de PRC con relación a barco/OT/contratista |
| `break_records` | CONTROL DESCANSOS | Registro de descansos (futuro) |

### Campos a Conservar:
Fecha, Barco, OT, Contratista, Tipo de Trabajo, Horas (normales, 50%, 100%), Rubro, Precio/Uni, Costo Total, Centro de Costo, Tipo de Comprobante, Nº PRC, Observaciones, Marca Temporal, mensaje_id, Motivo Revisión Sistema.

### Campos a Descartar (Basura):
| Campo | Justificación |
| :--- | :--- |
| K (MATERIAL) | No computa para horas. Pertenece a planilla de materiales |
| L (CANTIDAD) | Ídem |
| O (PESO) | No computa para esta planilla |
| Q (CATEGORIA) | No influye en cómputo de horas |
| V-AB (Alertas) | Serán reemplazadas por validaciones en Supabase (constraints, triggers) |
| AC (CODIGO BUSQUEDA) | Será una JOIN nativa en SQL |

### Campos Faltantes (Necesarios a futuro):
| Campo | Justificación |
| :--- | :--- |
| `worker_id` (FK) | Relación directa a tabla workers en lugar de texto libre |
| `work_order_id` (FK) | Relación directa a tabla work_orders |
| `ship_id` (FK) | Relación directa a tabla ships |
| `budget_id` (FK) | Relación directa a tabla budgets |
| `clock_in` / `clock_out` | Integración con reloj biométrico de fichaje |
| `approved_by` | Quién aprobó la revisión (actualmente no se registra) |
| `approval_date` | Cuándo se aprobó (actualmente no se registra) |

### Transformaciones Necesarias:
- Normalizar nombres de contratistas (actualmente hay variantes como "RAMON ARANDA" vs "RAMON ARANDA AYUDANTE").
- Convertir formato de horas de string con coma a decimal (`"4,00"` → `4.00`).
- Convertir precios de formato local (`"$12,07"`) a numérico (`12.07`).
- Resolver referencias cruzadas (#N/A, #REF!) antes de migrar.
- Separar la lógica de desplegables condicionales hacia constraints SQL.

### Automatizaciones Candidatas (n8n):
| Flujo | Estado | Descripción |
| :--- | :--- | :--- |
| RegistroHoras_Aloncar_V1 | **Ya implementado** | Carga de horas desde Slack → OpenAI → Sheets. Migrar escritura a Supabase. |
| Alerta por datos faltantes | Candidato | Reemplazar hoja ALERTAS con notificaciones push (Slack/WhatsApp) automáticas |
| Integración reloj biométrico | Candidato | Reemplazar copia manual de LISTA PERSONAL con lectura automática del reloj de fichaje |
| Validación cruzada automática | Candidato | Verificar coherencia de horas al momento de carga en lugar de post-facto |
| Resumen quincenal automático | Candidato | Generar resumen para liquidación sin intervención manual |

---

## 9. Observaciones, Problemas Frecuentes y Mejoras

### Problemas Frecuentes:
| Problema | Impacto | Frecuencia |
| :--- | :--- | :--- |
| Operario se olvida de cargar horas de algún trabajador | Sueldos mal liquidados, reclamos | Frecuente |
| Delay de 24-36 hs entre el trabajo y la carga de datos | Datos desactualizados para toma de decisiones | Sistemático |
| Errores #REF! en hoja CONTROL DESCANSOS | Hoja inutilizable | Permanente |
| Fórmulas #N/A en B.D.IMPORTADA por OTs no encontradas | Registros incompletos | Ocasional |
| Operario carga horas en OT incorrecta | Costos mal asignados. Requiere revisión manual del supervisor | Ocasional |

### Mejoras Identificadas:
- **Alta Prioridad:**
  - Integración con reloj biométrico → Elimina el olvido de cargar operarios. El sistema sabrá quién fichó entrada/salida.
  - Migrar desplegables condicionales a Supabase → Elimina la dependencia frágil del Apps Script y la hoja B.D.IMPORTADA.
  - Migrar alertas a notificaciones push → En lugar de que el usuario abra la hoja ALERTAS, el sistema le avisa proactivamente.

- **Media Prioridad:**
  - Completar la lógica de desglose diario en RESUMEN.QUINCENA (cols H-W) → Permite al operario detectar más rápido en qué día faltan horas.
  - Consolidar hojas ImportNewB.DCostosH/h y B.D PARA HORAS en una sola fuente de verdad → Evita duplicación y desincronización de costos.
  - Implementar sistema de alertas V2.1 (Sección 11 bis del SDD) → Alertas por rol (jefe de obra, encargado, supervisor) con contactos Slack resueltos dinámicamente.

- **Ideas:**
  - Dashboard en tiempo real con métricas de horas por rubro/barco/OT → Visualización ejecutiva.
  - Predicción de costos basada en horas acumuladas vs presupuesto → Alerta temprana de sobrecostos.

### Deuda Técnica:
| Problema | Riesgo |
| :--- | :--- |
| Hoja CONTROL DESCANSOS abandonada con errores #REF! | Confusión para usuarios. Debería eliminarse o repararse. |
| Hoja ImportNewB.DCostosH/h es una mejora incompleta | Coexiste con B.D PARA HORAS sin estar integrada. Ambigüedad sobre cuál es la fuente de verdad. |
| RESUMEN.QUINCENA: desglose diario (cols H-W) no funcional | El operario no puede usar esta funcionalidad para detectar días con pocas horas. |
| Apps Script con `onEdit` sin filtro de columna | Se ejecuta en cada edición de cualquier celda, generando latencia innecesaria. |
| Lista PERSONAL es un proceso manual de copiar/pegar | Propenso a error humano. Debería automatizarse con el reloj de fichaje. |

### Recordatorios:
- Al mapear la planilla de LISTA_TRABAJOS (UNIFICADO), verificar las columnas L (enviar notificación) y M (ENVIO AVISO) que alimentan el sistema de alertas n8n.
- Al mapear B.D.NewSystemm, documentar la hoja PersonalClasificacionCostos como fuente de verdad de personal.
- Preguntar al usuario: ¿Cuál es el ID exacto de la planilla de Avance de Obra? (actualmente aparece como IMPORT.AVANCE_OBRA pero el spreadsheetId origen no está documentado aquí).
- Preguntar al usuario: ¿Existe algún plan para reparar o eliminar la hoja CONTROL DESCANSOS?
