# Mapeo Legacy: MATERIALES PLANILLAS DE REGISTRO (Borrador - Pendiente de Revisión)

> [!IMPORTANT]
> **Fuentes de información cruzadas:** Descripción del usuario (sesión 2026-07-06), lectura directa vía API (Google Sheets), y análisis de flujos n8n: `Reporte Retiros diarioMateriales.json` y `Reportes visitas pañol quincena.json`.

---

## PARTE A: Diseño Técnico (Para IA / App)

### 1. Clasificación de la Planilla
- **Tipo de Planilla:** TIPO D (Híbrida)
- **Justificación:** Entrada operativa (hoja MATERIALES — registro manual de retiros), transformación (hojas de importación que cruzan datos con B.D.NewSystemm, Stock, Avance de Obra), y salida (ALERTAS — dashboard, RETIROS DIARIOS — resumen para n8n, AvisoRetirosGrandes — alertas WhatsApp). Tiene un componente de base de datos propio (B.D MATERIALES).
> Confianza: CONFIRMADO

### 2. Identidad y Contexto de Negocio
- **ID Planilla:** GS-002
- **Nombre Técnico/Funcional:** MATERIALES_PLANILLAS_REGISTRO
- **URL / ID:** `https://docs.google.com/spreadsheets/d/15KJs46bgxM6NmME_vLd4XZc7EetKtQgtGDbhbCbKcSI/edit`
- **Departamento Propietario:** Depósito / Pañol / Administración
- **Usuarios Principales y Rol:**
  - **Pañolero:** Registra cada retiro de material del depósito. Carga datos diarios.
  - **Administración:** Controla costos de materiales por obra, revisa alertas, analiza reportes de visitas al pañol.
  - **Gerencia:** Recibe reportes quincenales de visitas y reportes diarios de retiros por WhatsApp.
- **Propósito Principal:** Registrar TODA salida de material del depósito (único canal permitido). Permite saber qué material se entregó, a quién, para qué obra, cuánto costó, y quién paga (cliente vs contratista). Es una de las 3 planillas de costos directos (junto con HORAS y TERCEROS).
- **Frecuencia de Uso:** Diaria (carga de retiros), quincenal (congelado de precios y cierre).
- **Integraciones Manuales Actuales:** El pañolero selecciona materiales de una lista desplegable (B.D MATERIALES). Los datos de barcos/OT vienen de B.D.IMPORTADA. La lógica de quién paga viene de RUBROS_OtrosDesplegables_IMPORTADA.
> Confianza: CONFIRMADO

### 3. Estructura Visual y Navegación
- **Hojas Existentes (11 pestañas):**
  - **TAB-001:** MATERIALES (Registro principal de retiros)
  - **TAB-002:** B.D MATERIALES (Base de datos de materiales con precios)
  - **TAB-003:** ALERTAS (Dashboard de datos faltantes)
  - **TAB-004:** RETIROS DIARIOS (Resumen para análisis de visitas — n8n)
  - **TAB-005:** AvisoRetirosGrandes (Vista filtrada para alertas WhatsApp — n8n)
  - *Auxiliares:* ARCHIVO UTILES (índice de links), B.D.IMPORTADA (barcos/OTs), RUBROS_OtrosDesplegables_IMPORTADA (personal + reglas consumibles/seguridad), B.D_STOCK (stock importado), RUBRO.MAT (lista de rubros), INDICE DE COLORES EN HOJAS (leyenda de colores)
  - *Eliminada:* B.D.CENTRO.COSTO (lógica absorbida por RUBROS_OtrosDesplegables_IMPORTADA)
- **Fila Real de Encabezados:** Fila 2 en MATERIALES. Fila 4 en B.D MATERIALES.
- **Dashboard / Sumatorias Superiores:** Fila 1 de MATERIALES tiene: "FREEZADO HASTA 15/03/2025" (indicador de último congelamiento), y celdas K1-L1 con contador "MAT.SIN ORDEN DE TRABAJO = 5".
- **Elementos Visuales Destacados:** Formato condicional en alertas, leyenda de colores en hoja INDICE DE COLORES ("DATO" = celda con fórmula eliminada y valor fijado — resultado del proceso de congelamiento quincenal).
> Confianza: CONFIRMADO

