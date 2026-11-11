import { normalizeText } from './allocationEngine.js'
import { matchesUniversalSearch } from './searchEngine.js'

/**
 * panolConstants.js
 * Centralización de constantes, definiciones de columnas y utilidades de cálculo
 * para el módulo de Pañol Central & Materiales (M4 - Logística Naval).
 */

// Insignias cromáticas para porcentaje de Seguridad Naval
export function getSecurityFactorBadge(factor) {
  const f = Number(factor) || 1.06
  if (f <= 1.02) {
    return { label: '2% (1.02)', style: 'bg-slate-800 text-slate-300 border-slate-700' }
  }
  if (Math.abs(f - 1.06) < 0.005) {
    return { label: '6% (1.06 Estándar)', style: 'bg-emerald-950 text-emerald-300 border-emerald-500/60 font-bold' }
  }
  if (Math.abs(f - 1.10) < 0.005) {
    return { label: '10% (1.10)', style: 'bg-amber-950 text-amber-300 border-amber-600' }
  }
  if (Math.abs(f - 1.15) < 0.005) {
    return { label: '15% (1.15)', style: 'bg-orange-950 text-orange-300 border-orange-600' }
  }
  return { label: `${Math.round((f - 1) * 100)}% (${f})`, style: 'bg-rose-950 text-rose-300 border-rose-600 font-bold' }
}

// Columnas para la grilla de retiros (useSpreadsheetGrid)
export const SPREADSHEET_COLUMNS_PANOL = [
  { key: 'transaction_date', label: 'Fecha', readOnly: false },
  { key: 'ship_id', label: 'Barco / Destino', readOnly: false },
  { key: 'work_order_id', label: 'Orden de Trabajo (OT)', readOnly: false },
  { key: 'material_id', label: 'Material Insumo', readOnly: false },
  { key: 'quantity_withdrawn', label: 'Cant.', isNumeric: true, readOnly: false },
  { key: 'weight_total', label: 'Peso (kg)', isNumeric: true, readOnly: false },
  { key: 'contractor_name', label: 'Operario / Contratista', readOnly: false },
  { key: 'cost_center', label: 'Centro de Costo', readOnly: false },
  { key: 'notes', label: 'Observaciones', readOnly: false }
]

// Columnas para la grilla de materiales (materialsGrid)
export const getMaterialsColumns = (isAdmin) => [
  { key: 'name', label: 'Material / Insumo', readOnly: false },
  { key: 'rubro', label: 'Rubro Técnico', readOnly: true },
  { key: 'category', label: 'Categoría', readOnly: true },
  { key: 'weight_kg', label: 'Peso Unit. (kg)', isNumeric: true, readOnly: false },
  { key: 'current_stock', label: 'Stock Actual', isNumeric: true, readOnly: true },
  { key: 'minimum_stock', label: 'Stock Mínimo', isNumeric: true, readOnly: false },
  { key: 'requires_stock_control', label: 'Lleva Stock Físico', readOnly: false },
  { key: 'security_factor', label: '% Seg. Naval', readOnly: !isAdmin }
]

// Campos permitidos para pegado y clonación de filas
export const PANOL_PASTE_FIELDS = [
  'ship_id',
  'work_order_id',
  'material_id',
  'quantity_withdrawn',
  'weight_total',
  'contractor_name',
  'worker_name',
  'worker_id',
  'cost_center',
  'notes'
]

export const MATERIALS_CLONE_FIELDS = [
  'name',
  'category',
  'rubro',
  'unit_measure',
  'weight_kg',
  'minimum_stock',
  'requires_stock_control',
  'security_factor',
  'location_bin',
  'description',
  'notes'
]

export const MATERIALS_PASTE_FIELDS = [
  'name',
  'category',
  'rubro',
  'unit_measure',
  'weight_kg',
  'minimum_stock',
  'requires_stock_control',
  'security_factor',
  'location_bin',
  'description',
  'notes'
]

// Comprobar si una fecha cae en el periodo de filtro seleccionado
export function isDateInFilterPeriod(dateStr, filterPeriod) {
  if (filterPeriod === 'TODOS') return true
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  if (filterPeriod === 'HOY') {
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    )
  }
  if (filterPeriod === 'QUINCENA') {
    if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false
    const day = d.getDate()
    const nowDay = now.getDate()
    const isQ1 = nowDay <= 15
    return isQ1 ? day <= 15 : day > 15
  }
  if (filterPeriod === 'MES') {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }
  return true
}

