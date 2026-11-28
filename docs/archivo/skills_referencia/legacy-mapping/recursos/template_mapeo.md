# Plantilla Estandarizada: Mapeo de Planilla Legacy

> [!IMPORTANT]
> **REGLA DE AGENTE (ANTIGRAVITY):** Si estás leyendo este documento para mapear una planilla, es **PROHIBIDO** dejar campos vacíos o con "[Falta Dato]". Si falta contexto, debes detenerte y preguntar al usuario.
>
> **TAG DE CONFIANZA:** Cada sección numerada (1 a 9) debe cerrar con una línea
> `> Confianza: [CONFIRMADO | INFERIDO | PENDIENTE]`.
> - **CONFIRMADO** = leído vía MCP o validado por el usuario.
> - **INFERIDO** = deducido por estructura/nombres/fórmulas, sin confirmar.
> - **PENDIENTE** = falta validación humana.
> Esto permite, con 16 planillas mapeadas, filtrar qué quedó sin validar sin releer todo.

## 1. Clasificación de la Planilla
- **Tipo de Planilla:** [TIPO A (Entrada) / TIPO B (Transformación) / TIPO C (Salida) / TIPO D (Híbrida)]
- **Justificación:** [Por qué pertenece a este tipo]

## 2. Identidad y Contexto de Negocio
- **ID Planilla:** [GS-0XX — asignar el próximo libre consultando INDICE_PLANILLAS.md]
- **Nombre Técnico/Funcional:** [Ej: Control_Materiales_v3]
- **URL / ID:** [Enlace a la planilla]
- **Departamento Propietario:** [Ej: Pañol / Logística]
- **Usuarios Principales y Rol:** [Quiénes la editan a diario y qué puesto tienen]
- **Propósito Principal:** [Para qué sirve dentro de la empresa]
- **Frecuencia de Uso:** [Diaria / Semanal / Por evento]
- **Integraciones Manuales Actuales:** [¿De dónde copian/pegan datos para llenar esto? ¿Hacia dónde exportan?]

## 3. Estructura Visual y Navegación
- **Hojas Existentes:** [Listar pestañas. A cada hoja CRÍTICA asignarle un ID estable TAB-0XX único dentro de esta planilla, ej: TAB-001 = HORAS. Las hojas auxiliares/importación pueden quedar sin ID si no son referenciadas por dependencias.]
- **Fila Real de Encabezados:** [Fila donde empiezan los nombres de las columnas]
- **Dashboard / Sumatorias Superiores:** [Métricas previas a la tabla]
- **Enlaces Rápidos Identificados:** [Celdas con links a otras partes]
- **Elementos Visuales Destacados:** [Colores, iconos con significado]

## 4. Estructura de Datos y Columnas
| Columna | Nombre | Tipo de Dato | Método de Ingreso | Función / Fórmulas Clave |
| :--- | :--- | :--- | :--- | :--- |
| A | ID Material | String | MANUAL_LIBRE | Ninguna |
| B | Stock Actual | Number | FORMULA | `=SUM(C2:Z2)` |
| C | Estado | Enum | LISTA_SIMPLE | Validación Data |

## 5. Lógica de Validaciones y Alertas
- **Validaciones de Datos:**
  - [Columna] -> [Condición] -> [Efecto]
- **Alertas Visuales:**
  - [Condición] -> [Efecto de color]
- **Fórmulas de Control Clave:**
  - [Celda] -> [Fórmula] -> [Qué evalúa para el negocio]

## 6. Lógica de Código (Apps Script)
- **¿Posee código atado (`.gs`)?**: [Sí / No]
- **Funciones Detectadas:** 
  - `funcionEjemplo()`: [Qué hace]
- **Triggers Activos:** [onEdit, onOpen, etc.]
- **Restricciones Ocultas:** [Bloqueos en código]
- **Riesgos Detectados:** [Código frágil, emails hardcodeados]

## 7. Mapa Relacional de Dependencias (CRÍTICO)
- **Dependencias Entrantes (De dónde consume):**
  | Planilla Origen | Hoja Origen | Rango/Columnas | Lógica de Negocio |
  | :--- | :--- | :--- | :--- |
  | [Planilla] | [Hoja] | [Rango] | [Por qué necesita el dato] |

- **Dependencias Salientes (Quién la consume):**
  | Planilla Destino | Hoja Destino | Qué Exporta | Para qué lo usa |
  | :--- | :--- | :--- | :--- |
  | [Planilla] | [Hoja] | [Rango] | [Uso en destino] |

## 8. Validaciones y Constraints de Negocio
> ⚠ **REGLA:** Está PROHIBIDO documentar validaciones técnicas de formulario. Cada regla debe responder: ¿qué error financiero, operativo o contable ocurre si esta regla no existe?

| Regla de Negocio / Constraint (¿Qué debe bloquear o fallar?) | Entidad / Tabla Responsable en SQL | Estado Actual en el Astillero |
| :--- | :--- | :--- |
| [Ej: No se puede retirar material sin una Orden de Trabajo activa] | [Ej: WorkOrder + Consumption] | [Ej: Vacío de control / Control manual] |

## 9. Requerimientos de Migración a Supabase/n8n
> **REGLA:** Toda tabla implicada DEBE mapearse contra una entidad del catálogo en
> `INDICE_PLANILLAS.md` (Ship, Worker, WorkOrder, CostCenter, Material, etc.).
> Si un dato no calza con ninguna entidad existente, registrarlo como **GAP DE ROADMAP**
> (campo nuevo necesario), no como tabla inventada.
- **Entidades del catálogo implicadas:** [Listar entidades existentes que esta planilla alimenta, ej: TimeImput, Worker, CostCenter]
- **Gaps de Roadmap detectados:** [Datos que no calzan con ninguna entidad actual → candidatos a entidad/campo nuevo, con justificación]
- **Campos a Conservar:** [Lista]
- **Campos a Descartar (Basura):** [Lista con justificación]
- **Campos Faltantes (Necesarios a futuro):** [Lista]
- **Transformaciones Necesarias:** [Limpieza de datos]
- **Automatizaciones Candidatas (n8n):** [Flujos manuales a reemplazar]

## 10. Observaciones, Problemas Frecuentes y Mejoras
- **Problemas Frecuentes:**
  - [Problema] -> [Impacto] -> [Frecuencia]
- **Mejoras Identificadas:**
  - *Alta Prioridad:* [Mejora] -> [Beneficio]
  - *Media Prioridad:* [Mejora] -> [Beneficio]
  - *Ideas:* [Idea] -> [Beneficio]
- **Deuda Técnica:**
  - [Problema funcional pero mal hecho] -> [Riesgo]
- **Recordatorios:** [Anotar aquí cualquier mejora detectada durante sesiones de trabajo]
