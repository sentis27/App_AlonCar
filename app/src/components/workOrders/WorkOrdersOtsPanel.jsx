import { Ship, Eye, Trash2, GitBranch, Lock } from 'lucide-react'
import HighlightText from '../HighlightText'
import {
  ESTADOS_TRABAJO,
  formatShortDate,
  computeOtState,
  isWorkItemEliminada
} from '../../lib/workOrdersConstants'
import { matchesUniversalSearch } from '../../lib/searchEngine'

export default function WorkOrdersOtsPanel({
  workOrders = [],
  itemsByWoMap = {},
  otMetricsAndDatesMap = {},
  thirdPartyByItemMap = {},
  selectedShipFilter = 'todos',
  searchQuery = '',
  onOpenNewWorkModal,
  onOpenEditWorkModal,
  onOpenSeparateModal,
  onOpenCloseTreeModal,
  setSelectedWoDetail,
  onDeleteWo
}) {
  const filteredWos = workOrders.filter((w) => {
    if (selectedShipFilter !== 'todos' && w.ship_id !== selectedShipFilter) return false
    if (searchQuery.trim()) {
      const items = itemsByWoMap[w.id] || []
      const matchSearch = matchesUniversalSearch(
        {
          ...w,
          shipName: w.ships?.name,
          otNumber: w.ot_number,
          otTitle: w.title,
          itemsText: items
            .map((it) => `${it.description || ''} ${(it.contractors || []).join(' ')} ${it.foreman_name || ''}`)
            .join(' ')
        },
        searchQuery
      )
      if (!matchSearch) return false
    }
    return true
  })

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 font-sans">
      {filteredWos.length === 0 ? (
        <div className="col-span-full py-16 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
          No hay Órdenes de Trabajo para los filtros seleccionados.
        </div>
      ) : (
        filteredWos.map((wo) => {
          const items = itemsByWoMap[wo.id] || []
          const computed = computeOtState(wo, items)
          const datesAndMetrics = otMetricsAndDatesMap[wo.id] || {
            totalHours: 0,
            createdDate: wo.created_at ? String(wo.created_at).split('T')[0] : null,
            startDate: null,
            endDate: null
          }

          return (
            <div
              key={wo.id}
              className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 flex flex-col justify-between space-y-4 shadow-xl"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-xs font-black text-primary px-2.5 py-0.5 rounded bg-primary/10 border border-primary/30">
                      <HighlightText text={wo.ot_number} query={searchQuery} />
                    </span>
                    {typeof onOpenCloseTreeModal === 'function' && !computed.isEliminada && wo.status !== 'Facturada' && (
                      <button
                        type="button"
                        onClick={() => onOpenCloseTreeModal(wo)}
                        className="px-2 py-0.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        title="Cerrar o dar por finalizadas todas las subtareas de esta OT en 1 clic"
                      >
                        <Lock className="w-2.5 h-2.5 text-purple-400" />
                        <span>Cerrar Árbol</span>
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${computed.color}`}>
                      {computed.label}
                    </span>
                    {computed.isEliminada && (
                      <span className="px-2 py-0.5 rounded bg-rose-950/90 text-rose-300 border border-rose-700 text-[9px] font-black uppercase">
                        🗑️ Eliminada
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-1">
                  <Ship className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-white font-bold">
                    <HighlightText text={wo.ships?.name} query={searchQuery} />
                  </span>
                </div>

                <h3 className="text-base font-black text-white">
                  <HighlightText text={wo.title} query={searchQuery} />
                </h3>

                {/* Lista resumida de trabajos hijos dentro de esta OT con botón Separar */}
                <div className="mt-3 space-y-1.5 border-t border-slate-800 pt-3">
                  <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400">
                    <span>Trabajos en esta OT ({items.length})</span>
                    <button
                      type="button"
                      onClick={() => onOpenNewWorkModal(wo)}
                      className="text-primary hover:underline cursor-pointer"
                    >
                      + Agregar Trabajo
                    </button>
                  </div>

                  {items.map((item) => {
                    const st = ESTADOS_TRABAJO.find((s) => s.value === item.status) || ESTADOS_TRABAJO[0]
                    const itemElim = isWorkItemEliminada(item, wo)
                    return (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 flex items-start justify-between gap-2 text-xs"
                      >
                        <div
                          onClick={() =>
                            onOpenEditWorkModal({
                              ...item,
                              wo,
                              thirdPartyRecord: thirdPartyByItemMap[item.id]
                            })
                          }
                          className="truncate flex-1 cursor-pointer"
                        >
                          <span className="text-slate-200 block truncate">
                            <HighlightText text={item.description || 'Sin descripción'} query={searchQuery} />
                          </span>
                          {(item.contractors || []).length > 0 && (
                            <span className="text-[10px] font-mono text-cyan-400">
                              <HighlightText text={item.contractors.join(', ')} query={searchQuery} />
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${st.color}`}>
                              {item.status}
                            </span>
                            {item.status === 'Desestimado' && itemElim && (
                              <span className="text-[8px] px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-700 font-black uppercase">
                                🗑️ Eliminada
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => onOpenSeparateModal({ ...item, wo })}
                            className="p-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 cursor-pointer"
                            title="Separar este trabajo en una OT propia o moverlo a otro contenedor"
                          >
                            <GitBranch className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* BANDA DE HORAS IMPUTADAS + LAS 3 FECHAS DE LA OT (Creación, Inicio Real y Fin Real) */}
              <div className="pt-3 border-t border-slate-800 space-y-2.5">
                <div className="grid grid-cols-4 gap-1.5 p-2 rounded-xl bg-slate-950/90 border border-slate-800/80 font-mono text-center">
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block">Horas Imp.</span>
                    <strong className="text-xs text-primary font-extrabold">{datesAndMetrics.totalHours} hs</strong>
                  </div>
                  <div title="Fecha automática de creación del reporte de esta OT">
                    <span className="text-[9px] text-slate-500 uppercase block">F. Creación</span>
                    <strong className="text-[11px] text-slate-200 font-bold">
                      {formatShortDate(datesAndMetrics.createdDate)}
                    </strong>
                  </div>
                  <div
                    title={
                      datesAndMetrics.startDate
                        ? `1º dato cargado en todo el sistema (${datesAndMetrics.startSource}): ${formatShortDate(datesAndMetrics.startDate, true)}`
                        : 'Aún sin cargas en Horas, Materiales ni Terceros'
                    }
                  >
                    <span className="text-[9px] text-emerald-400/80 uppercase block">F. Inicio</span>
                    <strong className="text-[11px] text-emerald-300 font-bold">
                      {formatShortDate(datesAndMetrics.startDate)}
                    </strong>
                  </div>
                  <div
                    title={
                      datesAndMetrics.endDate
                        ? `Último dato cargado a la OT (${datesAndMetrics.endSource}): ${formatShortDate(datesAndMetrics.endDate, true)}`
                        : 'Aún sin cargas en Horas, Materiales ni Terceros'
                    }
                  >
                    <span className="text-[9px] text-cyan-400/80 uppercase block">F. Final</span>
                    <strong className="text-[11px] text-cyan-300 font-bold">
                      {formatShortDate(datesAndMetrics.endDate)}
                    </strong>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-[10px] text-slate-400">
                    Jefe Obra: <strong className="text-amber-300">{wo.foreman_name || 'S/A'}</strong>
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedWoDetail(wo)}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5 text-primary" />
                      <span>Ficha / Cierre</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteWo(wo)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 cursor-pointer"
                      title="Desestimar OT por eliminación (conserva el consecutivo)"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
