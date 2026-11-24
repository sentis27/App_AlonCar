import { Package, Plus, ExternalLink, Flame, Truck, FolderTree, ShoppingBasket } from 'lucide-react'
import CanonicalActiveSubmoduleBadge from '../canonical/CanonicalActiveSubmoduleBadge'

export default function PanolHeader({
  activeTab,
  activeSubmodule,
  isAdmin = false,
  filteredTransactionsCount,
  criticalCount,
  onOpenWithdrawalModal,
  onOpenCostBasketModal = null,
  onOpenNewMaterialModal,
  onOpenRubrosModal = null,
  onOpenGasModal,
  onOpenGasSupplierModal = null,
  navigate
}) {
  const badgeSuffix =
    activeTab === 'planillas'
      ? `(${filteredTransactionsCount})`
      : activeTab === 'catalogo' && criticalCount > 0
      ? `(${criticalCount} crít.)`
      : null

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
            <CanonicalActiveSubmoduleBadge
              label={activeSubmodule?.label || 'Planilla de Retiros'}
              suffix={badgeSuffix}
              theme={activeSubmodule?.theme || 'emerald'}
            />
          </div>
          <p className="text-xs text-slate-400">
            Planilla de retiros multi-material, control de tubos de gases (P-01/P-02) y catálogo físico de stock.
          </p>
        </div>
      </div>

      {/* Atajos Compras + Acciones del submódulo activo (Pestañas migradas al Menú Lateral Acordeón) */}
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

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'planillas' && (
            <div className="flex flex-wrap items-center gap-2">
              {onOpenCostBasketModal && (
                <button
                  type="button"
                  onClick={onOpenCostBasketModal}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/50 text-amber-300 font-bold text-xs transition-all shadow-sm cursor-pointer"
                  title="Abrir menú interactivo de Canastas de Costos por Contratista, Barco y OT (impacta en la planilla)"
                >
                  <ShoppingBasket className="w-3.5 h-3.5 text-amber-400" />
                  <span>Carga por Canasta de Costos</span>
                </button>
              )}
              <button
                type="button"
                onClick={onOpenWithdrawalModal}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Registrar Retiro Multi-Material</span>
              </button>
            </div>
          )}
          {activeTab === 'catalogo' && isAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              {onOpenRubrosModal && (
                <button
                  type="button"
                  onClick={onOpenRubrosModal}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-950 hover:bg-sky-900 border border-sky-500/60 text-sky-300 font-bold text-xs transition-all cursor-pointer"
                  title="Base de Datos simple de Rubros de Materiales (1 Rubro ➔ N Materiales)"
                >
                  <FolderTree className="w-3.5 h-3.5 text-sky-400" />
                  <span>B.D. Rubros</span>
                </button>
              )}
              <button
                type="button"
                onClick={onOpenNewMaterialModal}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Nuevo Material</span>
              </button>
            </div>
          )}
          {activeTab === 'gases' && (
            <div className="flex flex-wrap items-center gap-2">
              {onOpenGasSupplierModal && (
                <button
                  type="button"
                  onClick={() => onOpenGasSupplierModal('')}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-cyan-500/20 cursor-pointer"
                  title="Cargar Saldo Inicial, Ingresos por Remito o Devoluciones a Empresas Gaseras"
                >
                  <Truck className="w-4 h-4 stroke-[2.5]" />
                  <span>+ Remito / Empresa Gasera</span>
                </button>
              )}
              <button
                type="button"
                onClick={onOpenGasModal}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
                title="Registrar movimiento manual con contratista"
              >
                <Flame className="w-4 h-4 stroke-[2.5]" />
                <span>Movimiento Contratista</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