// Cálculo de estadísticas y balances de gases (P-01/P-02)
export function calculateGasStats(suppliers = [], gasMovements = []) {
  const gasSuppliers = suppliers.filter((s) => s.is_gas_supplier)
  const patioStock = {}

  gasSuppliers.forEach((s) => {
    patioStock[s.id] = { full: 0, empty: 0, supplier: s }
  })

  gasMovements.forEach((m) => {
    const supDelivered = m.supplier_delivered_id
    const supReturned = m.supplier_returned_id
    const q = Number(m.quantity) || 1

    if (m.operation_type === 'PRIMERA_ENTREGA') {
      if (patioStock[supDelivered]) patioStock[supDelivered].full -= q
    } else if (m.operation_type === 'RECAMBIO_1X1') {
      if (patioStock[supDelivered]) patioStock[supDelivered].full -= q
      if (patioStock[supReturned]) patioStock[supReturned].empty += q
    } else if (m.operation_type === 'DEVOLUCION_FINAL') {
      if (patioStock[supReturned]) patioStock[supReturned].empty += q
    } else if (m.operation_type === 'AJUSTE_PATIO') {
      if (patioStock[supDelivered]) patioStock[supDelivered].full += q
    }
  })

  // Calcular matriz de deuda por contratista
  const contractorDebts = {}
  gasMovements.forEach((m) => {
    const c = m.contractor_name || 'ALON CAR'
    if (!contractorDebts[c]) {
      contractorDebts[c] = { totalHeld: 0, movements: [] }
    }
    const q = Number(m.quantity) || 1
    if (m.operation_type === 'PRIMERA_ENTREGA') {
      contractorDebts[c].totalHeld += q
      contractorDebts[c].movements.push(m)
    } else if (m.operation_type === 'DEVOLUCION_FINAL') {
      contractorDebts[c].totalHeld -= q
    }
  })

  // Alertas de retención mayor a 15 días (Regla P-01)
  const now = new Date()
  const longHeldContractors = []

  Object.entries(contractorDebts).forEach(([cName, data]) => {
    if (data.totalHeld > 0) {
      data.movements.forEach((mov) => {
        const movDate = new Date(mov.movement_date || mov.created_at)
        const diffDays = Math.floor((now - movDate) / (1000 * 60 * 60 * 24))
        if (diffDays > 15) {
          longHeldContractors.push({
            contractor: cName,
            days: diffDays,
            movement: mov
          })
        }
      })
    }
  })

  let totalEmptyInPatio = 0
  Object.values(patioStock).forEach((p) => {
    if (p.empty > 0) totalEmptyInPatio += p.empty
  })

  return {
    patioStock,
    contractorDebts,
    longHeldContractors,
    totalEmptyInPatio
  }
}

// Cálculo del Radar de KPIs de Pañol
export function calculatePanolKpis(materials = [], inventoryTx = [], gasStats = {}) {
  const todayStr = new Date().toISOString().split('T')[0]
  let criticalCount = 0
  materials.forEach((m) => {
    const c = Number(m.current_stock) || 0
    const min = Number(m.minimum_stock) || 0
    if (c <= min) criticalCount++
  })

  let todayTxCount = 0
  let sinOtCount = 0
  let deletionRequestsCount = 0

  inventoryTx.forEach((t) => {
    const d = String(t.transaction_date).split('T')[0]
    if (d === todayStr) todayTxCount++
    if (!t.work_order_id) sinOtCount++
    if (t.is_deletion_requested) deletionRequestsCount++
  })

  return {
    criticalCount,
    todayTxCount,
    sinOtCount,
    deletionRequestsCount,
    emptyCylinders: gasStats.totalEmptyInPatio || 0,
    longHeldGases: (gasStats.longHeldContractors || []).length
  }
}

// Agregaciones globales para la barra de estado
export function calculatePanolTotals(filteredTransactions = []) {
  let totalQty = 0
  let totalKg = 0
  filteredTransactions.forEach((tx) => {
    totalQty += Number(tx.quantity_withdrawn) || 0
    totalKg += Number(tx.weight_total) || 0
  })
  return { totalQty, totalKg }
}

