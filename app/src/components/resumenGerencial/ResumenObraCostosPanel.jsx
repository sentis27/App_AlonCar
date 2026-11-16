import React from 'react'
import { Package, Clock, Wrench, ArrowUpRight, DollarSign, Anchor, Layers } from 'lucide-react'
import { COST_SHEET_QUICK_LINKS } from '../../lib/drydockCatalogConstants'
import ResumenShipCostStrip from './ResumenShipCostStrip'
import ResumenOtDetailStrip from './ResumenOtDetailStrip'
import ResumenCostosMobileView from './ResumenCostosMobileView'

/**
 * Vista 1 del Submódulo 1 (100% Solo Lectura · Zero-Scroll Desktop).
 * - Zona 2 diferenciada cromáticamente en 2 submenús:
 *   · Submenú Cian: COSTOS GENERALES DEL BUQUE
 *   · Submenú Violeta: COSTOS POR ORDEN DE TRABAJO (O.T.)
 * - Cero campos editables en esta vista: todo cálculo (incluido Grúa G., Grúa Ch. y Pala) proviene de Supabase.
 */
export default function ResumenObraCostosPanel({
  summary,
  dollarRate = 1500,
  onOpenCostSheet
}) {
  const {
    ship,
    totals,
    activeOt,
    donutsShip,
    donutsOt,
    craneHours = {},
    zeroCostAlerts
  } = summary || {}

  if (!ship || !totals) {
    return (
      <div className="bg-slate-900/60 border border-slate-700/70 rounded-xl p-8 text-center text-slate-400">
        Seleccioná un buque para visualizar el Resumen Ejecutivo GS-004.
      </div>
    )
  }

  const generalLinks = COST_SHEET_QUICK_LINKS.filter((l) => l.row === 1)
  const otLinks = COST_SHEET_QUICK_LINKS.filter((l) => l.row === 2)

  const iconForSheet = (sheet) => {
    if (sheet === 'materiales') return Package
    if (sheet === 'horas') return Clock
    return Wrench
  }

  return (
    <div className="flex flex-col gap-2.5 md:flex-1 md:min-h-0">
      {/* ZONA 2 COMPACTA (Desktop): Dólar Ref solo lectura + 2 Submenús diferenciados por color (General Cian vs O.T. Violeta) */}
      <div className="hidden md:flex bg-slate-900/75 border border-slate-700/80 rounded-xl px-2.5 py-2 flex-row items-center justify-between gap-2.5 shrink-0">
        {/* Indicador visual solo lectura del dólar de referencia */}
        <div
          className="bg-slate-950/90 border border-emerald-500/35 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 shrink-0 select-none"
          title="Tipo de cambio de referencia vigente (solo lectura desde Macro Variables / Tarifarios)"
        >
          <DollarSign className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block leading-none">
              Dólar Ref.
            </span>
            <span className="text-xs font-extrabold text-emerald-300 tabular-nums">
              ${Number(dollarRate || 1500).toLocaleString('es-AR')}
            </span>
          </div>
        </div>

        {/* Dos submenús visualmente separados por paleta Cian vs Violeta */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 flex-1">
          {/* Submenú 1: COSTOS GENERALES (CIAN) */}
          <div className="bg-cyan-950/30 border border-cyan-500/45 rounded-lg px-2 py-1.5 flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-[9.5px] font-black uppercase tracking-wider text-cyan-300">
                <Anchor className="w-3 h-3" />
                Submenú Costos Generales · Buque completo
              </span>
              <span className="text-[9px] font-semibold text-cyan-200/75 truncate max-w-[140px]">
                {ship.name}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {generalLinks.map((link) => {
                const Icon = iconForSheet(link.sheet)
                return (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => onOpenCostSheet(link.sheet, 'GENERAL')}
                    className="flex items-center justify-between gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide bg-cyan-950/75 hover:bg-cyan-500/25 text-cyan-100 border border-cyan-500/40 hover:border-cyan-300 transition-colors cursor-pointer"
                    title={`Abrir ${link.hint} del buque completo (General)`}
                  >
                    <span className="flex items-center gap-1 truncate">
                      <Icon className="w-3 h-3 text-cyan-300 shrink-0" />
                      <span className="truncate">{link.label.replace(' GENERALES', '').replace(' GENERAL', '')}</span>
                    </span>
                    <ArrowUpRight className="w-3 h-3 text-cyan-300 shrink-0" />
                  </button>
                )
              })}
            </div>
          </div>

          {/* Submenú 2: COSTOS POR O.T. (VIOLETA) */}
          <div className="bg-violet-950/30 border border-violet-500/45 rounded-lg px-2 py-1.5 flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-[9.5px] font-black uppercase tracking-wider text-violet-300">
                <Layers className="w-3 h-3" />
                Submenú Costos por O.T.
              </span>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-violet-500/20 border border-violet-400/40 text-violet-200 truncate max-w-[140px]">
                {activeOt?.otNumber || 'Sin OT'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {otLinks.map((link) => {
                const Icon = iconForSheet(link.sheet)
                return (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => onOpenCostSheet(link.sheet, 'OT')}
                    className="flex items-center justify-between gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide bg-violet-950/75 hover:bg-violet-500/25 text-violet-100 border border-violet-500/40 hover:border-violet-300 transition-colors cursor-pointer"
                    title={`Abrir ${link.hint} filtrada a ${activeOt?.otNumber || 'OT activa'}`}
                  >
                    <span className="flex items-center gap-1 truncate">
                      <Icon className="w-3 h-3 text-violet-300 shrink-0" />
                      <span className="truncate">{link.label.replace(' POR O.T', '')}</span>
                    </span>
                    <ArrowUpRight className="w-3 h-3 text-violet-300 shrink-0" />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* VISTA DESKTOP ZERO-SCROLL (`md+`): 100% Solo Lectura Visual */}
      <div className="hidden md:flex flex-col gap-2.5 flex-1 min-h-0">
        <ResumenShipCostStrip
          ship={ship}
          totals={totals}
          craneHours={craneHours}
          donutsShip={donutsShip}
          zeroCostAlerts={zeroCostAlerts}
          onOpenCostSheet={onOpenCostSheet}
        />

        <ResumenOtDetailStrip
          activeOt={activeOt}
          craneHours={craneHours}
          donutsOt={donutsOt}
        />
      </div>

      {/* VISTA MÓVIL ÁGIL (`< md`): Costo Directo Total + Detalle OT */}
      <ResumenCostosMobileView
        ship={ship}
        totals={totals}
        activeOt={activeOt}
        craneHours={craneHours}
        zeroCostAlerts={zeroCostAlerts}
      />
    </div>
  )
}
