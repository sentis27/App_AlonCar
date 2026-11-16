import React, { useState } from 'react'
import { Anchor, ShieldAlert, AlertTriangle, Package, Wrench, ArrowUpRight } from 'lucide-react'
import { formatUsd, formatKg } from '../../lib/drydockCatalogConstants'
import SvgDonutCard from './SvgDonutCard'
import ZeroCostAlertHoverCard from '../ZeroCostAlertHoverCard'

function formatHrs(val) {
  return `${(Number(val) || 0).toLocaleString('es-AR', { maximumFractionDigits: 1 })} hs`
}

/**
 * Bloque Superior Ejecutivo del Buque (Costos Generales · Paleta Cian · 100% Solo Lectura):
 * - Columna izquierda angosta (3/12 en xl): Costo Directo Total US$ + horas de maquinaria (Grúa G., Grúa Ch., Pala) desde Horas.
 * - Columna derecha amplia (9/12 en xl): 1 franja KPI unificada ($0) + 4 Donuts en 1 línea.
 */
export default function ResumenShipCostStrip({
  ship,
  totals,
  craneHours = {},
  donutsShip,
  zeroCostAlerts = { thirdPartyCount: 0, materialsCount: 0, thirdPartyItems: [], materialItems: [] },
  onOpenCostSheet
}) {
  const [hoveredAlertKind, setHoveredAlertKind] = useState(null)

  const totalPendingZero = (zeroCostAlerts.thirdPartyCount || 0) + (zeroCostAlerts.materialsCount || 0)
  const hasAlerts = totalPendingZero > 0

  return (
    <div className="bg-cyan-950/15 border border-cyan-500/40 rounded-xl p-2.5">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-stretch">
        {/* Columna izquierda acortada: Tabla financiera GS-004 del Buque */}
        <div className="lg:col-span-4 xl:col-span-3 bg-slate-950/90 border border-cyan-500/45 rounded-xl overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-3 py-1.5 bg-cyan-950/65 border-b border-cyan-500/35 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Anchor className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-cyan-100 truncate">
                  COSTOS GENERALES US$
                </h3>
              </div>
              <span className="text-[10px] font-bold text-cyan-300 truncate max-w-[95px]" title={ship.name}>
                {ship.name}
              </span>
            </div>

            <div className="divide-y divide-slate-800/80 text-[11px]">
              <div className="px-3 py-1.5 flex items-center justify-between gap-2">
                <span className="text-slate-300 font-medium truncate">1. MATERIALES</span>
                <span className="font-bold text-slate-100 tabular-nums shrink-0">{formatUsd(totals.materialesUsd)}</span>
              </div>
              <div className="px-3 py-1.5 flex items-center justify-between gap-2">
                <span className="text-slate-300 font-medium truncate">2. MAT. CONSUMIBLES</span>
                <span className="font-bold text-slate-100 tabular-nums shrink-0">{formatUsd(totals.consumiblesObraUsd)}</span>
              </div>
              <div className="px-3 py-1.5 flex items-center justify-between gap-2">
                <span className="text-slate-300 font-medium truncate">3. TERCEROS</span>
                <span className="font-bold text-slate-100 tabular-nums shrink-0">{formatUsd(totals.tercerosUsd)}</span>
              </div>
              <div className="px-3 py-1.5 flex items-center justify-between gap-2">
                <span className="text-slate-300 font-medium truncate">4. HORAS APROBADAS</span>
                <span className="font-bold text-slate-100 tabular-nums shrink-0">{formatUsd(totals.horasUsd)}</span>
              </div>
              <div className="px-3 py-1.5 flex items-center justify-between gap-2 bg-amber-950/15">
                <span className="text-amber-200/90 font-medium truncate">5. HORAS PEND. (&quot;R&quot;)</span>
                <span className="font-bold text-amber-300 tabular-nums shrink-0">{formatUsd(totals.horasPendAprobarUsd)}</span>
              </div>

              {/* Regla EPP Astillero: visible en ámbar punteado debajo de "R", nunca suma */}
              <div className="px-2.5 py-1.5 bg-amber-500/10 border-y border-dashed border-amber-400/50 flex items-center justify-between gap-1.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-amber-300">
                    <ShieldAlert className="w-3 h-3 shrink-0" />
                    <span className="truncate">ELEM. SEGURIDAD (REF.)</span>
                  </div>
                  <p className="text-[9px] text-amber-200/70 truncate">EPP propio · No suma al Total</p>
                </div>
                <span className="font-bold text-amber-300 tabular-nums shrink-0 text-[11px]">
                  {formatUsd(totals.seguridadReferenciaUsd)}
                </span>
              </div>

              {/* Maquinaria 100% solo lectura sumada automáticamente desde Horas (labor_logs) */}
              <div
                className="px-2.5 py-1.5 bg-cyan-950/20 grid grid-cols-3 gap-1.5 text-[10px] select-none"
                title="Suma automática de horas imputadas en Planilla de Horas (solo lectura)"
              >
                <div className="bg-slate-900/75 border border-slate-800 rounded px-1.5 py-0.5 flex flex-col">
                  <span className="text-[9px] text-slate-400 font-semibold truncate">GRÚA G.</span>
                  <span className="font-bold text-cyan-200 tabular-nums">{formatHrs(craneHours.shipGruaGrande)}</span>
                </div>
                <div className="bg-slate-900/75 border border-slate-800 rounded px-1.5 py-0.5 flex flex-col">
                  <span className="text-[9px] text-slate-400 font-semibold truncate">GRÚA CH.</span>
                  <span className="font-bold text-cyan-200 tabular-nums">{formatHrs(craneHours.shipGruaChica)}</span>
                </div>
                <div className="bg-slate-900/75 border border-slate-800 rounded px-1.5 py-0.5 flex flex-col">
                  <span className="text-[9px] text-slate-400 font-semibold truncate">HRS. PALA</span>
                  <span className="font-bold text-cyan-200 tabular-nums">{formatHrs(craneHours.shipHrsPala)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="px-3 py-2 bg-emerald-950/45 border-t border-emerald-500/40 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-300 block">
                TOTAL US$ OBRA
              </span>
              <span className="text-[9px] text-emerald-200/70 truncate block">
                Mat + Cons + Terc + Horas (&quot;R&quot;)
              </span>
            </div>
            <span className="text-base font-black text-emerald-300 tabular-nums shrink-0">
              {formatUsd(totals.directTotalUsd)}
            </span>
          </div>
        </div>

        {/* Columna derecha amplia: Franja KPI única ($0 Pre-Facturación) + 4 Donuts en 1 línea */}
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-2.5">
          {/* KPI Único Unificado: Pendientes de Valorizar ($0) */}
          <div
            className={`relative rounded-xl border px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 ${
              hasAlerts
                ? 'bg-amber-950/25 border-amber-500/45'
                : 'bg-emerald-950/20 border-emerald-500/35'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className={`w-4 h-4 shrink-0 ${hasAlerts ? 'text-amber-400' : 'text-emerald-400'}`} />
              <div className="min-w-0">
                <span className={`text-[11px] font-extrabold uppercase tracking-wider ${hasAlerts ? 'text-amber-300' : 'text-emerald-300'}`}>
                  Pendientes de Valorizar ($0 · Pre-Facturación)
                </span>
                <span className="hidden sm:inline text-[10px] text-slate-400 ml-2">
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
                  onClick={() => onOpenCostSheet('terceros', 'GENERAL', 'SIN_COSTO')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                    zeroCostAlerts.thirdPartyCount > 0
                      ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-400/50 text-amber-200'
                      : 'bg-slate-900/70 hover:bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Terceros $0:</span>
                  <span className="font-mono font-black text-white">{zeroCostAlerts.thirdPartyCount}</span>
                  <ArrowUpRight className="w-3 h-3 opacity-75" />
                </button>

                {hoveredAlertKind === 'TERCEROS' && (
                  <div className="absolute right-0 top-full pt-1.5 z-50 w-[min(520px,85vw)]">
                    <ZeroCostAlertHoverCard
                      kind="TERCEROS"
                      items={zeroCostAlerts.thirdPartyItems}
                      showShip={false}
                      title={`Terceros Sin Costo ($0) — ${ship.name}`}
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
                  onClick={() => onOpenCostSheet('materiales', 'GENERAL', 'PRECIO_0')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                    zeroCostAlerts.materialsCount > 0
                      ? 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-400/50 text-rose-200'
                      : 'bg-slate-900/70 hover:bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  <Package className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>Materiales $0:</span>
                  <span className="font-mono font-black text-white">{zeroCostAlerts.materialsCount}</span>
                  <ArrowUpRight className="w-3 h-3 opacity-75" />
                </button>

                {hoveredAlertKind === 'MATERIALES' && (
                  <div className="absolute right-0 top-full pt-1.5 z-50 w-[min(540px,85vw)]">
                    <ZeroCostAlertHoverCard
                      kind="MATERIALES"
                      items={zeroCostAlerts.materialItems}
                      showShip={false}
                      title={`Materiales Imputados Sin Precio ($0, excl. EPP) — ${ship.name}`}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 4 Donuts en 1 Sola Línea Visual en desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 flex-1">
            <SvgDonutCard
              title="TOTAL POR O.T"
              segments={donutsShip?.totalPorOt || []}
              centerLabel="TOTAL"
              centerValue={formatUsd(totals.directTotalUsd, 0)}
              valueFormatter={(v) => formatUsd(v, 0)}
              layout="vertical"
              size={128}
              compact
            />
            <SvgDonutCard
              title="DISTRIBUCIÓN PESO"
              segments={donutsShip?.pesosPorOt || []}
              centerLabel="PESO"
              centerValue={formatKg(totals.weightKg, 0)}
              valueFormatter={(v) => formatKg(v, 1)}
              layout="vertical"
              size={128}
              compact
            />
            <SvgDonutCard
              title="TOTAL DE HORAS"
              segments={donutsShip?.horasPorOt || []}
              centerLabel="HORAS"
              centerValue={`${totals.physicalHours.toLocaleString('es-AR', { maximumFractionDigits: 0 })} h`}
              valueFormatter={(v) => `${v.toLocaleString('es-AR', { maximumFractionDigits: 1 })} hs`}
              layout="vertical"
              size={128}
              compact
            />
            <SvgDonutCard
              title="TERCEROS TOTAL"
              segments={donutsShip?.tercerosPorOt || []}
              centerLabel="TERC."
              centerValue={formatUsd(totals.tercerosUsd, 0)}
              valueFormatter={(v) => formatUsd(v, 0)}
              layout="vertical"
              size={128}
              compact
            />
          </div>
        </div>
      </div>
    </div>
  )
}
