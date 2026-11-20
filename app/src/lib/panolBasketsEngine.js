/**
 * panolBasketsEngine.js
 * Motor puro de Canastas de Costos para Pañol (M4).
 * Construye canastitas automáticas desde OTs activas, canasta única Sin OT por barco,
 * contratistas activos de Personal y Tarifas, hora real local (HH:mm) y corte diario.
 */
import { normalizeText } from './allocationEngine.js'
import { getStoredCellFormula } from './formulaEngine.js'
import { deduplicateWorkOrdersWithScope, formatWorkOrderTooltipCanonical } from './workOrdersConstants.js'

export const BASKET_SHIP_THEMES = [
  { border: 'border-cyan-500/50', bg: 'bg-cyan-950/25', title: 'text-cyan-300', dot: 'bg-cyan-400' },
  { border: 'border-amber-500/50', bg: 'bg-amber-950/25', title: 'text-amber-300', dot: 'bg-amber-400' },
  { border: 'border-sky-500/50', bg: 'bg-sky-950/25', title: 'text-sky-300', dot: 'bg-sky-400' },
  { border: 'border-purple-500/50', bg: 'bg-purple-950/25', title: 'text-purple-300', dot: 'bg-purple-400' },
  { border: 'border-emerald-500/50', bg: 'bg-emerald-950/25', title: 'text-emerald-300', dot: 'bg-emerald-400' }
]

export function getLocalDateKey(input = new Date()) {
  if (!input) return ''
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) return input.trim()
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatLocalTimeHHMM(input) {
  if (!input || (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.trim()))) return ''
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function buildTransactionTimestampIso(dateStr, timeStr = null) {
  if (!dateStr) return new Date().toISOString()
  const cleanDate = String(dateStr).trim().split('T')[0]
  const match = cleanDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return new Date().toISOString()
  const [, y, m, d] = match.map(Number)
  if (timeStr && /^\d{1,2}:\d{2}$/.test(String(timeStr).trim())) {
    const [hh, mm] = String(timeStr).trim().split(':').map(Number)
    return new Date(y, m - 1, d, hh, mm, 0).toISOString()
  }
  if (cleanDate === getLocalDateKey(new Date())) return new Date().toISOString()
  return new Date(y, m - 1, d, 12, 0, 0).toISOString()
}

export function makeBasketKey(contractorName, shipId, workOrderId = null) {
  return `${normalizeText(contractorName)}::${shipId || 'NO_SHIP'}::${workOrderId || 'SIN_OT'}`
}

