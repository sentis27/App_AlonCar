import { AlertTriangle } from 'lucide-react'
import CanonicalZone3Toolbar from '../canonical/CanonicalZone3Toolbar'
import { STATUS_OPTIONS } from '../../lib/comprasConstants'
import {
  getFilterSelectClass,
  resolveOtFilterOptions
} from '../../lib/filterThemeConstants'

export default function ComprasPedidosToolbar({
  searchQuery,
  setSearchQuery,
  searchInputRef,
  hasActiveFilters = false,
  onClearAllFilters,
  viewMode,
  filterShip = 'TODOS',
  setFilterShip,
  filterOt = 'TODAS',
  setFilterOt,
  ships = [],
  workOrders = [],
  workItems = [],
  filterSupplier,
  setFilterSupplier,
  suppliers,
  filterStatus,
  setFilterStatus,
  filterFortnight,
  setFilterFortnight,
  availableFortnights,
  currentFortnight,
  filterChargeType,
  setFilterChargeType,
  filterNewOnly,
  setFilterNewOnly,
  newMaterialsCount,
  hideReconciled,
  setHideReconciled,
  history = null,
  viewsController
}) {
  const otOptions = resolveOtFilterOptions(workOrders, workItems, filterShip)

  return (
    <CanonicalZone3Toolbar
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      searchInputRef={searchInputRef}
      searchPlaceholder="Buscar por material, proveedor, buque, solicitante, factura... (Ctrl+F | Esc limpia todo)"
      viewsController={viewsController}
      hasActiveFilters={hasActiveFilters}
      onClearAllFilters={onClearAllFilters}
      history={history}
      filters={
        <>
          {/* 1. Destino (Azul Cielo) */}
          <select
            value={filterChargeType}
            onChange={(e) => setFilterChargeType(e.target.value)}
            className={getFilterSelectClass('destination', filterChargeType !== 'TODOS', 'px-2')}
            title="Filtrar por Destino"
          >
            <option value="TODOS" className="bg-slate-900">Todos los Destinos</option>
            <option value="DIRECT" className="bg-slate-900">Directo para Obra</option>
            <option value="VIA_PANOL" className="bg-slate-900">Para Pañol / Stock</option>
            <option value="STANDBY" className="bg-slate-900">Stand-by en Depósito</option>
          </select>

          {/* 2. Barco (Cian) */}
          {setFilterShip && (
            <select
              value={filterShip}
              onChange={(e) => {
                setFilterShip(e.target.value)
                setFilterOt?.('TODAS')
              }}
              className={getFilterSelectClass('ship', filterShip !== 'TODOS', 'px-2 max-w-[145px]')}
              title="Filtrar por Barco"
            >
              <option value="TODOS" className="bg-slate-900">Todos los Barcos</option>
              {ships.map((s) => (
                <option key={s.id} value={s.id} className="bg-slate-900">
                  {s.name}
                </option>
              ))}
            </select>
          )}

          {/* 3. Orden de Trabajo (Esmeralda) */}
          {setFilterOt && (
            <select
              value={filterOt}
              onChange={(e) => setFilterOt(e.target.value)}
              className={getFilterSelectClass('ot', filterOt !== 'TODAS', 'px-2 max-w-[155px]')}
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

          {/* 4. Proveedores (Púrpura) */}
          {viewMode === 'completa' && (
            <select
              value={filterSupplier}
              onChange={(e) => setFilterSupplier(e.target.value)}
              className={getFilterSelectClass('supplier', filterSupplier !== 'TODOS', 'px-2 max-w-[155px]')}
              title="Filtrar por Proveedor"
            >
              <option value="TODOS" className="bg-slate-900">Todos los Proveedores</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id} className="bg-slate-900">
                  {s.name} {s.is_gas_supplier ? '💨' : ''}
                </option>
              ))}
            </select>
          )}

          {/* 5. Estado (Rosa) */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={getFilterSelectClass('status', filterStatus !== 'TODOS', 'px-2')}
            title={STATUS_OPTIONS.find((s) => s.value === filterStatus)?.tooltip || 'Filtrar por estado'}
          >
            {STATUS_OPTIONS.map((st) => (
              <option key={st.value} value={st.value} title={st.tooltip} className="bg-slate-900">
                {st.label}
              </option>
            ))}
          </select>

          {/* 6. Quincena (Índigo) */}
          <select
            value={filterFortnight}
            onChange={(e) => setFilterFortnight(e.target.value)}
            className={getFilterSelectClass('period', filterFortnight !== 'TODAS', 'px-2')}
            title="Filtrar por Quincena"
          >
            <option value="TODAS" className="bg-slate-900">Todas las Quincenas</option>
            {availableFortnights.map((fn) => (
              <option key={fn} value={fn} className="bg-slate-900">
                {fn === currentFortnight ? `★ ${fn} (Actual)` : fn}
              </option>
            ))}
          </select>

          {/* 7. Píldoras de filtro rápido propias de Compras */}
          <button
            type="button"
            onClick={() => setFilterNewOnly(!filterNewOnly)}
            className={`px-2 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1 cursor-pointer ${
              filterNewOnly
                ? 'bg-rose-950 border border-rose-500 text-rose-300'
                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Filtrar materiales que no existen en base maestra"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>Nuevos ({newMaterialsCount})</span>
          </button>

          {viewMode === 'completa' && (
            <button
              type="button"
              onClick={() => setHideReconciled(!hideReconciled)}
              className={`px-2 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                hideReconciled
                  ? 'bg-purple-950 border border-purple-500 text-purple-300'
                  : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Ocultar las compras que ya fueron conciliadas con factura"
            >
              <span>🟣 Ocultar Conc.</span>
            </button>
          )}
        </>
      }
    />
  )
}
