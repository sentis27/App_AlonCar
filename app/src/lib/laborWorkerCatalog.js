// ==============================================================================
// CATÁLOGO DE OPERARIOS Y LÓGICA PAÑOL PARA CARGA DE HORAS (M3)
// Reutiliza allocationEngine.js ([H] can_impute_hours) y tradesCatalog.js.
// ==============================================================================

import { filterEligiblePersonnel, normalizeText } from './allocationEngine.js'
import { parseWorkerTrades } from './tradesCatalog.js'
import { NOMINA_ASTILLERO_BASE, CONTRATISTAS_FRECUENTES, TALLERES_FRECUENTES } from './laborConstants.js'

function mergeTradeList(existing = [], extra = []) {
  const seen = new Set()
  const out = []
  for (const label of [...existing, ...extra]) {
    const key = normalizeText(label)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(label)
  }
  return out
}

function upsertExternalEntry(map, item, defaultLabel) {
  const key = normalizeText(item.name)
  if (!key) return
  const tInfo = parseWorkerTrades(item.trade || defaultLabel)
  const prev = map.get(key)
  if (!prev) {
    map.set(key, {
      id: item.id || item.name,
      name: item.name.trim(),
      workerType: item.workerType,
      adminCenter: item.adminCenter,
      workGroup: item.workGroup,
      defaultRubro: tInfo.primaryLabel,
      allowedTrades: tInfo.labelList
    })
  } else {
    prev.allowedTrades = mergeTradeList(prev.allowedTrades, tInfo.labelList)
  }
}

/**
 * Construye el padrón activo con permiso de Horas ([H] can_impute_hours),
 * deduplicando operarios multi-oficio e indexando contratistas y talleres.
 */
