/**
 * canonicalHelpers.js
 * Motor puro compartido por los Componentes Canónicos (`CanonicalOtBadge` y `CanonicalMaterialPicker`).
 * Separado en `lib/` para permitir validación determinística en Vitest (entorno Node).
 */
import { normalizeText } from './allocationEngine.js'
import { formatWorkOrderTooltipCanonical } from './workOrdersConstants.js'
import { formatUnitMeasureShort } from './unitMeasureUtils.js'

/**
 * Filtra y prioriza materiales del catálogo por nombre, rubro o categoría (sin tildes ni mayúsculas).
 * Prioriza coincidencias exactas al inicio del nombre (`startsWith`) sobre coincidencias parciales.
 */
export function filterCanonicalMaterials(materials = [], rawQuery = '', limit = 60) {
  if (!Array.isArray(materials) || materials.length === 0) return []
  const q = normalizeText(rawQuery)
  if (!q) return materials.slice(0, limit)

  const startsWithList = []
  const includesList = []
  const scanCap = Math.max(limit + 20, 80)

  for (const m of materials) {
    if (!m) continue
    const nameNorm = normalizeText(m.name)
    const rubroNorm = normalizeText(m.rubro)
    const catNorm = normalizeText(m.category)
    if (nameNorm.startsWith(q)) {
      startsWithList.push(m)
    } else if (nameNorm.includes(q) || rubroNorm.includes(q) || catNorm.includes(q)) {
      includesList.push(m)
    }
    if (startsWithList.length + includesList.length >= scanCap) break
  }

  return [...startsWithList, ...includesList].slice(0, limit)
}

export function formatCanonicalOtNumberLabel(otNumber = '', { compact = false } = {}) {
  const raw = String(otNumber || '').trim()
  if (!raw) return ''
  if (/^OT\b/i.test(raw)) return raw
  if (raw.startsWith('#')) return compact ? raw : `OT ${raw}`
  return compact ? `#${raw}` : `OT #${raw}`
}

/**
 * Resuelve el texto, código y tooltip flotante obligatorio de cualquier Orden de Trabajo (OT).
 * Garantiza que nunca se renderice una OT sin su descripción enriquecida al pasar el mouse.
 */
export function buildCanonicalOtBadgeData({
  wo = null,
  ship = null,
  workItems = [],
  workOrders = [],
  otNumber = '',
  otTitle = '',
  tooltipOverride = '',
} = {}) {
  const rawNum = String(otNumber || '').trim()
  const rawTitle = String(otTitle || '').trim()
  const isPlaceholderNum = !rawNum || /^(?:sin\s*ot|sin_ot|s\/n|—|-)$/i.test(rawNum)
  const isPlaceholderTitle = !rawTitle || /^(?:sin\s*ot|sin\s*t[ií]tulo|sin\s*orden)/i.test(rawTitle)
  const hasWo = Boolean(wo || !isPlaceholderNum || !isPlaceholderTitle)
  const resolvedNumber = wo
    ? (wo.ot_number || wo.order_number || wo.id?.slice(0, 4) || '')
    : (isPlaceholderNum ? '' : rawNum)
  const resolvedTitle = wo
    ? (wo.title || wo.description || '')
    : (isPlaceholderTitle ? '' : rawTitle)

  let tooltip = tooltipOverride
  if (!tooltip) {
    if (wo) {
      tooltip = formatWorkOrderTooltipCanonical(wo, ship, workItems, workOrders)
    } else if (hasWo) {
      const shipLabel = ship?.name ? `\nBuque / Destino: ${ship.name}` : ''
      const numLabel = resolvedNumber ? `${formatCanonicalOtNumberLabel(resolvedNumber)}: ` : ''
      tooltip = `${numLabel}${resolvedTitle}${shipLabel}`.trim()
    } else {
      tooltip = '(⚠️ Sin OT asignada)'
    }
  }

  return {
    hasWo,
    otNumber: resolvedNumber,
    otTitle: resolvedTitle,
    tooltip,
  }
}

/**
 * Formatea el estado de stock de un material con semáforo canónico para grillas y selectores.
 */
export function formatCanonicalMaterialStock(material) {
  if (!material) {
    return { label: '—', tone: 'muted', isCritical: false, requiresStockControl: false }
  }
  const unitShort = formatUnitMeasureShort(material.unit_measure)
  if (!material.requires_stock_control) {
    return { label: 'S/C', tone: 'muted', isCritical: false, requiresStockControl: false, unitShort }
  }
  const current = Number(material.current_stock) || 0
  const minimum = Number(material.minimum_stock) || 0
  const isCritical = current <= minimum
  return {
    label: `${current} ${unitShort}`,
    tone: isCritical ? 'critical' : 'ok',
    isCritical,
    requiresStockControl: true,
    unitShort,
  }
}
