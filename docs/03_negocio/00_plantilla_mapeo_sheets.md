# Plantilla Estandarizada: Mapeo de Planilla Legacy

> [!IMPORTANT]
> **REGLA DE AGENTE (ANTIGRAVITY):** Si estás leyendo este documento para mapear una planilla, es **PROHIBIDO** dejar campos con "[Falta Dato]". Si el usuario no proveyó el contexto de un bloque, debes detener la escritura y preguntarle específicamente por el dato faltante (especialmente en "Clasificación" y "Mejoras") antes de continuar.

## 1. Identidad de la Planilla
- **Nombre Técnico/Funcional:** [Ej: Control_Materiales_v3]
- **URL / ID:** [Enlace a la planilla]
- **Clasificación Interna:** [Ej: Registro de carga en crudo / Dashboard de procesado / Mixta]
- **Fila Real de Encabezados:** [Fila donde empiezan los nombres de las columnas, ignorando el Frontend superior]

## 2. Contexto de Negocio (Aportado por Usuario)
- **Departamento Propietario:** [Ej: Pañol / Logística]
- **Usuarios Principales:** [Quiénes la editan a diario y con qué rol]
- **Propósito Principal:** [Para qué sirve dentro de la empresa]
- **Integraciones Manuales Actuales:** [¿De dónde copian/pegan datos para llenar esto? ¿Hacia dónde exportan?]

## 3. Elementos "Frontend" y Navegación
- **Enlaces Rápidos Identificados:** [Ej: Celdas con links a "Cargar OT"]
- **Dashboard / Sumatorias Superiores:** [Qué métricas calcula en las filas superiores antes de la tabla, ej: Stock Total Valorizado]

## 4. Estructura de Datos y Columnas
| Columna | Nombre | Tipo de Dato | Método de Ingreso | Función / Fórmulas Clave (Opcional) |
| :--- | :--- | :--- | :--- | :--- |
| A | ID Material | String | Manual (Texto libre) | Ninguna |
| B | Stock Actual | Number | Automático (Fórmula) | `=SUM(C2:Z2)` |
| C | Estado | Enum | Lista Desplegable | Validación Data |

## 5. Lógica de Validaciones y Alertas (Fórmulas Embebidas)
- **Regla 1:** [Ej: Si falta OT, la celda se pone en ROJO. Fórmula extraída: `=IF(ISBLANK(D5), "Falta OT", "OK")`]
- **Regla 2:** [Otra regla de validación de datos detectada]

## 6. Lógica de Código (Apps Script)
- **¿Posee código atado (`.gs`)?**: [Sí / No]
- **Funciones Principales detectadas por MCP:** 
  - `onEdit(e)`: [Qué hace cuando alguien edita]
  - `enviarAlerta()`: [Qué hace este trigger]
- **Restricciones Ocultas en Código:** [Cualquier validación hecha en código en lugar de fórmulas]

## 7. Problemas Frecuentes y Oportunidades de Mejora
- **Dolores Actuales:** [Ej: El operario se olvida de cargar el contratista y la fila queda huérfana]
- **Mejora Propuesta (UX/UI futura):** [Ej: Forzar selección de contratista obligatoria en la pantalla de carga]
- **Automatización Propuesta (n8n):** [Ej: Si carga contratista externo, enviar alerta a gerencia para aprobar la tarifa]

## 8. Requerimientos para la Migración a Supabase/n8n
- **Tablas Implicadas:** [A qué tabla futura de Supabase debería ir esta info]
- **Campos Faltantes/Sobrantes:** [¿Hay datos basura que deberíamos descartar en el nuevo sistema?]
