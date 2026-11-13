import { AlertTriangle, RotateCcw, RotateCw } from 'lucide-react'
import CrawlerSearchBar from '../CrawlerSearchBar'
import { STATUS_OPTIONS } from '../../lib/comprasConstants'

export default function ComprasPedidosToolbar({
  searchQuery,
  setSearchQuery,
  searchInputRef,
  onClearAllFilters,
  viewMode,
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
          {viewMode === 'completa' && (
            <select
              value={filterSupplier}
              onChange={(e) => setFilterSupplier(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 max-w-[160px]"
            >
              <option value="TODOS">Todos los Proveedores</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.is_gas_supplier ? '💨' : ''}
                </option>
              ))}
            </select>
          )}

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
            title={STATUS_OPTIONS.find((s) => s.value === filterStatus)?.tooltip || 'Filtrar por estado'}
          >
            {STATUS_OPTIONS.map((st) => (
              <option key={st.value} value={st.value} title={st.tooltip}>
                {st.label}
              </option>
            ))}
          </select>

          <select
            value={filterFortnight}
            onChange={(e) => setFilterFortnight(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="TODAS">Todas las Quincenas</option>
            {availableFortnights.map((fn) => (
              <option key={fn} value={fn}>
                {fn === currentFortnight ? `★ ${fn} (Actual)` : fn}
              </option>
            ))}
          </select>

          <select
            value={filterChargeType}
            onChange={(e) => setFilterChargeType(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="TODOS">Todos los Destinos</option>
            <option value="DIRECT">Directo para Obra</option>
            <option value="VIA_PANOL">Para Pañol / Stock</option>
            <option value="STANDBY">Stand-by en Depósito</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5 border-l border-slate-800 pl-2.5">
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
