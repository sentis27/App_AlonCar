# 🛠️ Plan Atómico de Optimización IA y Blindaje Documental — App_AlonCar

> **Rama exclusiva:** `refactor/optimizacion-ia` (creada desde `main` en `65f273d`, 2026-11-13)  
> **Regla de Oro:** **PROHIBIDO** mergear a `main` hasta completar **todas las etapas (`E1`–`E6`)** y aprobar la **Auditoría Final (`E7`)** en un chat limpio.  
> **Objetivo medible:** Reducir el piso fijo por llamada API (`~27k` ➔ `< 16k` tokens), bajar el costo de cierres/consultas simples (`~55–65%`) y garantizar que la documentación, índices y modularidad no vuelvan a degradarse.

---

## 0. Protocolo Inviolable de Ejecución Multi-PC y Anti-Corte de Luz

1. **Nunca ejecutar todo el plan de golpe:** ejecutar **1 etapa por turno** (en `E5`, **1 sub-etapa por turno**).
2. **Ciclo obligatorio por cada etapa:**
   - **Paso A (Inicio):** Cambiar `[ ]` ➔ `[~]` en la etapa elegida.
   - **Paso B (Ejecución):** Aplicar únicamente los cambios de esa etapa (respetando la **Regla de Oro**: mostrar propuesta si corresponde antes de editar, o ejecutar si el usuario ya aprobó esa etapa).
   - **Paso C (Verificación Objetiva):** Correr el **Comando de Verificación** exacto de la etapa. Si falla, **parar y corregir** antes de cerrar.
   - **Paso D (Checkpoint):** Marcar `[x]`, anotar la salida verificada + fecha + `commit hash` en la tabla de estado.
   - **Paso E (Respaldo en GitHub):** `git add -A && git commit -m "tipo: descripcion etapa" && git push origin refactor/optimizacion-ia`.
3. **Recuperación ante corte de luz:**
   - Al volver la PC (o cambiar de PC), correr `git status -s` y `git log -n 3 --oneline`.
   - Lo ya marcado `[x]` con commit está a salvo en GitHub.
   - Si quedó una etapa en `[~]` o archivos modificados sin commit a medio terminar, limpiar el working tree (`git restore .` + revisar untracked) y reintentar únicamente esa etapa desde un chat limpio.
4. **Higiene de tokens:** Al terminar + pushear una etapa, **cerrar ese chat y abrir uno nuevo** para la siguiente etapa (evita arrastrar contextos > 120k y re-compactaciones).

---

## 1. Tablero de Progreso Global

