/**
 * resumenHorasService.js
 * Capa de servicio para `4. Resumen Horas` (`/horas?tab=resumen_horas`, María José y Admin).
 * Cumple Candado FL-007 (100% vía repositorios) y auditoría obligatoria en `audit_logs`.
 */
import { logCellChange, logRowAction } from '../lib/auditService.js'
import { fetchContractorDeductionsForPeriod } from '../lib/contractorDeductionsService.js'
import { laborLogsRepository } from '../repositories/laborLogsRepository.js'
import { workersRepository } from '../repositories/workersRepository.js'
import { rateCardsRepository } from '../repositories/rateCardsRepository.js'
import { prcRegistryRepository } from '../repositories/prcRegistryRepository.js'
import { thirdPartyServicesRepository } from '../repositories/thirdPartyServicesRepository.js'
import { contractorCcRepository } from '../repositories/contractorCcRepository.js'
import { thirdPartyCcAccountsRepository } from '../repositories/thirdPartyCcRepository.js'
import { shipsRepository } from '../repositories/shipsRepository.js'
import { workOrdersRepository } from '../repositories/workOrdersRepository.js'
import { workItemsRepository } from '../repositories/workItemsRepository.js'

const AUDIT_META = {
  entityType: 'contractor_settlement_closures',
  sheetName: 'Horas · Resumen Horas (Contratados)',
  moduleRoute: '/horas?tab=resumen_horas',
}

export async function fetchResumenHorasWorkspaceData(periodKey) {
  const [
    logsRes, workersRes, rcRes, prcRes, tpRes, ccMovRes, closuresRes, ccAccRes, shipsRes, woRes, wiRes, deductionsData,
  ] = await Promise.all([
    laborLogsRepository.listLaborLogs(),
    workersRepository.listWorkers({
      select: 'id, name, category, trade, work_group, admin_center, status, hourly_rate_ars',
      orderBy: [{ column: 'name', ascending: true }],
    }),
    rateCardsRepository.listRateCards(),
    prcRegistryRepository.listCanonicalPrcs(),
    thirdPartyServicesRepository.listServices(),
    contractorCcRepository.listMovements(),
    contractorCcRepository.listClosures({ filters: { period_key: periodKey } }),
    thirdPartyCcAccountsRepository.listAccounts({ filters: { is_active: true } }),
    shipsRepository.listShips({ select: 'id, name', orderBy: [] }),
    workOrdersRepository.listCanonicalWorkOrders(),
    workItemsRepository.listCanonicalWorkItems(),
    fetchContractorDeductionsForPeriod(periodKey),
  ])

  const firstErr = [logsRes, workersRes, rcRes, prcRes, tpRes, ccMovRes, closuresRes, ccAccRes, shipsRes, woRes, wiRes]
    .find((r) => r?.error)?.error
  if (firstErr) throw new Error(firstErr)

  return {
    laborLogs: logsRes.data || [],
    workers: workersRes.data || [],
    rateCards: rcRes.data || [],
    prcs: prcRes.data || [],
    thirdPartyServices: tpRes.data || [],
    ccMovements: ccMovRes.data || [],
    closures: closuresRes.data || [],
    ccAccounts: ccAccRes.data || [],
    ships: shipsRes.data || [],
    workOrders: woRes.data || [],
    workItems: wiRes.data || [],
    deductionsData,
  }
}

