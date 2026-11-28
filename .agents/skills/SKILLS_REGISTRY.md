# Skills Registry — App_AlonCar

> **Propósito**: Catálogo máquina-legible de todas las Skills, sus divisiones,
> estados y dependencias. Análogo a `divisions.json` de agency-agents.
>
> **Última actualización**: 2026-11-27
>
> **Versión schema**: 1.2

## Vocabularios Controlados

### Estado
- `active` — Skill en producción, usada por Antigravity
- `standby` — Skill de referencia archivada fuera de `.agents/skills/` para ahorrar tokens diarios; reactivable bajo demanda
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

## Tabla Maestra de Skills (Transversales)

| ID | Nombre | Tipo | Módulo | Estado | Depende de | Descripción | Archivo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SKL-001 | automation-governance | governance | transversal | active | ninguno | Governa cambios a workflows n8n en producción, valida contra SDD y business rules | transversal/automation-governance/SKILL.md |
| SKL-002 | caveman | architecture | transversal | active | ninguno | Modo de comunicación comprimida para sesiones largas (desactivar antes de editar archivos del repo) | transversal/caveman/SKILL.md |
| SKL-003 | legacy-mapping | data-engineering | transversal | standby | SKL-001 | Documenta Google Sheets legacy antes de migración a Supabase/n8n | docs/archivo/skills_referencia/legacy-mapping/SKILL.md |
| SKL-004 | product-collector | integration | transversal | active | SKL-003 | Captura, clasifica y registra experiencia de proyecto en `docs/02_producto/` | transversal/product-collector/SKILL.md |
| SKL-005 | rtk | architecture | transversal | active | ninguno | Comprime salida de comandos Bash (`git log`, `git status`, tests, installs) antes de entrar al contexto | transversal/rtk/SKILL.md |
| SKL-006 | session-audit | governance | transversal | active | SKL-001 | Audita estado del repo al cierre de sesión, asegura consistencia y trazabilidad | transversal/session-audit/SKILL.md |
| SKL-007 | control-calidad-entrega | governance | transversal | active | ninguno | Compuerta obligatoria de control de calidad antes de declarar terminada una tarea: intención, trazabilidad, runtime y reporte | transversal/control-calidad-entrega/SKILL.md |
| SKL-008 | planificacion-por-etapas | governance | transversal | active | SKL-007 | Clasifica pedidos múltiples por afinidad técnica y riesgo (Fast-Track o Quirúrgico) en etapas verificables | transversal/planificacion-por-etapas/SKILL.md |
| SKL-009 | ingenieria-codigo-senior | architecture | transversal | active | SKL-007 | 10 principios de ingeniería senior (foco en 4 capas y diseño defensivo) y matriz de auditoría técnica | transversal/ingenieria-codigo-senior/SKILL.md |
| SKL-010 | chasis-docker-multiapp | architecture | transversal | standby | SKL-009 | Chasis Docker autohospedable (Vite/Nginx + Node/Express + Postgres) con aislamiento multi-app por `APP_SLUG`, proxy `/api` y env fail-fast | docs/archivo/skills_referencia/chasis-docker-multiapp/SKILL.md |
| SKL-011 | motor-backend-capas | architecture | transversal | standby | SKL-009\|SKL-010 | Motor lógico Backend en 4 capas (Routes, Controllers, Services, Repositories/Models), serializador `toDTO` y `errorHandler` centralizado | docs/archivo/skills_referencia/motor-backend-capas/SKILL.md |
| SKL-012 | ergonomia-flujo-visual-senior | architecture | transversal | active | SKL-007 | Marco universal de ergonomía cognitiva y física para interfaces: cascada Top-Down, compresión de clics y Ley de Fitts | transversal/ergonomia-flujo-visual-senior/SKILL.md |
| SKL-013 | data-grid-poweruser | architecture | transversal | active | SKL-012 | Gobernanza para interfaces de alta densidad tabular y carga intensiva: navegación por teclado, mutación in-situ y matriz 2D | transversal/data-grid-poweruser/SKILL.md |
| SKL-014 | schema-gatekeeper | governance | transversal | active | ninguno | Candado cognitivo contra asunción de memoria: inspección empírica previa obligatoria de contratos, tablas y columnas | transversal/schema-gatekeeper/SKILL.md |
| SKL-015 | defensive-erp-contracts | architecture | transversal | active | SKL-009\|SKL-014 | Diseño defensivo en mutaciones y persistencia: cero errores silenciosos, atomicidad, sanitización escalar y auditoría | transversal/defensive-erp-contracts/SKILL.md |
| SKL-016 | context-aware-skill-router | governance | transversal | active | ninguno | Meta-protocolo de enrutamiento contextual: activación selectiva de skills según globs y naturaleza de la tarea | transversal/context-aware-skill-router/SKILL.md |
| SKL-017 | architectural-modularity-auditor | governance | transversal | active | SKL-007\|SKL-009\|SKL-015 | Auditoría arquitectónica profunda: cohesión/acoplamiento (LCOM/CBO), tracker anti-rot, Línea Base por Cuadrantes y Delta Diario pre-commit | transversal/architectural-modularity-auditor/SKILL.md |
| SKL-018 | behavior-preservation-guard | governance | transversal | active | SKL-007\|SKL-017 | Protocolo anti-regresión para refactors y módulos blindados: Cirugía Mínima, Tabla de Paridad Antes/Después, umbrales por ruta, Componentes Canónicos y auditoría `git diff` | transversal/behavior-preservation-guard/SKILL.md |
| SKL-019 | piezas-replicables-solucion | governance | transversal | active | SKL-014\|SKL-018 | Diseño orientado a soluciones para piezas transversales: Entrevista Inteligente de Solución pre-código (con sugerencias de datos) + arquitectura en 3 Capas Soldadas (Datos + Reglas + UI) y candado mecánico | transversal/piezas-replicables-solucion/SKILL.md |

