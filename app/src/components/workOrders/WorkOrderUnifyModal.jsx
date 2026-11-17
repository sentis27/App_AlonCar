import { useState, useEffect, useMemo } from 'react'
import { Combine, X, ArrowRight, AlertTriangle, Plus } from 'lucide-react'
import { getNextOtNumberForShip } from '../../lib/workOrdersConstants'
import { buildStandardShipWorkOrdersCatalog, findDuplicateOtNameConflict } from '../../lib/workOrderUnificationEngine'
import { fetchWorkOrderTransferSummaryService } from '../../lib/workOrderSummaryService'
import { unifyWorkOrdersService, transferWorkOrderToNewOtService } from '../../lib/workOrderTransferService'
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

  const [mode, setMode] = useState('new_ot')
  const [newOtTitle, setNewOtTitle] = useState('')
  const [targetWoId, setTargetWoId] = useState(() => targetCandidates[0]?.id || '')
  const [reason, setReason] = useState('')
  const [summaryState, setSummaryState] = useState({ woId: null, data: null, error: '' })
  const [saving, setSaving] = useState(false)

  const nextOtNumber = useMemo(
    () => (shipId ? getNextOtNumberForShip(workOrders, shipId) : 'OT-1'),
    [workOrders, shipId]
  )

  const duplicateConflict = useMemo(() => {
    if (mode !== 'new_ot' || !shipId) return null
    return findDuplicateOtNameConflict(workOrders, workItems, shipId, newOtTitle)
  }, [mode, shipId, newOtTitle, workOrders, workItems])

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
    if (mode === 'new_ot') {
      if (!newOtTitle.trim() || duplicateConflict) return
      setSaving(true)
      try {
        const res = await transferWorkOrderToNewOtService({
          sourceWo,
          newOtTitle,
          reason,
          user,
          getNextOtNumberForShip: (sId) => getNextOtNumberForShip(workOrders, sId)
        })
        if (onSuccess) await onSuccess(res)
        showFeedback?.('success', `${sourceWo.ot_number} trasladada a nueva OT ${res.targetLabel}.`)
        onClose?.()
      } catch (err) {
        showFeedback?.('error', `Error al trasladar a nueva OT: ${err?.message || 'Error desconocido'}`)
      } finally {
        setSaving(false)
      }
      return
    }
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

  const destinationPreview = mode === 'new_ot'
    ? `${nextOtNumber} • ${newOtTitle.trim() ? newOtTitle.trim().toUpperCase() : 'NUEVA OT'}`
    : (targetWo ? `${targetWo.ot_number} • ${targetWo.title}` : 'Seleccionar destino')

  const canSubmit = mode === 'new_ot'
    ? Boolean(newOtTitle.trim()) && !duplicateConflict
    : Boolean(targetWo)

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
              {destinationPreview}
            </span>
          </div>
        </div>

        <form onSubmit={handleConfirm} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('new_ot')}
              className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                mode === 'new_ot' ? 'bg-cyan-500/20 border-cyan-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <div className="font-black text-cyan-300 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                <span>+ Crear Nueva OT</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Generar OT nueva en este barco</p>
            </button>
            <button
              type="button"
              onClick={() => setMode('existing_ot')}
              className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                mode === 'existing_ot' ? 'bg-cyan-500/20 border-cyan-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <div className="font-black text-cyan-300 flex items-center gap-1.5">
                <Combine className="w-3.5 h-3.5" />
                <span>OT Existente</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Unificar dentro de otra OT</p>
            </button>
          </div>

          {mode === 'new_ot' ? (
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Nº Nueva OT</label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={nextOtNumber}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-primary font-mono font-black cursor-not-allowed"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Nombre de la Nueva OT *</label>
                  <input
                    type="text"
                    required
                    value={newOtTitle}
                    onChange={(e) => setNewOtTitle(e.target.value.toUpperCase())}
                    onBlur={() => setNewOtTitle((prev) => prev.trim().toUpperCase())}
                    placeholder="EJ: REPARACIÓN VÁLVULAS DE CASCO"
                    className={`w-full bg-slate-900 border rounded-xl px-2.5 py-1.5 text-xs text-white font-bold uppercase focus:outline-none ${
                      duplicateConflict ? 'border-rose-500 focus:border-rose-400' : 'border-slate-700 focus:border-cyan-400'
                    }`}
                  />
                </div>
              </div>
              {duplicateConflict && (
                <div className="p-2 rounded-xl border bg-rose-950/60 border-rose-500/60 text-rose-200 text-[11px] font-bold flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{duplicateConflict.message}</span>
                  </div>
                  {duplicateConflict.kind === 'ACTIVE' && duplicateConflict.existingWo?.id && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('existing_ot')
                        setTargetWoId(duplicateConflict.existingWo.id)
                      }}
                      className="px-2 py-0.5 rounded-lg bg-white text-slate-900 text-[10px] font-black shrink-0 cursor-pointer"
                    >
                      Usar esa OT existente
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
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
          )}

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
              disabled={saving || loadingSummary || !canSubmit}
              className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-black rounded-xl cursor-pointer flex items-center gap-1.5 shadow-lg"
            >
              <Combine className="w-4 h-4" />
              <span>{saving ? 'Procesando...' : mode === 'new_ot' ? 'Crear y Trasladar' : 'Confirmar Unificación'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
