import { Undo2, Redo2, X } from 'lucide-react'
import CrawlerSearchBar from '../CrawlerSearchBar'
import { ASTILLERO_BASE_CATEGORIES } from '../../lib/personalNominaHelpers'

export default function PersonalNominaToolbar({
  searchTerm,
  setSearchTerm,
  clearAllFilters,
  nominaSearchInputRef,
  filterCenter,
  setFilterCenter,
  filterGroup,
  setFilterGroup,
  filterForemanOnly,
  setFilterForemanOnly,
  filterStatus,
  setFilterStatus,
  centerCounts,
  canUndo,
  onUndo,
  canRedo,
  onRedo,
  uniqueTrades,
  groupedSummary
}) {
  const {
    totalCount,
    astilleroCount,
    contratistasCount,
    talleresCount,
    foremenCount,
    activeCount,
    inactiveCount
  } = centerCounts

  return (
    <>
      <div className="alon-zone-toolbar p-3 rounded-2xl shadow-lg space-y-3">
        <CrawlerSearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          onClear={clearAllFilters}
          inputRef={nominaSearchInputRef}
          placeholder="Buscar por operario, grupo, rubro, DNI, valor hora US$/AR$... (Ctrl+F | Esc limpia todo)"
        />

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { setFilterCenter('todos'); setFilterGroup('todos') }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                filterCenter === 'todos' && filterGroup === 'todos'
                  ? 'bg-primary text-slate-950 font-bold'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Todos ({totalCount})
            </button>

            <button
              type="button"
              onClick={() => setFilterCenter('ASTILLERO')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                filterCenter === 'ASTILLERO'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'bg-slate-950 text-cyan-400 hover:text-cyan-300 border border-slate-800'
              }`}
            >
              Astillero Propio ({astilleroCount})
            </button>

            <button
              type="button"
              onClick={() => setFilterCenter('CONTRATISTA')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                filterCenter === 'CONTRATISTA'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-950 text-amber-400 hover:text-amber-300 border border-slate-800'
              }`}
            >
              Contratistas ({contratistasCount})
            </button>

            <button
              type="button"
              onClick={() => setFilterCenter('TALLER')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                filterCenter === 'TALLER'
                  ? 'bg-purple-500 text-slate-950 font-bold'
                  : 'bg-slate-950 text-purple-400 hover:text-purple-300 border border-slate-800'
              }`}
            >
              Talleres ({talleresCount})
            </button>

            <button
              type="button"
              onClick={() => setFilterForemanOnly(!filterForemanOnly)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                filterForemanOnly
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-950 text-amber-300 hover:text-amber-200 border border-amber-900/50'
              }`}
              title="Filtrar solo Jefes de Obra habilitados para Órdenes de Trabajo"
            >
              👷 Jefes de Obra ({foremenCount})
            </button>

            <div className="h-4 w-px bg-slate-800 hidden sm:block"></div>

            <button
              type="button"
              onClick={() => setFilterStatus(filterStatus === 'ACTIVO' ? 'todos' : 'ACTIVO')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                filterStatus === 'ACTIVO'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'bg-slate-950 text-emerald-400 border border-emerald-900/40'
              }`}
            >
              Solo Activos 🟢 ({activeCount})
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus(filterStatus === 'INACTIVO' ? 'todos' : 'INACTIVO')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                filterStatus === 'INACTIVO'
                  ? 'bg-rose-600 text-white font-bold'
                  : 'bg-slate-950 text-rose-400 border border-rose-900/40'
              }`}
            >
              Inactivos 🔴 ({inactiveCount})
            </button>

            {filterGroup !== 'todos' && (
              <div className="flex items-center gap-1.5 bg-cyan-950 text-cyan-300 border border-cyan-800 px-2.5 py-1 rounded-lg">
                <span>Grupo: <strong>{filterGroup}</strong></span>
                <button
                  type="button"
                  onClick={() => setFilterGroup('todos')}
                  className="text-cyan-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 bg-slate-950/90 border border-slate-800 rounded-lg p-1">
            <button
              type="button"
              disabled={!canUndo}
              onClick={onUndo}
              className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              title="Deshacer cambio en Padrón (Ctrl + Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={!canRedo}
              onClick={onRedo}
              className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              title="Rehacer cambio en Padrón (Ctrl + Y)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <datalist id="nomina-categories-list">
        {ASTILLERO_BASE_CATEGORIES.map((cat) => (
          <option key={cat} value={cat} />
        ))}
      </datalist>
      <datalist id="nomina-trades-list">
        {uniqueTrades.map((tr) => (
          <option key={tr} value={tr} />
        ))}
      </datalist>
      <datalist id="nomina-groups-list">
        <option value="ASTILLERO" />
        {groupedSummary.map((g) => (
          <option key={g.name} value={g.name} />
        ))}
      </datalist>
    </>
  )
}
