📋 Tareas Pendientes - App_AlonCar

Este archivo es tu lista de trabajo. Priorizada por fase y criticidad.
Nota: Actualízalo conforme cierres tareas. El agente IA también puede consultar este archivo para saber qué documentar.

🤖 Agentes Especializados — Instalación por Etapa

[ ] Instalar y configurar database-optimizer
    Etapa: migración Sheets→Supabase
    Trigger: cuando esté definido el modelo relacional en Supabase
    Fuente: agency-agents/engineering/engineering-database-optimizer.md

[ ] Instalar y configurar Graphify (pip install graphifyy)
    Etapa: desarrollo de la app en código real
    Trigger: cuando haya código Python/JS con módulos y dependencias reales
    Nota: no útil sobre documentación Markdown — esperar a que haya codebase real

[ ] Instalar y configurar minimal-change-engineer
    Etapa: cuando haya un caso concreto de bug en producción
    Trigger: cuando la tarea sea corregir algo puntual sin tocar nada más
    Fuente: agency-agents/engineering/engineering-minimal-change-engineer.md


🔴 FASE 1: Infraestructura y Conexiones (COMPLETADA BASE)

🚀 FASE 3 / SPRINT 1: Frontend Web & Supabase (ACTIVO)

### ✓ HECHO — 3.1 Setup Base Frontend y Conexión Supabase
- **Stack:** Vite v8 + React 19 + TailwindCSS v3 + React Router v7 + Lucide Icons.
- **Conexión Supabase:** Inicialización de cliente en `app/src/lib/supabase.js` con variables de entorno (`.env.local`).
- **Autenticación y Perfil:** `AuthContext.jsx` con persistencia de sesión y sincronización automática de perfil de supervisor para `app.aloncar2712@gmail.com`.
- **Layout y Navegación:** `Layout.jsx` y `Sidebar.jsx` con diseño Glassmorphism naval y enlaces a todos los módulos.
- **Base de Datos:** Migración `supabase/migrations/0002_enhance_labor_logs_and_rls.sql` aplicada con RLS, soporte de horas extras y tipos de operario.

### ✓ HECHO — 3.2 Módulo M3: Mano de Obra y Registro de Horas (`LaborLogs.jsx`)
- **Carga de Cuadrilla Masiva:**
  - Carga ágil por Barco y Orden de Trabajo (OT).
  - Desglose por operario de **Horas Normales** (por defecto 9h para Astillero, o 8h si el rubro indica Feriado), **Horas Extras 50%** y **Horas Extras 100%**.
  - Centro de Costo **preestablecido fijo en `CLIENTE`** (sin selector UI para blindar ante errores).
  - Clasificación de personal en 3 tipos: **`Astillero`**, **`Taller`** y **`Contratista`**.
  - Sugerencia automática de rubros navales (Calderería, Soldadura, Pintura, Feriado, etc.).
- **Control Diario de Nómina (Rediseñado en Modo Lista de Alta Densidad):**
  - Vista tabular compacta optimizada para 50+ operarios y contratistas simultáneos.
  - Buscador reactivo por operario, taller, OT o rubro, con filtros por estado y tipo.
  - **Personal Propio del Astillero:** Regla de **9 hs diarias obligatorias** (o **8 hs si se anota "Feriado" en el rubro**) con semáforo visual:
    - 🟢 Completo (9 hs o 8 hs feriado)
    - 🔵 Con Horas Extra (> cuota obligatoria con desglose al 50% / 100%)
    - 🟡 Incompleto (< cuota obligatoria, con indicador de horas faltantes)
    - 🔴 Sin horas cargadas (con botón de **Carga Rápida** de jornada o feriado en 1 clic)
  - **Talleres y Contratistas:** Integrados en la lista sin cuota fija de horas diarias.
