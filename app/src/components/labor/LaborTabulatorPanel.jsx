import React from 'react'
import { Layers, Zap } from 'lucide-react'
import { EXAMPLE_CREW_REPORT } from '../../lib/laborCargaHelpers.js'

export default function LaborTabulatorPanel({
  rawReportText,
  setRawReportText,
  isTabulating,
  tabulatorSummary,
  setTabulatorSummary,
  operariosCount,
  onConsolidateSameOtRows,
  onTabulateMessage,
  compact = false
}) {
  return (
    <div className={compact ? 'space-y-2' : 'bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-cyan-950/30 border border-cyan-500/30 rounded-2xl p-4 shadow-xl space-y-3'}>
      <textarea
        rows={compact ? 2 : 3}
        value={rawReportText}
        onChange={(e) => setRawReportText(e.target.value)}
        placeholder="Pegá el parte de WhatsApp o audio transcrito (ej: Andrés y Diego soldadura parches trancalín Don Antonio 9h...)"
        className="w-full bg-slate-950/90 border border-slate-700/90 focus:border-cyan-400 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none font-mono leading-relaxed"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setRawReportText(EXAMPLE_CREW_REPORT)}
            className="px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-[11px] font-semibold cursor-pointer transition-all"
          >
            📋 Cargar Ejemplo Real
          </button>
          {rawReportText && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => {
                setRawReportText('')
                setTabulatorSummary(null)
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 text-[11px] cursor-pointer"
            >
              Limpiar
            </button>
          )}
          {tabulatorSummary && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] ml-1">
              <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 font-bold font-mono">
                {tabulatorSummary.engineUsed === 'openai' ? 'GPT-4o-mini' : 'Parser Local'}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                Filas: <strong className="text-white">{tabulatorSummary.summary?.totalRows || operariosCount}</strong>
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-700/40 text-emerald-300">
                OK: <strong>{tabulatorSummary.summary?.readyRows || 0}</strong>
              </span>
              {(tabulatorSummary.summary?.reviewRows || 0) > 0 && (
                <span className="px-2 py-0.5 rounded bg-amber-950/70 border border-amber-600/50 text-amber-300 font-semibold">
                  ⚠️ Pulir: {tabulatorSummary.summary.reviewRows}
                </span>
              )}
              {(tabulatorSummary.summary?.loanedRubroCount || 0) > 0 && (
                <span className="px-2 py-0.5 rounded bg-purple-950/70 border border-purple-600/50 text-purple-300 font-semibold">
                  🔄 Préstamo: {tabulatorSummary.summary.loanedRubroCount}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {operariosCount > 1 && (
            <button
              type="button"
              tabIndex={-1}
              onClick={onConsolidateSameOtRows}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
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
            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold text-xs shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{isTabulating ? 'Tabulando...' : '⚡ Tabular a Cuadrilla'}</span>
          </button>
        </div>
      </div>

      {tabulatorSummary?.llmError && (
        <span className="block text-[10px] text-amber-300 font-mono">
          Fallback local activo ({tabulatorSummary.llmError})
        </span>
      )}
    </div>
  )
}
