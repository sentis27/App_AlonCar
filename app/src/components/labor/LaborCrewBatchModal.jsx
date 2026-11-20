import React from 'react'
import { Users, Save, Layers, RotateCcw } from 'lucide-react'
import { LABOR_CREW_STEP_HELP } from '../../lib/businessHelpRegistry.js'
import { CanonicalStepperModal, CanonicalStepperStep } from '../canonical/CanonicalStepperModal.jsx'
import LaborCascadeHeader from './LaborCascadeHeader.jsx'
import LaborCrewGridSection from './LaborCrewGridSection.jsx'

/**
 * Opción 2 de Zona 1: Carga en Cuadrilla (Cascada Barco ➔ Contratista/Grupo ➔ OT).
 * Stepper Vertical Zero-Scroll de 2 pasos (modelo Pañol) con ancho generoso (`max-w-6xl`).
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
  const handleConfirmSubmit = async (e) => {
    const ok = await actions.handleSubmitBatch(e)
    if (ok) onClose()
  }

  return (
    <CanonicalStepperModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidthClass="max-w-6xl"
      icon={
        <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
          <Users className="w-4 h-4" />
        </div>
      }
      title="CARGA DE HORAS EN CUADRILLA (CASCADA BARCO ➔ OPERARIO ➔ OT)"
      headerRight={
        <>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => actions.setIsMultiOtMode((prev) => !prev)}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
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
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold rounded-lg border border-slate-700 flex items-center gap-1.5 cursor-pointer"
            title="Cargar la última cuadrilla guardada"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Replicar Anterior</span>
          </button>
        </>
      }
      onSubmit={handleConfirmSubmit}
      footerLeft={
        <>
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
        </>
      }
      footerRight={
        <>
          <button
            type="button"
            tabIndex={-1}
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={actions.submitting}
            className="px-5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-lg shadow-emerald-500/20"
          >
            <Save className="w-4 h-4" />
            <span>{actions.submitting ? 'Guardando...' : 'Confirmar Registro Grupal'}</span>
          </button>
        </>
      }
    >
      <CanonicalStepperStep
        step={1}
        helpEntry={LABOR_CREW_STEP_HELP[1]}
        title="DESTINO EN CASCADA, FECHA Y MODALIDAD"
        subtitle="Barco ➔ Contratista/Grupo ➔ OT (Solo En ejecución) · Centro Costo: CLIENTE"
      >
        <LaborCascadeHeader
          compact={true}
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
      </CanonicalStepperStep>

      <CanonicalStepperStep
        step={2}
        helpEntry={LABOR_CREW_STEP_HELP[2]}
        title={`CUADRILLA DE OPERARIOS (${crew.operariosRows.length})`}
        subtitle="Control 9hs Astillero · Puerta de Emergencia de Rubro · Multi-Barco"
        isLast={true}
      >
        <div className="max-h-[44vh] overflow-y-auto pr-1">
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
      </CanonicalStepperStep>
    </CanonicalStepperModal>
  )
}
