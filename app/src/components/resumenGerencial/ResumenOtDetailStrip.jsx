import React from 'react'
import { Layers } from 'lucide-react'
import { formatUsd, formatKg } from '../../lib/drydockCatalogConstants'
import SvgDonutCard from './SvgDonutCard'

function formatHrs(val) {
  return `${(Number(val) || 0).toLocaleString('es-AR', { maximumFractionDigits: 1 })} hs`
}

/**
 * Bloque Inferior: DETALLE POR ORDEN DE TRABAJO (Paleta Violeta · 100% Solo Lectura).
 * - Controlado desde el selector OT de Zona 1 (sin controles duplicados abajo).
 * - Horas de Grúa Grande, Grúa Chica y Pala calculadas automáticamente desde Horas (`labor_logs`).
 */
export default function ResumenOtDetailStrip({
  activeOt,
  craneHours = {},
  donutsOt
}) {
  return (
    <div className="bg-violet-950/15 border border-violet-500/40 rounded-xl p-2.5 flex-1 flex flex-col justify-between">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 mb-2 border-b border-violet-500/25">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-violet-200">
            <Layers className="w-3.5 h-3.5 text-violet-300 shrink-0" />
            DETALLE POR ORDEN DE TRABAJO (COSTOS POR O.T. US$)
          </span>
          {activeOt && (
            <span className="px-2 py-0.5 rounded-md bg-violet-950/70 border border-violet-400/45 text-[11px] font-bold text-violet-100 truncate max-w-[360px]">
              {activeOt.otNumber} · {activeOt.title}
            </span>
          )}
        </div>
        <span className="text-[10px] text-slate-400">
          Parámetro O.T. controlado en <strong className="text-violet-300">Zona 1</strong> · Solo lectura
        </span>
      </div>

      {!activeOt ? (
        <div className="py-5 text-center text-xs text-slate-500">
          No hay órdenes de trabajo con costos para el alcance seleccionado.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-stretch flex-1">
          {/* Bloque izquierdo: Llaves laterales Mat+Cons y M.O Total + Grúas/Pala solo lectura */}
          <div className="lg:col-span-5 xl:col-span-4 bg-slate-950/90 border border-violet-500/45 rounded-xl overflow-hidden flex flex-col justify-between">
            <div>
              <div className="px-3 py-1.5 bg-violet-950/55 border-b border-violet-500/35 flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-violet-100 truncate">
                  {activeOt.otNumber} — {activeOt.title}
                </span>
                <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-violet-500/25 text-violet-200 font-semibold shrink-0">
                  {activeOt.workType}
                </span>
              </div>

              {/* Grupo 1: Materiales + Consumibles + Llave Mat+Cons */}
              <div className="grid grid-cols-12 border-b border-slate-800">
                <div className="col-span-8 divide-y divide-slate-800/70 text-[11px]">
                  <div className="px-3 py-1 flex items-center justify-between gap-1">
                    <span className="text-slate-300 truncate">MATERIALES</span>
                    <span className="font-bold text-slate-100 tabular-nums shrink-0">{formatUsd(activeOt.materialesUsd)}</span>
                  </div>
                  <div className="px-3 py-1 flex items-center justify-between gap-1">
                    <span className="text-slate-300 truncate">MAT. CONSUMIBLES</span>
                    <span className="font-bold text-slate-100 tabular-nums shrink-0">{formatUsd(activeOt.consumiblesObraUsd)}</span>
                  </div>
                </div>
                <div className="col-span-4 bg-cyan-950/25 border-l border-cyan-500/30 flex flex-col items-center justify-center p-1.5 text-center">
                  <span className="text-[9.5px] font-bold uppercase text-cyan-300">Mat+Cons</span>
                  <span className="text-[11.5px] font-extrabold text-cyan-100 tabular-nums">
                    {formatUsd(activeOt.matPlusConsUsd)}
                  </span>
                </div>
              </div>

              {/* Grupo 2: Terceros + Horas + Llave M.O Total */}
              <div className="grid grid-cols-12 border-b border-slate-800">
                <div className="col-span-8 divide-y divide-slate-800/70 text-[11px]">
                  <div className="px-3 py-1 flex items-center justify-between gap-1">
                    <span className="text-slate-300 truncate">TERCEROS</span>
                    <span className="font-bold text-slate-100 tabular-nums shrink-0">{formatUsd(activeOt.tercerosUsd)}</span>
                  </div>
                  <div className="px-3 py-1 flex items-center justify-between gap-1">
                    <span className="text-slate-300 truncate">HORAS (Aprob.+&quot;R&quot;)</span>
                    <span className="font-bold text-slate-100 tabular-nums shrink-0">{formatUsd(activeOt.horasTotalUsd)}</span>
                  </div>
                </div>
                <div className="col-span-4 bg-emerald-950/25 border-l border-emerald-500/30 flex flex-col items-center justify-center p-1.5 text-center">
                  <span className="text-[9.5px] font-bold uppercase text-emerald-300">M.O Total</span>
                  <span className="text-[11.5px] font-extrabold text-emerald-100 tabular-nums">
                    {formatUsd(activeOt.manoObraTotalUsd)}
                  </span>
                </div>
              </div>

              {/* EPP de referencia OT */}
              <div className="px-3 py-1 bg-amber-500/10 border-b border-dashed border-amber-400/40 flex items-center justify-between text-[10.5px]">
                <span className="text-amber-300 font-semibold truncate">ELEM. SEGURIDAD (REF. OT · No suma)</span>
                <span className="font-bold text-amber-200 tabular-nums shrink-0">
                  {formatUsd(activeOt.seguridadReferenciaUsd)}
                </span>
              </div>

              {/* Grúas y Pala específicas de la OT (100% solo lectura desde Planilla de Horas) */}
              <div
                className="px-2.5 py-1.5 bg-violet-950/20 grid grid-cols-3 gap-1.5 text-[10px] select-none"
                title="Suma automática de horas imputadas a esta O.T. en Planilla de Horas (solo lectura)"
              >
                <div className="bg-slate-900/75 border border-slate-800 rounded px-1.5 py-0.5 flex flex-col">
                  <span className="text-[9px] text-amber-200/75 font-semibold truncate">GRÚA G.</span>
                  <span className="font-bold text-amber-200 tabular-nums">{formatHrs(craneHours.otGruaGrande)}</span>
                </div>
                <div className="bg-slate-900/75 border border-slate-800 rounded px-1.5 py-0.5 flex flex-col">
                  <span className="text-[9px] text-amber-200/75 font-semibold truncate">GRÚA CH.</span>
                  <span className="font-bold text-amber-200 tabular-nums">{formatHrs(craneHours.otGruaChica)}</span>
                </div>
                <div className="bg-slate-900/75 border border-slate-800 rounded px-1.5 py-0.5 flex flex-col">
                  <span className="text-[9px] text-amber-200/75 font-semibold truncate">HRS. PALA</span>
                  <span className="font-bold text-amber-200 tabular-nums">{formatHrs(craneHours.otHrsPala)}</span>
                </div>
              </div>
            </div>

            <div className="px-3 py-1.5 bg-violet-950/55 border-t border-violet-500/40 flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase text-violet-200">
                TOTAL US$ ({activeOt.otNumber})
              </span>
              <span className="text-sm font-black text-violet-100 tabular-nums">
                {formatUsd(activeOt.directTotalUsd)}
              </span>
            </div>
          </div>

          {/* Columna derecha: 3 Totales OT + 3 Donuts + Descripción compacta */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col justify-between gap-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-950/70 border border-violet-500/25 rounded-lg px-2.5 py-1 flex items-center justify-between">
                <span className="text-[10px] uppercase text-slate-400 font-semibold">Peso OT</span>
                <span className="text-xs font-bold text-slate-100 tabular-nums">{formatKg(activeOt.weightKg, 1)}</span>
              </div>
              <div className="bg-slate-950/70 border border-violet-500/25 rounded-lg px-2.5 py-1 flex items-center justify-between">
                <span className="text-[10px] uppercase text-slate-400 font-semibold">Horas OT</span>
                <span className="text-xs font-bold text-slate-100 tabular-nums">
                  {activeOt.physicalHours.toLocaleString('es-AR', { maximumFractionDigits: 1 })} hs
                </span>
              </div>
              <div className="bg-slate-950/70 border border-violet-500/25 rounded-lg px-2.5 py-1 flex items-center justify-between">
                <span className="text-[10px] uppercase text-slate-400 font-semibold">Terceros OT</span>
                <span className="text-xs font-bold text-slate-100 tabular-nums">{formatUsd(activeOt.tercerosUsd)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 flex-1">
              <SvgDonutCard
                title="KILOS POR RUBRO"
                segments={donutsOt?.kilosPorRubro || []}
                centerLabel="KG OT"
                centerValue={formatKg(activeOt.weightKg, 0)}
                valueFormatter={(v) => formatKg(v, 1)}
                size={104}
                compact
              />
              <SvgDonutCard
                title="HORAS POR OFICIO"
                segments={donutsOt?.horasPorOficio || []}
                centerLabel="HORAS"
                centerValue={`${activeOt.physicalHours.toLocaleString('es-AR', { maximumFractionDigits: 0 })} h`}
                valueFormatter={(v) => `${v.toLocaleString('es-AR', { maximumFractionDigits: 1 })} hs`}
                size={104}
                compact
              />
              <SvgDonutCard
                title="TERCEROS OT"
                segments={donutsOt?.tercerosOt || []}
                centerLabel="TERC."
                centerValue={formatUsd(activeOt.tercerosUsd, 0)}
                valueFormatter={(v) => formatUsd(v, 0)}
                size={104}
                compact
              />
            </div>

            <div
              className="bg-slate-950/80 border border-slate-700/80 rounded-lg px-3 py-1.5 flex items-baseline gap-2"
              title={activeOt.description || 'Sin descripción de trabajos registrada en OTs.'}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
                Descripción ({activeOt.otNumber}):
              </span>
              <p className="text-[11px] text-slate-200 truncate">
                {activeOt.description || 'Sin descripción de trabajos registrada en OTs.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
