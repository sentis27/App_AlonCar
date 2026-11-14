import React from 'react'
import { RotateCcw, RotateCw, X } from 'lucide-react'
import CrawlerSearchBar from '../CrawlerSearchBar.jsx'

export default function LaborLogsToolbar({
  filterWorker,
  setFilterWorker,
  filterDate,
  setFilterDate,
  filterShip,
  activeKpiFilter,
  onClearAllFilters,
  logSearchInputRef,
  filteredCount,
  totalCount,
  canUndo,
  canRedo,
  onUndo,
  onRedo
}) {
  const hasFilters = Boolean(filterWorker || filterDate || filterShip || (activeKpiFilter && activeKpiFilter !== 'todos'))

  return (
    <div className="alon-zone-toolbar p-3 rounded-2xl shadow-lg space-y-2.5">
      <CrawlerSearchBar
        value={filterWorker}
        onChange={setFilterWorker}
        onClear={onClearAllFilters}
        inputRef={logSearchInputRef}
        placeholder="Buscar operario, buque, OT, rubro... (Ctrl+F | Esc limpia todo)"
      />

      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
          />

          {hasFilters && (
            <button
              type="button"
              onClick={onClearAllFilters}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-slate-700"
              title="Limpiar todos los filtros (Esc)"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpiar filtros</span>
            </button>
          )}

          <span className="text-[11px] text-slate-400 whitespace-nowrap hidden sm:inline">
            Mostrando {filteredCount} de {totalCount} registros
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canUndo && (
            <button
              type="button"
              onClick={onUndo}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold shadow flex items-center gap-1 cursor-pointer border border-slate-700"
              title="Deshacer último cambio (Ctrl+Z)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          {canRedo && (
            <button
              type="button"
              onClick={onRedo}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold shadow flex items-center gap-1 cursor-pointer border border-slate-700"
              title="Rehacer cambio (Ctrl+Y)"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
