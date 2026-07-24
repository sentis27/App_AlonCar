# Skills Registry — App_AlonCar

> **Propósito**: Catálogo máquina-legible de todas las Skills, sus divisiones, 
> estados y dependencias. Análogo a `divisions.json` de agency-agents.
> 
> **Última actualización**: 2026-07-23
> 
> **Versión schema**: 1.0

## Vocabularios Controlados

### Estado
- `active` — Skill en producción, usada por Antigravity
- `draft` — Skill en desarrollo, aún no validada
- `deprecated` — Skill obsoleta, no usar
- `planned` — Skill planeada para futuro

### Tipo
- `governance` — Gobierno y auditoría del agente
- `architecture` — Diseño de sistemas y calidad de código
- `data-engineering` — Manipulación de datos e integración
- `module-specific` — Específica de un módulo ERP
- `integration` — Conexión con servicios externos

### Módulo
- `M1-activos` · `M2-recursos` · `M3-operaciones` · `M4-logistica` · `M5-comercial` · `M6-cierre` · `transversal`

### Dependencias
Rutas relativas a `.agents/skills/`, separadas por `|`. 
- `ninguno` si no tiene dependencias
- `pendiente-deteccion` si aún no fue analizado

---

## Tabla de Skills

| ID | Nombre | Tipo | Módulo | Estado | Depende de | Descripción | Archivo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SKL-001 | automation-governance | governance | transversal | active | ninguno | Governa cambios a workflows n8n en producción, valida contra SDD y business rules | transversal/automation-governance/SKILL.md |
| SKL-002 | caveman | architecture | transversal | active | ninguno | [Leer SKILL.md para descripción] | transversal/caveman/SKILL.md |
| SKL-003 | legacy-mapping | data-engineering | transversal | active | SKL-001 | Documenta Google Sheets legacy antes de migración a Supabase/n8n | transversal/legacy-mapping/SKILL.md |
| SKL-004 | product-collector | integration | transversal | active | SKL-003 | [Leer SKILL.md para descripción] | transversal/product-collector/SKILL.md |
| SKL-005 | rtk | architecture | transversal | active | ninguno | [Leer SKILL.md para descripción] | transversal/rtk/SKILL.md |
| SKL-006 | session-audit | governance | transversal | active | SKL-001 | Audita estado del repo al cierre de sesión, asegura consistencia y trazabilidad | transversal/session-audit/SKILL.md |

---

## Catálogo por Módulo

### Transversal (Aplican a Todos los Módulos)

| ID | Nombre | Estado | Propósito |
| :--- | :--- | :--- | :--- |
| SKL-001 | automation-governance | active | Governa cambios n8n en prod |
| SKL-002 | caveman | active | [Leer SKILL.md] |
| SKL-003 | legacy-mapping | active | Documenta Sheets legacy |
| SKL-004 | product-collector | active | [Leer SKILL.md] |
| SKL-005 | rtk | active | [Leer SKILL.md] |
| SKL-006 | session-audit | active | Audita repo al cierre de sesión |

### M1-activos

| ID | Nombre | Estado | Propósito |
| :--- | :--- | :--- | :--- |
| [Próximas Skills M1] | [Se agregan conforme se crean] | planned | TBD |

### M2-recursos

| ID | Nombre | Estado | Propósito |
| :--- | :--- | :--- | :--- |
| [Próximas Skills M2] | [Se agregan conforme se crean] | planned | TBD |

### M3-operaciones

| ID | Nombre | Estado | Propósito |
| :--- | :--- | :--- | :--- |
| SKL-M3-001 | supabase-schema-m3-operaciones | draft | Schema de BD para M3 con RLS | 
| [Próximas Skills M3] | [Se agregan conforme se crean] | planned | TBD |

### M4-logistica

| ID | Nombre | Estado | Propósito |
| :--- | :--- | :--- | :--- |
| [Próximas Skills M4] | [Se agregan conforme se crean] | planned | TBD |

### M5-comercial

| ID | Nombre | Estado | Propósito |
| :--- | :--- | :--- | :--- |
| [Próximas Skills M5] | [Se agregan conforme se crean] | planned | TBD |

### M6-cierre

| ID | Nombre | Estado | Propósito |
| :--- | :--- | :--- | :--- |
| [Próximas Skills M6] | [Se agregan conforme se crean] | planned | TBD |

---

## Regla de Mantenimiento

**OBLIGATORIO**: Cada vez que se CREE una Skill nueva:

1. Asignar ID único:
   - Transversal: `SKL-{NNN}` (ej. SKL-004)
   - Módulo: `SKL-{MÓDULO}-{NNN}` (ej. SKL-M3-001)

2. Agregar fila a tabla principal de "Tabla de Skills"

3. Agregar fila a sección del módulo correspondiente

## Cómo Usar Este Registro

- **Para Claude Code / IA de descubrimiento:**
  Consulto este archivo para saber qué Skills existen, verifico dependencias antes de proponer una Skill nueva, y actualizo el estado.
- **Para Antigravity:**
  Leo `SKILLS_REGISTRY.md` al inicio de sesión. Verifico qué Skills necesito para mi tarea específica y pido su ejecución o las leo según el ID.
- **Para el Usuario:**
  Ve el estado de todas las Skills (qué está listo, qué está en draft), identifica dependencias (qué Skill depende de cuál), y planifica la secuencia de desarrollo.
