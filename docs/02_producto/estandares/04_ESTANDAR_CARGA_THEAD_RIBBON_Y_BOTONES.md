# 📋 Estándar de Planillas de Carga: Cabeceras, Ribbon y Botoneras

Toda vista del **Arquetipo Transaccional / Carga de Datos** debe presentar la misma estructura operativa de Google Sheets / Microsoft Excel.

---

## 1. Ribbon Superior Canónico de la Grilla (Zona 4.A): Componente `GridRibbon.jsx`

En lugar de copiar y pegar JSX en cada página, la cinta superior está 100% modularizada en el componente canónico `app/src/components/GridRibbon.jsx`.

Proyecta:
- Modo operativo: `[⚡ MODO PLANILLA]` o `[CELDA A1]`
- Leyenda operativa de atajos de teclado (`Ctrl+D`, `Enter`, etc.)
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
  entityName="pedidos"
  exportRows={filteredRows}
  exportFilename="compras_export"
/>
```

---

## 2. Cabeceras Sticky (`thead`) con Ícono `✎` (Zona 4.B)

### Regla Inviolable
Toda columna que admita edición rápida in-situ o mediante modal emergente **debe llevar obligatoriamente el símbolo lápiz `✎` en el título de la cabecera**.

* **Estilo base:** `sticky top-0 z-20 bg-slate-950 border-b border-slate-800 text-slate-300 text-[11px] font-bold select-none`.
* **Columna `#` ordinal y checkbox maestro:** Ancho fijo `w-8`, checkbox arriba y símbolo `#` abajo.
* **Columnas editables:** `DESTINO ✎`, `FECHA ✎`, `BUQUE / OT ✎`, `CONTRATISTA ✎`, `MATERIAL / CONCEPTO ✎`, `CANT. ✎`, `ESTADO ✎`.
* **Columnas de solo cálculo o del sistema (sin `✎`):** `$/U SIST.`, `MARCA TEMPORAL`, `ACCIONES`.

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
    <span>Tip: usa el ícono de duplicar para clonar en 1 clic, o copia con <kbd>Ctrl+C</kbd> y pega con <kbd>Ctrl+V</kbd>.</span>
  </div>
</div>
```