### 4. Estructura de Datos y Columnas

**(TAB-001) MATERIALES**
| Col | Nombre | Tipo | Ingreso | Notas / Fórmulas Clave |
|---|---|---|---|---|
| A | STOCK | Number | FORMULA | Stock disponible del material. Se vincula a B.D_STOCK (importada desde planilla Control de Stock) |
| B | FECHA | Date | MANUAL | Fecha del retiro |
| C | CLIENTE | String | LISTA_DINAMICA | Barco. Alimentado por B.D.IMPORTADA vía Apps Script |
| D | ORDEN DE TRABAJO | String | LISTA_DINAMICA | OT condicional al barco seleccionado |
| E | CONTRATISTA | String | LISTA_DINAMICA | Quien retira. Alimentado por RUBROS_OtrosDesplegables_IMPORTADA |
| F | TIPO DE TRABAJO | Enum | FORMULA | Siempre "MATERIALES" (fórmula fija) |
| G | NORMALES | Number | — | **No se usa.** Herencia de diseño (misma estructura que HORAS) |
| H | HORAS AL 50% | Number | — | **No se usa.** Herencia de diseño |
| I | HORAS AL 100% | Number | — | **No se usa.** Herencia de diseño |
| J | RUBRO | String | FORMULA | Rubro del material. Fórmula BUSCARV contra B.D MATERIALES |
| K | MATERILAES (sic) | String | LISTA_SIMPLE | Material seleccionado. Lista desplegable de B.D MATERIALES col A |
| L | CANTIDAD | Number | MANUAL | Cantidad retirada |
| M | PRECIO/UNI US$ | Number | FORMULA | Precio unitario en USD. BUSCARV contra B.D MATERIALES col D |
| N | COSTO TOTAL US$ | Calculated | FORMULA | `= L * M` (cantidad × precio) |
| O | PESO | Number | FORMULA | Peso del material. BUSCARV contra B.D MATERIALES col G |
| P | CENTRO DE COSTO | Enum | FORMULA | **Lógica compleja.** Determina quién paga: CLIENTE o CONTRATISTA. Depende del contratista (col E) cruzado con la categoría (col Q) contra reglas en RUBROS_OtrosDesplegables_IMPORTADA (que viene de B.D.NewSystemm) |
| Q | CATEGORIA | Enum | FORMULA | MATERIALES, CONSUMIBLES o ELEM_SEGURIDAD. BUSCARV contra B.D MATERIALES col E |
| R | TIPO DE COMPROBANTE | Enum | MANUAL | Remito, factura, o vacío. Usado para vincular entregas a talleres externos |
| S | NºFACTURA | String | MANUAL | Nº interno de remito. Permite revisar que los materiales se entregaron y cargaron correctamente |
| T | OBSERVACIONES | String | MANUAL_LIBRE | Texto libre del pañolero |
| U | MARCA TEMPORAL | Date | AUTOMATICO | Timestamp de carga |
| V | "F.ORDENES" | Formula | FORMULA | Alerta: ¿tiene OT? → COMPLETO / INCOMPLETO |
| W | F.REG.MAT.B.D | Formula | FORMULA | Alerta: ¿material existe en B.D MATERIALES? → BIEN / alerta |
| X | F.PRECIO | Formula | FORMULA | Alerta: ¿tiene precio? → C.P |
| Y | F.CATEGORIA | Formula | FORMULA | Alerta: ¿tiene categoría? → C.C |
| Z | F.CENTRO DE COSTO | Formula | FORMULA | Alerta: ¿tiene centro de costo? → C.CC |
| AA | F.RUBRO | Formula | FORMULA | Alerta: ¿tiene rubro? → C.R |
| AB | F.RESP.RETIRO | Formula | FORMULA | Alerta: ¿tiene responsable? → C.RR |
| AC | F. TIPO DE TRABAJO | Formula | FORMULA | Alerta: ¿tiene tipo de trabajo? → C.TP |

