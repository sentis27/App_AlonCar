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
  const hasWo = Boolean(wo || otNumber || otTitle)
  const resolvedNumber = wo
    ? (wo.ot_number || wo.order_number || wo.id?.slice(0, 4) || '')
    : (otNumber || '')
  const resolvedTitle = wo
    ? (wo.title || wo.description || '')
    : (otTitle || '')

  let tooltip = tooltipOverride
  if (!tooltip) {
    if (wo) {
      tooltip = formatWorkOrderTooltipCanonical(wo, ship, workItems, workOrders)
    } else if (hasWo) {
      const shipLabel = ship?.name ? `\nBuque / Destino: ${ship.name}` : ''
      tooltip = `OT ${resolvedNumber ? `#${resolvedNumber}: ` : ''}${resolvedTitle}${shipLabel}`.trim()
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
