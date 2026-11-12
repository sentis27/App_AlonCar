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

### 🏛️ Plan de Desacoplamiento y Deuda Arquitectónica (Gobernado por SKL-017 / SKL-008)
> Diagnóstico completo y hoja de ruta sellada en `docs/02_producto/05_auditorias/LINEA_BASE_ARQUITECTURA.md`

- [x] **Ola 1: Sincronización y Quick Wins del Núcleo (~4.5 hs)**
  - [x] A-01: Inyectar `workers` dinámico en `allocationEngine.js`
  - [x] A-02: Unificar catálogo de rubros en `tradesCatalog.js`
  - [x] C-01: Unificar servicio de variables macroeconómicas con auditoría en `audit_logs`
  - [x] C-03: Conectar conteo real de horas en Dashboard central
- [x] **Ola 2: Trazabilidad, Seguridad y Control de Acceso (~4.5 hs - Parcial n8n postergado)**
  - [x] B-02: Auditoría obligatoria canónica en `Panol`, `Ships` y `Terceros` (mutaciones directas eliminadas)
  - [ ] D-02: Respaldar `workflow.json` reales de n8n en el repo (Postergado a próxima sesión por usuario)
  - [x] D-03: Proteger Edge Function Deno con verificación JWT de Supabase Auth
  - [x] D-04: Verificación empírica de aislamiento de credenciales (`service-account.json` ignorado en git)
- [x] **Ola 3: Desarticulación Quirúrgica de Monolitos (~15 hs) — 100% CUMPLIDA (7 de 7 monolitos transaccionales y 8 de 8 páginas críticas reducidas a < 250L)**
  - [x] B-01.1: Modularizar `Compras.jsx` (Reducido de 9.076L a 242L, subpaneles en `components/compras/`, modales y `comprasConstants.js`)
  - [x] B-01.2 & B-04: Modularizar `Personal.jsx` (Reducido de 6.186L a 152L, 3 subpaneles en `components/personal/`, eliminación total de fallback `initialPersonnel.json`)
  - [x] B-01.3: Modularizar `LaborLogs.jsx` (Reducido de 6.111L a 200L, subpaneles `LaborCargaPanel`, `LaborControlDiarioPanel`, `LaborSabanaPanel` en `components/labor/`, `LaborModals.jsx` y `laborConstants.js`)
  - [x] C-02: Culminar extracción de `AdminDashboard.jsx` (Reducido de 3.034L a 231L, 4 subpaneles en `components/admin/`)
  - [x] B-01.4 (Parte 1 - Ships): Modularizar `Ships.jsx` (Reducido de 5.048L a 202L, subpaneles `ShipsBarcosPanel`, `ShipsEstadiasPanel`, `ShipsArmadoresPanel` en `components/ships/`, `ShipsModals.jsx` y `shipsConstants.js`)
  - [x] B-01.4 (Parte 2 - Panol): Modularizar `Panol.jsx` (Reducido de 4.922L a 219L, subpaneles `PanolHeader`, `PanolAlertasPanel`, `PanolToolbar`, `PanolMovimientosPanel`, `PanolStockPanel` en `components/panol/`, `PanolModals.jsx`, `panolConstants.js` y `panolService.js`)
  - [x] B-01.4 (Parte 3 - WorkOrders): Modularizar `WorkOrders.jsx` (Reducido de 5.614L a 238L, subcomponentes `WorkOrdersHeader`, `WorkOrdersKpiRadar`, `WorkOrdersToolbar`, `WorkOrdersUnificadoPanel`, `WorkOrdersOtsPanel`, `WorkOrdersTercerosPanel`, `WorkOrdersModals.jsx` en `components/workOrders/`, `workOrdersConstants.js` y `workOrdersService.js`)
  - [x] B-01.4 (Parte 4 - Terceros): Modularizar `Terceros.jsx` (Reducido de 3.825L a 246L, subcomponentes `TercerosHeader`, `TercerosKpiRadar`, `TercerosToolbar`, `TercerosFilasPanel`, `TercerosFichasPanel`, `TercerosModals.jsx` en `components/terceros/`, `tercerosConstants.js` y `tercerosService.js`)
- [x] **Ola 4: Capa de Servicios y Clean Architecture (~6 hs) — 100% CUMPLIDA**
  - [x] A-03 (Sub-Ola 4.1): Modularizar motor de IA `aiLaborEngine.js` (Reducido de 1.120L a 214L, prompts extraídos a `aiPrompts.js` y formateadores puros a `aiTextFormatters.js`)
  - [x] A-04 (Sub-Ola 4.2): Modularizar `useSpreadsheetGrid.js` en sub-hooks (Reducido de 1.255L a 162L, sub-hooks extraídos a `hooks/grid/`: `useGridHistory`, `useGridSelection`, `useGridClipboard`, `useGridNavigation`)
  - [x] B-03 / D-01 (Sub-Ola 4.3): Crear capa formal `app/src/services/` (`personalService.js`, `comprasService.js`, `laborService.js`, `shipsService.js`, `index.js`) con fachada unificada y auditoría obligatoria

---

### 🧭 Próximos Pasos Sugeridos (Backlog Priorizado)
- [x] **0.A Órdenes de Trabajo — Regla de Imputación Naval, Cierre de Árbol en 1-Clic y Selector Canónico Estandarizado con Hover:**
  - **Regla Naval de Imputación:** Toda OT finalizada o cerrada (`isWorkOrderActiveForImputation === false` o con todas sus subtareas en `Finalizado`/`Facturado`) queda automáticamente oculta para la carga e imputación de datos en Pañol, Horas, Compras y Terceros, a menos que el usuario active excepcionalmente el conmutador `[👁️ Ver finalizadas]`.
  - **Cierre de Árbol en 1-Clic (`CloseWorkOrderTreeModal.jsx`):** Acción orgánica sensible disponible en la Planilla Unificada de OTs, en el Panel de OTs y en la Ficha 360°, permitiendo dar por finalizadas o facturadas y cerradas todas las subtareas (`work_items`) asociadas a una OT en una sola operación atómica, con registro en `audit_logs` y feedback visual en caso de error.
  - **Tarjeta Canónica de Sábana Técnica (`WorkOrderScopeHoverCard.jsx`):** Módulo exportable reutilizable que presenta la ficha técnica de alcance de obra idéntica a la vista de planilla (Imagen 2): cabecera compacta `OT #{otNum}: {otTitle}`, buque, desglose cronológico de líneas con tachado horizontal Unicode (`❌ L1:... [Finalizado]`) y tareas activas en verde `[En ejecución]`.
  - **Selector Estandarizado con Hover (`WorkOrderSelectorWithHover.jsx`):** Reemplazo de los menús desplegables nativos que mostraban cadenas horizontales concatenadas y grotescas. Presenta opciones limpias y compactas (`OT #{otNum}: {otTitle}` + badges) y, al pasar el cursor (hover) sobre cualquier opción, despliega en vivo la tarjeta canónica de sábana técnica. Estandarizado en `ShipWorkOrderPickerModal`, `MultiWithdrawalModal` (Pañol), `EditLaborModal` & `QuickLogModal` (Horas) y `TercerosModals`.

