---
version: 1.3
last_updated_by: antigravity
last_updated: 2026-11-06
source_of_truth: GEMINI.md
---

# 🧭 PROTOCOLO DE GOBERNANZA ARQUITECTÓNICA Y OPERATIVA UNIFICADO — ALONCAR ERP

Como IA asistente del proyecto AlonCar ERP, este documento es tu **CENTRO DE DECISIONES Y FUENTE ÚNICA DE VERDAD**. Gobierna tanto a Antigravity como a Claude Code y cualquier otro agente en este repositorio. Debes ejecutarlo y respetarlo en **CADA TURNO** antes de proponer soluciones o invocar herramientas de edición.

---

## 1. PROTOCOLO DE SESIÓN, REGLA DE ORO Y SEGURIDAD

### 1.1 Inicio de sesión obligatorio
1. Ejecutar `git pull` antes de cualquier tarea.
2. Verificar que la versión en el frontmatter coincide con la última en `main`.
3. Si hay diferencia, frenar y resolver antes de continuar.
4. Reportar el estado de planillas en `INDICE_PLANILLAS.md` y de workflows en `workflows/_meta/INDEX.md` si aplica a la sesión.

### 1.2 Regla de oro de disco
- **Prohibido crear o modificar archivos en disco de forma unilateral.**
- Toda propuesta de archivo nuevo o cambio de código/arquitectura se muestra primero en el chat (o artefacto) y espera la **aprobación explícita** del usuario antes de tocar el sistema de archivos.

### 1.3 Seguridad y credenciales
- **Nunca credenciales, tokens o API keys en texto plano** en ningún archivo del repo.
- Usar placeholders (ej. `TU_API_KEY_AQUI`) en ejemplos y documentación.
- Ver política detallada en `docs/01_infraestructura/03_seguridad_credenciales.md`.

---

## 2. CENTRO DE DECISIONES: ENRUTADOR DE ENTRADA Y CANDADO MECÁNICO

Antes de ejecutar cualquier herramienta en un turno, el meta-protocolo **`SKL-016` (`context-aware-skill-router`)** clasifica el pedido en esta matriz y activa las skills correspondientes:

| Tipo de pedido del usuario | Skill obligatoria que gobierna | Primer Tool Call permitido | Condición para dar por terminado |
| :--- | :--- | :--- | :--- |
| **Cualquier cambio a datos, tablas, columnas o entidades** | **`SKL-014`** (`schema-gatekeeper`) | `read_file` / `run_command` (Fase 1) | Cero asunciones de memoria; citar esquema verificado en la respuesta. |
| **2+ tareas o cambio que toca varias capas** | `SKL-008` (`planificacion-por-etapas`) | `read_file` / `run_command` (Inspección) | Presentar tabla de etapas (*Fast-Track* si es misma pantalla/capa; *Freno por Riesgo* si cruza capas). |
| **Diseño o refactorización de UI, formularios y flujos** | **`SKL-012`** (`ergonomia-flujo-visual-senior`) | `read_file` (Inspección visual) | Cumplimiento del Test del Vector Único, Top-Down estricto y compresión dimensional. |
| **Planillas editables, grillas y tablas operativas** | **`SKL-013`** (`data-grid-poweruser`) | `read_file` (Inspección de grid) | Navegación direccional por teclado, mutación in-situ y uso del motor canónico. |
| **Crear, editar o conectar código / datos / persistencia** | `SKL-009` (`ingenieria-codigo-senior`) + **`SKL-015`** (`defensive-erp-contracts`) + `SKL-007` | `run_command` / `read_file` (**PROHIBIDO** empezar con `write_file`/`edit_file`) | Test de runtime real con datos `> 0` + `npm run build` + Reporte de Calidad y Trazabilidad. |
| **Auditar, revisar u ordenar un módulo** | `SKL-009` (Modo Auditoría) | `read_file` / medición real del código | Entregar matriz de Diagnóstico Técnico Senior ordenada por severidad (sin tocar código hasta autorización). |
| **Nuevo módulo o pantalla desde cero** | Sección 4 de este documento + `SKL-009` | **NINGUNO** si no tiene clasificación | Detenerse y preguntar si es `CARGA_EDICION` (Gallo) o `METRICAS_ANALISIS` (Gallina). |
| **Infraestructura Docker / Backend Node+PG** | `SKL-010` (`chasis-docker-multiapp`) + `SKL-011` (`motor-backend-capas`) | `read_file` de las skills `SKL-010` y `SKL-011` | Aislamiento por `${APP_SLUG}`, 4 capas estrictas (`Route → Controller → Service → Repo`) y `env.js` fail-fast. |

