/**
 * stockControlService.js
 * Motor frontend/dominio para Control de Stock (GS-007), Entradas/Ajustes (`stock_adjustments`),
 * Auditorías Físicas (`stock_audits`), Stock Virtual, Kárdex y Congelamiento Diario 21:00 ART.
 */
import { logRowAction } from './auditService.js'
import { buildArTimestampIso, getTodayArIso, parseTimestampToDate, toArIsoDate } from './dateTimeCanonical.js'
import { materialsRepository } from '../repositories/materialsRepository.js'
import { inventoryTransactionsRepository } from '../repositories/inventoryTransactionsRepository.js'
import { stockAdjustmentsRepository } from '../repositories/stockAdjustmentsRepository.js'
import { stockAuditsRepository } from '../repositories/stockAuditsRepository.js'
import { systemSettingsRepository } from '../repositories/systemSettingsRepository.js'

export const PANOL_STOCK_FREEZE_CONFIG_KEY = 'panol_stock_freeze_config'

export const STOCK_REASON_LABELS = Object.freeze({
  MANUAL_ENTRY: 'Entrada manual (+)',
  MANUAL_EXIT: 'Salida manual (−)',
  AUDIT_CORRECTION: 'Ajuste por control de stock',
  INITIALIZATION: 'Carga / Stock inicial',
  DAMAGE: 'Merma / Rotura',
  RECOVERY: 'Material recuperado',
  OTHER: 'Otro motivo'
})

export const MATERIAL_CONDITION_LABELS = Object.freeze({
  DISPONIBLE: 'Disponible',
  EN_CUARENTENA: 'En cuarentena',
  OBSOLETO: 'Obsoleto',
  DANADO: 'Dañado'
})

/** KPIs de exactitud sobre el historial de controles físicos (`stock_audits`). */
export function computeStockAuditMetrics(audits = []) {
  const list = Array.isArray(audits) ? audits : []
  const total = list.length
  const okCount = list.filter((a) => a?.status === 'OK' || Math.abs(Number(a?.calculated_delta) || 0) <= 0.0005).length
  const discrepancyCount = total - okCount
  return {
    total, okCount, discrepancyCount,
    okPct: total > 0 ? Number(((okCount / total) * 100).toFixed(1)) : 0,
    errorPct: total > 0 ? Number(((discrepancyCount / total) * 100).toFixed(1)) : 0
  }
}

/** Stock Virtual por material: pedidos en tránsito hacia Pañol (`PEDIDO` / `PEDIDO INCOMPLETO`). */
export function computeVirtualStockByMaterial(purchaseOrders = []) {
  const map = new Map()
  for (const po of purchaseOrders || []) {
    if (!po?.material_id || po.charge_type !== 'VIA_PANOL') continue
    if (po.status !== 'PEDIDO' && po.status !== 'PEDIDO INCOMPLETO') continue
    const qty = Number(po.quantity) || 0
    if (qty <= 0) continue
    const key = String(po.material_id)
    const prev = map.get(key) || { virtualQty: 0, pendingOrdersCount: 0, orders: [] }
    prev.virtualQty = Number((prev.virtualQty + qty).toFixed(3))
    prev.pendingOrdersCount += 1
    prev.orders.push(po)
    map.set(key, prev)
  }
  return map
}

/** Resuelve el estado visual de la celda `Stock` en Planilla de Retiros (vivo hoy vs congelado 21:00 ART). */
export function resolveTxStockCellState({ tx, material, freezeConfig = null }) {
  const cutoffHourAr = Number(freezeConfig?.freeze_hour_ar ?? 21)
  const activatedDateAr = freezeConfig?.activated_date_ar || null
  if (!material) return { mode: 'NO_MATERIAL', value: null, frozenAt: null, cutoffHourAr, activatedDateAr }
  if (!material.requires_stock_control) return { mode: 'NO_CONTROL', value: null, frozenAt: null, cutoffHourAr, activatedDateAr }
  if (tx?.stock_frozen_at && tx?.stock_snapshot !== null && tx?.stock_snapshot !== undefined) {
    return { mode: 'FROZEN', value: Number(tx.stock_snapshot), frozenAt: tx.stock_frozen_at, cutoffHourAr, activatedDateAr }
  }
  const txDateAr = toArIsoDate(tx?.transaction_date || tx?.created_at)
  if (activatedDateAr && txDateAr && txDateAr < activatedDateAr) {
    return { mode: 'PRE_ACTIVATION', value: null, frozenAt: null, cutoffHourAr, activatedDateAr }
  }
  return { mode: 'LIVE', value: Number(material.current_stock) || 0, frozenAt: null, cutoffHourAr, activatedDateAr }
}