| ID | Etapa | Estado | Riesgo | Commit Hash | Evidencia Verificada |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **E1** | Cortar doble inyección de `GEMINI.md` y adelgazar Constitución | `[x]` | Bajo | `ecb88d8` | `2026-11-13` · `GEMINI.md` `73 L` / `6,643 B` (`~1,879 tok` est); `GEMINI.md`+`CLAUDE.md` v`1.4` (`2026-11-13`); 0 duplicados globales en esta PC (verificar `~/.gemini/GEMINI.md` y `Documents/GEMINI.md` en PC casa + `< 18k` tok en próximo chat) |
| **E2** | Higiene `.antigravityignore` + eliminar código muerto (`initialPersonnel.json`) | `[x]` | Bajo | `0cd30bf` | `2026-11-13` · `.antigravityignore` actualizado (sin `docs/02_producto/`, agrega `Presentacion/`, `**/package-lock.json`, `docs/04_anexos_entendiemiento de planillas/`, `app/dist/`); `initialPersonnel.json` (`2,396 L`) eliminado; `initialPersonnel` en `app/src/` = `0` coincidencias; `npm.cmd run build` (`vite build`, `2097` módulos) `exit 0`; `npm.cmd run lint` (`oxlint`) `0` errores (`exit 0`) |
| **E3** | Rotación histórica de `TAREAS_PENDIENTES.md` y `BITACORA_DELTAS_SESION.md` | `[x]` | Bajo | `9e9a3af` | `2026-11-13` · `TAREAS_PENDIENTES.md` `84 L` / `8,972 B` (`< 12 KB`, con `- [ ]` `22 === 22` antes/después, `^\s*- \[ \]` `21 === 21`, últimos `5` `[x]` y link a `docs/archivo/TAREAS_COMPLETADAS_2026-11.md` `367 L`); `BITACORA_DELTAS_SESION.md` `68 L` / `8,876 B` (`< 12 KB`, últimas `5` sesiones y link a `docs/02_producto/05_auditorias/archivo/BITACORA_2026-11.md` `258 L`) |
| **E4** | Saneamiento de `README.md`, índices, links rotos y duplicados (`DEC-012/013/014`) | `[x]` | Medio | `4f1b30d` | `2026-11-13` · `0` rutas absolutas de usuario ni `file:///` en `.md` activos (salvo citas literales en este plan); `0` IDs `DEC-`/`ERR-` duplicados (`DEC-012/013/014` de ago-21 renumerados a `DEC-024/025/026`); `INDICE_METADATOS.md` `125/125` `.md` (`100%`, incl. E3 `TAREAS_COMPLETADAS_2026-11.md` y `BITACORA_2026-11.md`); `SKILLS_REGISTRY.md` `17/17` skills (`SKL-001`..`SKL-017`); `README.md` Fase 3 + links relativos en `01_infraestructura`/`03_negocio`; `INDICE_CENTRAL.md` `57 L` (`< 90 L`); `GUIA_ANTIGRAVITY.md` (`14 L`) y `ESTANDARES_MODULOS_UI_UX.md` (`17 L`) como punteros con únicos archivados en `docs/archivo/` |
| **E5.1** | Partir monolito `ComprasPedidosPanel.jsx` (`3,426 L`) | `[x]` | Alto | `bfbbe63` | `2026-11-13` · `ComprasPedidosPanel.jsx` `3,425 L ➔ 177 L`; 15 archivos modulares todos `≤ 270 L` (`comprasPedidosHelpers.js` `248 L`, `comprasPedidosGridHelpers.js` `182 L`, `comprasService.js` `212 L`, `comprasPedidosService.js` `208 L`, `useComprasPedidosMutations.js` `235 L`, `useComprasPedidosModalActions.js` `254 L`, `useComprasPedidosState.js` `269 L`, `ComprasKpiRadar.jsx` `268 L`, `ComprasPedidosToolbar.jsx` `163 L`, `ComprasPedidosTable.jsx` `181 L`, `ComprasRowCells.jsx` `180 L`, `ComprasPedidoRow.jsx` `217 L`, `ComprasPedidosStatusBar.jsx` `158 L`, `ComprasPedidosModals.jsx` `270 L`); `0` `supabase.from` en vistas/hooks; `npm.cmd run lint` (`0` errors, `148` archivos); `npm.cmd run build` (`vite build`, `2,110` módulos, `exit 0`); imports/props `100%` conectados; smoke test Node (`fetchComprasData` `27` pedidos, `15` prov., `7` buques + helpers puros `exit 0`) |
| **E5.2** | Partir monolito `PersonalNominaPanel.jsx` (`2,953 L`) | `[x]` | Alto | `88d15df` | `2026-11-13` · `PersonalNominaPanel.jsx` `2,953 L ➔ 291 L`; 18 archivos modulares todos `≤ 291 L` (`personalNominaHelpers.js` `220 L`, `personalNominaFormHelpers.js` `206 L`, `personalService.js` `179 L`, `personalNominaService.js` `275 L`, `usePersonalNominaState.js` `217 L`, `usePersonalNominaActions.js` `253 L`, `usePersonalNominaModalActions.js` `129 L`, `PersonalNominaKpiRadar.jsx` `248 L`, `PersonalNominaGroupsView.jsx` `84 L`, `PersonalNominaToolbar.jsx` `191 L`, `PersonalNominaTable.jsx` `126 L`, `PersonalNominaRow.jsx` `267 L`, `PersonalNominaRowCells.jsx` `256 L`, `PersonalNominaSafetyCell.jsx` `55 L`, `PersonalAuxModals.jsx` `171 L`, `PersonalWorkerCenterFields.jsx` `216 L`, `PersonalWorkerFormModal.jsx` `245 L`); `0` `supabase.from` en vistas/hooks; `npm.cmd run lint` (`0` errors, `164` archivos); `npm.cmd run build` (`vite build`, `2,125` módulos, `exit 0`); imports/props `100%` conectados (`Personal.jsx` + 10 subcomponentes); smoke test Node (`fetchPersonalData` `397` operarios, `97` tarifas, `10` roles + `269` grupos, `93` rubros + helpers puros `exit 0`) |
| **E5.3** | Partir monolito `ComprasAuxModals.jsx` (`2,160 L`) | `[x]` | Alto | `e62b707` | `2026-11-13` · `ComprasAuxModals.jsx` `2,159 L ➔ 11 L` (barrel compatibilidad); 12 archivos nuevos + `comprasService.js` todos `≤ 269 L` (`comprasAuxHelpers.js` `260 L`, `comprasAuxService.js` `269 L`, `ReconcileModal.jsx` `156 L`, `BatchOrderWhatsAppModal.jsx` `149 L`, `OrderAttachmentsModal.jsx` `261 L`, `PartialDeliveryModal.jsx` `169 L`, `SeCompraAlertModal.jsx` `100 L`, `AssignSupplierModal.jsx` `118 L`, `InlineSupplierPicker.jsx` `95 L`, `FreightModal.jsx` `118 L`, `SupplierHelperModal.jsx` `266 L`, `MandadosModal.jsx` `254 L`); `0` `supabase.` en vistas; `npm.cmd run lint` (`0` errors, `176` archivos); `npm.cmd run build` (`vite build`, `2,137` módulos, `exit 0`); smoke test Node (`fetchComprasData` `27` pedidos, `15` prov., `397` operarios, `3` docs + `5` servicios + helpers puros `exit 0`) |
| **E5.4** | Partir monolito `LaborCargaPanel.jsx` (`2,119 L`) | `[x]` | Alto | `7387729` | `2026-11-13` · `LaborCargaPanel.jsx` `2,118 L ➔ 191 L`; 15 archivos nuevos + `laborService.js` (`185 L`) todos `≤ 292 L` (`laborCargaHelpers.js` `260 L`, `laborCargaGridHelpers.js` `199 L`, `laborCargaService.js` `204 L`, `useLaborCargaCrewState.js` `191 L`, `useLaborCargaActions.js` `174 L`, `useLaborCargaGridState.js` `215 L`, `LaborCargaTopActions.jsx` `56 L`, `LaborTabulatorPanel.jsx` `136 L`, `LaborCascadeHeader.jsx` `226 L`, `LaborCrewGridSection.jsx` `185 L`, `LaborCrewRow.jsx` `225 L`, `LaborLogsToolbar.jsx` `84 L`, `LaborInlineCell.jsx` `31 L`, `LaborLogsTableRow.jsx` `292 L`, `LaborLogsTable.jsx` `183 L`); `0` `supabase.` en vistas/hooks; `npm.cmd run lint` (`0` errors, `191` archivos); `npm.cmd run build` (`vite build`, `2,152` módulos, `exit 0`); props/callbacks `100%` conectados (`LaborLogs.jsx` ➔ `LaborCargaPanel.jsx`); smoke test Node (`fetchLaborData` `7` buques, `11` OTs, `17` trabajos, `397` operarios, `labor_logs` `0` filas / `error: null` + helpers puros `exit 0`) |
| **E6** | Blindaje Preventivo Permanente (`repo-hygiene.mjs`, `SKL-016` Nivel 0, `SKL-017` ≤300L) | `[x]` | Medio | `74383e7` | `2026-11-13` · `app/scripts/repo-hygiene.mjs` (`273 L`, `oxlint` `0` errors / `0` warnings) + `"check:hygiene"` en `app/package.json`; `SKL-016` (`Nivel 0 Fast-Track UI Cosmético` exento de `INDICE_PLANILLAS`/`00_INDICE`/Supabase); `SKL-017` y `session-audit` (`≤ 300 L` en `components/hooks/lib/services` + cierre delta vía `check:hygiene`); `GEMINI.md` (`75 L` `< 100 L`, Nivel 0 + regla higiene de sesión `~130k` tok / post-push); `INDICE_METADATOS.md` actualizado (`125/125` `.md` + `repo-hygiene.mjs`); `npm.cmd run check:hygiene` `exit 0` (`2.62s`, `--fast` `0.08s`, `0` errores, `0` alertas); `npm.cmd run lint` (`oxlint` `0` errors, `192` archivos); `npm.cmd run build` (`vite build`, `2,152` módulos, `exit 0`) |
| **E7** | Auditoría Final Integrada en chat nuevo (Gate pre-merge a `main`) | `[x]` | Crítico | `481077a` | `2026-11-13` · Chat nuevo limpio sobre `refactor/optimizacion-ia`; `GEMINI.md` `75 L` / `7,089 B` (`< 100 L`, vs `main` `186 L` / `22,208 B`, `-68.1%`) + `CLAUDE.md` `15 L` / `529 B` (ambos `v1.4` `2026-11-13`); inyección única sin `~/.gemini/GEMINI.md` ni `~/Documents/GEMINI.md`; `TAREAS_PENDIENTES.md` `8,972 B` y `BITACORA_DELTAS_SESION.md` `8,876 B` (`< 12 KB`); `git diff --stat main...HEAD`: `99` archivos (`+12,957 / -15,288`), `0` archivos huérfanos, `63` archivos `AM` en `app/src/` todos `≤ 292 L` (máx. `LaborLogsTableRow.jsx` `292 L`), `0` `supabase.from(` en `components/`/`hooks/` modificados, `0` refs a `initialPersonnel`; `npm.cmd run check:hygiene` `exit 0` (`125` `.md` activos, `INDICE_METADATOS: OK`, `IDs DEC/ERR: OK`), `npm.cmd run lint` (`0` errors, `320` warnings, `192` archivos, `exit 0`), `npm.cmd run build` (`vite build`, `2,152` módulos, `exit 0`) |

