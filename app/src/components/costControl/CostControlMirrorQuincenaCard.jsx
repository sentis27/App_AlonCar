import { AlertTriangle, Calendar, Ship } from 'lucide-react'
import CanonicalOtBadge from '../canonical/CanonicalOtBadge.jsx'

export default function CostControlMirrorQuincenaCard({
  mirror,
  snapshot,
  activeContractorEntity,
  focusedRow,
  effectiveTarget,
  targetMaterialIds,
  shipsById,
  workOrdersById,
  workItems,
  workOrders,
  saving,
  onSelectTargetKey,
  onMoveDateToPrevQuincena,
}) {
  return (
    <>
      <div className="rounded-xl bg-slate-900/75 border border-slate-800 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-black text-indigo-200 uppercase tracking-wider flex items-center gap-1.5">
            <Ship className="w-3.5 h-3.5 text-indigo-300" />
            <span>Mapa de toda la Quincena · {snapshot?.range?.label || ''} (Todos los Barcos)</span>
          </h3>
          <span className="text-[10px] text-slate-400">{mirror.quincenaGroups.length} trabajo(s)</span>
        </div>

        {mirror.quincenaGroups.length === 0 ? (
          <p className="text-xs text-slate-400">Sin horas cargadas para {activeContractorEntity} en esta quincena.</p>
        ) : (
          <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-0.5">
            {mirror.quincenaGroups.map((grp) => {
              const targetKey = `q:${grp.key}`
              const isSelected = effectiveTarget?.key === targetKey
              const shipObj = grp.shipId ? shipsById.get(grp.shipId) : null
              const woObj = grp.workOrderId ? workOrdersById.get(grp.workOrderId) : null

              return (
                <button
                  key={grp.key}
                  type="button"
                  onClick={() => onSelectTargetKey(targetKey)}
                  className={`w-full text-left rounded-lg border px-2.5 py-2 text-xs transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-cyan-950/60 border-cyan-400'
                      : grp.matchesFocusOtOnOtherShip
                      ? 'bg-amber-950/30 border-amber-500/50 hover:border-amber-400'
                      : 'bg-slate-950/90 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-100">{grp.shipName}</span>
                      <CanonicalOtBadge wo={woObj} ship={shipObj} workItems={workItems} workOrders={workOrders} variant="inline" />
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">Días: {grp.datesShortLabel}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {grp.matchesFocusOtOnOtherShip && (
                      <span
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/50 text-[10px] font-bold"
                        title="Coincide con la misma OT del material pero en otro barco"
                      >
                        <AlertTriangle className="w-2.5 h-2.5" /> Coincide OT
                      </span>
                    )}
                    <span className="font-mono font-black text-cyan-300">{grp.totalHours} hs</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {(focusedRow?.prevQuincenaMatch || (mirror.dayLogs.length === 0 && mirror.prevQuincenaGroups.length > 0)) && (
        <div className="rounded-xl bg-indigo-950/35 border border-indigo-500/45 p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-black text-indigo-200 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-300" />
              <span>Quincena anterior · {snapshot?.prevRange?.label || ''}</span>
            </span>
            {focusedRow?.prevQuincenaMatch && targetMaterialIds.length > 0 && (
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  onMoveDateToPrevQuincena({
                    txIds: targetMaterialIds,
                    dateArIso: focusedRow.prevQuincenaMatch.lastDateIso,
                  })
                }
                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] cursor-pointer"
                title="Cambiar la fecha del material al último día trabajado en quincena anterior"
              >
                Mover fecha a {focusedRow.prevQuincenaMatch.lastDateAr}
              </button>
            )}
          </div>
          {mirror.prevQuincenaGroups.slice(0, 4).map((pg) => (
            <div key={pg.key} className="flex items-center justify-between gap-2 text-[11px] text-slate-300">
              <span className="truncate">{pg.shipName} · {pg.otLabel}</span>
              <span className="font-mono text-indigo-200 shrink-0">últ. {pg.lastDateAr} ({pg.totalHours} hs)</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
