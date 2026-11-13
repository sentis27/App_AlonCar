// ==============================================================================
// HELPERS PUROS Y CONSTANTES DEL PANEL DE PEDIDOS DE COMPRAS (M4)
// Sin dependencias de React ni Supabase: 100% testeable en Node.
// ==============================================================================

import { isCostAuditError } from './comprasConstants.js'
import { normalizeSearchText, buildUniversalSearchCorpus } from './searchEngine.js'

export const URGENCY_CYCLE = {
  SIN_APURO: 'URGENTE',
  URGENTE: 'PROXIMA_SALIDA',
  PROXIMA_SALIDA: 'SIN_APURO'
}

export const SIMPLE_STATUS_VALUES = [
  'PEDIR',
  'RECIBIDO',
  'RECIB.COMP.DIRECT',
  'PEDIDO INCOMPLETO',
  'RECIBIDO 2',
  'CANCELADOS',
  'SE COMPRA?'
]

export const STATUS_SELECT_COLOR_MAP = {
  'SE COMPRA?': 'text-pink-400',
  'PEDIDO INCOMPLETO': 'text-orange-400',
  RECIBIDO: 'text-emerald-400',
  'RECIBIDO 2': 'text-slate-300',
  'RECIB.COMP.DIRECT': 'text-cyan-400',
  PEDIDO: 'text-blue-400',
  PEDIR: 'text-amber-400',
  COTIZACION: 'text-purple-400',
  COTIZAR: 'text-purple-400',
  'COTIZA.SOLICITUD': 'text-purple-400',
  'COTIZA.APROBADA': 'text-purple-400',
  CANCELADOS: 'text-rose-400',
  'COTIZA.RECHAZADA': 'text-rose-400'
}

export function getStatusTextColor(status) {
  return STATUS_SELECT_COLOR_MAP[status] || 'text-slate-300'
}

export function getNextUrgency(currentUrgency) {
  return URGENCY_CYCLE[currentUrgency] || 'SIN_APURO'
}

export function computeFortnightFromDate(dateStr, fallbackFortnight = '') {
  if (!dateStr || typeof dateStr !== 'string') return fallbackFortnight
  const parts = dateStr.split('-')
  if (parts.length < 3) return fallbackFortnight
  const q = parseInt(parts[2], 10) <= 15 ? 'Q1' : 'Q2'
  return `${parts[0]}-${parts[1]}-${q}`
}

export function getDollarRateForDate(dateStr, macroVariables = []) {
  if (!dateStr) return 1500
  const parts = String(dateStr).split('-')
  if (parts.length < 3) return 1500
  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10)
  const day = parseInt(parts[2], 10)

  const mv = macroVariables.find((m) => m.year === year && m.month === month)
  if (!mv) {
    const sorted = [...macroVariables].sort((a, b) => b.year * 100 + b.month - (a.year * 100 + a.month))
    const latest = sorted[0]
    if (!latest) return 1500
    const rate = day <= 15 ? (latest.dollar_rate_1q || latest.dollar_rate) : (latest.dollar_rate_2q || latest.dollar_rate)
    return Number(rate) || 1500
  }
  const rate = day <= 15 ? (mv.dollar_rate_1q || mv.dollar_rate) : (mv.dollar_rate_2q || mv.dollar_rate)
  return Number(rate) || 1500
}

export function computeAvailableFortnights(purchaseOrders = [], currentFortnight = '') {
  const set = new Set()
  purchaseOrders.forEach((po) => {
    if (po.fortnight_period) set.add(po.fortnight_period)
  })
  if (currentFortnight) set.add(currentFortnight)
  return Array.from(set).sort().reverse()
}

export function computePedidosKpis(purchaseOrders = [], ships = [], now = new Date()) {
  let countPedir = 0
  let countCotizar = 0
  let countCotizaSol = 0
  let countCotizacion = 0
  let countCotizaAprob = 0
  let countCotizacionesTotal = 0
  let countPedido = 0
  let countPedidoIncompleto = 0
  let countSeCompra = 0
  let countRecibido = 0
  let countRecibidoDirecto = 0
  let countCostAuditErrors = 0
  let countConciliados = 0
  let expiredQuotes = 0
  let newMaterialsCount = 0
  let countSinOtTotal = 0
  let countSinOtObras = 0
  let countSinOtStock = 0

  purchaseOrders.forEach((po) => {
    if (!po.work_order_id) {
      countSinOtTotal++
      if (po.charge_type === 'DIRECT') countSinOtObras++
      else countSinOtStock++
    }
    if (po.is_new_material && !po.no_catalog_required) newMaterialsCount++
    if (po.is_reconciled) countConciliados++
    if (po.status === 'PEDIR' || po.status === 'SOLICITUD') countPedir++

    if (['COTIZACION', 'COTIZAR', 'COTIZA.SOLICITUD', 'COTIZA.APROBADA'].includes(po.status)) {
      countCotizacionesTotal++
      if (po.status === 'COTIZAR') countCotizar++
      if (po.status === 'COTIZA.SOLICITUD') countCotizaSol++
      if (po.status === 'COTIZACION') countCotizacion++
      if (po.status === 'COTIZA.APROBADA') countCotizaAprob++

      const orderDate = new Date(po.order_date)
      const diffDays = Math.floor((now - orderDate) / (1000 * 60 * 60 * 24))
      if (diffDays > 7) expiredQuotes++
    }

    if (po.status === 'PEDIDO') countPedido++
    if (po.status === 'PEDIDO INCOMPLETO') countPedidoIncompleto++
    if (po.status === 'SE COMPRA?') countSeCompra++
    if (po.status === 'RECIBIDO') countRecibido++
    if (po.status === 'RECIB.COMP.DIRECT') countRecibidoDirecto++
    if (isCostAuditError(po, ships)) countCostAuditErrors++
  })

  return {
    countSinOtTotal,
    countSinOtObras,
    countSinOtStock,
    porEmitirTotal: countPedir,
    countPedir,
    countCotizacionesTotal,
    countCotizar,
    countCotizaSol,
    countCotizacion,
    countCotizaAprob,
    expiredQuotes,
    enProveedorTotal: countPedido + countPedidoIncompleto,
    countPedido,
    countPedidoIncompleto,
    countSeCompra,
    recibidosTotal: countRecibido + countRecibidoDirecto,
    countRecibido,
    countRecibidoDirecto,
    costAuditErrors: countCostAuditErrors,
    countConciliados,
    newMaterialsCount
  }
}

