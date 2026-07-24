# Mapeo Legacy: HORAS PLANILLAS DE REGISTRO (Borrador - Pendiente de Revisión)

> [!IMPORTANT]
> **Fuentes de información cruzadas:** Descripción del usuario (sesión 2026-06-17, 2026-06-18), documento técnico SDD_RegistroHoras_Aloncar_V1_v2.0 (PDF anexo), y lectura directa vía MCP (Google Sheets API).

---

## PARTE A: Diseño Técnico (Para IA / App)

### 1. Clasificación de la Planilla
- **Tipo de Planilla:** TIPO D (Híbrida)
- **Justificación:** Combina entrada de datos operativos (hoja HORAS), transformación (hojas de importación que cruzan datos con otras planillas), y salida (hoja ALERTAS, RESUMEN.QUINCENA).
> Confianza: CONFIRMADO

### 2. Identidad y Contexto de Negocio
- **ID Planilla:** GS-001
- **Nombre Técnico/Funcional:** HORAS_PLANILLAS_DE_REGISTRO
- **URL / ID:** `https://docs.google.com/spreadsheets/d/1QbU6NnKpfTZYlLYa3SIEQSnt5PFfE4xj31U9Zuvl7t0/edit`
- **Departamento Propietario:** Operaciones / Administración
- **Usuarios Principales y Rol:** Operario de carga, Supervisor, Liquidador de sueldos.
- **Propósito Principal:** Registro contable de horas. Fuente de verdad para liquidación de sueldos y costos por rubro. Adicionalmente, sentará las bases para **análisis históricos de costos hora hombre por quincena**, y reportes detallados de **ausencias, enfermedad y vacaciones** del personal.
- **Frecuencia de Uso:** Diaria / Quincenal
- **Integraciones Manuales Actuales:** Copiar/pegar desde LISTA PERSONAL, flujo automatizado (RegistroHoras_Aloncar_V1), consumo externo por liquidación.
> Confianza: CONFIRMADO

### 3. Estructura Visual y Navegación
- **Hojas Existentes (10 pestañas):**
  - **TAB-001:** HORAS (Registro principal)
  - **TAB-002:** ALERTAS (Dashboard)
  - **TAB-003:** RESUMEN.QUINCENA (Salida liquidación)
  - *Auxiliares:* LISTA PERSONAL, B.D.IMPORTADA, RUBROS_OtrosDesplegables_IMPORTADA, IMPORT.AVANCE_OBRA, B.D PARA HORAS, CONTROL DESCANSOS, ImportNewB.DCostosH/h
- **Fila Real de Encabezados:** Fila 2 en HORAS.
- **Dashboard / Sumatorias Superiores:** Celda B1 (HORAS), y Hoja ALERTAS.
- **Enlaces Rápidos Identificados:** Botones "VER" en ALERTAS.
- **Elementos Visuales Destacados:** Aprobación por letras "R", formatos condicionales.
> Confianza: CONFIRMADO

### 4. Estructura de Datos y Columnas

**(TAB-001) HORAS**
*(Omito columnas menos relevantes, enfoco en las clave)*
| Col | Nombre | Tipo | Ingreso | Notas / Fórmulas Clave |
|---|---|---|---|---|
| A | APROBACION | Enum | MANUAL | S, R, RR, RRR |
| B | FECHA | Date | MANUAL/AUTO | |
| C | BARCO | String | LISTA_DINAMICA | Vía Apps Script |
| D | ORDEN DE TRABAJO | String | LISTA_DINAMICA | Vía Apps Script |
| F | TIPO TRABAJO | Enum | LISTA_SIMPLE | HORA, PRESUPUESTO, CONTROL |
| P | CENTRO DE COSTO | Enum | LISTA_SIMPLE | Por defecto "CLIENTE", o vacío |
| R | TIPO DE COMPROBANTE | Enum | AUTOMATICO | `=SI(F19="PRESUPUESTO";"PRC";"")` |
| S | N PRC | String | AUTOMATICO | `=SI(F19="HORA";"";(SI.ERROR(BUSCARV(AC19;IMPORT.AVANCE_OBRA!A:F;5;FALSO))))` |
| AD | mensaje_id | String | AUTOMATICO | Escrito por n8n |
| AE | MOTIVO_REVISION... | String | AUTOMATICO | Escrito por n8n |

**(TAB-003) RESUMEN.QUINCENA**
- *Origen de Datos:* Los datos ingresan por importación de la hoja "RESUMEN HORAS" (posiblemente de otra planilla) con la fórmula en A3: `=importrange("https://docs.google.com/spreadsheets/d/1uOcsiiLJknYfpMJqiB7BiVb8kmKNCotjjct8A7eaOEE/edit#gid=1808333068";"T.D ASTILLERO!a1:d40")`.
- *Función:* Genera el resumen para la liquidación.

**IMPORT.AVANCE_OBRA (Importación)**
- Columna B usa la fórmula `=importrange("https://docs.google.com/spreadsheets/d/1kC8l09AD4uV4k27iCyMRQgcSQAUtYpETB__dUT0LVH8/edit#gid=1609788168";"DETALLE DE PRESUPUESTOS!B250:E")` y completa hasta la columna E.
- *Función:* Cruzar info del nº de presupuesto con las horas. Sin esto, es una alerta para la administración si hay personal trabajando pero falta un presupuesto que lo vincule.

**B.D PARA HORAS (Importación)**
- *Deuda técnica:* Debe ser reemplazada por "ImportNewB.DCostosH/h". Aporta el valor hora hombre. Convierte a dólares.
- *Nota de Arquitectura:* En Supabase, esto no necesita estar en la misma planilla. Se resolverá relacionando el operario con su valor de hora en una tabla de tarifas, separando el backend del frontend.

