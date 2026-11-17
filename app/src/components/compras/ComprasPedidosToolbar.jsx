import { AlertTriangle, RotateCcw, RotateCw, X } from 'lucide-react'
import CrawlerSearchBar from '../CrawlerSearchBar'
import { STATUS_OPTIONS } from '../../lib/comprasConstants'
import {
  CLEAR_FILTER_BTN_CLASS,
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
  localPendingCount,
  onOpenMandados,
  canUndo,
  onUndo,
  canRedo,
  onRedo
}) {
  const otOptions = resolveOtFilterOptions(workOrders, workItems, filterShip)

  return (
    <div className="alon-zone-toolbar p-3 space-y-2.5 text-xs">
      <CrawlerSearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        onClear={onClearAllFilters}
        inputRef={searchInputRef}
        placeholder="Buscar por material, proveedor, buque, solicitante, factura... (Ctrl+F | Esc limpia todo)"
      />

      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
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
              className={getFilterSelectClass('ship', filterShip !== 'TODOS', 'px-2 max-w-[155px]')}
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
              className={getFilterSelectClass('ot', filterOt !== 'TODAS', 'px-2 max-w-[165px]')}
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
              className={getFilterSelectClass('supplier', filterSupplier !== 'TODOS', 'px-2 max-w-[165px]')}
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
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-l border-slate-800 pl-2.5 ml-auto">
          <button
            onClick={() => setFilterNewOnly(!filterNewOnly)}
            className={`px-2 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 cursor-pointer ${
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
              onClick={() => setHideReconciled(!hideReconciled)}
              className={`px-2 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                hideReconciled
                  ? 'bg-purple-950 border border-purple-500 text-purple-300'
                  : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Ocultar las compras que ya fueron conciliadas con factura"
            >
              <span>🟣 Ocultar Conc.</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenMandados}
            className="px-2 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/60 text-cyan-300 font-bold text-xs flex items-center gap-1 cursor-pointer"
            title="Generar mensaje de WhatsApp para el mandadero con materiales a retirar de proveedores locales"
          >
            <span>🛵 Mandados ({localPendingCount})</span>
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClearAllFilters}
              className={CLEAR_FILTER_BTN_CLASS}
              title="Limpiar todos los filtros (Esc)"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpiar filtro</span>
            </button>
          )}

          {canUndo && (
            <button
              type="button"
              onClick={onUndo}
              className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400 text-amber-300 font-bold text-xs shadow flex items-center gap-1 transition-all cursor-pointer animate-in fade-in"
              title="Deshacer el último cambio (Ctrl + Z)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Deshacer (Ctrl+Z)</span>
            </button>
          )}

          {canRedo && (
            <button
              type="button"
              onClick={onRedo}
              className="px-2 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400 text-cyan-300 font-bold text-xs shadow flex items-center gap-1 transition-all cursor-pointer animate-in fade-in"
              title="Rehacer el cambio deshecho (Ctrl + Y)"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Rehacer (Ctrl+Y)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