**(TAB-002) B.D MATERIALES**
| Col | Nombre | Tipo | Ingreso | Notas |
|---|---|---|---|---|
| A | MATERIALES | String | MANUAL | Nombre del material (fuente de verdad del catálogo) |
| B | COSTO AR$ | Number | MANUAL | Precio en pesos argentinos |
| C | % SEGURIDAD | Number | LISTA_SIMPLE | Porcentaje de seguridad adicional (2%, 6%, 10%, 15%, 20%, 30%) según tipo de material |
| D | COSTO US$ | Number | FORMULA | Conversión ARS→USD. Referencia al VALOR DOLAR en celda E1 (actualmente 17550) |
| E | CATEGORIA | Enum | LISTA_SIMPLE | MATERIALES, CONSUMIBLES, ELEM_SEGURIDAD |
| F | LOCACION | String | MANUAL | Ubicación en depósito. En desuso, intención de completar gradualmente |
| G | PESO | Number | MANUAL | Peso del material. Se hace a mano; candidato a automatización en el futuro |
| H | RUBRO | String | LISTA_SIMPLE | Clasificación del material. Lista desplegable desde hoja RUBRO.MAT |
| I | MARCA TEMPORAL | Date | AUTOMATICO | Última actualización de precio. **Problema:** al actualizar se pierde la fecha anterior, no hay trazabilidad de historial de precios |
| J | FAL. CATEGORIA | Formula | FORMULA | Alerta si categoría vacía |
| K | FAL. RUBRO | Formula | FORMULA | Alerta si rubro vacío |
| L | OBSERVACIONES | String | MANUAL_LIBRE | Notas sobre el material |

**Celda E1:** VALOR DOLAR = 17550 (referencia crítica para conversión de precios)

**(TAB-003) ALERTAS**
| Celda | Contenido | Tipo |
|---|---|---|
| A3 | COMPRAS SIN RECIBIR | Link a planilla de compras con vista filtrada |
| E3 | MAT.SIN ORDEN DE TRABAJO | Fórmula que cuenta alertas V en MATERIALES |
| E5 | MAT. SIN PRECIO | Fórmula que cuenta alertas X |
| E7 | MAT. SIN REGISTRO EN B.D | Fórmula que cuenta alertas W |
| E9 | MAT. SIN CATEGORIA | Fórmula que cuenta alertas Y |
| A10 | ALERTAS (total) | Suma de todas las alertas = 9 |
| J3 | ENTREGA DE GUANTES | Link a vista específica |

**(TAB-004) RETIROS DIARIOS**
| Col | Nombre | Función |
|---|---|---|
| A | FECHA | Fecha del retiro (filtrada al día) |
| B | CLIENTE | Barco |
| C | ORDEN DE TRABAJO | OT |
| D | CONTRATISTA | Quien retira |
| E | RUBRO | Rubro del material |
| F | MATERILAES | Nombre del material |
| G | CANTIDAD | Cantidad retirada |
| H | PESO | Peso |
| I | CENTRO DE COSTO | Quién paga |
| J | CATEGORIA | Tipo de material |
| K | MARCA TEMPORAL | Timestamp (fuente de problemas de datos) |
| L1 | Fecha de hoy | Referencia para filtro diario |

**(TAB-005) AvisoRetirosGrandes**
- Misma estructura que MATERIALES (cols A-N).
- Filtrada a retiros del día.
- Alimenta la automatización n8n `Reporte Retiros diarioMateriales`.
- Columnas adicionales (no visibles en API): ALERTA_ENVIO (U) y ALERTA_TS (V) — escritas por n8n para marcar filas ya notificadas.
- **Apps Script vinculado:** `BorrarAlertaMensajeRetirosGrandes` — limpia columnas ALERTA_ENVIO y ALERTA_TS diariamente a las 17:30.

