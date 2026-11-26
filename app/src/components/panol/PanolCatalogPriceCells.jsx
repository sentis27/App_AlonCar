import { AlertTriangle } from 'lucide-react'
import { formatArs, formatUsd } from '../../lib/drydockCatalogConstants'
import CanonicalPriceHelpBadge from '../canonical/CanonicalPriceHelpBadge'

/**
 * Celdas inline de Precio AR$ y Costo US$ en Catálogo de Materiales (EXCLUSIVAS del Administrador).
 * Al acercarse al valor del precio despliega el signo (?) con la lógica de congelamiento quincenal.
 */
export function CatalogPriceArsCell({
  mat, inlineEdit, setInlineEdit, commitTextOrNum, clearEdit, pricingPolicy, dollarRate, periodKey, cellProps = null
}) {
  const isEditing = inlineEdit.id === mat.id && inlineEdit.field === 'cost_ars'
  const ars = Number(mat.cost_ars) || 0
  const usd = Number(mat.cost_usd) || 0
  const isZero = ars <= 0 && usd <= 0

  return (
    <td
      {...cellProps?.domProps}
      onDoubleClick={() => setInlineEdit({ id: mat.id, field: 'cost_ars', value: String(ars) })}
      className={`group/price py-1.5 px-1.5 text-right font-mono whitespace-nowrap cursor-pointer ${cellProps?.className || ''}`}
      title="Doble clic para cargar o editar Precio Base AR$ (recalcula US$ con % Seg. Naval y dólar vigente)"
    >
      {isEditing ? (
        <div className="inline-flex items-center justify-end gap-1">
          <input
            type="number"
            autoFocus
            min="0"
            step="any"
            value={inlineEdit.value}
            onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
            onBlur={() => commitTextOrNum(mat.id, 'cost_ars')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTextOrNum(mat.id, 'cost_ars')
              if (e.key === 'Escape') clearEdit()
            }}
            className="bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-xs font-mono text-white w-24 text-right focus:outline-none"
          />
          <CanonicalPriceHelpBadge isAdmin pricingPolicy={pricingPolicy} dollarRate={dollarRate} periodKey={periodKey} size="xs" />
        </div>
      ) : (
        <div className="inline-flex items-center justify-end gap-1">
          {isZero ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-950/75 border border-rose-500/60 text-rose-200 text-[10px] font-bold">
              <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
              <span>Sin precio</span>
            </span>
          ) : (
            <span className="text-amber-200 font-bold tabular-nums">{formatArs(ars)}</span>
          )}
          <CanonicalPriceHelpBadge
            isAdmin
            pricingPolicy={pricingPolicy}
            dollarRate={dollarRate}
            periodKey={periodKey}
            size="xs"
            className="opacity-0 group-hover/price:opacity-100 focus-within:opacity-100 transition-opacity"
          />
        </div>
      )}
    </td>
  )
}

export function CatalogPriceUsdCell({ mat, inlineEdit, setInlineEdit, commitTextOrNum, clearEdit, cellProps = null }) {
  const isEditing = inlineEdit.id === mat.id && inlineEdit.field === 'cost_usd'
  const usd = Number(mat.cost_usd) || 0

  return (
    <td
      {...cellProps?.domProps}
      onDoubleClick={() => setInlineEdit({ id: mat.id, field: 'cost_usd', value: String(usd) })}
      className={`py-1.5 px-1.5 text-right font-mono whitespace-nowrap cursor-pointer ${cellProps?.className || ''}`}
      title="Doble clic para editar Costo US$ directamente (sincroniza Precio AR$ con dólar vigente)"
    >
      {isEditing ? (
        <input
          type="number"
          autoFocus
          min="0"
          step="any"
          value={inlineEdit.value}
          onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
          onBlur={() => commitTextOrNum(mat.id, 'cost_usd')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitTextOrNum(mat.id, 'cost_usd')
            if (e.key === 'Escape') clearEdit()
          }}
          className="bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-xs font-mono text-cyan-200 w-20 text-right focus:outline-none"
        />
      ) : usd > 0 ? (
        <span className="font-bold text-cyan-300 tabular-nums">{formatUsd(usd)}</span>
      ) : (
        <span className="text-rose-400 font-bold tabular-nums">US$ 0,00</span>
      )}
    </td>
  )
}