---

## 2. Detalle Técnico y Criterios de Aceptación por Etapa

### Etapa `E1` — Cortar doble inyección de `GEMINI.md` y adelgazar Constitución Maestra
* **Problema detectado:** `C:/Users/<usuario>/.gemini/GEMINI.md` y `Documents/GEMINI.md` importaban ambos `App_AlonCar/GEMINI.md` (`22,097 bytes`), duplicándolo x2 en cada llamada (`~11,946` tok fijos). Además `GEMINI.md` (`234 L`) mezcla reglas globales con detalles de n8n/Docker/kits que se inyectan en el 100% de turnos.
* **Acciones:**
  1. Dejar la carga automática de `GEMINI.md` **en un único punto** (preferentemente solo el del workspace o un único puente global sin duplicado en `Documents/GEMINI.md` — en la PC de casa revisar `~/.gemini/GEMINI.md` y `Documents/GEMINI.md`).
  2. Adelgazar `GEMINI.md` del repo a **< 100 líneas (`< 2,500` tok)**: conservar Regla de Oro, Seguridad, Matriz Router (`SKL-016`), 5 Candados Anti-Rot, Contrato Supabase resumido y Formato de Respuesta; mover bloques extensos de n8n, Docker y listado largo de kits a sus skills/estándares (`SKL-001`, `SKL-010`, `00_INDICE_DE_MODULOS_Y_CLASIFICACION.md`).
  3. Sincronizar versión y fecha en frontmatter de `GEMINI.md` y `CLAUDE.md`.
