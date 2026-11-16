// ==============================================================================
// CONSTRUCTOR DE OPCIONES DE FILA (OPERARIO + RUBRO) PARA CUADRILLA DE HORAS
// Implementa paridad con Pañol: Habilitados en Barco/OT + Expandir Padrón [H].
// ==============================================================================

import { getEnabledWorkersAndContractors, normalizeText } from './allocationEngine.js'
import { OFFICIAL_RUBROS_CATALOG } from './tradesCatalog.js'
import { RUBROS_SUGERIDOS } from './laborConstants.js'

const FERIADO_LABEL = 'Feriado (Hs Normales 8h)'

function doesAstilleroMatchSpecialty(worker, upperGroup) {
  if (!upperGroup.includes('.')) return false
  const tradeKey = upperGroup.split('.')[1]
  if (!tradeKey || tradeKey === 'GENERAL') return false
  const target = tradeKey === 'RASCHINAJE' ? 'RASCHIN' : tradeKey
  const allTradesNorm = normalizeText([worker.defaultRubro, ...(worker.allowedTrades || [])].join(' '))
  return allTradesNorm.includes(normalizeText(target))
}

function buildWorkerOption(entry, { sectionKey, sectionLabel, sinOtEnBarco = false, subtitle = '' }) {
  return {
    value: entry.name,
    label: entry.name,
    sectionKey,
    sectionLabel,
    badgeText: entry.defaultRubro || 'General',
    badgeTone: entry.workerType === 'Astillero' ? 'cyan' : entry.workerType === 'Taller' ? 'purple' : 'amber',
    metaText: subtitle || entry.workerType,
    sinOtEnBarco,
    searchKeywords: `${entry.name} ${entry.workGroup || ''} ${entry.defaultRubro || ''} ${(entry.allowedTrades || []).join(' ')}`
  }
}

/**
 * Construye las opciones del selector de Operario/Prestador con la lógica de Pañol:
 * Habilitados en Barco/OT por defecto + 🔓 Expandir al padrón completo [H].
 */
export function getRowWorkerPickerState({
  catalog,
  shipId = '',
  workOrderId = '',
  selectedContractorGroup = '',
  isMultiOtMode = false,
  isExpanded = false,
  workOrders = [],
  workItems = []
}) {
  if (!catalog) {
    return { options: [], enabledCount: 0, expandedCount: 0, hasShipRestriction: false, isEmptyStrict: false }
  }

  const shipEnabled = shipId
    ? getEnabledWorkersAndContractors(shipId, null, workItems, catalog.rawEligible, { workOrders, strictShipFilter: true })
    : { astilleroWorkers: catalog.astilleroWorkers, contractorGroups: catalog.contractorGroups }

  const shipAstSet = new Set((shipEnabled.astilleroWorkers || []).map((w) => normalizeText(w.name)))
  const shipCntSet = new Set((shipEnabled.contractorGroups || []).map((g) => normalizeText(g)))

  const scopeWoId = isMultiOtMode && workOrderId ? workOrderId : null
  const activeScope = !shipId || isExpanded
    ? { astilleroWorkers: catalog.astilleroWorkers, contractorGroups: catalog.contractorGroups }
    : scopeWoId
    ? getEnabledWorkersAndContractors(shipId, scopeWoId, workItems, catalog.rawEligible, { workOrders, strictShipFilter: true })
    : shipEnabled

  const scopeAstSet = new Set((activeScope.astilleroWorkers || []).map((w) => normalizeText(w.name)))
  const scopeCntSet = new Set((activeScope.contractorGroups || []).map((g) => normalizeText(g)))

  const visibleAst = catalog.astilleroWorkers.filter((w) => isExpanded || scopeAstSet.has(normalizeText(w.name)))
  const visibleGroups = catalog.contractorGroups.filter((g) => isExpanded || scopeCntSet.has(normalizeText(g)))
  const visibleGroupSet = new Set(visibleGroups.map((g) => normalizeText(g)))

  const upperGroup = String(selectedContractorGroup || '').toUpperCase()
  const isHeaderAstillero = !upperGroup || upperGroup.startsWith('ASTILLERO')
  const headerGroupNorm = normalizeText(selectedContractorGroup)

  const options = []
  const appendExternalSection = (groups, sectionKey, sectionLabel) => {
    for (const grp of groups) {
      const grpNorm = normalizeText(grp)
      const sinOt = Boolean(shipId && !shipCntSet.has(grpNorm))
      const grpEntry = catalog.byNameMap.get(grpNorm)
      if (grpEntry) {
        options.push(
          buildWorkerOption(grpEntry, { sectionKey, sectionLabel, sinOtEnBarco: sinOt, subtitle: `${grpEntry.workerType} · Grupo` })
        )
      }
      const members = catalog.externalWorkers.filter(
        (m) => normalizeText(m.workGroup) === grpNorm && normalizeText(m.name) !== grpNorm
      )
      for (const m of members) {
        options.push(buildWorkerOption(m, { sectionKey, sectionLabel, sinOtEnBarco: sinOt, subtitle: grp }))
      }
    }
  }

  if (!isHeaderAstillero && visibleGroupSet.has(headerGroupNorm)) {
    const matchedGroup = visibleGroups.find((g) => normalizeText(g) === headerGroupNorm)
    if (matchedGroup) {
      appendExternalSection([matchedGroup], 'selected_cnt', `🏗️ ${matchedGroup} (Grupo Seleccionado)`)
    }
  }

  const primaryAst = []
  const secondaryAst = []
  for (const w of visibleAst) {
    const isTitular = isHeaderAstillero && doesAstilleroMatchSpecialty(w, upperGroup)
    const sinOt = Boolean(shipId && !shipAstSet.has(normalizeText(w.name)))
    ;(isTitular ? primaryAst : secondaryAst).push({ w, sinOt })
  }

  if (primaryAst.length > 0) {
    const lbl = `⭐ Titulares de ${selectedContractorGroup} (${primaryAst.length})`
    primaryAst.forEach(({ w, sinOt }) => options.push(buildWorkerOption(w, { sectionKey: 'ast_tit', sectionLabel: lbl, sinOtEnBarco: sinOt })))
  }
  if (secondaryAst.length > 0) {
    const lbl = primaryAst.length > 0
      ? `🔄 Resto Astillero Habilitado (${secondaryAst.length})`
      : isExpanded
      ? `⭐ Personal Astillero Completo (${secondaryAst.length})`
      : `⭐ Personal Astillero Habilitado (${secondaryAst.length})`
    secondaryAst.forEach(({ w, sinOt }) => options.push(buildWorkerOption(w, { sectionKey: 'ast_all', sectionLabel: lbl, sinOtEnBarco: sinOt })))
  }

  const otherGroups = !isHeaderAstillero ? visibleGroups.filter((g) => normalizeText(g) !== headerGroupNorm) : visibleGroups
  if (otherGroups.length > 0) {
    const cntLabel = isExpanded
      ? `🏗️ Todos los Contratistas y Talleres (${otherGroups.length})`
      : `🏗️ Contratistas Habilitados en Barco (${otherGroups.length})`
    appendExternalSection(otherGroups, 'cnt_all', cntLabel)
  }

  return {
    options,
    enabledCount: (shipEnabled.astilleroWorkers?.length || 0) + (shipEnabled.contractorGroups?.length || 0),
    expandedCount: catalog.astilleroWorkers.length + catalog.contractorGroups.length,
    hasShipRestriction: Boolean(shipId),
    isEmptyStrict: Boolean(shipId && !isExpanded && options.length === 0)
  }
}

