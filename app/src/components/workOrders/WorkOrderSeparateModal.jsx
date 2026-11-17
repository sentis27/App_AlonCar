import { useState, useEffect, useMemo } from 'react'
import { GitBranch, X, Plus, ArrowRight, AlertTriangle } from 'lucide-react'
import { getNextOtNumberForShip } from '../../lib/workOrdersConstants'
import { buildStandardShipWorkOrdersCatalog, findDuplicateOtNameConflict } from '../../lib/workOrderUnificationEngine'
import { fetchWorkOrderTransferSummaryService } from '../../lib/workOrderSummaryService'
import { separateWorkItemService } from '../../lib/workOrdersService'
import WorkOrderCostPreviewBox from './WorkOrderCostPreviewBox'

export default function WorkOrderSeparateModal({
  separatingRow,
  workOrders = [],
  workItems = [],
  user,
  onClose,
  loadData,
  showWoGridFeedback
}) {
  const shipId = separatingRow?.wo?.ship_id
  const sourceWoId = separatingRow?.work_order_id || null

  const existingTargets = useMemo(() => {
    if (!separatingRow || !shipId) return []
    return buildStandardShipWorkOrdersCatalog(workOrders, workItems, {
      shipId,
      includeEliminated: false,
      includeClosed: true
    }).filter((w) => String(w.id) !== String(sourceWoId))
  }, [separatingRow, shipId, sourceWoId, workOrders, workItems])

  const [separateForm, setSeparateForm] = useState(() => {
    const firstLine = separatingRow?.description
      ? separatingRow.description.split('\n')[0].slice(0, 55).toUpperCase().trim()
      : ''
    return {
      mode: 'new_ot',
      ot_creation_type: 'libre',
      selected_template_id: '',
      new_ot_number: getNextOtNumberForShip(workOrders, shipId),
      new_ot_title: firstLine,
      target_existing_wo_id: existingTargets[0]?.id || '',
      migrate_all_wo_costs: true,
      reason: 'Se independiza el trabajo en una OT propia para seguimiento individual'
    }
  })

  const [summaryState, setSummaryState] = useState({ woId: null, data: null, error: '' })
  const [savingSeparate, setSavingSeparate] = useState(false)

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
            error: err?.message || 'Error calculando movimientos.'
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [sourceWoId])

  const duplicateConflict = useMemo(() => {
    if (!separatingRow || separateForm.mode !== 'new_ot' || !shipId) return null
    return findDuplicateOtNameConflict(workOrders, workItems, shipId, separateForm.new_ot_title)
  }, [separatingRow, separateForm.mode, separateForm.new_ot_title, shipId, workOrders, workItems])

  if (!separatingRow) return null

  const loadingSummary = Boolean(sourceWoId) && summaryState.woId !== sourceWoId
  const summary = summaryState.woId === sourceWoId ? summaryState.data : null
  const summaryError = summaryState.woId === sourceWoId ? summaryState.error : ''

  const handleConfirmSeparateWorkItem = async (e) => {
    e.preventDefault()
    if (duplicateConflict) return
    setSavingSeparate(true)
    try {
      const label = await separateWorkItemService({
        separateForm,
        separatingRow,
        user,
        getNextOtNumberForShip: (sId) => getNextOtNumberForShip(workOrders, sId),
        workOrders
      })
      onClose?.()
      await loadData()
      showWoGridFeedback?.('success', `Trabajo separado hacia ${label}.`)
    } catch (err) {
      showWoGridFeedback?.('error', `Error al separar: ${err.message}`)
    } finally {
      setSavingSeparate(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto font-sans">
      <div className="w-full max-w-xl bg-slate-900 border border-amber-500/50 rounded-3xl shadow-2xl p-6 space-y-4 my-8">
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div>
            <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase">
              Desglose y Reasignación con Trazabilidad
            </span>
            <h3 className="text-base font-black text-white flex items-center gap-2 mt-1">
              <GitBranch className="w-5 h-5 text-amber-400" />
              Separar / Independizar Trabajo de su Contenedor OT
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Barco: <strong className="text-white">{separatingRow.wo?.ships?.name}</strong></span>
            <span>OT: <strong className="text-primary font-mono">{separatingRow.wo?.ot_number} &bull; {separatingRow.wo?.title}</strong></span>
          </div>
          <p className="text-slate-200 font-medium line-clamp-3">{separatingRow.description || 'Sin descripción'}</p>
        </div>

        <form onSubmit={handleConfirmSeparateWorkItem} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setSeparateForm((prev) => ({ ...prev, mode: 'new_ot' }))}
              className={`p-3 rounded-xl border text-left cursor-pointer ${
                separateForm.mode === 'new_ot' ? 'bg-amber-500/20 border-amber-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
            >
              <div className="font-black text-amber-300 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                <span>1. Nueva OT Propia</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                if (existingTargets.length === 0) {
                  showWoGridFeedback?.('error', 'No hay otras OTs activas en este barco.')
                  return
                }
                setSeparateForm((prev) => ({ ...prev, mode: 'existing_ot', target_existing_wo_id: existingTargets[0]?.id || '' }))
              }}
              className={`p-3 rounded-xl border text-left cursor-pointer ${
                separateForm.mode === 'existing_ot' ? 'bg-cyan-500/20 border-cyan-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
            >
              <div className="font-black text-cyan-300 flex items-center gap-1.5">
                <ArrowRight className="w-3.5 h-3.5" />
                <span>2. Mover a otra OT</span>
              </div>
            </button>
          </div>

          {separateForm.mode === 'new_ot' ? (
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Nº Nueva OT</label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={separateForm.new_ot_number}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-primary font-mono font-black cursor-not-allowed"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Nombre Nueva OT *</label>
                  <input
                    type="text"
                    required
                    value={separateForm.new_ot_title}
                    onChange={(e) => setSeparateForm((p) => ({ ...p, new_ot_title: e.target.value.toUpperCase() }))}
                    onBlur={() => setSeparateForm((p) => ({ ...p, new_ot_title: (p.new_ot_title || '').trim().toUpperCase() }))}
                    className={`w-full bg-slate-900 border rounded-xl px-3 py-1.5 text-xs text-white font-bold uppercase ${
                      duplicateConflict ? 'border-rose-500' : 'border-slate-700'
                    }`}
                  />
                </div>
              </div>

              {duplicateConflict && (
                <div
                  className={`p-2.5 rounded-xl border text-[11px] font-bold flex items-center justify-between gap-2 ${
                    duplicateConflict.kind === 'ELIMINATED'
                      ? 'bg-amber-950/60 border-amber-500/60 text-amber-200'
                      : 'bg-rose-950/60 border-rose-500/60 text-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{duplicateConflict.message}</span>
                  </div>
                  {duplicateConflict.kind === 'ACTIVE' && duplicateConflict.existingWo?.id && (
                    <button
                      type="button"
                      onClick={() => setSeparateForm((p) => ({ ...p, mode: 'existing_ot', target_existing_wo_id: duplicateConflict.existingWo.id }))}
                      className="px-2 py-1 rounded-lg bg-white text-slate-900 text-[10px] font-black shrink-0 cursor-pointer"
                    >
                      Usar esa OT existente
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">OT Destino:</label>
              <select
                value={separateForm.target_existing_wo_id}
                onChange={(e) => setSeparateForm((p) => ({ ...p, target_existing_wo_id: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold"
              >
                {existingTargets.map((w) => (
                  <option key={w.id} value={w.id}>{w.ot_number} &bull; {w.title}</option>
                ))}
              </select>
            </div>
          )}

          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={separateForm.migrate_all_wo_costs}
              onChange={(e) => setSeparateForm((p) => ({ ...p, migrate_all_wo_costs: e.target.checked }))}
              className="w-4 h-4 rounded accent-amber-500"
            />
            <span className="font-bold text-slate-200">Trasladar todos los gastos vinculados de esta OT hacia el destino</span>
          </label>

          {separateForm.migrate_all_wo_costs && (
            <WorkOrderCostPreviewBox
              summary={summary}
              loading={loadingSummary}
              error={summaryError}
              title="Movimientos vinculados que se van a mover:"
            />
          )}

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">Motivo de Separación *</label>
            <input
              type="text"
              required
              value={separateForm.reason}
              onChange={(e) => setSeparateForm((p) => ({ ...p, reason: e.target.value }))}
              onBlur={() => setSeparateForm((p) => ({ ...p, reason: (p.reason || '').trim() }))}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-semibold cursor-pointer">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingSeparate || Boolean(duplicateConflict)}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black rounded-xl cursor-pointer"
            >
              {savingSeparate ? 'Separando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
