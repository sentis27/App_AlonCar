🗺️ Índice Central - App_AlonCar

Este es tu mapa. Úsalo antes de cualquier tarea para localizar la información exacta.
Para Agentes IA (Antigravity): Consultá este índice para navegación general. Para auditorías de cierre de sesión, usá `INDICE_METADATOS.md` (tabla máquina con tipos, comportamientos y dependencias).


📍 Estado Actual del Proyecto
Fase: 3 - Implementación Frontend Web & Conexión Supabase (Sprint 1 Activo)
Objetivo: Desarrollo de la aplicación web ERP naval (React + Supabase), reemplazando planillas legacy con interfaz ágil de control.
Módulo Activo: M3 - Mano de Obra (Carga de Cuadrilla, Control Diario de Nómina y Sábana Quincenal).
Tareas pendientes y backlog: Ver TAREAS_PENDIENTES.md

📚 Índice por Sección
🔧 Sección 1: Infraestructura (FASE 1 - ACTUAL)
Documentación técnica de conectividad, configuración y seguridad.
ArchivoContenidoPara Quién01_stack_tecnico.mdDescripción del stack: Google Sheets, n8n, MCP, Supabase, AntigravityTodos (orientación general)02_configuracion_env.mdCómo crear y llenar el archivo .env paso a pasoDevs que configuren el entorno local03_seguridad_credenciales.mdProtección de credenciales, modelo Zero Trust, Google Service AccountsTodos (responsabilidad crítica)05_integraciones_n8n.mdUbicación y convenciones de los workflows de n8n (workflows/), incluyendo regla de SDD obligatorioDevs / Agentes IA
Próximamente:

04_arquitectura_mcp.md — Métodos expuestos por el servidor MCP