export function getActiveContractorsFromRoster(workers = []) {
  const map = new Map()
  for (const w of workers || []) {
    if (normalizeText(w.admin_center) !== 'CONTRATISTA') continue
    if (normalizeText(w.status || 'ACTIVO') !== 'ACTIVO') continue
    const display = String(w.work_group || w.name || '').trim().toUpperCase()
    const key = normalizeText(display)
    if (!key) continue
    const prev = map.get(key)
    if (!prev) {
      map.set(key, { key, name: display, membersCount: 1, canWithdraw: w.can_withdraw_materials !== false })
    } else {
      prev.membersCount += 1
      if (w.can_withdraw_materials !== false) prev.canWithdraw = true
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

function extractWoContractors(wo) {
  const items = (wo?._allWorkItems || []).filter((wi) => wi.status !== 'Desestimado')
  const fromItems = items.flatMap((wi) => (Array.isArray(wi.contractors) ? wi.contractors : wi.contractor_name ? [wi.contractor_name] : []))
  const fromMaster = Array.isArray(wo?.contractors) ? wo.contractors : wo?.contractors ? [wo.contractors] : []
  return new Set([...fromItems, ...fromMaster].map((c) => normalizeText(c)).filter(Boolean))
}

function toBasketItem(tx, materialMap) {
  const mat = materialMap.get(tx.material_id)
  return {
    id: tx.id,
    dateKey: getLocalDateKey(tx.transaction_date),
    timeLabel: formatLocalTimeHHMM(tx.transaction_date) || '—',
    materialName: mat?.name || 'Material sin catálogo',
    unitMeasure: mat?.unit_measure || 'un.',
    quantity: Number(tx.quantity_withdrawn) || 0,
    qtyFormula: getStoredCellFormula(tx, 'quantity_withdrawn'),
    costCenter: tx.cost_center || 'CLIENTE',
    notes: tx.notes || '',
    transactionDate: tx.transaction_date || ''
  }
}

export function buildContractorCostBaskets({
  workers = [], ships = [], workOrders = [], workItems = [], inventoryTx = [], materials = [],
  targetDate = new Date(), manualBlankBaskets = []
} = {}) {
  const todayKey = getLocalDateKey(targetDate)
  const activeContractors = getActiveContractorsFromRoster(workers)
  const shipMap = new Map((ships || []).map((s) => [s.id, s]))
  const materialMap = new Map((materials || []).map((m) => [m.id, m]))
  const allWoById = new Map((workOrders || []).map((w) => [w.id, w]))
  const activeWos = deduplicateWorkOrdersWithScope(workOrders, workItems).filter((wo) => wo.isActiveForImputation !== false)
  const woIdToMaster = new Map()
  for (const wo of activeWos) {
    woIdToMaster.set(wo.id, wo)
    for (const id of wo._allWoIds || []) woIdToMaster.set(id, wo)
  }

  const cardByKey = new Map(
    activeContractors.map((c) => [c.key, { ...c, basketsMap: new Map(), todayCount: 0, previousCount: 0 }])
  )
  const ensureBasket = (card, shipId, wo, isSinOt) => {
    const woId = isSinOt ? null : wo?.id || null
    const bKey = makeBasketKey(card.name, shipId, woId)
    if (!card.basketsMap.has(bKey)) {
      const ship = shipMap.get(shipId)
      const otTooltip = isSinOt
        ? 'Canasta única para retiros sin OT en este barco'
        : formatWorkOrderTooltipCanonical(wo, ship, workItems, workOrders)
      card.basketsMap.set(bKey, {
        key: bKey, contractorKey: card.key, contractorName: card.name, shipId: shipId || null,
        shipName: ship?.name || 'Sin Barco', workOrderId: woId, isSinOt: Boolean(isSinOt),
        otNumber: isSinOt ? null : wo?.ot_number || null,
        otTitle: isSinOt ? 'Orden en Blanco (Sin OT)' : (wo?.title || wo?.description || wo?.scopeSummary || 'OT Activa'),
        otTooltip,
        todayItems: [], previousItems: []
      })
    }
    return card.basketsMap.get(bKey)
  }

  for (const wo of activeWos) {
    if (!wo.ship_id) continue
    const assigned = extractWoContractors(wo)
    for (const cKey of assigned) {
      const card = cardByKey.get(cKey)
      if (card) ensureBasket(card, wo.ship_id, wo, false)
    }
  }
  for (const mb of manualBlankBaskets || []) {
    const card = cardByKey.get(normalizeText(mb.contractorName))
    if (card && mb.shipId) ensureBasket(card, mb.shipId, null, true)
  }

  for (const tx of inventoryTx || []) {
    if (tx.is_deletion_requested || !tx.ship_id) continue
    const card = cardByKey.get(normalizeText(tx.contractor_name || tx.worker_name))
    if (!card) continue
    const txDateKey = getLocalDateKey(tx.transaction_date)
    const isToday = txDateKey === todayKey
    const masterWo = tx.work_order_id ? woIdToMaster.get(tx.work_order_id) : null
    if (tx.work_order_id && !masterWo && !isToday) continue
    const resolvedWo = masterWo || (tx.work_order_id ? allWoById.get(tx.work_order_id) : null) || { id: tx.work_order_id, ot_number: 'OT', title: 'OT registrada hoy' }
    const basket = tx.work_order_id
      ? ensureBasket(card, tx.ship_id, resolvedWo, false)
      : ensureBasket(card, tx.ship_id, null, true)
    const item = toBasketItem(tx, materialMap)
    if (isToday) { basket.todayItems.push(item); card.todayCount += 1 }
    else { basket.previousItems.push(item); card.previousCount += 1 }
  }

  const cards = Array.from(cardByKey.values()).map((card) => {
    const byShip = new Map()
    for (const b of card.basketsMap.values()) {
      b.todayItems.sort((a, z) => String(z.transactionDate).localeCompare(String(a.transactionDate)))
      b.previousItems.sort((a, z) => String(z.transactionDate).localeCompare(String(a.transactionDate)))
      b.lastTodayTime = b.todayItems[0]?.timeLabel || ''
      if (!byShip.has(b.shipId)) byShip.set(b.shipId, { shipId: b.shipId, shipName: b.shipName, baskets: [] })
      byShip.get(b.shipId).baskets.push(b)
    }
    const shipGroups = Array.from(byShip.values())
      .sort((a, b) => a.shipName.localeCompare(b.shipName, 'es'))
      .map((g, idx) => ({
        ...g,
        theme: BASKET_SHIP_THEMES[idx % BASKET_SHIP_THEMES.length],
        baskets: g.baskets.sort((a, b) => (a.isSinOt !== b.isSinOt ? (a.isSinOt ? 1 : -1) : String(a.otNumber || '').localeCompare(String(b.otNumber || ''), 'es', { numeric: true })))
      }))
    const basketsCount = card.basketsMap.size
    return { key: card.key, name: card.name, membersCount: card.membersCount, canWithdraw: card.canWithdraw, shipGroups, basketsCount, todayCount: card.todayCount, previousCount: card.previousCount }
  })

  cards.sort((a, b) => (b.todayCount - a.todayCount) || (b.basketsCount - a.basketsCount) || a.name.localeCompare(b.name, 'es'))
  const totalTodayWithdrawals = cards.reduce((s, c) => s + c.todayCount, 0)
  const totalActiveBaskets = cards.reduce((s, c) => s + c.basketsCount, 0)
  return { todayKey, activeContractors: cards, totalTodayWithdrawals, totalActiveBaskets }
}
