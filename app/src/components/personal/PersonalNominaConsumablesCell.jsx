import { resolveConsumablesDiscountPct } from '../../lib/workCostRules'

const INLINE_PRESETS = [
  { pct: 100, label: '100%C', title: '100% Contratista / 0% Obra' },
  { pct: 60, label: '60%C', title: '60% Contratista / 40% Obra' },
  { pct: 50, label: '50%', title: '50% Contratista / 50% Obra' },
  { pct: 0, label: 'Obra', title: '100% Obra / 0% Contratista' }
]

export default function PersonalNominaConsumablesCell({
  w,
  rowIndex,
  colIndex = 6,
  cellClassName,
  isEditing,
  editingValue,
  showFillHandle = false,
  gridActions,
  setInlineCellEdit,
  commitInlineWorkerEdit
}) {
  const isAstillero = String(w.admin_center || '').trim().toUpperCase() === 'ASTILLERO'
  const effectivePct = resolveConsumablesDiscountPct(w)
  const obraPct = 100 - effectivePct

  const badgeText = effectivePct === 0
    ? '100% OBRA'
    : effectivePct === 100
    ? '100% CONT.'
    : `${effectivePct}% C / ${obraPct}% O`

  const badgeCls = effectivePct === 0
    ? 'bg-purple-950 text-purple-300 border-purple-800'
    : effectivePct === 100
    ? 'bg-amber-950 text-amber-300 border-amber-800'
    : 'bg-blue-950 text-blue-300 border-blue-800'

  return (
    <td
      onClick={(e) => gridActions?.onCellClick(rowIndex, colIndex, e)}
      onMouseDown={(e) => gridActions?.onCellMouseDown(rowIndex, colIndex, e)}
      onMouseEnter={() => gridActions?.onCellMouseEnter(rowIndex, colIndex)}
      onDoubleClick={(e) => {
        e.stopPropagation()
        if (isAstillero) return
        setInlineCellEdit({ rowId: w.id, colKey: 'consumables_discount_pct', value: effectivePct })
      }}
      title={
        isAstillero
          ? 'Personal propio de Astillero: Consumibles siempre 100% OBRA (0% descuento). Los EPP son 0% obra (Ref. Astillero).'
          : `Descuento Contratista: ${effectivePct}% | Imputación Obra: ${obraPct}% • Doble clic para editar`
      }
      className={cellClassName}
    >
      {isEditing && !isAstillero ? (
        <div className="flex flex-col gap-1 min-w-[120px]">
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              autoFocus
              value={editingValue}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setInlineCellEdit((prev) => ({ ...prev, value: e.target.value }))}
              onBlur={() => commitInlineWorkerEdit()}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') commitInlineWorkerEdit()
                if (e.key === 'Escape') setInlineCellEdit(null)
              }}
              aria-label="Porcentaje de descuento de consumibles"
              className="w-16 bg-slate-950 border border-emerald-400 rounded px-1.5 py-0.5 text-center text-[11px] text-white font-mono font-bold focus:outline-none"
            />
            <span className="text-[10px] text-slate-400 font-bold">% C</span>
          </div>
          <div className="flex items-center gap-0.5">
            {INLINE_PRESETS.map((p) => (
              <button
                key={p.pct}
                type="button"
                tabIndex={-1}
                title={p.title}
                onMouseDown={(e) => {
                  e.preventDefault()
                  commitInlineWorkerEdit(p.pct)
                }}
                className={`px-1 py-0.5 rounded text-[9px] font-bold border cursor-pointer ${
                  Number(editingValue) === p.pct
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500'
                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border whitespace-nowrap inline-block ${badgeCls}`}>
          {badgeText}
        </span>
      )}
      {showFillHandle && (
        <div
          onMouseDown={gridActions?.onFillHandleMouseDown}
          onDoubleClick={gridActions?.onFillHandleDoubleClick}
          className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border border-slate-950 cursor-crosshair z-30"
        />
      )}
    </td>
  )
}
