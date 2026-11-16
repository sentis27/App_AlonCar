import React, { useState } from 'react'
import { AlertTriangle, Package, Wrench, ArrowUpRight } from 'lucide-react'
import ZeroCostAlertHoverCard from '../ZeroCostAlertHoverCard'

/**
 * Franja KPI unificada Pre-Facturación ($0 Pendiente de Valorizar) del bloque General.
 */
export default function ResumenZeroCostBanner({
  shipName,
  zeroCostAlerts = { thirdPartyCount: 0, materialsCount: 0, thirdPartyItems: [], materialItems: [] },
  onOpenCostSheet
}) {
  const [hoveredAlertKind, setHoveredAlertKind] = useState(null)

  const totalPendingZero = (zeroCostAlerts.thirdPartyCount || 0) + (zeroCostAlerts.materialsCount || 0)
  const hasAlerts = totalPendingZero > 0

  return (
    <div
      className={`relative rounded-xl border px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 ${
        hasAlerts ? 'bg-amber-950/25 border-amber-500/45' : 'bg-emerald-950/20 border-emerald-500/35'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className={`w-4 h-4 shrink-0 ${hasAlerts ? 'text-amber-400' : 'text-emerald-400'}`} />
        <div className="min-w-0">
          <span className={`text-xs font-extrabold uppercase tracking-wider ${hasAlerts ? 'text-amber-300' : 'text-emerald-300'}`}>
            Pendientes de Valorizar ($0 · Pre-Facturación)
          </span>
          <span className="hidden xl:inline text-[11px] text-slate-400 ml-2">
            Pasá el mouse para ver contratista, OT y observaciones · Clic abre hoja filtrada
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div
          className="relative"
          onMouseEnter={() => setHoveredAlertKind('TERCEROS')}
          onMouseLeave={() => setHoveredAlertKind((prev) => (prev === 'TERCEROS' ? null : prev))}
        >
          <button
            type="button"
            onClick={() => onOpenCostSheet?.('terceros', 'GENERAL', 'SIN_COSTO')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
              zeroCostAlerts.thirdPartyCount > 0
                ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-400/50 text-amber-200'
                : 'bg-slate-900/70 hover:bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            <Wrench className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Terceros $0:</span>
            <span className="font-mono font-black text-white">{zeroCostAlerts.thirdPartyCount}</span>
            <ArrowUpRight className="w-3.5 h-3.5 opacity-75" />
          </button>

          {hoveredAlertKind === 'TERCEROS' && (
            <div className="absolute right-0 top-full pt-1.5 z-50 w-[min(520px,85vw)]">
              <ZeroCostAlertHoverCard
                kind="TERCEROS"
                items={zeroCostAlerts.thirdPartyItems}
                showShip={false}
                title={`Terceros Sin Costo ($0) — ${shipName}`}
              />
            </div>
          )}
        </div>

        <div
          className="relative"
          onMouseEnter={() => setHoveredAlertKind('MATERIALES')}
          onMouseLeave={() => setHoveredAlertKind((prev) => (prev === 'MATERIALES' ? null : prev))}
        >
          <button
            type="button"
            onClick={() => onOpenCostSheet?.('materiales', 'GENERAL', 'PRECIO_0')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
              zeroCostAlerts.materialsCount > 0
                ? 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-400/50 text-rose-200'
                : 'bg-slate-900/70 hover:bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            <Package className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>Materiales $0:</span>
            <span className="font-mono font-black text-white">{zeroCostAlerts.materialsCount}</span>
            <ArrowUpRight className="w-3.5 h-3.5 opacity-75" />
          </button>

          {hoveredAlertKind === 'MATERIALES' && (
            <div className="absolute right-0 top-full pt-1.5 z-50 w-[min(540px,85vw)]">
              <ZeroCostAlertHoverCard
                kind="MATERIALES"
                items={zeroCostAlerts.materialItems}
                showShip={false}
                title={`Materiales Imputados Sin Precio ($0, excl. EPP) — ${shipName}`}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