- [ ] **0. Rediseño Visual y Experiencia de Usuario (UX) del Dashboard del Administrador (`/admin`):**
  - **Estado:** Pendiente de revisión por Dirección / Usuario.
  - **Detalle:** Revisar la presentación visual del Circuito Operativo Inter-Departamental y la Ficha de Puestos/Vinculaciones. La interfaz actual requiere un rediseño para mejorar la ergonomía visual, reducir la sensación de sobrecarga o dispersión de datos y presentar las funciones, tareas y vinculaciones de forma más limpia, ejecutiva e intuitiva.

- [x] **1. Personal y Tarifas — Reubicación de Columna en Tarifario Quincenal (`Personal.jsx`):**
  - **Tabla "Tarifas Guardadas en el Sistema":** Trasladada la columna **Centro de Costo** (`admin_center`) para que quede ubicada inmediatamente después de la columna **Dólar** y antes de la columna **Acción**.

- [x] **2. Carga de Horas — Corrección de Alineación en Fila de Cuadrilla (`LaborLogs.jsx`):**
  - **Alineación Robusta:** Reestructurada la fila de operarios en Cuadrilla con cabecera fija de columnas en escritorio y rejilla CSS proporcional con scroll horizontal responsivo (`overflow-x-auto min-w-[960px]`). Eliminado el solapamiento visual entre tipo y nombre de operario, y unificadas las alturas y líneas base de todos los campos numéricos y notas.

- [x] **3. Carga de Horas — Casilla de Texto Libre para Estado R de Auditoría (`LaborLogs.jsx`):**
  - **Circuito de Auditoría S -> R -> RR -> RRR:** Implementada la migración `0012_add_review_reason_to_labor_logs.sql` agregando `review_reason` y `worker_response`. Al seleccionar `R` en cualquier tabla o en el modal de edición, se abre dinámicamente la casilla de texto libre ("Motivo de Revisión / Duda Técnica") para registrar la observación. Incorporado badge interactivo de alerta en tablas, descargo en `RR` y bandeja de revisión enriquecida.

- [x] **2. Módulo M3: Órdenes de Trabajo (`WorkOrders.jsx`), Carga en Cascada (`LaborLogs.jsx`) y Permisos Operativos (`Personal.jsx`):**
  - **Planilla Unificada de Trabajos (`work_items` — GS-003):** El estado del ciclo de vida operativo (*Pendiente de inicio*, *En ejecución*, *Finalizado*, *Pendiente remito*, *Remito realizado/Pdte firma*, *Finalizado costo final de obra*, *Facturado*, *Desestimado*) reside en cada Trabajo, mientras que el estado de la OT contenedora (`work_orders`) se calcula automáticamente (bloqueando el cierre si hay trabajos `"En ejecución"`).
  - **Separación / Independización de un Trabajo de su Contenedor OT:** Botón y modal **✂️ Separar / Independizar Trabajo** para extraer un trabajo hacia una **Nueva OT independiente** (Tabulada o Libre con `OT-N` automático) o moverlo a otra OT existente del mismo barco, arrastrando automáticamente sus registros de Terceros, Horas y Pañol.
  - **Las 3 Fechas de la OT (Creación, Inicio Real y Final):**
    1. **Fecha de Creación:** Automática `HOY()` al abrir *"Cargar Trabajo / Nueva OT"*.
    2. **Fecha de Inicio Real (`MIN`):** Primer dato cargado en todo el sistema para la OT (Horas, Materiales o Terceros).
    3. **Fecha Final (`MAX`):** Último dato cargado a la OT (Horas, Materiales o Terceros).
    - Exhibidas en la tira de 4 indicadores junto a *Horas Imputadas* en **Contenedores OT**, en columna dedicada de **Planilla Unificada** y en **Ficha 360°**.
  - **Bloqueo y Filtrado en Cascada (`1º Barco → 2º Contratista Habilitado → 3º OT en Ejecución`):** Implementado en **Carga de Horas (`LaborLogs.jsx`)** y **Terceros (`WorkOrders.jsx`)**, filtrando únicamente contratistas y OTs con trabajos en estado `"En ejecución"` y mostrando la descripción detallada (`DEC-016`).
  - **Jefes de Obra Dinámicos (`JO`) y Alta In-Situ (`+ Crear nuevo Jefe de Obra...`):** Selector alimentado en vivo desde el Padrón (`public.workers` con `is_foreman = true`) con opción al final de la lista para crear un nuevo Jefe de Obra sin salir del menú, sincronizando automáticamente `public.workers` y `public.organization_roles`.
  - **Permiso `"3ros"` y Autocarga Condicional de `PRC $0` en Terceros (`DEC-014`):** Botón de permiso **`3ros`** (`can_charge_third_party`) en `Personal.jsx`. La autocarga de `PRC $0` en `public.third_party_services` solo se habilita cuando el trabajo tiene **exactamente 1 contratista** y este posee el permiso **`3ros`** activo.
  - **Doble Observación Vinculada en Terceros:** `direct_observations` (sincronizada automáticamente desde la Descripción del trabajo en la OT) y `specific_observations` (editable de forma independiente desde Terceros).
  - **Cierre Comercial & Data Locking (`DEC-011`) y Bitácora Técnica ("Ampliar"):** Bloqueo de costos para OTs cerradas/facturadas y registro de consultas técnicas.

- [x] **5. Inmovilización de Encabezados (Sticky Header tipo Excel) en Todas las Tablas:**
  - Encabezados congelados/fijos en scroll vertical (sticky top-0 z-20 bg-slate-950) en Personal y Tarifas, Horas, OTs, Barcos y Panel Administrador.

- [x] **6. Horas — Selección Libre de Filas + Barra Reactiva de Totales (LaborLogs.jsx):**
  - Checkboxes y selección libre en Cuadrilla, Control Diario y Sábana Quincenal con sumas instantáneas de hs normales, 50%, 100%, total, promedio y acciones masivas S/R/RR/RRR.

- [x] **7. Terceros — Botón de Evolución Compacto (Terceros.jsx):**
  - Icono exclusivo de estrella sin texto visible para evitar solapamientos.

