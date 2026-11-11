/**
 * tercerosConstants.js
 * Constantes canónicas, definiciones de columnas y utilidades de cálculo
 * para el módulo de Servicios de Terceros, Contratistas y Talleres Externos (M5 / DEC-017).
 */

import { matchesUniversalSearch } from './searchEngine.js'

// Tipos de Comprobante y Reglas de Negocio (DEC-017)
export const VOUCHER_TYPES = [
  {
    code: 'PRC',
    label: 'PRC - Presupuesto Interno',
    color: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60',
    description: 'Trabajo ejecutado dentro de las instalaciones del astillero. Estado definitivo, no evoluciona.'
  },
  {
    code: 'RMO',
    label: 'RMO - Remito Mano de Obra (Taller)',
    color: 'bg-blue-950/80 text-blue-300 border-blue-800/60',
    description: 'Trabajo ejecutado en taller externo del contratista. Evoluciona a FCR (Factura) o SDT.'
  },
  {
    code: 'RPF',
    label: 'RPF - Remito Pendiente de Factura',
    color: 'bg-amber-950/80 text-amber-300 border-amber-800/60 ring-1 ring-amber-500/50',
    description: 'Remito valorizado pendiente de factura oficial. Genera alerta administrativa para exigir factura.'
  },
  {
    code: 'FCR',
    label: 'FCR - Factura Fiscal Oficial',
    color: 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60',
    description: 'Comprobante fiscal respaldatorio oficial definitivo.'
  },
  {
    code: 'SDT',
    label: 'SDT - Sin Documentación',
    color: 'bg-rose-950/80 text-rose-300 border-rose-800/60',
    description: 'Gasto o trabajo cerrado sin factura fiscal oficial (Excepcional).'
  }
]

// Lista oficial de rubros disponibles (para contratistas MANUAL / polirrubro)
export const OFFICIAL_TRADES = [
  'CALDERERIA',
  'TORNERIA',
  'MECANICA',
  'CORTE/PLEGADO',
  'CORTE PANTOGRAFO',
  'CARPINTERIA',
  'ELECTRICIDAD',
  'PINTURA',
  'MANIOBRA',
  'HIDRAULICA',
  'SOLDADURAS',
  'ARENADO',
  'RECTIFICACION MECANICA',
  'FLETE',
  'ELECTRONICA',
  'FIBRA VIDRIO',
  'SERVICIOS',
  'LONAS',
  'TALLER',
  'HONORARIOS',
  'CONTENEDORES',
  'GRUA',
  'ENSAYOS',
  'DESGASIFICACION'
]

// Campos para duplicación y pegado 2D de filas
export const TERCEROS_CLONE_FIELDS = [
  'ship_id', 'work_order_id', 'work_item_id', 'contractor_name', 'trade',
  'voucher_type', 'status', 'amount_ars', 'usd_rate', 'amount_usd',
  'direct_observations', 'specific_observations'
]

export const TERCEROS_PASTE_BASE_FIELDS = [
  'ship_id', 'work_order_id', 'work_item_id', 'contractor_name', 'trade',
  'direct_observations', 'specific_observations'
]