**B.D_STOCK (Importación)**
| Col | Nombre | Función |
|---|---|---|
| A | RUBRO | Rubro del material |
| B | MATERIAL | Nombre del material |
| C | Entradas (Cantidad) | Total de entradas al stock |
| D | Salidas (Cantidad) | Total de salidas del stock |
| E | STOCK FISICO | Entradas - Salidas |
| F | STOCK VIRTUAL | Material en compra confirmada pero no recibido |
| G | STOCK MINIMO | Umbral de alerta |
| H | ALARMA | OK / ALERTA / FALTA |
| I | STOCK NEGATIVO | OK / ERROR |

**Origen:** Importado desde planilla CONTROL DE STOCK (ID: `1mtUrzk0cOe1q3agZmVPpE3ojlZl8TsC-jVBQcYlNHIA`).

**RUBROS_OtrosDesplegables_IMPORTADA**
| Col | Nombre | Función |
|---|---|---|
| A | PERSONAL | Nombre del contratista/operario |
| B | U$/HORA | Valor hora (no se usa en esta planilla) |
| C | CONSUMIBLES | Quién paga: CLIENTE o CONTRATISTA |
| D | ELEM_SEGURIDAD | Quién paga: CLIENTE o CONTRATISTA |

**Origen:** Importado desde B.D.NewSystemm (ID: `1OHFCkWKOwaknei6eV6wBZrEXHlye2QK3RJUqC0yDT-4`).

**B.D.IMPORTADA** — Matriz barcos × OTs (idéntica estructura a la de GS-001 HORAS).

**RUBRO.MAT** — Lista simple de rubros para el desplegable de B.D MATERIALES col H. Ejemplos: ABRAZADERA, ACC. MADERA, ACC. PINTURA, ACEITES, ANGULOS, etc.

**ARCHIVO UTILES** — Índice de hipervínculos para el pañolero: links a BASE DE DATOS, REGISTRO DE HORAS, REGISTRO DE COMPRAS, STOCK, HERRAMIENTAS, PINTURAS, y tablas técnicas de conversión (Chapas, Tubos ASTM, Macizos, Ángulos, Planchuelas, etc.).

> Confianza: CONFIRMADO

### 5. Lógica de Validaciones y Alertas
- **Alertas Visuales (Columnas V a AC en MATERIALES):** Misma lógica condicional que en HORAS (GS-001): no evalúan solo si está vacío, sino si está vacío **cuando debería estar lleno** por la existencia de otros datos en la fila.
- **Alertas en B.D MATERIALES (cols J-K):** Detectan materiales sin categoría o sin rubro asignado.
- **Hoja ALERTAS:** Consolida conteos de todas las alertas de las columnas V-AC + alertas de B.D MATERIALES + link externo a "COMPRAS SIN RECIBIR" (planilla de compras).
> Confianza: CONFIRMADO

### 6. Lógica de Código (Apps Script)
- **¿Posee código atado (`.gs`)?**: Sí
- **Funciones Detectadas:**
  - `onEdit(e)`: Listas desplegables condicionales Barco → OT (mismo patrón que GS-001).
  - `BorrarAlertaMensajeRetirosGrandes`: Limpia columnas ALERTA_ENVIO (U) y ALERTA_TS (V) de la hoja AvisoRetirosGrandes diariamente a las 17:30.
- **Triggers Activos:** `onEdit` (simple/instalable), trigger time-driven para la limpieza de alertas.
> Confianza: CONFIRMADO

### 7. Mapa Relacional de Dependencias (CRÍTICO)

