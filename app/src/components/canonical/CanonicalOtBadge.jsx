import { AlertTriangle } from 'lucide-react'
import HighlightText from '../HighlightText'
import { buildCanonicalOtBadgeData } from '../../lib/canonicalHelpers'

/**
 * CanonicalOtBadge.jsx
 * Componente Canónico Obligatorio (Candado #2 · Estándar 06 / 08_FEATURES_LOCK).
 *
 * Toda vista que muestre una Orden de Trabajo (Planillas, Canastas, Compras, Horas, Terceros)
 * debe usar este componente para garantizar la vista flotante (tooltip) completa de la OT.
 */
export default function CanonicalOtBadge({
  wo = null,
  ship = null,
  workItems = [],
  workOrders = [],
  otNumber = '',
  otTitle = '',
  tooltipOverride = '',
  searchQuery = '',
  variant = 'pill', // 'pill' | 'inline' | 'compact'
  sinOtLabel = 'Sin OT',
  className = '',
}) {
  const data = buildCanonicalOtBadgeData({
    wo,
    ship,
    workItems,
    workOrders,
    otNumber,
    otTitle,
    tooltipOverride,
  })

  if (!data.hasWo) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-amber-400 font-bold font-mono text-[10px] ${className}`}
        title={data.tooltip}
      >
        <AlertTriangle className="w-3 h-3 shrink-0" />
        <span>{sinOtLabel}</span>
      </span>
    )
  }

  if (variant === 'compact') {
    return (
      <span className={`truncate block ${className}`} title={data.tooltip}>
        <HighlightText
          text={`${data.otNumber ? `#${data.otNumber} ` : ''}${data.otTitle}`}
          query={searchQuery}
        />
      </span>
    )
  }

  if (variant === 'inline') {
    return (
      <span className={`truncate inline-flex items-center gap-1 ${className}`} title={data.tooltip}>
        {data.otNumber && (
          <span className="font-mono text-cyan-300 font-bold shrink-0">
            {String(data.otNumber).toUpperCase().startsWith('OT') ? data.otNumber : `OT #${data.otNumber}`}
          </span>
        )}
        {data.otNumber && data.otTitle && <span className="text-slate-500">·</span>}
        <span className="truncate">
          <HighlightText text={data.otTitle} query={searchQuery} />
        </span>
      </span>
    )
  }

  return (
    <div className={`truncate ${className}`} title={data.tooltip}>
      {data.otNumber && (
        <span className="font-mono text-cyan-300 font-bold bg-cyan-950/60 px-1 py-0.5 rounded border border-cyan-800/50 mr-1.5">
          OT #<HighlightText text={data.otNumber} query={searchQuery} />
        </span>
      )}
      <span className="text-slate-200 text-xs truncate">
        <HighlightText text={data.otTitle} query={searchQuery} />
      </span>
    </div>
  )
}

export { CanonicalOtBadge }
