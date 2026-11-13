import React from 'react'
import { Sparkles, Layers, RotateCcw } from 'lucide-react'

export default function LaborCargaTopActions({
  isTabulatorOpen,
  onToggleTabulator,
  isMultiOtMode,
  onToggleMultiOtMode,
  onReplicateYesterday
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-slate-400 text-xs">
        Imputá múltiples operarios por cuadrilla o tabulá un parte grupal con desglose de{' '}
        <strong className="text-white">Horas Normales</strong>,{' '}
        <strong className="text-cyan-300">Extras (50% / 100%)</strong> y{' '}
        <strong className="text-amber-300">Puerta de Emergencia de Rubro</strong>.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToggleTabulator}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-2 cursor-pointer shadow-sm ${
            isTabulatorOpen
              ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>{isTabulatorOpen ? 'Ocultar Tabulador de Mensajes' : '⚡ Tabular Parte por Grupo'}</span>
        </button>
        <button
          type="button"
          onClick={onToggleMultiOtMode}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
            isMultiOtMode
              ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
          }`}
          title="Permite que cada fila de la cuadrilla apunte a un Barco y OT diferente en el mismo lote"
        >
          <Layers className="w-3.5 h-3.5 text-purple-400" />
          <span>{isMultiOtMode ? 'Modo Multi-Barco / Multi-OT: ACTIVO' : 'Activar Multi-Barco por Fila'}</span>
        </button>
        <button
          type="button"
          onClick={onReplicateYesterday}
          className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
        >
          <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
          <span>Replicar Cuadrilla Anterior</span>
        </button>
      </div>
    </div>
  )
}
