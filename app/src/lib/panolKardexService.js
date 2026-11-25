/**
 * panolKardexService.js
 * Carga completa del Kárdex histórico cronológico de un material desde los 4 repositorios reales:
 * Compras recibidas (VIA_PANOL), Entradas/Ajustes manuales, Retiros de Pañol y Stock actual en BD.
 */
import { purchaseOrdersRepository } from '../repositories/purchaseOrdersRepository.js'
import { stockAdjustmentsRepository } from '../repositories/stockAdjustmentsRepository.js'
import { inventoryTransactionsRepository } from '../repositories/inventoryTransactionsRepository.js'
import { materialsRepository } from '../repositories/materialsRepository.js'
import { buildMaterialKardex, computeVirtualStockByMaterial } from './stockControlService.js'

const EMPTY_KARDEX = Object.freeze({
  entries: [],
  totalIn: 0,
  totalOut: 0,
  virtualQty: 0,
  pendingOrdersCount: 0,
  pendingOrders: [],
  currentStockDb: 0
})

export async function fetchMaterialKardexDataService(materialId) {
  if (!materialId) return { ...EMPTY_KARDEX }

  const [poRes, adjRes, txRes, stockRes] = await Promise.all([
    purchaseOrdersRepository.listOrders({ filters: { material_id: materialId } }),
    stockAdjustmentsRepository.listByMaterial(materialId),
    inventoryTransactionsRepository.listTransactions({ filters: { material_id: materialId } }),
    materialsRepository.findStocksByIds([materialId])
  ])

  if (poRes.error) throw new Error(poRes.error)
  if (adjRes.error) throw new Error(adjRes.error)
  if (txRes.error) throw new Error(txRes.error)
  if (stockRes.error) throw new Error(stockRes.error)

  const purchaseOrders = poRes.data || []
  const ledgerAsc = buildMaterialKardex({
    materialId,
    purchaseOrders,
    adjustments: adjRes.data || [],
    transactions: txRes.data || []
  })

  let totalIn = 0
  let totalOut = 0
  for (const ev of ledgerAsc) {
    if (ev.delta > 0) totalIn += ev.delta
    else if (ev.delta < 0) totalOut += Math.abs(ev.delta)
  }

  const virtualInfo = computeVirtualStockByMaterial(purchaseOrders).get(String(materialId)) || {
    virtualQty: 0,
    pendingOrdersCount: 0,
    orders: []
  }

  const stockRow = stockRes.data?.[0]
  const currentStockDb = stockRow != null
    ? Number(stockRow.current_stock) || 0
    : (ledgerAsc.at(-1)?.runningBalance ?? 0)

  return {
    entries: [...ledgerAsc].reverse(),
    totalIn: Number(totalIn.toFixed(3)),
    totalOut: Number(totalOut.toFixed(3)),
    virtualQty: virtualInfo.virtualQty,
    pendingOrdersCount: virtualInfo.pendingOrdersCount,
    pendingOrders: virtualInfo.orders,
    currentStockDb
  }
}