export function buildLaborEligibleCatalog(dbWorkers = []) {
  const hasDb = Array.isArray(dbWorkers) && dbWorkers.length > 0
  const eligible = filterEligiblePersonnel(dbWorkers, { permissionField: 'can_impute_hours' })

  const astilleroMap = new Map()
  const rawAstillero = hasDb
    ? eligible.astilleroWorkers
    : NOMINA_ASTILLERO_BASE.map((w) => ({ id: w.name, name: w.name, trade: w.defaultRubro, admin_center: 'ASTILLERO' }))

  for (const w of rawAstillero) {
    const key = normalizeText(w.name)
    if (!key) continue
    const tInfo = parseWorkerTrades(w.trade || 'General')
    const prev = astilleroMap.get(key)
    if (!prev) {
      astilleroMap.set(key, {
        id: w.id || w.name,
        name: w.name.trim(),
        workerType: 'Astillero',
        adminCenter: 'ASTILLERO',
        workGroup: 'ASTILLERO',
        defaultRubro: tInfo.primaryLabel,
        allowedTrades: tInfo.labelList
      })
    } else {
      prev.allowedTrades = mergeTradeList(prev.allowedTrades, tInfo.labelList)
    }
  }

  const astilleroWorkers = Array.from(astilleroMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  const tallerGroupSet = new Set(hasDb ? [] : TALLERES_FRECUENTES.map((t) => t.trim().toUpperCase()))
  const contractorGroupSet = new Set(eligible.contractorGroups || [])
  const externalMap = new Map()

  if (hasDb) {
    for (const w of dbWorkers) {
      if (w.status === 'INACTIVO' || !w.can_impute_hours) continue
      if (w.admin_center !== 'CONTRATISTA' && w.admin_center !== 'TALLER') continue
      const groupName = (w.work_group || w.name || '').trim().toUpperCase()
      const isTaller = w.admin_center === 'TALLER' || TALLERES_FRECUENTES.includes(groupName)
      if (groupName) {
        if (isTaller) tallerGroupSet.add(groupName)
        contractorGroupSet.add(groupName)
      }
      upsertExternalEntry(
        externalMap,
        { id: w.id, name: w.name, trade: w.trade, workerType: isTaller ? 'Taller' : 'Contratista', adminCenter: w.admin_center, workGroup: groupName },
        isTaller ? 'Tornería' : 'Servicio Contratista'
      )
    }
  } else {
    CONTRATISTAS_FRECUENTES.forEach((c) => contractorGroupSet.add(c.trim().toUpperCase()))
  }

  const allGroupNames = Array.from(contractorGroupSet).sort()
  const externalWorkers = Array.from(externalMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  const byNameMap = new Map()
  astilleroWorkers.forEach((w) => byNameMap.set(normalizeText(w.name), w))
  externalWorkers.forEach((w) => {
    const key = normalizeText(w.name)
    if (!byNameMap.has(key)) byNameMap.set(key, w)
  })
  allGroupNames.forEach((grp) => {
    const key = normalizeText(grp)
    if (byNameMap.has(key)) return
    const firstMember = externalWorkers.find((w) => normalizeText(w.workGroup) === key)
    const isTaller = tallerGroupSet.has(grp) || TALLERES_FRECUENTES.includes(grp)
    byNameMap.set(key, {
      id: grp,
      name: grp,
      workerType: isTaller ? 'Taller' : 'Contratista',
      adminCenter: isTaller ? 'TALLER' : 'CONTRATISTA',
      workGroup: grp,
      defaultRubro: firstMember?.defaultRubro || (isTaller ? 'Tornería' : 'Servicio Contratista'),
      allowedTrades: firstMember?.allowedTrades || [isTaller ? 'Tornería' : 'Servicio Contratista']
    })
  })

  return {
    astilleroWorkers,
    contractorGroups: allGroupNames,
    tallerGroupSet,
    externalWorkers,
    byNameMap,
    rawEligible: {
      ...eligible,
      astilleroWorkers: astilleroWorkers.map((w) => ({ id: w.id, name: w.name, trade: w.defaultRubro, admin_center: 'ASTILLERO' }))
    },
    unauthorizedWorkers: eligible.unauthorizedWorkers || []
  }
}

/**
 * Calcula grupos/contratistas para cabecera (habilitados en barco u opción expandir).
 */
export function getEnabledContractorsForShipWithExpand(
  selectedShipId,
  activeWorkItemsForShip = [],
  dbWorkers = [],
  { isExpanded = false, eligibleCatalog = null } = {}
) {
  if (!selectedShipId) return []
  const set = new Set()
  activeWorkItemsForShip.forEach((item) => {
    const list = item.contractors || []
    if (list.length === 0) set.add('ASTILLERO.GENERAL')
    else list.forEach((c) => { if (c) set.add(c) })
  })

  const catalog = eligibleCatalog || buildLaborEligibleCatalog(dbWorkers)
  if (set.size === 0 || isExpanded) {
    set.add('ASTILLERO.GENERAL')
    catalog.contractorGroups.forEach((grp) => set.add(grp))
  }
  return Array.from(set).sort()
}

/**
 * Resuelve datos completos de fila al confirmar un operario o contratista del padrón.
 */
export function resolveSelectedWorkerForRow(row, workerName, catalog) {
  const cleanName = String(workerName || '').trim()
  const entry = catalog?.byNameMap?.get(normalizeText(cleanName))
  if (!entry) return { ...row, worker_name: workerName }

  const prevDefault = normalizeText(row.default_rubro)
  const currRubro = normalizeText(row.rubro)
  const keepLoaned = Boolean(row.is_loaned_rubro && currRubro && currRubro !== prevDefault)
  const nextRubro = keepLoaned ? row.rubro : entry.defaultRubro
  const isFeriado = normalizeText(nextRubro).includes('FERIADO')

  return {
    ...row,
    worker_name: entry.name,
    worker_type: entry.workerType,
    default_rubro: entry.defaultRubro,
    allowed_trades: entry.allowedTrades,
    rubro: nextRubro,
    is_loaned_rubro: keepLoaned,
    hours_normal: entry.workerType === 'Astillero' ? (isFeriado ? 8 : 9) : 8,
    homonym_candidates: [],
    worker_match_status: 'exact'
  }
}

/**
 * Construye la nómina tipificada { name, type } esperada por LaborSabanaPanel.jsx.
 */
export function buildQuincenaWorkersList(dbWorkers = [], recentLogs = []) {
  const catalog = buildLaborEligibleCatalog(dbWorkers)
  const map = new Map()
  catalog.astilleroWorkers.forEach((w) => map.set(normalizeText(w.name), { name: w.name, type: 'Astillero' }))
  catalog.externalWorkers.forEach((w) => {
    const key = normalizeText(w.name)
    if (!map.has(key)) map.set(key, { name: w.name, type: w.workerType })
  })
  recentLogs.forEach((l) => {
    const key = normalizeText(l.worker_name)
    if (!key || map.has(key)) return
    map.set(key, { name: l.worker_name.trim(), type: l.worker_type || 'Astillero' })
  })
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
}
