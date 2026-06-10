# Plantilla Estandarizada: Mapeo de Planilla Legacy

> [!IMPORTANT]
> **REGLA DE AGENTE (ANTIGRAVITY):** Si estás leyendo este documento para mapear una planilla, es **PROHIBIDO** dejar campos con "[Falta Dato]". Si el usuario no proveyó el contexto de un bloque, debes detener la escritura y preguntarle específicamente por el dato faltante antes de continuar.

## 1. Identidad de la Planilla
- **Nombre Técnico/Funcional:** [Ej: Control_Materiales_v3]
- **URL / ID:** [Enlace a la planilla]
- **Fila Real de Encabezados:** [Fila donde empiezan los nombres de las columnas, ignorando el Frontend superior]

## 2. Contexto de Negocio (Aportado por Usuario)
- **Departamento Propietario:** [Ej: Pañol / Logística]
- **Usuarios Principales:** [Quiénes la editan a diario]
- **Propósito Principal:** [Para qué sirve dentro de la empresa]
- **Integraciones Manuales Actuales:** [¿De dónde copian/pegan datos para llenar esto?]

## 3. Elementos "Frontend" y Navegación
- **Enlaces Rápidos Identificados:** [Ej: Celdas con links a "Cargar OT"]
- **Dashboard / Sumatorias Superiores:** [Qué métricas calcula en las filas superiores antes de la tabla]

## 4. Estructura de Datos y Columnas
| Columna | Nombre | Tipo de Dato | Función / Fórmulas Clave (Opcional) |
| :--- | :--- | :--- | :--- |
| A | ID Material | String | Texto libre |
| B | Stock Actual | Number | `=SUM(C2:Z2)` |
| C | Estado | Enum | Lista desplegable: (OK, Faltante, Crítico) |

## 5. Lógica de Validaciones y Alertas (Fórmulas Embebidas)
- **Regla 1:** [Ej: Si falta OT, la celda se pone en ROJO. Fórmula extraída: `=IF(ISBLANK(D5), "Falta OT", "OK")`]
- **Regla 2:** [Otra regla detectada por el MCP]

## 6. Lógica de Código (Apps Script)
- **¿Posee código atado (`.gs`)?**: [Sí / No]
- **Funciones Principales:** 
  - `onEdit(e)`: [Qué hace cuando alguien edita]
  - `enviarAlerta()`: [Qué hace este trigger]
- **Restricciones Ocultas en Código:** [Cualquier validación hecha en código en lugar de fórmulas]

## 7. Requerimientos para la Migración a la Nueva DB (Supabase)
- **Tablas Implicadas:** [A qué tabla futura de Supabase debería ir esta info]
- **Campos Faltantes/Sobrantes:** [¿Hay datos basura que deberíamos descartar en el nuevo sistema?]
