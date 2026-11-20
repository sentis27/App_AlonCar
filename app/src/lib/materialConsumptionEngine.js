/**
 * materialConsumptionEngine.js
 * Motor analítico puro para el Asistente Inteligente de Consumo (Últimos 6 Meses por Material).
 * Arquetipo: METRICAS_ANALISIS (Gallina).
 */
import { normalizeText } from './allocationEngine.js'
import { formatUnitMeasureShort, normalizeUnitMeasure } from './comprasConstants.js'
import { inventoryTransactionsRepository } from '../repositories/inventoryTransactionsRepository.js'

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export function getSixMonthsWindowStart(referenceDate = new Date()) {
  return new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 5, 1, 0, 0, 0, 0)
}

export async function fetchMaterial6MonthTransactionsService(materialId, referenceDate = new Date()) {
  if (!materialId) return []
  const startIso = getSixMonthsWindowStart(referenceDate).toISOString()
  const { data, error } = await inventoryTransactionsRepository.listTransactions({
    filters: { material_id: materialId },
    gteFilters: { transaction_date: startIso },
    orderBy: [{ column: 'transaction_date', ascending: false }],
    limit: 1000
  })
  if (error) throw new Error(error)
  return data || []
}

export function computeMaterial6MonthConsumption({
  material,
  transactions = [],
  workOrders = [],
  ships = [],
  referenceDate = new Date()
}) {
  const woMap = new Map((workOrders || []).map((w) => [String(w.id), w]))
  const shipMap = new Map((ships || []).map((s) => [String(s.id), s]))
  const buckets = []
  const bucketByKey = new Map()

  for (let offset = 5; offset >= 0; offset -= 1) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - offset, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const bucket = {
      key,
      year: d.getFullYear(),
      monthIndex: d.getMonth(),
      monthLabel: MONTH_NAMES_ES[d.getMonth()],
      quantity: 0,
      withdrawalsCount: 0,
      workOrdersMap: new Map()
    }
    buckets.push(bucket)
    bucketByKey.set(key, bucket)
  }

  for (const tx of transactions || []) {
    if (!tx || String(tx.material_id) !== String(material?.id)) continue
    if (tx.is_deletion_requested) continue
    const qty = Number(tx.quantity_withdrawn) || 0
    if (qty <= 0 || !tx.transaction_date) continue

    const datePart = String(tx.transaction_date).split('T')[0]
    const [yrStr, moStr] = datePart.split('-')
    const key = yrStr && moStr ? `${yrStr}-${moStr.padStart(2, '0')}` : ''
    const bucket = bucketByKey.get(key)
    if (!bucket) continue

    bucket.quantity += qty
    bucket.withdrawalsCount += 1

    const wo = tx.work_order_id ? woMap.get(String(tx.work_order_id)) : null
    const ship = shipMap.get(String(tx.ship_id || wo?.ship_id || ''))
    const rawLabel = String(wo?.title || wo?.description || '').trim() || 'Sin OT asignada'
    const dedupKey = normalizeText(rawLabel) || 'sin_ot'
    const existing = bucket.workOrdersMap.get(dedupKey)
    if (existing) {
      existing.withdrawalsCount += 1
      existing.quantity += qty
      if (ship?.name) existing.ships.add(ship.name)
      if (wo?.ot_number) existing.otNumbers.add(wo.ot_number)
    } else {
      bucket.workOrdersMap.set(dedupKey, {
        key: dedupKey,
        label: rawLabel,
        withdrawalsCount: 1,
        quantity: qty,
        ships: new Set(ship?.name ? [ship.name] : []),
        otNumbers: new Set(wo?.ot_number ? [wo.ot_number] : [])
      })
    }
  }

  const months = buckets.map((b) => ({
    key: b.key,
    year: b.year,
    monthLabel: b.monthLabel,
    quantity: Math.round(b.quantity * 100) / 100,
    withdrawalsCount: b.withdrawalsCount,
    uniqueWorkOrders: Array.from(b.workOrdersMap.values()).map((entry) => ({
      key: entry.key,
      label: entry.label,
      withdrawalsCount: entry.withdrawalsCount,
      quantity: Math.round(entry.quantity * 100) / 100,
      ships: Array.from(entry.ships),
      otNumbers: Array.from(entry.otNumbers)
    }))
  }))

  const grandTotal = Math.round(months.reduce((acc, m) => acc + m.quantity, 0) * 100) / 100
  const totalWithdrawals = months.reduce((acc, m) => acc + m.withdrawalsCount, 0)
  return {
    unitShort: formatUnitMeasureShort(material?.unit_measure),
    unitCanonical: normalizeUnitMeasure(material?.unit_measure, material?.name),
    months,
    grandTotal,
    monthlyAverage: Math.round((grandTotal / 6) * 100) / 100,
    totalWithdrawals
  }
}
