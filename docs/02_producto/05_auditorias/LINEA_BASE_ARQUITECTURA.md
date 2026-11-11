# 🗺️ Diagnóstico Maestro de Arquitectura y Modularidad (Línea Base) — AlonCar ERP

> **Documento Vivo gobernado por SKL-017 (Modo 1: Auditoría Cero por Cuadrantes)**  
> **Última actualización:** 2026-11-10  
> **Estado global de salud:** 🟡 AUDITORÍA CERO COMPLETADA (4/4 CUADRANTES) — PLAN DE REFACTORIZACIÓN MODULAR PENDIENTE  

---

## 1. Resumen Ejecutivo y Cartografía de Alto Nivel

### Cartografía Global del Repositorio
* **Frontend:** Single Page Application (React 18 + Vite + TailwindCSS). Total: **~48.000 líneas de código**.
* **BaaS / Persistencia:** Supabase (PostgreSQL 15 + RLS + 36 migraciones cronológicas + Edge Functions en Deno).
* **Integraciones y Automatizaciones:** n8n (workflows documentados bajo estándar SDD) y MCP Server local para análisis de Google Sheets.
* **Gobernanza:** Meta-protocolo `GEMINI.md`, kit canónico de 5 Zonas y 17 skills transversales.

### Balance de Deuda Técnica por Cuadrante
| Cuadrante | Superficie Auditada | Líneas Analizadas | Estado de Salud | Hallazgos Pendientes vs Resueltos |
| :--- | :--- | :---: | :---: | :---: |
| **A. Núcleo y Contratos** | `lib/` (10) + `hooks/` (2) | 3.078 | 🟢 CONTROLADO | 🟢 `A-01`, `A-02` resueltos. Pendiente: `A-03` (Monolito IA), `A-04` |
| **B. Transaccional (Gallo)** | 7 planillas operativas | 38.984 | 🟡 MEJORANDO | 🟢 `B-02` (auditService canónico), `B-01.1` (`Compras.jsx` modularizado de 9.076L a 242L), `B-01.2` (`Personal.jsx` modularizado de 6.186L a 152L), `B-01.3` (`LaborLogs.jsx` modularizado de 6.111L a 200L), `B-01.4` parte 1 (`Ships.jsx` modularizado de 5.048L a 202L), `B-04` (eliminación de fallback local) resueltos. Pendiente: `B-01` residual (`Panol`, `WorkOrders`, `Terceros`), `B-03` |
| **C. Analítico (Gallina)** | 6 módulos / tableros | 5.920 | 🟢 CONTROLADO | 🟢 `C-01`, `C-02` (`AdminDashboard.jsx` modularizado de 3.034L a 231L), `C-03` resueltos. |
| **D. Backend e Infra** | Migraciones, Edge Fn, MCP, n8n | 36 SQLs + Deno | 🟢 ACEPTABLE | 🟢 `D-03` (JWT OpenAI), `D-04` resueltos. Pendiente: `D-01`, `D-02` (n8n JSONs) |
| **TOTAL SISTEMA** | **Repositorio Completo** | **~48.000** | 🟢 **OLAS 1, 2 Y SUB-OLAS 3.1, 3.2, 3.3 & 3.4 COMPLETADAS** | **12 Hallazgos Resueltos de 14** |

---

## 2. Cuadrante A: Núcleo y Contratos Compartidos
- **Superficie de inspección:** `app/src/lib/` (10 módulos), `app/src/hooks/` (2 hooks globales).
- **Métricas globales del Cuadrante:**
  * Total de líneas de código del núcleo: **3.078 líneas**.
  * Archivos críticos monolíticos (> 1.000 líneas): 2 (`useSpreadsheetGrid.js` con 1.108 líneas, `aiLaborEngine.js` con 1.185 líneas).
  * Estado general: 🟡 **OPERATIVO CON DEUDA ARQUITECTÓNICA ALTA EN DESACOPLAMIENTO**

