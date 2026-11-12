import React from 'react'
import { getWorkOrderConsolidatedScope } from '../../lib/workOrdersConstants'

/**
 * Tarjeta Canónica de Previsualización y Sábana Técnica de Orden de Trabajo.
 * Idéntica a la vista de planilla (Imagen 2):
 * - Muestra OT #{otNum}: {otTitle}
 * - Muestra Buque / Destino: {buque}
 * - Muestra Alcance de Obra (N líneas):
 * - Aplica tachado Unicode y ❌ a tareas finalizadas/facturadas preservando [Finalizado]
 * - Destaca tareas en ejecución en verde [En ejecución] y coincidentes con el contratista en ámbar.
 */
export function WorkOrderScopeHoverCard({
  wo,
  ship,
  workItems = [],
  allWorkOrders = [],
  contractorFilter = '',
  isHoverPreview = false,
  className = ''
}) {
  if (!wo) return null

  const scope = getWorkOrderConsolidatedScope(wo, workItems, allWorkOrders, {
    contractorFilter,
    maxSummaryTasks: 16
  })

  const shipName = ship?.name || (typeof ship === 'string' ? ship : 'Astillero')

  return (
    <div
      className={`p-3 bg-slate-950/95 rounded-xl border-2 border-cyan-500/40 text-[11px] text-slate-200 space-y-2 animate-in fade-in duration-100 shadow-xl shadow-cyan-950/20 ${className}`}
    >
      <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-1.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-cyan-300 font-bold bg-cyan-950 px-2 py-0.5 rounded border border-cyan-700 shrink-0">
            OT #{scope.otNum}
          </span>
          <div>
            <div className="font-bold text-white text-xs">{scope.otTitle}</div>
            <div className="text-[10px] text-cyan-300">
              Buque / Destino: <strong className="text-white">{shipName}</strong>
            </div>
          </div>
        </div>
        {isHoverPreview && (
          <span className="text-[9px] text-cyan-400 font-bold bg-cyan-950/80 border border-cyan-700 px-1.5 py-0.5 rounded shrink-0">
            👁️ Vista previa (Clic para elegir)
          </span>
        )}
      </div>

      {scope.tasks && scope.tasks.length > 0 ? (
        <div className="space-y-1.5 pt-0.5 max-h-48 overflow-y-auto pr-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Alcance de Obra ({scope.tasks.length} líneas):</span>
            {contractorFilter && (
              <span className="text-amber-300 font-semibold normal-case">★ Líneas coincidentes</span>
            )}
          </div>
          {scope.tasks.map((task) => {
            const isClosed =
              task.status === 'Finalizado' ||
              task.status === 'Facturado' ||
              task.status === 'Finalizado costo final de obra' ||
              task.status === 'Desestimado'

            return (
              <div
                key={task.id || `task-${task.index}`}
                className={`p-1.5 rounded-lg border text-[11px] flex items-center justify-between gap-2 transition-colors ${
                  task.isContractorMatch
                    ? 'bg-amber-950/40 border-amber-500/60 text-white font-medium shadow-sm'
                    : isClosed
                    ? 'bg-slate-900/40 border-slate-900 text-slate-500'
                    : 'bg-slate-900/80 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono text-[10px] font-bold text-slate-400 shrink-0">
                    {isClosed ? '❌' : `• L${task.index}:`}
                  </span>
                  <span className={`truncate ${isClosed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                    {task.description}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                  <span className={`${isClosed ? 'line-through text-slate-600' : 'text-cyan-300 font-semibold'}`}>
                    {task.contractorsStr}
                  </span>
                  <span className="text-slate-500">({task.foreman_name})</span>
                  <span
                    className={`px-1 rounded text-[9px] font-bold ${
                      task.status === 'En ejecución'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                        : isClosed
                        ? 'bg-slate-900 text-slate-400 border border-slate-700'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    [{task.status}]
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-[10px] text-slate-400 italic">
          Sin subtareas registradas.
        </div>
      )}
    </div>
  )
}
export default WorkOrderScopeHoverCard