- [x] **8. Módulo de Compras M4b (Compras.jsx + Migraciones 0024, 0025, 0026 y 0027):**
  - **Reemplazo Integral de GS-006:** Depuración de 32 a 24 columnas operativas.
  - **Secuencia de Columnas Reordenada:** `[ ] | Destino | Fecha / Quincena | Buque / OT | Solicita | Material Solicitado | Cant. | $/U Proveedor | $/U Sistema | Proveedor | Estado | Urgencia | Doc | Conciliado | Acciones`.
  - **Edición In-Situ Doble Clic (Estilo Excel/Sheets):** Modificación ágil en celda con doble clic de `$/U Proveedor`, `Proveedor`, `Cantidad` y `Solicita` (guardado instantáneo con Enter/Blur en Supabase sin abrir modales) y alternancia rápida de Urgencia con 1 clic.
  - **Carga Multi-Material:** Modal unificado con cabecera de OT (descripción completa visible, barco, fecha con doble clic nativo `showPicker()`, solicitante por defecto "PAÑOL" o lista de operarios habilitados `can_withdraw_materials = true`, selector de urgencia `SIN_APURO`, `URGENTE`, `PROXIMA_SALIDA`) y líneas de insumos dinámicas con `[ ➕ Agregar Material ]`.
  - **Deducción Automática Forzada de Unidad de Medida:** Reglas estrictas por nombre (`lado x lado` $\rightarrow$ `m2`, `x metro` $\rightarrow$ `metro lineal`, `x kg` $\rightarrow$ `kg`, `x m3` $\rightarrow$ `m3`, defecto `unidad`) con edición manual bloqueada para blindar stock.
  - **Soporte de 2 Compradores WhatsApp y Configuración en Admin:**
    - Panel `/admin` con pestaña *"Config. Compras & WhatsApp"* para gestionar nombres y celulares de Jorge Sentis y Andrés, y teléfonos directos de alerta directiva (`se_compra_alertas`), almacenados en `public.system_settings`.
    - Selector de comprador en despacho agrupado, normalización argentina (`549...`) y botón de llamada directa para números fijos / 0810 (Air Liquide `0810-222-5272`, Cliente `2234867`).
  - **Circuito de "PEDIDO INCOMPLETO" (Recepción Parcial y Reclamo Automático):**
    - Modal de recepción para pañoleros que calcula entregadas vs faltantes, exige número de remito obligatorio y foto de evidencia física (`REMITO` en storage).
    - Desglose automático de la orden: actualiza la orden original a `RECIBIDO` (con ingreso a stock si va a pañol) y crea automáticamente una orden hija por el saldo faltante en estado `PEDIDO INCOMPLETO`.
    - Generación automática en Compras del mensaje WhatsApp de reclamo formal con plantilla oficial Alon Car S.A.
  - **Alerta Gerencial "SE COMPRA?":** Notificación directiva rápida a Hugo Sentis (Gerente General), Martín Sentis (Gerente de Operaciones) y Jefe de Obra asignado a la OT con enlaces directos para resolver aprobaciones de compra.
  - **Gestor Multi-Documento por Orden (`OrderAttachmentsModal`):** Permite subir y visualizar múltiples archivos para una misma orden (Cotización de Material, Cotización de Mano de Obra confidencial, Ficha Técnica, Remito, Factura, Fotos de Muestra) con opciones individuales de ver, editar metadatos y eliminar.
  - **Doble Modo de Interfaz y Permisos de Pañol:** Modo *"Vista Simple de Solicitud / Recepción"* (expone columna y filtro de Proveedor para cotejar remitos, y selector editable de estados de recepción operativa) vs *"Vista Completa de Compras"*.
  - **KPIs Interactivos Agrupados:** 6 grupos de tarjetas (`Por Emitir`, `Cotizaciones`, `En Proveedor`, `SE COMPRA?`, `Recibidos`, `Gases P-02`) con sub-pills para cada estado operativo individual.
  - **Barra Flotante de Acciones Masivas y Filtros Activos:** Diseño de alto contraste con badge de alerta de filtros activos, botón `[ ✕ Limpiar Filtros ]` (replicado en barra de búsqueda) y asignación masiva de proveedor en 1 clic (`[ 🏢 Asignar Proveedor (N) ]`).
  - **Catálogo de Proveedores con Doble Vista y Multirubro:** Vista lista con sticky header vs tarjetas/cards, KPIs interactivos (Total, Sin Teléfono, Sin Email, Sin Rubro, Gases P-02), combobox multirubro (`trades TEXT[]`) y buscador rápido in-situ `InlineSupplierPicker` por iniciales para +300 proveedores.
  - **Alta Formal de Material en B.D. Maestra (`NewMaterialModal`) y KPI 5 "Alta Catálogo":** 3 únicas categorías (`MATERIALES`, `CONSUMIBLES`, `ELEM.SEGURIDAD`), unidad de medida desplegable, % de seguridad desplegable (6% por defecto), subida de foto a Storage, descarte individual/masivo (`no_catalog_required`) y solicitud de apertura de nuevo rubro con alerta y homologación 1-clic en `/admin`.
  - **Carga Multi-Adjunto Dinámica (`+ Agregar otro adjunto`):** Filas independientes con su propio selector de Tipo de Documento, archivo y descripción en `OrderAttachmentsModal` y `UploadDocModal`.

  - **Ergonomía de Hoja de Cálculo (Google Sheets / Excel Grid — useSpreadsheetGrid):**
    - Coordenadas de celda activa con indicador GPS en ribbon y selección de rango vertical/horizontal (`Shift + Flechas` o arrastre con mouse).
    - Barra reactiva de métricas en vivo en ribbon (`Cant`, `Suma`, `Promedio`, `Mín`, `Máx` al seleccionar rangos numéricos como en Excel).
    - Tirador de esquina inferior derecha (*Fill Handle*) con arrastre y doble clic de auto-rellenado.
    - Atajos rápidos: `Ctrl + C` (copiar), `Ctrl + V` (pegar en celda o rango), `Ctrl + D` (rellenar hacia abajo), `Ctrl + Z` / `Ctrl + Y` (pila global de deshacer/rehacer de 50 pasos por sesión y usuario con reversión en Supabase), `Ctrl + F` (foco al buscador de la tabla), `Esc` (limpia búsquedas y filtros activos).
    - Botón visible `[ ↩ Deshacer (Ctrl+Z) ]` y badge con atajos en barra de herramientas.
  - **Refinamiento Operativo y Arquitectura Compras (Migración 0029 + Fit-to-Viewport):**
    - **Depuración de Estados:** Eliminado el estado obsoleto `SOLICITUD` (migrado a `PEDIR`) y reordenado el catálogo `STATUS_OPTIONS` en orden de ciclo de vida (`PEDIR`, `PEDIDO`, `COTIZAR`, `COTIZA.SOLICITUD`, `COTIZACION`, `COTIZA.APROBADA`, `COTIZA.RECHAZADA`, `RECIBIDO`, `RECIB.COMP.DIRECT`, `RECIBIDO 2`, `PEDIDO INCOMPLETO`, `SE COMPRA?`, `CANCELADOS`, `NO VENDEN`). Celdas compactadas sin texto entre paréntesis y con tooltip completo al pasar el mouse.
    - **Conciliación Ultracompacta y por Lote:** Columna `Conc.` reducida a ancho mínimo con círculo violeta (`🟣`), visualización de comprobante/auditor al clic y botón flotante rápido `🟣 Conciliar ({N})` en menú inferior para aplicar a todas las filas seleccionadas de una sola vez.
    - **Logística y Flete:** Icono de camión (`🚚`) en columna `Acciones` para registrar transporte/comisionista, fecha de solicitud (por defecto hoy, editable) y fecha de entrega estimada del flete con soporte de reversión (`Ctrl+Z`).
    - **Columna F. Entrega:** Nueva columna `F. Entrega` (`delivery_date`) visible en la tabla general entre `Doc` y `Conc.`, editable in-situ con calendario interactivo y desacoplada de las fechas del flete.
    - **Alerta "Sin Alta en Catálogo":** Resaltado en rojo (`text-rose-400 font-bold`) para pedidos donde se descartó el alta, evitando confusiones al intentar ingresarlos en Pañol, con soporte completo de deshacer vía `Ctrl+Z`.
    - **Calendarios Nativos:** Activación automática de `el.showPicker()` al hacer doble clic en celdas de fecha (`Fecha / Quincena` y `F. Entrega`).
    - **Cumplimiento Fit-to-Viewport:** Eliminación del desborde horizontal de la tabla y registro de la regla de ancho de pantalla en `ESTANDARES_MODULOS_UI_UX.md`.
    - **Radar de KPIs Compras:** 8 tarjetas de métricas con casillas compactas, tipografía 16px destacada para rápida localización visual, 8 colores distintos sin repetición y sin la palabra redundante "Filtrar".