* **Criterio objetivo (verificación):**
  - `GEMINI.md` `< 100` líneas.
  - Frontmatter de `GEMINI.md` y `CLAUDE.md` con misma `version` y `last_updated`.
  - En el Paso 1 del **próximo chat nuevo**, los `input_tokens + cache_read_tokens` iniciales deben bajar de `~27,000` a `< 18,000` tokens.

---

### Etapa `E2` — Higiene de `.antigravityignore` y eliminación de código muerto
* **Problema detectado:** `.antigravityignore` ignora `docs/02_producto/` (contradiciendo el protocolo que exige leer `estandares/` y `05_auditorias/`), pero NO ignora `Presentacion/` (`14.34 MB` de JPGs) ni los `package-lock.json` (`164.8 KB`). Además `app/src/data/initialPersonnel.json` (`61.6 KB`, `2,396 L`, `~17k` tok) tiene `0` imports en `app/src`.
* **Acciones:**
  1. Actualizar `.antigravityignore`: quitar `docs/02_producto/` y agregar `Presentacion/`, `**/package-lock.json`, `docs/04_anexos_entendiemiento de planillas/`, `app/dist/`, `*.log`.
  2. Verificar que ningún archivo ni script importe `initialPersonnel.json` y eliminarlo del repo.
* **Criterio objetivo (verificación):**
  - Búsqueda de `initialPersonnel` en todo `app/src/` devuelve `0` coincidencias.
  - `npm.cmd run build` (en `app/`) pasa con `exit 0`.

