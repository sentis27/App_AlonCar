import CrawlerSearchBar from '../CrawlerSearchBar'
import { Package } from 'lucide-react'

export default function PanolToolbar({
  searchQuery,
  setSearchQuery,
  searchInputRef,
  filterPeriod,
  setFilterPeriod,
  filterCategory,
  setFilterCategory,
  filterShip,
  setFilterShip,
  filterStockOnly,
  setFilterStockOnly,
  activeTab,
  ships
}) {
  return (
    <div className="alon-zone-toolbar p-3 space-y-2.5 font-sans">
      <CrawlerSearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        inputRef={searchInputRef}
        placeholder="Buscar material, barco, OT, contratista, notas... [Ctrl+F | Esc limpia]"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-semibold"
          >
            <option value="TODOS">Todos los Períodos</option>
            <option value="HOY">Solo Hoy</option>
            <option value="QUINCENA">Quincena Actual</option>
            <option value="MES">Mes Actual</option>
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-semibold"
          >
            <option value="TODAS">Todas las Categorías</option>
            <option value="MATERIALES">MATERIALES</option>
            <option value="CONSUMIBLES">CONSUMIBLES</option>
            <option value="ELEM.SEGURIDAD">ELEM.SEGURIDAD</option>
            <option value="GASES">GASES</option>
          </select>
          <select
            value={filterShip}
            onChange={(e) => setFilterShip(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-semibold"
          >
            <option value="TODOS">Todos los Barcos</option>
            {ships.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {activeTab === 'catalogo' && (
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
          )}
        </div>
      </div>
    </div>
  )
}
