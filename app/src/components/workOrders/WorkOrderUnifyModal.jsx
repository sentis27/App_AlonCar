import { useState, useEffect, useMemo } from 'react'
import { Combine, X, ArrowRight, AlertTriangle } from 'lucide-react'
import { buildStandardShipWorkOrdersCatalog } from '../../lib/workOrderUnificationEngine'
import { fetchWorkOrderTransferSummaryService } from '../../lib/workOrderSummaryService'
import { unifyWorkOrdersService } from '../../lib/workOrderTransferService'
import WorkOrderCostPreviewBox from './WorkOrderCostPreviewBox'

export default function WorkOrderUnifyModal({
  sourceWo,
  ships = [],
  workOrders = [],
  workItems = [],
  user,
  onClose,
  onSuccess,
  showFeedback
}) {
  const shipId = sourceWo?.ship_id
  const sourceWoId = sourceWo?.id || null

  const shipName = useMemo(() => {
    if (sourceWo?.ships?.name) return sourceWo.ships.name
    return ships.find((s) => String(s.id) === String(shipId))?.name || 'Buque'
  }, [sourceWo, ships, shipId])

  const targetCandidates = useMemo(() => {
    if (!sourceWoId || !shipId) return []
    return buildStandardShipWorkOrdersCatalog(workOrders, workItems, {
      shipId,
      includeEliminated: false,
      includeClosed: true
    }).filter((w) => String(w.id) !== String(sourceWoId))
  }, [sourceWoId, shipId, workOrders, workItems])

  const [targetWoId, setTargetWoId] = useState(() => targetCandidates[0]?.id || '')
  const [reason, setReason] = useState('')
  const [summaryState, setSummaryState] = useState({ woId: null, data: null, error: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!sourceWoId) return
    let cancelled = false
    fetchWorkOrderTransferSummaryService(sourceWoId)
      .then((res) => {
        if (!cancelled) setSummaryState({ woId: sourceWoId, data: res, error: '' })
      })
      .catch((err) => {
        if (!cancelled) {
          setSummaryState({
            woId: sourceWoId,
            data: null,
            error: err?.message || 'No se pudo calcular el resumen.'
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [sourceWoId])

  if (!sourceWo) return null

  const effectiveTargetId = targetCandidates.some((w) => String(w.id) === String(targetWoId))
    ? targetWoId
    : targetCandidates[0]?.id || ''
  const targetWo = targetCandidates.find((w) => String(w.id) === String(effectiveTargetId))
  const loadingSummary = Boolean(sourceWoId) && summaryState.woId !== sourceWoId
  const summary = summaryState.woId === sourceWoId ? summaryState.data : null
  const summaryError = summaryState.woId === sourceWoId ? summaryState.error : ''

  const handleConfirm = async (e) => {
    e.preventDefault()
    if (!targetWo) return
    setSaving(true)
    try {
      const res = await unifyWorkOrdersService({ sourceWo, targetWo, reason, user })
      if (onSuccess) await onSuccess(res)
      showFeedback?.('success', `${sourceWo.ot_number} unificada dentro de ${res.targetLabel}.`)
      onClose?.()
    } catch (err) {
      showFeedback?.('error', `Error al unificar OT: ${err?.message || 'Error desconocido'}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto font-sans">
      <div className="w-full max-w-lg bg-slate-900 border border-cyan-500/40 rounded-3xl shadow-2xl p-6 space-y-4 my-8">
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div>
            <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px] font-black uppercase">
              Absorción Total de Sublíneas y Costos
            </span>
            <h3 className="text-base font-black text-white flex items-center gap-2 mt-1">
              <Combine className="w-5 h-5 text-cyan-400" />
              <span>Unificar / Trasladar Orden de Trabajo</span>
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
          <div className="text-[11px] text-slate-400">
            Barco: <strong className="text-white">{shipName}</strong>
          </div>
          <div className="flex items-center gap-2 flex-wrap pt-0.5">
            <span className="px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono font-black">
              {sourceWo.ot_number} &bull; {sourceWo.title}
            </span>
            <ArrowRight className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-cyan-300 font-bold">
              {targetWo ? `${targetWo.ot_number} • ${targetWo.title}` : 'Seleccionar destino'}
            </span>
          </div>
        </div>

        <form onSubmit={handleConfirm} className="space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">OT Destino (mismo barco) *</label>
            {targetCandidates.length === 0 ? (
              <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-500/40 text-amber-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>No hay otra orden de trabajo activa en este barco para unificar.</span>
              </div>
            ) : (
              <select
                required
                value={effectiveTargetId}
                onChange={(e) => setTargetWoId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-cyan-400"
              >
                {targetCandidates.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.ot_number} &bull; {w.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          <WorkOrderCostPreviewBox
            summary={summary}
            loading={loadingSummary}
            error={summaryError}
            title="Movimientos vinculados que se van a mover:"
          />

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Se moverán <strong className="text-white">{summary?.workItemsCount ?? 0}</strong> sublínea(s) y el 100% de los movimientos hacia la OT destino. La OT <strong className="text-rose-300">{sourceWo.ot_number}</strong> quedará archivada como Unificada.
          </p>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">Motivo / Nota de auditoría (opcional)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onBlur={() => setReason((prev) => prev.trim())}
              placeholder="Ej: Unificación de costos bajo orden principal"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold cursor-pointer">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || loadingSummary || !targetWo}
              className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-black rounded-xl cursor-pointer flex items-center gap-1.5 shadow-lg"
            >
              <Combine className="w-4 h-4" />
              <span>{saving ? 'Unificando...' : 'Confirmar Unificación'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
