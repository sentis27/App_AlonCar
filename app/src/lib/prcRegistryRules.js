/**
 * prcRegistryRules.js
 * Capa 2 (SKL-019): Motor único de reglas puras, enriquecimiento y filtrado para `contractor_prc_registry`.
 */
import { formatDateAr } from './dateTimeCanonical.js'
import { matchesUniversalSearch } from './searchEngine.js'

export function formatPrcNumberLabel(prcNumber) {
  const num = Number(prcNumber)
  if (!Number.isFinite(num) || num <= 0) return '—'
  return `PRC #${Math.trunc(num)}`
}

export function formatPrcAdditionalLabel(prc) {
  const parentNum = Number(prc?.parent_prc_number)
  if (!Number.isFinite(parentNum) || parentNum <= 0) return ''
  return `Adicional al PRC #${Math.trunc(parentNum)}`
}

export function isEligibleContractorForPrc(worker) {
  if (!worker) {
    return { eligible: false, reason: 'Seleccioná un contratista habilitado.' }
  }
  const center = String(worker.admin_center || '').trim().toUpperCase()
  if (center === 'ASTILLERO') {
    return {
      eligible: false,
      reason: 'Los PRC aplican solo a contratistas externos dentro del astillero, no a personal propio (ASTILLERO).',
    }
  }
  return { eligible: true, reason: '' }
}

export function resolveLatestDollarRate(macroVariables = []) {
  if (!Array.isArray(macroVariables) || macroVariables.length === 0) return 0
  const sorted = [...macroVariables].sort((a, b) => {
    const ya = Number(a?.year) || 0
    const yb = Number(b?.year) || 0
    if (yb !== ya) return yb - ya
    return (Number(b?.month) || 0) - (Number(a?.month) || 0)
  })
  for (const row of sorted) {
    const rate = Number(row?.dollar_rate_2q) || Number(row?.dollar_rate_1q) || Number(row?.dollar_rate) || 0
    if (rate > 0) return rate
  }
  return 0
}

