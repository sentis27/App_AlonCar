import { ChevronDown } from 'lucide-react'
import { DEFAULT_PROGRESSIVE_BATCH } from '../../lib/gridPerformanceHelpers'

/**
 * CanonicalProgressiveTableFooter
 * Pie visual único (Capa 3 · SKL-019 · FL-025) para todas las grillas y listas progresivas del ERP.
 * - Soporta modo tabla (`<tr><td colSpan={...}>`) y modo bloque (`asDiv={true}` para vistas de fichas/tarjetas).
 * - El buscador, KPIs, filtros y exportación operan siempre sobre el 100% de `totalCount`.
 */
export default function CanonicalProgressiveTableFooter({
  visibleCount = 0,
  totalCount = 0,
  hasMore = false,
  remainingCount = 0,
  loadMore,
  showAll,
  sentinelRef = null,
  colSpan = 10,
  batchSize = DEFAULT_PROGRESSIVE_BATCH,
  entityLabel = 'registros',
  asDiv = false,
  className = '',
}) {
  if (!hasMore) return null

  const nextBatch = Math.min(batchSize, Math.max(0, remainingCount || totalCount - visibleCount))

  const content = (
    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
      <span>
        Mostrando <strong className="text-cyan-300 font-mono">{visibleCount}</strong> de{' '}
        <strong className="text-white font-mono">{totalCount}</strong> {entityLabel} (el buscador, los filtros y la exportación trabajan sobre los {totalCount})
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={loadMore}
          className="px-3 py-1 rounded-lg bg-cyan-950/90 hover:bg-cyan-900 text-cyan-300 border border-cyan-600/60 font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
        >
          <ChevronDown className="w-3.5 h-3.5" />
          <span>Cargar +{nextBatch}</span>
        </button>
        <button
          type="button"
          onClick={showAll}
          className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold cursor-pointer transition-colors"
        >
          Mostrar todos ({totalCount})
        </button>
      </div>
    </div>
  )

  if (asDiv) {
    return (
      <div
        ref={sentinelRef}
        className={`mt-3 rounded-xl bg-slate-900/75 border border-slate-800 px-4 py-3 ${className}`.trim()}
      >
        {content}
      </div>
    )
  }

  return (
    <tr ref={sentinelRef} className={`bg-slate-900/70 ${className}`.trim()}>
      <td colSpan={colSpan} className="py-3 px-4">
        {content}
      </td>
    </tr>
  )
}
