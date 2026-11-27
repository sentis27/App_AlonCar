import { useState, useMemo } from 'react'
import { GitFork, Check, X } from 'lucide-react'
import { formatDateAr } from '../../lib/dateTimeCanonical.js'
import { resolveOtFilterOptions } from '../../lib/filterThemeConstants.js'
import { computeDailyHoursSplitSummary, extractLogTotalHours } from '../../lib/costControlPeriodHelpers.js'

export default function CostControlSplitHoursRow({
  sourceLog,
  dayLogs = [],
  focusedMaterialRow = null,
  ships = [],
  workOrders = [],
  workItems = [],
  saving = false,
  onConfirmSplit,
  onCancel,
}) {
  const sourceTotal = extractLogTotalHours(sourceLog)
  const defaultNewHours = sourceTotal >= 1 ? 1 : (Number((sourceTotal / 2).toFixed(2)) || 0.5)
  const defaultSourceNext = Math.max(0, Number((sourceTotal - defaultNewHours).toFixed(2)))

  const [sourceNextHours, setSourceNextHours] = useState(String(defaultSourceNext))
  const [newRowHours, setNewRowHours] = useState(String(defaultNewHours))
  const [targetShipId, setTargetShipId] = useState(focusedMaterialRow?.shipId || sourceLog.ship_id || '')
  const [targetWorkOrderId, setTargetWorkOrderId] = useState(focusedMaterialRow?.workOrderId || '')

  const availableWos = useMemo(
    () => (targetShipId ? resolveOtFilterOptions(workOrders, workItems, targetShipId) : []),
    [workOrders, workItems, targetShipId]
  )

  const summary = useMemo(
    () => computeDailyHoursSplitSummary(dayLogs, sourceLog.id, Number(sourceNextHours), Number(newRowHours)),
    [dayLogs, sourceLog.id, sourceNextHours, newRowHours]
  )

  const handleShipChange = (nextShipId) => {
    setTargetShipId(nextShipId)
    const stillValid = resolveOtFilterOptions(workOrders, workItems, nextShipId).some(
      (wo) => String(wo.id) === String(targetWorkOrderId)
    )
    if (!stillValid) setTargetWorkOrderId('')
  }

  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault()
    const numNew = Number(newRowHours)
    const numSrc = Number(sourceNextHours)
    if (!Number.isFinite(numNew) || numNew <= 0) return
    if (!Number.isFinite(numSrc) || numSrc < 0) return
    const ok = await onConfirmSplit({
      sourceLog,
      sourceNextHours: numSrc,
      newRowHours: numNew,
      targetShipId: targetShipId || null,
      targetWorkOrderId: targetWorkOrderId || null,
    })
    if (ok) onCancel()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-1.5 rounded-xl bg-indigo-950/55 border border-indigo-400/60 p-3 space-y-2.5 text-xs shadow-lg"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-indigo-200 font-black">
          <GitFork className="w-3.5 h-3.5 text-cyan-300" />
          <span>Nueva línea desdoblada · {formatDateAr(sourceLog.date_logged)}</span>
        </div>
        <span className="text-[10px] font-bold text-slate-300 truncate max-w-[160px]">{sourceLog.worker_name}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="block text-[10px] font-bold text-slate-300">Horas fila origen (actual {sourceTotal} hs)</span>
          <input
            type="number"
            step="0.25"
            min="0"
            value={sourceNextHours}
            onChange={(e) => setSourceNextHours(e.target.value)}
            className="w-full bg-slate-950 text-slate-100 border border-indigo-500/50 rounded-lg px-2 py-1 text-xs font-mono"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-[10px] font-bold text-cyan-300">Horas nueva línea</span>
          <input
            type="number"
            step="0.25"
            min="0.25"
            autoFocus
            value={newRowHours}
            onChange={(e) => setNewRowHours(e.target.value)}
            className="w-full bg-slate-950 text-cyan-200 border border-cyan-400/70 rounded-lg px-2 py-1 text-xs font-mono font-bold"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="block text-[10px] font-bold text-slate-300">Barco (precargado del material)</span>
          <select
            value={targetShipId}
            onChange={(e) => handleShipChange(e.target.value)}
            className="w-full bg-slate-950 text-slate-100 border border-cyan-500/50 rounded-lg px-2 py-1 text-xs"
          >
            <option value="" className="bg-slate-950 text-slate-100">Seleccionar Barco...</option>
            {ships.map((s) => (
              <option key={s.id} value={s.id} className="bg-slate-950 text-slate-100">{s.name}</option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="block text-[10px] font-bold text-slate-300">OT (precargada del material)</span>
          <select
            value={targetWorkOrderId}
            onChange={(e) => setTargetWorkOrderId(e.target.value)}
            disabled={!targetShipId}
            className="w-full bg-slate-950 text-slate-100 border border-emerald-500/50 rounded-lg px-2 py-1 text-xs disabled:opacity-50"
          >
            <option value="" className="bg-slate-950 text-slate-100">Sin OT / Seleccionar...</option>
            {availableWos.map((wo) => (
              <option key={wo.id} value={wo.id} className="bg-slate-950 text-slate-100">
                {wo.ot_number ? `${wo.ot_number} · ` : ''}{wo.title || wo.description}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-mono font-bold ${
          summary.matchesOriginal
            ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200'
            : 'bg-amber-950/70 border-amber-500/60 text-amber-200'
        }`}
      >
        Total día: {summary.originalDayTotal} hs → {summary.nextDayTotal} hs{' '}
        {summary.matchesOriginal
          ? '✓ (sin cambio en liquidación)'
          : `(${summary.delta > 0 ? '+' : ''}${summary.delta} hs ⚠ cambia el total del día)`}
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
        >
          <X className="w-3 h-3" /> Cancelar
        </button>
        <button
          type="submit"
          disabled={saving || !(Number(newRowHours) > 0) || Number(sourceNextHours) < 0}
          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-black cursor-pointer"
        >
          <Check className="w-3 h-3" /> Guardar desdoble
        </button>
      </div>
    </form>
  )
}
