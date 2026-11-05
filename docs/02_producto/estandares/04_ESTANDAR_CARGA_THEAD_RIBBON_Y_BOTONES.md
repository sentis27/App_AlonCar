# 📋 Estándar de Planillas de Carga: Cabeceras, Ribbon y Botoneras

Toda vista del **Arquetipo Transaccional / Carga de Datos** debe presentar la misma estructura operativa de Google Sheets / Microsoft Excel.

---

## 1. Ribbon Superior de la Grilla (Zona 4.A)

En la parte superior de la tabla, un contenedor flex con fondo oscuro y borde esmeralda proyecta el estado del modo operativo:

```jsx
<div className="flex items-center justify-between p-2.5 bg-slate-950/80 border border-slate-800 rounded-t-xl text-xs">
  {/* Lado Izquierdo: Modo y Leyenda Operativa */}
  <div className="flex items-center gap-2">
    <span className="px-2 py-0.5 rounded-md bg-emerald-950 border border-emerald-500/60 text-emerald-300 font-bold text-[10px] tracking-wider uppercase">
      ⚡ Modo Planilla
    </span>
    <span className="text-slate-400 text-[11px] hidden md:inline">
      Doble clic o <kbd className="px-1 py-0.5 bg-slate-900 border border-slate-700 rounded text-[9px] font-mono text-slate-300">Enter</kbd> en cualquier celda para editar • Arrastrar esquina celeste o <kbd className="px-1 py-0.5 bg-slate-900 border border-slate-700 rounded text-[9px] font-mono text-slate-300">Ctrl+D</kbd> para rellenar
    </span>
  </div>

  {/* Lado Derecho: Inserción Contigua y Memoria Undo */}
  <div className="flex items-center gap-3">
    <button
      type="button"
      onClick={handleInsertContextRow}
      className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/60 text-emerald-300 font-bold text-xs transition-all cursor-pointer shadow-md hover:scale-[1.02]"
      title="Insertar fila contigua debajo de la fila activa heredando contexto"
    >
      <Plus className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
      <span>+ Insertar Fila en #{activeRowIndex + 1}</span>
    </button>
    <div className="flex items-center gap-1.5 text-slate-500 font-mono text-[10px]">
      <span>Memoria Undo: {undoStack.length}/50</span>
      <span>•</span>
      <span>{rows.length} filas</span>
    </div>
  </div>
</div>
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