### Matriz de Deuda Técnica — Cuadrante A
| ID | Severidad | Módulo / Archivo | Métrica violada (LCOM/CBO/Rot) | Riesgo Operativo | Acción Recomendada (SKL-008) | Estado |
| :---: | :---: | :--- | :--- | :--- | :--- | :---: |
| **A-01** | **CRÍTICA** | `app/src/lib/allocationEngine.js` (L13-40) | **P2 (Single Source of Truth) & CBO** | Inconsistencia de datos: define `NOMINA_ASTILLERO_BASE` hardcodeada. Si se da de alta un operario en Supabase `workers`, este motor no se entera y bloquea permisos de pañol/horas. | Inyectar catálogo dinámico desde Supabase (`tradesCatalog.js`) y relegar el array estático solo a fallback offline. | 🟢 RESUELTO (Ola 1) |
| **A-02** | **ALTA** | `app/src/lib/tradesCatalog.js` vs `app/src/lib/aiLaborEngine.js` | **P1 / P2 (Catálogos duplicados)** | Ambigüedad en jergas y rubros: `CANONICAL_BASE_TRADES` (22 rubros) diverge de `OFFICIAL_RUBROS_CATALOG` (15 rubros). Ambas librerías mapean el mismo negocio con listas distintas. | Unificar en `tradesCatalog.js` como única fuente de verdad e importar desde allí en el motor de IA. | 🟢 RESUELTO (Ola 1) |
| **A-03** | **ALTA** | `app/src/lib/aiLaborEngine.js` (1.185 líneas) | **LCOM (Baja cohesión) & P3 (Monolito)** | Fragilidad de prompts: mezcla más de 400 líneas de templates de prompts GPT-4o-mini (DEC-004/007) con lógica de parsing, normalización de strings y queries a BD. | Extraer prompts a `aiPrompts.js` y normalizadores puros a `textFormatters.js`. | 🟡 PENDIENTE |
| **A-04** | **MEDIA** | `app/src/hooks/useSpreadsheetGrid.js` (1.108 líneas) | **LCOM (God Hook) & Blast Radius Crítico** | Riesgo de regresión en todo el ERP: reúne navegación de teclado, 2D matrix paste, fill-handle, Undo/Redo y logging en 1 solo hook gigante. | Planificar extracción modular en sub-hooks (`useGridSelection`, `useGridClipboard`, `useGridHistory`) sin alterar la interfaz pública. | 🟡 PENDIENTE |
| **A-05** | **LEVE** | `app/src/lib/pdfTextExtractor.js` (41 líneas) | **Optimizador de Chunks Vite** | Advertencia en build: `pdf.worker.min.mjs` pesa 1.2 MB. Puede optimizarse con dynamic import si impacta el tiempo de carga inicial. | Evaluación en optimización de bundle. | 🟢 ACEPTABLE |

### Diagnóstico Cartográfico del Núcleo
1. **Puntos Fuertes:** `monotonicFolioEngine.js`, `gridRowActions.js`, `useGridContextMenu.js` y `auditService.js` están perfectamente desacoplados, con funciones puras y contratos inmutables blindados contra `[object Object]`.
2. **Puntos de Fricción Severa:** La duplicación de operarios y rubros entre `allocationEngine.js`, `tradesCatalog.js` y `aiLaborEngine.js` rompe el principio de fuente única de verdad.
3. **Blast Radius del Núcleo:** Cualquier cambio a `useSpreadsheetGrid.js` o `auditService.js` tiene Blast Radius **Existencial** (impacta al 100% de las planillas del ERP). Requiere tests previos estrictos.

---

## 3. Cuadrante B: Módulos Transaccionales (`CARGA_EDICION` / Gallo)
- **Superficie de inspección:** 7 planillas operativas (`Compras.jsx`, `Personal.jsx`, `LaborLogs.jsx`, `Panol.jsx`, `Ships.jsx`, `WorkOrders.jsx`, `Terceros.jsx`).
- **Métricas globales del Cuadrante:**
  * Total de líneas de código transaccional: **38.984 líneas**.
  * Promedio de líneas por página: **~5.500 líneas**.
  * Página más voluminosa: `Compras.jsx` (**9.076 líneas / 438 KB**).
  * Estado general: 🔴 **CRÍTICO EN COHESIÓN Y ACOPLAMIENTO (MONOLITOS DE VISTA / GOD PAGES)**

