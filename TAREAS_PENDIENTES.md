# 📋 Tareas Pendientes — App_AlonCar

Lista de trabajo activa priorizada por fase y criticidad.
> **Histórico rotado:** Las secciones `✓ HECHO` y tareas `[x]` anteriores viven en [docs/archivo/TAREAS_COMPLETADAS_2026-11.md](docs/archivo/TAREAS_COMPLETADAS_2026-11.md). Este archivo conserva únicamente pendientes activos `[ ]` y los últimos `5` ítems `[x]` recientes.

---

## 📌 Pendientes Operativos y Módulos Futuros Acordados

- [ ] **Atajos de Vistas de Filtro Guardadas en Dashboard por Usuario (`/`):**
  - **Estado:** Pendiente de definición visual/UX por el usuario (cinta de atajos arriba vs. tarjetas por módulo vs. gaveta con detalle).
  - **Base técnica:** Consumirá `filterViewsService.js` / `system_settings` (`user_saved_filter_views`, máx. 5 vistas por usuario y módulo) para abrir en 1 clic cualquier módulo con la vista favorita aplicada.
- [ ] **Puerta General de Desorden de Materiales, Recuperados, Devueltos y Controles de Stock (`/panol`):**
  - Diseñar puerta única centralizada para registrar recuperaciones, devoluciones no estándar y conciliaciones de inventario físico/roturas, manteniendo separadas las adquisiciones comerciales en **Compras** y el patio de envases de **Gases**.
- [ ] **Módulo Futuro de Dependientes / Vacaciones (Personal Astillero):**
  - **Reglas base acordadas:** `1 MES` = **1 día** de vacaciones; `3 MESES` = **4 días** de vacaciones; `6 MESES` = **9 días** de vacaciones; `PERMANENTE` = fórmula a definir por Dirección según **antigüedad** acumulada desde `workers.contract_start_date` (columna ya creada en Supabase por `0037`).
- [ ] **Automatización de Pañol (Extracción de Materiales Cobrables a Contratistas):**
  - **Recordatorio n8n / Pañol:** Al diseñar las automatizaciones del módulo Pañol, reutilizar `app/src/lib/workCostRules.js` y `contractorDeductionsService.js` para extraer automáticamente materiales, consumibles (`%`) y EPP cobrables al contratista alimentando directamente a Tesorería (`/tesoreria`).
- [ ] **Expansión del Módulo Tesorería (`/tesoreria` — Rol Graciela `TESORERIA`):**
  - Primera herramienta ya implementada: Extracción quincenal filtrada de Consumibles y Elementos de Seguridad cobrables a contratistas (respetando zona gris).
  - **Próximas herramientas a desarrollar para Graciela:** Tablero de liquidación y pagos quincenales, gestión de adelantos a personal/contratistas y conciliación financiera de Terceros.
- [ ] **0. Rediseño Visual y Experiencia de Usuario (UX) del Dashboard del Administrador (`/admin`):**
  - **Estado:** Pendiente de revisión por Dirección / Usuario.
  - **Detalle:** Revisar la presentación visual del Circuito Operativo Inter-Departamental y la Ficha de Puestos/Vinculaciones para mejorar ergonomía visual, reducir sobrecarga de datos y presentar funciones y vinculaciones de forma más ejecutiva e intuitiva.
- [ ] **4. Validación Operativa M3 y M4:** Prueba con supervisores en varadero/muelle cargando partes diarios reales.
- [ ] **3.bis. Dashboards de Usuario y Terminales por Rol (En Cola de Ejecución):**
  - Radar de Alertas Vivas (6-8 KPIs únicos) + Bandeja de Decisiones en 1 Clic por puesto: **Admin** (Jorge Sentis), **Dirección** (Hugo/Martín Sentis, Hugo Obregozo), **Jefe de Obra** (Ale Camadelli, Pablo N., Martín Obregozo), **Compras/Logística** (Andrés), **Pañol Central** (Pañolero) y **Personal/Cuadrillas** (María José).
- [ ] **4. Módulo M5: Tarifarios y Liquidaciones:**
  - Matriz de tarifas por hora de personal propio vs. contratistas/talleres; anexos de facturación y resumen de costos por obra.
- [ ] **5. Sistema Multi-Tema (Theme Switcher — Última Prioridad / Post-Lanzamiento):**
  - Selector de temas dinámicos (`localStorage` / Supabase profile): AlonCar Dark, Linux Desktop (Ubuntu/GNOME), Linux Terminal/TUI y Puente Naval (Radar/ECDIS).
- [ ] **Mejoras menores QA detectadas (`2026-11-17`):**
  - Dedup de key React `Alanis, Carlos` en el dropdown `Contratistas` de `PanolMaterialsPanel.jsx`.
  - Habilitar `Esc` para cerrar el modal `Ficha / Cierre` en `/ots` y evaluar `sticky right-0` para la columna `Acciones` de `/personal` en pantallas `< 1600px`.

---