export async function saveContratadosRowObservationService({
  periodKey,
  row,
  observationText = '',
  dollarRate = 1500,
  actor = 'LIQUIDACION_SUELDOS',
}) {
  const cleanObs = String(observationText || '').trim()
  const payload = {
    period_key: periodKey,
    contractor_group: row.contractorLabel,
    row_key: row.rowKey,
    dollar_rate_materials: dollarRate || null,
    hours_total: Number(row.hours || 0),
    gross_ars: Number(row.grossArs || 0),
    materials_ars: Number(row.materialsArs || 0),
    advances_ars: Number(row.advancesArs || 0),
    net_payable_ars: Number(row.netPayableArs || 0),
    status: 'BORRADOR',
    observations: cleanObs || null,
  }

  const { data, error } = await contractorCcRepository.upsertClosure(payload)
  if (error) throw new Error(error)

  await logCellChange({
    ...AUDIT_META,
    entityId: data?.id || null,
    entityName: `${row.contractorLabel} (${row.shipName})`,
    field: 'observations',
    oldValue: row.observations || '',
    newValue: cleanObs,
    changeOrigin: 'RESUMEN_CONTRATADOS_OBS',
    user: actor,
  })
  return data
}

export async function closeQuincenaSettlementService({
  periodKey,
  rows = [],
  totals = {},
  dollarRate = 1500,
  actor = 'LIQUIDACION_SUELDOS',
}) {
  const closedAt = new Date().toISOString()
  const cleanSnapshotRows = (rows || []).map((r) => ({
    rowKey: r.rowKey,
    contractorLabel: r.contractorLabel,
    baseGroup: r.baseGroup,
    shipId: r.shipId,
    shipName: r.shipName,
    workOrderId: r.workOrderId,
    otLabel: r.otLabel,
    workType: r.workType,
    prcNumber: r.prcNumber,
    prcDisplay: r.prcDisplay,
    hours: r.hours,
    hourlyRateArs: r.hourlyRateArs,
    grossArs: r.grossArs,
    materialsArs: r.materialsArs,
    advancesArs: r.advancesArs,
    netPayableArs: r.netPayableArs,
    progressPct: r.progressPct,
    estimatedHours: r.estimatedHours,
    prcCumulativeHours: r.prcCumulativeHours,
    prcStatus: r.prcStatus,
    observations: r.observations || '',
    bandStyle: r.bandStyle,
  }))

  const payload = {
    period_key: periodKey,
    contractor_group: '__CONSOLIDADO__',
    row_key: '__PERIOD_SNAPSHOT__',
    dollar_rate_materials: dollarRate || null,
    hours_total: Number(totals.totalHours || 0),
    gross_ars: Number(totals.totalGrossArs || 0),
    materials_ars: Number(totals.totalMaterialsArs || 0),
    advances_ars: Number(totals.totalAdvancesArs || 0),
    net_payable_ars: Number(totals.totalNetPayableArs || 0),
    status: 'CERRADO',
    observations: `Cierre quincena ${periodKey} (${cleanSnapshotRows.length} filas) por ${actor}`,
    snapshot_json: { rows: cleanSnapshotRows, totals, dollarRate, closedBy: actor, closedAt },
    closed_by: actor,
    closed_at: closedAt,
  }

  const { data, error } = await contractorCcRepository.upsertClosure(payload)
  if (error) throw new Error(error)

  await logRowAction({
    ...AUDIT_META,
    action: 'STATUS_CHANGE',
    entityId: data?.id || null,
    entityName: `Cierre Quincena ${periodKey}`,
    rowData: { status: 'CERRADO', totalNetPayableArs: totals.totalNetPayableArs, rowCount: cleanSnapshotRows.length },
    changeOrigin: 'RESUMEN_CONTRATADOS_CIERRE',
    user: actor,
  })
  return data
}

export async function reopenQuincenaSettlementService({ snapshotId, periodKey, actor = 'ADMIN' }) {
  if (!snapshotId) throw new Error('No se encontró el cierre quincenal a reabrir.')
  const { data, error } = await contractorCcRepository.updateClosure(snapshotId, {
    status: 'BORRADOR',
    closed_by: actor,
  })
  if (error) throw new Error(error)

  await logRowAction({
    ...AUDIT_META,
    action: 'STATUS_CHANGE',
    entityId: snapshotId,
    entityName: `Reapertura Quincena ${periodKey}`,
    rowData: { status: 'BORRADOR' },
    changeOrigin: 'RESUMEN_CONTRATADOS_REOPEN',
    user: actor,
  })
  return data
}