export function getEligiblePrcContractors(workers = []) {
  const byGroup = new Map()
  for (const w of workers || []) {
    if (!w) continue
    if (String(w.status || 'ACTIVO').toUpperCase() !== 'ACTIVO') continue
    if (!isEligibleContractorForPrc(w).eligible) continue
    const groupKey = String(w.work_group || w.name || '').trim()
    if (!groupKey) continue
    if (!byGroup.has(groupKey.toUpperCase())) {
      byGroup.set(groupKey.toUpperCase(), {
        id: w.id,
        name: groupKey,
        workerName: w.name,
        trade: w.trade || '',
        admin_center: w.admin_center || 'CONTRATISTA',
      })
    }
  }
  return [...byGroup.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export function enrichPrcRegistryRows(prcs = [], { ships = [], workOrders = [] } = {}) {
  const shipMap = new Map((ships || []).map((s) => [s.id, s]))
  const woMap = new Map((workOrders || []).map((wo) => [wo.id, wo]))
  const prcById = new Map((prcs || []).map((p) => [p.id, p]))
  const additionalsByParent = new Map()

  for (const row of prcs || []) {
    if (!row?.parent_prc_id) continue
    if (!additionalsByParent.has(row.parent_prc_id)) additionalsByParent.set(row.parent_prc_id, [])
    additionalsByParent.get(row.parent_prc_id).push(Number(row.prc_number))
  }
  for (const list of additionalsByParent.values()) {
    list.sort((a, b) => a - b)
  }

  return (prcs || []).map((row) => {
    const ship = row.ship_id ? shipMap.get(row.ship_id) : null
    const wo = row.work_order_id ? woMap.get(row.work_order_id) : null
    const parent = row.parent_prc_id ? prcById.get(row.parent_prc_id) : null
    const resolvedParentNumber = row.parent_prc_number ?? parent?.prc_number ?? null
    const additionalsNumbers = additionalsByParent.get(row.id) || []
    const shipName = ship?.name || (wo?.ship_id ? shipMap.get(wo.ship_id)?.name : null) || 'Sin Buque'
    const otLabel = wo ? `${wo.ot_number ? `OT-${wo.ot_number}` : ''} ${wo.title || ''}`.trim() : 'Sin OT'
    const parentLabel = formatPrcAdditionalLabel({ parent_prc_number: resolvedParentNumber })
    return {
      ...row,
      parent_prc_number: resolvedParentNumber,
      shipName,
      otLabel,
      parentLabel,
      additionalsNumbers,
      additionalsCount: additionalsNumbers.length,
      isAnnulled: row.status === 'ANULADO',
    }
  })
}

export function filterPrcRegistryRows(
  rows = [],
  { searchTerm = '', statusFilter = 'todos', contractorFilter = 'todos', shipFilter = 'todos' } = {}
) {
  return (rows || []).filter((row) => {
    if (statusFilter && statusFilter !== 'todos' && row.status !== statusFilter) return false
    if (contractorFilter && contractorFilter !== 'todos' && row.contractor_name !== contractorFilter) return false
    if (shipFilter && shipFilter !== 'todos' && row.ship_id !== shipFilter) return false
    if (!searchTerm) return true
    return matchesUniversalSearch(
      {
        ...row,
        prc_label: formatPrcNumberLabel(row.prc_number),
        issue_date_ar: formatDateAr(row.issue_date),
      },
      searchTerm
    )
  })
}

export const PRC_REGISTRY_SHEET_COLUMNS = [
  { key: 'prc_number', label: 'Nº PRC', isNumeric: true, formatType: 'integer', getValue: (r) => Number(r.prc_number || 0) },
  { key: 'issue_date', label: 'Fecha', type: 'date', getValue: (r) => formatDateAr(r.issue_date) },
  { key: 'contractor_name', label: 'Contratista', isNumeric: false },
  { key: 'shipName', label: 'Barco', isNumeric: false },
  { key: 'otLabel', label: 'Orden de Trabajo', isNumeric: false },
  { key: 'description', label: 'Descripción', isNumeric: false },
  { key: 'amount_ars', label: 'Importe AR$', isNumeric: true, formatType: 'ars', getValue: (r) => Number(r.amount_ars || 0) },
  { key: 'amount_usd', label: 'Importe US$', isNumeric: true, formatType: 'usd', getValue: (r) => Number(r.amount_usd || 0) },
  { key: 'parentLabel', label: 'Vínculo', isNumeric: false, getValue: (r) => r.parentLabel || (r.additionalsCount ? `${r.additionalsCount} adic.` : '') },
  { key: 'status', label: 'Estado', isNumeric: false },
  { key: 'observations', label: 'Observaciones', isNumeric: false },
]

export function parsePrcInteger(raw) {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 2000) return raw
  const match = String(raw).trim().match(/(\d{4,})/)
  if (!match) return null
  const num = Number(match[1])
  return Number.isInteger(num) && num >= 2000 ? num : null
}

function pushMapItem(map, key, val) {
  if (!key) return
  if (!map.has(key)) map.set(key, [])
  map.get(key).push(val)
}

function sortPrcPriority(list = []) {
  return [...list].sort((a, b) => {
    const annA = a.status === 'ANULADO' ? 1 : 0
    const annB = b.status === 'ANULADO' ? 1 : 0
    if (annA !== annB) return annA - annB
    return (Number(b.prc_number) || 0) - (Number(a.prc_number) || 0)
  })
}

export function buildPrcLookupMaps(prcs = []) {
  const byId = new Map()
  const byNumber = new Map()
  const byWorkItemId = new Map()
  const byThirdPartyServiceId = new Map()
  const additionalsByParentId = new Map()

  for (const row of prcs || []) {
    if (!row?.id) continue
    byId.set(row.id, row)
    if (Number.isFinite(Number(row.prc_number))) byNumber.set(Number(row.prc_number), row)
    pushMapItem(byWorkItemId, row.work_item_id, row)
    pushMapItem(byThirdPartyServiceId, row.third_party_service_id, row)
    pushMapItem(additionalsByParentId, row.parent_prc_id, row)
  }

  for (const [k, list] of byWorkItemId.entries()) byWorkItemId.set(k, sortPrcPriority(list))
  for (const [k, list] of byThirdPartyServiceId.entries()) byThirdPartyServiceId.set(k, sortPrcPriority(list))
  for (const [k, list] of additionalsByParentId.entries()) {
    additionalsByParentId.set(k, [...list].sort((a, b) => (Number(a.prc_number) || 0) - (Number(b.prc_number) || 0)))
  }

  return { byId, byNumber, byWorkItemId, byThirdPartyServiceId, additionalsByParentId }
}

function wrapPrcMatch(matched, prcMaps) {
  const additionals = matched && prcMaps?.additionalsByParentId ? (prcMaps.additionalsByParentId.get(matched.id) || []) : []
  return { prc: matched || null, additionals, hasOfficialPrc: Boolean(matched) }
}

export function resolvePrcForWorkItem(row, prcMaps) {
  if (!row || !prcMaps) return wrapPrcMatch(null, null)
  const tp = row.thirdPartyRecord
  const byWi = !row.isPlaceholder && row.id ? prcMaps.byWorkItemId?.get(row.id)?.[0] : null
  const byTp = tp?.id ? prcMaps.byThirdPartyServiceId?.get(tp.id)?.[0] : null
  const num = parsePrcInteger(tp?.budget_number || tp?.voucher_number)
  const byNum = num ? prcMaps.byNumber?.get(num) : null
  return wrapPrcMatch(byWi || byTp || byNum || null, prcMaps)
}

export function resolvePrcForThirdPartyService(srv, prcMaps) {
  if (!srv || !prcMaps) return wrapPrcMatch(null, null)
  const byTp = srv.id ? prcMaps.byThirdPartyServiceId?.get(srv.id)?.[0] : null
  const byWi = srv.work_item_id ? prcMaps.byWorkItemId?.get(srv.work_item_id)?.[0] : null
  const num = parsePrcInteger(srv.budget_number || srv.voucher_number)
  const byNum = num ? prcMaps.byNumber?.get(num) : null
  return wrapPrcMatch(byTp || byWi || byNum || null, prcMaps)
}

export function evaluateWorkItemPrcEligibility(row, workers = []) {
  const raw = Array.isArray(row?.contractors) && row.contractors.length > 0
    ? row.contractors
    : (row?.contractor_name ? String(row.contractor_name).split(',').map((s) => s.trim()).filter(Boolean) : [])

  const matchWorker = (name) => {
    const key = String(name || '').trim().toUpperCase()
    const hits = (workers || []).filter(
      (w) => String(w?.work_group || '').trim().toUpperCase() === key || String(w?.name || '').trim().toUpperCase() === key
    )
    return hits.find((w) => String(w.status || 'ACTIVO').toUpperCase() === 'ACTIVO') || hits[0] || null
  }

  for (const cName of raw) {
    const upper = String(cName || '').trim().toUpperCase()
    if (!upper || upper === 'ASTILLERO' || upper.startsWith('ASTILLERO.')) continue
    const w = matchWorker(cName)
    if (w && String(w.admin_center || '').trim().toUpperCase() === 'ASTILLERO') continue
    return { eligible: true, isOwnStaffOnly: false, contractorName: cName, contractorWorkerId: w?.id || null, reason: '' }
  }

  return {
    eligible: false,
    isOwnStaffOnly: raw.length > 0,
    contractorName: '',
    contractorWorkerId: null,
    reason: 'Los PRC aplican solo a contratistas externos trabajando dentro del astillero (no personal ASTILLERO).',
  }
}
