import { Building2 } from 'lucide-react'

export default function PersonalNominaGroupsView({
  groupedSummary,
  onSelectGroup,
  onClose
}) {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            Grupos de Trabajo & Contratistas Consolidados ({groupedSummary.length})
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Esta es la lista simplificada que aparece en los selectores de <strong>Horas</strong>, <strong>Pañol</strong> y <strong>Terceros</strong>.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
        >
          Volver a la Grilla Detallada
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {groupedSummary.map((group) => (
          <div
            key={group.name}
            className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-all space-y-2.5"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-extrabold text-white text-sm">{group.name}</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold border mt-1 inline-block ${
                  group.admin_center === 'ASTILLERO'
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                    : group.admin_center === 'TALLER'
                    ? 'bg-purple-950 text-purple-300 border-purple-800'
                    : 'bg-amber-950 text-amber-300 border-amber-800'
                }`}>
                  {group.admin_center}
                </span>
              </div>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                {group.activeWorkers} pers.
              </span>
            </div>

            <div className="text-xs text-slate-400 space-y-1 pt-1 border-t border-slate-800/80">
              <div className="flex justify-between">
                <span>Rubro habitual:</span>
                <strong className="text-slate-200">{group.trade || 'General'}</strong>
              </div>
              <div className="flex justify-between">
                <span>Tarifa promedio:</span>
                <strong className="text-emerald-400 font-mono">${group.avgRateArs} ({group.avgRateUsd} USD)</strong>
              </div>
              <div className="flex justify-between">
                <span>Consumibles:</span>
                <span className={`font-semibold ${group.consumables === 'CLIENTE' ? 'text-purple-400' : 'text-amber-400'}`}>
                  {group.consumables}
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => onSelectGroup(group.name)}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-bold underline cursor-pointer"
              >
                Ver sus {group.totalWorkers} integrantes &rarr;
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
