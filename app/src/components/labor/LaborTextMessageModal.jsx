import React, { useEffect } from 'react'
import { MessageSquareText, X, Save, Calendar } from 'lucide-react'
import LaborTabulatorPanel from './LaborTabulatorPanel.jsx'
import LaborCrewGridSection from './LaborCrewGridSection.jsx'

/**
 * Opción 1 de Zona 1: Carga por Mensaje de Texto (WhatsApp / Audio Transcrito).
 * Modal canónico bicolumna/Chroma-Chunking con previsualización editable antes de guardar.
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
        <div className="alon-modal-header">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shrink-0">
              <MessageSquareText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black text-white truncate">
                Carga por Mensaje de Texto (Tabulador IA)
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                1. Pegá el parte de WhatsApp &rarr; 2. Tabulá y revisá barco/OT/operario &rarr; 3. Insertá en la planilla.
              </p>
            </div>
          </div>
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

        <div className="alon-modal-body space-y-4">
          <div className="alon-chunk-amber flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <label className="text-xs font-bold text-slate-200">Fecha del Parte:</label>
                <input
                  type="date"
                  autoFocus
                  value={crew.dateLogged}
                  onChange={(e) => crew.setDateLogged(e.target.value)}
                  className="bg-slate-950 border border-amber-500/50 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-200">Modalidad:</label>
                <select
                  value={crew.workType}
                  onChange={(e) => crew.setWorkType(e.target.value)}
                  className="bg-slate-950 border border-amber-500/50 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="HORA" className="bg-slate-900">Por Hora</option>
                  <option value="PRESUPUESTO" className="bg-slate-900">Presupuesto</option>
                  <option value="CONTROL" className="bg-slate-900">Control</option>
                </select>
              </div>
            </div>
            <span className="text-[11px] text-amber-200/90 font-semibold">
              Aplica la misma lógica de habilitación Operario &rarr; Barco &rarr; OT
            </span>
          </div>

          <LaborTabulatorPanel
            rawReportText={actions.rawReportText}
            setRawReportText={actions.setRawReportText}
            isTabulating={actions.isTabulating}
            tabulatorSummary={actions.tabulatorSummary}
            setTabulatorSummary={actions.setTabulatorSummary}
            operariosCount={crew.operariosRows.length}
            onConsolidateSameOtRows={actions.handleConsolidateSameOtRows}
            onTabulateMessage={actions.handleTabulateMessage}
          />

          <div className="alon-chunk-emerald space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
                2. Vista Previa Tabulada (Editable antes de guardar)
              </span>
              <span className="text-[11px] text-slate-400">
                Podés corregir barco, OT (o dejar en blanco) y rubro antes de insertar
              </span>
            </div>
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
        </div>

        <div className="alon-modal-footer flex-wrap">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
              Filas: <strong className="text-white font-mono">{crew.operariosRows.length}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-cyan-950/60 border border-cyan-800/40 text-cyan-300">
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
              <span>{actions.submitting ? 'Guardando...' : 'Confirmar e Insertar en Planilla'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