- [x] **3. Módulo M4: Pañol Central & Materiales (`/panol`, `Panol.jsx` - Migraciones 0033 a 0036):**
  - **Planilla de Retiros Multi-Material:** Retiros multi-renglón agrupados por barco, contratista y OT, deduciendo automáticamente el Centro de Costo (`CLIENTE` vs `CONTRATISTA`) según la categoría del material.
  - **Cascada Canónica en Grilla y Modales:** `1° Barco ➔ 2° Contratista Habilitado ➔ 3° OT en Ejecución`. Al cambiar Barco en la grilla se limpia la OT (`work_order_id = null`) y se revalida si el contratista está habilitado en el nuevo barco; en la celda de OT solo se listan las OTs habilitadas para ese contratista, con opción canónica `(⚠️ Sin OT)`.
  - **Tooltip Enriquecido de OT:** Al pasar el cursor por la celda de OT se despliega la ficha descriptiva completa: Descripción técnica cargada en `work_items`, Jefe de Obra asignado, Buque y Estado; o `(⚠️ Sin OT)` en imputaciones directas.
  - **Acción "Editar Fila" (`<Edit3 />`):** Abre la ventana `REGISTRAR / MODIFICAR SALIDA DE PAÑOL` pre-cargada con los datos de la fila para realizar ajustes generales directos sobre el registro.
  - **Acción "Pedido Directo a Compras" con Selector de Urgencia:** Modal rápido que permite ingresar cantidad y seleccionar urgencia (`🟢 Sin Apuro`, `🟡 Urgente`, `🔴 Próx. Salida`), calculando automáticamente `fortnight_period` y registrando la orden en Compras con solicitante `PAÑOL` y estado `PEDIR`.
  - **Inserción de Fila 100% en Blanco al Final:** Inserción al pie de la tabla con todos los campos vacíos salvo la fecha actual (respaldada por la Migración 0036 que desacopla `NOT NULL` en `inventory_transactions`).
  - **Control de Tubos de Gases (P-01 / P-02):** Registro de Primera Entrega, Reposición / Cambio y Devolución Definitiva. Alerta P-01 para tubos retenidos >15 días y alerta P-02 para tubos vacíos acumulados en patio.
  - **Catálogo & Control de Stock Físico:** B.D. unificada de materiales con toggle `requires_stock_control`, columna de peso por unidad en kg con cálculo reactivo de peso total retirado, factor de seguridad naval editable solo por Admin con código cromático de 5 niveles (2%, 6%, 10%, 15%, 20%) y buscador inteligente `MaterialSearchInput`.
  - **Arquitectura de 5 Zonas y Hoja de Cálculo (useSpreadsheetGrid):** Layout canónico institucional con división visual clara en la cabecera entre el **Bloque Compras** (Acento Cian) y el **Bloque Pañol** (Acento Esmeralda), eliminando el óvalo redundante y reemplazándolo por el tag tipográfico naval `M4 · Logística Naval`.

- [ ] **4. Validación Operativa M3 y M4:** Prueba con supervisores en varadero/muelle cargando partes diarios reales.
- [ ] **2. Módulo M1: Barcos y Ficha Técnica Naval (`/barcos`):**
  - Ficha técnica naval de buques, historial de varadas y estados de puesta en seco.
  - Vinculación a propietarios y clientes.
- [x] **3.x. Diseño y Especificación Técnica: Submódulo de Control de Gases y Cilindros Prestados (Listo para Implementar):**
  - **Especificación Oficial:** Registrada en `docs/03_negocio/00_reglas_negocio.md` (Sección 8.9) y `docs/MATRIZ_RESPONSABILIDAD_DATOS.md` (Sección 3 Reglas P-01/P-02 y Sección 6).
  - **Proveedores Dinámicos de Compras (`suppliers`):** Integración no hardcodeada que alimenta a Pañol desde Compras. Altas iniciales: Air Liquide, Praxair Linde, Ferremat (emergencias) y Propios Astillero Alon Car.
  - **3 Operaciones de Envases en Submenú de Pañol:** `Primera Entrega` (+1 deuda contratista, -1 lleno pañol), `Recambio 1x1` (saldo neto contratista sin cambio, +1 vacío de marca A, -1 lleno de marca B) y `Devolución Final` (-1 deuda contratista, +1 vacío pañol).
  - **Dashboard del Pañolero Digital:** KPIs de vacíos por marca listos para reposición (evitando inspección física en patio), matriz de contratistas tipo Sheets con Sticky Headers y botón de reposición 1-clic.
  - **Circuitos Operativos y Contactos (Regla P-02):**
    - **Air Liquide:** Semanal. Pedido martes antes de las 12:00 hs al **0810-222-5272** (Nº Cliente **2234867**), entrega miércoles.
    - **Praxair Linde:** Quincenal (1 lunes c/15 días vía portal web o comercial), entrega martes.
    - **Ferremat:** A demanda ante emergencias o quiebres de stock.