- **Sábana Quincenal Interactiva (Matriz Google Sheets + Inspector 1-Clic):**
  - Vista de cuadrícula de operarios × días del mes (quincena 1-15 y 16-31) con subtotales automáticos.
  - **Clic en Operario:** Filtra y despliega inmediatamente la grilla de auditoría y ajuste de todas las horas de ese operario en la quincena.
  - **Clic en Celda Numérica:** Abre directamente el modal de edición (✏️) del registro de esa fecha.
  - **Clic en Celda Vacía:** Atajo de imputación rápida para esa jornada y operario.
- **Edición y Corrección Transversal In-Situ:**
  - Capacidad de modificar cualquier registro directamente desde las 3 vistas (Carga, Control Diario y Sábana) sin abandonar la pantalla.
- **Documentación de Reglas de Negocio:**
  - Registrada la Sección 7 en `docs/03_negocio/00_reglas_negocio.md`.

---

### 🧭 Próximos Pasos Sugeridos (Backlog Priorizado)
- [ ] **0. Rediseño Visual y Experiencia de Usuario (UX) del Dashboard del Administrador (`/admin`):**
  - **Estado:** Pendiente de revisión por Dirección / Usuario.
  - **Detalle:** Revisar la presentación visual del Circuito Operativo Inter-Departamental y la Ficha de Puestos/Vinculaciones. La interfaz actual requiere un rediseño para mejorar la ergonomía visual, reducir la sensación de sobrecarga o dispersión de datos y presentar las funciones, tareas y vinculaciones de forma más limpia, ejecutiva e intuitiva.

- [x] **1. Personal y Tarifas — Reubicación de Columna en Tarifario Quincenal (`Personal.jsx`):**
  - **Tabla "Tarifas Guardadas en el Sistema":** Trasladada la columna **Centro de Costo** (`admin_center`) para que quede ubicada inmediatamente después de la columna **Dólar** y antes de la columna **Acción**.

- [x] **2. Carga de Horas — Corrección de Alineación en Fila de Cuadrilla (`LaborLogs.jsx`):**
  - **Alineación Robusta:** Reestructurada la fila de operarios en Cuadrilla con cabecera fija de columnas en escritorio y rejilla CSS proporcional con scroll horizontal responsivo (`overflow-x-auto min-w-[960px]`). Eliminado el solapamiento visual entre tipo y nombre de operario, y unificadas las alturas y líneas base de todos los campos numéricos y notas.

- [x] **3. Carga de Horas — Casilla de Texto Libre para Estado R de Auditoría (`LaborLogs.jsx`):**
  - **Circuito de Auditoría S -> R -> RR -> RRR:** Implementada la migración `0012_add_review_reason_to_labor_logs.sql` agregando `review_reason` y `worker_response`. Al seleccionar `R` en cualquier tabla o en el modal de edición, se abre dinámicamente la casilla de texto libre ("Motivo de Revisión / Duda Técnica") para registrar la observación. Incorporado badge interactivo de alerta en tablas, descargo en `RR` y bandeja de revisión enriquecida.

- [ ] **4. Validación Operativa M3:** Prueba con supervisores en varadero/muelle cargando partes diarios reales.
- [ ] **2. Módulo M1 & M2: Barcos y Órdenes de Trabajo:**
  - Ficha técnica naval de buques, historial de varadas y estados de puesta en seco.
  - Creación, edición, cierre y presupuestos de OTs vinculadas a buques y clientes.
- [ ] **3. Módulo M4: Pañol y Materiales:**
  - Catálogo de consumibles y aceros/chapas navales.
  - Vales de retiro de pañol vinculados a OTs.
  - Control de stock y alertas automáticas de reposición mínima.
- [ ] **4. Módulo M5: Tarifarios y Liquidaciones:**
  - Matriz de tarifas por hora de personal propio vs. contratistas/talleres.
  - Anexos de facturación y resumen de costos por obra.

---

 01_stack_tecnico.md — Descripción del stack
 02_configuracion_env.md — Guía de .env paso a paso
 03_seguridad_credenciales.md — Protección Zero Trust
 04_arquitectura_mcp.md — Métodos expuestos por MCP