### Matriz de Deuda Técnica — Cuadrante B
| ID | Severidad | Módulo / Archivo | Métrica violada (LCOM/CBO/Rot) | Riesgo Operativo | Acción Recomendada (SKL-008) | Estado |
| :---: | :---: | :--- | :--- | :--- | :--- | :---: |
| **B-01** | **CRÍTICA** | Las 7 páginas transaccionales (`Compras`, `Personal`, `LaborLogs`, `Ships`, `Panol`, `WorkOrders`, `Terceros`) | **LCOM (God Pages) & P3 (Límite 300L violado 30x)** | **Efecto Dominó en Mantenimiento:** Cada archivo alberga 3 a 4 submódulos completos en un solo bloque JSX con miles de líneas de estado compartido. Tocar una pestaña arriesga romper las demás por colisión de variables y re-renderizados. | Descomponer cada pestaña en un componente autónomo en `app/src/components/[modulo]/`, reduciendo la página orquestadora a `< 250` líneas. `Personal.jsx` modularizado a 152L (Sub-Ola 3.2). `Compras.jsx` modularizado de 9.076L a 242L (Sub-Ola 3.3). `LaborLogs.jsx` modularizado de 6.111L a 200L (Sub-Ola 3.4). `Ships.jsx` modularizado de 5.048L a 202L con `ShipsBarcosPanel`, `ShipsEstadiasPanel`, `ShipsArmadoresPanel` y `ShipsModals` (Sub-Ola 3.5). `Panol.jsx` modularizado de 4.922L a 219L con `PanolHeader`, `PanolAlertasPanel`, `PanolToolbar`, `PanolMovimientosPanel`, `PanolStockPanel`, `PanolModals`, `panolConstants.js` y `panolService.js` (Sub-Ola 3.6). `WorkOrders.jsx` modularizado de 5.614L a 238L con `WorkOrdersHeader`, `WorkOrdersKpiRadar`, `WorkOrdersToolbar`, `WorkOrdersUnificadoPanel`, `WorkOrdersOtsPanel`, `WorkOrdersTercerosPanel`, `WorkOrdersModalsContainer`, `workOrdersConstants.js` y `workOrdersService.js` (Sub-Ola 3.7). `Terceros.jsx` modularizado de 3.825L a 246L con `TercerosHeader`, `TercerosKpiRadar`, `TercerosToolbar`, `TercerosFilasPanel`, `TercerosFichasPanel`, `TercerosModalsContainer`, `tercerosConstants.js` y `tercerosService.js` (Sub-Ola 3.8). | 🟢 CUMPLIDO (7 de 7 monolitos transaccionales y 8 de 8 páginas críticas desarticulados a < 250L) |
| **B-02** | **ALTA** | `Panol.jsx`, `Ships.jsx`, `Terceros.jsx` | **Pecado IA #5 (Bypass de Trazabilidad) & P1** | **Fuga de Auditoría Contable:** En `Panol` y `Ships` se muta Supabase directamente sin llamar a `auditService`. En `Terceros` se inserta en `audit_logs` con `supabase.insert()` manual en vez de usar `auditService.logCellChange`, arriesgando serializar `[object Object]`. | Estandarizar todas las mutaciones a través de los métodos canónicos de `auditService.js`. | 🟢 RESUELTO (Ola 2) |
| **B-03** | **ALTA** | Todas las páginas transaccionales | **CBO (Fuga de Capas / Domain Leaks) & P1** | **Acoplamiento Directo Vista-BD:** La UI ejecuta llamadas crudas `supabase.from().select/update/insert/delete` dentro de callbacks de eventos JSX. Si una columna cambia en BD, hay que intervenir archivos de miles de líneas en vez de un servicio. | Extraer las operaciones CRUD a capas de servicio en `app/src/services/` o `app/src/lib/`. | 🟡 PENDIENTE |
| **B-04** | **MEDIA** | `Personal.jsx` (L66-83) | **P2 (Doble Fuente de Verdad)** | **Datos Fantasma Desincronizados:** Importaba `initialPersonnel.json` y mapeaba `INITIAL_WORKERS_LOCAL` cuando Supabase no respondía o estaba vacío, bifurcando la verdad respecto a la tabla real `workers`. | Fallback estático `initialPersonnel.json` eliminado completamente. `workers` en Supabase es la única fuente de verdad con asignación monotónica de folios. | 🟢 RESUELTO (Sub-Ola 3.2) |
| **B-05** | **BUENA PRÁCTICA** | Todas las planillas | **SKL-013 (Data Grid) & Ergonomía** | **Consistencia de Kit Canónico:** Se respeta la navegación con `useSpreadsheetGrid`, la columna 0 canónica `[ ]/#`, las 5 Zonas visuales y el blindaje `onBlur={() => saveInline()}`. | Mantener estándar. | 🟢 CUMPLIDO |

### Diagnóstico Cartográfico del Cuadrante B
1. **El Gran Síntoma:** Las pantallas no sufren de fallas de sintaxis ni de bugs visuales inmediatos (todo compila y corre), sino del clásico **"Monolitismo por IA"**: cada vez que se agregó una función o pestaña, la IA la pegó dentro del mismo archivo `.jsx` para evitar crear nuevos archivos.
2. **Blast Radius Transaccional:** Cada página tiene un Blast Radius **Sistémico Interno**: modificar el pegado masivo en `Compras` requiere navegar un archivo de 9.076 líneas donde coexisten OCR, proveedores y órdenes de compra.
3. **Prioridad Quirúrgica:** La desarticulación de estos monolitos debe ejecutarse pestaña por pestaña utilizando la estrategia en 4 pasos de `SKL-009 P9` y planificada con `SKL-008`.

