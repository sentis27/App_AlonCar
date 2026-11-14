import { Phone } from 'lucide-react'
import HighlightText from '../HighlightText'
import {
  ASTILLERO_BASE_CATEGORIES,
  getCategoryBadgeStyle,
  getRubroBadgeColor
} from '../../lib/personalNominaHelpers'

export default function PersonalNominaRowCells({
  w,
  rowIndex,
  dollarRate,
  searchTerm,
  uniqueTrades,
  nominaGrid,
  getCellClass,
  isEditingCell,
  inlineCellEdit,
  setInlineCellEdit,
  commitInlineWorkerEdit,
  onOpenAddTradeModal
}) {
  const usdCalc = dollarRate > 0 && w.hourly_rate_ars
    ? (w.hourly_rate_ars / dollarRate).toFixed(2)
    : (w.hourly_rate_usd || 0)

  const cellProps = (colIdx, colKey, initVal, title, baseClass) => ({
    onClick: (e) => nominaGrid.handleCellClick(rowIndex, colIdx, e),
    onMouseDown: (e) => nominaGrid.handleCellMouseDown(rowIndex, colIdx, e),
    onMouseEnter: () => nominaGrid.handleCellMouseEnter(rowIndex, colIdx),
    onDoubleClick: (e) => {
      e.stopPropagation()
      setInlineCellEdit({ rowId: w.id, colKey, value: initVal })
    },
    title,
    className: getCellClass(colIdx, baseClass)
  })

  const renderFillHandle = (colIdx) =>
    nominaGrid.shouldRenderFillHandle(rowIndex, colIdx) ? (
      <div
        onMouseDown={nominaGrid.handleFillHandleMouseDown}
        onDoubleClick={nominaGrid.handleFillHandleDoubleClick}
        className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border border-slate-950 cursor-crosshair z-30"
      />
    ) : null

  const inlineKeyDown = (e) => {
    e.stopPropagation()
    if (e.key === 'Enter') commitInlineWorkerEdit()
    if (e.key === 'Escape') setInlineCellEdit(null)
  }

  return (
    <>
      {/* Col 1: Nombre y Apellido */}
      <td {...cellProps(0, 'name', w.name || '', 'Doble clic para editar nombre', 'py-2 px-2')}>
        {isEditingCell('name') ? (
          <input
            type="text"
            autoFocus
            value={inlineCellEdit.value}
            onChange={(e) => setInlineCellEdit((prev) => ({ ...prev, value: e.target.value }))}
            onBlur={() => commitInlineWorkerEdit()}
            onKeyDown={inlineKeyDown}
            className="w-full min-w-[140px] bg-slate-950 border border-emerald-400 rounded px-2 py-0.5 text-xs text-white font-bold focus:outline-none"
          />
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-white">
              <HighlightText text={w.name} query={searchTerm} />
            </span>
            {w.is_foreman && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-600 font-extrabold">
                👷 Jefe de Obra
              </span>
            )}
            {w.phone && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800 font-mono flex items-center gap-1" title={`WhatsApp / Móvil: ${w.phone}`}>
                <Phone className="w-2.5 h-2.5" />
                <span><HighlightText text={w.phone} query={searchTerm} /></span>
              </span>
            )}
          </div>
        )}
        {renderFillHandle(0)}
      </td>

      {/* Col 2: Categoría */}
      <td {...cellProps(1, 'category', w.category || '', 'Doble clic para editar categoría', 'py-2 px-1.5 text-center')}>
        {isEditingCell('category') ? (
          w.admin_center === 'ASTILLERO' ? (
            <select
              autoFocus
              value={inlineCellEdit.value}
              onChange={(e) => setInlineCellEdit((prev) => ({ ...prev, value: e.target.value }))}
              onBlur={() => commitInlineWorkerEdit()}
              onKeyDown={inlineKeyDown}
              className="bg-slate-950 border border-emerald-400 rounded px-1.5 py-0.5 text-[11px] text-white font-bold focus:outline-none"
            >
              {ASTILLERO_BASE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              list="nomina-categories-list"
              autoFocus
              value={inlineCellEdit.value}
              onChange={(e) => setInlineCellEdit((prev) => ({ ...prev, value: e.target.value }))}
              onBlur={() => commitInlineWorkerEdit()}
              onKeyDown={inlineKeyDown}
              className="w-28 bg-slate-950 border border-emerald-400 rounded px-2 py-0.5 text-center text-[11px] text-white font-bold focus:outline-none"
            />
          )
        ) : w.category ? (
          <span className={`px-2 py-0.5 rounded text-[10px] uppercase border inline-block ${getCategoryBadgeStyle(w.category)}`}>
            <HighlightText text={w.category} query={searchTerm} />
          </span>
        ) : (
          <span className="text-slate-600">-</span>
        )}
        {renderFillHandle(1)}
      </td>

      {/* Col 3: Rubro */}
      <td {...cellProps(2, 'trade', w.trade || '', 'Doble clic para seleccionar o agregar rubro', 'py-2 px-1.5')}>
        {isEditingCell('trade') ? (
          <select
            autoFocus
            value={inlineCellEdit.value}
            onChange={(e) => {
              const val = e.target.value
              if (val === '__ADD_NEW_TRADE__') {
                onOpenAddTradeModal(w)
                return
              }
              setInlineCellEdit((prev) => ({ ...prev, value: val }))
              commitInlineWorkerEdit(val)
            }}
            onBlur={() => commitInlineWorkerEdit()}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Escape') setInlineCellEdit(null)
            }}
            className="bg-slate-950 border border-emerald-400 rounded px-2 py-1 text-xs text-white font-bold focus:outline-none w-full min-w-[140px]"
          >
            <option value="" className="bg-slate-950 text-slate-400">-- Seleccionar Rubro --</option>
            {uniqueTrades.map((tr) => (
              <option key={tr} value={tr} className="bg-slate-950 text-white font-bold">{tr}</option>
            ))}
            <option value="__ADD_NEW_TRADE__" className="bg-slate-900 text-cyan-400 font-bold">
              ➕ Agregar nuevo rubro...
            </option>
          </select>
        ) : (
          <div className="flex flex-wrap items-center gap-1">
            {String(w.trade || 'General')
              .split(/[,;/|]+/)
              .map((s) => s.trim())
              .filter(Boolean)
              .map((tr, tIdx) => (
                <span
                  key={`${w.id}-tr-${tIdx}`}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRubroBadgeColor(tr)}`}
                  title={tIdx === 0 ? 'Rubro Principal' : 'Rubro Secundario Habilitado'}
                >
                  {tIdx === 0 && String(w.trade || '').includes(',') ? '⭐ ' : ''}
                  <HighlightText text={tr} query={searchTerm} />
                </span>
              ))}
          </div>
        )}
        {renderFillHandle(2)}
      </td>

      {/* Col 4: AR$/Hora */}
      <td {...cellProps(3, 'hourly_rate_ars', w.hourly_rate_ars ?? 0, 'Doble clic para editar tarifa AR$/Hora', 'py-2 px-2 text-right font-mono font-bold text-white')}>
        {isEditingCell('hourly_rate_ars') ? (
          <input
            type="number"
            step="50"
            min="0"
            autoFocus
            value={inlineCellEdit.value}
            onChange={(e) => setInlineCellEdit((prev) => ({ ...prev, value: e.target.value }))}
            onBlur={() => commitInlineWorkerEdit()}
            onKeyDown={inlineKeyDown}
            className="w-24 bg-slate-950 border border-emerald-400 rounded px-2 py-0.5 text-right text-xs text-white font-mono focus:outline-none"
          />
        ) : w.hourly_rate_ars > 0 ? (
          <span>$<HighlightText text={parseFloat(w.hourly_rate_ars).toLocaleString('es-AR')} query={searchTerm} /></span>
        ) : (
          <span className="text-slate-600">-</span>
        )}
        {renderFillHandle(3)}
      </td>

      {/* U$/Hora */}
      <td className="py-2 px-1.5 text-center font-mono font-extrabold text-emerald-400">
        $<HighlightText text={String(usdCalc)} query={searchTerm} />
      </td>

      {/* Col 5: Grupo de Trabajo */}
      <td {...cellProps(4, 'work_group', w.work_group || '', 'Doble clic para editar Grupo de Trabajo', 'py-2 px-2')}>
        {isEditingCell('work_group') ? (
          <input
            type="text"
            list="nomina-groups-list"
            autoFocus
            value={inlineCellEdit.value}
            onChange={(e) => setInlineCellEdit((prev) => ({ ...prev, value: e.target.value }))}
            onBlur={() => commitInlineWorkerEdit()}
            onKeyDown={inlineKeyDown}
            className="w-32 bg-slate-950 border border-emerald-400 rounded px-2 py-0.5 text-[11px] text-cyan-300 font-mono font-bold focus:outline-none"
          />
        ) : (
          <span className="font-mono text-cyan-300 font-bold px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
            <HighlightText text={w.work_group} query={searchTerm} />
          </span>
        )}
        {renderFillHandle(4)}
      </td>

      {/* Col 6: Centro Admin */}
      <td {...cellProps(5, 'admin_center', w.admin_center || 'ASTILLERO', 'Doble clic para cambiar Centro Administrativo', 'py-2 px-1.5')}>
        {isEditingCell('admin_center') ? (
          <select
            autoFocus
            value={inlineCellEdit.value}
            onChange={(e) => setInlineCellEdit((prev) => ({ ...prev, value: e.target.value }))}
            onBlur={() => commitInlineWorkerEdit()}
            onKeyDown={inlineKeyDown}
            className="bg-slate-950 border border-emerald-400 rounded px-1.5 py-0.5 text-[10px] text-white font-bold focus:outline-none"
          >
            <option value="ASTILLERO">ASTILLERO</option>
            <option value="CONTRATISTA">CONTRATISTA</option>
            <option value="TALLER">TALLER</option>
          </select>
        ) : (
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
            w.admin_center === 'ASTILLERO'
              ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60'
              : w.admin_center === 'TALLER'
              ? 'bg-purple-950/80 text-purple-300 border-purple-800/60'
              : 'bg-amber-950/80 text-amber-300 border-amber-800/60'
          }`}>
            <HighlightText text={w.admin_center} query={searchTerm} />
          </span>
        )}
        {renderFillHandle(5)}
      </td>
    </>
  )
}
