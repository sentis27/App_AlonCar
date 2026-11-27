const PRESETS = [
  { pct: 100, label: '100% Contr.', desc: '0% Obra' },
  { pct: 60, label: '60% Contr.', desc: '40% Obra' },
  { pct: 50, label: '50% / 50%', desc: 'Comp.' },
  { pct: 0, label: '100% Obra', desc: '0% Contr.' }
]

/**
 * Selector de % de Consumibles de Pañol (Contratista vs Obra) para el stepper de Personal.
 * ASTILLERO propio imputa siempre 100% a la Obra; CONTRATISTA/TALLER permite ajustar 0..100%.
 */
export default function PersonalWorkerConsumablesField({ adminCenter, discountPct, onChange }) {
  const isAstillero = String(adminCenter || '').trim().toUpperCase() === 'ASTILLERO'
  const pct = isAstillero ? 0 : Math.min(100, Math.max(0, Number(discountPct ?? 100) || 0))
  const obraPct = 100 - pct

  if (isAstillero) {
    return (
      <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-purple-950/30 border border-purple-700/40">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-200">Consumibles de Pañol</span>
          <span className="text-[10px] px-2 py-0.5 rounded font-black bg-purple-950 text-purple-300 border border-purple-700">
            100% OBRA
          </span>
        </div>
        <span className="text-[10px] text-slate-300">
          Personal propio del Astillero imputa 100% a la Obra (0% descuento). Los EPP son 0% obra (Ref. Astillero).
        </span>
      </div>
    )
  }

  return (
    <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-[11px] font-bold text-slate-300">
          Consumibles de Pañol (% Descuento al Contratista / Obra)
        </label>
        <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
          <span className="text-amber-300">Contr.: {pct}%</span>
          <span className="text-slate-500 mx-1">&middot;</span>
          <span className="text-purple-300">Obra: {obraPct}%</span>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
        <div className="md:col-span-5 grid grid-cols-4 gap-1">
          {PRESETS.map((btn) => {
            const active = pct === btn.pct
            return (
              <button
                key={btn.pct}
                type="button"
                tabIndex={-1}
                onClick={() => onChange(btn.pct)}
                className={`py-1 px-1 rounded-lg text-[10px] font-bold transition-all border text-center cursor-pointer ${
                  active
                    ? btn.pct === 0
                      ? 'bg-purple-950 text-purple-200 border-purple-500 ring-1 ring-purple-500'
                      : 'bg-amber-950 text-amber-300 border-amber-500 ring-1 ring-amber-500'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <div className="leading-tight truncate">{btn.label}</div>
                <div className="text-[9px] opacity-70 font-normal leading-tight">{btn.desc}</div>
              </button>
            )
          })}
        </div>

        <div className="md:col-span-4 flex items-center gap-2">
          <input
            type="range"
            tabIndex={-1}
            min="0"
            max="100"
            step="5"
            value={pct}
            onChange={(e) => onChange(Number(e.target.value))}
            aria-label="Porcentaje de descuento de consumibles al contratista"
            className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
          <div className="flex items-center gap-1 shrink-0">
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={pct}
              onChange={(e) => {
                const parsed = parseFloat(e.target.value)
                const val = Number.isFinite(parsed) ? Math.min(100, Math.max(0, Math.round(parsed))) : 0
                onChange(val)
              }}
              aria-label="Porcentaje numérico de descuento de consumibles"
              className="w-14 bg-slate-950 border border-slate-700 rounded-lg px-1.5 py-1 text-xs text-white font-mono font-bold text-center focus:outline-none focus:border-amber-400"
            />
            <span className="text-xs text-slate-400 font-bold">%</span>
          </div>
        </div>

        <div className="md:col-span-3 space-y-1">
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden flex border border-slate-800">
            <div className="bg-amber-500 transition-all duration-150" style={{ width: `${pct}%` }} title={`Descuento Contratista: ${pct}%`} />
            <div className="bg-purple-500 transition-all duration-150" style={{ width: `${obraPct}%` }} title={`Imputación Obra: ${obraPct}%`} />
          </div>
          <div className="flex justify-between text-[9px] font-bold">
            <span className="text-amber-400">Contr. {pct}%</span>
            <span className="text-purple-400">Obra {obraPct}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
