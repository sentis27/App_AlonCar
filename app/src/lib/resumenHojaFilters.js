/**
 * resumenHojaFilters.js
 * Motores puros de KPIs y filtrado para las 3 Hojas Solo Lectura de Resumen Gerencial (GS-004).
 */

import { matchesUniversalSearch } from './searchEngine.js'
import { formatUsd, formatKg } from './drydockCatalogConstants.js'
import { matchesMaterialQuickType } from './filterThemeConstants.js'

export function scopeResumenRows(rows = [], { shipId = null, costScope = 'GENERAL', activeOtId = null } = {}) {
  return rows.filter((r) => {
    if (shipId && r.shipId !== shipId) return false
    if (costScope === 'OT' && activeOtId) {
      if (activeOtId === 'SIN_OT') return !r.workOrderId
      return r.workOrderId === activeOtId
    }
    return true
  })
}

export function extractUniqueSortedOptions(rows = [], selector) {
  const set = new Set()
  rows.forEach((r) => {
    const val = String(selector(r) || '').trim()
    if (val) set.add(val)
  })
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

function matchesOtFilter(row, costScope, otFilter) {
  if (costScope !== 'GENERAL' || otFilter === 'ALL') return true
  if (otFilter === 'SIN_OT') return !row.workOrderId
  return String(row.workOrderId || '') === String(otFilter)
}

export function computeMaterialesKpis(scopedBaseRows = []) {
  const matsDirect = scopedBaseRows.filter((r) => r.category === 'MATERIALES')
  const consumables = scopedBaseRows.filter((r) => r.category === 'CONSUMIBLES')
  const eppRef = scopedBaseRows.filter((r) => r.isSafetyReference)
  const withKg = scopedBaseRows.filter((r) => Number(r.weightKg) > 0)
  const missingOt = scopedBaseRows.filter((r) => r.hasMissingOt)
  const zeroPrice = scopedBaseRows.filter((r) => r.hasZeroPrice && !r.isDeletionRequested)

  const sumUsd = (arr, key = 'shipDirectUsd') =>
    arr.reduce((acc, item) => acc + (Number(item[key]) || 0), 0)
  const sumKg = withKg.reduce((acc, item) => acc + (Number(item.weightKg) || 0), 0)

  return [
    { id: 'MATERIALES', label: 'Materiales Directos', count: formatUsd(sumUsd(matsDirect), 0), subtext: `${matsDirect.length} movs. cargados`, colorTheme: 'blue' },
    { id: 'CONSUMIBLES', label: 'Consumibles Obra', count: formatUsd(sumUsd(consumables), 0), subtext: `${consumables.length} consumibles imputados`, colorTheme: 'cyan' },
    { id: 'EPP_REF', label: 'Elem. Seguridad (Ref.)', count: formatUsd(sumUsd(eppRef, 'referenceUsd'), 0), subtext: `${eppRef.length} retiros EPP · No suman`, colorTheme: 'amber' },
    { id: 'PESO_KG', label: 'Peso Total Instalado', count: formatKg(sumKg, 1), subtext: `${withKg.length} ítems con pesaje`, colorTheme: 'purple' },
    { id: 'SIN_OT', label: 'Sin Cargar OT', count: missingOt.length, subtext: 'Movimientos sin OT vinculada', colorTheme: 'rose' },
    { id: 'PRECIO_0', label: 'Precio US$ = $0', count: zeroPrice.length, subtext: 'Alertas sin valorización', colorTheme: 'pink' }
  ]
}

export function filterResumenMaterialRows(scopedBaseRows = [], {
  kpiFilter = 'ALL',
  costScope = 'GENERAL',
  otFilter = 'ALL',
  contractorFilter = 'ALL',
  showMateriales = true,
  showConsumibles = true,
  materialQuick = '',
  onlyKgPositive = false,
  searchQuery = ''
} = {}) {
  return scopedBaseRows.filter((row) => {
    if (kpiFilter === 'MATERIALES' && row.category !== 'MATERIALES') return false
    if (kpiFilter === 'CONSUMIBLES' && row.category !== 'CONSUMIBLES') return false
    if (kpiFilter === 'EPP_REF' && !row.isSafetyReference) return false
    if (kpiFilter === 'PESO_KG' && Number(row.weightKg) <= 0) return false
    if (kpiFilter === 'SIN_OT' && !row.hasMissingOt) return false
    if (kpiFilter === 'PRECIO_0' && (!row.hasZeroPrice || row.isDeletionRequested)) return false
    if (!matchesOtFilter(row, costScope, otFilter)) return false
    if (contractorFilter !== 'ALL' && String(row.contractorLabel || row.workerName || '').trim() !== contractorFilter) return false
    if (row.category === 'MATERIALES' && !showMateriales) return false
    if (row.category === 'CONSUMIBLES' && !showConsumibles) return false
    if (materialQuick && !matchesMaterialQuickType(row, materialQuick)) return false
    if (onlyKgPositive && Number(row.weightKg) <= 0) return false
    if (searchQuery && !matchesUniversalSearch(row, searchQuery)) return false
    return true
  })
}

export function computeHorasKpis(scopedBaseRows = []) {
  const approved = scopedBaseRows.filter((r) => !r.isPendingR && !r.isPresupuesto)
  const pendingR = scopedBaseRows.filter((r) => r.isPendingR && !r.isCorrectedRR)
  const correctedRR = scopedBaseRows.filter((r) => r.isCorrectedRR)
  const missingOt = scopedBaseRows.filter((r) => r.hasMissingOt)
  const budgetDec013 = scopedBaseRows.filter((r) => r.isPresupuesto)

  const sumHrs = (arr) => arr.reduce((acc, r) => acc + (r.hoursPhysical || 0), 0)
  const sumCost = (arr, field = 'costUsd') => arr.reduce((acc, r) => acc + (r[field] || 0), 0)

  return [
    { id: 'APPROVED', label: 'Horas Aprobadas (S)', count: formatUsd(sumCost(approved, 'approvedUsd'), 0), subtext: `${sumHrs(approved).toFixed(1)} hs físicas (${approved.length} partes)`, colorTheme: 'emerald' },
    { id: 'PENDING_R', label: 'Pendientes Revisión ("R")', count: formatUsd(sumCost(pendingR, 'pendingRUsd'), 0), subtext: `${sumHrs(pendingR).toFixed(1)} hs en revisión`, colorTheme: 'amber' },
    { id: 'CORRECTED_RR', label: 'Corregidas ("RR")', count: correctedRR.length, subtext: `${sumHrs(correctedRR).toFixed(1)} hs corregidas`, colorTheme: 'cyan' },
    { id: 'SIN_OT', label: 'Sin OT Asignada', count: missingOt.length, subtext: 'Partes pendientes de vincular OT', colorTheme: 'rose' },
    { id: 'DEC_013', label: 'Presupuesto (DEC-013)', count: budgetDec013.length, subtext: `${sumHrs(budgetDec013).toFixed(1)} hs ($0 automático)`, colorTheme: 'purple' }
  ]
}

export function filterResumenLaborRows(scopedBaseRows = [], {
  kpiFilter = 'ALL',
  costScope = 'GENERAL',
  otFilter = 'ALL',
  workerFilter = 'ALL',
  rubroFilter = 'ALL',
  searchQuery = ''
} = {}) {
  return scopedBaseRows.filter((row) => {
    if (kpiFilter === 'APPROVED' && (row.isPendingR || row.isPresupuesto)) return false
    if (kpiFilter === 'PENDING_R' && !(row.isPendingR && !row.isCorrectedRR)) return false
    if (kpiFilter === 'CORRECTED_RR' && !row.isCorrectedRR) return false
    if (kpiFilter === 'SIN_OT' && !row.hasMissingOt) return false
    if (kpiFilter === 'DEC_013' && !row.isPresupuesto) return false
    if (['GRUA_GRANDE', 'GRUA_CHICA', 'PALA'].includes(kpiFilter) && row.equipmentType !== kpiFilter) return false
    if (!matchesOtFilter(row, costScope, otFilter)) return false
    if (workerFilter !== 'ALL' && String(row.workerName || '').trim() !== workerFilter) return false
    if (rubroFilter !== 'ALL' && String(row.rubro || '').trim() !== rubroFilter) return false
    if (searchQuery && !matchesUniversalSearch(row, searchQuery)) return false
    return true
  })
}

export function computeTercerosKpis(scopedBaseRows = []) {
  const missingOt = scopedBaseRows.filter((r) => r.hasMissingOt)
  const zeroCost = scopedBaseRows.filter((r) => r.hasZeroCost)
  const rpf = scopedBaseRows.filter((r) => r.voucherType === 'RPF')
  const fcr = scopedBaseRows.filter((r) => r.voucherType === 'FCR')
  const prcRmo = scopedBaseRows.filter((r) => r.voucherType === 'PRC' || r.voucherType === 'RMO')
  const sumUsd = (arr) => arr.reduce((acc, item) => acc + (item.amountUsd || 0), 0)

  return [
    { id: 'FCR', label: 'FCR Facturados', count: formatUsd(sumUsd(fcr), 0), subtext: `${fcr.length} facturas rendidas`, colorTheme: 'emerald' },
    { id: 'PRC_RMO', label: 'PRC / RMO Vigentes', count: formatUsd(sumUsd(prcRmo), 0), subtext: `${prcRmo.length} comprobantes en obra`, colorTheme: 'cyan' },
    { id: 'RPF', label: 'RPF Pdte. Factura', count: formatUsd(sumUsd(rpf), 0), subtext: `${rpf.length} remitos sin facturar`, colorTheme: 'purple' },
    { id: 'SIN_OT', label: 'Falta Cargar OT', count: missingOt.length, subtext: 'Servicios sin OT asignada', colorTheme: 'rose' },
    { id: 'SIN_COSTO', label: 'Sin Costo ($0)', count: zeroCost.length, subtext: 'Pendientes de cotización', colorTheme: 'amber' }
  ]
}

export function filterResumenThirdPartyRows(scopedBaseRows = [], {
  kpiFilter = 'ALL',
  costScope = 'GENERAL',
  otFilter = 'ALL',
  contractorFilter = 'ALL',
  voucherFilter = 'ALL',
  searchQuery = ''
} = {}) {
  return scopedBaseRows.filter((row) => {
    if (kpiFilter === 'FCR' && row.voucherType !== 'FCR') return false
    if (kpiFilter === 'PRC_RMO' && !['PRC', 'RMO'].includes(row.voucherType)) return false
    if (kpiFilter === 'RPF' && row.voucherType !== 'RPF') return false
    if (kpiFilter === 'SIN_OT' && !row.hasMissingOt) return false
    if (kpiFilter === 'SIN_COSTO' && !row.hasZeroCost) return false
    if (!matchesOtFilter(row, costScope, otFilter)) return false
    if (contractorFilter !== 'ALL' && String(row.contractorName || '').trim() !== contractorFilter) return false
    if (voucherFilter !== 'ALL' && row.voucherType !== voucherFilter) return false
    if (searchQuery && !matchesUniversalSearch(row, searchQuery)) return false
    return true
  })
}
