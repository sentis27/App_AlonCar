import CrawlerSearchBar from '../CrawlerSearchBar'
import { X, Undo2, Redo2 } from 'lucide-react'
import { ESTADOS_TRABAJO } from '../../lib/workOrdersConstants'

export default function WorkOrdersToolbar({
  searchQuery,
  setSearchQuery,
  searchInputRef,
  selectedShipFilter,
  setSelectedShipFilter,
  selectedOtFilter,
  setSelectedOtFilter,
  selectedStatusFilter,
  setSelectedStatusFilter,
  selectedForemanFilter,
  setSelectedForemanFilter,
  selectedContractorFilter,
  setSelectedContractorFilter,
  ships = [],
  workOrders = [],
  foremenList = [],
  contractorCatalog = [],
  hasActiveFilters,
  onClearAllFilters,
  activeMainTab,
  woGrid
}) {
  return (
    <div className="alon-zone-toolbar p-3 space-y-2.5 font-sans">
      <CrawlerSearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        inputRef={searchInputRef}
        placeholder="Buscar por barco, OT, trabajo, contratista... [Ctrl+F | Esc limpia]"
      />

      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de Barco */}
          <select
            value={selectedShipFilter}
            onChange={(e) => setSelectedShipFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyan-400 font-semibold max-w-[150px]"
            title="Filtrar por Barco"
          >
            <option value="todos">Todos los Barcos</option>
            {ships.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Selector de OT */}
          <select
            value={selectedOtFilter}
            onChange={(e) => setSelectedOtFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyan-400 font-semibold max-w-[160px]"
            title="Filtrar por Orden de Trabajo"
          >
            <option value="todas">Todas las OTs</option>
            {workOrders
              .filter((w) => selectedShipFilter === 'todos' || w.ship_id === selectedShipFilter)
              .map((w) => (
                <option key={w.id} value={w.id}>
                  {w.ot_number} • {w.title}
                </option>
              ))}
          </select>

          {/* Selector de Estado */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyan-400 font-semibold max-w-[150px]"
            title="Filtrar por Estado del Trabajo"
          >
            <option value="todos">Todos los Estados</option>
            {ESTADOS_TRABAJO.map((st) => (
              <option key={st.value} value={st.value}>
                {st.value}
              </option>
            ))}
          </select>

          {/* Selector de Jefe de Obra */}
          <select
            value={selectedForemanFilter}
            onChange={(e) => setSelectedForemanFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyan-400 font-semibold max-w-[150px]"
            title="Filtrar por Jefe de Obra"
          >
            <option value="todos">Todos los Jefes</option>
            {foremenList.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          {/* Selector de Contratista */}
          <select
            value={selectedContractorFilter}
            onChange={(e) => setSelectedContractorFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyan-400 font-semibold max-w-[170px]"
            title="Filtrar por Contratista o Taller"
          >
            <option value="todos">Todos los Contratistas</option>
            {contractorCatalog.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} {c.can_charge_third_party ? '[3ros]' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClearAllFilters}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-slate-700"
              title="Limpiar todos los filtros y búsqueda (Esc)"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpiar</span>
            </button>
          )}

          {activeMainTab === 'unificado' && woGrid && (
            <div className="flex items-center gap-1 bg-slate-950/90 border border-slate-800 rounded-xl p-1 shrink-0">
              <button
                type="button"
                disabled={!woGrid.canUndo}
                onClick={woGrid.undo}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                title="Deshacer en Planilla OTs (Ctrl + Z)"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={!woGrid.canRedo}
                onClick={woGrid.redo}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                title="Rehacer en Planilla OTs (Ctrl + Y)"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
