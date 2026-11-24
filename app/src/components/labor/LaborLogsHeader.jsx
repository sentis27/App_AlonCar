import React from 'react'
import { Clock, MessageSquareText, Watch, Users } from 'lucide-react'
import CanonicalActiveSubmoduleBadge from '../canonical/CanonicalActiveSubmoduleBadge'

/**
 * ZONA 1 CANÓNICA DE /horas: Contexto Operativo, Submódulo Activo y Menú de Carga.
 */
export default function LaborLogsHeader({
  activeTab,
  activeSubmodule,
  dailyCount = 0,
  totalLogsCount = 0,
  onOpenTextModal,
  onOpenClockModal,
  onOpenCrewModal
}) {
  return (
    <div className="alon-zone-context p-4 rounded-2xl flex flex-col xl:flex-row xl:items-center justify-between gap-3.5 shadow-xl">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-slate-950 shrink-0">
          <Clock className="w-5 h-5 stroke-[2.5]" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-xl font-black text-white tracking-wide truncate">
              CONTROL DE HORAS Y CUADRILLAS
            </h1>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300 uppercase">
              M3b · GS-001
            </span>
            <CanonicalActiveSubmoduleBadge
              label={activeSubmodule?.label || '1. Planilla de Horas'}
              suffix={activeTab === 'control_diario' ? `(${dailyCount})` : null}
              theme={activeSubmodule?.theme || 'cyan'}
            />
          </div>
          <p className="text-xs text-slate-400 truncate">
            Planilla estilo Google Sheets ({totalLogsCount} registros) y menú directo de opciones de carga.
          </p>
        </div>
      </div>

      {/* Opciones de Carga en Zona 1 (Pestañas migradas al Menú Lateral Acordeón) */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onOpenTextModal}
          className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
          title="Pegar un parte de WhatsApp o texto dictado y tabularlo automáticamente"
        >
          <MessageSquareText className="w-3.5 h-3.5 text-cyan-400" />
          <span>Carga por Mensaje de Texto</span>
        </button>

        <button
          type="button"
          onClick={onOpenClockModal}
          className="px-3 py-2 rounded-xl bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/45 text-amber-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
          title="Importar fichaje del lector facial (.csv) y distribuir horas en barcos"
        >
          <Watch className="w-3.5 h-3.5 text-amber-400" />
          <span>Carga por Reloj de Alerta</span>
        </button>

        <button
          type="button"
          onClick={onOpenCrewModal}
          className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-500/20 transition-all"
          title="Cargar cuadrilla en cascada Barco → Contratista/Grupo → OT"
        >
          <Users className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>+ Carga en Cuadrilla</span>
        </button>
      </div>
    </div>
  )
}
