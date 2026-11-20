import React, { useEffect } from 'react'
import { Users, X, Save, Layers, RotateCcw } from 'lucide-react'
import LaborCascadeHeader from './LaborCascadeHeader.jsx'
import LaborCrewGridSection from './LaborCrewGridSection.jsx'

/**
 * Opción 2 de Zona 1: Carga en Cuadrilla (Cascada Barco → Contratista/Grupo → OT).
 * Mantiene la lógica completa Operario → Barco → OT en formato modal de 2 pasos sin saturar la pantalla principal.
 */
export default function LaborCrewBatchModal({
  isOpen,
  onClose,
  crew,
  actions,
  ships = [],
  workOrders = [],
  workItems = [],
  statusMessage,
  onClearStatusMessage
}) {
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleConfirmSubmit = async (e) => {
    const ok = await actions.handleSubmitBatch(e)
    if (ok) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={handleConfirmSubmit} className="alon-modal-card max-w-6xl">
        <div className="alon-modal-header flex-wrap gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black text-white truncate">
                Carga en Cuadrilla (Cascada Barco &rarr; Operario &rarr; OT)
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                Carga grupal tipo planilla con control de 9hs Astillero, Puerta de Emergencia de Rubro y Multi-Barco.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              tabIndex={-1}
              onClick={() => actions.setIsMultiOtMode(prev => !prev)}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                actions.isMultiOtMode
                  ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
              }`}
              title="Permite que cada fila apunte a un Barco y OT diferente"
            >
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>{actions.isMultiOtMode ? 'Multi-Barco: ACTIVO' : 'Multi-Barco por Fila'}</span>
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={actions.replicateYesterday}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold rounded-lg border border-slate-700 flex items-center gap-1.5 cursor-pointer"
              title="Cargar la última cuadrilla guardada"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              <span>Replicar Anterior</span>
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              title="Cerrar (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="alon-modal-body space-y-4">
          <LaborCascadeHeader
            ships={ships}
            workOrders={workOrders}
            workItems={workItems}
            selectedShipId={crew.selectedShipId}
            setSelectedShipId={crew.setSelectedShipId}
            selectedContractorGroup={crew.selectedContractorGroup}
            onContractorGroupChange={crew.handleContractorGroupChange}
            enabledContractorsForShip={crew.enabledContractorsForShip}
            isHeaderContractorsExpanded={crew.isHeaderContractorsExpanded}
            selectedWorkOrderId={crew.selectedWorkOrderId}
            setSelectedWorkOrderId={crew.setSelectedWorkOrderId}
            availableWorkOrders={crew.availableWorkOrders}
            selectedWorkItemId={crew.selectedWorkItemId}
            setSelectedWorkItemId={crew.setSelectedWorkItemId}
            activeItemsForSelectedWo={crew.activeItemsForSelectedWo}
            dateLogged={crew.dateLogged}
            setDateLogged={crew.setDateLogged}
            workType={crew.workType}
            setWorkType={crew.setWorkType}
            blockedWorkItemsForShip={crew.blockedWorkItemsForShip}
            currentWorkOrder={crew.currentWorkOrder}
            currentWorkItem={crew.currentWorkItem}
          />

          <div className="alon-chunk-emerald">
            <LaborCrewGridSection
              compact={true}
              hideFooterSubmit={true}
              isMultiOtMode={actions.isMultiOtMode}
              isSelectedGroupAstillero={crew.isSelectedGroupAstillero}
              selectedContractorGroup={crew.selectedContractorGroup}
              operariosRows={crew.operariosRows}
              openRubroEmergencyIds={crew.openRubroEmergencyIds}
              draftWorkerSummary={crew.draftWorkerSummary}
              ships={ships}
              workOrders={workOrders}
              workItems={workItems}
              eligibleCatalog={crew.eligibleCatalog}
              isWorkersExpanded={crew.isWorkersExpanded}
              onToggleWorkersExpanded={crew.setIsWorkersExpanded}
              selectedShipId={crew.selectedShipId}
              selectedWorkOrderId={crew.selectedWorkOrderId}
              totalHorasNormales={crew.totalHorasNormales}
              totalHoras50={crew.totalHoras50}
              totalHoras100={crew.totalHoras100}
              totalHorasGenerales={crew.totalHorasGenerales}
              submitting={actions.submitting}
              statusMessage={statusMessage}
              onClearStatusMessage={onClearStatusMessage}
              onAddOperarioRow={crew.addOperarioRow}
              onUpdateRow={crew.updateOperarioRow}
              onSelectWorker={crew.selectOperarioForRow}
              onRemoveRow={crew.removeOperarioRow}
              onToggleRubroEmergency={crew.toggleRubroEmergency}
              onResolveHomonym={crew.resolveHomonymCandidate}
            />
          </div>
        </div>

        <div className="alon-modal-footer flex-wrap">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
              Filas: <strong className="text-white font-mono">{crew.operariosRows.length}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
              Norm: <strong className="font-mono">{crew.totalHorasNormales} hs</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-cyan-950/60 border border-cyan-800/40 text-cyan-300">
              50%: <strong className="font-mono">{crew.totalHoras50} hs</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-950/60 border border-amber-800/40 text-amber-300">
              100%: <strong className="font-mono">{crew.totalHoras100} hs</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold">
              Total: <strong className="font-mono">{crew.totalHorasGenerales} hs</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              tabIndex={-1}
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={actions.submitting}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{actions.submitting ? 'Guardando...' : 'Confirmar Registro Grupal'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
