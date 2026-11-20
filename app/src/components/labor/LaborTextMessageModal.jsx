import React from 'react'
import { MessageSquareText, Save, Calendar } from 'lucide-react'
import { LABOR_TEXT_STEP_HELP } from '../../lib/businessHelpRegistry.js'
import { CanonicalStepperModal, CanonicalStepperStep } from '../canonical/CanonicalStepperModal.jsx'
import LaborTabulatorPanel from './LaborTabulatorPanel.jsx'
import LaborCrewGridSection from './LaborCrewGridSection.jsx'

/**
 * Opción 1 de Zona 1: Carga por Mensaje de Texto (WhatsApp / Audio Transcrito).
 * Stepper Vertical Zero-Scroll (modelo Pañol: 1 ➔ 2) con ancho generoso (`max-w-6xl`)
 * y ayuda del Paso 2 desplegando hacia arriba sin generar scroll exterior.
 */
export default function LaborTextMessageModal({
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
        <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
          <MessageSquareText className="w-4 h-4" />
        </div>
      }
      title="CARGA DE HORAS POR MENSAJE DE TEXTO (TABULADOR IA)"
      onSubmit={handleConfirmSubmit}
      footerLeft={
        <>
          <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
            Filas: <strong className="text-white font-mono">{crew.operariosRows.length}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-cyan-950/60 border border-cyan-800/40 text-cyan-300">
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
            <span>{actions.submitting ? 'Guardando...' : 'Confirmar e Insertar en Planilla'}</span>
          </button>
        </>
      }
    >
      <CanonicalStepperStep
        step={1}
        helpEntry={LABOR_TEXT_STEP_HELP[1]}
        title="PARTE DE WHATSAPP / AUDIO, FECHA Y MODALIDAD"
        subtitle="Fecha ➔ Modalidad ➔ Pegar parte y Tabular"
        headerRight={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              <input
                type="date"
                autoFocus
                value={crew.dateLogged}
                onChange={(e) => crew.setDateLogged(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>
            <select
              value={crew.workType}
              onChange={(e) => crew.setWorkType(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-bold focus:outline-none focus:border-cyan-400"
            >
              <option value="HORA" className="bg-slate-900">Por Hora</option>
              <option value="PRESUPUESTO" className="bg-slate-900">Presupuesto</option>
              <option value="CONTROL" className="bg-slate-900">Control</option>
            </select>
          </div>
        }
      >
        <LaborTabulatorPanel
          compact={true}
          rawReportText={actions.rawReportText}
          setRawReportText={actions.setRawReportText}
          isTabulating={actions.isTabulating}
          tabulatorSummary={actions.tabulatorSummary}
          setTabulatorSummary={actions.setTabulatorSummary}
          operariosCount={crew.operariosRows.length}
          onConsolidateSameOtRows={actions.handleConsolidateSameOtRows}
          onTabulateMessage={actions.handleTabulateMessage}
        />
      </CanonicalStepperStep>

      <CanonicalStepperStep
        step={2}
        helpEntry={LABOR_TEXT_STEP_HELP[2]}
        title={`VISTA PREVIA TABULADA (${crew.operariosRows.length} FILAS)`}
        subtitle="Editable antes de insertar en la planilla"
        isLast={true}
      >
        <div className="max-h-[42vh] overflow-y-auto pr-1">
          <LaborCrewGridSection
            compact={true}
            hideFooterSubmit={true}
            isMultiOtMode={true}
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