Qué métodos tiene el servidor MCP
Cómo los invoca n8n
Qué respuestas devuelve
Prioridad: Alta
Bloqueador: Sin esto, n8n no sabe qué métodos llamar


✓ HECHO — 1.1.x Documentar convención de Workflows n8n
   Resultado: Creada estructura workflows/ (_meta/INDEX.md, PLANTILLA.md, migracion.md) y docs/01_infraestructura/05_integraciones_n8n.md. Dos workflows registrados como activo-sin-SDD (ya corren en producción): reporte-ordenes-trabajo, reporte-horas (README.md + SDD.md creados, SDD pendiente de completar, migración pendiente).

1.1.y Mantenimiento reporte-horas (post-producción, ver workflows/operaciones/reporte-horas/SDD.md)

- [ ] Diagnosticar "R en todas las filas"
   Prioridad: Crítica — afecta la utilidad real del sistema.
   Para la próxima sesión traer: (1) un mensaje de entrada simple (2-3 líneas, todo claro), (2) el output de E4 para ese mensaje (array `tareas` con `needs_review` y `motivo_revision`).

- [ ] Definir regla de negocio: bifurcación OT con adicionales
   Prioridad: Alta — bloqueador de código.
   Caso "trabajo base + adicional de la misma OT" genera ambigüedad en el matching. Decidir antes de tocar código: ¿fila separada con la misma OT, OT distinta, o campo extra?

- [ ] Ajustar mensaje de respuesta (E9a - PrepararRespuesta)
   Prioridad: Media.
   Revisar texto, formato y datos que muestra al emisor.

- [ ] Prompt: agregar CONTRATISTA HINT en Caso 5 (Set - PromptConfig)
   Prioridad: Media.
   Agregar regla de extracción de `contratista_hint` desde "para [nombre]"; agregar `"contratista_hint": null` como campo en el few-shot MSG5.

Ninguna de las 4 está completa — no hay evidencia en SDD.md ni en el repo de que ya se haya resuelto alguna.



1.2 Testing y Validación

 Checklist de Conectividad

 n8n responde en localhost:5678
 MCP server inicia sin errores
 Google Sheets API funciona (Service Account con permisos)
 Supabase acepta conexiones
 Antigravity puede consultar el servidor MCP


 Documentar Testing

Archivo: docs/01_infraestructura/06_testing_conectividad.md
Qué testear y cómo hacerlo



1.3 Limpieza de Estructura Antigua

 Eliminar carpetas obsoletas:

docs/01_conexiones/ (reemplazada por 01_infraestructura/)
docs/02_bitacora_producto/ (movida a 02_producto/)
docs/mapa_proyecto.md (reemplazado por INDICE_CENTRAL.md)




🟡 FASE 2: Lógica de Negocio (PRÓXIMA)
✓ HECHO — 1.4 Habilitación de Google Apps Script API
   Archivo/Lugar: Google Cloud Console (GCP)
   Qué: Habilitar "Google Apps Script API" y agregar el scope `https://www.googleapis.com/auth/script.projects.readonly` a la Service Account.
   Propósito: Permitir que el servidor MCP descargue el código `.gs` de las planillas automáticamente.
   
✓ HECHO — 1.5 Refactor Servidor MCP para Fase 2
   Resultado: `mcp-server/index.js` ahora expone `read_sheet_schema` y `download_apps_script`.

2.0 Mapeo y Extracción de Datos Legacy

  Mapeo Profundo del Legado (Sheets)
   Archivo/Lugar: docs/planillas/
   Qué: Ejecutar la Skill de Mapeo Legacy (usando MCP read_sheet_schema) para auditar las 14-16 planillas actuales de Google Sheets y documentarlas con la plantilla estandarizada.
   Propósito: Entender las dependencias cruzadas (ej. VLOOKUPs entre hojas) y reglas duras antes de diseñar las tablas de SQL.
   Progreso:
   - [x] HORAS_PLANILLAS_DE_REGISTRO (Borrador - pendiente revisión de negocio)
   - [x] MATERIALES_PLANILLAS_REGISTRO (Borrador - pendiente revisión de negocio)
   - [x] BD_NEWSYSTEMM / B.D.NewSystemm (Confirmado)
   - [x] BD_NUEVAS_PLANILLAS & IMPUTACION_HORAS_VS_MATERIALES (Confirmado)
   - [x] RESUMEN_GERENCIAL, DETALLE_DE_PRESUPUESTOS & PROTOTIPO_PUESTA_EN_SECO (Confirmado)