---

## Skills por Módulo ERP

| Módulo | ID | Nombre | Estado | Propósito | Carpeta / Archivo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| M1-activos | — | [Próximas Skills M1] | planned | Activos y embarcaciones (ver `M1-activos/DIVISION.md`) | `M1-activos/DIVISION.md` |
| M2-recursos | — | [Próximas Skills M2] | planned | Personal, talleres y tarifarios (ver `M2-recursos/DIVISION.md`) | `M2-recursos/DIVISION.md` |
| M3-operaciones | SKL-M3-001 | supabase-schema-m3-operaciones | draft | Schema de BD para M3 con RLS (ver `M3-operaciones/DIVISION.md`) | `M3-operaciones/DIVISION.md` |
| M4-logistica | — | [Próximas Skills M4] | planned | Pañol, stock y compras (ver `M4-logistica/DIVISION.md`) | `M4-logistica/DIVISION.md` |
| M5-comercial | — | [Próximas Skills M5] | planned | Terceros y presupuestos (ver `M5-comercial/DIVISION.md`) | `M5-comercial/DIVISION.md` |
| M6-cierre | — | [Próximas Skills M6] | planned | Resumen gerencial y cierre (ver `M6-cierre/DIVISION.md`) | `M6-cierre/DIVISION.md` |

---

## Regla de Mantenimiento

**OBLIGATORIO**: Cada vez que se CREE una Skill nueva:

1. Asignar ID único:
   - Transversal: `SKL-{NNN}` (ej. `SKL-018`)
   - Módulo: `SKL-{MÓDULO}-{NNN}` (ej. `SKL-M3-001`)
2. Agregar fila en la tabla correspondiente y registrar el archivo `SKILL.md` en `INDICE_METADATOS.md`.

## Cómo Usar Este Registro

- **Para Antigravity / Claude Code:** Consultar este archivo o el Router `SKL-016` en `GEMINI.md` para activar solo las skills necesarias según contexto.
- **Para el Usuario:** Ver estado, dependencias y alcance de todas las Skills activas, en borrador o planeadas.