- [x] **3. Módulo M4: Pañol, Materiales y Control de Gases (`Panol.jsx` + Migraciones 0033 y 0034):**
  - **Planilla de Retiros (Reemplazo Integral de GS-002 y GS-007):**
    - Renombrada la vista a **Planilla de Retiros** (depuración del término Kárdex) y eliminación definitiva de la columna ficticia `Vale / N°`.
    - **Insertar Fila en 1 Clic:** Botón y atajo operativo que inserta una nueva fila editable en la planilla, idéntico al comportamiento de Compras.
    - **Edición In-Situ con Doble Clic:** Modificación ágil en celda de `transaction_date` (con selector nativo `showPicker()`), `ship_id`, `work_order_id`, `quantity_withdrawn` (recalculando el peso acumulado en vivo), `cost_center` y `notes`. Guardado instantáneo en Supabase con `Enter` o `Blur`.
  - **Modal de Retiro Multi-Material (Carga Múltiple Atómica):**
    - **Cascada Canónica de 3 Pasos:** `1° Barco` $\rightarrow$ `2° Contratista / Grupo (workers.work_group: TANO, BOLTRI, IMPERPUR, ASTILLERO, etc.)` $\rightarrow$ `3° Orden de Trabajo (OT)`.
    - **Visualización Completa de la OT:** Exhibe el número y la descripción detallada del trabajo (`OT #123 - Reparación de casco en bodega`).
    - **Casilla de OT Vacía (Regla 0028):** Casilla `[ ] OT en blanco / pendiente` para imputar el retiro directamente al buque sin frenar la operativa del pañol.
    - **Match Riguroso de Operarios:** Al seleccionar un grupo (ej. `TANO`), el desplegable de operarios filtra únicamente a los trabajadores que pertenecen a ese grupo (`w.work_group === selectedGroup`) y que poseen el permiso `[P]` habilitado (`w.can_withdraw_materials === true`).
    - **Solicitud de Habilitación de Operarios:** Si una persona no figura en la lista autorizada, botón `[ ➕ ¿No aparece? Solicitar Habilitación a Jorge Sentis ]` que abre modal y envía una solicitud formal a `worker_permission_requests` con notificación directa al Administrador.
    - **Buscador Inteligente de Materiales (`MaterialSearchInput`):** Combobox con búsqueda in-situ mientras se escribe por nombre, rubro o categoría, mostrando foto miniatura, stock en tiempo real y unidad de medida.
    - **Deducción Automática de Centro de Costo:**
      - Materiales (`category === 'MATERIALES'`) $\rightarrow$ Imputación automática a `CLIENTE` (Obra del buque).
      - Consumibles / EPP (`CONSUMIBLES` / `ELEM.SEGURIDAD`) $\rightarrow$ Verifica la condición del operario (`worker.consumables === 'CONTRATISTA'`). Si el contratista se paga sus consumibles, imputa a `CONTRATISTA` (descontable en la liquidación quincenal); de lo contrario a `CLIENTE`.
      - Campo bloqueado en solo lectura para el pañolero, editable únicamente por el `Admin`.
    - **Carga de Múltiples Renglones Dinámicos:** Permite cargar 5 o más materiales distintos retirados en un mismo viaje (ej. Tano retira electrodos, discos, pintura y guantes) y guardarlos en una sola operación atómica.
  - **Catálogo Maestro B.D. MATERIALES & Stock Físico:**
    - **Diferenciación de Stock Físico:** Columna `requires_stock_control` y filtros de barra de herramientas `[ Todos ]` vs `[ 📦 Solo con Control de Stock ]` para separar materiales de compra eventual de insumos con inventario físico permanente.
    - **Peso del Material:** Columna `weight_kg` registrada en base de datos y visible en catálogo y planilla, computando automáticamente el tonelaje/kilos totales retirados en cada obra.
    - **Edición In-Situ en Catálogo:** Doble clic para editar nombre, peso en kg, stock mínimo y bandera de control de stock.
    - **Porcentaje de Seguridad Naval:** Insignias visuales con código de color rápido por nivel (2% gris, 6% esmeralda estándar, 10% ámbar, 15% naranja, 20% rosa), con edición restringida estrictamente a administradores.
    - **Integración con Compras:**
      - Botón individual `[ 🛒 Reponer ]` que navega a Compras precargando ID y nombre de material para evitar campos en blanco.
      - Selección múltiple de materiales mediante casillas de verificación y barra flotante `[ 🛒 Generar Pedido de Compra (N) ]` para solicitar reposición en lote.
  - **Submódulo Integral de Control de Gases y Tubos:**
    - Panel de stock en Patio clasificado por proveedor (Air Liquide, Praxair Linde, Ferremat, Astillero Propio) y estado (Llenos vs Vacíos).
    - Registro de las 3 operaciones canónicas: `Primera Entrega`, `Recambio 1x1 con Cruce de Marcas` y `Devolución Final`.
    - Matriz de deuda de tubos por contratista tipo Sheets y alertas de retención mayor a 15 días con generación de mensaje WhatsApp de reclamo (P-01/P-02).
  - **Rediseño Visual de 5 Zonas y Estándar Compras (Migración 0035 + useSpreadsheetGrid):**
    - Adopción integral de las clases maestras: `.alon-zone-context` (sky), `.alon-zone-kpis` (radar ámbar con 6 tarjetas y 6 colores distintivos sin repetir), `.alon-zone-toolbar` (cyan con atajo `Ctrl+F` y `Esc`) y `.alon-zone-grid` (emerald ribbon + thead sticky con columna 1 apilada `[ ]/#`).
    - **Edición In-Situ con Doble Clic en TODAS las Celdas:** Cobertura del 100% de celdas visibles con edición ágil (Fecha con `showPicker()`, Barco, OT, Material con datalist, Cantidad con recálculo de peso en vivo, Peso en kg, Contratista con datalist, Centro de Costo y Observaciones).
    - **Depuración de Campos:** Eliminada la columna y el dato redundante *"Retirado Por"*.
    - **Columna de Acciones Operativas:**
      - *Acción 1 (Borrar Fila):* Pinta toda la fila de rojo intenso (`bg-rose-950/60 line-through border-rose-500/60`), activa `is_deletion_requested` y dispara alerta al Administrador Jorge Sentis. Solo el Administrador puede confirmar la baja física definitiva (reintegrando stock al material) o restaurar la fila.
      - *Acción 2 (Pedido Directo a Compras):* Modal rápido para ingresar cantidad que crea la orden de compra en Compras con estado `PEDIR`, Destino `PAÑOL`, Buque `ASTILLERO / STOCK` y Solicitante `PAÑOL`.
      - *Acción 3 (Duplicar Fila):* Clona el retiro en 1 clic con fecha de hoy.

- [ ] **3.bis. Dashboards de Usuario y Terminales por Rol (En Cola de Ejecución):**
  - Implementar para cada puesto operativo un **Radar de Alertas Vivas (6-8 KPIs únicos)** + **Bandeja de Decisiones en 1 Clic**:
    - **Terminal Administrador (`/admin`):** Jorge Sentis (Autorizaciones [P] en Pañol, Bajas de Pañol, Homologación de Rubros, Desvíos Salariales >5%, Auditoría de Costo Directo).
    - **Terminal Dirección:** Hugo Sentis / Martín Sentis / Hugo Obregozo (Evaluaciones "SE COMPRA?", Anguilera en Varadero, Cierre Comercial de OTs).
    - **Terminal Jefe de Obra:** Ale Camadelli / Pablo N. / Martín Obregozo (Asignación de OT a consumos en blanco Regla 0028, Descargo de Horas en 'R', Planos de Buque).
    - **Terminal Compras / Logística:** Andrés (Cotizaciones pendientes, Reclamos WhatsApp por Pedidos Incompletos, Mandados locales en MDP).
    - **Terminal Pañol Central:** Pañolero (Quiebres de stock bajo mínimo, Retención de tubos >15d P-01, Retiro de vacíos P-02).
    - **Terminal Personal / Cuadrillas:** María José (Control de asistencia 9 hs/8 hs feriado, operarios sin jornada, vencimientos de libretas).