**Dependencias Entrantes (De dónde consume):**
| Planilla Origen | ID Spreadsheet | Hoja Origen | Qué Importa | Lógica de Negocio |
|---|---|---|---|---|
| B.D.NewSystemm | `1OHFCkWKOwaknei6eV6wBZrEXHlye2QK3RJUqC0yDT-4` | PersonalClasificacionCostos | Personal, consumibles/seguridad pagados por cliente o contratista | Determina centro de costo (col P) |
| LISTA_TRABAJOS | `1rmjCqJoy7lz0YPlbmzHxp9Jj_pMHfSNBmpvS3BhxAlQ` | UNIFICADO | Barcos y OTs | Alimenta menús desplegables |
| CONTROL DE STOCK | `1mtUrzk0cOe1q3agZmVPpE3ojlZl8TsC-jVBQcYlNHIA` | CONTROL STOCK | Stock físico, virtual, mínimo, alarmas | Muestra disponibilidad en col A de MATERIALES |
| Planilla de Compras | Desconocido — pendiente de validación | — | "Compras sin recibir" (link en ALERTAS) | Ingreso de stock al sistema |

**Dependencias Salientes (Quién la consume):**
| Consumidor | Qué Consume | Para Qué |
|---|---|---|
| CONTROL DE STOCK (`1mtUrzk0cOe1q3agZmVPpE3ojlZl8TsC-jVBQcYlNHIA`) | Salidas de material (hoja MATERIALES) | Calcula stock = entradas - salidas |
| DASH BOARD (`1BK-ONsdaeAXgv0ZQmwz_7lCa-jCmBKFFyMsyhOMlalQ`) | Datos procesados de visitas a pañol | Almacena resumen quincenal y centro/grupo |
| n8n: `Reporte Retiros diarioMateriales` | Hoja AvisoRetirosGrandes + CONTROL STOCK | WhatsApp cada 2hs con retiros vs stock |
| n8n: `Reportes visitas pañol quincena` | DASH BOARD → Analisis visitasDiariasPañol | Reporte quincenal de visitas al pañol vía Gmail a gerencia@aloncar.com.ar |
| Consolidación de costos directos | MATERIALES (costos) | Se combina con HORAS (GS-001) y TERCEROS (pendiente mapeo) para calcular costo total por obra |

> Confianza: CONFIRMADO

### Automatizaciones n8n Activas

**Flujo 1: `Reporte Retiros diarioMateriales` (WF_AvisoRetirosGrandes_v1)**
| Componente | Descripción |
|---|---|
| **Trigger** | Cron: `0 9-17/2 * * 1-5` (cada 2 horas, L-V, 9-17hs) |
| **Lectura** | Lee hoja AvisoRetirosGrandes (spreadsheet ID original: `1LQSPDxbFR-l5Y4XUEDFDCtbXrHYPIukdvOhLBwOdqJk`) |
| **Filtro** | Descarta filas ya notificadas (`ALERTA_ENVIO != "SI"`) |
| **Cruce** | Lee CONTROL DE STOCK → agrupa materiales, suma cantidades, cruza con stock físico/virtual |
| **Mensaje** | Arma mensaje paginado para WhatsApp (Evolution API) con formato: Material / Retiro / Stock Físico / Stock Virtual |
| **Envío** | WhatsApp a `5492262587575@s.whatsapp.net` |
| **Marca** | Escribe `ALERTA_ENVIO=SI` y `ALERTA_TS=timestamp` en las filas procesadas |
| **Limpieza** | Apps Script `BorrarAlertaMensajeRetirosGrandes` borra columnas U-V a las 17:30 |

