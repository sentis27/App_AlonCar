# 🧭 PROTOCOLO DE GOBERNANZA ARQUITECTÓNICA Y OPERATIVA — ALONCAR ERP

Como IA asistente del proyecto AlonCar ERP, este documento es tu **CENTRO DE DECISIONES OBLIGATORIO**. Debes ejecutarlo en **CADA TURNO** antes de proponer soluciones o invocar herramientas de edición.

---

## 0. CENTRO DE DECISIONES: ENRUTADOR DE ENTRADA Y CANDADO MECÁNICO

Antes de ejecutar cualquier herramienta en un turno, ubica el pedido en esta matriz y sigue su flujo obligatorio:

| Tipo de pedido del usuario | Skill obligatoria que gobierna | Primer Tool Call permitido | Condición para dar por terminado |
| :--- | :--- | :--- | :--- |
| **2+ tareas o cambio que toca varias capas** | `SKL-008` (`planificacion-por-etapas`) | `read_file` / `run_command` (Inspección) | Presentar tabla de etapas (*Fast-Track* si es misma pantalla/capa; *Freno por Riesgo* si cruza capas). |
| **Crear, editar o conectar código / datos** | `SKL-009` (`ingenieria-codigo-senior`) + `SKL-007` (`control-calidad-entrega`) | `run_command` / `read_file` (Ver Fase 1 abajo; **PROHIBIDO** empezar con `write_file`/`edit_file`) | Test de runtime real con datos `> 0` + `npm run build` + Reporte de Calidad y Trazabilidad. |
| **Auditar, revisar u ordenar un módulo** | `SKL-009` (Modo Auditoría) | `read_file` / medición real del código | Entregar matriz de Diagnóstico Técnico Senior ordenada por severidad (sin tocar código hasta autorización). |
| **Nuevo módulo o pantalla desde cero** | Regla 2 de este documento + `SKL-009` | **NINGUNO** si no tiene clasificación | Detenerse y preguntar si es `CARGA_EDICION` (Gallo) o `METRICAS_ANALISIS` (Gallina). |
| **Infraestructura Docker / Backend Node+PG** | `SKL-010` (`chasis-docker-multiapp`) + `SKL-011` (`motor-backend-capas`) | `read_file` de las skills `SKL-010` y `SKL-011` | Aislamiento por `${APP_SLUG}`, 4 capas estrictas (`Route → Controller → Service → Repo`) y `env.js` fail-fast. |

### 🔒 PIPELINE MECÁNICO INVIOLABLE (4 FASES PARA TODO CAMBIO DE CÓDIGO O DATOS)

