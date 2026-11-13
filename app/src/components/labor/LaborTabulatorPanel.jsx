import React from 'react'
import { Sparkles, Layers, Zap } from 'lucide-react'
import { EXAMPLE_CREW_REPORT } from '../../lib/laborCargaHelpers.js'

export default function LaborTabulatorPanel({
  rawReportText,
  setRawReportText,
  isTabulating,
  tabulatorSummary,
  setTabulatorSummary,
  operariosCount,
  onConsolidateSameOtRows,
  onTabulateMessage
}) {
  return (
    <div className="bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-cyan-950/30 border border-cyan-500/30 rounded-2xl p-5 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs uppercase tracking-wider font-extrabold text-cyan-300 flex items-center gap-2">
              <span>⚡ Tabulador Inteligente de Partes por Grupo (WhatsApp / Audio Transcrito)</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700/50 font-mono">
                Prioridad División E5/E6
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              Pegá el reporte corrido del jefe de obra o capataz. El motor separa operarios en paralelo, infiere el rubro de la tarea real, cruza contra OTs en ejecución y pre-carga la Cuadrilla para que solo ajustes lo mínimo.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setRawReportText(EXAMPLE_CREW_REPORT)}
            className="px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-[11px] font-semibold cursor-pointer transition-all"
          >
            📋 Cargar Ejemplo Real
          </button>
          {rawReportText && (
            <button
              type="button"
              onClick={() => {
                setRawReportText('')
                setTabulatorSummary(null)
              }}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 text-[11px] cursor-pointer"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <textarea
          rows={3}
          value={rawReportText}
          onChange={(e) => setRawReportText(e.target.value)}
          placeholder="Ej: Luciano Tritón reguillas cuvierta protección de bacha y colocación de parrilla andres y diego soldadura parches trancalin don Antonio 9hr franco y enzo higinio subir portones y matafuego vuoso 2hr 2hr maniobra para prueba navegación 5 hr en don Antonio bodega sacar porurietano..."
          className="w-full bg-slate-950/90 border border-slate-700/90 focus:border-cyan-400 rounded-xl p-3.5 text-xs text-white placeholder-slate-500 focus:outline-none font-mono leading-relaxed"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-slate-300">
              ✔ Desglosa <strong>&ldquo;Andrés y Diego 9h&rdquo;</strong> &rarr; 9h c/u (RN-03)
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-slate-300">
              ✔ Corrige jerga naval (<em>trancalín, poliuretano, cubierta</em>)
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-slate-300">
              ✔ Prioriza dividir subtareas salvo que la OT cubra ambas
            </span>
          </div>

          <div className="flex items-center gap-2">
            {operariosCount > 1 && (
              <button
                type="button"
                onClick={onConsolidateSameOtRows}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
                title="Unifica filas que tengan exactamente el mismo Operario, Barco, OT y Rubro sumando sus horas"
              >
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Consolidar Misma OT</span>
              </button>
            )}
            <button
              type="button"
              disabled={isTabulating || !rawReportText.trim()}
              onClick={onTabulateMessage}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold text-xs shadow-[0_0_20px_rgba(0,242,254,0.25)] flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
            >
              <Zap className="w-4 h-4" />
              <span>{isTabulating ? 'Analizando y Tabulando...' : '⚡ Tabular a Cuadrilla'}</span>
            </button>
          </div>
        </div>
      </div>

      {tabulatorSummary && (
        <div className="p-3.5 rounded-xl bg-slate-950/90 border border-cyan-500/30 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 font-bold font-mono text-[11px]">
              Motor: {tabulatorSummary.engineUsed === 'openai' ? 'OpenAI GPT-4o-mini' : 'Parser Naval Determinístico Local'}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
              Filas generadas: <strong className="text-white">{tabulatorSummary.summary?.totalRows || operariosCount}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-700/40 text-emerald-300">
              OK automáticas: <strong>{tabulatorSummary.summary?.readyRows || 0}</strong>
            </span>
            {(tabulatorSummary.summary?.reviewRows || 0) > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-amber-950/70 border border-amber-600/50 text-amber-300 font-semibold">
                ⚠️ Requieren pulido mínimo: {tabulatorSummary.summary.reviewRows}
              </span>
            )}
            {(tabulatorSummary.summary?.loanedRubroCount || 0) > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-purple-950/70 border border-purple-600/50 text-purple-300 font-semibold">
                🔄 Préstamos de rubro detectados: {tabulatorSummary.summary.loanedRubroCount}
              </span>
            )}
          </div>
          {tabulatorSummary.llmError && (
            <span className="text-[11px] text-amber-300 font-mono">
              Fallback local activo ({tabulatorSummary.llmError})
            </span>
          )}
        </div>
      )}
    </div>
  )
}
