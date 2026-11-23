/**
 * tercerosRemitoMatcher.js
 * Motor puro de cruce entre `Nº Remito AlonCar` de Terceros (`internal_remito_number`)
 * y retiros de Pañol (`inventory_transactions.voucher_number`), con detección de
 * incongruencia de Orden de Trabajo (OT Pañol vs OT Terceros).
 */

import { formatCanonicalOtNumberLabel } from './canonicalHelpers.js'
import { formatUnitMeasureShort } from './unitMeasureUtils.js'

const KG_UNIT_REGEX = /^(kg|kgs|kilo|kilos|kilogramo|kilogramos)$/i

export function normalizeRemitoNumber(raw) {
  if (raw === null || raw === undefined) return ''
  const cleaned = String(raw).trim().replace(/^#+/, '').trim().toUpperCase()
  if (!cleaned) return ''
  if (/^\d+$/.test(cleaned)) {
    return cleaned.replace(/^0+/, '') || '0'
  }
  return cleaned
}

export function formatWorkOrderShortLabel(wo) {
  if (!wo) return 'Sin OT'
  const num = wo.ot_number ? formatCanonicalOtNumberLabel(wo.ot_number) : ''
  const title = (wo.title || '').trim()
  if (num && title) return `${num} · ${title}`
  return num || title || 'Sin OT'
}

export function formatQuantityDisplay(qty) {
  const num = Number(qty)
  if (!Number.isFinite(num)) return '0'
  return num.toLocaleString('es-AR', { maximumFractionDigits: 3 })
}

export function formatKgDisplay(kg) {
  const num = Number(kg)
  if (!Number.isFinite(num) || num <= 0) return ''
  return `${num.toLocaleString('es-AR', { maximumFractionDigits: 2 })} kg`
}

export function buildPanolRemitoIndex(panolRemitoTx = [], materials = [], workOrders = [], ships = []) {
  const matMap = new Map((materials || []).map((m) => [m.id, m]))
  const woMap = new Map((workOrders || []).map((w) => [w.id, w]))
  const shipMap = new Map((ships || []).map((s) => [s.id, s]))
  const index = new Map()

  for (const tx of panolRemitoTx || []) {
    if (!tx || tx.is_deletion_requested) continue
    const key = normalizeRemitoNumber(tx.voucher_number)
    if (!key) continue

    const mat = matMap.get(tx.material_id) || null
    const wo = tx.work_order_id ? woMap.get(tx.work_order_id) || null : null
    const ship = tx.ship_id ? shipMap.get(tx.ship_id) || null : null
    const qty = Number(tx.quantity_withdrawn) || 0
    const rawUnit = mat?.unit_measure || 'un.'
    const shortUnit = formatUnitMeasureShort(rawUnit) || rawUnit
    const isUnitKg = KG_UNIT_REGEX.test(String(rawUnit).trim())
    const explicitWeight = Number(tx.weight_total) || 0
    const derivedWeight = (Number(mat?.weight_kg) || 0) * qty
    const weightKg = explicitWeight > 0 ? explicitWeight : derivedWeight

    const entry = {
      id: tx.id,
      voucherNumber: String(tx.voucher_number || '').trim(),
      materialId: tx.material_id || null,
      materialName: mat?.name || 'Material sin asignar',
      quantity: qty,
      quantityLabel: `${formatQuantityDisplay(qty)} ${shortUnit}`,
      unitMeasure: shortUnit,
      isUnitKg,
      weightKg,
      weightLabel: !isUnitKg && weightKg > 0 ? formatKgDisplay(weightKg) : '',
      workOrderId: tx.work_order_id || null,
      workOrderLabel: formatWorkOrderShortLabel(wo),
      shipId: tx.ship_id || null,
      shipName: ship?.name || 'Sin Buque',
      contractorName: String(tx.worker_name || tx.contractor_name || '').trim(),
      transactionDate: tx.transaction_date || null,
    }

    if (!index.has(key)) index.set(key, [])
    index.get(key).push(entry)
  }

  return index
}

export function evaluateRemitoMatch({
  remitoNumber,
  tercerosWorkOrderId = null,
  remitoIndex = null,
  otMap = null,
} = {}) {
  const normalizedKey = normalizeRemitoNumber(remitoNumber)
  if (!normalizedKey) {
    return {
      hasRemito: false,
      normalizedKey: '',
      items: [],
      hasMatches: false,
      panolWorkOrders: [],
      panolContractorSummary: '',
      tercerosWorkOrderLabel: 'Sin OT',
      hasOtMismatch: false,
      mismatchMessage: '',
    }
  }

  const items = remitoIndex instanceof Map ? (remitoIndex.get(normalizedKey) || []) : []
  const tercerosWo = tercerosWorkOrderId && otMap instanceof Map ? otMap.get(tercerosWorkOrderId) || null : null
  const tercerosWorkOrderLabel = formatWorkOrderShortLabel(tercerosWo)

  const uniqueWoMap = new Map()
  const uniqueContractors = new Set()
  for (const item of items) {
    const k = String(item.workOrderId || '__SIN_OT__')
    if (!uniqueWoMap.has(k)) {
      uniqueWoMap.set(k, { id: item.workOrderId || null, label: item.workOrderLabel })
    }
    if (item.contractorName) uniqueContractors.add(item.contractorName)
  }
  const panolWorkOrders = Array.from(uniqueWoMap.values())
  const panolContractorSummary = Array.from(uniqueContractors).join(', ')

  const normTercerosWo = String(tercerosWorkOrderId || '')
  const mismatchedItems = items.filter((item) => String(item.workOrderId || '') !== normTercerosWo)
  const hasOtMismatch = items.length > 0 && mismatchedItems.length > 0

  const panolOtSummary = panolWorkOrders.map((w) => w.label).join(' / ')
  const mismatchMessage = hasOtMismatch
    ? `No hay congruencia entre la OT de Pañol (${panolOtSummary}) y la OT de Terceros (${tercerosWorkOrderLabel}).`
    : ''

  return {
    hasRemito: true,
    normalizedKey,
    items,
    hasMatches: items.length > 0,
    panolWorkOrders,
    panolContractorSummary,
    tercerosWorkOrderLabel,
    hasOtMismatch,
    mismatchMessage,
  }
}
