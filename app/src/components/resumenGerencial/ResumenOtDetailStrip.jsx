import React, { useState } from 'react'
import { Layers, ArrowUpRight } from 'lucide-react'
import { formatUsd, formatKg } from '../../lib/drydockCatalogConstants'
import SvgDonutCard from './SvgDonutCard'
import CostCategoryHoverCard from './CostCategoryHoverCard'
import ResumenEquipmentButtonsRow from './ResumenEquipmentButtonsRow'

/**
 * Bloque Inferior: DETALLE POR ORDEN DE TRABAJO (Paleta Violeta · 100% Solo Lectura).
 * - Cada fila de costo (Materiales, Consumibles, Terceros, Horas) muestra previsualización al hover
 *   y abre su hoja filtrada por la OT activa al clic.
 * - Regla OT: siempre exhibe Nombre + Número (`otLabel`), nunca solo el número.
 */
export default function ResumenOtDetailStrip({
  activeOt,
  craneHours = {},
  donutsOt,
  hoverOt = null,
  onOpenCostSheet
}) {
  const [hoveredCostKey, setHoveredCostKey] = useState(null)

  const activeOtLabel = activeOt
    ? activeOt.otLabel || `${activeOt.otNumber} · ${activeOt.title}`
    : ''

  const renderInteractiveRow = ({
    rowKey,
    label,
    value,
    sheet,
    kpi,
    hoverMode,
    hoverTitle,
    hoverSubtitle,
    hoverData
  }) => {
    const isHovered = hoveredCostKey === rowKey
    return (
      <div
        key={rowKey}
        className={`relative ${isHovered ? 'z-40' : ''}`}
        onMouseEnter={() => setHoveredCostKey(rowKey)}
        onMouseLeave={() => setHoveredCostKey((prev) => (prev === rowKey ? null : prev))}
      >
        <button
          type="button"
          onClick={() => onOpenCostSheet?.(sheet, 'OT', kpi)}
          className={`group w-full px-3 py-1.5 flex items-center justify-between gap-1.5 text-left transition-colors cursor-pointer hover:bg-violet-500/20 ${
            isHovered ? 'ring-1 ring-inset ring-violet-400/70' : ''
          }`}
        >
          <span className="text-[12.5px] font-bold text-slate-200 group-hover:text-violet-100 truncate flex items-center gap-1">
            <span className="truncate">{label}</span>
            <ArrowUpRight className="w-3.5 h-3.5 opacity-55 group-hover:opacity-100 text-violet-300 shrink-0 transition-opacity" />
          </span>
          <span className="text-[13px] font-extrabold text-white tabular-nums shrink-0">
            {formatUsd(value)}
          </span>
        </button>

        {isHovered && (
          <div className="hidden md:block absolute left-full bottom-0 pl-2 z-50 w-[min(500px,50vw)]">
            <CostCategoryHoverCard
              mode={hoverMode}
              scope="OT"
              title={hoverTitle}
              subtitle={hoverSubtitle}
              summaryData={hoverData}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-violet-950/15 border border-violet-500/40 rounded-xl p-2.5 flex-1 flex flex-col justify-between">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 mb-2 border-b border-violet-500/25">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-violet-200">
            <Layers className="w-4 h-4 text-violet-300 shrink-0" />
            DETALLE POR ORDEN DE TRABAJO (COSTOS POR O.T. US$)
          </span>
          {activeOt && (
            <span className="px-2.5 py-0.5 rounded-md bg-violet-950/75 border border-violet-400/45 text-xs font-bold text-violet-100 truncate max-w-[440px]">
              {activeOtLabel}
            </span>
          )}
        </div>
        <span className="text-[11px] text-slate-400">
          Parámetro O.T. controlado en <strong className="text-violet-300">Zona 1</strong> · Solo lectura
        </span>
      </div>

      {!activeOt ? (
        <div className="py-5 text-center text-xs text-slate-500">
          No hay órdenes de trabajo con costos para el alcance seleccionado.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch flex-1">
          {/* Bloque izquierdo: Llaves laterales Mat+Cons y M.O Total + Grúas/Pala solo lectura (sin overflow-hidden) */}
          <div className="lg:col-span-5 xl:col-span-4 bg-slate-950/90 border border-violet-500/45 rounded-xl flex flex-col justify-between relative">
            <div>
              <div className="rounded-t-xl px-3.5 py-2 bg-violet-950/55 border-b border-violet-500/35 flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-violet-100 truncate" title={activeOtLabel}>
                  {activeOtLabel}
                </span>
                <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-violet-500/25 text-violet-200 font-bold shrink-0">
                  {activeOt.workType}
                </span>
              </div>

              {/* Grupo 1: Materiales + Consumibles + Llave Mat+Cons */}
              <div className="grid grid-cols-12 border-b border-slate-800">
                <div className="col-span-8 divide-y divide-slate-800/70">
                  {renderInteractiveRow({
                    rowKey: 'OT_MATERIALES',
                    label: 'MATERIALES',
                    value: activeOt.materialesUsd,
                    sheet: 'materiales',
                    kpi: 'MATERIALES',
                    hoverMode: 'MATERIALES',
                    hoverTitle: `Materiales — ${activeOtLabel}`,
                    hoverSubtitle: 'Agrupado por material y unidad · Orden A-Z',
                    hoverData: hoverOt?.materiales
                  })}
                  {renderInteractiveRow({
                    rowKey: 'OT_CONSUMIBLES',
                    label: 'MAT. CONSUMIBLES',
                    value: activeOt.consumiblesObraUsd,
                    sheet: 'materiales',
                    kpi: 'CONSUMIBLES',
                    hoverMode: 'MATERIALES',
                    hoverTitle: `Consumibles — ${activeOtLabel}`,
                    hoverSubtitle: 'Agrupado por material y unidad · Orden A-Z',
                    hoverData: hoverOt?.consumibles
                  })}
                </div>
                <div className="col-span-4 bg-cyan-950/25 border-l border-cyan-500/30 flex flex-col items-center justify-center p-1.5 text-center">
                  <span className="text-[10.5px] font-bold uppercase text-cyan-300">Mat+Cons</span>
                  <span className="text-sm font-black text-cyan-100 tabular-nums">
                    {formatUsd(activeOt.matPlusConsUsd)}
                  </span>
                </div>
              </div>

              {/* Grupo 2: Terceros + Horas + Llave M.O Total */}
              <div className="grid grid-cols-12 border-b border-slate-800">
                <div className="col-span-8 divide-y divide-slate-800/70">
                  {renderInteractiveRow({
                    rowKey: 'OT_TERCEROS',
                    label: 'TERCEROS',
                    value: activeOt.tercerosUsd,
                    sheet: 'terceros',
                    kpi: 'ALL',
                    hoverMode: 'TERCEROS',
                    hoverTitle: `Terceros — ${activeOtLabel}`,
                    hoverSubtitle: 'Agrupado por taller (mayor a menor · $0 al final)',
                    hoverData: hoverOt?.terceros
                  })}
                  {renderInteractiveRow({
                    rowKey: 'OT_HORAS',
                    label: 'HORAS (Aprob.+"R")',
                    value: activeOt.horasTotalUsd,
                    sheet: 'horas',
                    kpi: 'ALL',
                    hoverMode: 'HORAS',
                    hoverTitle: `Horas — ${activeOtLabel}`,
                    hoverSubtitle: 'Agrupado por contratista / ASTILLERO.RUBRO (físicas)',
                    hoverData: hoverOt?.horasTotal
                  })}
                </div>
                <div className="col-span-4 bg-emerald-950/25 border-l border-emerald-500/30 flex flex-col items-center justify-center p-1.5 text-center">
                  <span className="text-[10.5px] font-bold uppercase text-emerald-300">M.O Total</span>
                  <span className="text-sm font-black text-emerald-100 tabular-nums">
                    {formatUsd(activeOt.manoObraTotalUsd)}
                  </span>
                </div>
              </div>

              {/* EPP de referencia OT */}
              <div className="px-3.5 py-1 bg-amber-500/10 border-b border-dashed border-amber-400/40 flex items-center justify-between text-[11px]">
                <span className="text-amber-300 font-bold truncate">ELEM. SEGURIDAD (REF. OT · No suma)</span>
                <span className="font-extrabold text-amber-200 tabular-nums shrink-0">
                  {formatUsd(activeOt.seguridadReferenciaUsd)}
                </span>
              </div>

              {/* Maquinaria de la O.T. (hover línea a línea en Grúas + clic abre hoja filtrada) */}
              <ResumenEquipmentButtonsRow
                scope="OT"
                contextLabel={activeOtLabel}
                gruaGrandeHrs={craneHours.otGruaGrande}
                gruaChicaHrs={craneHours.otGruaChica}
                hrsPala={craneHours.otHrsPala}
                hoverGruaGrande={hoverOt?.gruaGrande}
                hoverGruaChica={hoverOt?.gruaChica}
                onOpenCostSheet={onOpenCostSheet}
              />
            </div>

            <div className="rounded-b-xl px-3.5 py-2 bg-violet-950/55 border-t border-violet-500/40 flex items-center justify-between gap-2">
              <span className="text-xs font-black uppercase text-violet-200 truncate" title={`TOTAL US$ (${activeOtLabel})`}>
                TOTAL US$ ({activeOtLabel})
              </span>
              <span className="text-base font-black text-violet-100 tabular-nums shrink-0">
                {formatUsd(activeOt.directTotalUsd)}
              </span>
            </div>
          </div>

          {/* Columna derecha: 3 Totales OT + 3 Anillos Limpios + Descripción compacta */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col justify-between gap-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-950/70 border border-violet-500/25 rounded-lg px-3 py-1.5 flex items-center justify-between">
                <span className="text-[11px] uppercase text-slate-400 font-bold">Peso OT</span>
                <span className="text-sm font-extrabold text-slate-100 tabular-nums">{formatKg(activeOt.weightKg, 1)}</span>
              </div>
              <div className="bg-slate-950/70 border border-violet-500/25 rounded-lg px-3 py-1.5 flex items-center justify-between">
                <span className="text-[11px] uppercase text-slate-400 font-bold">Horas OT</span>
                <span className="text-sm font-extrabold text-slate-100 tabular-nums">
                  {activeOt.physicalHours.toLocaleString('es-AR', { maximumFractionDigits: 1 })} hs
                </span>
              </div>
              <div className="bg-slate-950/70 border border-violet-500/25 rounded-lg px-3 py-1.5 flex items-center justify-between">
                <span className="text-[11px] uppercase text-slate-400 font-bold">Terceros OT</span>
                <span className="text-sm font-extrabold text-slate-100 tabular-nums">{formatUsd(activeOt.tercerosUsd)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 flex-1">
              <SvgDonutCard
                title="KILOS POR RUBRO"
                segments={donutsOt?.kilosPorRubro || []}
                centerLabel="KG OT"
                centerValue={formatKg(activeOt.weightKg, 0)}
                valueFormatter={(v) => formatKg(v, 1)}
                size={138}
                strokeWidth={20}
                showLegend={false}
                compact
              />
              <SvgDonutCard
                title="HORAS POR OFICIO"
                segments={donutsOt?.horasPorOficio || []}
                centerLabel="HORAS"
                centerValue={`${activeOt.physicalHours.toLocaleString('es-AR', { maximumFractionDigits: 0 })} h`}
                valueFormatter={(v) => `${v.toLocaleString('es-AR', { maximumFractionDigits: 1 })} hs`}
                size={138}
                strokeWidth={20}
                showLegend={false}
                compact
              />
              <SvgDonutCard
                title="TERCEROS OT"
                segments={donutsOt?.tercerosOt || []}
                centerLabel="TERC."
                centerValue={formatUsd(activeOt.tercerosUsd, 0)}
                valueFormatter={(v) => formatUsd(v)}
                size={138}
                strokeWidth={20}
                showLegend={false}
                compact
              />
            </div>

            <div
              className="bg-slate-950/80 border border-slate-700/80 rounded-lg px-3 py-1.5 flex items-baseline gap-2"
              title={activeOt.description || 'Sin descripción de trabajos registrada en OTs.'}
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0 max-w-[260px] truncate">
                Descripción ({activeOtLabel}):
              </span>
              <p className="text-xs text-slate-100 truncate">
                {activeOt.description || 'Sin descripción de trabajos registrada en OTs.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
