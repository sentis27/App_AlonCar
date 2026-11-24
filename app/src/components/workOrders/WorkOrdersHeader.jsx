import { ClipboardList, Plus, Sparkles } from 'lucide-react'
import CanonicalActiveSubmoduleBadge from '../canonical/CanonicalActiveSubmoduleBadge'

export default function WorkOrdersHeader({
  activeMainTab,
  activeSubmodule,
  onOpenNewWorkModal,
  onOpenCatalog,
  totalUnifiedCount = 0,
  totalOtsCount = 0,
  totalTercerosCount = 0
}) {
  const activeCount =
    activeMainTab === 'ots' ? totalOtsCount : activeMainTab === 'terceros' ? totalTercerosCount : totalUnifiedCount

  return (
    <div className="space-y-3 font-sans">
      {/* ZONA 1: CONTEXTO OPERATIVO Y ACCIONES PRINCIPALES */}
      <div className="alon-zone-context p-4 rounded-2xl flex flex-col xl:flex-row xl:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center shrink-0 shadow-inner">
            <ClipboardList className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2 truncate">
                Órdenes de Trabajo & Catálogo (OT.ABC)
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-950 text-cyan-300 border border-cyan-800">
                Módulo 6 · GS-003
              </span>
              <CanonicalActiveSubmoduleBadge
                label={activeSubmodule?.label || '1. Unificado'}
                suffix={`(${activeCount})`}
                theme={activeSubmodule?.theme || 'cyan'}
              />
            </div>
            <p className="text-xs text-slate-400 truncate">
              Gestión unificada de OTs, trabajos por buque, ciclo de vida de 8 estados y vinculación con Terceros PRC.
            </p>
          </div>
        </div>

        {/* ACCIONES PRINCIPALES A LA DERECHA (Pestañas migradas al Menú Lateral Acordeón) */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenCatalog(false)}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Catálogo OT.ABC</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenNewWorkModal(null)}
            className="px-3.5 py-2 bg-gradient-to-r from-primary to-blue-500 hover:brightness-110 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-500/20 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Cargar Trabajo / OT</span>
          </button>
        </div>
      </div>
    </div>
  )
}
