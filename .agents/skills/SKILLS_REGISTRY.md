# Skills Registry — App_AlonCar

> **Propósito**: Catálogo máquina-legible de todas las Skills, sus divisiones, 
> estados y dependencias. Análogo a `divisions.json` de agency-agents.
> 
> **Última actualización**: 2026-11-06
> 
> **Versión schema**: 1.1

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
| SKL-007 | control-calidad-entrega | governance | transversal | active | ninguno | Compuerta obligatoria de control de calidad antes de declarar terminada una tarea: intención, trazabilidad de requisitos, estándares, integridad de datos, rendimiento y reporte con evidencia | transversal/control-calidad-entrega/SKILL.md |
| SKL-008 | planificacion-por-etapas | governance | transversal | active | SKL-007 | Clasifica pedidos múltiples por afinidad técnica y riesgo (Fast-Track o Quirúrgico) y los divide en etapas verificables | transversal/planificacion-por-etapas/SKILL.md |
| SKL-009 | ingenieria-codigo-senior | architecture | transversal | active | SKL-007 | 10 principios de ingeniería senior (foco P1 separación en 4 capas y P6 diseño defensivo) y matriz de auditoría técnica | transversal/ingenieria-codigo-senior/SKILL.md |
| SKL-010 | chasis-docker-multiapp | architecture | transversal | active | SKL-009 | Chasis Docker autohospedable (Vite/Nginx + Node/Express + Postgres) con aislamiento multi-app por APP_SLUG, proxy /api y env fail-fast | transversal/chasis-docker-multiapp/SKILL.md |
| SKL-011 | motor-backend-capas | architecture | transversal | active | SKL-009\|SKL-010 | Motor lógico Backend en 4 capas (Routes, Controllers, Services, Repositories/Models), serializador toDTO y errorHandler centralizado | transversal/motor-backend-capas/SKILL.md |
| SKL-012 | ergonomia-flujo-visual-senior | architecture | transversal | active | SKL-007 | Marco universal de ergonomía cognitiva y física para interfaces. Cascada Top-Down, compresión de clics, accesos rápidos y Ley de Fitts | transversal/ergonomia-flujo-visual-senior/SKILL.md |
| SKL-013 | data-grid-poweruser | architecture | transversal | active | SKL-012 | Gobernanza para interfaces de alta densidad tabular y carga intensiva. Navegación espacial por teclado, mutación in-situ y operaciones matriciales | transversal/data-grid-poweruser/SKILL.md |
| SKL-014 | schema-gatekeeper | governance | transversal | active | ninguno | Candado cognitivo contra asunción de memoria. Inspección empírica previa obligatoria de contratos, tablas, columnas y módulos | transversal/schema-gatekeeper/SKILL.md |
| SKL-015 | defensive-erp-contracts | architecture | transversal | active | SKL-009\|SKL-014 | Diseño defensivo en mutaciones y persistencia. Cero errores silenciosos, atomicidad, sanitización escalar y contrato indivisible con auditoría | transversal/defensive-erp-contracts/SKILL.md |
| SKL-016 | context-aware-skill-router | governance | transversal | active | ninguno | Meta-protocolo de enrutamiento contextual. Activación selectiva de skills según globs y naturaleza de la tarea para economizar atención | transversal/context-aware-skill-router/SKILL.md |

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
| SKL-007 | control-calidad-entrega | active | Control de calidad obligatorio pre-entrega |
| SKL-008 | planificacion-por-etapas | active | Planificación en etapas con Fast-Track / Freno por Riesgo |
| SKL-009 | ingenieria-codigo-senior | active | Arquitectura en 4 capas, diseño defensivo y auditoría senior |
| SKL-010 | chasis-docker-multiapp | active | Infraestructura Docker multi-app aislada por APP_SLUG |
| SKL-011 | motor-backend-capas | active | Motor lógico Backend REST en 4 capas con manejo central de errores |
| SKL-012 | ergonomia-flujo-visual-senior | active | Ergonomía cognitiva, flujo mental Top-Down y compresión dimensional |
| SKL-013 | data-grid-poweruser | active | Grilla industrial editable, navegación 100% teclado y operaciones 2D |
| SKL-014 | schema-gatekeeper | active | Freno de inspección empírica y cero asunciones de memoria |
| SKL-015 | defensive-erp-contracts | active | Tolerancia cero a errores silenciosos, atomicidad y sanitización |
| SKL-016 | context-aware-skill-router | active | Enrutador contextual por globs y economía de atención |

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
