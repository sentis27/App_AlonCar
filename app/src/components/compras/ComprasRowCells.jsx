import { AlertTriangle, Copy } from 'lucide-react'
import HighlightText from '../HighlightText'
import { STATUS_OPTIONS } from '../../lib/comprasConstants'
import { SIMPLE_STATUS_VALUES, getStatusTextColor } from '../../lib/comprasPedidosHelpers'

export function FillHandle({ grid, withTitle = false }) {
  return (
    <div
      onMouseDown={grid.handleFillHandleMouseDown}
      onDoubleClick={grid.handleFillHandleDoubleClick}
      className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md hover:scale-125 transition-transform"
      title={withTitle ? 'Arrastra hacia abajo (o doble clic) para rellenar (Ctrl+D)' : undefined}
    />
  )
}

export function RowClickNumMenu({ po, rowIndex, onClose, onInsertContext, onDuplicate }) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute left-9 top-1 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 w-52 text-left space-y-1 animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="px-2 py-1 text-[10px] font-bold text-slate-400 border-b border-slate-800 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-cyan-300">
          <span>Fila #{rowIndex + 1}</span>
          <span className="text-slate-500 font-normal truncate max-w-[85px]">{po.material_name_raw || 'S/D'}</span>
        </span>
        <button type="button" onClick={onClose} className="text-slate-500 hover:text-white text-xs px-1 cursor-pointer">
          ✕
        </button>
      </div>
      <button
        type="button"
        onClick={() => { onClose(); onInsertContext(po, rowIndex, 'above') }}
        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-200 hover:bg-cyan-950 hover:text-cyan-300 flex items-center gap-2 cursor-pointer transition-colors"
      >
        <span className="text-sm">⬆️</span>
        <span>Insertar fila ARRIBA</span>
      </button>
      <button
        type="button"
        onClick={() => { onClose(); onInsertContext(po, rowIndex, 'below') }}
        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-200 hover:bg-cyan-950 hover:text-cyan-300 flex items-center gap-2 cursor-pointer transition-colors"
      >
        <span className="text-sm">⬇️</span>
        <span>Insertar fila DEBAJO</span>
      </button>
      <button
        type="button"
        onClick={() => { onClose(); onDuplicate(po) }}
        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2 cursor-pointer transition-colors border-t border-slate-800/80"
      >
        <Copy className="w-3.5 h-3.5 text-slate-400" />
        <span>Duplicar pedido al final</span>
      </button>
    </div>
  )
}

export function MaterialInlineEditor({ po, inlineEdit, setInlineEdit, onSave }) {
  const clear = () => setInlineEdit({ orderId: null, field: null, value: '', obsValue: '' })
  const handleKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onSave(po.id, inlineEdit.value, inlineEdit.obsValue)
    } else if (e.key === 'Escape') {
      clear()
    }
  }
  return (
    <div
      className="bg-slate-950 border-2 border-cyan-400 rounded-lg p-2 space-y-1.5 shadow-2xl min-w-[220px] z-30 text-left"
      onClick={(e) => e.stopPropagation()}
    >
      <div>
        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Material</label>
        <input
          type="text"
          list="compras-materials-datalist"
          autoFocus
          value={inlineEdit.value}
          onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
          onKeyDown={handleKey}
          placeholder="Nombre del material..."
          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-400 font-semibold"
        />
      </div>
      <div>
        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Observación / Nota</label>
        <input
          type="text"
          value={inlineEdit.obsValue ?? ''}
          onChange={(e) => setInlineEdit({ ...inlineEdit, obsValue: e.target.value })}
          onKeyDown={handleKey}
          placeholder="Ej: son para juan..."
          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
        />
      </div>
      <div className="flex items-center justify-between text-[9px] text-slate-400 pt-1 border-t border-slate-800">
        <span className="text-slate-500">Enter: guardar</span>
        <button
          type="button"
          onClick={() => onSave(po.id, inlineEdit.value, inlineEdit.obsValue)}
          className="px-2 py-0.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded text-[10px] cursor-pointer"
        >
          Guardar
        </button>
      </div>
    </div>
  )
}

export function MaterialDisplayCell({ po, searchQuery, isSupervisorOrAdmin, onOpenNewMaterial }) {
  const isNoCatalogAlert = Boolean(po.no_catalog_required)
  return (
    <>
      <div className="flex items-center gap-1">
        <span className="font-medium text-white truncate max-w-[165px]" title={po.material_name_raw || 'Sin nombre'}>
          {po.material_name_raw ? (
            <HighlightText text={po.material_name_raw} query={searchQuery} />
          ) : (
            <span className="text-slate-500 italic">-- Sin material --</span>
          )}
        </span>
        {po.is_new_material && !po.no_catalog_required && isSupervisorOrAdmin && (
          <button
            onClick={(e) => { e.stopPropagation(); onOpenNewMaterial(po) }}
            className="px-1.5 py-0.2 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/50 text-[9px] font-bold inline-flex items-center gap-0.5 cursor-pointer shrink-0"
            title="Material sin registro. Clic para dar alta."
          >
            <AlertTriangle className="w-2.5 h-2.5" />
            <span>Alta</span>
          </button>
        )}
      </div>
      {isNoCatalogAlert && (
        <div className="my-0.5">
          <span
            className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[9px] font-extrabold uppercase tracking-wider inline-block"
            title="Material nuevo marcado como: NO requiere alta en catálogo"
          >
            🔴 Sin alta en catálogo
          </span>
        </div>
      )}
      {po.observations && (
        <p className="text-[10px] text-slate-300 italic truncate max-w-[190px]" title={po.observations}>
          <HighlightText text={po.observations} query={searchQuery} />
        </p>
      )}
    </>
  )
}

export function PedidoStatusSelect({ po, viewMode, onQuickStatusChange }) {
  const normalizedStatus = po.status === 'SOLICITUD' ? 'PEDIR' : po.status
  const colorCls = getStatusTextColor(normalizedStatus)
  const options = viewMode === 'completa'
    ? STATUS_OPTIONS.filter((s) => s.value !== 'TODOS')
    : STATUS_OPTIONS.filter((s) => SIMPLE_STATUS_VALUES.includes(s.value))

  return (
    <select
      value={normalizedStatus}
      onChange={(e) => onQuickStatusChange(po.id, e.target.value)}
      className={`bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-cyan-500 rounded px-1 py-0.5 text-[10px] font-bold focus:outline-none transition-colors cursor-pointer max-w-[118px] ${colorCls}`}
    >
      {options.map((st) => (
        <option
          key={st.value}
          value={st.value}
          title={viewMode === 'completa' ? st.tooltip : undefined}
          className={`bg-slate-950 font-semibold ${st.textColor || 'text-slate-200'}`}
        >
          {st.label}
        </option>
      ))}
    </select>
  )
}
