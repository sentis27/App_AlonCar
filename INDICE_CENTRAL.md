🗺️ Índice Central - App_AlonCar

Este es tu mapa. Úsalo antes de cualquier tarea para localizar la información exacta.
Para Agentes IA (Antigravity): Consultá este índice para navegación general. Para auditorías de cierre de sesión, usá `INDICE_METADATOS.md` (tabla máquina con tipos, comportamientos y dependencias).


📍 Estado Actual del Proyecto
Fase: 1 - Infraestructura y Conexiones
Objetivo: Establecer una base técnica sólida antes de implementar lógica de negocio
Documentación: En construcción gradual
Tareas pendientes: Ver TAREAS_PENDIENTES.md

📚 Índice por Sección
🔧 Sección 1: Infraestructura (FASE 1 - ACTUAL)
Documentación técnica de conectividad, configuración y seguridad.
ArchivoContenidoPara Quién01_stack_tecnico.mdDescripción del stack: Google Sheets, n8n, MCP, Supabase, AntigravityTodos (orientación general)02_configuracion_env.mdCómo crear y llenar el archivo .env paso a pasoDevs que configuren el entorno local03_seguridad_credenciales.mdProtección de credenciales, modelo Zero Trust, Google Service AccountsTodos (responsabilidad crítica)
Próximamente:

04_arquitectura_mcp.md — Métodos expuestos por el servidor MCP
05_integraciones_n8n.md — Flujos base de n8n


📖 Sección 2: Producto Digital (REFERENCIA)
Redacción comercial y educativa. No es crítica para desarrollo.
ArchivoContenidoPara Quiénregistro_paso_a_paso.mdGuía educativa: por qué proteger credenciales, cómo funciona el sistemaUsuarios finales / Clientes

🏗️ Sección 3: Lógica de Negocio (FASE 2+ - FUTURO)
Diseño de los 6 módulos del ERP.
ArchivoContenidoEstadoREADME.mdÍndice de la lógica de negocio🔜 Próximamentemodulos/Especificaciones de cada módulo🔜 Próximamente

📖 Sección 4: Skills del Agente IA (FASE 1/2/3)
Habilidades pre-programadas y protocolos estandarizados para que el Agente IA trabaje consistentemente.
ArchivoContenidoPara Quién.agents/skills/README.mdGuía para crear nuevas SkillsDevs/Arquitectos.agents/skills/legacy-mapping/SKILL.mdMapeo de planillas viejasAgentes IA.agents/skills/session-audit/SKILL.mdAuditoría de cierre de sesiónAgentes IA

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
│       └── README.md (esqueleto)
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