---

### Etapa `E3` — Rotación histórica de `TAREAS_PENDIENTES.md` y `BITACORA_DELTAS_SESION.md`
* **Problema detectado:** `TAREAS_PENDIENTES.md` (`667 L`, `> 64 KB`) tiene ~64 ítems `[x]` y 17 bloques `✓ HECHO` mezclados con solo ~19 ítems `[ ]` activos. `BITACORA_DELTAS_SESION.md` (`330 L`, `> 59 KB`) acumula cierres viejos que se releen en cada cierre.
* **Acciones:**
  1. Crear `docs/archivo/TAREAS_COMPLETADAS_2026-11.md` y mover allí todas las secciones `✓ HECHO` y tareas `[x]` históricas, dejando en `TAREAS_PENDIENTES.md` solo: pendientes `[ ]` activos + últimos `5` ítems `[x]` recientes + enlace al archivo histórico.
  2. Crear `docs/02_producto/05_auditorias/archivo/BITACORA_2026-11.md` y mover allí las entradas anteriores a las **últimas 5 sesiones**, manteniendo el formato de ledger en `BITACORA_DELTAS_SESION.md`.
* **Criterio objetivo (verificación):**
  - Conteo de líneas con `- [ ]` en `TAREAS_PENDIENTES.md` antes y después es idéntico (cero pérdida de tareas pendientes).
  - Ambos archivos vivos (`TAREAS_PENDIENTES.md` y `BITACORA_DELTAS_SESION.md`) pesan `< 12 KB` cada uno.

---

### Etapa `E4` — Saneamiento de `README.md`, índices, links rotos y duplicados
* **Problema detectado:**
  - `README.md` sigue en "Fase 1", cita `04_servidor_mcp.md` y tiene links rotos a `c:/Users/senti/...`.
  - `docs/01_infraestructura/README.md` y `docs/03_negocio/README.md` tienen links rotos a `file:///c:/Users/senti/.../docs/INDICE_CENTRAL.md`.
  - `INDICE_CENTRAL.md` (`278 L`) tiene 2 tablas Markdown rotas sin saltos de línea (L16 y L170) y estructura vieja de Fase 1.
  - `GUIA_ANTIGRAVITY.md` (`341 L`) está congelada en `2026-07-17` y duplicada con `GEMINI.md`.
  - `INDICE_METADATOS.md` deja `53` archivos `.md` sin indexar; en `docs/02_producto/01_decisiones/` existen archivos duplicados con los mismos IDs `DEC-012`, `DEC-013` y `DEC-014`.
  - `docs/02_producto/ESTANDARES_MODULOS_UI_UX.md` (`28.9 KB`) se solapa con `docs/02_producto/estandares/01..07`.
  - `.agents/skills/SKILLS_REGISTRY.md` no incluye `SKL-017`, duplica tablas y `.agents/skills/README.md` contradice el idioma real de `SKL-007..017`.