1. **FASE 1 — INSPECCIÓN EMPÍRICA (Tool Call #1 obligatorio):**
   - **Prohibido invocar `write_file` o `edit_file` como primer paso.**
   - Si el cambio toca una tabla de Supabase, verificar primero sus columnas reales (en la Sección 1 de este archivo o ejecutando `select('*').limit(1)`).
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

## 1. DICCIONARIO DE CONTRATOS REALES DE SUPABASE (PROHIBIDO ADIVINAR COLUMNAS)

Antes de escribir cualquier `.from('<tabla>')`, respeta sus claves primarias y nombres de columna reales:

| Tabla en Supabase | Clave Primaria (PK) | Columnas reales verificadas | Trampas prohibidas (NO existen) |
| :--- | :--- | :--- | :--- |
| **`workers`** | `id` (uuid) | `name` (nombre completo), `category`, `trade` (rubro/oficio), `hourly_rate_ars`, `hourly_rate_usd`, `work_group`, `admin_center` (`ASTILLERO` \| `CONTRATISTA` \| `TALLER`), `status` (`ACTIVO` \| `INACTIVO`), `phone`, `dni`, `consumables`, `consumables_discount_pct`, `safety_elements`, `can_withdraw_materials`, `can_impute_hours`, `can_charge_third_party`, `is_foreman` | ❌ No existen `first_name` ni `last_name` (usar `name`). |
| **`system_settings`** | `key` (text) | `key`, `value` (jsonb), `updated_at`, `updated_by` (hacer `upsert` con `{ onConflict: 'key' }`) | ❌ No existe columna `id`. No existe tabla `app_settings`. |
| **`organization_roles`** | `role_key` (text) | `role_key`, `role_title`, `holder_name`, `department` | ❌ No existe columna `id`. |
| **`rate_cards`** | `id` | `period`, `year`, `month`, `quincena`, `admin_center`, `entity_name`, `rate_oficial_ars`, `rate_oficial_usd`, `has_ayudante`, `rate_ayudante_ars`, `rate_ayudante_usd`, `dollar_rate` | — |
| **`ships`** | `id` | Datos maestros de buques y estadías | — |
| **`work_orders`** | `id` | `ship_id`, `ot_number`, `description`, `contractors`, `foreman_name`, `work_type`, `status` | — |
| **`audit_logs`** | `id` | `action`, `entity`, `entity_id`, `details` (jsonb), `created_at` | — |

> **Regla:** Para cualquier tabla o columna que no figure en esta tabla, es **obligatorio** correr `select('*').limit(1)` en la Fase 1 antes de escribir código.

---

## 2. Regla de Bloqueo Absoluto para Nuevos Módulos
1. **PROHIBICIÓN TOTAL DE PROGRAMAR SIN CLASIFICACIÓN:**  
   Si el usuario solicita crear un nuevo módulo o vista sin indicar explícitamente su clasificación, la IA tiene **TERMINANTEMENTE PROHIBIDO** escribir una sola línea de código JSX o crear archivos.
2. **PREGUNTA OBLIGATORIA INMEDIATA:**  
   La IA debe detenerse de inmediato y formular la siguiente pregunta:  
   > *"¿A qué clasificación pertenece el nuevo módulo: `CARGA_EDICION` (Gallo) o `METRICAS_ANALISIS` (Gallina)?"*
3. **REGISTRO EN EL ÍNDICE:**  
   Una vez declarada la clasificación por el usuario, el módulo debe registrarse en `docs/02_producto/estandares/00_INDICE_DE_MODULOS_Y_CLASIFICACION.md` y heredar **automáticamente** el kit de componentes y motores canónicos correspondiente.

---

## 3. Regla Rectoral de Clasificación Funcional: "Gallo o Gallina"
Toda pantalla, vista o requerimiento del sistema se clasifica estrictamente por su **FUNCIÓN**, nunca por el nombre del módulo:

### A. ARQUETIPO: `CARGA_EDICION` (TRANSACCIONAL / GALLO)
* **Definición:** Cualquier pantalla donde el usuario agregue, modifique celdas, duplique, borre o cargue registros (ejemplos: *Compras, Pañol, Terceros, Horas, Personal, Barcos, OTs*, y futuros como *Cuenta Corriente, Facturación, Adelantos*).
* **DOCUMENTOS OBLIGATORIOS A CONSULTAR ANTES DE TOCAR CÓDIGO:**
  0. `docs/02_producto/estandares/00_INDICE_DE_MODULOS_Y_CLASIFICACION.md`
  1. `docs/02_producto/estandares/01_CLASIFICACION_FUNCIONAL_GALLO_O_GALLINA.md`
  2. `docs/02_producto/estandares/02_ARQUITECTURA_VISUAL_4_ZONAS_Y_COLORES.md`
  3. `docs/02_producto/estandares/03_BUSCADOR_OMNICANAL_CRAWLER_PROFUNDO.md`
  4. `docs/02_producto/estandares/04_ESTANDAR_CARGA_THEAD_RIBBON_Y_BOTONES.md`
  5. `docs/02_producto/estandares/05_BARRA_INFERIOR_FLOTANTE_CALCULOS_Y_LIMPIEZA.md`
  6. `docs/02_producto/estandares/06_COMPONENTES_CANONICOS_MODALES.md`

* **KIT CANÓNICO HEREDADO (VISUAL + MOTORES — PROHIBIDO DUPLICAR EN PÁGINAS):**
  1. `useSpreadsheetGrid.js` (`hooks/`) ➔ **Motor global de planilla:** navegación por flechas, edición `Enter`/`F2`, borrado con `Supr`/`Backspace`, relleno rápido `Ctrl+D`/fill-handle y pila de Deshacer/Rehacer (`Ctrl+Z`/`Ctrl+Y`).
  2. `KpiRadar.jsx` ➔ **Zona 2:** Radar de tarjetas con bordes y fondos cromáticos únicos por tarjeta (nunca `border-slate-800` inactivo) y filtro por clic.
  3. `CrawlerSearchBar.jsx` + `searchEngine.js` ➔ **Zona 3:** Buscador omnicanal profundo con atajos `Ctrl+F` / `Esc`.
  4. `GridRibbon.jsx` ➔ **Zona 4.A:** Cinta `[⚡ MODO PLANILLA]` + botón con prop `insertRowLabel` (sin signo `+` extra porque el componente ya renderiza `<Plus />`) + `[📥 Exportar]` vía `exportEngine.js`.
  5. `GridStatusBarBottom.jsx` ➔ **Zona 5:** Barra inferior flotante con Badge `[⚠️ Filtro Activo (X de Y) [✕ Limpiar Todo]]` + agregaciones dinámicas (`Σ`, `Ø`, `RECUENTO`).
  6. `ShipWorkOrderPickerModal.jsx` ➔ **Disparador 1:** Doble clic en celda Buque/Destino/OT.
  7. `ContractorPickerModal.jsx` ➔ **Disparador 2:** Doble clic en celda Contratista/Persona (OT en blanco = padrón completo; OT asignada = filtrado por OT con fallback al padrón completo).

* **REGLAS INVIOLABLES DE CARGA:**
  - **Cabeceras Sticky (`thead`):** Indicador `✎` obligatorio en toda columna editable.
  - **Coherencia de nombres (`SKL-007 P5`):** Si dos botones en una misma pantalla disparan la misma acción de alta/carga, deben llamarse exactamente igual.
  - **Prohibición:** Terminantemente prohibido crear inputs nativos, datalists o selects crudos en las celdas o toolbars para reemplazar los modales y componentes canónicos.

### B. ARQUETIPO: `METRICAS_ANALISIS` (ANALÍTICO / GALLINA)
* **Definición:** Pantallas de visualización agregada, auditoría, comparación de obras, configuración maestra o tableros ejecutivos (*Dashboard, AdminDashboard, Comparador de Obras, Auditoría de Stock, Reconciliación*).
* **REGLAS ANALÍTICAS Y DE ADMINISTRACIÓN:**
  - Solo lectura en tableros de métricas (sin celdas editables `✎`).
  - Cuando una pestaña de Administración gestione un catálogo usado por las planillas (ej. Rubros, Reglas de Compras, Puestos), **debe leer y escribir sobre la misma fuente de datos exportable (`app/src/lib/`)** que consumen las planillas operativas.

---

## 4. Protocolo de Modularidad y Condiciones Generales de Sistema
1. **Para agregar una condición general de planilla o utilidad global a todos los módulos:**  
   Modificar **exclusivamente el motor o componente canónico correspondiente** (`useSpreadsheetGrid.js`, `GridRibbon.jsx`, `GridStatusBarBottom.jsx`, `CrawlerSearchBar.jsx`, `searchEngine.js`, `exportEngine.js`), propagando la mejora instantáneamente a todas las pantallas sin editar módulo por módulo.
2. **Para compartir datos o catálogos entre módulos (Base de datos exportable interna):**  
   Crear o usar un servicio único en `app/src/lib/` que concentre la consulta, la normalización y la actualización, e importarlo en todas las vistas que lo necesiten.
3. **Para crear un módulo nuevo:**  
   Clasificarlo primero según la Regla 2 y ensamblarlo con las piezas canónicas existentes.

---

## 5. Formato Obligatorio de Respuesta en Cada Turno

### Al inicio de la respuesta:
> **[Gobernanza AlonCar]** Arquetipo: `CARGA_EDICION` | `METRICAS_ANALISIS`  
> **Skills y Estándares activos:** `[SKL-00X, Estándar 0X...]`

### Al cierre de toda entrega con cambios (`SKL-007`):
```markdown
### 🔍 Trazabilidad de Cumplimiento Mecánico
1. **Inspección previa (Fase 1):** Columnas / archivos reales verificados: `[...]`
2. **Fuente de verdad compartida (Fase 2):** Módulo en `lib/` o componente reutilizado: `[...]`
3. **Verificación en caliente (Fase 3):** Resultado de ejecución real: `[N registros / Error: null / Build OK]`

### Control de calidad — Entrega (SKL-007)
**Estado general:** CUMPLIDO | PARCIAL | BLOQUEADO

| ID | Requisito (intención) | Estado | Evidencia comprobable |
| :--- | :--- | :---: | :--- |
| R1 | ... | CUMPLIDO | `archivo:línea` + salida de prueba real |

**Barrido de clase:** ...
**Impacto en otros módulos:** ...
**Pendientes y su motivo:** ...
```