// Formateador estándar de fecha dd/mm/aaaa
export function formatDate(dateStr) {
  if (!dateStr) return '-'
  const clean = String(dateStr).split('T')[0]
  const parts = clean.split('-')
  if (parts.length === 3) {
    const [y, m, d] = parts
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`
  }
  return dateStr
}

// Obtener tipo de cambio oficial congelado por fecha de carga
export function getDollarRateForDate(dateStr, macroVariables = []) {
  if (!dateStr || !macroVariables || macroVariables.length === 0) return 1500
  const parts = dateStr.split('-')
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

// Recálculo del dólar oficial congelado por fecha de entrada
export function computeEntryDateOrAmountChange(newDate, newAmountArs, macroVariables = []) {
  const rate = getDollarRateForDate(newDate, macroVariables) || 1500
  const ars = parseFloat(newAmountArs) || 0
  const usd = rate > 0 ? Number((ars / rate).toFixed(2)) : 0
  return { usd_rate: rate, amount_usd: usd }
}

// Métricas de KPIs y Radar Operativo en vivo
export function calculateTercerosKpis(services = []) {
  let sinPrecio = 0
  let sinOt = 0
  let rpf = 0
  let fcr = 0

  services.forEach((s) => {
    if (!s.amount_ars || Number(s.amount_ars) === 0) sinPrecio++
    if (!s.work_order_id) sinOt++
    if (s.voucher_type === 'RPF') rpf++
    if (s.voucher_type === 'FCR') fcr++
  })

  return { sinPrecio, sinOt, rpf, fcr }
}

// Métricas agregadas para la barra inferior (filas o selección)
export function calculateTercerosStats(targetItems = [], totalVisible = 0, isCustomSelection = false) {
  const count = targetItems.length
  let sumArs = 0
  let sumUsd = 0
  let sumDollarRate = 0
  let validRatesCount = 0

  targetItems.forEach((s) => {
    sumArs += Number(s.amount_ars) || 0
    sumUsd += Number(s.amount_usd) || 0
    if (Number(s.usd_rate) > 0) {
      sumDollarRate += Number(s.usd_rate)
      validRatesCount++
    }
  })

  const avgArs = count > 0 ? sumArs / count : 0
  const avgUsd = count > 0 ? sumUsd / count : 0
  const avgRate = validRatesCount > 0 ? sumDollarRate / validRatesCount : 0

  return {
    isCustomSelection,
    count,
    totalVisible,
    sumArs,
    sumUsd,
    avgArs,
    avgUsd,
    avgRate
  }
}

// Filtrado omnicanal de servicios de terceros
export function filterTercerosServices(services = [], {
  kpiFilter = 'todos',
  selectedShipFilter = 'todos',
  selectedContractorFilter = 'todos',
  selectedTradeFilter = 'todos',
  selectedVoucherFilter = 'todos',
  searchTerm = ''
}, { shipMap = new Map(), otMap = new Map(), contractorMap = new Map() } = {}) {
  return services.filter((srv) => {
    // 1. Filtro KPI
    if (kpiFilter && kpiFilter !== 'todos') {
      if (kpiFilter === 'PRC' && srv.voucher_type !== 'PRC') return false
      if (kpiFilter === 'RMO' && srv.voucher_type !== 'RMO') return false
      if (kpiFilter === 'RPF' && srv.voucher_type !== 'RPF') return false
      if (kpiFilter === 'FCR' && srv.voucher_type !== 'FCR') return false
      if (kpiFilter === 'SDT' && srv.voucher_type !== 'SDT') return false
      if (kpiFilter === 'sin_precio' && Number(srv.amount_ars) > 0) return false
      if (kpiFilter === 'sin_ot' && srv.work_order_id) return false
    }

    // 2. Filtro Buque
    if (selectedShipFilter !== 'todos' && srv.ship_id !== selectedShipFilter) return false

    // 3. Filtro Contratista
    if (selectedContractorFilter !== 'todos' && srv.contractor_name !== selectedContractorFilter) return false

    // 4. Filtro Rubro
    const contractorObj = contractorMap.get(srv.contractor_name?.toUpperCase()?.trim())
    const effectiveTrade = (srv.trade || (contractorObj?.trade && contractorObj.trade !== 'MANUAL' ? contractorObj.trade : '')).toUpperCase()
    if (selectedTradeFilter !== 'todos' && effectiveTrade !== selectedTradeFilter.toUpperCase()) return false

    // 5. Filtro Comprobante
    if (selectedVoucherFilter !== 'todos' && srv.voucher_type !== selectedVoucherFilter) return false

    // 6. Búsqueda profunda omnicanal estándar
    if (searchTerm.trim()) {
      const shipObj = shipMap.get(srv.ship_id)
      const otObj = otMap.get(srv.work_order_id)
      if (!matchesUniversalSearch(srv, searchTerm, {
        ship_name: shipObj?.name,
        ot_number: otObj?.ot_number,
        ot_title: otObj?.title,
        effective_trade: effectiveTrade,
        contractor_trade: contractorObj?.trade
      })) {
        return false
      }
    }

    return true
  })
}

// Construcción de mapas para resolución rápida O(1) de relaciones
export function buildTercerosMaps(ships = [], workOrders = [], contractors = []) {
  const shipMap = new Map(ships.map((s) => [s.id, s]))
  const otMap = new Map(workOrders.map((w) => [w.id, w]))
  const contractorMap = new Map(contractors.map((c) => [c.name.toUpperCase().trim(), c]))
  return { shipMap, otMap, contractorMap }
}

// Definición canónica de columnas para useSpreadsheetGrid
export function getSpreadsheetColumnsTerceros(canEditAmounts, shipMap, otMap) {
  return [
    { key: 'service_date', label: 'Fecha', readOnly: false },
    {
      key: 'ship_wo',
      label: 'Barco / OT',
      readOnly: false,
      getValue: (row) => ({ ship_id: row.ship_id || null, work_order_id: row.work_order_id || null }),
      formatDisplay: (val, row) => {
        const sName = shipMap.get(val?.ship_id || row?.ship_id)?.name || 'Sin Buque'
        const woObj = otMap.get(val?.work_order_id || row?.work_order_id)
        return `${sName} / ${woObj?.ot_number || 'Sin OT'}`
      }
    },
    { key: 'contractor_name', label: 'Contratista', readOnly: false },
    { key: 'amount_ars', label: 'Importe AR$', readOnly: !canEditAmounts },
    { key: 'voucher_type', label: 'Comprobante', readOnly: false },
    { key: 'voucher_number', label: 'Nº Comprobante', readOnly: false },
    { key: 'direct_observations', label: 'Comentarios', readOnly: false }
  ]
}