📖 Sección 2: Producto Digital (REFERENCIA & BITÁCORA)
Documentación de producto, decisiones arquitectónicas, errores resueltos, conceptos y procesos.
| Archivo | Contenido | Para Quién |
| :--- | :--- | :--- |
| `docs/02_producto/README.md` | Catálogo central de bitácora (Decisiones, Errores, Conceptos, Procesos) | Todos |
| `docs/02_producto/registro_paso_a_paso.md` | Guía educativa: por qué proteger credenciales, cómo funciona el sistema | Usuarios finales / Clientes |
| docs/02_producto/ESTANDARES_MODULOS_UI_UX.md | Guía Maestra de Estándares de Arquitectura, UI y UX (4 Zonas, KPIs compactos multicolores, Calendario y Excel Grid) | Devs / Agentes IA |
| `GEMINI.md` | Protocolo de Gobernanza Arquitectónica y Operativa Unificado (v1.2) — Fuente Única de Verdad | Devs / Agentes IA (Antigravity) |
| `CLAUDE.md` | Puntero de compatibilidad hacia `GEMINI.md` | Devs / Agentes IA (Claude Code) |
| `docs/00_ARQUITECTURA_TABLAS_Y_FOLIOS.md` | Padrón Maestro de Arquitectura de Tablas y Folios Operativos (# DNI de Fila inviolable) | Todos / Devs / Agentes IA |
| `app/src/lib/monotonicFolioEngine.js` | Motor Canónico de Folios Monótonos Crecientes (# DNI de Registro) para grillas ERP | Devs / Agentes IA |
| `app/src/lib/gridRowActions.js` | Servicio canónico compartido para Duplicar Fila (`duplicateRecord`) y Pegar Fila Completa (`pasteRowFields` / `buildPasteRowHandler`) con auditoría en `audit_logs` y Undo/Redo | Devs / Agentes IA |
| `app/src/hooks/useGridContextMenu.js` | Hook compartido de estado y apertura del menú contextual canónico (`GridContextMenu.jsx`) | Devs / Agentes IA |
| `app/src/hooks/useSpreadsheetGrid.js` | Orquestador canónico de hoja de cálculo ERP (reducido a 162L), con navegación 100% teclado, Fill-handle, selección 2D y Deshacer/Rehacer | Devs / Agentes IA |
| `app/src/hooks/grid/` | Sub-hooks especializados de grilla (`useGridHistory.js`, `useGridSelection.js`, `useGridClipboard.js`, `useGridNavigation.js`) | Devs / Agentes IA |
| `app/src/components/admin/` | Subpaneles modulares de M9 Admin (`AdminRolesMatrixPanel`, `AdminMacroPanel`, `AdminAlertsCompliancePanel`, `AdminLiveKpiRadar`) | Devs / Agentes IA |
| `app/src/components/personal/` | Subpaneles y alertas modulares de M8 Personal (`PersonalNominaPanel`, `PersonalTarifarioPanel`, `PersonalAnalisisPanel`, `MariaJoseContractAlertsCard`) | Devs / Agentes IA |
| `app/src/components/tesoreria/` | Subpaneles de Tesorería — Graciela (`TesoreriaDeduccionesPanel`) | Devs / Agentes IA |
| `app/src/lib/workCostRules.js` | Fuente única de verdad para atribución de Materiales, Consumibles, Elementos de Seguridad (`safety_items`), Resumen Gerencial (`4 + Ref.`) y vencimientos contractuales Astillero | Devs / Agentes IA |
| `app/src/lib/contractorDeductionsService.js` | Servicio de extracción quincenal para `/tesoreria` (Graciela) y sincronización de alertas contractuales para María José | Devs / Agentes IA |
| `app/src/components/compras/` | Subpaneles y modales modulares de M4 Compras (`ComprasPedidosPanel`, `ComprasProveedoresPanel`, `ComprasOcrPanel`, `OrderFormModal`, `NewMaterialModal`, `ComprasAuxModals`) | Devs / Agentes IA |
| `app/src/lib/comprasConstants.js` | Constantes, helpers y funciones canónicas del módulo de Compras (`isCostAuditError`, `STATUS_OPTIONS`, `deduceUnitMeasure`, etc.) | Devs / Agentes IA |
| `app/src/components/labor/` | Subpaneles y modales modulares de M3 Horas (`LaborCargaPanel`, `LaborControlDiarioPanel`, `LaborSabanaPanel`, `LaborModals`) | Devs / Agentes IA |
| `app/src/lib/laborConstants.js` | Constantes y funciones canónicas del módulo de Horas (`cleanShipName`, `NOMINA_ASTILLERO_BASE`, `calculateHoursStats`, etc.) | Devs / Agentes IA |
| `app/src/components/ships/` | Subpaneles y modales modulares de M7 Flota Naval (`ShipsBarcosPanel`, `ShipsEstadiasPanel`, `ShipsArmadoresPanel`, `ShipsModals`) | Devs / Agentes IA |
| `app/src/lib/shipsConstants.js` | Constantes y funciones canónicas de Flota Naval y Estadías (`cleanShipName`, `cleanLocation`, `calculateStayDays`, `calculateBerthMeters`, etc.) | Devs / Agentes IA |
| `app/src/components/panol/` | Subpaneles y modales modulares de M4 Pañol Central & Materiales (`PanolHeader`, `PanolAlertasPanel`, `PanolToolbar`, `PanolMovimientosPanel`, `PanolStockPanel`, `PanolModals`) | Devs / Agentes IA |
| `app/src/lib/panolConstants.js` | Constantes, columnas, helpers y filtros de Pañol Central y Stock (`calculateGasStats`, `calculatePanolKpis`, `filterPanolTransactions`, etc.) | Devs / Agentes IA |
| `app/src/lib/panolService.js` | Capa de servicio y persistencia desacoplada para Pañol (`fetchPanolData`, `saveInlineTxService`, `saveInlineMaterialService`, etc.) | Devs / Agentes IA |
| `app/src/components/workOrders/` | Subcomponentes modulares de M6 Órdenes de Trabajo (`WorkOrdersHeader`, `WorkOrdersKpiRadar`, `WorkOrdersToolbar`, `WorkOrdersUnificadoPanel`, `WorkOrdersOtsPanel`, `WorkOrdersTercerosPanel`, `WorkOrdersModals`, `CloseWorkOrderTreeModal`, `WorkOrderScopeHoverCard`, `WorkOrderSelectorWithHover`) | Devs / Agentes IA |
| `app/src/lib/workOrdersConstants.js` | Constantes, columnas, ciclo de vida de 8 estados (GS-003), helpers y filtros de Órdenes de Trabajo (`computeOtState`, `computeOtMetricsAndDates`, `filterUnifiedRows`, etc.) | Devs / Agentes IA |
| `app/src/lib/workOrdersService.js` | Capa de servicio y persistencia desacoplada para Órdenes de Trabajo (`fetchWorkOrdersData`, `saveWorkOrderService`, `separateWorkItemService`, etc.) | Devs / Agentes IA |
| `app/src/components/terceros/` | Subcomponentes modulares de M5 Terceros & Contratistas Externos (`TercerosHeader`, `TercerosKpiRadar`, `TercerosToolbar`, `TercerosFilasPanel`, `TercerosFichasPanel`, `TercerosModals`) | Devs / Agentes IA |
| `app/src/lib/tercerosConstants.js` | Constantes, columnas, ciclo de comprobantes DEC-017 (PRC, RMO, RPF, FCR, SDT), helpers y filtros de Terceros (`getDollarRateForDate`, `filterTercerosServices`, etc.) | Devs / Agentes IA |
| `app/src/lib/tercerosService.js` | Capa de servicio y persistencia desacoplada para Terceros (`fetchTercerosData`, `saveServiceService`, `confirmEvolutionService`, `saveAuditService`, etc.) | Devs / Agentes IA |
| `app/src/lib/aiPrompts.js` | Catálogo canónico de prompts de sistema GPT-4o-mini (DEC-004 a DEC-007), persistencia en Supabase, caché y bitácora de auditoría IA | Devs / Agentes IA |
| `app/src/lib/aiTextFormatters.js` | Formateadores textuales puros, corrección ortográfica naval (RN-09), inferencia de rubros (RN-08) y parsing local determinístico | Devs / Agentes IA |
| `app/src/services/` | Capa formal de Servicios y Clean Architecture (`personalService.js`, `comprasService.js`, `laborService.js`, `shipsService.js`, `index.js`) con fachada unificada | Devs / Agentes IA |
| `docs/02_producto/05_auditorias/README.md` | Sistema Central de Auditorías Arquitectónicas, Línea Base (`LINEA_BASE_ARQUITECTURA.md`) y Ledger Diario (`BITACORA_DELTAS_SESION.md`) | Devs / Agentes IA |

🏗️ Sección 3: Lógica de Negocio (FASE 2+ - FUTURO)
Diseño de los 6 módulos del ERP.
| Archivo | Contenido | Estado |
| :--- | :--- | :--- |
| `docs/03_negocio/README.md` | Índice de la lógica de negocio | 🔜 Próximamente |
| `docs/03_negocio/proyecto_perfil_puesto_y_matriz_responsabilidades.md` | Metodología de relevamiento, perfiles laborales y Matriz RACI (Módulo 2 Recursos) | ✅ Activo |
| docs/MATRIZ_RESPONSABILIDAD_DATOS.md | Matriz de Responsabilidad de Datos y Motor de Alertas Proactivas (Evolution API WhatsApp + In-App) | 🟢 Documento Vivo Activo |
| `modulos/` | Especificaciones de cada módulo | 🔜 Próximamente |

📖 Sección 4: Skills de Antigravity (Estructura Modular)

Las Skills están organizadas por módulo del ERP, según patrón agency-agents. 
Esto permite especialización por dominio y previene Skills "hagan todo".

### Skills Transversales (Aplican a Todos los Módulos)

Estas 6 Skills son fundacionales — se usan en cualquier contexto del proyecto:

- **automation-governance** (`.agents/skills/transversal/automation-governance/SKILL.md`)
  - Governa cambios a workflows n8n en producción
  - Valida contra SDD y business rules
  
- **caveman** (`.agents/skills/transversal/caveman/SKILL.md`)
  - [Ver SKILL.md para descripción detallada]
  
- **legacy-mapping** (`.agents/skills/transversal/legacy-mapping/SKILL.md`)
  - Documenta Google Sheets legacy antes de migración
  - Foundation para mapeo Sheets → Supabase/n8n
  
- **product-collector** (`.agents/skills/transversal/product-collector/SKILL.md`)
  - [Ver SKILL.md para descripción detallada]
  
- **rtk** (`.agents/skills/transversal/rtk/SKILL.md`)
  - [Ver SKILL.md para descripción detallada]
  
- **session-audit** (`.agents/skills/transversal/session-audit/SKILL.md`)
  - Audita estado del repo al cierre de sesión
  - Asegura consistencia y trazabilidad

- **control-calidad-entrega (SKL-007)** (`.agents/skills/transversal/control-calidad-entrega/SKILL.md`)
  - Control de calidad severo antes de dar por terminada cualquier tarea; verificación empírica y tabla formal.

- **planificacion-por-etapas (SKL-008)** (`.agents/skills/transversal/planificacion-por-etapas/SKILL.md`)
  - Análisis por capas, modo Fast-Track y freno por riesgo en tareas multiturno.

- **ingenieria-codigo-senior (SKL-009)** (`.agents/skills/transversal/ingenieria-codigo-senior/SKILL.md`)
  - Principios senior de código, diseño defensivo y no proliferación de monolitos.

- **chasis-docker-multiapp (SKL-010)** (`.agents/skills/transversal/chasis-docker-multiapp/SKILL.md`)
  - Aislamiento multi-app en Docker por APP_SLUG y proxy reverso.

- **motor-backend-capas (SKL-011)** (`.agents/skills/transversal/motor-backend-capas/SKILL.md`)
  - Arquitectura backend en 4 capas estrictas (Route -> Controller -> Service -> Repo).

- **ergonomia-flujo-visual-senior (SKL-012)** (`.agents/skills/transversal/ergonomia-flujo-visual-senior/SKILL.md`)
  - Ergonomía cognitiva, flujo Top-Down, compresión dimensional e iconografía auto-explicativa con tooltips.

- **data-grid-poweruser (SKL-013)** (`.agents/skills/transversal/data-grid-poweruser/SKILL.md`)
  - Grillas interactivas estilo Excel, navegación direccional 100% teclado, mutación in-situ y matriz 2D.

- **schema-gatekeeper (SKL-014)** (`.agents/skills/transversal/schema-gatekeeper/SKILL.md`)
  - Candado cognitivo anti-memoria; freno de inspección empírica de esquema de base de datos antes de codificar.

- **defensive-erp-contracts (SKL-015)** (`.agents/skills/transversal/defensive-erp-contracts/SKILL.md`)
  - Tolerancia cero a errores silenciosos, transaccionalidad atómica y auditoría obligatoria.

- **context-aware-skill-router (SKL-016)** (`.agents/skills/transversal/context-aware-skill-router/SKILL.md`)
  - Meta-protocolo de enrutamiento selectivo de skills por globs de archivos y criticidad funcional.

- **architectural-modularity-auditor (SKL-017)** (`.agents/skills/transversal/architectural-modularity-auditor/SKILL.md`)
  - Auditoría arquitectónica profunda, cohesión (LCOM) y acoplamiento (CBO) empíricos, tracker anti-rot de IA, modo Línea Base por Cuadrantes y modo Delta Diario pre-commit.

### Skills por Módulo ERP

La estructura modular permite crear Skills especializadas para cada pilar del ERP:

| Módulo | Carpeta | Estado | Skills |
|---|---|---|---|
| M1-activos | `.agents/skills/M1-activos/` | ▶️ En expansión | — |
| M2-recursos | `.agents/skills/M2-recursos/` | ▶️ En expansión | — |
| M3-operaciones | `.agents/skills/M3-operaciones/` | ▶️ En expansión | — |
| M4-logistica | `.agents/skills/M4-logistica/` | ▶️ En expansión | — |
| M5-comercial | `.agents/skills/M5-comercial/` | ▶️ En expansión | — |
| M6-cierre | `.agents/skills/M6-cierre/` | ▶️ En expansión | — |

### Índice Maestro de Skills

Para ver todas las Skills, sus dependencias y estado:

→ **`.agents/skills/SKILLS_REGISTRY.md`** (fuente única de verdad para Skills)

### Cómo Funcionan las Skills

Las Skills siguen patrón **progressive disclosure**:

1. **Discovery**: Al iniciar sesión, Antigravity ve lista de Skills disponibles
2. **Activation**: Si una Skill es relevante, Antigravity lee su SKILL.md completo
3. **Execution**: Antigravity aplica la Skill mientras trabaja

No necesitas mencionar explícitamente una Skill — Antigravity la activa por contexto.

📋 Documentos Transversales
ArchivoPropósitoREADME.md (raíz)Portada del proyecto, stack, cómo empezarINDICE_CENTRAL.mdEste archivo. Tu brújula de navegación.INDICE_METADATOS.mdTabla máquina para auditorías IA (tipos, comportamientos, dependencias).TAREAS_PENDIENTES.mdQué falta por hacer, priorizado por faseROADMAP_NEGOCIO.mdVisión de Fase 2+: los 6 módulos y reglas de negocioGUIA_ANTIGRAVITY.mdInstrucciones maestras para el Agente IA

🎯 Cómo Usar Este Índice
Si estás configurando el entorno local:

Lee 01_infraestructura/01_stack_tecnico.md (orientación)
Ejecuta 01_infraestructura/02_configuracion_env.md (paso a paso)
Valida seguridad en 01_infraestructura/03_seguridad_credenciales.md

Si eres un Agente IA (Antigravity):

Antes de cualquier tarea compleja: Busca aquí el archivo relevante
Si el archivo no está listado: Consultá TAREAS_PENDIENTES.md
No leas documentos completos si no están listados (ahorra contexto)
Tu rol en Fase 1: Asesor técnico de infraestructura
Tu rol en Fase 2+: Colaborador en diseño de negocio

Si necesitas ver el plan a largo plazo:

Lee ROADMAP_NEGOCIO.md (qué viene después)
Revisa TAREAS_PENDIENTES.md (priorización)


🔍 Búsqueda Rápida
Quiero saber:

¿Cómo funciona el stack? → docs/01_infraestructura/01_stack_tecnico.md
¿Cómo configuro .env? → docs/01_infraestructura/02_configuracion_env.md
¿Cómo protejo credenciales? → docs/01_infraestructura/03_seguridad_credenciales.md
¿Cuál es la visión de negocio? → ROADMAP_NEGOCIO.md
¿Qué falta por hacer? → TAREAS_PENDIENTES.md
¿Cómo empiezo? → README.md (raíz)


📈 Estructura de Directorios
App_AlonCar/
├── README.md                          ← Portada (empieza aquí)
├── INDICE_CENTRAL.md                  ← Este archivo (brújula humana)
├── INDICE_METADATOS.md                ← Tabla máquina (auditorías IA)
├── TAREAS_PENDIENTES.md               ← Qué falta
├── ROADMAP_NEGOCIO.md                 ← Visión Fase 2+
├── GUIA_ANTIGRAVITY.md                ← Instrucciones Agente
│
├── docs/
│   ├── 01_infraestructura/            ← FASE 1 (Actual)
│   │   ├── 01_stack_tecnico.md
│   │   ├── 02_configuracion_env.md
│   │   └── 03_seguridad_credenciales.md
│   │
│   ├── 02_producto/                   ← Referencia educativa/comercial
│   │   └── registro_paso_a_paso.md
│   │
│   └── 03_negocio/                    ← FASE 2+ (Futuro)
│       ├── README.md
│       └── revision_planillas.md      ← Sistema de tickets y auditoría
│
├── .agents/                           ← Comportamientos del Agente
│   └── skills/
│       ├── README.md
│       ├── legacy-mapping/
│       │   ├── SKILL.md
│       │   └── recursos/template_mapeo.md
│       └── session-audit/
│           └── SKILL.md
│
├── .env                               ← Local only (en .gitignore)
├── service-account.json               ← Local only (en .gitignore)
├── .gitignore
└── .antigravityignore

⚡ Instrucciones para Antigravity
Antes de Responder Cualquier Pregunta:

¿El tema está listado en este índice?

SÍ: Apunta al archivo exacto
NO: Revisa TAREAS_PENDIENTES.md y sugiere documentarlo


¿El usuario pide algo fuera de Fase 1?

SÍ (ej: lógica de negocio): Apunta a ROADMAP_NEGOCIO.md e indica que es Fase 2+


¿Es un error de seguridad?

SÍ: Prioridad máxima. Cita docs/01_infraestructura/03_seguridad_credenciales.md



Límite de Contexto:

No leas documentos completos a menos que el usuario pida explícitamente
Apunta a secciones específicas
Mantén respuestas concisas


📞 Mantenimiento de Este Índice
Cada vez que:

✅ Se cree un nuevo documento → agregá la fila en la tabla
✅ Se cierre una tarea pendiente → movela de TAREAS_PENDIENTES.md a "Completado"
✅ Cambies de fase → actualiza "Estado Actual"

Responsable: El desarrollador + Antigravity (colaborativo)

Última actualización: Fase 1 - Infraestructura (junio 2026)
Próxima revisión: Cuando Fase 1 esté completa