### 🔒 PIPELINE MECÁNICO INVIOLABLE (4 FASES PARA TODO CAMBIO DE CÓDIGO O DATOS)

1. **FASE 1 — INSPECCIÓN EMPÍRICA (Tool Call #1 obligatorio):**
   - **Prohibido invocar `write_file` o `edit_file` como primer paso.**
   - Si el cambio toca una tabla de Supabase, verificar primero sus columnas reales (en la Sección 3 de este archivo o ejecutando `select('*').limit(1)`).
   - Si el cambio se relaciona con algo que ya existe en otra planilla (ej. rubros, categorías, grupos, barcos, OTs), **leer primero cómo lo obtiene esa planilla** para reutilizar la misma fuente de datos.
2. **FASE 2 — INTERVENCIÓN QUIRÚRGICA Y MODULAR (`SKL-009`):**
   - Usar únicamente las columnas y props reales verificadas en la Fase 1 (`SKL-009 P4`).
   - **Prohibido duplicar catálogos o lógica:** si dos pantallas usan los mismos datos o reglas, extraerlos a un módulo exportable único en `app/src/lib/` para que ambas consuman la misma fuente de verdad (`SKL-009 P1 y P2`).
   - **Prohibido seguir inflando monolitos:** todo subpanel, modal nuevo o motor de más de 150 líneas se crea como archivo modular en `app/src/components/` o `app/src/lib/` (`SKL-009 P3`).
3. **FASE 3 — VERIFICACIÓN DE RUNTIME REAL (`SKL-007`):**
   - **Terminantemente prohibido** dar una tarea por cumplida usando solo `content.includes` sobre el archivo `.jsx` o confiando solo en `npm run build`.
   - Ejecutar una prueba real en Node contra Supabase / módulo exportado comprobando que `error === null` y que devuelve los registros reales esperados (`data.length > 0`). Si devuelve `0` o error, **parar la línea y corregir antes de responder**.
4. **FASE 4 — REPORTE CON TRAZABILIDAD Y EVIDENCIA:**
   - Toda entrega cierra obligatoriamente con el bloque **Trazabilidad de Cumplimiento Mecánico** y la tabla **Control de calidad — Entrega (`SKL-007`)**.

---

## 3. DICCIONARIO DE CONTRATOS REALES DE SUPABASE (PROHIBIDO ADIVINAR COLUMNAS)

Antes de escribir cualquier `.from('<tabla>')`, respeta sus claves primarias y nombres de columna reales:

| Tabla en Supabase | Clave Primaria (PK) | Columnas reales verificadas | Trampas prohibidas (NO existen) |
| :--- | :--- | :--- | :--- |
| **`workers`** | `id` (uuid) | `name` (nombre completo), `category`, `trade` (rubro/oficio), `hourly_rate_ars`, `hourly_rate_usd`, `work_group`, `admin_center` (`ASTILLERO` \| `CONTRATISTA` \| `TALLER`), `status` (`ACTIVO` \| `INACTIVO`), `phone`, `dni`, `consumables`, `consumables_discount_pct`, `safety_elements`, `can_withdraw_materials`, `can_impute_hours`, `can_charge_third_party`, `is_foreman` | ❌ No existen `first_name` ni `last_name` (usar `name`). |
| **`system_settings`** | `key` (text) | `key`, `value` (jsonb), `updated_at`, `updated_by` (hacer `upsert` con `{ onConflict: 'key' }`) | ❌ No existe columna `id`. No existe tabla `app_settings`. |
| **`organization_roles`** | `role_key` (text) | `role_key`, `role_title`, `holder_name`, `department` | ❌ No existe columna `id`. |
| **`rate_cards`** | `id` | `period`, `year`, `month`, `quincena`, `admin_center`, `entity_name`, `rate_oficial_ars`, `rate_oficial_usd`, `has_ayudante`, `rate_ayudante_ars`, `rate_ayudante_usd`, `dollar_rate` | — |
| **`ships`** | `id` | Datos maestros de buques y estadías | — |
| **`work_orders`** | `id` | `ship_id`, `ot_number`, `description`, `contractors`, `foreman_name`, `work_type`, `status` | — |
| **`audit_logs`** | `id` (uuid) | `action`, `entity_type`, `entity_id`, `entity_name`, `details` (jsonb), `performed_by`, `created_at` | ❌ No existe `entity` ni `table_name` (usar `entity_type`). |

> **Regla Pre-Flight Anti-Memoria (Inviolable):** Queda terminantemente prohibido enumerar módulos, pestañas o tablas de memoria. Antes de responder o diseñar cambios transversales, es obligatorio leer `docs/02_producto/estandares/00_INDICE_DE_MODULOS_Y_CLASIFICACION.md` (Secciones 2.A Gallo y 2.B Gallina) e `INDICE_PLANILLAS.md`. Para cualquier tabla o columna que no figure arriba, es **obligatorio** correr `select('*').limit(1)` en la Fase 1 antes de escribir código.

---

## 4. ESTÁNDARES DE MÓDULOS ERP: CLASIFICACIÓN "GALLO O GALLINA" Y KIT CANÓNICO

### 4.1 Regla de Bloqueo Absoluto e Indexación para Nuevos Módulos, Submódulos o Herramientas
1. **PROHIBICIÓN TOTAL DE PROGRAMAR SIN CLASIFICACIÓN:**  
   Si el usuario solicita crear un nuevo módulo, submódulo o herramienta de análisis sin indicar explícitamente su clasificación, la IA tiene **TERMINANTEMENTE PROHIBIDO** escribir código JSX o crear archivos.
2. **PREGUNTA OBLIGATORIA INMEDIATA:**  
   La IA debe detenerse de inmediato y formular la siguiente pregunta:  
   > *"¿A qué clasificación pertenece el nuevo componente: `CARGA_EDICION` (Gallo - con vínculo obligatorio a `audit_logs`) o `METRICAS_ANALISIS` (Gallina - indexado con sus tablas de origen)?"*
3. **REGISTRO E INDEXACIÓN EN EL PADRÓN OFICIAL:**  
   Una vez declarada la clasificación por el usuario, el módulo, submódulo o herramienta de visualización debe registrarse en `docs/02_producto/estandares/00_INDICE_DE_MODULOS_Y_CLASIFICACION.md` (Sección 2.A para Gallo o Sección 2.B para Gallina, especificando sus tablas de Supabase) para servir de referencia al usuario, al agente IA y al futuro Asistente de IA integrado en la App.

### 4.2 Arquetipo A: `CARGA_EDICION` (Transaccional / "Gallo")
* **Definición:** Cualquier pantalla o pestaña donde el usuario agregue, modifique celdas, duplique, borre o cargue registros (*Órdenes de Trabajo, Catálogo de Trabajos, Personal, Tarifario Quincenal, Carga de Horas, Compras, Proveedores, Pañol, Catálogo de Materiales, Gases, EPP, Barcos, Estadías, Armadores, Terceros, Talleres, Rubros Admin*).
* **Documentos obligatorios:** Consultar `docs/02_producto/estandares/00_INDICE_DE_MODULOS_Y_CLASIFICACION.md` al `07_ESTANDAR_TRAZABILIDAD_Y_AUDITORIA.md` y la referencia indiscutible en `app/src/pages/Compras.jsx`.
* **Prohibición de Tablas Estándar:** Queda terminantemente prohibido crear pantallas con `<table>` estándar o estilos aislados. Toda planilla debe usar obligatoriamente el hook `useSpreadsheetGrid` (`app/src/hooks/useSpreadsheetGrid.js`).
* **Kit canónico heredado (prohibido duplicar en páginas):**
  1. `useSpreadsheetGrid.js` ➔ Motor global de hoja de cálculo: navegación direccional (`Enter`, `Shift+Enter`, `Tab`, `Shift+Tab`, flechas), selección espacial de celdas/rangos, selección canónica de filas (`selectedRowIds`, `toggleSelectRow`, `toggleSelectAll`), algoritmo "Paste Matrix" 2D con sanitización de tipos, Fill-handle (`■`), borrado (`Supr`/`Backspace`) y Deshacer/Rehacer multinivel de 50 pasos (`Ctrl+Z`/`Ctrl+Y`).
  2. `Columna 0 Canónica (#)` ➔ Ancho fijo `w-8`/`w-10`: en `thead` checkbox maestro apilado sobre `#`; en `tbody` checkbox individual + botón `#` interactivo con resaltado corporativo `bg-cyan-950/30` al seleccionarse.
  3. `GridContextMenu.jsx` ➔ Menú contextual canónico al clic derecho (`onContextMenu`) en toda celda o fila: Copiar celda/fila, Pegar (Ctrl+V), Insertar arriba/abajo, Duplicar, Limpiar (Supr) y visor modal de historial de cambios en vivo desde `audit_logs`.
  4. `auditService.js` (`app/src/lib/auditService.js`) ➔ **Vínculo Obligatorio de Trazabilidad:** Toda edición in-situ (`logCellChange`), pegado masivo (`logBatchPaste`), alta o baja de fila (`logRowAction`) en cualquier submódulo `CARGA_EDICION` debe registrar su evento en `audit_logs` con blindaje anti-objeto (`typeof val === 'object'`).
  5. `KpiRadar.jsx` ➔ **Zona 2:** Radar de tarjetas con bordes y fondos cromáticos únicos por tarjeta (nunca bordes grises inactivos) y filtro por clic. Prohibido usar la palabra "Filtrar".
  6. `CrawlerSearchBar.jsx` + `searchEngine.js` ➔ **Zona 3:** Buscador omnicanal con atajos `Ctrl+F` y `Esc`.
  7. `GridRibbon.jsx` ➔ **Zona 4:** Cinta con coordenadas GPS (`Navigation`), cálculos en vivo (Suma, Promedio, Recuento), botón de inserción de fila `[+ Insertar Fila en #N]` y exportación vía `exportEngine.js`.
  8. `GridStatusBarBottom.jsx` ➔ **Zona 5:** Barra flotante con Badge de filtro activo + agregaciones dinámicas (`Σ`, `Ø`, `RECUENTO`) y acciones masivas al seleccionar filas (`selectedRowIds.size > 0`).
  9. `ShipWorkOrderPickerModal.jsx` ➔ Modal en celda Buque/Destino/OT.
  10. `ContractorPickerModal.jsx` ➔ Modal en celda Contratista/Persona.
* **Arquitectura de 5 Zonas Cromáticas Centralizada (`index.css`):**
  - **Zona 1 (`.alon-zone-context`):** Borde cielo (`sky-400`), badge de versión, pestañas compactas a la derecha y botón de acción principal.
  - **Zona 2 (`.alon-zone-kpis`):** Borde ámbar (`amber-400`), encabezado destacado `📊 RADAR DE KPIS Y ALERTAS OPERATIVAS • Clic en cualquier tarjeta para filtrar`.
  - **Zona 3 (`.alon-zone-toolbar`):** Borde cian (`cyan-400`), buscador omnicanal y botón `[↩ Deshacer (Ctrl+Z)]`.
  - **Zona 4 (`.alon-zone-grid`):** Borde superior esmeralda (`emerald-400`), ribbon y cabecera `.alon-grid-thead` con columna 1 apilada `[ ]/#` y columnas editables marcadas con `✎`.
  - **Zona 5:** Barra flotante inferior de estado y acciones masivas.
* **Regla de edición total y blindaje `onBlur`:** Cada celda visible debe ser editable con doble clic (`Enter`/`F2`), con `showPicker()` en fechas/selects y tirador celeste (*Fill Handle* `■`). Todo `onBlur` debe declararse como `onBlur={() => commitFn()}` para impedir que `FocusEvent` se guarde como `[object Object]`.
* **Checklist de entrega:** Asegurar `Fit-to-Viewport` (cero scroll horizontal de ventana) y compilación limpia con `npm run build` y `npm run lint`.

### 4.3 Arquetipo B: `METRICAS_ANALISIS` (Visualización y Análisis / "Gallina")
* **Definición:** Pantallas, pestañas o herramientas de visualización agregada, auditoría, comparación de obras o tableros ejecutivos (*Libro de Auditoría Global `AdminAuditLedger.jsx` sobre `audit_logs`, Modal Historial de Cambios `GridContextMenu.jsx`, Tablero Central `Dashboard.jsx`, Análisis de Personal vs Inflación, Sábana Quincenal de Horas, Ficha 360° de OT, Monitor de Alertas & Cumplimiento, Gobernanza IA*).
* **Reglas:** Indexar obligatoriamente en la Sección 2.B de `00_INDICE_DE_MODULOS_Y_CLASIFICACION.md` todas las tablas de base de datos que alimentan cada visualización para mantener trazabilidad documental completa hacia el usuario y el futuro Asistente IA de la aplicación. Cuando una pestaña administrativa gestione catálogos consumidos por planillas, debe leer y escribir sobre el módulo exportable único en `app/src/lib/`.

### 4.4 Modularidad y mejoras globales
- Para agregar una condición general a todas las planillas, modificar **exclusivamente el motor o componente canónico** (`useSpreadsheetGrid.js`, `GridRibbon.jsx`, `GridStatusBarBottom.jsx`, etc.), propagando el cambio a todas las pantallas.
- Para catálogos o datos compartidos, crear o usar un servicio único en `app/src/lib/`.

---

## 5. ESTÁNDARES DE WORKFLOWS N8N Y BACKEND

### 5.1 Gobernanza de n8n
- **Sin conexión directa:** El asistente no opera ni despliega workflows en n8n directamente; diseña y genera JSON listos para importar.
- **Lectura previa obligatoria:** Leer siempre `workflows/_meta/INDEX.md` y el `SDD.md` del workflow afectado antes de proponer cambios sobre él.
- **Estados válidos en `INDEX.md`:** `activo` (producción, SDD completo) / `activo-sin-SDD` (producción, SDD pendiente — deuda técnica) / `desarrollo` (no productivo). Un workflow **nunca** pasa a `activo` sin SDD completo.
- Convención completa: `workflows/_meta/PLANTILLA.md`.

### 5.2 Estándares de desarrollo n8n
- Flujos organizados de izquierda a derecha en bloques funcionales separados por Sticky Notes (Trigger, Normalización, Validación, Enrutamiento, Escritura externa, Log/Alertas, Salida).
- Nodos Code en JavaScript: KISS, DRY, responsabilidad única por nodo.
- Versionado por nombre: `NombreWorkflow_v2`, `_v3` (nunca sobreescribir).
- Referencias explícitas: `$('NodoX').first().json` (nunca `$input.first()` a ciegas).
- Placeholders en prompts: `<<NOMBRE>>` (nunca `{{}}` que colisiona con n8n).

### 5.3 Backend Node/Express + PostgreSQL (`SKL-010` y `SKL-011`)
- Aislamiento Docker multi-app gobernado por `${APP_SLUG}` y proxy `/api`.
- Arquitectura estricta en 4 capas: `Route → Controller → Service → Repository`.
- Centralización de errores con `errorHandler` y configuración en `env.js` con validación fail-fast.

---

## 6. COMMITS, CIERRE DE SESIÓN Y MANTENIMIENTO DE ÍNDICES

### 6.1 Política de commits
- Formato: `tipo: descripción corta`.
- Tipos válidos: `feat`, `fix`, `docs`, `refactor`.
- Un commit por tarea atómica (no mezclar tareas no relacionadas).
- **Push a remoto únicamente con confirmación explícita del usuario en el chat.**

### 6.2 Protocolo de cierre de sesión y actualización de repositorios
Al finalizar cada sesión o cuando el usuario pida actualizar repositorios:
1. Actualizar `workflows/_meta/INDEX.md` y `TAREAS_PENDIENTES.md` con las tareas realizadas.
2. **Matriz de Responsabilidad de Datos (`docs/MATRIZ_RESPONSABILIDAD_DATOS.md`):** Revisar la sesión y actualizar con las nuevas reglas, roles y responsables definidos (`trigger`, `persona responsable`, `name`, `module`, `field_key`, `responsible_role`). Recordar datos y disparadores pendientes de definir.
3. Registrar cualquier archivo nuevo en `INDICE_CENTRAL.md`.
4. No cerrar la sesión dejando cambios sin reflejar en estos archivos.

---

## 7. CATÁLOGO DE SKILLS Y AGENTES ESPECIALIZADOS

### 7.1 Skills bajo demanda
- `.agents/skills/caveman/` — Compresión de output para sesiones largas.
- `.agents/skills/rtk/` — Compresión de comandos Bash.
- `.agents/skills/transversal/control-calidad-entrega/` — **OBLIGATORIA (SKL-007)**: ejecutar antes de declarar terminada cualquier tarea con cambios y antes de commit/push.
- `.agents/skills/transversal/planificacion-por-etapas/` — **SKL-008**: clasificación por capas, Fast-Track y freno por riesgo.
- `.agents/skills/transversal/ingenieria-codigo-senior/` — **SKL-009**: 10 principios senior (foco P1 a P6) y modo auditoría.
- `.agents/skills/transversal/chasis-docker-multiapp/` — **SKL-010**: aislamiento Docker multi-app por `APP_SLUG`, proxy `/api` y env fail-fast.
- `.agents/skills/transversal/motor-backend-capas/` — **SKL-011**: backend Node/Express + PostgreSQL en 4 capas.
- `.agents/skills/transversal/ergonomia-flujo-visual-senior/` — **SKL-012**: marco universal de ergonomía cognitiva, flujo mental Top-Down, compresión dimensional y accesos rápidos.
- `.agents/skills/transversal/data-grid-poweruser/` — **SKL-013**: grilla industrial editable, navegación 100% teclado, mutación in-situ y operaciones matriciales 2D.
- `.agents/skills/transversal/schema-gatekeeper/` — **SKL-014**: freno de inspección empírica y cero asunciones de memoria de contratos y tablas.
- `.agents/skills/transversal/defensive-erp-contracts/` — **SKL-015**: diseño defensivo, tolerancia cero a errores silenciosos, atomicidad y sanitización escalar.
- `.agents/skills/transversal/context-aware-skill-router/` — **SKL-016**: meta-protocolo de enrutamiento contextual por globs y economía de atención.

### 7.2 Agentes especializados
- `automation-governance-architect` — Activa automáticamente ante modificaciones a workflows en producción o a pedido expreso.
- `database-optimizer` — Invocar en optimizaciones / migraciones de base de datos.
- `graphify` — Invocar en desarrollos y diagramaciones avanzadas.

---

## 8. LO QUE NUNCA HACE EL ASISTENTE

- Modificar o crear archivos en disco sin propuesta y aprobación previa del usuario.
- Incluir credenciales o tokens en ningún archivo.
- Asumir que una propuesta no rompe nada sin revisar el SDD y los contratos reales.
- Marcar un workflow como `activo` sin que su `SDD.md` esté completo.
- Programar un módulo nuevo sin clasificación previa (`CARGA_EDICION` o `METRICAS_ANALISIS`).
- Dar por terminada una tarea sin pruebas de runtime reales con datos `> 0`.

---

## 9. FORMATO OBLIGATORIO DE RESPUESTA EN CADA TURNO

### Al inicio de la respuesta:
> **[Gobernanza AlonCar]** Arquetipo: `CARGA_EDICION` | `METRICAS_ANALISIS`  
> **Skills y Estándares activos:** `[SKL-016 Router ➔ SKL-00X, Estándar 0X...]`

### Al cierre de toda entrega con cambios (`SKL-007`):
```markdown
### 🔍 Trazabilidad de Cumplimiento Mecánico
1. **Inspección previa (Fase 1 / SKL-014):** Columnas / archivos reales verificados: `[...]`
2. **Fuente de verdad compartida (Fase 2):** Módulo en `lib/` o componente reutilizado: `[...]`
3. **Verificación en caliente (Fase 3):** Resultado de ejecución real: `[N registros / Error: null / Build OK]`

### Control de calidad — Entrega (SKL-007)
**Estado general:** CUMPLIDO | PARCIAL | BLOQUEADO

| ID | Requisito (intención) | Estado | Evidencia comprobable |
| :--- | :--- | :--- | :--- |
| R1 | ... | CUMPLIDO | `archivo:línea` + salida de prueba real |

**Barrido de clase:** ...
**Impacto en otros módulos:** ...
**Pendientes y su motivo:** ...
```
