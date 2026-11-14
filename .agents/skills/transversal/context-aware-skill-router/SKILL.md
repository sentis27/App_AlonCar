---
name: context-aware-skill-router
description: Meta-protocolo de activación selectiva de skills según los archivos intervenidos (globs) y la naturaleza cognitiva de la tarea. Previene tanto la saturación de contexto como la omisión de reglas críticas.
---

# Enrutador Contextual de Reglas y Economía de Atención (SKL-016)

## 1. Diagnóstico del Vicio del Agente (El Problema de Raíz)
A medida que un sistema crece en estándares y reglas, el modelo de lenguaje sufre **2 patologías opuestas**:
1. **Ceguera por Saturación (Context Dilution):** Si intenta mantener todas las reglas detalladas de todos los dominios cargadas al mismo tiempo, su atención se diluye y empieza a ignorar restricciones críticas enterradas en medio del prompt.
2. **Omisión por Cambio de Contexto:** Cuando una conversación pasa de discutir análisis conceptual a editar una interfaz o tocar una base de datos, el agente sigue operando con la inercia del turno anterior y olvida cargar la normativa específica que gobierna la nueva capa que está tocando.

---

## 2. Mandatos Negativos Estrictos (Qué NUNCA volver a hacer)

- **NEVER** inicies la resolución de un pedido sin antes clasificar qué capas del sistema toca (Datos, Lógica/Servicios, Interfaz Visual, Automatización o Infraestructura) y activar las skills correspondientes.
- **NEVER** operes sobre un archivo cuyo patrón de ruta (*glob*) esté gobernado por una skill sin haber leído y aplicado las restricciones de dicha skill en la sesión actual.
- **NEVER** cargues en el contexto activo manuales o procedimientos de dominios ajenos a la tarea en curso (ej. no cargar reglas de contenedores o flujos externos si la tarea es puramente de ergonomía visual).
- **NEVER** omitas la declaración explícita de qué reglas y arquetipo están gobernando tu respuesta al inicio de cada turno.

---

## 3. Matriz de Enrutamiento por Contexto (Tabla de Activación Selectiva)

Antes de ejecutar la primera herramienta en cualquier turno, el agente evalúa la intención del usuario y los archivos objetivo (`globs`) para montar únicamente el subconjunto exacto de skills:

| Dominio / Capa Detectada | Patrón de Archivos (`globs`) / Disparador | Skills que se Activan Obligatoriamente |
| :--- | :--- | :--- |
| **0. Nivel 0 — Fast-Track UI Cosmético** | Ajuste visual/JSX/CSS puro (botón, texto, badge, espaciado en Zona 1 existente) **sin** tocar BD, contratos, hooks de estado ni `services/`/`lib/` | **Solo lectura acotada** (`StartLine`/`EndLine` `≤ 100 L`) + edición + `npm.cmd run build` (y `lint` si hay imports). **Exento** de leer `INDICE_PLANILLAS`, `00_INDICE` y pruebas Supabase. |
| **1. Cualquier consulta o cambio que toque datos, módulos o tablas** | Toda tarea técnica que toque datos o esquema (Pre-vuelo universal) | **`SKL-014`** (`schema-gatekeeper` — Cero asunciones, lectura previa de índices y esquema real). |
| **2. Pedido con múltiples tareas o cruce de varias capas** | 2+ requerimientos o impacto multi-archivo | **`SKL-008`** (`planificacion-por-etapas` — División por etapas y freno por riesgo). |
| **3. Diseño, creación o ajuste de pantallas, formularios y flujos UI** | `**/*.jsx`, `**/*.css` (Componentes y Vistas) | **`SKL-012`** (`ergonomia-flujo-visual-senior` — Cascada Top-Down, compresión de clics y Ley de Fitts). |
| **4. Planillas editables, grillas y tablas operativas** | Vistas de arquetipo `CARGA_EDICION` y `*Grid*` | **`SKL-013`** (`data-grid-poweruser` — Operación 100% teclado, mutación in-situ, motor canónico). |
| **5. Escritura de lógica, servicios, mutaciones de BD y auditoría** | `**/lib/**`, `**/services/**`, `**/hooks/**`, mutaciones | **`SKL-009`** (`ingenieria-codigo-senior`) + **`SKL-015`** (`defensive-erp-contracts` — Atomicidad, sanitización y trazabilidad). |
| **6. Contenedores, despliegue o servicios Backend dedicados** | `Dockerfile`, `docker-compose*`, `backend/**` | **`SKL-010`** (`chasis-docker-multiapp`) + **`SKL-011`** (`motor-backend-capas`). |
| **7. Cierre de cualquier implementación o modificación** | Antes de dar por terminada la tarea o hacer commit | **`SKL-007`** (`control-calidad-entrega` — Prueba real en caliente y matriz de evidencia). |

---

## 4. Freno de Auditoría Pre-Código (Protocolo de Verificación)
1. **Regla de Escalado desde Nivel 0:** Si al inspeccionar el fragmento (`≤ 100 L`) se detecta que el ajuste requiere nuevas props de datos, mutaciones, estado compartido o servicios, **abortar Nivel 0** y activar inmediatamente las filas `1..7` correspondientes.
2. **Declaración de Cabecera Obligatoria:** En la primera línea de cada respuesta técnica, el agente debe imprimir el bloque de gobernanza indicando el Arquetipo activo y la lista exacta de códigos `SKL-XXX` que el enrutador activó para ese turno (en Nivel 0: `[SKL-016 Nivel 0 Fast-Track UI]`).
