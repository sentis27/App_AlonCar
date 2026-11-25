/**
 * resumenHojaFilters.js
 * Motores puros de KPIs y filtrado para las 3 Hojas Solo Lectura de Resumen Gerencial (GS-004).
 */

import { matchesUniversalSearch } from './searchEngine.js'
import { formatUsd, formatKg } from './drydockCatalogConstants.js'
import { matchesMaterialQuickType } from './filterThemeConstants.js'
import { compareIsoDatesDesc } from './dateTimeCanonical.js'
import { getModuleFilterConfig } from './moduleFilterConfigs.js'
import { normalizeText } from './tradesCatalog.js'

export const EQUIPMENT_KPI_LABELS = {
  GRUA_GRANDE: 'Grúa Grande',
  GRUA_CHICA: 'Grúa Chica',
  PALA: 'Pala'
}

export function resolveHorasShortcutBadge(kpiFilter = 'ALL') {
  const equip = EQUIPMENT_KPI_LABELS[kpiFilter]
  if (equip) return { label: `Maquinaria: ${equip}`, tone: 'amber', title: 'Filtro de maquinaria activo desde Resumen · Clic para quitar' }
  if (kpiFilter === 'APPROVED') return { label: 'Estado: Horas Aprobadas', tone: 'emerald', title: 'Filtro de horas aprobadas activo desde Resumen · Clic para quitar' }
  return null
}

const RUBRO_KPI_PREDICATES = {
  RUBRO_CALDERERIA: (norm) => norm.includes('CALDER'),
  RUBRO_RASCHINAJE: (norm) => norm.includes('RASCHIN'),
  RUBRO_MECANICA: (norm) => norm.includes('MECAN'),
  RUBRO_TORNERIA: (norm) => norm.includes('TORN'),
  RUBRO_PINTURA: (norm) => norm.includes('PINT'),
  RUBRO_ELECTRICIDAD: (norm) => norm.includes('ELECTRIC')
}

const HORAS_RUBRO_KPIS = [
  { id: 'RUBRO_CALDERERIA', label: 'Calderería', colorTheme: 'blue' },
  { id: 'RUBRO_RASCHINAJE', label: 'Raschinaje', colorTheme: 'cyan' },
  { id: 'RUBRO_MECANICA', label: 'Mecánica', colorTheme: 'emerald' }
]

const TERCEROS_RUBRO_KPIS = [
  { id: 'RUBRO_TORNERIA', label: 'Tornería', colorTheme: 'blue' },
  { id: 'RUBRO_PINTURA', label: 'Pintura', colorTheme: 'cyan' },
  { id: 'RUBRO_ELECTRICIDAD', label: 'Electricidad', colorTheme: 'purple' }
]

/**
 * Compara el rubro normalizado de una fila contra una tarjeta KPI de rubro (`RUBRO_*`).
 */
export function matchesResumenRubroKpi(rubroValue = '', kpiId = '') {
  const predicate = RUBRO_KPI_PREDICATES[kpiId]
  if (!predicate) return false
  const norm = normalizeText(rubroValue)
  return Boolean(norm && predicate(norm))
}

function buildRubroKpiCards(rows, definitions, mapMetrics) {
  return definitions.map(({ id, label, colorTheme }) => {
    const matched = rows.filter((r) => matchesResumenRubroKpi(r.rubro, id))
    return { id, label, colorTheme, ...mapMetrics(matched) }
  })
}

/**
 * Comparador canónico por Orden de Trabajo (OT) para las 3 Hojas Solo Lectura (Zona 5):
 * 1. Filas con OT asignada primero; filas Sin OT al final.
 * 2. Orden natural por número de OT (`OT-1`, `OT-2`, ..., `OT-9`, `OT-10`).
 * 3. Agrupación continua por título / ID de OT.
 * 4. Desempate por fecha ISO real descendente (`FL-024`) e ID determinístico.
 */
export function compareResumenRowsByWorkOrder(a = {}, b = {}) {
  const aHasOt = Boolean(a?.workOrderId)
  const bHasOt = Boolean(b?.workOrderId)
  if (aHasOt !== bHasOt) return aHasOt ? -1 : 1

  if (aHasOt && bHasOt) {
    const aNum = String(a?.otNumber || '').trim()
    const bNum = String(b?.otNumber || '').trim()
    const numCmp = aNum.localeCompare(bNum, 'es', { numeric: true, sensitivity: 'base' })
    if (numCmp !== 0) return numCmp

    const titleCmp = String(a?.otTitle || '').localeCompare(String(b?.otTitle || ''), 'es', { sensitivity: 'base' })
    if (titleCmp !== 0) return titleCmp

    const idCmp = String(a?.workOrderId || '').localeCompare(String(b?.workOrderId || ''))
    if (idCmp !== 0) return idCmp
  }

  const dateCmp = compareIsoDatesDesc(a?.date, b?.date)
  if (dateCmp !== 0) return dateCmp

  return String(a?.id || '').localeCompare(String(b?.id || ''))
}