---

## 4. Cuadrante C: Módulos Analíticos (`METRICAS_ANALISIS` / Gallina)
- **Superficie de inspección:** `AdminDashboard.jsx` (3.039 líneas), `Dashboard.jsx` (456 líneas), `AdminAuditLedger.jsx` (600 líneas), `AiGovernancePanel.jsx` (372 líneas), `TradesManagementPanel.jsx` (716 líneas), `ComprasSettingsPanel.jsx` (737 líneas).
- **Métricas globales del Cuadrante:**
  * Total de líneas de código analítico: **5.920 líneas**.
  * Cumplimiento del Padrón 2.B: 8 de 9 herramientas activas declaradas con sus tablas de origen.
  * Estado general: 🟡 **OPERATIVO CON DEUDA MEDIA EN MONOLITOS RESIDUALES Y MUTACIONES DUPLICADAS**

### Matriz de Deuda Técnica — Cuadrante C
| ID | Severidad | Módulo / Archivo | Métrica violada (LCOM/CBO/Rot) | Riesgo Operativo | Acción Recomendada (SKL-008) | Estado |
| :---: | :---: | :--- | :--- | :--- | :--- | :---: |
| **C-01** | **CRÍTICA** | `Dashboard.jsx` (L110-133) vs `AdminDashboard.jsx` (L720-732) | **P1 / P2 (Lógica Duplicada) & Pecado #5 (Bypass Trazabilidad)** | **Impacto Salarial sin Auditoría:** Ambas páginas duplican de forma independiente el guardado de variables macro (dólar e inflación) y la sincronización en cascada sobre `rate_cards`. Ninguna de las dos llama a `auditService`, permitiendo cambiar el tarifario quincenal sin dejar rastro en `audit_logs`. | Unificar la lógica en `macroVariablesService.js` con registro obligatorio en `auditService.logCellChange`, reutilizando el mismo modal/formulario. | 🟢 RESUELTO (Ola 1) |
| **C-02** | **ALTA** | `AdminDashboard.jsx` (L1304-2839) | **LCOM (Cohesión Incompleta) & P3 (Monolito residual)** | **Refactor Inconcluso:** 4 pestañas fueron extraídas a componentes (`ia`, `compras`, `rubros`, `auditoria`), pero las pestañas `matriz`, `macro` y `alertas` siguen embebidas en el archivo sumando más de 1.800 líneas de JSX y estados locales. | Descompuesto en 4 subpaneles autónomos en `app/src/components/admin/` (`AdminRolesMatrixPanel`, `AdminMacroPanel`, `AdminAlertsCompliancePanel`, `AdminLiveKpiRadar`). `AdminDashboard.jsx` reducido de 3.034 líneas a 231 líneas (< 250L). | 🟢 RESUELTO (Sub-Ola 3.1) |
| **C-03** | **MEDIA** | `Dashboard.jsx` (L65) | **P5 (Código Explícito) & Falso Valor** | **Métrica Fantasma:** La tarjeta de horas del Dashboard ejecutivo reporta siempre `0` (`hoursCount: 0` hardcodeado) en lugar de consultar el recuento real contra `daily_labor_logs`. | Reemplazar el `0` por `supabase.from('daily_labor_logs').select('id', { count: 'exact', head: true })`. | 🟢 RESUELTO (Ola 1) |
| **C-04** | **BUENA PRÁCTICA** | `AdminAuditLedger.jsx`, `TradesManagementPanel.jsx` | **SKL-009 (Arquitectura Gallina Limpia)** | **Rendimiento y Desacoplamiento:** Uso ejemplar de `useMemo` para filtros y agregaciones en caliente, y consumo estricto de servicios (`auditService`, `tradesCatalog`). | Mantener estándar. | 🟢 CUMPLIDO |

### Diagnóstico Cartográfico del Cuadrante C
1. **La Esquizofrenia de AdminDashboard:** El módulo es un híbrido entre Gallina (análisis/auditoría) y Gallo (edición de roles, macro variables y catálogos). El proceso de modularización iniciado anteriormente dejó la mitad del archivo limpia y la otra mitad como un monolito de 1.800 líneas.
2. **Blast Radius de las Variables Macroeconómicas:** Las variables de dólar e inflación son el corazón de la conversión AR$/USD en Compras, Horas y Tarifarios. Duplicar su persistencia sin trazabilidad es una vulnerabilidad operativa que debe subsanarse con prioridad alta.

