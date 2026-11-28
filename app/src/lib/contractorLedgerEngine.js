/**
 * contractorLedgerEngine.js
 * Motor puro del Libro de Cuenta Corriente por Contratista/Taller y Pestañas por Barco
 * (`3. Contratados` · `/tesoreria?tab=contratados`).
 * Signo contable fiel a la planilla del astillero: `saldo = saldo_ant + pagado - devengado`.
 */
import { compareIsoDatesAsc, formatDateAr } from './dateTimeCanonical.js'
import { matchesUniversalSearch } from './searchEngine.js'
import { GENERAL_SHIP_TAB_ID, RESUMEN_TAB_ID } from './contractorLedgerHelpers.js'
import { buildContractorLedgerRows, buildWorkshopLedgerRows } from './contractorLedgerSources.js'

const round2 = (n) => Number((Number(n) || 0).toFixed(2))

function compareLedgerRowsChronological(a, b) {
  const dateCmp = compareIsoDatesAsc(a.entryDate || '', b.entryDate || '')
  if (dateCmp !== 0) return dateCmp
  const aAcc = a.accruedAmount > 0 ? 0 : 1
  const bAcc = b.accruedAmount > 0 ? 0 : 1
  if (aAcc !== bAcc) return aAcc - bAcc
  const aAdd = a.isAdditional ? 1 : 0
  const bAdd = b.isAdditional ? 1 : 0
  if (aAdd !== bAdd) return aAdd - bAdd
  if ((a.prcNumber || 0) !== (b.prcNumber || 0)) return (a.prcNumber || 0) - (b.prcNumber || 0)
  return String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || String(a.concept || '').localeCompare(String(b.concept || ''), 'es')
}

export function computeBookKpis(rows = [], shipTabs = []) {
  let totalAccrued = 0
  let totalPaidDirect = 0
  let totalPanolAndExpenses = 0
  let debeFacturaCount = 0
  for (const r of rows || []) {
    totalAccrued += Number(r.accruedAmount || 0)
    if (r.isPanolOrExpense) totalPanolAndExpenses += Number(r.paidAmount || 0)
    else totalPaidDirect += Number(r.paidAmount || 0)
    if (r.invoiceStatus === 'DEBE_FACTURA') debeFacturaCount += 1
  }
  const openShipsCount = (shipTabs || []).filter((t) => !t.isSettled && t.rowCount > 0).length
  const settledShipsCount = (shipTabs || []).filter((t) => t.isSettled).length
  return {
    totalAccrued: round2(totalAccrued),
    totalPaidDirect: round2(totalPaidDirect),
    totalPanolAndExpenses: round2(totalPanolAndExpenses),
    totalPaidAll: round2(totalPaidDirect + totalPanolAndExpenses),
    currentBalance: round2(totalPaidDirect + totalPanolAndExpenses - totalAccrued),
    debeFacturaCount,
    openShipsCount,
    settledShipsCount,
  }
}