export function filterPurchaseOrders(
  purchaseOrders = [],
  {
    searchQuery = '',
    filterSupplier = 'TODOS',
    filterStatus = 'TODOS',
    filterFortnight = 'TODAS',
    filterChargeType = 'TODOS',
    filterNewOnly = false,
    hideReconciled = false,
    activeKpiFilter = null
  } = {},
  { suppliers = [], ships = [], documents = [], workOrders = [] } = {}
) {
  return purchaseOrders.filter((po) => {
    if (searchQuery.trim()) {
      const q = normalizeSearchText(searchQuery)
      const shp = ships.find((s) => s.id === po.ship_id)
      const wo = workOrders.find((w) => w.id === po.work_order_id)
      const sup = suppliers.find((s) => s.id === po.supplier_id)
      const orderDocs = documents.filter(
        (d) => d.purchase_order_id === po.id || (d.work_order_id && d.work_order_id === po.work_order_id)
      )

      const corpus = buildUniversalSearchCorpus(
        {
          ...po,
          ship_name: shp?.name || '',
          vessel_type: shp?.vessel_type || '',
          work_order_title: wo?.title || '',
          work_order_description: wo?.description || '',
          ot_number: wo?.ot_number || '',
          supplier_name: sup?.name || '',
          supplier_trade: sup?.trade || '',
          requested_by_name: po.requested_by_name || 'PAÑOL'
        },
        { documents: orderDocs }
      )

      if (!corpus.includes(q)) return false
    }

    if (activeKpiFilter === 'sin_ot' && po.work_order_id) return false
    if (activeKpiFilter === 'sin_ot_obras' && (po.work_order_id || po.charge_type !== 'DIRECT')) return false
    if (activeKpiFilter === 'sin_ot_stock' && (po.work_order_id || po.charge_type === 'DIRECT')) return false
    if (activeKpiFilter === 'por_emitir' && !['PEDIR', 'SOLICITUD'].includes(po.status)) return false
    if (activeKpiFilter === 'cotizaciones' && !['COTIZACION', 'COTIZAR', 'COTIZA.SOLICITUD', 'COTIZA.APROBADA'].includes(po.status)) return false
    if (activeKpiFilter === 'pedidos' && !['PEDIDO', 'PEDIDO INCOMPLETO'].includes(po.status)) return false
    if (activeKpiFilter === 'recibidos' && !['RECIBIDO', 'RECIB.COMP.DIRECT'].includes(po.status)) return false
    if (activeKpiFilter === 'conciliados' && !po.is_reconciled) return false
    if (activeKpiFilter === 'alta_materiales' && (!po.is_new_material || po.no_catalog_required)) return false
    if (activeKpiFilter === 'cost_audit' && !isCostAuditError(po, ships)) return false
    if (activeKpiFilter === 'gases') {
      const sup = suppliers.find((s) => s.id === po.supplier_id)
      if (!sup?.is_gas_supplier) return false
    }

    if (filterSupplier !== 'TODOS' && po.supplier_id !== filterSupplier) return false
    if (filterStatus !== 'TODOS' && po.status !== filterStatus && !(filterStatus === 'PEDIR' && po.status === 'SOLICITUD')) return false
    if (filterFortnight !== 'TODAS' && po.fortnight_period !== filterFortnight) return false
    if (filterChargeType !== 'TODOS' && po.charge_type !== filterChargeType) return false
    if (filterNewOnly && (!po.is_new_material || po.no_catalog_required)) return false
    if (hideReconciled && po.is_reconciled) return false

    return true
  })
}

export function computePedidosStats(targetList = [], macroVariables = []) {
  let sumQty = 0
  let sumCostArs = 0
  let sumCostUsd = 0

  targetList.forEach((po) => {
    const qty = Number(po.quantity) || 0
    const priceArs = Number(po.supplier_quoted_price || po.system_unit_price) || 0
    const rate = getDollarRateForDate(po.order_date, macroVariables)

    sumQty += qty
    sumCostArs += qty * priceArs
    sumCostUsd += (qty * priceArs) / rate
  })

  const count = targetList.length
  const avgPriceArs = count > 0 ? sumCostArs / count : 0

  return { count, sumQty, sumCostArs, sumCostUsd, avgPriceArs }
}
