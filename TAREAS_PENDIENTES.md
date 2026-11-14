# 📋 Tareas Pendientes — App_AlonCar

Lista de trabajo activa priorizada por fase y criticidad.
> **Histórico rotado:** Las secciones `✓ HECHO` y tareas `[x]` anteriores viven en [docs/archivo/TAREAS_COMPLETADAS_2026-11.md](docs/archivo/TAREAS_COMPLETADAS_2026-11.md). Este archivo conserva únicamente pendientes activos `[ ]` y los últimos `5` ítems `[x]` recientes.

---

## 📌 Pendientes Operativos, QA y Módulos Acordados

- [ ] **Validación QA Autenticada en Navegador — Pañol/Gases (`0038`–`0040`) y Resumen Gerencial (`GS-004`):**
  - Verificar en UI autenticada los flujos completos de Pañol (alta `[P]` a Jorge Sentis, edición de gases, devolución final y trazabilidad de gaseras), y en `GS-004` las cifras completas de Horas, Materiales y flujo visual de los `3` submódulos y `3` hojas (la prueba Node con clave `anon` sin sesión devolvió `labor_logs = 0` y `materials = 0`).
- [ ] **Validación QA Visual Autenticada en `/personal`:** Confirmar en navegador con usuario autenticado (`<ProtectedRoute>`) que la vista ocupe todo el ancho disponible sin bandas laterales y que `Acciones` se visualice sin recorte horizontal.
- [ ] **Puerta General de Desorden de Materiales, Recuperados, Devueltos y Controles de Stock (`/panol`):**
  - Diseñar puerta única centralizada para registrar recuperaciones, devoluciones no estándar y conciliaciones de inventario físico/roturas, manteniendo separadas las adquisiciones comerciales en **Compras** y el patio de envases de **Gases**.
- [ ] **Módulo Futuro de Dependientes / Vacaciones (Personal Astillero):**
  - **Reglas base acordadas:** `1 MES` = **1 día** de vacaciones; `3 MESES` = **4 días** de vacaciones; `6 MESES` = **9 días** de vacaciones; `PERMANENTE` = fórmula a definir por Dirección según **antigüedad** acumulada desde `workers.contract_start_date`.
- [ ] **Automatización de Pañol (Extracción de Materiales Cobrables a Contratistas):**
  - **Recordatorio n8n / Pañol:** Al diseñar las automatizaciones del módulo Pañol, reutilizar `app/src/lib/workCostRules.js` y `contractorDeductionsService.js` para extraer automáticamente materiales, consumibles (`%`) y EPP cobrables al contratista alimentando directamente a Tesorería (`/tesoreria`).
- [ ] **Expansión del Módulo Tesorería (`/tesoreria` — Rol Graciela `TESORERIA`):**
  - Primera herramienta ya implementada: Extracción quincenal filtrada de Consumibles y Elementos de Seguridad cobrables a contratistas (respetando zona gris).
  - **Próximas herramientas a desarrollar para Graciela:** Tablero de liquidación y pagos quincenales, gestión de adelantos a personal/contratistas y conciliación financiera de Terceros.
- [ ] **Migración SQL `0037_workers_contracts_and_safety_cleanup.sql`:** Ejecutar el `ALTER TABLE public.workers ADD COLUMN contract_type / contract_start_date` en el SQL Editor de Supabase para persistir tipo de contrato y fecha de inicio (los valores `safety_items` y `data_requirements` ya fueron aplicados en vivo).
- [ ] **0. Rediseño Visual y Experiencia de Usuario (UX) del Dashboard del Administrador (`/admin`):**
  - **Estado:** Pendiente de revisión por Dirección / Usuario.
  - **Detalle:** Revisar la presentación visual del Circuito Operativo Inter-Departamental y la Ficha de Puestos/Vinculaciones para mejorar ergonomía visual, reducir sobrecarga de datos y presentar funciones y vinculaciones de forma más ejecutiva e intuitiva.
- [ ] **4. Validación Operativa M3 y M4:** Prueba con supervisores en varadero/muelle cargando partes diarios reales.
- [ ] **2. Módulo M1: Barcos y Ficha Técnica Naval (`/barcos`):**
  - Ficha técnica naval de buques, historial de varadas y estados de puesta en seco. Vinculación a propietarios y clientes.
