# 📋 Estándar de Planillas de Carga: Cabeceras, Ribbon, Botoneras y Kit Sheets

Toda vista del **Arquetipo Transaccional / Carga de Datos** (`CARGA_EDICION`) debe presentar de forma estricta la misma ergonomía operativa de Google Sheets / Microsoft Excel para garantizar mínima curva de aprendizaje y máxima velocidad de captura.

---

## 1. Ribbon Superior Canónico de la Grilla (Zona 4.A): Componente `GridRibbon.jsx`

En lugar de copiar y pegar JSX en cada página, la cinta superior está 100% modularizada en el componente canónico `app/src/components/GridRibbon.jsx`.

Proyecta:
- Modo operativo: `[⚡ MODO PLANILLA]` o `[CELDA A1]`
- Leyenda operativa de atajos de teclado (`Ctrl+D`, `Tab`, `Enter`, etc.)
- Botón canónico de inserción: `[+ Insertar Fila en #X]`
- **Botón canónico de exportación a Excel / Sheets:** `[📥 Exportar]` (vía `exportEngine.js`)
- Contador de memoria Undo (`X/50`) y conteo de filas visibles

```jsx
<GridRibbon
  activeCellBadge={grid.activeCellBadge}
  onInsertRow={handleInsertRow}
  insertRowLabel="+ Insertar Fila en #1"
  undoCount={grid.undoStack?.length || 0}
  totalRows={filteredRows.length}
  entityName="registros"
  exportRows={filteredRows}
  exportFilename="planilla_export"
/>
```

---

## 2. Cabeceras Sticky (`thead`) con Ícono `✎` (Zona 4.B)

### Regla Inviolable
Toda columna que admita edición rápida in-situ o mediante selector/modal emergente **debe llevar obligatoriamente el símbolo lápiz `✎` en el título de la cabecera**.

* **Estilo base:** `sticky top-0 z-20 bg-slate-950 border-b border-slate-800 text-slate-300 text-[11px] font-bold select-none`.
* **Columna `#` ordinal y checkbox maestro:** Ancho fijo `w-8` o `w-10`, checkbox arriba y símbolo `#` abajo.
* **Columnas editables:** `DESTINO ✎`, `FECHA ✎`, `BUQUE / OT ✎`, `RUBRO ✎`, `AR$/HORA ✎`, `CANT. ✎`, `ESTADO ✎`.
* **Columnas de solo cálculo o del sistema (sin `✎`):** `$/U SIST.`, `U$/HORA`, `MARCA TEMPORAL`, `ACCIONES`.
* **Comportamiento en celdas de sistema:** `cursor-not-allowed select-none bg-slate-900/60 text-slate-500` con `canEditCell()` retornando `false`.

---

## 3. Botonera Inferior de Inserción Rápida (Zona 4.D)

Debajo de la grilla se ubica el llamado a la acción principal para agregar registros:

```jsx
<div className="flex items-center justify-between p-3 bg-slate-950 border-t border-slate-800 rounded-b-xl">
  <div className="flex items-center gap-3">
    <button
      type="button"
      onClick={handleOpenFullModal}
      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-950/70 hover:bg-amber-900/90 border border-amber-500/60 text-amber-300 font-black text-xs transition-all cursor-pointer shadow-lg hover:scale-105"
    >
      <Plus className="w-4 h-4 text-amber-400 stroke-[3]" />
      <span>+ NUEVO REGISTRO</span>
    </button>
    <span className="text-slate-500 text-xs italic">
      o cargar con formulario multi-ítem...
    </span>
  </div>
  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
    <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />
    <span>Tip: Tab para avanzar columna, Enter para bajar fila, o copia con <kbd>Ctrl+C</kbd> y pega con <kbd>Ctrl+V</kbd>.</span>
  </div>
</div>
```

---

## 4. Columna 0 Canónica: `#` Ordinal y Selección de Fila Completa

Toda tabla `CARGA_EDICION` debe proveer una Columna 0 estándar conectada a `useSpreadsheetGrid`:

### A. Cabecera (`th`)
```jsx
<th className="py-2.5 px-1 text-center w-8 select-none">
  <div className="flex flex-col items-center justify-center gap-0.5">
    <button
      type="button"
      onClick={() => grid.toggleSelectAll(filteredRows.map(r => r.id))}
      className="text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer"
      title="Seleccionar / deseleccionar todas las filas visibles"
    >
      {grid.selectedRowIds.size > 0 && grid.selectedRowIds.size === filteredRows.length ? (
        <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
      ) : (
        <Square className="w-3.5 h-3.5" />
      )}
    </button>
    <span className="font-mono text-[9px] text-slate-500 font-bold">#</span>
  </div>
</th>
```