---

## 5. Cuadrante D: Backend, Infraestructura y Flujos
- **Superficie de inspección:** Supabase (`supabase/migrations/` con 36 archivos SQL), Edge Functions Deno (`supabase/functions/parse-crew-message`), servidor MCP (`mcp-server/index.js`), workflows n8n (`workflows/operaciones/` con 2 SDDs) y seguridad de credenciales.
- **Métricas globales del Cuadrante:**
  * Total de migraciones aplicadas: **36 migraciones SQL cronológicas**.
  * Cobertura de SDD en n8n: 100% de los workflows activos cuentan con especificación profunda.
  * Estado general: 🟢 **SALUDABLE CON RIESGOS PUNTUALES EN BACKUPS DE FLUJOS Y CAPA SERVICE**

### Matriz de Deuda Técnica — Cuadrante D
| ID | Severidad | Módulo / Archivo | Métrica violada (LCOM/CBO/Rot) | Riesgo Operativo | Acción Recomendada (SKL-008) | Estado |
| :---: | :---: | :--- | :--- | :--- | :--- | :---: |
| **D-01** | **ALTA** | Arquitectura general del sistema | **SKL-011 (Ausencia de Capa de Servicio / BFF)** | **Dependencia Extrema de RLS en Cliente:** El sistema no posee un backend Node/Express (`server/`); el frontend conecta directo a Supabase. Si bien es válido para BaaS, la lógica de negocio y cascadas transaccionales corren en el browser. | Crear una capa intermedia de servicios puros en `app/src/services/` para desacoplar las vistas de Supabase. | 🟡 PENDIENTE |
| **D-02** | **ALTA** | `workflows/operaciones/*/workflow.json` | **Gobernanza n8n (GEMINI.md 5.1)** | **Disaster Recovery Comprometido:** Los flujos figuran como `activo` en `INDEX.md` con un `SDD.md` excelente, pero los archivos `workflow.json` en disco son placeholders vacíos (`{}`). Si se corrompe n8n, no hay backup para reimportar. | Exportar y guardar los JSONs reales de los workflows en producción dentro de sus carpetas. | 🟡 PENDIENTE |
| **D-03** | **MEDIA** | `supabase/functions/parse-crew-message/index.ts` | **Pentagonal (Seguridad & Rate Limiting)** | **Exposición Potencial de Tokens:** La Edge Function Deno procesa OpenAI con `gpt-4o-mini`. En su documentación indicaba `--no-verify-jwt`. Si no valida token de sesión, cualquier invocación no autorizada podría gastar créditos. | Forzar verificación JWT estricta de sesión de Supabase (`auth.getUser()`). | 🟢 RESUELTO (Ola 2) |
| **D-04** | **LEVE / PREVENTIVA** | `service-account.json` (Raíz del proyecto) | **GEMINI.md 1.3 (Credenciales)** | **Riesgo Latente de Exposición:** Contiene clave privada RSA real de GCP. Está correctamente ignorado por `.gitignore`, pero residir en la raíz expone a un eventual `git add -f` accidental. | Verificado: `.gitignore` activo (`!! service-account.json`), 0 commits en git log y documentado en `docs/01_infraestructura/03_seguridad_credenciales.md`. | 🟢 RESUELTO (Ola 2) |
| **D-05** | **BUENA PRÁCTICA** | `supabase/migrations/` (36 archivos) | **Persistencia Ordenada** | **Evolución DDL Impecable:** Las 36 migraciones son incrementales, versionadas cronológicamente, con claves foráneas e integridad referencial sólida. | Mantener estándar. | 🟢 CUMPLIDO |

### Diagnóstico Cartográfico del Cuadrante D
1. **Solidez de Base de Datos:** La arquitectura de datos en Supabase es el pilar más maduro y robusto del proyecto: 36 migraciones limpias, esquemas bien normalizados y RLS consistente.
2. **Brecha en Workflows:** La documentación en `SDD.md` es de clase mundial (35KB - 63KB por workflow), pero la sincronización de los archivos ejecutables `workflow.json` está pendiente.
3. **Brecha de Backend:** Dado que no se cuenta con un servidor dedicado Node/Express (`SKL-010`/`SKL-011`), el proyecto opera como una JAMstack / BaaS pura. Toda la robustez de contratos recae en el frontend y en Supabase.
