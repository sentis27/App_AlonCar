📋 Tareas Pendientes - App_AlonCar

Este archivo es tu lista de trabajo. Priorizada por fase y criticidad.
Nota: Actualízalo conforme cierres tareas. El agente IA también puede consultar este archivo para saber qué documentar.


🔴 FASE 1: Infraestructura y Conexiones (ACTUAL)
1.1 Documentación Técnica Base

 01_stack_tecnico.md — Descripción del stack
 02_configuracion_env.md — Guía de .env paso a paso
 03_seguridad_credenciales.md — Protección Zero Trust
 04_arquitectura_mcp.md — Métodos expuestos por MCP

Qué métodos tiene el servidor MCP
Cómo los invoca n8n
Qué respuestas devuelve
Prioridad: Alta
Bloqueador: Sin esto, n8n no sabe qué métodos llamar


 05_integraciones_n8n.md — Flujos base

Flujo: Google Sheets → n8n → Validación → Supabase
Flujo: Consulta datos desde MCP
Flujo: Webhook de entrada
Prioridad: Alta
Bloqueador: Sin esto, no hay automatización



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

Última actualización: 2026-06-10
Siguiente revisión: Cuando se complete Fase 1