- [ ] **4. Módulo M5: Tarifarios y Liquidaciones:**
  - Matriz de tarifas por hora de personal propio vs. contratistas/talleres.
  - Anexos de facturación y resumen de costos por obra.
- [ ] **5. Sistema Multi-Tema (Theme Switcher — Última Prioridad / Post-Lanzamiento):**
  - Selector de temas visuales dinámicos con persistencia en preferencias de usuario (`localStorage` / Supabase profile).
  - Modos previstos:
    - **AlonCar Dark (Predeterminado):** Diseño corporativo naval actual (cian `#00F2FE` + azul abisal `#1E3A5F` + acentos naranja `#F97316`).
    - **Linux Desktop (Ubuntu / GNOME):** Barra de estado superior (Top Bar con reloj/notificaciones), dock lateral flotante con indicadores de punto y paleta grafito/naranja Yaru.
    - **Linux Terminal / TUI ("Modo Consola / Hacker"):** Modo de alta ingeniería con tipografía monoespaciada (*JetBrains Mono* / *Fira Code*), marcos de recuadro geométricos ASCII, badges `[OK]` y barras de progreso en texto sobre fondo negro puro (`#0A0E14`).
    - **Puente Naval (Radar / ECDIS):** Modo de alto contraste nocturno con azul marino ultra profundo y acentos verde sonar/ámbar.

---

### 🏛️ Plan de Desacoplamiento y Deuda Arquitectónica (Gobernado por SKL-017 / SKL-008)
> Diagnóstico completo y hoja de ruta sellada en `docs/02_producto/05_auditorias/LINEA_BASE_ARQUITECTURA.md`

- [x] **Ola 1: Sincronización y Quick Wins del Núcleo (~4.5 hs)**
  - [x] A-01: Inyectar `workers` dinámico en `allocationEngine.js`
  - [x] A-02: Unificar catálogo de rubros en `tradesCatalog.js`
  - [x] C-01: Unificar servicio de variables macroeconómicas con auditoría en `audit_logs`
  - [x] C-03: Conectar conteo real de horas en Dashboard central
- [x] **Ola 2: Trazabilidad, Seguridad y Control de Acceso (~4.5 hs - Parcial n8n postergado)**
  - [x] B-02: Auditoría obligatoria canónica en `Panol`, `Ships` y `Terceros` (mutaciones directas eliminadas)
  - [ ] D-02: Respaldar `workflow.json` reales de n8n en el repo (Postergado a próxima sesión por usuario)
  - [x] D-03: Proteger Edge Function Deno con verificación JWT de Supabase Auth
  - [x] D-04: Verificación empírica de aislamiento de credenciales (`service-account.json` ignorado en git)
- [x] **Ola 3: Desarticulación Quirúrgica de Monolitos (~15 hs) — 100% CUMPLIDA (7 de 7 monolitos transaccionales y 8 de 8 páginas críticas reducidas a < 250L)**
  - [x] B-01.1: Modularizar `Compras.jsx` (Reducido de 9.076L a 242L, subpaneles en `components/compras/`, modales y `comprasConstants.js`)
  - [x] B-01.2 & B-04: Modularizar `Personal.jsx` (Reducido de 6.186L a 152L, 3 subpaneles en `components/personal/`, eliminación total de fallback `initialPersonnel.json`)
  - [x] B-01.3: Modularizar `LaborLogs.jsx` (Reducido de 6.111L a 200L, subpaneles `LaborCargaPanel`, `LaborControlDiarioPanel`, `LaborSabanaPanel` en `components/labor/`, `LaborModals.jsx` y `laborConstants.js`)
  - [x] C-02: Culminar extracción de `AdminDashboard.jsx` (Reducido de 3.034L a 231L, 4 subpaneles en `components/admin/`)
  - [x] B-01.4 (Parte 1 - Ships): Modularizar `Ships.jsx` (Reducido de 5.048L a 202L, subpaneles `ShipsBarcosPanel`, `ShipsEstadiasPanel`, `ShipsArmadoresPanel` en `components/ships/`, `ShipsModals.jsx` y `shipsConstants.js`)
  - [x] B-01.4 (Parte 2 - Panol): Modularizar `Panol.jsx` (Reducido de 4.922L a 219L, subpaneles `PanolHeader`, `PanolAlertasPanel`, `PanolToolbar`, `PanolMovimientosPanel`, `PanolStockPanel` en `components/panol/`, `PanolModals.jsx`, `panolConstants.js` y `panolService.js`)
  - [x] B-01.4 (Parte 3 - WorkOrders): Modularizar `WorkOrders.jsx` (Reducido de 5.614L a 238L, subcomponentes `WorkOrdersHeader`, `WorkOrdersKpiRadar`, `WorkOrdersToolbar`, `WorkOrdersUnificadoPanel`, `WorkOrdersOtsPanel`, `WorkOrdersTercerosPanel`, `WorkOrdersModals.jsx` en `components/workOrders/`, `workOrdersConstants.js` y `workOrdersService.js`)
  - [x] B-01.4 (Parte 4 - Terceros): Modularizar `Terceros.jsx` (Reducido de 3.825L a 246L, subcomponentes `TercerosHeader`, `TercerosKpiRadar`, `TercerosToolbar`, `TercerosFilasPanel`, `TercerosFichasPanel`, `TercerosModals.jsx` en `components/terceros/`, `tercerosConstants.js` y `tercerosService.js`)
- [x] **Ola 4: Capa de Servicios y Clean Architecture (~6 hs) — 100% CUMPLIDA**
  - [x] A-03 (Sub-Ola 4.1): Modularizar motor de IA `aiLaborEngine.js` (Reducido de 1.120L a 214L, prompts extraídos a `aiPrompts.js` y formateadores puros a `aiTextFormatters.js`)
  - [x] A-04 (Sub-Ola 4.2): Modularizar `useSpreadsheetGrid.js` en sub-hooks (Reducido de 1.255L a 162L, sub-hooks extraídos a `hooks/grid/`: `useGridHistory`, `useGridSelection`, `useGridClipboard`, `useGridNavigation`)
  - [x] B-03 / D-01 (Sub-Ola 4.3): Crear capa formal `app/src/services/` (`personalService.js`, `comprasService.js`, `laborService.js`, `shipsService.js`, `index.js`) con fachada unificada y auditoría obligatoria

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