/** Construye Kárdex cronológico ascendente con saldo acumulado para un material dado. */
export function buildMaterialKardex({ materialId, purchaseOrders = [], adjustments = [], transactions = [] }) {
  if (!materialId) return []
  const targetId = String(materialId)
  const events = []

  for (const po of purchaseOrders || []) {
    if (String(po?.material_id || '') !== targetId || po.charge_type !== 'VIA_PANOL' || po.status !== 'RECIBIDO') continue
    const delta = Number(po.quantity) || 0
    if (delta === 0) continue
    const timestampIso = po.received_at || po.updated_at || buildArTimestampIso(po.order_date, '12:00')
    events.push({
      id: `po_${po.id}`, sourceId: po.id, sourceType: 'COMPRA',
      dateIso: toArIsoDate(timestampIso) || po.order_date || '', timestampIso, delta,
      reference: po.remito_number ? `Remito #${po.remito_number}` : `Compra #${po.invoice_number || String(po.id || '').slice(0, 8)}`,
      notes: po.observations || ''
    })
  }
  for (const adj of adjustments || []) {
    if (String(adj?.material_id || '') !== targetId) continue
    const delta = Number(adj.quantity) || 0
    if (delta === 0) continue
    const timestampIso = adj.effective_at || adj.created_at || buildArTimestampIso(adj.date, '12:00')
    events.push({
      id: `adj_${adj.id}`, sourceId: adj.id, sourceType: 'AJUSTE', reasonType: adj.reason_type || 'MANUAL_ENTRY',
      dateIso: toArIsoDate(adj.date || timestampIso), timestampIso, delta,
      reference: STOCK_REASON_LABELS[adj.reason_type] || adj.reason_type || 'Ajuste de stock', notes: adj.notes || ''
    })
  }
  for (const tx of transactions || []) {
    if (String(tx?.material_id || '') !== targetId) continue
    const qty = Number(tx.quantity_withdrawn) || 0
    if (qty === 0) continue
    const timestampIso = tx.transaction_date || tx.created_at || ''
    events.push({
      id: `tx_${tx.id}`, sourceId: tx.id, sourceType: 'RETIRO',
      dateIso: toArIsoDate(timestampIso), timestampIso, delta: -qty,
      reference: tx.voucher_number ? `Remito #${tx.voucher_number}` : (tx.worker_name || tx.contractor_name || 'Retiro Pañol'),
      notes: tx.notes || ''
    })
  }

  events.sort((a, b) => (parseTimestampToDate(a.timestampIso)?.getTime() || 0) - (parseTimestampToDate(b.timestampIso)?.getTime() || 0) || String(a.id).localeCompare(String(b.id)))
  let balance = 0
  return events.map((ev) => {
    balance = Number((balance + ev.delta).toFixed(3))
    return { ...ev, runningBalance: balance }
  })
}

export async function fetchStockFreezeConfigService() {
  const { data } = await systemSettingsRepository.getByKey(PANOL_STOCK_FREEZE_CONFIG_KEY)
  return data?.value || { freeze_hour_ar: 21 }
}

export async function freezePendingPanolStockDaysService(nowIso = null) {
  const { data, error } = await inventoryTransactionsRepository.freezePendingStockDays(nowIso)
  if (error) { console.warn('[stockControlService] Aviso al congelar días pendientes:', error); return null }
  return data
}

async function fetchTriggerStocksMap(materialIds = []) {
  const { data, error } = await materialsRepository.findStocksByIds(materialIds)
  if (error) throw new Error(error)
  return new Map((data || []).map((m) => [String(m.id), Number(m.current_stock) || 0]))
}

export async function createStockAdjustmentService({
  materialId, quantity, reasonType = 'MANUAL_ENTRY', materialCondition = 'DISPONIBLE',
  date = null, notes = '', material = null, user = null
}) {
  const numQty = Number(quantity)
  if (!materialId) throw new Error('Material obligatorio para registrar movimiento de stock.')
  if (!Number.isFinite(numQty) || numQty === 0) throw new Error('La cantidad del ajuste debe ser distinta de 0.')
  const dateIso = toArIsoDate(date) || getTodayArIso()
  const userLabel = user?.full_name || user?.email || null

  const { data, error } = await stockAdjustmentsRepository.insertOne({
    date: dateIso, effective_at: buildArTimestampIso(dateIso), material_id: materialId,
    quantity: Number(numQty.toFixed(3)), reason_type: reasonType, material_condition: materialCondition,
    unit_cost_usd_snapshot: material?.cost_usd != null ? Number(material.cost_usd) || 0 : null,
    notes: String(notes || '').trim() || null, created_by: userLabel
  })
  if (error) throw new Error(error)

  const newStock = (await fetchTriggerStocksMap([materialId])).get(String(materialId)) ?? 0
  await logRowAction({
    action: 'ROW_INSERT', entityType: 'stock_adjustments', entityId: data.id,
    entityName: `${material?.name || materialId} (${numQty > 0 ? '+' : ''}${numQty})`,
    rowData: data, sheetName: 'Pañol · Entradas y Ajustes', moduleRoute: '/panol', changeOrigin: 'STOCK_ADJUST', user: userLabel
  })
  return { adjustment: data, newStock }
}

