import { ClipboardList, Plus, Layers, ShieldCheck, Sparkles } from 'lucide-react'

export default function WorkOrdersHeader({
  activeMainTab,
  setActiveMainTab,
  onOpenNewWorkModal,
  onOpenCatalog,
  totalUnifiedCount = 0,
  totalOtsCount = 0,
  totalTercerosCount = 0
}) {
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
            </div>
            <p className="text-xs text-slate-400 truncate">
              Gestión unificada de OTs, trabajos por buque, ciclo de vida de 8 estados y vinculación con Terceros PRC.
            </p>
          </div>
        </div>

        {/* PESTAÑAS Y ACCIONES A LA DERECHA */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveMainTab('unificado')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 border transition-all cursor-pointer ${
              activeMainTab === 'unificado'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-lg shadow-cyan-500/20'
                : 'bg-cyan-950/35 text-cyan-200 border-cyan-500/40 hover:bg-cyan-950/60 hover:border-cyan-400/70'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>1. Unificado ({totalUnifiedCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMainTab('ots')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 border transition-all cursor-pointer ${
              activeMainTab === 'ots'
                ? 'bg-primary text-slate-950 border-primary shadow-lg shadow-primary/20'
                : 'bg-sky-950/35 text-sky-200 border-sky-500/40 hover:bg-sky-950/60 hover:border-sky-400/70'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>2. Por Barco ({totalOtsCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMainTab('terceros')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 border transition-all cursor-pointer ${
              activeMainTab === 'terceros'
                ? 'bg-purple-500 text-white border-purple-400 shadow-lg shadow-purple-500/20'
                : 'bg-purple-950/35 text-purple-200 border-purple-500/40 hover:bg-purple-950/60 hover:border-purple-400/70'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>3. Terceros PRC ({totalTercerosCount})</span>
          </button>

          <div className="flex items-center gap-2">
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
    </div>
  )
}
