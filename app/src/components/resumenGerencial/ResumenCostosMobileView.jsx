import React, { useState } from 'react'
import { Anchor, AlertTriangle, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react'
import { formatUsd, formatKg } from '../../lib/drydockCatalogConstants'
import ZeroCostAlertHoverCard from '../ZeroCostAlertHoverCard'
import CanonicalOtBadge from '../canonical/CanonicalOtBadge'

/**
 * Vista Móvil Ágil de Costos (< md):
 * Prioriza tener el número total de la obra y el detalle por OT seleccionados en Zona 1 al alcance inmediato.
 */
export default function ResumenCostosMobileView({
  ship,
  totals,
  activeOt,
  craneHours = {},
  zeroCostAlerts = { thirdPartyCount: 0, materialsCount: 0, thirdPartyItems: [], materialItems: [] },
  onOpenCostSheet
}) {
  const [expandedAlert, setExpandedAlert] = useState(null)

  const totalPending = (zeroCostAlerts.thirdPartyCount || 0) + (zeroCostAlerts.materialsCount || 0)

  return (
    <div className="md:hidden space-y-3">
      {/* Tarjeta Principal: Costo Directo Total del Buque */}
      <div className="bg-slate-950/90 border border-cyan-500/40 rounded-2xl overflow-hidden shadow-lg">
        <div className="px-3.5 py-2.5 bg-cyan-950/50 border-b border-cyan-500/30 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Anchor className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-200 truncate">
              {ship.name}
            </span>
          </div>
          <span className="text-[10px] font-bold uppercase text-cyan-300/90 shrink-0">
            Costo Directo
          </span>
        </div>

        <div className="px-4 py-3 bg-emerald-950/35 border-b border-emerald-500/30 flex items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 block">
              TOTAL US$ OBRA
            </span>
            <span className="text-[10px] text-emerald-200/75">
              {formatKg(totals.weightKg, 0)} · {totals.physicalHours.toLocaleString('es-AR', { maximumFractionDigits: 0 })} hs
            </span>
          </div>
          <span className="text-2xl font-black text-emerald-300 tabular-nums">
            {formatUsd(totals.directTotalUsd)}
          </span>
        </div>

        <div className="divide-y divide-slate-800/80 text-xs">
          <button
            type="button"
            onClick={() => onOpenCostSheet?.('materiales', 'GENERAL', 'MATERIALES')}
            className="w-full px-3.5 py-2 flex justify-between text-left hover:bg-cyan-950/30 cursor-pointer"
          >
            <span className="text-slate-300">1. Materiales</span>
            <span className="font-bold text-slate-100 tabular-nums">{formatUsd(totals.materialesUsd)}</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenCostSheet?.('materiales', 'GENERAL', 'CONSUMIBLES')}
            className="w-full px-3.5 py-2 flex justify-between text-left hover:bg-cyan-950/30 cursor-pointer"
          >
            <span className="text-slate-300">2. Consumibles Obra</span>
            <span className="font-bold text-slate-100 tabular-nums">{formatUsd(totals.consumiblesObraUsd)}</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenCostSheet?.('terceros', 'GENERAL', 'ALL')}
            className="w-full px-3.5 py-2 flex justify-between text-left hover:bg-cyan-950/30 cursor-pointer"
          >
            <span className="text-slate-300">3. Terceros</span>
            <span className="font-bold text-slate-100 tabular-nums">{formatUsd(totals.tercerosUsd)}</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenCostSheet?.('horas', 'GENERAL', 'APPROVED')}
            className="w-full px-3.5 py-2 flex justify-between text-left hover:bg-cyan-950/30 cursor-pointer"
          >
            <span className="text-slate-300">4. Horas Aprobadas</span>
            <span className="font-bold text-slate-100 tabular-nums">{formatUsd(totals.horasUsd)}</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenCostSheet?.('horas', 'GENERAL', 'PENDING_R')}
            className="w-full px-3.5 py-2 flex justify-between text-left bg-amber-950/15 hover:bg-amber-950/35 cursor-pointer"
          >
            <span className="text-amber-200">5. Horas Pend. (&quot;R&quot;)</span>
            <span className="font-bold text-amber-300 tabular-nums">{formatUsd(totals.horasPendAprobarUsd)}</span>
          </button>
          <div className="px-3.5 py-1.5 bg-amber-500/10 border-t border-dashed border-amber-400/40 flex justify-between items-center text-[11px]">
            <span className="inline-flex items-center gap-1 text-amber-300 font-semibold">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              EPP Ref. (No suma)
            </span>
            <span className="font-bold text-amber-300 tabular-nums">{formatUsd(totals.seguridadReferenciaUsd)}</span>
          </div>
          <div className="px-3.5 py-1.5 bg-cyan-950/20 flex items-center justify-between text-[11px] text-cyan-200/90 tabular-nums">
            <span>Grúa G: <strong>{Number(craneHours.shipGruaGrande || 0).toLocaleString('es-AR', { maximumFractionDigits: 1 })}h</strong></span>
            <span>Grúa Ch: <strong>{Number(craneHours.shipGruaChica || 0).toLocaleString('es-AR', { maximumFractionDigits: 1 })}h</strong></span>
            <span>Pala: <strong>{Number(craneHours.shipHrsPala || 0).toLocaleString('es-AR', { maximumFractionDigits: 1 })}h</strong></span>
          </div>
        </div>

        {/* Alerta compacta Pre-Facturación ($0) desplegable al toque */}
        {totalPending > 0 && (
          <div className="p-2.5 bg-amber-950/30 border-t border-amber-500/35 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5" />
                Sin valorizar ($0)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setExpandedAlert((p) => (p === 'TERCEROS' ? null : 'TERCEROS'))}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/20 border border-amber-400/40 text-[11px] font-bold text-amber-200"
                >
                  Terc: {zeroCostAlerts.thirdPartyCount}
                  {expandedAlert === 'TERCEROS' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                <button
                  type="button"
                  onClick={() => setExpandedAlert((p) => (p === 'MATERIALES' ? null : 'MATERIALES'))}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-rose-500/20 border border-rose-400/40 text-[11px] font-bold text-rose-200"
                >
                  Mat: {zeroCostAlerts.materialsCount}
                  {expandedAlert === 'MATERIALES' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
            </div>
            {expandedAlert === 'TERCEROS' && (
              <ZeroCostAlertHoverCard
                kind="TERCEROS"
                items={zeroCostAlerts.thirdPartyItems}
                showShip={false}
                maxItems={8}
              />
            )}
            {expandedAlert === 'MATERIALES' && (
              <ZeroCostAlertHoverCard
                kind="MATERIALES"
                items={zeroCostAlerts.materialItems}
                showShip={false}
                maxItems={8}
              />
            )}
          </div>
        )}
      </div>

      {/* Tarjeta Secundaria: Detalle por Orden de Trabajo (seleccionada en Zona 1) */}
      <div className="bg-slate-950/90 border border-violet-500/40 rounded-2xl overflow-hidden shadow-lg">
        <div className="px-3.5 py-2.5 bg-violet-950/45 border-b border-violet-500/30 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-300 block">
              Detalle Orden de Trabajo
            </span>
            <CanonicalOtBadge
              wo={activeOt?.wo || null}
              ship={ship}
              otNumber={activeOt?.otNumber}
              otTitle={activeOt?.title}
              tooltipOverride={activeOt?.canonicalTooltip || ''}
              variant="inline"
              sinOtLabel="Sin OT activa"
              className="text-xs font-extrabold text-white max-w-full"
            />
          </div>
          {activeOt && (
            <span className="text-lg font-black text-violet-200 tabular-nums shrink-0">
              {formatUsd(activeOt.directTotalUsd)}
            </span>
          )}
        </div>

        {activeOt ? (
          <div className="p-3 space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-cyan-950/30 border border-cyan-500/30">
                <span className="text-[10px] uppercase text-cyan-300 font-bold block">Mat + Cons</span>
                <span className="text-sm font-black text-cyan-100 tabular-nums">{formatUsd(activeOt.matPlusConsUsd)}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Mat {formatUsd(activeOt.materialesUsd, 0)} · Cons {formatUsd(activeOt.consumiblesObraUsd, 0)}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/30">
                <span className="text-[10px] uppercase text-emerald-300 font-bold block">M.O Total</span>
                <span className="text-sm font-black text-emerald-100 tabular-nums">{formatUsd(activeOt.manoObraTotalUsd)}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Terc {formatUsd(activeOt.tercerosUsd, 0)} · Hrs {formatUsd(activeOt.horasTotalUsd, 0)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span>Peso: <strong className="text-slate-200">{formatKg(activeOt.weightKg, 1)}</strong></span>
              <span>Horas: <strong className="text-slate-200">{activeOt.physicalHours.toLocaleString('es-AR', { maximumFractionDigits: 1 })} h</strong></span>
              <span>EPP Ref: <strong className="text-amber-300">{formatUsd(activeOt.seguridadReferenciaUsd, 0)}</strong></span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-violet-200/90 bg-violet-950/25 border border-violet-500/25 rounded-lg px-2.5 py-1 tabular-nums">
              <span>Grúa G: <strong>{Number(craneHours.otGruaGrande || 0).toLocaleString('es-AR', { maximumFractionDigits: 1 })}h</strong></span>
              <span>Grúa Ch: <strong>{Number(craneHours.otGruaChica || 0).toLocaleString('es-AR', { maximumFractionDigits: 1 })}h</strong></span>
              <span>Pala: <strong>{Number(craneHours.otHrsPala || 0).toLocaleString('es-AR', { maximumFractionDigits: 1 })}h</strong></span>
            </div>

            {activeOt.description && (
              <p className="text-[11px] text-slate-300 bg-slate-900/80 border border-slate-800 rounded-lg p-2 leading-snug">
                {activeOt.description}
              </p>
            )}
          </div>
        ) : (
          <div className="p-4 text-center text-xs text-slate-500">
            Sin órdenes de trabajo con costos para este alcance.
          </div>
        )}
      </div>
    </div>
  )
}
