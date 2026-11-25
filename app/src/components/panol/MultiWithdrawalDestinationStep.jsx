import { AlertTriangle, Plus, UserPlus } from 'lucide-react'
import { getContractorEnabledWos, normalizeText } from '../../lib/allocationEngine'
import { WorkOrderSelectorWithHover } from '../workOrders/WorkOrderSelectorWithHover.jsx'
import PanolContractorSelect from './PanolContractorSelect.jsx'

/**
 * Paso 1 del Stepper Vertical de Retiro Multi-Material:
 * Cascada Naval (Barco ➔ Operario/Contratista ➔ Orden de Trabajo) con tooltip flotante canónico (FL-002).
 */
export default function MultiWithdrawalDestinationStep({
  ships, workOrders, workItems, astilleroWorkers, contractorGroups, unauthorizedWorkers,
  getEnabledWorkersAndContractors, shipId, setShipId, contractorGroup, setContractorGroup,
  workOrderId, setWorkOrderId, isOtEmpty, setIsOtEmpty, isExpandedContractors, setIsExpandedContractors,
  enabled, shipEnabledAstSet, shipEnabledCntSet, availableWos, allocState,
  isSelectedContractorWithoutShipOt, onRequestOt, onRequestWorkerPermission
}) {
  const inputCls = 'w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400'

  const handleShipChange = (newShipId) => {
    setShipId(newShipId)
    setWorkOrderId('')
    setIsExpandedContractors(false)
    setIsOtEmpty(false)
    if (contractorGroup && newShipId && typeof getEnabledWorkersAndContractors === 'function') {
      const next = getEnabledWorkersAndContractors(newShipId, null, { strictShipFilter: true })
      const stillValid =
        next.astilleroWorkers.some((w) => normalizeText(w.name) === normalizeText(contractorGroup)) ||
        next.contractorGroups.some((g) => normalizeText(g) === normalizeText(contractorGroup))
      if (!stillValid) setContractorGroup('')
    }
  }

  const handleContractorChange = (val) => {
    setContractorGroup(val)
    if (!val) return setWorkOrderId('')
    if (shipId) {
      const wosForWorker = getContractorEnabledWos(shipId, val, workOrders, workItems, { astilleroWorkers, contractorGroups })
      if (wosForWorker.length === 0) {
        setIsOtEmpty(true)
        setWorkOrderId('')
      } else {
        setIsOtEmpty(false)
        const keepsWo = wosForWorker.some(
          (w) => String(w.id) === String(workOrderId) || (w._allWoIds || []).some((id) => String(id) === String(workOrderId))
        )
        if (workOrderId && !keepsWo) setWorkOrderId('')
      }
    }
  }

  const handleWoChange = (newWoId) => {
    setWorkOrderId(newWoId)
    setIsOtEmpty(!newWoId)
    if (contractorGroup && newWoId && typeof getEnabledWorkersAndContractors === 'function') {
      const next = getEnabledWorkersAndContractors(shipId, newWoId)
      const isValid =
        next.astilleroWorkers.some((w) => normalizeText(w.name) === normalizeText(contractorGroup)) ||
        next.contractorGroups.some((g) => normalizeText(g) === normalizeText(contractorGroup))
      if (!isValid) setContractorGroup('')
    }
  }

  return (
    <div className="flex-1 min-w-0 space-y-2.5 pb-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-black text-white uppercase tracking-wider text-xs">DESTINO E IMPUTACIÓN DE OBRA</span>
        <span className="text-[10px] text-slate-500">Barco ➔ Operario/Contratista ➔ OT</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        <div>
          <label className="block text-slate-400 font-semibold text-[11px] mb-1">
            Barco / Buque <span className="text-rose-400">*</span>
          </label>
          <select autoFocus value={shipId} onChange={(e) => handleShipChange(e.target.value)} required className={`${inputCls} font-bold`}>
            <option value="">Seleccionar Barco...</option>
            {ships.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between gap-1 mb-1">
            <label className="text-slate-400 font-semibold text-[11px] truncate">
              Operario / Contratista <span className="text-rose-400">*</span>
            </label>
            <button
              type="button" tabIndex={-1} onClick={() => onRequestWorkerPermission?.()}
              title={`Si el operario no figura porque no tiene permiso (P), enviá solicitud a Jorge Sentis (${unauthorizedWorkers.length} pendientes).`}
              className="px-1.5 py-0.5 rounded bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-500/60 text-cyan-300 font-bold text-[10px] flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
            >
              <UserPlus className="w-3 h-3" /><span>Solicitar Alta</span>
            </button>
          </div>
          <PanolContractorSelect
            value={contractorGroup}
            enabled={enabled}
            isExpanded={isExpandedContractors}
            hasScope={Boolean(shipId)}
            scopeLabel="Barco"
            enabledAstSet={shipEnabledAstSet}
            enabledCntSet={shipEnabledCntSet}
            isOtRequestPending={allocState.isOtRequestPending}
            required
            onChange={handleContractorChange}
            onToggleExpand={setIsExpandedContractors}
            onRequestOt={() => onRequestOt?.(shipId, contractorGroup || '')}
            onRequestWorkerPermission={() => onRequestWorkerPermission?.()}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-slate-400 font-semibold text-[11px]">
              Orden de Trabajo (OT) <span className="text-rose-400">*</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer text-[10px] text-amber-400" title="Por defecto destildada. Se tilda automáticamente si elegís un contratista expandido sin OT en este barco.">
              <input
                type="checkbox" tabIndex={-1} checked={isOtEmpty}
                onChange={(e) => { setIsOtEmpty(e.target.checked); if (e.target.checked) setWorkOrderId('') }}
                className="rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-0 cursor-pointer"
              />
              <span>(⚠️ Sin OT)</span>
            </label>
          </div>
          <WorkOrderSelectorWithHover
            value={workOrderId} onChange={handleWoChange} availableWos={availableWos}
            ship={ships.find((s) => s.id === shipId)} workItems={workItems} allWorkOrders={workOrders}
            contractorName={contractorGroup} disabled={isOtEmpty} isSinOt={isOtEmpty}
            placeholder="-- Seleccionar OT --" showPreviewCard={false}
          />
        </div>
      </div>

      {isSelectedContractorWithoutShipOt && isOtEmpty && (
        <div className="p-2 rounded-xl bg-amber-950/40 border border-amber-600/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-amber-200 font-semibold text-[11px]">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              <strong>{contractorGroup}</strong> no está habilitado en OTs de este buque (lista expandida): se tildó{' '}
              <strong>(⚠️ Sin OT)</strong> automáticamente.
            </span>
          </div>
          {!allocState.isOtRequestPending && (
            <button type="button" tabIndex={-1} onClick={() => onRequestOt?.(shipId, contractorGroup)} className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-[10px] cursor-pointer flex items-center gap-1 shrink-0">
              <Plus className="w-3 h-3 stroke-[3]" /><span>Solicitar OT a Admin</span>
            </button>
          )}
        </div>
      )}

      {shipId && contractorGroup && availableWos.length === 0 && !isOtEmpty && (
        <div className="p-2 rounded-xl bg-rose-950/40 border border-rose-800/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-rose-300 font-semibold text-[11px]">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>No hay OT habilitada para este contratista en este buque.</span>
          </div>
          {allocState.isOtRequestPending ? (
            <button type="button" tabIndex={-1} disabled className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-500 border border-slate-700 font-bold text-[11px] cursor-not-allowed shrink-0">
              Solicitud enviada (1)
            </button>
          ) : (
            <button type="button" tabIndex={-1} onClick={() => onRequestOt?.(shipId, contractorGroup)} className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-[11px] shadow-md cursor-pointer flex items-center gap-1 shrink-0">
              <Plus className="w-3.5 h-3.5 stroke-[3]" /><span>Solicitar Apertura de OT a Admin</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