### ✓ HECHO — 3.6 Módulo M3: Costos de Terceros y Talleres Externos (`Terceros.jsx`, GS-005)
- **Ruta Dedicada y Navegación:** `/terceros` integrada en `App.jsx`, `Sidebar.jsx` (icono Wrench) y enlace directo desde `/ots`.
- **Catálogo de Contratistas y Permisos:** 251 proveedores únicos del catálogo oficial cargados en `public.workers` con `can_charge_third_party = true`, `can_withdraw_materials = false` y `can_impute_hours = false`.
- **Contratistas Polirrubro ("MANUAL"):** Detección interactiva de contratistas con rubro MANUAL (Alon Car SA, Atlántica Gas, etc.) con selector obligatorio de entre 24 rubros oficiales sin inventar nombres.
- **Ciclo de Comprobantes DEC-017:** Soporte y badges para PRC (Planta), RMO (Taller), RPF (Remito pendiente de factura con alerta visual urgente), FCR (Factura oficial definitiva) y SDT (Sin documentación). Modal de evolución rápida a FCR/SDT con trazabilidad inmutable en `public.third_party_voucher_history`.
- **Dólar Congelado por Fecha de Carga a Mano:** Búsqueda automática en `macro_variables` por quincena (`dollar_rate_1q` / `dollar_rate_2q`) y cálculo automático en US$.
- **Control de Permisos de Montos:** Edición de importes reservada exclusivamente a María José y Jorge Sentis (Admin). Para otros roles, campos bloqueados con candado 🔒.
- **Auditoría Técnica y Vistas Universales:** `[☷ Vista Filas]` y `[⊞ Vista Fichas]`, KPIs clickeables como filtros instantáneos y conformidad técnica (`CONFORME` / `OBSERVADO`) para Jefes de Obra.
- **Datos Iniciales:** 10 registros históricos representativos sembrados en `public.third_party_services`.
- **Documentación:** Creado `DEC-021` y actualizado `manual_de_usuario_aloncar.md`.

📝 Cómo Actualizar Este Archivo
Cuando cierres una tarea:
markdown- [x] **HECHO** — Descripción
Cuando cambies una prioridad:
markdown- [ ] **AHORA CRÍTICA** — Descripción (era Media)
Responsable: Tú + Antigravity (colaborativo)

Última actualización: 2026-10-29
Siguiente revisión: Al iniciar Módulo M4 Pañol / Materiales


### ✓ HECHO — 3.7 Interacción Estilo Google Sheets / Excel & Desacople OT Nullable (DEC-018)
- **Desacople Operativo (Migración 0028):**
  - Incorporada columna `ship_id` en `labor_logs` e `inventory_transactions`.
  - Eliminada restricción `NOT NULL` en `work_order_id` en `labor_logs`, `third_party_services`, `purchase_orders` e `inventory_transactions`.
  - Creados índices parciales `WHERE work_order_id IS NULL` para monitoreo de imputaciones huérfanas en tiempo real.
- **Componente Modal Compacto `ShipWorkOrderPickerModal`:**
  - Selector unificado en 1 solo modal para `Barco / OT` en doble clic de celda.
  - Limpieza automática de OT al cambiar de barco y opción explícita de dejar OT en blanco sumando a KPI.
- **Hook Universal `useSpreadsheetGrid`:**
  - Soporte de `Ctrl+C`, `Ctrl+V`, `Ctrl+D` (Fill Down), `Ctrl+Z` (Undo con memoria de 50 pasos) y `Ctrl+Y` / `Ctrl+Shift+Z` (Redo).
  - Navegación con teclado (Flechas), selección activa y tirador de arrastre (Fill Handle `■`) con doble clic de autorrelleno.
- **Estandarización Visual de 4 Zonas:**
  - Zona 1: Contexto / Rol con acento cian.
  - Zona 2: Radar Operativo de Alertas en Vivo con colores semánticos (Ámbar, Rojo, Púrpura, Verde).
  - Zona 3: Barra de Búsqueda con permanente `[Ctrl + F]` y atajos de teclado.
  - Zona 4: Cuadrícula interactiva con cabecera congelada y barra flotante de totales con botones Deshacer/Rehacer.
- **Módulos Actualizados y Verificados:**
  - **Terceros (`Terceros.jsx`):** 4 KPIs Radar (Falta OT, Sin Costo $0, RPF, FCR) + celdas interactivas + picker modal.
  - **Horas (`LaborLogs.jsx`):** 5 KPIs Radar (Falta OT, R, RR, Jornada Incompleta, Sin PRC) + imputación OT nullable + picker modal.
  - **Compras (`Compras.jsx`):** KPI Agrupado Falta Cargar OT (Total + Obras / Stock) + doble clic buque/OT + picker modal.
  - **Personal y Tarifas (`Personal.jsx`):** Edición rápida por doble clic en Padrón y Tarifario histórico.
  - **Barcos y Obras (`Ships.jsx`):** Indicador visual en vivo de imputaciones huérfanas sin OT (`⚠️ X sin OT`).
  - **Órdenes de Trabajo (`WorkOrders.jsx`):** Edición rápida por doble clic de trabajos en Planilla Unificada.

### ✓ HECHO — 3.8 Unificación de Instrucciones Maestras (GEMINI.md v1.2 y CLAUDE.md)
- **Centralización en GEMINI.md (v1.2):**
  - Fusionado el protocolo de gobernanza operativa, candado mecánico de 4 fases y diccionario de contratos de Supabase con las reglas de sesión, seguridad, commits, skills transversales (`SKL-007` a `SKL-011`) y estándares de n8n.
  - Consolidada la regla rectora de clasificación "Gallo o Gallina" y el kit canónico (`useSpreadsheetGrid`, `KpiRadar`, `CrawlerSearchBar`, etc.).
- **Puntero de compatibilidad en CLAUDE.md:**
  - `CLAUDE.md` actualizado para apuntar directamente a `@GEMINI.md` garantizando retrocompatibilidad sin duplicación ni divergencia de reglas.
- **Fecha de corte:** 2026-11-06.

### ✓ HECHO — 3.9 Gobernanza y Nuevas Skills Transversales (SKL-012 a SKL-016)
- **Arquitectura de Inyección en 3 Capas:**
  - Definidas e indexadas en `.agents/skills/transversal/`, `.agents/skills/SKILLS_REGISTRY.md` (v1.1) y `GEMINI.md` (v1.3).
  - Inyección global de configuración en `%USERPROFILE%\.gemini\config\skills.json`.