export function buildContractorBook({
  entity = null, movements = [], prcs = [], laborLogs = [], rateCards = [],
  closures = [], workers = [], ships = [], workOrders = [], thirdPartyCcData = null,
  manualShipIds = [], resumenSortMode = 'grouped',
} = {}) {
  if (!entity) {
    return { shipTabs: [], resumenRows: [], rowsByTab: { [RESUMEN_TAB_ID]: [] }, globalKpis: computeBookKpis([], []) }
  }
  const shipMap = new Map((ships || []).map((s) => [s.id, s]))
  const woMap = new Map((workOrders || []).map((w) => [w.id, w]))
  const rawRows = entity.entityType === 'WORKSHOP_CC'
    ? buildWorkshopLedgerRows({ entity, thirdPartyCcData, shipMap, woMap })
    : buildContractorLedgerRows({ entity, movements, prcs, laborLogs, rateCards, closures, workers, shipMap, woMap })

  const byShipKey = new Map()
  for (const sid of manualShipIds || []) {
    if (sid && !byShipKey.has(sid)) byShipKey.set(sid, [])
  }
  for (const row of rawRows) {
    const key = row.shipId || GENERAL_SHIP_TAB_ID
    if (!byShipKey.has(key)) byShipKey.set(key, [])
    byShipKey.get(key).push(row)
  }

  const rowsByTab = {}
  const shipTabs = []
  const shipBlocks = []

  for (const [tabId, list] of byShipKey.entries()) {
    const sorted = [...list].sort(compareLedgerRowsChronological)
    let running = 0
    let totalAccrued = 0
    let totalPaid = 0
    let debeFacturaCount = 0
    const withBalance = sorted.map((r) => {
      running = round2(running + (r.paidAmount || 0) - (r.accruedAmount || 0))
      totalAccrued = round2(totalAccrued + (r.accruedAmount || 0))
      totalPaid = round2(totalPaid + (r.paidAmount || 0))
      if (r.invoiceStatus === 'DEBE_FACTURA') debeFacturaCount += 1
      return { ...r, tabId, shipRunningBalance: running }
    })
    const shipRec = tabId === GENERAL_SHIP_TAB_ID ? null : shipMap.get(tabId) || null
    const label = tabId === GENERAL_SHIP_TAB_ID ? 'GENERAL' : (shipRec?.name || withBalance[0]?.shipName || 'BARCO')
    const isSettled = withBalance.length > 0 && Math.abs(running) <= 0.01
    rowsByTab[tabId] = withBalance
    shipTabs.push({
      tabId, shipId: tabId === GENERAL_SHIP_TAB_ID ? null : tabId, label,
      rowCount: withBalance.length, totalAccrued, totalPaid, balance: running, isSettled,
      debeFacturaCount, firstDate: withBalance[0]?.entryDate || '9999-12-31',
    })
    if (withBalance.length > 0) shipBlocks.push({ tabId, label, balance: running, firstDate: withBalance[0]?.entryDate || '9999-12-31', rows: withBalance })
  }

  shipTabs.sort((a, b) => {
    if (a.isSettled !== b.isSettled) return a.isSettled ? 1 : -1
    if (a.tabId === GENERAL_SHIP_TAB_ID) return 1
    if (b.tabId === GENERAL_SHIP_TAB_ID) return -1
    return a.label.localeCompare(b.label, 'es')
  })

  const orderedForResumen = resumenSortMode === 'chronological'
    ? [...Object.values(rowsByTab).flat()].sort(compareLedgerRowsChronological)
    : [...shipBlocks]
      .sort((a, b) => compareIsoDatesAsc(a.firstDate, b.firstDate) || a.label.localeCompare(b.label, 'es'))
      .flatMap((blk) => blk.rows.map((r, idx) => ({
        ...r,
        isBlockStart: idx === 0,
        blockShipLabel: blk.label,
        blockBalance: blk.balance,
      })))

  let globalBal = 0
  const resumenRows = orderedForResumen.map((r) => {
    globalBal = round2(globalBal + (r.paidAmount || 0) - (r.accruedAmount || 0))
    return { ...r, resumenRunningBalance: globalBal }
  })
  rowsByTab[RESUMEN_TAB_ID] = resumenRows

  return { shipTabs, resumenRows, rowsByTab, globalKpis: computeBookKpis(resumenRows, shipTabs) }
}

export function filterBookRowsAndCrossMatches({
  activeTabId = RESUMEN_TAB_ID,
  rowsByTab = {},
  shipTabs = [],
  searchTerm = '',
  kpiFilter = 'todos',
  onlyDebeFactura = false,
} = {}) {
  const isResumen = activeTabId === RESUMEN_TAB_ID
  const baseRows = (rowsByTab[activeTabId] || []).map((r) => ({
    ...r,
    activeRunningBalance: isResumen ? r.resumenRunningBalance : r.shipRunningBalance,
  }))
  const matchesRow = (row) => {
    if (onlyDebeFactura && row.invoiceStatus !== 'DEBE_FACTURA') return false
    if (kpiFilter === 'accrued' && !(row.accruedAmount > 0)) return false
    if (kpiFilter === 'paid' && !(row.paidAmount > 0 && !row.isPanolOrExpense)) return false
    if (kpiFilter === 'panol' && !row.isPanolOrExpense) return false
    if (kpiFilter === 'debe_factura' && row.invoiceStatus !== 'DEBE_FACTURA') return false
    if (!searchTerm) return true
    return matchesUniversalSearch({ ...row, entry_date_ar: formatDateAr(row.entryDate) }, searchTerm)
  }

  const filteredRows = baseRows.filter(matchesRow)
  const crossTabMatches = []
  if (!isResumen && searchTerm.trim()) {
    for (const tab of shipTabs || []) {
      if (tab.tabId === activeTabId) continue
      const hits = (rowsByTab[tab.tabId] || []).filter(matchesRow).length
      if (hits > 0) crossTabMatches.push({ tabId: tab.tabId, label: tab.label, count: hits })
    }
  }
  return { baseRows, filteredRows, crossTabMatches }
}
