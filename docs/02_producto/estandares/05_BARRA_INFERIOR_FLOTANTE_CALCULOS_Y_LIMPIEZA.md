# 📊 Barra Inferior Flotante: Estado, Limpieza y Motor Matemático

Toda pantalla del **Arquetipo Transaccional / Carga de Datos** debe proyectar en su base la barra inferior flotante (`GridStatusBarBottom`).

---

## 1. Anatomía Visual

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [• Todo el filtro: 26 registros]  [⚠️ Filtro Activo (2 de 26)  [✕ Limpiar Todo]]        Σ CANT: 572  |  Σ AR$: $46.589.714  |  Σ US$: $31.059  |  Ø: $1.791.912 │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

* **Posición:** Flotante en la base de la ventana (`sticky bottom-0 z-30` o `fixed bottom-3 left-64 right-4 z-40`).
* **Estilo:** `bg-slate-950/95 backdrop-blur-md border border-cyan-500/40 rounded-2xl px-4 py-2 text-xs shadow-2xl flex items-center justify-between font-mono`.

---

## 2. Sección Izquierda: Contador y Botón "✕ Limpiar Todo"

Si hay cualquier filtro activo (texto en buscador, quincena, buque, estado o tarjeta de KPI activa):
- Se proyecta el badge ámbar alertando la cantidad filtrada vs. total: `Filtro Activo (X de Total)`.
- **Botón `[✕ Limpiar Todo]`:** Un botón rojo de alto impacto que al presionarlo:
  1. Limpia `searchQuery = ''`.
  2. Restablece el filtro de Buque a `'TODOS'`.
  3. Restablece el filtro de Estado a `'TODOS'`.
  4. Restablece el filtro de Quincena a `'TODAS'`.
  5. Desactiva cualquier tarjeta de KPI activa.
  6. Restaura la grilla a la vista completa instantáneamente.

```jsx
{hasActiveFilter && (
  <div className="flex items-center gap-2 bg-amber-950/80 border border-amber-500/60 text-amber-300 px-2.5 py-1 rounded-xl text-xs font-bold">
    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
    <span>Filtro Activo ({filteredCount} de {totalCount})</span>
    <button
      type="button"
      onClick={handleClearAllFilters}
      className="bg-rose-600 hover:bg-rose-500 text-white px-2 py-0.5 rounded text-[10px] font-black cursor-pointer transition-colors shadow"
    >
      ✕ Limpiar Todo
    </button>
  </div>
)}
```

---

## 3. Sección Derecha: Motor Matemático Dinámico (Sheets-like)

El extremo derecho responde dinámicamente a la interacción del usuario:

### A. Modo Selección Manual por Rango (Mouse drag o Shift+Flechas)
Si el usuario arrastra o selecciona un bloque de celdas:
1. **Si las celdas contienen TEXTO:**
   - Detecta que no son números.
   - Muestra: **`📋 RECUENTO: N celdas seleccionadas`**. *(Soluciona el problema donde el usuario selecciona nombres o descripciones y quedaba mudo)*.
2. **Si las celdas contienen NÚMEROS:**
   - Calcula automáticamente:
     - `Σ SUMA: [Total]`
     - `Ø PROM: [Promedio]`
     - `MÍN: [Mínimo] • MÁX: [Máximo]`
     - `RECUENTO: N números`

### B. Modo Vista General (Sin selección manual)
Si no hay selección manual de celdas, muestra la agregación de las columnas numéricas de la grilla filtrada:
- `Σ CANTIDAD: [Total unidades/kg]`
- `Σ TOTAL AR$: $[Monto en pesos]`
- `Σ TOTAL US$: $[Monto en dólares]`
- `Ø PROMEDIO: $[Promedio por ítem]`

---

## 4. Motor General Excel/Sheets (`SKL-019` · `FL-027`)

Toda tabla tipo planilla (`<table`) del sistema —editable o de consulta— **DEBE** conectar el motor único en **4 Capas Soldadas** y exponer **una `GridStatusBarBottom` propia por tabla** (`isFixed={false}` cuando conviven múltiples tablas en la misma vista, como DEBE y HABER en Cuentas Corrientes):

1. **Capa 1 — Motor puro (`app/src/lib/sheetSelectionEngine.js`):** parseo numérico argentino (`1.250,50`, `US$ 1.146,97`, `-US$ 101.531,77`) sin tocar fechas (`DD/MM/AAAA` / `YYYY-MM-DD`) ni códigos, rango multi-bloque, selección de columna completa, 7 métricas (`Suma`, `Promedio`, `Mínimo`, `Máximo`, `Cantidad`, `Contar números`, `Únicos`), exportación `Ctrl+C` en TSV 2D y ordenamiento cronológico/numérico/alfabético.
2. **Capa 2 — Hooks ("en 3 líneas"):** `useSheetSelection` (`app/src/hooks/grid/useSheetSelection.js`) para tablas de consulta/control, y `useSpreadsheetGrid` + `useGridSelection` + `useGridRangeCopy` para planillas editables. Soporta arrastre, `Shift+Flechas`, `Ctrl+Clic` salteado, clic en encabezado (`getHeaderProps` / `getColumnHeaderProps`) y doble clic para ordenar `↕` (si `sortable: true`).
3. **Capa 3 — Barra y Fórmula (`GridStatusBarBottom.jsx` + `FormulaNumericInput.jsx`):** clic en cualquier chip/fila del menú `Σ ▾` copia el valor exacto al portapapeles; `FormulaNumericInput` frena `onMouseDown` y `onDoubleClick` para poder hacer clic en cualquier parte de una fórmula (`=5*0.9`) sin cerrar el editor.
4. **Capa 4 — Candado Mecánico (`check:hygiene`):** `app/scripts/lib/antiRegressionChecks.mjs` verifica automáticamente cada `.jsx` con `<table` fuera del listado explícito `NON_SPREADSHEET_TABLE_ALLOWLIST` y falla en rojo si omite el motor, los encabezados interactivos o `GridStatusBarBottom`.

```jsx
const sheet = useSheetSelection({ rows, columns, getRowId: (r) => r.id, sortable: true })
// <th {...sheet.getHeaderProps('amountUsd')}>Monto{sheet.getSortIndicator('amountUsd')}</th>
// <td {...cp.domProps} className={cp.className}>...</td>
// <GridStatusBarBottom isFixed={false} selectionStats={sheet.selectionStats} onClearSelection={sheet.clearSelection} ... />
```