* **Acciones:**
  1. Reescribir `README.md` reflejando la arquitectura real actual (Fase 3: React + Vite + Tailwind + Supabase + n8n + MCP) sin rutas absolutas de usuario.
  2. Corregir links relativos en `docs/01_infraestructura/README.md` y `docs/03_negocio/README.md`.
  3. Compactar `INDICE_CENTRAL.md` (`< 90 L`) reparando las tablas rotas y dejando solo mapa de entry-points reales.
  4. Convertir `GUIA_ANTIGRAVITY.md` y `ESTANDARES_MODULOS_UI_UX.md` en punteros cortos hacia `GEMINI.md` y `docs/02_producto/estandares/` (archivando contenido histórico que no esté ya en `estandares/01..07` tras comparar diff).
  5. Inspeccionar el contenido de los pares `DEC-012`, `DEC-013`, `DEC-014`, consolidar o renumerar sin perder información y actualizar `docs/02_producto/README.md` + `INDICE_METADATOS.md` + `.agents/skills/SKILLS_REGISTRY.md` (con `SKL-017`) + `.agents/skills/README.md`.
* **Criterio objetivo (verificación):**
  - Búsqueda de `Users/senti` y `Users/Vanoli` en archivos `.md` del repo = `0` resultados.
  - Cero IDs `DEC-` o `ERR-` repetidos en `docs/02_producto/01_decisiones/` y `02_errores/`.
  - `INDICE_METADATOS.md` y `SKILLS_REGISTRY.md` cubren el 100% de archivos activos (excluyendo `Presentacion/`).

---

### Etapa `E5` — Partición modular de los 4 subcomponentes gigantes (`> 2,000 L`)
> ⚠️ **Regla estricta:** Ejecutar **una sub-etapa por turno** (`E5.1`, luego `E5.2`, etc.), verificando `oxlint` + `npm.cmd run build` + que todas las props/callbacks sigan conectadas antes de hacer `commit + push`.

* **`E5.1` (`ComprasPedidosPanel.jsx` — `3,426 L`):** extraer lógica pura a `lib/comprasConstants.js` / `services/comprasService.js` y subdividir vistas/grilla/barras en subcomponentes dentro de `app/src/components/compras/` (`< 300 L` por archivo).
* **`E5.2` (`PersonalNominaPanel.jsx` — `2,953 L`):** extraer helpers, badges y subpaneles/modales embebidos a `app/src/components/personal/` y `services/personalService.js` (`< 300 L` por archivo).
* **`E5.3` (`ComprasAuxModals.jsx` — `2,160 L`):** separar cada modal en su archivo propio en `app/src/components/compras/` y mantener un re-export en `ComprasAuxModals.jsx` si hace falta compatibilidad (`< 300 L` por archivo).
* **`E5.4` (`LaborCargaPanel.jsx` — `2,119 L`):** separar carga masiva IA, tabla editable y controles auxiliares en subcomponentes en `app/src/components/labor/` (`< 300 L` por archivo).
* **Criterio objetivo por cada sub-etapa:**
  - Archivos resultantes `< 350 L` cada uno (objetivo ideal `≤ 250–300 L`).
  - `npm.cmd run lint` (`0` errors) y `npm.cmd run build` (`exit 0`).
  - Verificación de imports y prueba de humo en Node/servicios afectados sin regresiones.

---

