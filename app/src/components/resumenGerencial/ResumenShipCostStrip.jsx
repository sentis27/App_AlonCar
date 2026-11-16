import React, { useState } from 'react'
import { Anchor, ShieldAlert, ArrowUpRight } from 'lucide-react'
import { formatUsd, formatKg } from '../../lib/drydockCatalogConstants'
import SvgDonutCard from './SvgDonutCard'
import CostCategoryHoverCard from './CostCategoryHoverCard'
import ResumenZeroCostBanner from './ResumenZeroCostBanner'
import ResumenEquipmentButtonsRow from './ResumenEquipmentButtonsRow'

function buildShipCostDisplayRows({ shipName = '', totals = {}, hoverShip = null } = {}) {
  return [
    { key: 'MATERIALES', label: '1. MATERIALES', value: totals.materialesUsd, sheet: 'materiales', kpi: 'MATERIALES', hoverMode: 'MATERIALES', hoverTitle: `Materiales Directos — ${shipName}`, hoverSubtitle: 'Agrupado por material y unidad · Orden A-Z', hoverData: hoverShip?.materiales, anchor: 'top', isPending: false },
    { key: 'CONSUMIBLES', label: '2. MAT. CONSUMIBLES', value: totals.consumiblesObraUsd, sheet: 'materiales', kpi: 'CONSUMIBLES', hoverMode: 'MATERIALES', hoverTitle: `Materiales Consumibles — ${shipName}`, hoverSubtitle: 'Agrupado por material y unidad · Orden A-Z', hoverData: hoverShip?.consumibles, anchor: 'top', isPending: false },
    { key: 'TERCEROS', label: '3. TERCEROS', value: totals.tercerosUsd, sheet: 'terceros', kpi: 'ALL', hoverMode: 'TERCEROS', hoverTitle: `Servicios de Terceros — ${shipName}`, hoverSubtitle: 'Agrupado por taller (mayor a menor · $0 al final)', hoverData: hoverShip?.terceros, anchor: 'top', isPending: false },
    { key: 'HORAS_APROB', label: '4. HORAS APROBADAS', value: totals.horasUsd, sheet: 'horas', kpi: 'APPROVED', hoverMode: 'HORAS', hoverTitle: `Horas Aprobadas — ${shipName}`, hoverSubtitle: 'Agrupado por contratista / ASTILLERO.RUBRO (físicas)', hoverData: hoverShip?.horasAprobadas, anchor: 'top', isPending: false },
    { key: 'HORAS_PEND_R', label: '5. HORAS PEND. ("R")', value: totals.horasPendAprobarUsd, sheet: 'horas', kpi: 'PENDING_R', hoverMode: 'HORAS', hoverTitle: `Horas Pendientes ("R") — ${shipName}`, hoverSubtitle: 'Agrupado por contratista / ASTILLERO.RUBRO (físicas)', hoverData: hoverShip?.horasPendR, anchor: 'bottom', isPending: true }
  ]
}

/**
 * Bloque Superior Ejecutivo del Buque (Costos Generales · Paleta Cian · 100% Solo Lectura):
 * - Columna izquierda: filas de costo interactivas (hover resumen + clic a hoja filtrada).
 * - Columna derecha: franja KPI ($0 Pre-Facturación) + 4 Anillos Limpios (sin leyenda inferior).
 */