/**
 * Resuelve los filtros limpios de lanzamiento cuando el usuario hace clic en un
 * botón-atajo del Resumen principal (`mode === 'SUMMARY_SHORTCUT'`).
 */
export function buildCleanSheetShortcutFilters(moduleKey, kpi = 'ALL') {
  const { defaults = {} } = getModuleFilterConfig(moduleKey)
  return {
    ...defaults,
    kpiFilter: kpi || 'ALL'
  }
}

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
  const directPurchases = scopedBaseRows.filter((r) => r.sourceType === 'COMPRA_DIRECTA')
  const consumables = scopedBaseRows.filter((r) => r.category === 'CONSUMIBLES')
  const eppRef = scopedBaseRows.filter((r) => r.isSafetyReference)
  const withKg = scopedBaseRows.filter((r) => Number(r.weightKg) > 0)
  const missingOt = scopedBaseRows.filter((r) => r.hasMissingOt)
  const zeroPrice = scopedBaseRows.filter((r) => r.hasZeroPrice && !r.isDeletionRequested)

  const sumUsd = (arr, key = 'shipDirectUsd') => arr.reduce((acc, item) => acc + (Number(item[key]) || 0), 0)
  const sumKg = withKg.reduce((acc, item) => acc + (Number(item.weightKg) || 0), 0)

  return [
    { id: 'MATERIALES', label: 'Materiales de Obra', count: formatUsd(sumUsd(matsDirect), 0), subtext: `${matsDirect.length} movs. cargados`, colorTheme: 'blue' },
    { id: 'COMPRA_DIRECTA', label: 'Compras Directas', count: formatUsd(sumUsd(directPurchases), 0), subtext: `${directPurchases.length} OC directas`, colorTheme: 'fuchsia' },
    { id: 'CONSUMIBLES', label: 'Consumibles Obra', count: formatUsd(sumUsd(consumables), 0), subtext: `${consumables.length} consumibles imputados`, colorTheme: 'cyan' },
    { id: 'EPP_REF', label: 'Elem. Seguridad (Ref.)', count: formatUsd(sumUsd(eppRef, 'referenceUsd'), 0), subtext: `${eppRef.length} retiros EPP · No suman`, colorTheme: 'amber' },
    { id: 'PESO_KG', label: 'Peso Total Instalado', count: formatKg(sumKg, 1), subtext: `${withKg.length} ítems con pesaje`, colorTheme: 'purple' },
    { id: 'SIN_OT', label: 'Sin Cargar OT', count: missingOt.length, subtext: 'Movimientos sin OT vinculada', colorTheme: 'rose' },
    { id: 'PRECIO_0', label: 'Precio US$ = $0', count: zeroPrice.length, subtext: 'Alertas sin valorización', colorTheme: 'pink' }
  ]
}

export function filterResumenMaterialRows(scopedBaseRows = [], filters = {}) {
  const {
    kpiFilter = 'ALL', costScope = 'GENERAL', otFilter = 'ALL', contractorFilter = 'ALL',
    showMateriales = true, showConsumibles = true, materialQuick = '', onlyKgPositive = false, searchQuery = ''
  } = filters
  return scopedBaseRows.filter((row) => {
    if (kpiFilter === 'MATERIALES' && row.category !== 'MATERIALES') return false
    if (kpiFilter === 'COMPRA_DIRECTA' && row.sourceType !== 'COMPRA_DIRECTA') return false
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
  }).sort(compareResumenRowsByWorkOrder)
}