✓ HECHO — 2.1 Metadatos de Documentación (Roles + Dependencias)
   Resultado: Creado INDICE_METADATOS.md (tabla máquina de 8 columnas) separado de INDICE_CENTRAL.md (narrativo humano).
   Subtareas completadas:
   - 2.1.0: Auditoría de impacto completada
   - 2.1.1: INDICE_METADATOS.md creado (schema-version 1.0)
   - 2.1.2: 21 documentos mapeados con tipos, comportamientos y dependencias
   - 2.1.3: Archivos dependientes modificados (GUIA_ANTIGRAVITY, README)
   - 2.1.4: INDICE_CENTRAL.md refactorizado (solo narrativo)
   - 2.1.5: session-audit Step 4 expandido (detección de dependencias en repo)
   - 2.1.6: session-audit Step 5 expandido (auto-update de metadatos + resumen)
   - 2.1.7: Validación de integridad de INDICE_METADATOS agregada (Step 6)

✓ HECHO — 2.2 Skill de Recolección (product-collector)
   Resultado: Creada `.agents/skills/product-collector/SKILL.md` y la arquitectura de carpetas `docs/02_producto/` (00_raw, 01_decisiones, 02_errores, 03_conceptos, 04_procesos).
   Se implementó la lógica inmutable (para errores y decisiones) y mutable (para procesos y conceptos), junto con la función DIFERIR y auto-trigger desde `session-audit`.

- [ ] **PENDIENTE — 1.6 Refinamiento y Ordenamiento del Mensaje al Usuario WhatsApp (`E9a - PrepararRespuesta`)**
   Archivo/Lugar: Workflow n8n (`E9a - PrepararRespuesta`) / `PRO-003-alertas-humanizadas-e9a.md`
   Qué: Terminar de definir, ordenar y dar estructura visual definitiva al mensaje final de confirmación y diagnóstico que se envía al usuario vía WhatsApp (`waText`).
   Propósito: El mensaje actual requiere mayor orden y jerarquía para que sea 100% claro e intuitivo para los operarios y supervisores al leerlo desde sus teléfonos móviles.
   Prioridad: Alta

Prioridad: Crítica (Paso 0 para poder diseñar los módulos y la DB).

2.1 Diseño de Módulos

 Módulo 1: Activos y Clientes

Archivo: docs/03_negocio/01_modulo_activos_clientes.md
Qué: Barcos, Razones Sociales, relaciones
Reglas: OTs al Barco, facturación a la Razón Social
Entidades: Ship, Owner (Razón Social), Contact
Prioridad: Alta (core del negocio)


 Módulo 2: Recursos

Archivo: docs/03_negocio/02_modulo_recursos.md
Qué: Operarios, Talleres Externos, Proveedores, Tarifarios
Reglas: Operarios externos → Taller externo obligatorio
Entidades: Worker, Workshop, Supplier, RateCard
Prioridad: Alta

Subtareas Módulo 2:
- [ ] **Relevamiento de personal y tareas:** Carga de lista de personal, procesamiento de actividades, construcción de Matriz RACI y perfiles laborales de puesto ([proyecto_perfil_puesto_y_matriz_responsabilidades.md](docs/03_negocio/proyecto_perfil_puesto_y_matriz_responsabilidades.md)).


 Módulo 3: Operaciones y Control de Costos

