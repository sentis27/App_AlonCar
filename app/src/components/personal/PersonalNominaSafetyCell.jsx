import { SAFETY_ITEMS_OPTIONS, SAFETY_ITEMS_HELP_TEXT } from '../../lib/workCostRules'

export default function PersonalNominaSafetyCell({
  w,
  rowIndex,
  colIndex = 7,
  cellClassName,
  isEditing,
  editingValue,
  showFillHandle = false,
  gridActions,
  setInlineCellEdit,
  commitInlineWorkerEdit
}) {
  return (
    <td
      onClick={(e) => gridActions?.onCellClick(rowIndex, colIndex, e)}
      onMouseDown={(e) => gridActions?.onCellMouseDown(rowIndex, colIndex, e)}
      onMouseEnter={() => gridActions?.onCellMouseEnter(rowIndex, colIndex)}
      onDoubleClick={(e) => {
        e.stopPropagation()
        if (w.admin_center === 'ASTILLERO') return
        setInlineCellEdit({ rowId: w.id, colKey: 'safety_items', value: w.safety_items || 'CONTRATISTA' })
      }}
      title={
        w.admin_center === 'ASTILLERO'
          ? 'Personal propio de Astillero: siempre ASTILLERO (solo costo de referencia).'
          : `Doble clic para definir si descuenta EPP (CONTRATISTA) o es excepción de zona gris (ASTILLERO).\n${SAFETY_ITEMS_HELP_TEXT}`
      }
      className={cellClassName}
    >
      {isEditing ? (
        <select
          autoFocus
          value={editingValue}
          onChange={(e) => setInlineCellEdit((prev) => ({ ...prev, value: e.target.value }))}
          onBlur={() => commitInlineWorkerEdit()}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') commitInlineWorkerEdit()
            if (e.key === 'Escape') setInlineCellEdit(null)
          }}
          className="bg-slate-950 border border-emerald-400 rounded px-1.5 py-0.5 text-[10px] text-white font-bold focus:outline-none"
        >
          {SAFETY_ITEMS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : (
        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
          w.safety_items === 'ASTILLERO'
            ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
            : 'bg-amber-950 text-amber-300 border-amber-800'
        }`}>
          {w.safety_items === 'ASTILLERO' && w.admin_center !== 'ASTILLERO'
            ? 'ASTILLERO (Z.Gris)'
            : (w.safety_items || 'CONTRATISTA')}
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