export function computeHorasKpis(scopedBaseRows = []) {
  const validRows = scopedBaseRows.filter(
    (r) => r && !r.isControl && String(r.workType || '').trim().toUpperCase() !== 'CONTROL'
  )
  const pendingR = validRows.filter((r) => r.isPendingR && !r.isCorrectedRR && !r.isPresupuesto)
  const missingOt = validRows.filter((r) => r.hasMissingOt)
  const budgetDec013 = validRows.filter((r) => r.isPresupuesto)
  const sumHrs = (arr) => arr.reduce((acc, r) => acc + (r.hoursPhysical || 0), 0)
  const sumCost = (arr, field = 'costUsd') => arr.reduce((acc, r) => acc + (r[field] || 0), 0)

  return [
    ...buildRubroKpiCards(validRows, HORAS_RUBRO_KPIS, (rows) => ({
      count: `${sumHrs(rows).toFixed(1)} hs`,
      subtext: `${formatUsd(sumCost(rows, 'costUsd'), 0)} · ${rows.length} partes`
    })),
    { id: 'PENDING_R', label: 'Pendientes Revisión ("R")', count: formatUsd(sumCost(pendingR, 'pendingRUsd'), 0), subtext: `${sumHrs(pendingR).toFixed(1)} hs en revisión`, colorTheme: 'amber' },
    { id: 'SIN_OT', label: 'Sin OT Asignada', count: missingOt.length, subtext: 'Partes pendientes de vincular OT', colorTheme: 'rose' },
    { id: 'DEC_013', label: 'Horas Presupuesto ($0)', count: `${sumHrs(budgetDec013).toFixed(1)} hs`, subtext: `${budgetDec013.length} partes · Costo US$ 0 (en Terceros)`, colorTheme: 'purple' }
  ]
}

export function filterResumenLaborRows(scopedBaseRows = [], filters = {}) {
  const { kpiFilter = 'ALL', costScope = 'GENERAL', otFilter = 'ALL', workerFilter = 'ALL', rubroFilter = 'ALL', searchQuery = '' } = filters
  return scopedBaseRows.filter((row) => {
    if (!row || row.isControl || String(row.workType || '').trim().toUpperCase() === 'CONTROL') return false
    if (kpiFilter === 'APPROVED' && (row.isPendingR || row.isPresupuesto)) return false
    if (kpiFilter === 'PENDING_R' && !(row.isPendingR && !row.isCorrectedRR && !row.isPresupuesto)) return false
    if (kpiFilter === 'SIN_OT' && !row.hasMissingOt) return false
    if (kpiFilter === 'DEC_013' && !row.isPresupuesto) return false
    if (String(kpiFilter || '').startsWith('RUBRO_') && !matchesResumenRubroKpi(row.rubro, kpiFilter)) return false
    if (['GRUA_GRANDE', 'GRUA_CHICA', 'PALA'].includes(kpiFilter) && row.equipmentType !== kpiFilter) return false
    if (!matchesOtFilter(row, costScope, otFilter)) return false
    if (workerFilter !== 'ALL' && String(row.workerName || '').trim() !== workerFilter) return false
    if (rubroFilter !== 'ALL' && String(row.rubro || '').trim() !== rubroFilter) return false
    if (searchQuery && !matchesUniversalSearch(row, searchQuery)) return false
    return true
  }).sort(compareResumenRowsByWorkOrder)
}

export function computeTercerosKpis(scopedBaseRows = []) {
  const missingOt = scopedBaseRows.filter((r) => r.hasMissingOt)
  const zeroCost = scopedBaseRows.filter((r) => r.hasZeroCost)
  const sumUsd = (arr) => arr.reduce((acc, item) => acc + (item.amountUsd || 0), 0)

  return [
    ...buildRubroKpiCards(scopedBaseRows, TERCEROS_RUBRO_KPIS, (rows) => ({
      count: formatUsd(sumUsd(rows), 0),
      subtext: `${rows.length} comprobantes`
    })),
    { id: 'SIN_OT', label: 'Falta Cargar OT', count: missingOt.length, subtext: 'Servicios sin OT asignada', colorTheme: 'rose' },
    { id: 'SIN_COSTO', label: 'Sin Costo ($0)', count: zeroCost.length, subtext: 'Pendientes de cotización', colorTheme: 'amber' }
  ]
}

export function filterResumenThirdPartyRows(scopedBaseRows = [], filters = {}) {
  const { kpiFilter = 'ALL', costScope = 'GENERAL', otFilter = 'ALL', contractorFilter = 'ALL', voucherFilter = 'ALL', searchQuery = '' } = filters
  return scopedBaseRows.filter((row) => {
    if (kpiFilter === 'SIN_OT' && !row.hasMissingOt) return false
    if (kpiFilter === 'SIN_COSTO' && !row.hasZeroCost) return false
    if (String(kpiFilter || '').startsWith('RUBRO_') && !matchesResumenRubroKpi(row.rubro, kpiFilter)) return false
    if (!matchesOtFilter(row, costScope, otFilter)) return false
    if (contractorFilter !== 'ALL' && String(row.contractorName || '').trim() !== contractorFilter) return false
    if (voucherFilter !== 'ALL' && row.voucherType !== voucherFilter) return false
    if (searchQuery && !matchesUniversalSearch(row, searchQuery)) return false
    return true
  }).sort(compareResumenRowsByWorkOrder)
}