### B. Celda de Fila (`td`)
```jsx
<td className="py-1 px-1 text-center w-8 select-none relative">
  <div className="flex flex-col items-center justify-center gap-0.5">
    <button
      type="button"
      onClick={() => grid.toggleSelectRow(row.id)}
      className="text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer"
    >
      {grid.isRowSelected(row.id) ? (
        <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
      ) : (
        <Square className="w-3.5 h-3.5" />
      )}
    </button>
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        handleOpenRowMenu(row, rowIndex, e)
      }}
      className={`font-mono text-[9px] font-bold px-1 py-0.5 rounded transition-all cursor-pointer hover:bg-cyan-950/90 hover:text-cyan-300 hover:ring-1 hover:ring-cyan-500/60 ${
        grid.isRowSelected(row.id) ? 'text-cyan-300' : 'text-slate-500 group-hover:text-cyan-400'
      }`}
      title={`Fila #${rowIndex + 1} • Clic para menú contextual o clic derecho`}
    >
      {rowIndex + 1}
    </button>
  </div>
</td>
```

### C. Resaltado de Fila
La fila seleccionada (`grid.isRowSelected(row.id)`) debe aplicar el fondo cyan corporativo:
`isSelected ? 'bg-cyan-950/30 hover:bg-cyan-950/40' : 'hover:bg-slate-800/50'`.

---

## 5. Algoritmo "Paste Matrix" 2D y Navegación Direccional (Hook `useSpreadsheetGrid`)

El hook `useSpreadsheetGrid.js` estandariza el comportamiento espacial:
1. **Paste Matrix 2D:**
   - Procesa bloques bidimensionales copiados desde Excel / Google Sheets separados por saltos de línea (`\r\n|\n|\r`) y tabulaciones (`\t`).
   - Mapea valores desde la celda activa `(activeCell.rowIndex, activeCell.colIndex)` hacia filas y columnas adyacentes.
   - Sanitiza automáticamente tipos de datos (números limpios de símbolos `$`, fechas `YYYY-MM-DD`, booleans normalizados).
   - Registra todo el bloque en `undoStack` como `multi_column_mutations` para revertir con `Ctrl+Z` en 1 solo paso.
2. **Navegación Direccional (Enter y Tab):**
   - `Tab`: Avanza a la columna derecha (`col + 1`). Si llega al final de columnas, pasa al inicio de la fila siguiente.
   - `Shift + Tab`: Retrocede a la columna izquierda (`col - 1`).
   - `Enter`: Si no está editando, baja a la fila siguiente (`row + 1`). Si está en celda interactiva, activa su editor.
   - `Shift + Enter`: Sube a la fila superior (`row - 1`).

---

## 6. Menú Contextual Canónico de Grilla (`GridContextMenu.jsx`)

Toda fila o celda debe responder al clic derecho (`onContextMenu`):
```jsx
<tr
  key={row.id}
  onContextMenu={(e) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenuTarget({
      row,
      rowIndex,
      x: e.clientX,
      y: e.clientY,
      isRowHeader: false
    })
  }}
>
```

Componente estándar:
```jsx
<GridContextMenu
  target={contextMenuTarget}
  onClose={() => setContextMenuTarget(null)}
  onCopyCell={grid.copyActiveCell}
  onCopyRow={grid.copyRow}
  onPaste={grid.pasteToActiveOrRange}
  onDeleteCell={grid.deleteActiveCellOrRange}
  onInsertRowAbove={handleInsertAbove}
  onInsertRowBelow={handleInsertBelow}
  onDuplicateRow={handleDuplicate}
  onDeleteRow={handleDelete}
  entityType="workers"
  recordId={contextMenuTarget?.row?.id}
  recordLabel={contextMenuTarget?.row?.name}
/>
```

### Funcionalidad Integrada: Visor de `audit_logs`
El menú contextual incluye la opción **"Ver historial de cambios"**, la cual abre un modal nativo que consulta la tabla `audit_logs` filtrando por `entity_id` y proyectando la fecha/hora en formato argentino, el operador responsable y el detalle json de las mutaciones.

---

## 7. Barra Flotante Canónica de Acciones en Lote (`GridStatusBarBottom.jsx`)

Cuando `grid.selectedRowIds.size > 0`, la barra `GridStatusBarBottom` muestra el conteo de filas seleccionadas y despliega botones de acción masiva:
- Cambio de estado en lote (ej. Marcar como Recibido, Activar / Inactivar personal).
- Modificación masiva de rubro o centro de costo.
- Eliminación en lote protegida por confirmación.
- Exportación de las filas seleccionadas a Excel vía `exportEngine.js`.