export default function ResumenShipCostStrip({
  ship,
  totals,
  craneHours = {},
  donutsShip,
  zeroCostAlerts = { thirdPartyCount: 0, materialsCount: 0, thirdPartyItems: [], materialItems: [] },
  hoverShip = null,
  onOpenCostSheet
}) {
  const [hoveredCostKey, setHoveredCostKey] = useState(null)

  const costRows = buildShipCostDisplayRows({ shipName: ship.name, totals, hoverShip })

  return (
    <div className="bg-cyan-950/15 border border-cyan-500/40 rounded-xl p-2.5">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        {/* Columna izquierda: Tabla financiera GS-004 del Buque (sin overflow-hidden para permitir hover card lateral) */}
        <div className="lg:col-span-5 xl:col-span-4 bg-slate-950/90 border border-cyan-500/45 rounded-xl flex flex-col justify-between relative">
          <div>
            <div className="rounded-t-xl px-3.5 py-2 bg-cyan-950/65 border-b border-cyan-500/35 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Anchor className="w-4 h-4 text-cyan-300 shrink-0" />
                <h3 className="text-xs font-black uppercase tracking-wider text-cyan-100 truncate">
                  COSTOS GENERALES US$
                </h3>
              </div>
              <span className="text-xs font-bold text-cyan-300 truncate max-w-[140px]" title={ship.name}>
                {ship.name}
              </span>
            </div>

            <div className="divide-y divide-slate-800/80">
              {costRows.map((row) => {
                const isHovered = hoveredCostKey === row.key
                return (
                  <div
                    key={row.key}
                    className={`relative ${isHovered ? 'z-40' : ''}`}
                    onMouseEnter={() => setHoveredCostKey(row.key)}
                    onMouseLeave={() => setHoveredCostKey((prev) => (prev === row.key ? null : prev))}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenCostSheet?.(row.sheet, 'GENERAL', row.kpi)}
                      className={`group w-full px-3.5 py-2 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                        row.isPending ? 'bg-amber-950/20 hover:bg-amber-950/45' : 'hover:bg-cyan-500/15'
                      } ${isHovered ? 'ring-1 ring-inset ring-cyan-400/60' : ''}`}
                    >
                      <span
                        className={`text-[13px] font-bold truncate flex items-center gap-1.5 ${
                          row.isPending ? 'text-amber-200' : 'text-slate-200 group-hover:text-cyan-100'
                        }`}
                      >
                        <span className="truncate">{row.label}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 opacity-55 group-hover:opacity-100 text-cyan-300 shrink-0 transition-opacity" />
                      </span>
                      <span className={`text-sm font-extrabold tabular-nums shrink-0 ${row.isPending ? 'text-amber-300' : 'text-white'}`}>
                        {formatUsd(row.value)}
                      </span>
                    </button>

                    {isHovered && (
                      <div className={`hidden md:block absolute left-full ${row.anchor === 'bottom' ? 'bottom-0' : 'top-0'} pl-2 z-50 w-[min(520px,54vw)]`}>
                        <CostCategoryHoverCard
                          mode={row.hoverMode}
                          scope="GENERAL"
                          title={row.hoverTitle}
                          subtitle={row.hoverSubtitle}
                          summaryData={row.hoverData}
                        />
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Regla EPP Astillero: visible en ámbar punteado debajo de "R", nunca suma */}
              <div className="px-3.5 py-1.5 bg-amber-500/10 border-y border-dashed border-amber-400/50 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">ELEM. SEGURIDAD (REF.)</span>
                  </div>
                  <p className="text-[10px] text-amber-200/75 truncate">EPP propio · No suma al Total</p>
                </div>
                <span className="font-bold text-amber-300 tabular-nums shrink-0 text-xs">
                  {formatUsd(totals.seguridadReferenciaUsd)}
                </span>
              </div>

              {/* Maquinaria interactiva desde Horas (hover detalle en Grúas + clic abre hoja filtrada) */}
              <ResumenEquipmentButtonsRow
                scope="GENERAL"
                contextLabel={ship.name}
                gruaGrandeHrs={craneHours.shipGruaGrande}
                gruaChicaHrs={craneHours.shipGruaChica}
                hrsPala={craneHours.shipHrsPala}
                hoverGruaGrande={hoverShip?.gruaGrande}
                hoverGruaChica={hoverShip?.gruaChica}
                onOpenCostSheet={onOpenCostSheet}
              />
            </div>
          </div>

          <div className="rounded-b-xl px-3.5 py-2 bg-emerald-950/45 border-t border-emerald-500/40 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-300 block">TOTAL US$ OBRA</span>
              <span className="text-[10px] text-emerald-200/75 truncate block">Mat + Cons + Terc + Horas (&quot;R&quot;)</span>
            </div>
            <span className="text-xl font-black text-emerald-300 tabular-nums shrink-0">{formatUsd(totals.directTotalUsd)}</span>
          </div>
        </div>

        {/* Columna derecha: Franja KPI única ($0 Pre-Facturación) + 4 Anillos Limpios en 1 línea */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-2.5">
          <ResumenZeroCostBanner
            shipName={ship.name}
            zeroCostAlerts={zeroCostAlerts}
            onOpenCostSheet={onOpenCostSheet}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 flex-1">
            <SvgDonutCard
              title="TOTAL POR O.T"
              segments={donutsShip?.totalPorOt || []}
              centerLabel="TOTAL"
              centerValue={formatUsd(totals.directTotalUsd, 0)}
              valueFormatter={(v) => formatUsd(v)}
              layout="vertical"
              size={156}
              strokeWidth={22}
              showLegend={false}
              compact
            />
            <SvgDonutCard
              title="DISTRIBUCIÓN PESO"
              segments={donutsShip?.pesosPorOt || []}
              centerLabel="PESO"
              centerValue={formatKg(totals.weightKg, 0)}
              valueFormatter={(v) => formatKg(v, 1)}
              layout="vertical"
              size={156}
              strokeWidth={22}
              showLegend={false}
              compact
            />
            <SvgDonutCard
              title="TOTAL DE HORAS"
              segments={donutsShip?.horasPorOt || []}
              centerLabel="HORAS"
              centerValue={`${totals.physicalHours.toLocaleString('es-AR', { maximumFractionDigits: 0 })} h`}
              valueFormatter={(v) => `${v.toLocaleString('es-AR', { maximumFractionDigits: 1 })} hs`}
              layout="vertical"
              size={156}
              strokeWidth={22}
              showLegend={false}
              compact
            />
            <SvgDonutCard
              title="TERCEROS TOTAL"
              segments={donutsShip?.tercerosPorOt || []}
              centerLabel="TERC."
              centerValue={formatUsd(totals.tercerosUsd, 0)}
              valueFormatter={(v) => formatUsd(v)}
              layout="vertical"
              size={156}
              strokeWidth={22}
              showLegend={false}
              compact
            />
          </div>
        </div>
      </div>
    </div>
  )
}