## ⚙️ Pendientes n8n, Arquitectura y Negocio

  - [ ] D-02: Respaldar `workflow.json` reales de n8n en el repo (Postergado a próxima sesión por usuario)
  - [ ] D-02: Respaldar `workflow.json` reales de n8n en el repo (Postergado a próxima sesión por usuario — registro duplicado en origen, conservado para paridad exacta de conteo E3)
- [ ] Diagnosticar "R en todas las filas"
  - Prioridad: Crítica — traer mensaje simple (2-3 líneas) y output de E4 (`tareas` con `needs_review` y `motivo_revision`).
- [ ] Definir regla de negocio: bifurcación OT con adicionales
  - Prioridad: Alta — decidir si "trabajo base + adicional de la misma OT" va en fila separada, OT distinta o campo extra.
- [ ] Ajustar mensaje de respuesta (E9a - PrepararRespuesta)
  - Prioridad: Media — revisar texto, formato y datos mostrados al emisor.
- [ ] Prompt: agregar CONTRATISTA HINT en Caso 5 (Set - PromptConfig)
  - Prioridad: Media — extracción de `contratista_hint` desde "para [nombre]" y few-shot MSG5.
- [ ] **PENDIENTE — 1.6 Refinamiento y Ordenamiento del Mensaje al Usuario WhatsApp (`E9a - PrepararRespuesta`)**
  - Archivo/Lugar: Workflow n8n (`E9a - PrepararRespuesta`) / `PRO-003-alertas-humanizadas-e9a.md` — Prioridad: Alta.
- [ ] **Relevamiento de personal y tareas:** Carga de lista de personal, procesamiento de actividades, construcción de Matriz RACI y perfiles laborales de puesto ([proyecto_perfil_puesto_y_matriz_responsabilidades.md](docs/03_negocio/proyecto_perfil_puesto_y_matriz_responsabilidades.md)).

### Otros ítems heredados sin viñeta `-`
[ ] Instalar y configurar database-optimizer (Trigger: modelo relacional en Supabase — `agency-agents/engineering/engineering-database-optimizer.md`)
[ ] Instalar y configurar Graphify (pip install graphifyy) (Trigger: codebase real Python/JS con módulos y dependencias)
[ ] Instalar y configurar minimal-change-engineer (Trigger: bug puntual en producción — `agency-agents/engineering/engineering-minimal-change-engineer.md`)
[ ] Verificar NewMaterialModal con datos reales (catálogo `materials` ya devuelve 13 filas en vivo; validar alta completa)

---

## ✅ Últimos 5 Ítems Completados Recientemente

- [x] **Migración SQL `0037` aplicada en vivo en Supabase (`2026-11-17`):** Agregadas columnas `workers.contract_type` y `workers.contract_start_date`, saneado `safety_items` y actualizado `REQ_PERSONAL_CONTRATO_POR_VENCER`. Eliminados los HTTP `400` en `/` Dashboard.
- [x] **Validación QA Autenticada en Navegador (`2026-11-17`):** Verificados en vivo `/` Dashboard (`0` HTTP 400), `/panol` (4 pestañas), `/resumen-gerencial` (4 pestañas con cifras reales) y `/personal` (`w-full` confirmado; `Acciones` visible en `1920px` y accesible por scroll horizontal en `<=1440px`).
- [x] **Fix `/barcos` (`ShipsBarcosPanel.jsx`) y `/ots` (`WorkOrdersHeader.jsx`) (`0d0debb`, `2026-11-16`):** Importado `X` faltante de `lucide-react` (corrige pantalla en blanco en `/barcos`) y ajustado wrap responsive en Zona 1 de `/ots`.
- [x] **Unificación OTs, FKs relacionales, Horas Columna F y Estandarización Cromática Zona 3 (`cc7a908`..`1154d80`, `2026-11-16`):** Migraciones `0041`–`0047`, `workerIdentity.js`, reloj facial CSV y `filterThemeConstants.js`.
- [x] **Personal y Tarifas (`/personal`) — Restauración de Ancho Completo (`w-full`) (`ERR-005`):** Eliminado `max-w-7xl mx-auto` en `Personal.jsx` y compactados paddings en `PersonalNominaPanel.jsx`.

---

## 🔄 Protocolo Oficina ↔ Casa (Acción Correctiva Anti-Desfasaje)
1. **Al iniciar en cualquier PC (Oficina o Casa):** correr `git pull` antes de leer o editar; verificar `TAREAS_PENDIENTES.md`.
2. **Migraciones SQL:** toda migración nueva en `supabase/migrations/` **debe aplicarse en vivo en Supabase en el mismo turno** (`supabase_mcp` `apply_migration`) y verificarse con `execute_sql` — nunca dejarla solo como archivo `.sql` en disco.
3. **Al cerrar sesión / push:** correr `npm.cmd run check:hygiene`, actualizar el delta en `TAREAS_PENDIENTES.md` y hacer `commit` + `push` explícito para que la otra PC arranque sincronizada.

📝 Cómo Actualizar Este Archivo
Cuando cierres una tarea: `- [x] **HECHO** — Descripción` (conservar solo últimos 5 `[x]`).
Responsable: Tú + Antigravity (colaborativo) · Última actualización: 2026-11-17
