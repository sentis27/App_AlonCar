import { AlertTriangle, Lock } from 'lucide-react'
import { resolvePanolTxCost } from '../../lib/panolCostHelpers'
import { formatUnitMeasureShort } from '../../lib/unitMeasureUtils'
import { formatUsd, formatArs } from '../../lib/drydockCatalogConstants'

/**
 * Celda compacta de Costo US$ en Planilla de Retiros (exclusiva del Administrador).
 * Muestra Total US$ + unitario debajo, con tooltip AR$/US$ y acceso rápido cuando el valor es $0.
 */
export default function PanolMovimientoCostCell({
  tx,
  mat,
  macroVariables = [],
  pricingPolicy = null,
  cp,
  isDeletionReq = false,
  onOpenEditMaterial = null,
  fillHandleNode = null
}) {
  if (!tx?.material_id) {
    return (
      <td
        {...cp.domProps}
        className={`py-1 px-1 text-right font-mono text-slate-600 whitespace-nowrap ${cp.className}`}
        title="Sin material asignado"
      >
        —
        {fillHandleNode}
      </td>
    )
  }

  const cost = resolvePanolTxCost(tx, mat, { macroVariables, policy: pricingPolicy })
  const unitShort = formatUnitMeasureShort(mat?.unit_measure || 'un.')
  const sourceText =
    cost.source === 'SNAPSHOT'
      ? `Precio congelado (${cost.periodKey || 'quincena'})`
      : cost.source === 'CATALOG'
      ? `Catálogo vigente (${cost.periodKey || 'quincena'})`
      : 'Sin precio cargado en Catálogo'

  const tooltip = cost.isZeroCost
    ? `${mat?.name || 'Material'} sin valor ($0) · Doble clic para cargar precio en Catálogo`
    : `Total: ${formatUsd(cost.totalUsd)} (${formatArs(cost.totalArs)}) · Unitario: ${formatUsd(cost.unitUsd)} / ${unitShort} · ${sourceText}`

  return (
    <td
      {...cp.domProps}
      onDoubleClick={() => {
        if (mat && onOpenEditMaterial) onOpenEditMaterial(mat)
      }}
      className={`py-1 px-1 text-right font-mono whitespace-nowrap ${mat && onOpenEditMaterial ? 'cursor-pointer' : ''} ${cp.className} ${isDeletionReq ? 'line-through opacity-75' : ''}`}
      title={tooltip}
    >
      {cost.isZeroCost ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (mat && onOpenEditMaterial) onOpenEditMaterial(mat)
          }}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-500/60 text-rose-200 text-[10px] font-bold cursor-pointer transition-colors"
          title="Material sin valor ($0) · Clic para cargar precio en Catálogo"
        >
          <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
          <span>Sin valor</span>
        </button>
      ) : (
        <div className="flex flex-col items-end leading-tight">
          <span className="font-bold text-emerald-300 tabular-nums">{formatUsd(cost.totalUsd)}</span>
          <span className="text-[9.5px] text-slate-400 inline-flex items-center gap-0.5 tabular-nums">
            {cost.source === 'SNAPSHOT' && <Lock className="w-2.5 h-2.5 text-cyan-400/80 shrink-0" />}
            <span>{formatUsd(cost.unitUsd)}/{unitShort}</span>
          </span>
        </div>
      )}
      {fillHandleNode}
    </td>
  )
}
