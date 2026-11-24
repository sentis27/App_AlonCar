import CanonicalZone3Toolbar from '../canonical/CanonicalZone3Toolbar'
import { ESTADOS_TRABAJO } from '../../lib/workOrdersConstants'
import {
  getFilterSelectClass,
  resolveOtFilterOptions
} from '../../lib/filterThemeConstants'

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
  workItems = [],
  foremenList = [],
  contractorCatalog = [],
  hasActiveFilters,
  onClearAllFilters,
  activeMainTab,
  woGrid,
  viewsController
}) {
  const standardOtOptions = resolveOtFilterOptions(workOrders, workItems, selectedShipFilter)

  const filtersNode =
    activeMainTab !== 'terceros' ? (
      <>
        {/* 1. Barco (Cian) — aplica en Unificado y Por Barco */}
        <select
          value={selectedShipFilter}
          onChange={(e) => {
            setSelectedShipFilter(e.target.value)
            setSelectedOtFilter('todas')
          }}
          className={getFilterSelectClass('ship', selectedShipFilter !== 'todos', 'max-w-[160px]')}
          title="Filtrar por Barco"
        >
          <option value="todos" className="bg-slate-900">Todos los Barcos</option>
          {ships.map((s) => (
            <option key={s.id} value={s.id} className="bg-slate-900">
              {s.name}
            </option>
          ))}
        </select>

        {/* 2..5 Filtros exclusivos de 1. Unificado */}
        {activeMainTab === 'unificado' && (
          <>
            <select
              value={selectedOtFilter}
              onChange={(e) => setSelectedOtFilter(e.target.value)}
              className={getFilterSelectClass('ot', selectedOtFilter !== 'todas', 'max-w-[180px]')}
              title="Filtrar por Orden de Trabajo"
            >
              <option value="todas" className="bg-slate-900">Todas las OTs</option>
              {standardOtOptions.map((w) => (
                <option key={w.id} value={w.id} className="bg-slate-900">
                  {w.ot_number} • {w.title}
                </option>
              ))}
            </select>

            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className={getFilterSelectClass('status', selectedStatusFilter !== 'todos', 'max-w-[160px]')}
              title="Filtrar por Estado del Trabajo"
            >
              <option value="todos" className="bg-slate-900">Todos los Estados</option>
              {ESTADOS_TRABAJO.map((st) => (
                <option key={st.value} value={st.value} className="bg-slate-900">
                  {st.value}
                </option>
              ))}
            </select>

            <select
              value={selectedForemanFilter}
              onChange={(e) => setSelectedForemanFilter(e.target.value)}
              className={getFilterSelectClass('foreman', selectedForemanFilter !== 'todos', 'max-w-[160px]')}
              title="Filtrar por Jefe de Obra"
            >
              <option value="todos" className="bg-slate-900">Todos los Jefes</option>
              {foremenList.map((f) => (
                <option key={f} value={f} className="bg-slate-900">
                  {f}
                </option>
              ))}
            </select>

            <select
              value={selectedContractorFilter}
              onChange={(e) => setSelectedContractorFilter(e.target.value)}
              className={getFilterSelectClass('contractor', selectedContractorFilter !== 'todos', 'max-w-[180px]')}
              title="Filtrar por Contratista o Taller"
            >
              <option value="todos" className="bg-slate-900">Todos los Contratistas</option>
              {contractorCatalog.map((c) => (
                <option key={c.name} value={c.name} className="bg-slate-900">
                  {c.name} {c.can_charge_third_party ? '[3ros]' : ''}
                </option>
              ))}
            </select>
          </>
        )}
      </>
    ) : null

  return (
    <CanonicalZone3Toolbar
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      searchInputRef={searchInputRef}
      searchPlaceholder="Buscar por barco, OT, trabajo, contratista... [Ctrl+F | Esc limpia]"
      viewsController={viewsController}
      filters={filtersNode}
      hasActiveFilters={hasActiveFilters}
      onClearAllFilters={onClearAllFilters}
      history={activeMainTab === 'unificado' ? woGrid : null}
    />
  )
}
