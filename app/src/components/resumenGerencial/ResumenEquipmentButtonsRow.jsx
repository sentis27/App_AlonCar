import React, { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import CostCategoryHoverCard from './CostCategoryHoverCard'

function formatHrs(val) {
  return `${(Number(val) || 0).toLocaleString('es-AR', { maximumFractionDigits: 1 })} hs`
}

/**
 * Fila compartida de botones de Maquinaria (`GRÚA G.`, `GRÚA CH.`, `HRS. PALA`) para Costos Generales y OT:
 * - GRÚA G. / GRÚA CH.: hover con detalle línea por línea (cantidad + comentario) y clic abre Horas filtrada.
 * - HRS. PALA: muestra total de horas y clic lleva al filtro directo en la hoja de Horas (sin hover).
 */
export default function ResumenEquipmentButtonsRow({
  scope = 'GENERAL',
  contextLabel = '',
  gruaGrandeHrs = 0,
  gruaChicaHrs = 0,
  hrsPala = 0,
  hoverGruaGrande = null,
  hoverGruaChica = null,
  onOpenCostSheet
}) {
  const [hoveredKey, setHoveredKey] = useState(null)
  const isOt = scope === 'OT'

  const buttons = [
    {
      key: 'GRUA_GRANDE',
      label: 'GRÚA G.',
      value: gruaGrandeHrs,
      hasHover: true,
      hoverTitle: `Grúa Grande — ${contextLabel || (isOt ? 'O.T' : 'Buque')}`,
      hoverData: hoverGruaGrande
    },
    {
      key: 'GRUA_CHICA',
      label: 'GRÚA CH.',
      value: gruaChicaHrs,
      hasHover: true,
      hoverTitle: `Grúa Chica — ${contextLabel || (isOt ? 'O.T' : 'Buque')}`,
      hoverData: hoverGruaChica
    },
    {
      key: 'PALA',
      label: 'HRS. PALA',
      value: hrsPala,
      hasHover: false
    }
  ]

  return (
    <div
      className={`px-3 py-1.5 grid grid-cols-3 gap-1.5 ${isOt ? 'bg-violet-950/20' : 'bg-cyan-950/20'}`}
      title="Clic para abrir Planilla de Horas filtrada por maquinaria"
    >
      {buttons.map((btn) => {
        const isHovered = hoveredKey === btn.key
        return (
          <div
            key={btn.key}
            className={`relative ${isHovered ? 'z-40' : ''}`}
            onMouseEnter={() => btn.hasHover && setHoveredKey(btn.key)}
            onMouseLeave={() => btn.hasHover && setHoveredKey((prev) => (prev === btn.key ? null : prev))}
          >
            <button
              type="button"
              onClick={() => onOpenCostSheet?.('horas', scope, btn.key)}
              className={`group w-full bg-slate-900/80 border border-slate-800 rounded px-2 py-1 flex flex-col text-left transition-colors cursor-pointer ${
                isOt
                  ? 'hover:bg-violet-500/20 hover:border-violet-400/50'
                  : 'hover:bg-cyan-500/20 hover:border-cyan-400/50'
              } ${isHovered ? (isOt ? 'ring-1 ring-violet-400/70' : 'ring-1 ring-cyan-400/70') : ''}`}
            >
              <span
                className={`text-[10px] font-bold truncate flex items-center justify-between gap-0.5 ${
                  isOt ? 'text-amber-200/85' : 'text-slate-400 group-hover:text-cyan-200'
                }`}
              >
                <span className="truncate">{btn.label}</span>
                <ArrowUpRight className="w-3 h-3 opacity-50 group-hover:opacity-100 shrink-0" />
              </span>
              <span
                className={`text-xs font-extrabold tabular-nums ${
                  isOt ? 'text-amber-200' : 'text-cyan-200'
                }`}
              >
                {formatHrs(btn.value)}
              </span>
            </button>

            {btn.hasHover && isHovered && (
              <div className="hidden md:block absolute left-full bottom-0 pl-2 z-50 w-[min(460px,50vw)]">
                <CostCategoryHoverCard
                  mode="EQUIPO"
                  scope={scope}
                  title={btn.hoverTitle}
                  subtitle="Cada línea cargada · cantidad y observaciones"
                  summaryData={btn.hoverData}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
