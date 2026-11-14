# Archivo Histórico — Reglas Específicas de `ESTANDARES_MODULOS_UI_UX.md`

> **Origen:** Extraído de `docs/02_producto/ESTANDARES_MODULOS_UI_UX.md` el `2026-11-13` (Etapa E4).  
> **Nota:** Las reglas transversales de arquetipos, 4/5 Zonas, Crawler Omnicanal, Ribbon/Columna 0, Barra Inferior, Modales y Trazabilidad viven en [`docs/02_producto/estandares/00..07`](../02_producto/estandares/00_INDICE_DE_MODULOS_Y_CLASIFICACION.md). Aquí se preservan íntegras las reglas específicas y detalles no duplicados en `estandares/01..07`.

---

## 1. Clases Auxiliares de Zona y Snippet GPS (Ref. §§1, 3)
- **Zona de Carga Rápida (`.alon-zone-entry`):** Borde izquierdo Índigo (`indigo-400`), fondo violeta oscuro, para formularios integrados en pantalla sin modales invasivos.
- **Cinta de Estado (`.alon-grid-ribbon`)** y **Cabecera Fija (`.alon-grid-thead`):** Clases base en `app/src/index.css`.
- **Snippet GPS en cinta:**
  ```jsx
  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-mono text-xs font-bold">
    <Navigation className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400/20" />
    <span>Fila {activeCell.rowIndex + 1} · {colDef.label}</span>
  </div>
  ```

## 2. Fechas, Fit-to-Viewport y Pila `Ctrl+Z` Polimórfica (Ref. §§4, 7, 8)
- **Fechas (`showPicker()`):** Doble clic / `Enter` / `F2` monta `<input type="date" autoFocus />` e invoca `el.showPicker()` en `ref`; al confirmar valida `YYYY-MM-DD`, persiste en BD y apila en `Ctrl+Z`.
- **Fit-to-Viewport (`1366px–1920px`):** Cero scroll horizontal en ventana o tabla principal; usar códigos operativos cortos en celda (`PEDIR`, `COTIZAR`, `RECIB.COMP.DIRECT`) con explicación completa en `title`, indicadores icónicos compactos (ej. círculo violeta 16px para `Conciliado`) y `truncate` + `title` en textos largos.
- **Pila de Reversibilidad `grid.pushUndoAction`:** Soporta 3 formas: (1) celda/columna `{ colKey, previousValues, newValuesMap, actionLabel }`, (2) mutaciones multi-columna `[{ rowId, colId, oldValue, newValue }]`, (3) operaciones compuestas `{ undoFn, redoFn, actionLabel }`. Reversión atómica simétrica en Supabase + React.

## 3. Celdas Compuestas In-Situ y Convivencia de Alertas (Ref. §10)
- Cuando una celda combina dato principal + nota técnica, doble clic/`Enter` abre tarjeta compacta in-situ de 2 renglones (`Tab` salta entre campos, `Enter` guarda ambos en Supabase, `Esc` cancela) sin modal de pantalla completa.
- Las alertas técnicas del sistema (`🔴 SIN ALTA EN CATÁLOGO`, `⚠️ SIN OT`, `Falta Comprobante`) se renderizan en badge independiente y nunca pueden quedar tapadas por observaciones del usuario.

## 4. Auditoría y Consistencia de Costo Directo vs Stock en Compras (Ref. §13)
- **Destino por defecto:** `PAÑOL` (`charge_type: 'VIA_PANOL'`), Buque = `ASTILLERO / STOCK`, OT = `null`.
- **Destino `DIRECTO`:** Exige Buque de obra distinto de Astillero; `work_order_id` puede quedar `null` temporalmente.
- **Costo directo contable:** Requiere simultáneamente `destino == DIRECTO` y `estado == RECIB.COMP.DIRECT`.
- **Infracciones del KPI `7. AUDITORÍA COSTO DIRECTO`:**
  - *Infracción A:* `DIRECTO` sin Buque específico (o Buque = Astillero).
  - *Infracción B:* Buque específico + estado `RECIB.COMP.DIRECT` con destino `PAÑOL` / no directo.
  - *Infracción C:* Buque específico + destino `DIRECTO` recibido con estado `RECIBIDO` o `RECIBIDO 2`.

## 5. Asistente Inteligente de Proveedores en 3 Capas (Ref. §14)
- Botón `<Lightbulb />` por fila en Compras:
  1. **Capa 1 (Histórico exacto / frase completa):** `normName === normTarget` o contención directa; prohibido usar `OR/some()` sobre medidas sueltas (evita mezclar `TUERCA 1/2` con `BULON 1/2`).
  2. **Capa 2 (Tokens estrictos, solo si Capa 1 = 0):** Exige coincidencia del sustantivo principal (`BULON`, `ELECTRODO`, `DISCO`) y ≥ 75–80% de tokens.
  3. **Capa 3 (Fallback por Rubro):** Selector de rubro + filtro libre con frecuencia general.
- Métricas consistentes (`X de Y compras (Z% de frecuencia)`) y botón `[ ⚡ Cargar Pedido ]` reversible con `Ctrl+Z`.

## 6. Logística Local / Mandados por WhatsApp Web y Reglas Periódicas (Ref. §§15, 16)
- **Proveedores locales:** Campos `is_local_supplier` y `address`.
- **Circuito `MandadosModal`:** Accesos `[ 🛵 Pedido de Mandado ]` y `[ 🛵 Mandar a Retirar (N) ]`; prioriza operarios con rubro `MANDADOS` o celular; genera mensaje limpio agrupado por `📍 PROVEEDOR (DIRECCIÓN):` e ítems ` - {cantidad} {unidad} {material}` (sin `#pedido` ni OT) + `*⚠️ Por favor retirar remito/factura.*` con `wa.me`.
- **Alertas normativas semanales (ej. Regla P-02 Air Liquide):** Administradas en `ComprasSettingsPanel.jsx` (`admin_alert_phone`, día, hora y prueba WhatsApp), fuera de los radares diarios.

## 7. Resaltado Amarillo en Filtros, Selector Masivo Dinámico e Inserción Contextual (Ref. §§18, 19, 20)
- **Iluminación de coincidencias:** Celda coincidente con `bg-amber-400/20 ring-1 ring-inset ring-amber-400/50` + `<mark className="bg-yellow-400/80 text-slate-950 font-bold px-0.5 rounded shadow-sm">`; fletes coincidentes en ámbar vibrante (`bg-amber-500/40 border-2 border-amber-400`).
- **Barra de acciones masivas (`§19`):** Selector dinámico de estado destino con color corporativo (Esmeralda `RECIBIDO`, Ámbar `RECIB.COMP.DIRECT`, Azul `PEDIDO`, Cian `PEDIR`), validación de reglas de negocio y `pushUndoAction` completo.
- **Inserción contextual entre filas (`§20`):** Botón `➕` (`handleInsertOrderContext(po, rowIndex, 'below')`) hereda fecha, quincena, solicitante, destino, buque, OT y proveedor; enfoca material en edición, interpola timestamp para preservar posición tras recarga y soporta `Ctrl+Z`.
