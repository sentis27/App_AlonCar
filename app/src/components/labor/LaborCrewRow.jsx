import React from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { cleanShipName } from '../../lib/laborConstants.js'
import { normalizeText } from '../../lib/tradesCatalog.js'

export default function LaborCrewRow({
  row,
  index,
  isMultiOtMode,
  canRemove,
  ships = [],
  workOrders = [],
  workItems = [],
  selectedShipId,
  selectedWorkOrderId,
  isRowEmergencyOpen,
  onUpdateRow,
  onRemoveRow,
  onToggleRubroEmergency,
  onResolveHomonym
}) {
  const hNorm = parseFloat(row.hours_normal) || 0
  const h50 = parseFloat(row.hours_extra_50) || 0
  const h100 = parseFloat(row.hours_extra_100) || 0
  const totalRow = hNorm + h50 + h100

  const hasLoanedRubro = Boolean(
    row.worker_type === 'Astillero' &&
      row.default_rubro &&
      row.default_rubro !== 'General' &&
      row.rubro &&
      normalizeText(row.rubro) !== normalizeText(row.default_rubro)
  )

  const effectiveRowShipId = row.ship_id || selectedShipId
  const rowEnabledWorkOrders = workOrders.filter(wo => {
    if (String(wo.ship_id) !== String(effectiveRowShipId)) return false
    return workItems.some(i => String(i.work_order_id) === String(wo.id) && i.status === 'En ejecución')
  })

  return (
    <div
      className={`p-3 rounded-xl border transition-colors ${
        row.needs_review
          ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-400/60'
          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
      }`}
    >
      <div
        className={`grid ${
          isMultiOtMode
            ? 'grid-cols-[105px_minmax(190px,1.4fr)_minmax(180px,1.3fr)_minmax(210px,1.6fr)_68px_68px_68px_60px_minmax(150px,1.2fr)_36px]'
            : 'grid-cols-[115px_minmax(200px,1.5fr)_minmax(190px,1.4fr)_72px_72px_72px_65px_minmax(150px,1.1fr)_38px]'
        } gap-2.5 items-center`}
      >
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-5 h-5 shrink-0 rounded bg-slate-800 text-slate-300 font-mono text-[11px] font-bold flex items-center justify-center">
            {index + 1}
          </span>
          <span
            className={`w-[78px] text-[10px] font-bold px-1.5 py-1.5 rounded border text-center truncate ${
              row.worker_type === 'Astillero'
                ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                : row.worker_type === 'Taller'
                ? 'bg-purple-950 text-purple-300 border-purple-800'
                : 'bg-amber-950 text-amber-300 border-amber-800'
            }`}
          >
            {row.worker_type}
          </span>
        </div>

        <div className="space-y-1">
          {row.homonym_candidates && row.homonym_candidates.length > 1 && (
            <div className="p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-[10px] text-amber-200 space-y-1">
              <div className="font-bold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                <span>Homónimo &ldquo;{row.worker_raw}&rdquo;: elegí operario</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {row.homonym_candidates.map(cand => (
                  <button
                    key={cand.name}
                    type="button"
                    onClick={() => onResolveHomonym(row.id, cand)}
                    className="px-2 py-0.5 rounded bg-amber-500/30 hover:bg-amber-500/50 text-amber-100 border border-amber-400/40 text-[10px] font-semibold cursor-pointer"
                  >
                    {cand.name} ({cand.trade})
                  </button>
                ))}
              </div>
            </div>
          )}

          <input
            type="text"
            required
            list="all-workers-datalist"
            placeholder="Nombre del operario..."
            value={row.worker_name}
            onChange={(e) => onUpdateRow(row.id, 'worker_name', e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary font-medium"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <input
              type="text"
              required
              list="rubros-list-carga"
              value={row.rubro}
              onChange={(e) => onUpdateRow(row.id, 'rubro', e.target.value)}
              className={`w-full bg-slate-900 border rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary font-medium ${
                hasLoanedRubro ? 'border-purple-500 text-purple-200' : 'border-slate-700'
              }`}
            />
            <button
              type="button"
              onClick={() => onToggleRubroEmergency(row.id)}
              className={`p-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors shrink-0 ${
                isRowEmergencyOpen
                  ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
              }`}
              title="Puerta de Emergencia: desbloquear lista completa de rubros para préstamos operativos"
            >
              🔓
            </button>
          </div>
        </div>

        {isMultiOtMode && (
          <div className="space-y-1">
            <select
              value={row.ship_id || selectedShipId}
              onChange={(e) => onUpdateRow(row.id, 'ship_id', e.target.value)}
              className="w-full bg-slate-900 border border-purple-500/40 rounded-lg px-2 py-1 text-[11px] text-purple-200 focus:outline-none"
            >
              {ships.map(s => (
                <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                  {cleanShipName(s.name)}
                </option>
              ))}
            </select>
            <select
              value={row.work_order_id || selectedWorkOrderId}
              onChange={(e) => onUpdateRow(row.id, 'work_order_id', e.target.value)}
              className="w-full bg-slate-900 border border-purple-500/40 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none"
            >
              <option value="" className="text-amber-300">-- ⚠️ OT en blanco --</option>
              {rowEnabledWorkOrders.map(wo => (
                <option key={wo.id} value={wo.id} className="bg-slate-900 text-white">
                  {wo.ot_number ? `${wo.ot_number} — ` : ''}{wo.title}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <input
            type="number"
            step="0.5"
            min="0"
            max="24"
            value={row.hours_normal}
            onChange={(e) => onUpdateRow(row.id, 'hours_normal', e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-1.5 py-1.5 text-xs text-white text-center font-bold focus:outline-none focus:border-primary font-mono"
          />
        </div>

        <div>
          <input
            type="number"
            step="0.5"
            min="0"
            max="24"
            value={row.hours_extra_50}
            onChange={(e) => onUpdateRow(row.id, 'hours_extra_50', e.target.value)}
            className="w-full bg-slate-900 border border-cyan-800/60 rounded-lg px-1.5 py-1.5 text-xs text-cyan-300 text-center font-bold focus:outline-none focus:border-primary font-mono"
          />
        </div>

        <div>
          <input
            type="number"
            step="0.5"
            min="0"
            max="24"
            value={row.hours_extra_100}
            onChange={(e) => onUpdateRow(row.id, 'hours_extra_100', e.target.value)}
            className="w-full bg-slate-900 border border-amber-800/60 rounded-lg px-1.5 py-1.5 text-xs text-amber-300 text-center font-bold focus:outline-none focus:border-primary font-mono"
          />
        </div>

        <div className="text-center font-mono font-extrabold text-primary text-xs bg-slate-900/80 py-1.5 rounded-lg border border-slate-800">
          {totalRow} hs
        </div>

        <div>
          <input
            type="text"
            placeholder="Tarea / Nota..."
            value={row.notes}
            onChange={(e) => onUpdateRow(row.id, 'notes', e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            disabled={!canRemove}
            onClick={() => onRemoveRow(row.id)}
            className="p-1.5 text-slate-500 hover:text-rose-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded hover:bg-rose-500/10 cursor-pointer"
            title="Eliminar fila"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