- **Nuevas Skills Incorporadas:**
  - **`SKL-012` (`ergonomia-flujo-visual-senior`):** Cascada Top-Down, compresión dimensional, Fitts, accesos rápidos y regla universal de Iconografía Auto-explicativa con Tooltips semánticos.
  - **`SKL-013` (`data-grid-poweruser`):** Navegación direccional por teclado, mutación in-situ, selección matricial y reversibilidad con Ctrl+Z.
  - **`SKL-014` (`schema-gatekeeper`):** Freno cognitivo pre-flight anti-memoria; verificación empírica obligatoria de tablas y columnas Supabase.
  - **`SKL-015` (`defensive-erp-contracts`):** Tolerancia cero a fallas silenciosas, transaccionalidad atómica y auditoría obligatoria.
  - **`SKL-016` (`context-aware-skill-router`):** Enrutador automático de skills por globs y criticidad de la tarea.
- **Reparación y Verificación de Auditoría:**
  - Exportado y verificado `auditService.logEvent` contra tabla `audit_logs` en Supabase con comprobación live de registro real.

### ✓ HECHO — 3.10 Tarifario Quincenal — Ergonomía, Alineación y Foco Visual (Personal.jsx)
- **Selector de Centro Independiente (Imagen 3):**
  - Separado el contenedor común `inline-flex` en dos botones autónomos con `gap-3`: `Personal del Astillero (5 Categorías)` (borde cian) y `Contratistas` (borde ámbar).
- **Alineación de Cotas Horizontales Nivel 2 (Imagen 1):**
  - Searchable select de quincenas, botón `Nueva Quincena` (eliminado duplicado "+ +") y tarjeta de valor Dólar Quincenal nivelados a cota vertical exacta (`h-[42px]` y etiqueta espaciadora superior).
- **Grilla de 5 Categorías en Fila Continua:**
  - Actualizado layout a `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3` permitiendo que las 5 categorías oficiales de Astillero (`Ayudante`, `Oficial`, `1/2 Oficial`, `Aprendiz`, `Oficial Black`) se desplieguen alineadas en una sola fila sin saltos.
- **Iconografía Auto-explicativa (Imagen 2):**
  - Incorporados tooltips claros en todos los símbolos de candado `🔒` (`title="Período cerrado: Tarifa histórica inmutable para resguardar costos pasados. No implica bloqueo al personal"`), descartando falsas interpretaciones disciplinarias sobre el personal.
- **Enfoque de Cámara en Edición:**
  - Botón `[ ✎ Editar ]` de la grilla histórica actualizado con desplazamiento suave (`tarifarioFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })`) y halo animado cian (`ring-2 ring-cyan-400`) para orientar de inmediato la mirada del usuario.
- **Fecha de corte:** 2026-11-06.


## Sesion 2026-11-10 - Chroma-Chunking en modales, Hotfix Horas y Crawler Omnicanal

[x] Modales OrderFormModal y SupplierModal (Compras), NewMaterialModal (Panol) y Puestos (Admin) con .alon-modal-card + .alon-chunk-* + footer fijo
[x] Reparación de crash crítico en LaborLogs.jsx: corrección de ReferenceError stats por hoursStats en GridStatusBarBottom y normalización de kpiFilter
[x] Estándar 03 — Despliegue Universal del Crawler Omnicanal y HighlightText Canónico en Todos los Módulos del ERP:
    - Componente canónico app/src/components/HighlightText.jsx con soporte multi-término y estilo visual amarillo unificado.
    - searchEngine.js con polimorfismo de corpus (admite string precalculado u objeto) e indexación automática profunda de adjuntos (PDF, JPG, URLs, OCR y opciones de buque/OT/rubro).
    - Terceros.jsx: corrección del buscador omnicanal (resolución de 0 filas), corrección de casing en clearAllFilters ('todos') e integración de HighlightText en todas las columnas de la grilla.
    - Etapa 1 (Personal & Tarifas): Personal.jsx con HighlightText unificado en Padrón de Operarios y Tarifario Quincenal histórico.
    - Etapa 2 (Horas & Imputaciones): LaborLogs.jsx con crawler omnicanal y resaltado amarillo en tabla de imputaciones (carga), control diario de nómina y sábana quincenal tipo Sheets (con buscador de operarios dedicado).
    - Etapa 3 (OTs & Barcos): WorkOrders.jsx (planilla unificada, vista de OTs y terceros vinculados) y Ships.jsx (buques, movimientos/estadías y armadores) con crawler profundo y resaltado en todas las columnas.
    - Etapa 4 (Pañol & Admin): Panol.jsx (movimientos de stock, kardex, tubos de gas y retenciones), AdminAuditLedger.jsx (Libro de Auditoría de audit_logs con búsqueda sobre detalles y cambios) y TradesManagementPanel.jsx (Rubros oficiales y operarios asignados).
    - Verificación completa: vite build limpio (3.05s) + tests runtime contra Supabase con datos en caliente (workers, rate_cards, ships, work_orders, owners, audit_logs, organization_roles).
[x] Estandarización Canónica de Grilla Poweruser, Columna 0 y Menú Clic Derecho en Todos los Módulos del ERP (5 Etapas):
    - **Etapa 1: Barcos y Obras (`Ships.jsx` — Commit `2016889`):** Implementada Columna 0 Canónica (`[ ] / #`) apilada en Buques, Movimientos/Estadías y Armadores; selección libre de filas, resaltado corporativo `bg-cyan-950/30`, botón `#` interactivo y vinculación con `GridStatusBarBottom` para acciones masivas.
    - **Etapa 2: Terceros (`Terceros.jsx` — Commit `7a247e0`):** Columna 0 canónica apilada (`[ ] / #`), menú contextual con `customActions` de negocio (Evolución a Factura FCR/SDT, Trazabilidad, Edición) y duplicación nativa de comprobantes con auditoría en `audit_logs`.
    - **Etapa 3: Pañol y Materiales (`Panol.jsx` — Commit `c2c46c8`):** Integración de `useSpreadsheetGrid` en Catálogo de Materiales y Stock, Columna 0 apilada, navegación matricial por teclado, menú contextual con duplicación de materiales (stock inicial 0), y corrección del visor de métricas en `GridStatusBarBottom`.
    - **Etapa 4: Compras Proveedores (`Compras.jsx` — Commit `c5cd9f1`):** Padrón de Proveedores elevado al estándar canónico con `suppliersGrid`, cinta operativa `GridRibbon` (coordenadas, Deshacer/Rehacer, exportación), Columna 0 apilada, menú contextual con duplicar proveedor, y barra de estado flotante `GridStatusBarBottom`.
    - **Etapa 5: Panel Administrador (`AdminDashboard.jsx`, `TradesManagementPanel.jsx`, `AdminAuditLedger.jsx` — Commit `e146c98`):** Columna 0 ordinal en Historial Mensual Macro, Columna 0 apilada en Quincenas y Cierre, Columna 0 con selección múltiple en Rubros, y botón interactivo `#{N}` en Libro de Auditoría que abre el Modal de Inspección Técnica con visualizador de payload JSON y copia en 1 clic.
[ ] Verificar NewMaterialModal con datos reales: tabla materials devolvio 0 filas en la prueba runtime
