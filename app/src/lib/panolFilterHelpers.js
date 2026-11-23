/**
 * panolFilterHelpers.js
 * Predicados puros de filtrado para transacciones de Pañol y catálogo de materiales.
 */

import { normalizeText } from './allocationEngine.js'
import { matchesUniversalSearch } from './searchEngine.js'
import { isPanolTxZeroCost, isBillableShip } from './zeroCostAlertsRules.js'
import { getLocalDateKey } from './panolBasketsEngine.js'
import { matchesMaterialQuickType } from './filterThemeConstants.js'

export function isDateInFilterPeriod(dateStr, filterPeriod) {
  if (filterPeriod === 'TODOS') return true
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  if (filterPeriod === 'HOY') {
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }
  if (filterPeriod === 'QUINCENA') {
    if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false
    const day = d.getDate()
    return now.getDate() <= 15 ? day <= 15 : day > 15
  }
  if (filterPeriod === 'MES') {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }
  return true
}

export function filterPanolTransactions(inventoryTx = [], {
  activeKpiFilter,
  onlyWithShip = false,
  filterPeriod,
  filterShip,
  filterOt = 'TODAS',
  filterContractor = 'TODOS',
  filterCategory,
  filterMaterialQuick = '',
  searchQuery,
  materials = [],
  ships = [],
  workOrders = []
}) {
  const shipMap = new Map(ships.map((s) => [s.id, s]))
  const woMap = new Map(workOrders.map((w) => [w.id, w]))

  return inventoryTx.filter((t) => {
    const mat = materials.find((m) => m.id === t.material_id)
    if (activeKpiFilter === 'sin_ot' && t.work_order_id) return false
    if (activeKpiFilter === 'hoy' && getLocalDateKey(t.transaction_date) !== getLocalDateKey(new Date())) return false
    if (activeKpiFilter === 'bajas_pendientes' && !t.is_deletion_requested) return false
    if (activeKpiFilter === 'sin_precio') {
      if (!isPanolTxZeroCost(t, mat)) return false
      if (onlyWithShip) {
        const wo = woMap.get(t.work_order_id)
        const resolvedShipId = t.ship_id || wo?.ship_id || null
        if (!isBillableShip(resolvedShipId, shipMap, { excludeAstillero: true })) return false
      }
    }
    if (!isDateInFilterPeriod(t.transaction_date, filterPeriod)) return false
    if (filterShip !== 'TODOS' && t.ship_id !== filterShip) return false
    if (filterOt && filterOt !== 'TODAS') {
      if (filterOt === 'SIN_OT' && t.work_order_id) return false
      if (filterOt !== 'SIN_OT' && String(t.work_order_id || '') !== String(filterOt)) return false
    }
    if (filterContractor && filterContractor !== 'TODOS') {
      const targetNorm = normalizeText(filterContractor)
      if (normalizeText(t.worker_name) !== targetNorm && normalizeText(t.contractor_name) !== targetNorm) return false
    }
    if (filterCategory !== 'TODAS') {
      if (!mat) return false
      if (filterCategory === 'GASES') {
        if (mat.rubro !== 'GASES' && mat.category !== 'GASES') return false
      } else if (mat.category !== filterCategory) return false
    }
    if (filterMaterialQuick) {
      if (!matchesMaterialQuickType({
        materialName: mat?.name || '',
        rubro: mat?.rubro || '',
        unitMeasure: mat?.unit_measure || ''
      }, filterMaterialQuick)) return false
    }
    if (searchQuery && searchQuery.trim()) {
      const ship = shipMap.get(t.ship_id)
      const wo = woMap.get(t.work_order_id)
      return matchesUniversalSearch(t, searchQuery, {
        ship_name: ship?.name || '', work_order_title: wo?.title || '', work_order_description: wo?.description || '',
        ot_number: wo?.ot_number || '', material_name: mat?.name || '', worker_name: t.worker_name || '', contractor_name: t.contractor_name || '',
        voucher_number: t.voucher_number || ''
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