- [ ] **3.bis. Dashboards de Usuario y Terminales por Rol (En Cola de Ejecución):**
  - Radar de Alertas Vivas (6-8 KPIs únicos) + Bandeja de Decisiones en 1 Clic por puesto: **Admin** (Jorge Sentis), **Dirección** (Hugo/Martín Sentis, Hugo Obregozo), **Jefe de Obra** (Ale Camadelli, Pablo N., Martín Obregozo), **Compras/Logística** (Andrés), **Pañol Central** (Pañolero) y **Personal/Cuadrillas** (María José).
- [ ] **4. Módulo M5: Tarifarios y Liquidaciones:**
  - Matriz de tarifas por hora de personal propio vs. contratistas/talleres; anexos de facturación y resumen de costos por obra.
- [ ] **5. Sistema Multi-Tema (Theme Switcher — Última Prioridad / Post-Lanzamiento):**
  - Selector de temas dinámicos (`localStorage` / Supabase profile): AlonCar Dark, Linux Desktop (Ubuntu/GNOME), Linux Terminal/TUI y Puente Naval (Radar/ECDIS).

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
5. [ ] Iniciar diseño de Módulo de Activos y Clientes
6. [ ] Esquema base de datos
7. [ ] Resto de módulos
8. [ ] Flujos de datos completos
[ ] Verificar NewMaterialModal con datos reales: tabla materials devolvio 0 filas en la prueba runtime

---

## ✅ Últimos 5 Ítems Completados Recientemente

- [x] **Personal y Tarifas (`/personal`) — Restauración de Ancho Completo (`w-full`) y Visibilidad de Columna `Acciones` (`ERR-005`):**
  - Eliminado `max-w-7xl mx-auto` en `app/src/pages/Personal.jsx` (`w-full`) y compactados paddings horizontales (`px-2`/`px-1.5` + `whitespace-nowrap` en `Acciones`) en `app/src/components/personal/PersonalNominaPanel.jsx`.
- [x] **Pañol Multi-Material, Cascada Naval, Gases (`Recambio +0`) y Trazabilidad de Gaseras (`DEC-023` · Migraciones `0038`–`0040` aplicadas):**
  - `MaterialAutocompleteInput.jsx`, `(⚠️ Sin OT)` destildado por defecto, cascada `Barco ➔ Contratista ➔ OT`, solicitud `[P]` (`0038`), doble imputación de Gases (`0039`), `RECAMBIO_1X1 = +0`, `GasFinalReturnModal.jsx`, gestión de gaseras aislada (`0040`) y `GasTraceabilityGrid.jsx`.
- [x] **Resumen Gerencial (`GS-004` / `/resumen-gerencial`, `/comparador` redirige) — Inclusión de Línea de Referencia EPP (`ELEM.SEGURIDAD`) y Módulo Completo (`DEC-022`):**
  - Implementado en `ResumenGerencial.jsx` (`1. Resumen de Obra & Costos` + `RESUMEN 2` + `3` hojas de solo lectura, `2. Comparador de Obras Canvas`, `3. Remito Comercial & Tarifario Nivel Alfa`). `ELEM. SEGURIDAD (REF. ASTILLERO)` visible sin sumarse nunca al `TOTAL US$` cobrable (`workCostRules.js`).
[x] Estandarización Canónica de Grilla Poweruser, Columna 0 y Menú Clic Derecho en Todos los Módulos del ERP (5 Etapas — `Ships` `2016889`, `Terceros` `7a247e0`, `Panol` `c2c46c8`, `Compras` `c5cd9f1`, `AdminDashboard` `e146c98`).
[x] Estándar 03 — Despliegue Universal del Crawler Omnicanal y `HighlightText.jsx` Canónico en Todos los Módulos del ERP (`searchEngine.js`, Terceros, Personal, Horas, OTs, Barcos, Pañol, Admin).

---

📝 Cómo Actualizar Este Archivo
Cuando cierres una tarea:
markdown- [x] **HECHO** — Descripción
Cuando cambies una prioridad:
markdown- [ ] **AHORA CRÍTICA** — Descripción (era Media)
Responsable: Tú + Antigravity (colaborativo) · Última rotación: 2026-11-13 (Etapa E3)