**Flujo 2: `Reportes visitas pañol quincena`**
| Componente | Descripción |
|---|---|
| **Trigger** | Schedule Trigger (configuración por defecto — puede ser manual o programado) |
| **Lectura** | DASH BOARD spreadsheet → hoja `Analisis visitasDiariasPañol` (rango a3:h) |
| **Procesamiento** | Code node complejo: detecta quincena auto, calcula Top 5 contratistas por visitas, % por tipo (materiales/consumibles/seguridad), distribución por centro/grupo, tiempo perdido en mostrador (8 min/visita) |
| **Salida HTML** | Genera reporte formateado con tablas: indicadores generales, comparativa Top 5, distribución por centro/grupo |
| **Envío** | Gmail a gerencia@aloncar.com.ar (CC: sentis27@gmail.com) |
| **Escritura** | Appends en DASH BOARD: hojas RESUMEN_QUINCENAL_VisitasPañol(n8n), RESUMEN_CENTRO_GRUPO_VisitasPañol(n8n), TOP 5 visitas(n8n) |

> Confianza: CONFIRMADO

### 8. Requerimientos de Migración a Supabase/n8n
> **REGLA:** Toda tabla implicada DEBE mapearse contra una entidad del catálogo en `INDICE_PLANILLAS.md`.

**Entidades del catálogo implicadas:**
- `Material` (M4) ← B.D MATERIALES completa (catálogo de materiales con precios, categoría, peso, rubro)
- `Inventory` (M4) ← B.D_STOCK (stock físico, virtual, mínimo, alarmas)
- `Consumption` (M4) ← Hoja MATERIALES (cada fila es un retiro/consumo de material)
- `Ship` (M1) ← Barcos (col C)
- `WorkOrder` (M3) ← OTs (col D)
- `Worker` (M2) ← Contratistas que retiran (col E)
- `CostCenter` (M3) ← Centro de costo CLIENTE/CONTRATISTA (col P)

**Gaps de Roadmap detectados:**
- **Remito / Comprobante:** Las columnas R-S (Tipo de Comprobante, Nº Factura) vinculan materiales con entregas a talleres externos, lo que se cruza con la planilla de TERCEROS. Candidato a una entidad `DeliveryNote` o un campo en `Consumption`.
- **Historial de Precios:** Hoy se pierde al congelar. Se necesita un campo `price_history` o tabla de auditoría de precios por quincena.
- **Valor Dólar:** No existe entidad para almacenar el tipo de cambio histórico por quincena. Candidato a tabla `ExchangeRate` con fecha y valor.
- **Visitas a Pañol:** El análisis de frecuencia de visitas no tiene entidad. Candidato a tabla `WarehouseVisit` o campo derivado en `Consumption`.

**Campos a Conservar:** Fecha, Cliente/Barco, OT, Contratista, Rubro, Material, Cantidad, Precio, Costo Total, Peso, Centro de Costo, Categoría, Tipo de Comprobante, Nº Factura, Observaciones, Marca Temporal.

**Campos a Descartar (Basura):**
| Campo | Justificación |
|---|---|
| G (NORMALES) | No se usa. Herencia de diseño |
| H (HORAS AL 50%) | Ídem |
| I (HORAS AL 100%) | Ídem |
| F (TIPO DE TRABAJO) | Siempre "MATERIALES". Redundante cuando se separe en tabla `Consumption` |
| V-AC (Alertas) | Serán reemplazadas por validaciones en Supabase (constraints, triggers) |

