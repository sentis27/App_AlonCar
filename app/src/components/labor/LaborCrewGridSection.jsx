import React from 'react'
import { Users, Plus, Briefcase, Save, CheckCircle2, AlertCircle } from 'lucide-react'
import LaborCrewRow from './LaborCrewRow.jsx'

export default function LaborCrewGridSection({
  isMultiOtMode,
  isSelectedGroupAstillero,
  selectedContractorGroup,
  operariosRows = [],
  openRubroEmergencyIds,
  draftWorkerSummary = [],
  ships = [],
  workOrders = [],
  workItems = [],
  eligibleCatalog = null,
  isWorkersExpanded = false,
  onToggleWorkersExpanded,
  selectedShipId,
  selectedWorkOrderId,
  totalHorasNormales,
  totalHoras50,
  totalHoras100,
  totalHorasGenerales,
  submitting,
  statusMessage,
  onClearStatusMessage,
  hideFooterSubmit = false,
  compact = false,
  onAddOperarioRow,
  onUpdateRow,
  onSelectWorker,
  onRemoveRow,
  onToggleRubroEmergency,
  onResolveHomonym
}) {
  const actionButtons = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onToggleWorkersExpanded?.(!isWorkersExpanded)}
        title="Alternar entre operarios habilitados en el barco/OT (lógica Pañol) y totalidad del padrón [H]"
        className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
          isWorkersExpanded
            ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
            : 'bg-slate-900 border-slate-700 text-cyan-300 hover:border-cyan-500/50'
        }`}
      >
        {isWorkersExpanded ? '🔓 Padrón Completo [H]' : '⚓ Habilitados en Barco'}
      </button>
      {isSelectedGroupAstillero || isMultiOtMode ? (
        <button
          type="button"
          onClick={() => onAddOperarioRow({ worker_type: 'Astillero' })}
          className="px-2.5 py-1 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Operario Astillero (9h)</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onAddOperarioRow({ worker_name: selectedContractorGroup, hours_normal: 8 })}
          className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>Fila {selectedContractorGroup}</span>
        </button>
      )}
    </div>
  )

  return (
    <div className={compact ? 'space-y-2.5 w-full min-w-0' : 'alon-zone-entry p-5 md:p-6 space-y-4 w-full min-w-0'}>
      {compact ? (
        <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-800/80">
          <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {isMultiOtMode ? 'Modo Multi-Barco / Multi-OT' : (selectedContractorGroup || 'Sin contratista habilitado')}
            </span>
          </span>
          {actionButtons}
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-xs uppercase tracking-wider font-bold text-primary flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>
                Cuadrilla de Trabajo — {isMultiOtMode ? 'Modo Multi-Barco / Multi-OT Activo' : (selectedContractorGroup || 'Sin contratista habilitado')}
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              {isSelectedGroupAstillero || isMultiOtMode
                ? 'Habilitación abierta de Astillero: podés elegir cualquier operario del padrón y ajustar su rubro con la Puerta de Emergencia (🔓).'
                : `Imputación para ${selectedContractorGroup}. Podés alternar entre sus rubros habilitados del Padrón o abrir la Puerta de Emergencia.`}
            </p>
          </div>
          {actionButtons}
        </div>
      )}

      {draftWorkerSummary.length > 0 && (
        <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800/90 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
            Control Jornada:
          </span>
          {draftWorkerSummary.map(item => {
            const isAstillero = item.type === 'Astillero'
            const isExact9 = item.total === 9
            const isUnder9 = isAstillero && item.total < 9
            const isOver9 = isAstillero && item.total > 9
            return (
              <span
                key={item.name}
                className={`text-[11px] px-2 py-0.5 rounded-lg border font-mono flex items-center gap-1 ${
                  !isAstillero
                    ? 'bg-amber-950/40 border-amber-700/40 text-amber-200'
                    : isExact9
                    ? 'bg-emerald-950/50 border-emerald-700/50 text-emerald-300'
                    : isUnder9
                    ? 'bg-rose-950/60 border-rose-700/60 text-rose-300'
                    : 'bg-cyan-950/60 border-cyan-700/60 text-cyan-300'
                }`}
              >
                <strong className="font-sans">{item.name}:</strong>
                <span>
                  {item.parts.length > 1 ? `${item.parts.join('h + ')}h = ` : ''}
                  <strong>{item.total}h</strong>
                </span>
                {isAstillero && (
                  <span>
                    {isExact9 ? '✅' : isUnder9 ? '⚠️ (<9h)' : isOver9 ? '⚡ (>9h)' : ''}
                  </span>
                )}
              </span>
            )
          })}
        </div>
      )}

      <div className="space-y-2 w-full min-w-0">
        {operariosRows.map((row, index) => (
          <LaborCrewRow
            key={row.id}
            row={row}
            index={index}
            isMultiOtMode={isMultiOtMode}
            canRemove={operariosRows.length > 1}
            ships={ships}
            workOrders={workOrders}
            workItems={workItems}
            eligibleCatalog={eligibleCatalog}
            selectedContractorGroup={selectedContractorGroup}
            isWorkersExpanded={isWorkersExpanded}
            onToggleWorkersExpanded={onToggleWorkersExpanded}
            selectedShipId={selectedShipId}
            selectedWorkOrderId={selectedWorkOrderId}
            isRowEmergencyOpen={openRubroEmergencyIds.has(row.id) || Boolean(row.is_loaned_rubro)}
            onUpdateRow={onUpdateRow}
            onSelectWorker={onSelectWorker}
            onRemoveRow={onRemoveRow}
            onToggleRubroEmergency={onToggleRubroEmergency}
            onResolveHomonym={onResolveHomonym}
          />
        ))}
      </div>

      {statusMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-between transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/70 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
              : 'bg-rose-950/90 border-rose-500/70 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => onClearStatusMessage?.()}
            className="text-slate-400 hover:text-white cursor-pointer ml-3 px-1 py-0.5"
            aria-label="Cerrar mensaje"
          >
            ✕
          </button>
        </div>
      )}

      {!hideFooterSubmit && (
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="text-slate-400">Cuadrilla: </span>
              <strong className="text-white font-mono">{operariosRows.length} filas</strong>
            </div>
            <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="text-slate-400">Normales: </span>
              <strong className="text-slate-200 font-mono">{totalHorasNormales} hs</strong>
            </div>
            <div className="bg-cyan-950/60 border border-cyan-800/40 px-3 py-1.5 rounded-lg text-cyan-300">
              <span>Ext. 50%: </span>
              <strong className="font-mono">{totalHoras50} hs</strong>
            </div>
            <div className="bg-amber-950/60 border border-amber-800/40 px-3 py-1.5 rounded-lg text-amber-300">
              <span>Ext. 100%: </span>
              <strong className="font-mono">{totalHoras100} hs</strong>
            </div>
            <div className="bg-cyan-500/20 border border-cyan-500/40 px-3 py-1.5 rounded-lg text-primary">
              <span className="font-bold">Total General: </span>
              <strong className="font-mono text-sm">{totalHorasGenerales} hs</strong>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-gradient-to-r from-primary to-blue-500 text-slate-950 font-bold rounded-lg text-sm shadow-[0_0_20px_rgba(0,242,254,0.3)] hover:shadow-[0_0_30px_rgba(0,242,254,0.5)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{submitting ? 'Guardando en Supabase...' : 'Confirmar Registro Grupal'}</span>
          </button>
        </div>
      )}
    </div>
  )
}