export async function createStockRecountAdjustmentService({
  material, targetStock, reasonType = 'AUDIT_CORRECTION', materialCondition = 'DISPONIBLE',
  date = null, notes = '', user = null
}) {
  if (!material?.id) throw new Error('Material inválido para recuento.')
  const targetNum = Number(targetStock)
  if (!Number.isFinite(targetNum)) throw new Error('El recuento físico debe ser un número válido.')
  const stockMap = await fetchTriggerStocksMap([material.id])
  const currentDb = stockMap.has(String(material.id)) ? stockMap.get(String(material.id)) : (Number(material.current_stock) || 0)
  const delta = Number((targetNum - currentDb).toFixed(3))
  if (Math.abs(delta) < 0.0005) return { adjustment: null, newStock: currentDb, skipped: true }
  return createStockAdjustmentService({
    materialId: material.id, quantity: delta, reasonType, materialCondition, date,
    notes: String(notes || '').trim() || `Recuento físico a ${targetNum} (antes: ${currentDb})`, material, user
  })
}

export async function deleteStockAdjustmentService({ adjustment, user = null }) {
  if (!adjustment?.id) throw new Error('Registro de ajuste inválido.')
  const { error } = await stockAdjustmentsRepository.deleteById(adjustment.id)
  if (error) throw new Error(error)
  const newStock = (await fetchTriggerStocksMap([adjustment.material_id])).get(String(adjustment.material_id)) ?? 0
  await logRowAction({
    action: 'ROW_DELETE', entityType: 'stock_adjustments', entityId: adjustment.id,
    entityName: `Ajuste eliminado (${adjustment.quantity})`, rowData: adjustment,
    sheetName: 'Pañol · Entradas y Ajustes', moduleRoute: '/panol', changeOrigin: 'GRID_ACTION', user: user?.email
  })
  return { deleted: true, newStock }
}

export async function createStockAuditBatchService({ rows = [], applyAdjustments = false, date = null, user = null }) {
  const validRows = (rows || []).filter((r) => r?.material_id && Number.isFinite(Number(r.counted_quantity)))
  if (validRows.length === 0) throw new Error('Ingresá al menos un material contado válido.')
  const dateIso = toArIsoDate(date) || getTodayArIso()
  const userLabel = user?.full_name || user?.email || null
  const matIds = validRows.map((r) => r.material_id)
  const freshMap = await fetchTriggerStocksMap(matIds)
  const createdAdjustments = []
  const payloads = []

  for (const row of validRows) {
    const sysQty = freshMap.has(String(row.material_id)) ? freshMap.get(String(row.material_id)) : Number(row.system_quantity) || 0
    const counted = Number(Number(row.counted_quantity).toFixed(3))
    const delta = Number((counted - sysQty).toFixed(3))
    let adjustmentId = null
    if (applyAdjustments && Math.abs(delta) >= 0.0005) {
      const adjRes = await createStockAdjustmentService({
        materialId: row.material_id, quantity: delta, reasonType: 'AUDIT_CORRECTION',
        materialCondition: row.material_condition || 'DISPONIBLE', date: dateIso,
        notes: String(row.notes || '').trim() || `Control físico: sistema ${sysQty} → real ${counted}`,
        material: row.material || null, user
      })
      adjustmentId = adjRes.adjustment.id
      createdAdjustments.push(adjRes.adjustment)
    }
    payloads.push({
      date: dateIso, material_id: row.material_id, system_quantity: sysQty, counted_quantity: counted,
      calculated_delta: delta, status: Math.abs(delta) <= 0.0005 ? 'OK' : 'DISCREPANCY',
      adjustment_id: adjustmentId, material_condition: row.material_condition || 'DISPONIBLE',
      notes: String(row.notes || '').trim() || null, audited_by: userLabel
    })
  }

  const { data: createdAudits, error } = await stockAuditsRepository.insertMany(payloads)
  if (error) throw new Error(error)
  const stockByMaterialId = await fetchTriggerStocksMap(matIds)
  await logRowAction({
    action: 'ROW_INSERT', entityType: 'stock_audits', entityId: createdAudits[0]?.id || 'audit-batch',
    entityName: `Control Físico (${createdAudits.length} ítem/s)`,
    rowData: { count: createdAudits.length, adjustmentsApplied: createdAdjustments.length },
    sheetName: 'Pañol · Control Físico de Stock', moduleRoute: '/panol', changeOrigin: 'AUDIT_BATCH', user: userLabel
  })
  return { createdAudits, createdAdjustments, stockByMaterialId }
}