// Operarios y contratistas habilitados según combinación Barco y OT
export function getEnabledWorkersAndContractors(shipId, workOrderId, workItems = [], eligiblePersonnel = {}) {
  const { astilleroWorkers = [], contractorGroups = [] } = eligiblePersonnel
  if (!workOrderId) return { astilleroWorkers, contractorGroups }
  const items = workItems.filter((wi) => wi.work_order_id === workOrderId && wi.status !== 'Desestimado')
  if (items.length === 0) return { astilleroWorkers, contractorGroups }
  const rawContractors = items.flatMap((wi) => Array.isArray(wi.contractors) ? wi.contractors : wi.contractor_name ? [wi.contractor_name] : [])
  const hasAstillero = rawContractors.some((c) => {
    const n = normalizeText(c)
    return n === 'ASTILLERO' || n.startsWith('ASTILLERO.') || n === 'ALON CAR'
  })
  const enabledAst = hasAstillero || rawContractors.length === 0 ? astilleroWorkers : []
  const enabledContractorSet = new Set(rawContractors.filter((c) => {
    const n = normalizeText(c)
    return n && !n.startsWith('ASTILLERO') && n !== 'ALON CAR'
  }).map((c) => c.trim().toUpperCase()))
  const enabledCnt = contractorGroups.filter((grp) => enabledContractorSet.has(grp.toUpperCase()))
  return (enabledAst.length === 0 && enabledCnt.length === 0) ? { astilleroWorkers, contractorGroups } : { astilleroWorkers: enabledAst, contractorGroups: enabledCnt }
}

// Tooltip enriquecido para celdas de Orden de Trabajo
export function formatWorkOrderTooltip(wo, ship, workItems = []) {
  if (!wo) return '(⚠️ Sin OT)'
  const otItems = workItems.filter((wi) => wi.work_order_id === wo.id)
  const fullDesc = otItems.map((i) => i.description).filter(Boolean).join(' | ') || wo.description || wo.title || 'Sin descripción técnica'
  const foremen = Array.from(new Set(otItems.map((i) => i.foreman_name).filter(Boolean))).join(', ') || 'Sin asignar'
  return `OT #${wo.order_number || wo.ot_number || wo.id?.slice(0, 4)}: ${wo.title || ''}\nDescripción: ${fullDesc}\nJefe: ${foremen}\nBuque: ${ship?.name || 'Astillero'}`
}

export function filterPanolTransactions(inventoryTx = [], {
  activeKpiFilter,
  filterPeriod,
  filterShip,
  filterCategory,
  searchQuery,
  materials = [],
  ships = [],
  workOrders = []
}) {
  return inventoryTx.filter((t) => {
    if (activeKpiFilter === 'sin_ot' && t.work_order_id) return false
    if (activeKpiFilter === 'hoy' && String(t.transaction_date).split('T')[0] !== new Date().toISOString().split('T')[0]) return false
    if (activeKpiFilter === 'bajas_pendientes' && !t.is_deletion_requested) return false
    if (!isDateInFilterPeriod(t.transaction_date, filterPeriod)) return false
    if (filterShip !== 'TODOS' && t.ship_id !== filterShip) return false
    const mat = materials.find((m) => m.id === t.material_id)
    if (filterCategory !== 'TODAS') {
      if (!mat) return false
      if (filterCategory === 'GASES') {
        if (mat.rubro !== 'GASES' && mat.category !== 'GASES') return false
      } else if (mat.category !== filterCategory) return false
    }
    if (searchQuery && searchQuery.trim()) {
      const ship = ships.find((s) => s.id === t.ship_id)
      const wo = workOrders.find((w) => w.id === t.work_order_id)
      return matchesUniversalSearch(t, searchQuery, {
        ship_name: ship?.name || '', work_order_title: wo?.title || '', work_order_description: wo?.description || '',
        ot_number: wo?.ot_number || '', material_name: mat?.name || '', worker_name: t.worker_name || '', contractor_name: t.contractor_name || ''
      })
    }
    return true
  })
}

export function filterPanolMaterials(materials = [], {
  activeKpiFilter,
  filterStockOnly,
  filterCategory,
  searchQuery
}) {
  return materials.filter((m) => {
    if (activeKpiFilter === 'critico' && (Number(m.current_stock) || 0) > (Number(m.minimum_stock) || 0)) return false
    if (filterStockOnly && !m.requires_stock_control) return false
    if (filterCategory !== 'TODAS') {
      if (filterCategory === 'GASES') {
        if (m.rubro !== 'GASES' && m.category !== 'GASES') return false
      } else if (m.category !== filterCategory) return false
    }
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      return (m.name || '').toLowerCase().includes(q) || (m.rubro || '').toLowerCase().includes(q) || (m.category || '').toLowerCase().includes(q)
    }
    return true
  })
}