**Transformaciones Necesarias:**
- Normalizar nombres de materiales (actualmente hay variantes como "DISCO 4" AMOLAR" con comillas internas).
- Convertir precios de formato local (`$1,03`) a numérico (`1.03`).
- Implementar historial de precios (hoy se pierden al congelar).
- Separar la lógica de "quién paga" hacia constraints SQL con tabla de reglas por contratista.
- Resolver el problema de la marca temporal corrupta en RETIROS DIARIOS.

**Automatizaciones Candidatas (n8n):**
| Flujo | Estado | Descripción |
|---|---|---|
| Reporte Retiros diarioMateriales | **Ya implementado** | WhatsApp cada 2hs con retiros vs stock. Migrar lectura a Supabase. |
| Reportes visitas pañol quincena | **Ya implementado** | Reporte quincenal por email. Migrar fuente de datos a Supabase. |
| Congelamiento quincenal de precios | **Candidato CRÍTICO** | Automatizar el proceso manual actual de copiar valores, eliminar fórmulas, actualizar dólar. Debe ser "2 clics": elegir valor dólar + quincena, y congelar todo automáticamente. |
| Separación quincenal de centro de costo por contratista | **Candidato CRÍTICO** | Hoy se hace manual (~1.5-2 hs/quincena). Agrupar consumos de CONSUMIBLES y ELEM_SEGURIDAD por contratista, barco y OT, con nº consecutivo de remito para trazabilidad. Genera informe para descontar del pago quincenal del contratista. **⚠ ALERTA: Falta definir el formato ideal del informe de salida.** Nivel 2-3: envío automático al contratista por mensaje + PDF una vez aprobado por humano. |
| Alerta de stock mínimo | Candidato | Notificación cuando stock físico < stock mínimo |
| Cálculo automático de peso | Candidato (baja prioridad) | Para materiales ferrosos, calcular peso basado en dimensiones y densidad constante |

> Confianza: CONFIRMADO

---

## PARTE B: Lógica de Negocio (Para Humanos)

### Propósito y Uso en la Vida Real
Esta planilla es el **único canal permitido** para registrar la salida de materiales del depósito. Es la contraparte de la planilla de Compras: Compras ingresa materiales al sistema (stock), y esta planilla los disminuye. Juntas forman el ciclo completo del material: **Compra → Stock → Retiro**.

### Interacciones Clave
1. **Pañolero:** Es quien carga cada retiro en el momento que un contratista se acerca al depósito. Selecciona el material de una lista, carga la cantidad, y el sistema le muestra al instante el stock disponible (col A) para saber si tiene suficiente.
2. **Administración:** Revisa la hoja ALERTAS para detectar retiros sin OT (un material se retiró pero no se sabe para qué obra), sin precio (un material nuevo que no está en la base de datos), o sin categoría.
3. **Gerencia:** Recibe por WhatsApp cada 2 horas un resumen de los materiales retirados en el día con su estado de stock. También recibe un reporte quincenal por email con estadísticas de visitas al pañol (quién visita más, cuántas veces, tiempo perdido estimado).

### La Lógica de "Quién Paga" (Columna P)
Es el corazón de la inteligencia de negocio en esta planilla. Tres categorías de materiales:
- **MATERIALES** → Siempre paga el CLIENTE (el barco).
- **CONSUMIBLES** (discos, trapos, etc.) → A veces paga el CLIENTE, a veces el CONTRATISTA. Depende del contrato de cada contratista.
- **ELEM_SEGURIDAD** (guantes, protectores, etc.) → Misma lógica que consumibles.

Esta tabulación ya está resuelta en `B.D.NewSystemm` y se importa a esta planilla. En Supabase, será una tabla de reglas por contratista con campos `consumibles_paga` y `seguridad_paga`.

### El Problema del Dólar y el Congelamiento Quincenal
Todos los precios de materiales están en pesos argentinos pero se convierten a dólares para facturar y reportar. Cada quincena, Andrés debe:
1. Copiar todos los valores calculados (USD) y pegarlos como valores fijos (eliminar fórmulas).
2. Actualizar el nuevo valor del dólar.
3. Las fórmulas empiezan a calcular con el nuevo tipo de cambio.

**Dolor crítico:** Este proceso es manual, tedioso, y propenso a errores. Involucra entrar a cada planilla de costos (HORAS, MATERIALES, TERCEROS), copiar/pegar valores, eliminar fórmulas. **Es la mejora nº1 más deseada:** automatizarlo con 2 clics (elegir dólar + quincena).

### Diseño Legacy y Deuda Técnica
- **Columnas G, H, I (horas)** existen porque todas las planillas fueron diseñadas con la misma estructura. En su momento, Andrés no sabía cómo importar parcialmente de cada planilla para agrupar los 3 costos directos (HORAS + MATERIALES + TERCEROS) en una vista consolidada. Esto queda solucionado en Supabase con JOINs.
- **Marca temporal en RETIROS DIARIOS:** La carga manual a veces genera fechas random, corrompiendo el análisis de visitas. Esto provocó que la automatización n8n nunca progresara del todo.
- **B.D MATERIALES col I (marca temporal de precio):** Al actualizar un precio, se pierde la fecha anterior. No hay trazabilidad histórica.
- **B.D MATERIALES col F (locación):** Campo con intención de uso futuro para saber dónde está ubicado cada material en el depósito. En desuso actual.

### Las 3 Planillas de Costos Directos (Visión Sistémica)
Es fundamental entender que MATERIALES no vive sola. Junto con HORAS (GS-001) y TERCEROS (pendiente mapeo), conforman el trípode de costos directos por obra:
- **HORAS:** Costo de mano de obra.
- **MATERIALES:** Costo de insumos consumidos.
- **TERCEROS:** Costo de trabajos de talleres externos.

La suma de estos tres es el **costo total de una obra**. Hoy, consolidar esta información requiere trabajo manual. En Supabase, será un `SELECT SUM(...) FROM time_entries UNION consumption UNION ...` agrupado por `work_order_id`.

### Remitos y Trazabilidad con Terceros
Cuando se envían materiales a un taller externo, se genera un remito (cols R-S). Este remito:
1. Documenta qué materiales se entregaron.
2. Se vincula al costo del taller en la planilla de TERCEROS.
3. Permite auditar que lo entregado coincide con lo cargado.

### Separación Quincenal de Centro de Costo por Contratista (Proceso Manual Crítico)
Cada quincena, la administración debe generar un informe por contratista que detalle:
- Todos los retiros de **CONSUMIBLES** y **ELEM_SEGURIDAD** cuyo centro de costo sea **CONTRATISTA** (es decir, que el contratista paga).
- Agrupados por **contratista → barco → orden de trabajo**.
- Con un **número consecutivo de remito** por quincena para trazabilidad.

**Para qué sirve:** Si un contratista trabajó 15 horas = $1000, pero retiró $200 en consumibles que le corresponde pagar, se le pagan $800. Este informe es la base documental para el descuento.

**Dolor actual:** Se hace manualmente con filtros en la planilla. Consume entre **1.5 y 2 horas por quincena**. Es tedioso, propenso a errores, y no tiene trazabilidad formal.

**Visión de automatización:**
- **Nivel 1:** Generación automática del informe agrupado con nº consecutivo. Aprobación humana.
- **Nivel 2:** Envío del informe al contratista por mensaje (WhatsApp/SMS) + conversión a PDF.
- **Nivel 3:** Flujo completo: generar → aprobar → enviar → registrar como descontado en liquidación.

> ⚠ **ALERTA:** Falta que Andrés defina el formato ideal del informe de salida (qué columnas, qué agrupamiento, qué totales). Pendiente para próxima sesión.

### Visión de Mejora (Rumbo a la App)
1. **Formulario de retiro simplificado:** El pañolero solo debería ver: barco, OT, material (con autocompletado), cantidad. Todo lo demás (precio, rubro, categoría, centro de costo, peso) se resuelve en el backend.
2. **Congelamiento automático:** Botón "Cerrar Quincena" que congele precios, actualice dólar, y genere resumen automáticamente.
3. **Separación automática de centro de costo:** Al cerrar quincena, generar automáticamente el informe por contratista para descuento de pagos.
4. **Historial de precios:** Tabla de auditoría que registre cada cambio de precio con fecha, valor anterior, valor nuevo, y tipo de cambio.
5. **Stock en tiempo real:** El stock disponible se calcula en Supabase como una vista materializada, no como una importación periódica.
6. **Alertas push:** Reemplazar la hoja ALERTAS por notificaciones proactivas cuando se detecte un retiro sin OT o un material agotándose.
> Confianza: CONFIRMADO
