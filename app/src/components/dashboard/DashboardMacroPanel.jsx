import { Building2, CheckCircle2, DollarSign, Lock, Percent, Save } from 'lucide-react'

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export default function DashboardMacroPanel({
  macroVariables = [],
  macroForm,
  setMacroForm,
  savingMacro,
  macroMessage,
  onSaveMacro
}) {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">
              Variables Macroeconómicas Centrales (Dólar & Inflación Mensual)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Fijadas exclusivamente por el Administrador. Rigen para todas las liquidaciones y se trasladan automáticamente a la 1ª y 2ª quincena del mes.
          </p>
        </div>

        <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold flex items-center gap-1 self-start md:self-auto">
          <Lock className="w-3 h-3" /> Panel Maestro de Cotización
        </span>
      </div>

      {macroMessage && (
        <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
          macroMessage.type === 'success'
            ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
            : 'bg-rose-950/60 border-rose-800 text-rose-300'
        }`}>
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{macroMessage.text}</span>
        </div>
      )}

      <form onSubmit={onSaveMacro} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end bg-slate-950 p-4 rounded-xl border border-slate-800">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Año</label>
          <select
            value={macroForm.year}
            onChange={(e) => setMacroForm({ ...macroForm, year: parseInt(e.target.value, 10) })}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-400"
          >
            {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Mes de Aplicación</label>
          <select
            value={macroForm.month}
            onChange={(e) => {
              const m = parseInt(e.target.value, 10)
              const existing = macroVariables.find((v) => v.year === macroForm.year && v.month === m)
              setMacroForm({
                ...macroForm,
                month: m,
                dollar_rate: existing ? parseFloat(existing.dollar_rate) : macroForm.dollar_rate,
                monthly_inflation_pct: existing ? parseFloat(existing.monthly_inflation_pct) : macroForm.monthly_inflation_pct
              })
            }}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-400"
          >
            {MONTH_NAMES.map((name, idx) => <option key={idx + 1} value={idx + 1}>{name}</option>)}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-emerald-400" /> Valor Dólar (AR$/USD)
          </label>
          <input
            type="number"
            step="1"
            value={macroForm.dollar_rate}
            onChange={(e) => setMacroForm({ ...macroForm, dollar_rate: parseFloat(e.target.value) || 0 })}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-extrabold text-emerald-300 focus:outline-none focus:border-emerald-400"
            placeholder="1500"
            required
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
            <Percent className="w-3 h-3 text-amber-400" /> Inflación Mensual (%)
          </label>
          <input
            type="number"
            step="0.1"
            value={macroForm.monthly_inflation_pct}
            onChange={(e) => setMacroForm({ ...macroForm, monthly_inflation_pct: parseFloat(e.target.value) || 0 })}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-extrabold text-amber-300 focus:outline-none focus:border-emerald-400"
            placeholder="3.2"
            required
          />
        </div>

        <div>
          <button
            type="submit"
            disabled={savingMacro}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{savingMacro ? 'Guardando...' : 'Guardar Parámetros'}</span>
          </button>
        </div>
      </form>

      {macroVariables.length > 0 && (
        <div className="pt-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
            Historial de Parámetros Macroeconómicos Registrados
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
            {macroVariables.slice(0, 6).map((v) => (
              <div
                key={`${v.year}-${v.month}`}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  macroForm.year === v.year && macroForm.month === v.month
                    ? 'bg-emerald-950/40 border-emerald-500 shadow-md shadow-emerald-950/30'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
                onClick={() => setMacroForm({
                  year: v.year,
                  month: v.month,
                  dollar_rate: parseFloat(v.dollar_rate),
                  monthly_inflation_pct: parseFloat(v.monthly_inflation_pct)
                })}
                title="Hacé clic para cargar en el formulario"
              >
                <span className="text-[10px] text-slate-400 font-bold block uppercase">
                  {MONTH_NAMES[v.month - 1]} {v.year}
                </span>
                <div className="font-mono text-xs font-extrabold text-emerald-400 mt-0.5">
                  ${parseFloat(v.dollar_rate).toLocaleString('es-AR')}
                </div>
                <div className="font-mono text-[10px] font-bold text-amber-300">
                  Inf: {v.monthly_inflation_pct}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
