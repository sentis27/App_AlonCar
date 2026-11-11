import { Package, Plus, ExternalLink, FileSpreadsheet, Flame, Layers, Shield } from 'lucide-react'

export default function PanolHeader({
  activeTab,
  filteredTransactionsCount,
  criticalCount,
  onChangeTab,
  onOpenWithdrawalModal,
  onOpenNewMaterialModal,
  onOpenGasModal,
  navigate
}) {
  return (
    <div className="alon-zone-context flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 font-sans">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950">
          <Package className="w-5 h-5 stroke-[2.5]" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-black text-white tracking-wide">PAÑOL CENTRAL & MATERIALES</h1>
            <span className="text-[10px] font-mono tracking-widest text-emerald-400/90 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-md uppercase font-bold">
              M4 · Logística Naval
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Planilla de retiros multi-material, control de tubos de gases (P-01/P-02) y catálogo físico de stock.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-cyan-950/30 border border-cyan-500/30 shadow-inner">
          <span className="px-2 py-0.5 text-[9px] font-mono font-black text-cyan-400 uppercase tracking-wider hidden sm:inline-block">
            COMPRAS
          </span>
          <button
            type="button"
            onClick={() => navigate('/compras?nuevo=true')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/60 text-cyan-300 font-bold text-xs transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-400 stroke-[3]" />
            <span>+ Pedir Materiales</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/compras?mode=simple')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-semibold text-xs transition-all cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden md:inline">Ver Recepciones</span>
          </button>
        </div>

        <div className="h-7 w-px bg-slate-800 hidden lg:block" />

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-950/80 p-0.5 rounded-xl border border-slate-800 text-xs font-bold">
            <button
              onClick={() => onChangeTab('planillas')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'planillas'
                  ? 'bg-emerald-600 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Planilla de Retiros</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/60 font-mono">
                {filteredTransactionsCount}
              </span>
            </button>
            <button
              onClick={() => onChangeTab('gases')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'gases'
                  ? 'bg-emerald-600 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Control de Gases</span>
            </button>
            <button
              onClick={() => onChangeTab('catalogo')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'catalogo'
                  ? 'bg-emerald-600 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Catálogo & Stock (B.D)</span>
              {criticalCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500 text-slate-950 font-black">
                  {criticalCount}
                </span>
              )}
            </button>
            <button
              onClick={() => onChangeTab('epp')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'epp'
                  ? 'bg-emerald-600 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Control EPP</span>
            </button>
          </div>

          {activeTab === 'planillas' && (
            <button
              type="button"
              onClick={onOpenWithdrawalModal}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Registrar Retiro Multi-Material</span>
            </button>
          )}
          {activeTab === 'catalogo' && (
            <button
              type="button"
              onClick={onOpenNewMaterialModal}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Nuevo Material</span>
            </button>
          )}
          {activeTab === 'gases' && (
            <button
              type="button"
              onClick={onOpenGasModal}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <Flame className="w-4 h-4 stroke-[2.5]" />
              <span>Movimiento de Tubos</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
