import CanonicalZone3Toolbar from '../canonical/CanonicalZone3Toolbar'
import CanonicalHistoryRangeSelect from '../canonical/CanonicalHistoryRangeSelect'
import { Package, Lock, Scissors, AlertTriangle } from 'lucide-react'
import {
  getFilterPillClass,
  getFilterSelectClass,
  resolveOtFilterOptions
} from '../../lib/filterThemeConstants'

export default function PanolToolbar({
  searchQuery,
  setSearchQuery,
  searchInputRef,
  filterPeriod,
  setFilterPeriod,
  filterCategory,
  setFilterCategory,
  filterMaterialQuick = '',
  setFilterMaterialQuick,
  onlyZeroCost = false,
  setOnlyZeroCost,
  unvaluedCount = 0,
  activeKpiFilter = null,
  onClearZeroCostKpi = null,
  onExportPlateCuts,
  filterShip,
  setFilterShip,
  filterOt = 'TODAS',
  setFilterOt,
  filterContractor = 'TODOS',
  setFilterContractor,
  filterStockOnly,
  setFilterStockOnly,
  isAdmin = true,
  activeTab,
  ships = [],
  workOrders = [],
  workItems = [],
  contractorOptions = [],
  hasActiveFilters = false,
  onClearAllFilters,
  gridHistory = null,
  viewsController,
  historyRange = '90d',
  setHistoryRange,
  loading = false
}) {
  const otOptions = resolveOtFilterOptions(workOrders, workItems, filterShip)

  const filtersNode =
    activeTab === 'planillas' || activeTab === 'catalogo' ? (
      <>
        {activeTab === 'planillas' && (
          <>
            {setHistoryRange && (
              <CanonicalHistoryRangeSelect value={historyRange} onChange={setHistoryRange} loading={loading} />
            )}
            {/* 1. Período (Índigo) */}
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              className={getFilterSelectClass('period', filterPeriod !== 'TODOS')}
              title="Filtrar por Período"
            >
              <option value="TODOS" className="bg-slate-900">Todos los Períodos</option>
              <option value="HOY" className="bg-slate-900">Solo Hoy</option>
              <option value="QUINCENA" className="bg-slate-900">Quincena Actual</option>
              <option value="MES" className="bg-slate-900">Mes Actual</option>
            </select>

            {/* 2. Barco (Cian) */}
            <select
              value={filterShip}
              onChange={(e) => {
                setFilterShip(e.target.value)
                setFilterOt?.('TODAS')
              }}
              className={getFilterSelectClass('ship', filterShip !== 'TODOS', 'max-w-[165px]')}
              title="Filtrar por Barco"
            >
              <option value="TODOS" className="bg-slate-900">Todos los Barcos</option>
              {ships.map((s) => (
                <option key={s.id} value={s.id} className="bg-slate-900">
                  {s.name}
                </option>
              ))}
            </select>

            {/* 3. Orden de Trabajo (Esmeralda) */}
            {setFilterOt && (
              <select
                value={filterOt}
                onChange={(e) => setFilterOt(e.target.value)}
                className={getFilterSelectClass('ot', filterOt !== 'TODAS', 'max-w-[175px]')}
                title="Filtrar por Orden de Trabajo"
              >
                <option value="TODAS" className="bg-slate-900">Todas las OTs</option>
                <option value="SIN_OT" className="bg-slate-900">⚠️ Sin OT</option>
                {otOptions.map((w) => (
                  <option key={w.id} value={w.id} className="bg-slate-900">
                    {w.ot_number} • {w.title}
                  </option>
                ))}
              </select>
            )}

            {/* 4. Contratista / Operario (Ámbar) */}
            {setFilterContractor && (
              <select
                value={filterContractor}
                onChange={(e) => setFilterContractor(e.target.value)}
                className={getFilterSelectClass('contractor', filterContractor !== 'TODOS', 'max-w-[180px]')}
                title="Filtrar por Contratista u Operario"
              >
                <option value="TODOS" className="bg-slate-900">Todos los Contratistas</option>
                {contractorOptions.map((c) => (
                  <option key={c} value={c} className="bg-slate-900">
                    {c}
                  </option>
                ))}
              </select>
            )}
          </>
        )}

        {/* 5. Categoría (Azul Cielo) */}
        {activeTab !== 'gases' && (
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className={getFilterSelectClass('category', filterCategory !== 'TODAS')}
            title="Filtrar por Categoría"
          >
            <option value="TODAS" className="bg-slate-900">Todas las Categorías</option>
            <option value="MATERIALES" className="bg-slate-900">MATERIALES</option>
            <option value="CONSUMIBLES" className="bg-slate-900">CONSUMIBLES</option>
            <option value="ELEM.SEGURIDAD" className="bg-slate-900">ELEM.SEGURIDAD</option>
            <option value="GASES" className="bg-slate-900">GASES</option>
          </select>
        )}

        {/* 5b. Píldora rápida Chapa + Reporte de Parches + Sin Valor $0 (solo en Planilla de Retiros) */}
        {activeTab === 'planillas' && (
          <>
            {setFilterMaterialQuick && (
              <>
                <button
                  type="button"
                  onClick={() => setFilterMaterialQuick(filterMaterialQuick === 'CHAPA' ? '' : 'CHAPA')}
                  className={getFilterPillClass('materialQuick', filterMaterialQuick === 'CHAPA')}
                  title="Filtrar automáticamente todos los retiros de Chapa / parches"
                >
                  <span>Chapa</span>
                </button>
                {filterMaterialQuick === 'CHAPA' && onExportPlateCuts && (
                  <button
                    type="button"
                    onClick={onExportPlateCuts}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-500/60 text-cyan-200 hover:text-white cursor-pointer transition-colors"
                    title="Exportar informe trazado de cortes y parches de chapa (Medidas, Área, Fecha Reporte/Carga y Ubicación)"
                  >
                    <Scissors className="w-3.5 h-3.5 text-cyan-300" />
                    <span>Reporte Parches (.csv)</span>
                  </button>
                )}
              </>
            )}
            {isAdmin && setOnlyZeroCost && (() => {
              const isZeroActive = Boolean(onlyZeroCost || activeKpiFilter === 'sin_precio')
              return (
                <button
                  type="button"
                  onClick={() => {
                    if (activeKpiFilter === 'sin_precio') {
                      onClearZeroCostKpi?.()
                      setOnlyZeroCost(false)
                    } else {
                      setOnlyZeroCost(!onlyZeroCost)
                    }
                  }}
                  className={getFilterPillClass('status', isZeroActive)}
                  title="Filtrar retiros con material asignado sin valor ($0) — incluye EPP, excluye filas en blanco y bajas pendientes"
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Sin Valor ($0)</span>
                  {unvaluedCount > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${isZeroActive ? 'bg-rose-400 text-slate-950' : 'bg-rose-500/25 text-rose-200'}`}>
                      {unvaluedCount}
                    </span>
                  )}
                </button>
              )
            })()}
          </>
        )}

        {activeTab === 'catalogo' && (
          isAdmin ? (
            <button
              type="button"
              onClick={() => setFilterStockOnly(!filterStockOnly)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterStockOnly ? 'bg-cyan-950 border-cyan-500 text-cyan-300 shadow-md' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Solo con Control de Stock</span>
            </button>
          ) : (
            <span
              className="px-2.5 py-1.5 rounded-lg border border-cyan-500/40 bg-cyan-950/60 text-cyan-300 text-xs font-bold inline-flex items-center gap-1.5 cursor-help"
              title="En Pañolero solo se listan materiales con control de stock físico. Los demás se consultan desde la pestaña Planilla de Retiros."
            >
              <Lock className="w-3 h-3 text-amber-400" />
              <span>Solo con Control de Stock</span>
            </span>
          )
        )}
      </>
    ) : null

  return (
    <CanonicalZone3Toolbar
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      searchInputRef={searchInputRef}
      searchPlaceholder="Buscar material, barco, OT, contratista, notas... [Ctrl+F | Esc limpia]"
      viewsController={viewsController}
      filters={filtersNode}
      hasActiveFilters={hasActiveFilters}
      onClearAllFilters={onClearAllFilters}
      history={gridHistory}
    />
  )
}