/**
 * Construye opciones filtrables de Rubro para la fila (Titular vs Puerta Emergencia 🔓).
 */
export function buildCrewRubroOptions(row, isRowEmergencyOpen = false) {
  const titularNorm = normalizeText(row?.default_rubro)
  const allowed = Array.isArray(row?.allowed_trades) ? row.allowed_trades.filter(Boolean) : []
  const hasRestricted = !isRowEmergencyOpen && titularNorm && titularNorm !== 'GENERAL' && allowed.length > 0

  if (hasRestricted) {
    const out = []
    const seen = new Set()
    for (const label of allowed) {
      const k = normalizeText(label)
      if (!k || seen.has(k)) continue
      seen.add(k)
      const isTit = k === titularNorm
      out.push({
        value: label,
        label,
        sectionKey: 'allowed',
        sectionLabel: '⭐ Rubros del Operario (🔓 amplía)',
        badgeText: isTit ? 'Titular' : 'Habilitado',
        badgeTone: isTit ? 'cyan' : 'amber',
        searchKeywords: label
      })
    }
    if (!seen.has('FERIADO')) {
      out.push({ value: FERIADO_LABEL, label: FERIADO_LABEL, sectionKey: 'allowed', sectionLabel: '⭐ Rubros del Operario (🔓 amplía)', badgeText: '8h', badgeTone: 'purple', searchKeywords: 'feriado 8h' })
    }
    return out
  }

  const seen = new Set()
  const out = []
  const addRubro = (label, sectionKey, sectionLabel, badgeText = '', badgeTone = 'slate') => {
    const key = normalizeText(label)
    if (!key || seen.has(key)) return
    seen.add(key)
    const isTit = Boolean(titularNorm && key === titularNorm)
    out.push({
      value: label,
      label,
      sectionKey,
      sectionLabel,
      badgeText: isTit ? '⭐ Titular' : badgeText,
      badgeTone: isTit ? 'cyan' : badgeTone,
      searchKeywords: label
    })
  }

  if (row?.default_rubro) addRubro(row.default_rubro, 'titular', '⭐ Rubro Titular', 'Titular', 'cyan')
  OFFICIAL_RUBROS_CATALOG.forEach((cat) => addRubro(cat.label, 'oficial', '📋 Catálogo Oficial de Rubros'))
  RUBROS_SUGERIDOS.forEach((r) => addRubro(r, 'sugerido', '🕒 Adicionales y Feriados', r.toLowerCase().includes('feriado') ? '8h' : '', 'purple'))
  return out
}