Archivo: docs/03_negocio/03_modulo_operaciones.md
Qué: OTs, Registro de Asistencia, Imputación de Horas
Reglas: Conciliación automática Reloj ↔ Imputación
Entidades: WorkOrder, Attendance, TimeImput, CostCenter
Prioridad: Crítica (el motor)


 Módulo 4: Logística y Suministros

Archivo: docs/03_negocio/04_modulo_logistica.md
Qué: Catálogo, Inventario, OC, Consumos
Reglas: Salida de pañol = resta automática de stock
Entidades: Material, Inventory, PurchaseOrder, Consumption
Prioridad: Alta


 Módulo 5: Comercial

Archivo: docs/03_negocio/05_modulo_comercial.md
Qué: Presupuestos, Anexos de Factura, Liquidación
Reglas: Clone inteligente, switch MO/Materiales para IVA
Entidades: Quote, InvoiceAttachment, BillingItem
Prioridad: Media (después de costos)


 Módulo 6: Cierre y Auditoría

Archivo: docs/03_negocio/06_modulo_cierre.md
Qué: Data Locking, Cierre por OT, Archivo histórico
Reglas: Jerarquía [BARCO] → [VISITAS] → [OT]
Entidades: ClosureLog, AuditTrail, HistoricalData
Prioridad: Media (después de lógica base)



2.2 Reglas de Negocio Transversales

 Documento: Reglas de Negocio

Archivo: docs/03_negocio/00_reglas_negocio.md
Qué: Reglas que aplican a múltiples módulos
Ejemplos: Ciclo de vida de una OT, estados permitidos, validaciones


 Documento: Flujo de Datos

Archivo: docs/03_negocio/flujo_datos_principal.md
Visualizar: Entrada → Validación → Procesamiento → Salida
Para cada caso de uso (crear OT, registrar asistencia, facturar, etc.)



2.3 Esquema de Base de Datos

 Diagrama ER (Entity Relationship)

Archivo: docs/03_negocio/diagrama_er.md (o .sql)
Mostrar relaciones entre las 6 entidades principales
Incluir constraints, keys, indexes


 Scripts SQL

db/schema.sql — Definición de tablas
db/migrations/ — Cambios incrementales
db/seeds/ — Datos de ejemplo (test fixtures)




🟢 FASE 3: Implementación (DESPUÉS)
3.1 APIs y Endpoints

 Documentación de API

Formato: OpenAPI/Swagger
Archivo: docs/04_api/
GET, POST, PUT, DELETE para cada módulo



3.2 Frontend

 Interfaz de Usuario

Stack: (definir: React, Vue, etc.)
Dashboards por rol
Formularios CRUD



3.3 Deployment

 Guía de Despliegue

Producción
Staging
Backup y recuperación




📊 Resumen de Prioridades
PrioridadTareasBloqueador🔴 Crítica04_arquitectura_mcp, 05_integraciones_n8n, Módulo de OperacionesSin esto, n8n no automatiza🟠 AltaMódulos 1, 2, 4; TestingNecesario para lógica base🟡 MediaMódulos 5, 6; Reglas transversalesDespués de lógica core🟢 BajaAPIs, Frontend, DeploymentFase 3+

🚀 Próximos Pasos Inmediatos
Semana 1:

 Limpiar estructura de docs (ya hecho)
 Documentar arquitectura MCP (04_arquitectura_mcp.md)
 Documentar flujos n8n base (05_integraciones_n8n.md)
 Testing de conectividad

Semana 2:
5. [ ] Iniciar diseño de Módulo de Activos y Clientes
6. [ ] Esquema base de datos
Semana 3+:
7. [ ] Resto de módulos
8. [ ] Flujos de datos completos

📝 Cómo Actualizar Este Archivo
Cuando cierres una tarea:
markdown- [x] **HECHO** — Descripción
Cuando cambies una prioridad:
markdown- [ ] **AHORA CRÍTICA** — Descripción (era Media)
Responsable: Tú + Antigravity (colaborativo)

Última actualización: 2026-10-14
Siguiente revisión: Al iniciar Módulos M1/M2 o M4