**CONTROL DESCANSOS (Deuda técnica / Sin uso activo)**
- El rubro contiene errores `#REF!`, pero se asume que las fórmulas deberían funcionar para el negocio.
- *Estado Reporte:* Tiene opciones "Generar" y "Generado". Posee una automatización (o un intento de ella) para calcular y agrupar tiempos. Es fundamental registrar cuándo un reporte se ejecuta para generar la versión limpia de esta información. (Actualmente en desuso por dificultad operativa).

> Confianza: CONFIRMADO

### 5. Lógica de Validaciones y Alertas
- **Alertas Visuales (Columnas V a AB en HORAS):** No evalúan únicamente si la celda está vacía, sino que cruzan condiciones lógicas (ej. si está vacía PERO requiere estar llena por otro dato cargado en la fila).
> Confianza: CONFIRMADO

### 6. Lógica de Código (Apps Script)
- Posee script atado (`.gs`) con `onEdit(e)` para las listas desplegables dependientes (Barco -> OT).
> Confianza: CONFIRMADO

### 7. Mapa Relacional de Dependencias (CRÍTICO)
- **Dependencias Entrantes (De dónde consume):**
  - `1uOcsiiLJknYfpMJqiB7BiVb8kmKNCotjjct8A7eaOEE` (para RESUMEN.QUINCENA)
  - `1kC8l09AD4uV4k27iCyMRQgcSQAUtYpETB__dUT0LVH8` (para IMPORT.AVANCE_OBRA)
  - `B.D.NewSystemm`
  - `LISTA_TRABAJOS`
- **Dependencias Salientes (Quién la consume):**
  - **Departamento de Liquidación de Sueldos (María José)**: Consume explícitamente el resumen quincenal. HORAS_PLANILLAS_DE_REGISTRO es considerada la **fuente de verdad**.
> Confianza: CONFIRMADO

### 8. Requerimientos de Migración a Supabase/n8n
> **REGLA:** Toda tabla implicada DEBE mapearse contra una entidad del catálogo en `INDICE_PLANILLAS.md`.
- **Entidades del catálogo implicadas:**
  - `TimeImput` (M3) <- Datos de la hoja HORAS.
  - `Worker` (M2) <- Datos de operarios.
  - `Ship` (M1) <- Barcos.
  - `WorkOrder` (M3) <- Órdenes de trabajo.
  - `CostCenter` (M3) <- Centro de costo (ej: "CLIENTE").
  - `Attendance` (M3) <- Para la automatización futura de ficha/reloj biométrico y los descansos.
- **Gaps de Roadmap detectados:**
  - `RateCard` (M2) absorbe la lógica de B.D PARA HORAS.
  - Se requiere entidad `Quote` / `Budget` (M5) para relacionar el "Nº PRC", crucial para validación de horas por presupuesto.
- **Transformaciones Necesarias:** Reemplazar todas las hojas de importación por consultas relacionales (JOINs).
- **Automatizaciones Candidatas (n8n):** Generación automática de reportes de descansos (reflotar lógica de "Generar").
> Confianza: CONFIRMADO

---

## PARTE B: Lógica de Negocio (Para Humanos)

### Propósito y Uso en la Vida Real
La planilla es el motor central donde los operarios y la administración interactúan diariamente para dejar registro de "quién trabajó, dónde, y por cuánto tiempo". Al ser al mismo tiempo formulario de carga y base de datos precaria, funciona como un embudo crítico.

### Interacciones Clave
1. **Operario / Contratista:** Carga los datos crudos. A veces usa WhatsApp (vía automatización de n8n con Evolution API). Suele tener dificultades para mantener actualizados los descansos.
2. **Supervisor:** Ve las "R" rojas, corrige, y aprueba pasando a "S" o "RRR".
3. **Administración:** Usa la hoja ALERTAS para detectar velozmente personal trabajando "por presupuesto" pero sin un "Nº PRC" asignado. Esto evita huecos en la facturación y el control de costos.
4. **María José (Liquidación):** Es la consumidora final y principal de la salida del sistema (`RESUMEN.QUINCENA`), tomándola como la fuente sagrada de verdad para emitir pagos.

### Deuda Técnica y Dolores Críticos
- **Mezcla de Front y Back:** Los valores en dólares (B.D PARA HORAS) y las listas de presupuestos (IMPORT.AVANCE_OBRA) viven en la misma planilla solo por limitaciones de Google Sheets. Esto ensucia el documento.
- **Transición inconclusa:** Coexisten `B.D PARA HORAS` con `ImportNewB.DCostosH/h`, generando ambigüedad sobre cuál manda.
- **Módulo de Descansos:** La hoja CONTROL DESCANSOS está abandonada. Conceptual e idealmente debe tener un estado de "Generar" reporte, pero fracasó en la adopción por la dificultad de carga manual.

### Visión de Mejora (Rumbo a la App)
1. **Desacoplar la Interfaz:** El operario no debería interactuar con una "planilla base de datos". Solo debería ver un formulario simple en una app/webapp para sus horas y descansos.
2. **Cálculos Invisibles:** Las relaciones con los "Valores Hora", la conversión a dólares, y la asignación del Nº PRC, deben resolverse de manera invisible en el backend (Supabase), mostrando estos datos solo a perfiles administrativos.
3. **Recuperar el control de descansos:** Rediseñar la UX de la carga de almuerzos/descansos para que la automatización de "Generar Reporte" vuelva a tener sentido y uso real.
> Confianza: CONFIRMADO