### Etapa `E6` — Blindaje Preventivo Permanente (`0` tokens de chequeo mecánico)
* **Objetivo:** Evitar que la documentación vuelva a desincronizarse, que los archivos vuelvan a crecer sin control y que cambios simples gasten cientos de miles de tokens.
* **Acciones:**
  1. **Crear `app/scripts/repo-hygiene.mjs` y registrar `"check:hygiene": "node scripts/repo-hygiene.mjs"` en `app/package.json`:**
     - Valida en < 2s (y **0 tokens de IA**):
       * `0` rutas absolutas de usuario (`Users/senti`, `Users/Vanoli`) y `0` links Markdown rotos.
       * `0` archivos `.md` activos fuera de `INDICE_METADATOS.md` y `0` IDs `DEC-`/`ERR-` duplicados.
       * Alerta si `TAREAS_PENDIENTES.md` o `BITACORA_DELTAS_SESION.md` superan `15 KB` (dispara rotación).
       * Alerta sobre cualquier archivo modificado en `git diff` dentro de `app/src/` que supere `300 L` (o aumente si ya pasaba `300 L`).
       * Ejecuta `oxlint` (`0` errors) y `vite build`.
  2. **Actualizar `SKL-016` (`context-aware-skill-router`) y `GEMINI.md`:**
     - Agregar **Nivel 0 (`Fast-Track UI Cosmético`)**: para cambios puramente visuales/JSX (ej. agregar botón en Zona 1 existente sin tocar BD, contratos ni servicios), basta lectura acotada (`StartLine/EndLine` ≤ 100L) + edición + `npm.cmd run build`, sin leer índices globales ni probar Supabase.
  3. **Actualizar `SKL-017` y `session-audit`:**
     - Extender el límite de `≤ 300 L` a **todo archivo** en `components/`, `hooks/`, `lib/` y `services/`.
     - Reemplazar las 20 lecturas manuales de cierre por ejecutar `npm.cmd run check:hygiene` + actualizar solo lo que reporta el delta.
     - Incluir en `GEMINI.md` la **regla de higiene de sesión**: sugerir chat nuevo después de cada `push` importante o al superar ~130k tokens de contexto.
* **Criterio objetivo (verificación):**
  - `npm.cmd run check:hygiene` termina con `exit 0` y salida limpia.
  - Simulación de un cambio mínimo en `SKL-016` confirma que ya no exige leer `INDICE_PLANILLAS` / `00_INDICE` para UI cosmético.

---

### Etapa `E7` — Auditoría Final Integrada (Gate Pre-Merge a `main`)
* **Ejecución obligatoria en un CHAT NUEVO limpio** sobre la rama `refactor/optimizacion-ia`:
  1. Verificar en el Paso 1 del chat nuevo la reducción real del piso de tokens inicial (`input_tokens + cache_read_tokens`).
  2. Correr `npm.cmd run check:hygiene`, `npm.cmd run lint`, `npm.cmd run build`.
  3. Revisar `git diff --stat main...HEAD` para confirmar cero archivos huérfanos y cero regresiones en módulos activos.
  4. Con el reporte en verde, el usuario aprueba el merge de `refactor/optimizacion-ia` hacia `main`.

---

## 3. Prompts Listos para Copiar y Pegar desde Casa

### A. Para ejecutar la próxima etapa pendiente (usar al abrir cada chat nuevo)
> `git fetch origin && git checkout refactor/optimizacion-ia && git pull`  
> **Prompt:**  
> *"Leé `PLAN_OPTIMIZACION_IA.md` (solo el tablero y la próxima etapa `[ ]` pendiente). Ejecutá únicamente esa etapa aplicando su verificación objetiva. Cuando pase, marcá `[x]` con la evidencia en `PLAN_OPTIMIZACION_IA.md`, hacé `commit` y `push` a `origin/refactor/optimizacion-ia`."*

### B. Si se cortó la luz a mitad de una etapa
> **Prompt:**  
> *"Se cortó la luz durante una ejecución en `refactor/optimizacion-ia`. Corré `git status -s` y `git log -n 3 --oneline`, compará con `PLAN_OPTIMIZACION_IA.md`, limpiá cualquier cambio incompleto sin commit si hace falta y retomá limpiamente la etapa que quedó `[~]` o `[ ]`."*

### C. Para la Auditoría Final (`E7`) antes de pasar a `main`
> **Prompt (en chat nuevo):**  
> *"Estamos en `refactor/optimizacion-ia` con `E1`–`E6` cerradas. Ejecutá la Etapa `E7` de `PLAN_OPTIMIZACION_IA.md`: corré `npm.cmd run check:hygiene`, `npm.cmd run lint`, `npm.cmd run build`, revisá `git diff --stat main...HEAD` e informá si está listo para mergear a `main`."*
