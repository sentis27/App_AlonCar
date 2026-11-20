import { AlertTriangle, Plus, UserPlus } from 'lucide-react'
import { getContractorEnabledWos, normalizeText } from '../../lib/allocationEngine'
import { WorkOrderSelectorWithHover } from '../workOrders/WorkOrderSelectorWithHover.jsx'

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
    if (val === '__EXPANDIR_CONTRATISTAS__') return setIsExpandedContractors(true)
    if (val === '__CONTRAER_CONTRATISTAS__') return setIsExpandedContractors(false)
    if (val === '__SOLICITAR_APERTURA_OT__') return onRequestOt?.(shipId, contractorGroup || '')
    if (val === '__SOLICITAR_HABILITACION_OPERARIO__') return onRequestWorkerPermission?.()
    setContractorGroup(val)
    if (!val) return setWorkOrderId('')
    if (shipId) {
      const wosForWorker = getContractorEnabledWos(shipId, val, workOrders, workItems, { astilleroWorkers, contractorGroups })
      if (wosForWorker.length === 0) {
        setIsOtEmpty(true)
        setWorkOrderId('')
      } else {
        setIsOtEmpty(false)
        if (workOrderId && !wosForWorker.some((w) => String(w.id) === String(workOrderId))) setWorkOrderId('')
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

  const missingCurrentContractor =
    contractorGroup &&
    !enabled.astilleroWorkers.some((w) => normalizeText(w.name) === normalizeText(contractorGroup)) &&
    !enabled.contractorGroups.some((g) => normalizeText(g) === normalizeText(contractorGroup))

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
          <select
            value={contractorGroup} onChange={(e) => handleContractorChange(e.target.value)} required
            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-cyan-400 font-black text-xs focus:outline-none focus:border-cyan-400"
          >
            <option value="">
              {shipId && !isExpandedContractors
                ? `-- Habilitados en Barco (${enabled.astilleroWorkers.length + enabled.contractorGroups.length}) --`
                : '-- Seleccionar Operario / Contratista --'}
            </option>
            {shipId && !isExpandedContractors && enabled.astilleroWorkers.length === 0 && enabled.contractorGroups.length === 0 && (
              <option value="" disabled className="text-amber-400 bg-slate-950">
                ⚠️ Sin contratistas con OT activa en este barco (usá 🔓 Expandir)
              </option>
            )}
            {missingCurrentContractor && <option value={contractorGroup}>{contractorGroup} (Actual)</option>}
            {enabled.astilleroWorkers.length > 0 && (
              <optgroup label={isExpandedContractors ? `⭐ Personal Astillero Completo (${enabled.astilleroWorkers.length})` : `⭐ Personal Astillero Habilitado (${enabled.astilleroWorkers.length})`}>
                {enabled.astilleroWorkers.map((w) => {
                  const hasShipOt = !shipId || shipEnabledAstSet.has(normalizeText(w.name))
                  return (
                    <option key={`m_ast_${w.id || w.name}`} value={w.name}>
                      {w.name}{isExpandedContractors && !hasShipOt ? ' (Sin OT en barco)' : ''}
                    </option>
                  )
                })}
              </optgroup>
            )}
            {enabled.contractorGroups.length > 0 && (
              <optgroup label={isExpandedContractors ? `🏗️ Todos los Contratistas (${enabled.contractorGroups.length})` : `🏗️ Contratistas Habilitados en Barco (${enabled.contractorGroups.length})`}>
                {enabled.contractorGroups.map((grp) => {
                  const hasShipOt = !shipId || shipEnabledCntSet.has(normalizeText(grp))
                  return (
                    <option key={`m_cnt_${grp}`} value={grp}>
                      {grp}{isExpandedContractors && !hasShipOt ? ' (Sin OT en barco)' : ''}
                    </option>
                  )
                })}
              </optgroup>
            )}
            {shipId && !isExpandedContractors && (
              <option value="__EXPANDIR_CONTRATISTAS__" className="text-amber-300 font-bold bg-slate-950">
                🔓 Expandir (Ver totalidad de operarios y contratistas)...
              </option>
            )}
            {shipId && isExpandedContractors && (
              <option value="__CONTRAER_CONTRATISTAS__" className="text-sky-300 font-bold bg-slate-950">
                🔒 Contraer (Solo habilitados del barco)
              </option>
            )}
            <option
              value="__SOLICITAR_APERTURA_OT__" disabled={allocState.isOtRequestPending}
              className={allocState.isOtRequestPending ? 'text-slate-500 bg-slate-950' : 'text-rose-400 font-bold bg-slate-950'}
            >
              {allocState.isOtRequestPending ? 'Solicitud de OT enviada (1)' : '➕ Solicitar Apertura de OT a Admin...'}
            </option>
            <option value="__SOLICITAR_HABILITACION_OPERARIO__" className="text-cyan-400 font-bold bg-slate-950">
              ➕ Solicitar Habilitación de Operario a Admin...
            </option>
          </select>
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
