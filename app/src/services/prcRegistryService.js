/**
 * prcRegistryService.js
 * Capa de servicio para `Base de datos de PRC` (lectura consolidada, emisión inmutable,
 * adicionales y anulación tachada con trazabilidad en `audit_logs`).
 */
import { logCellChange, logRowAction } from '../lib/auditService.js'
import { getTodayArIso } from '../lib/dateTimeCanonical.js'
import {
  formatPrcNumberLabel,
  isEligibleContractorForPrc,
  resolveLatestDollarRate,
} from '../lib/prcRegistryRules.js'
import { prcRegistryRepository } from '../repositories/prcRegistryRepository.js'
import { shipsRepository } from '../repositories/shipsRepository.js'
import { workOrdersRepository } from '../repositories/workOrdersRepository.js'
import { workItemsRepository } from '../repositories/workItemsRepository.js'
import { workersRepository } from '../repositories/workersRepository.js'
import { macroVariablesRepository } from '../repositories/macroVariablesRepository.js'

const AUDIT_META = {
  entityType: 'contractor_prc_registry',
  sheetName: 'Terceros · Base de datos de PRC',
  moduleRoute: '/terceros?tab=base-prc',
}

export async function fetchPrcRegistryWorkspaceData() {
  const [prcRes, nextRes, shipsRes, woRes, wiRes, workersRes, mvRes] = await Promise.all([
    prcRegistryRepository.listCanonicalPrcs(),
    prcRegistryRepository.peekNextPrcNumber(),
    shipsRepository.listShips({ select: 'id, name' }),
    workOrdersRepository.listCanonicalWorkOrders(),
    workItemsRepository.listCanonicalWorkItems(),
    workersRepository.listWorkers({
      select: 'id, name, work_group, admin_center, status, trade, can_charge_third_party',
    }),
    macroVariablesRepository.listMacroVariables(),
  ])

  if (prcRes.error) throw new Error(prcRes.error)
  if (shipsRes.error) throw new Error(shipsRes.error)
  if (woRes.error) throw new Error(woRes.error)
  if (wiRes.error) throw new Error(wiRes.error)
  if (workersRes.error) throw new Error(workersRes.error)

  return {
    prcs: prcRes.data || [],
    nextPrcNumber: nextRes?.data || 2000,
    ships: shipsRes.data || [],
    workOrders: woRes.data || [],
    workItems: wiRes.data || [],
    workers: workersRes.data || [],
    macroVariables: mvRes.data || [],
  }
}

export async function previewNextPrcNumberService() {
  const res = await prcRegistryRepository.peekNextPrcNumber()
  if (res.error) throw new Error(res.error)
  return res.data
}

export async function issueNewPrcService({
  formData = {},
  contractors = [],
  macroVariables = [],
  actor = 'ADMIN',
  sourceModule = 'TERCEROS_PRC',
  parentPrc = null,
}) {
  const worker = (contractors || []).find((w) => w.id === formData.contractor_worker_id)
  if (worker) {
    const check = isEligibleContractorForPrc(worker)
    if (!check.eligible) throw new Error(check.reason)
  }

  const contractorName = String(formData.contractor_name || worker?.work_group || worker?.name || '').trim()
  if (!contractorName) throw new Error('Seleccioná un contratista válido para emitir el PRC.')

  const amountArs = Number(formData.amount_ars || 0)
  if (!Number.isFinite(amountArs) || amountArs < 0) {
    throw new Error('El importe en AR$ no puede ser negativo.')
  }

  const fxRate = Number(formData.exchange_rate) || resolveLatestDollarRate(macroVariables) || null
  let amountUsd = Number(formData.amount_usd || 0)
  if (!(amountUsd > 0) && amountArs > 0 && fxRate && fxRate > 0) {
    amountUsd = Number((amountArs / fxRate).toFixed(2))
  }

  const { data, error } = await prcRegistryRepository.issuePrc({
    contractor_name: contractorName,
    contractor_worker_id: worker?.id || formData.contractor_worker_id || null,
    ship_id: formData.ship_id || null,
    work_order_id: formData.work_order_id || null,
    work_item_id: formData.work_item_id || null,
    third_party_service_id: formData.third_party_service_id || null,
    description: String(formData.description || '').trim(),
    amount_ars: amountArs,
    amount_usd: Number.isFinite(amountUsd) ? amountUsd : 0,
    exchange_rate: fxRate,
    issue_date: formData.issue_date || getTodayArIso(),
    parent_prc_id: parentPrc?.id || formData.parent_prc_id || null,
    source_module: sourceModule,
    observations: formData.observations ? String(formData.observations).trim() : null,
    created_by: actor,
  })

  if (error || !data) throw new Error(error || 'No se pudo emitir el PRC.')

  await logRowAction({
    action: 'ROW_INSERT',
    ...AUDIT_META,
    entityId: data.id,
    entityName: `${formatPrcNumberLabel(data.prc_number)} · ${data.contractor_name}`,
    rowData: data,
    changeOrigin: parentPrc ? 'PRC_ADICIONAL_MODAL' : 'PRC_ISSUE_MODAL',
    user: actor,
  })

  return data
}

export async function annulPrcService({ prc, reason, actor = 'ADMIN' }) {
  if (!prc?.id) throw new Error('Registro de PRC inválido.')
  if (prc.status === 'ANULADO') {
    throw new Error(`El ${formatPrcNumberLabel(prc.prc_number)} ya se encuentra anulado.`)
  }
  const cleanReason = String(reason || '').trim()
  if (cleanReason.length < 3) {
    throw new Error('Ingresá un motivo de anulación de al menos 3 caracteres.')
  }

  const { data, error } = await prcRegistryRepository.annulPrc(prc.id, {
    annulled_reason: cleanReason,
    annulled_by: actor,
  })
  if (error || !data) throw new Error(error || 'No se pudo anular el PRC.')

  await logRowAction({
    action: 'STATUS_CHANGE',
    ...AUDIT_META,
    entityId: prc.id,
    entityName: `${formatPrcNumberLabel(prc.prc_number)} · ${prc.contractor_name}`,
    changes: {
      status: { from: prc.status, to: 'ANULADO' },
      annulled_reason: { from: prc.annulled_reason || null, to: cleanReason },
    },
    changeOrigin: 'PRC_ANNUL_MODAL',
    user: actor,
  })

  return data
}

export async function updatePrcRecordService({ prc, patch = {}, actor = 'ADMIN' }) {
  if (!prc?.id) throw new Error('Registro de PRC inválido.')
  if (prc.status === 'ANULADO') {
    throw new Error(`El ${formatPrcNumberLabel(prc.prc_number)} está ANULADO y no puede modificarse.`)
  }

  const cleanPatch = {}
  const editableFields = ['description', 'amount_ars', 'amount_usd', 'exchange_rate', 'status', 'observations', 'issue_date']
  for (const field of editableFields) {
    if (patch[field] !== undefined) cleanPatch[field] = patch[field]
  }
  if (cleanPatch.status === 'ANULADO') {
    throw new Error('Para anular usá la acción Anular (requiere motivo).')
  }

  const { data, error } = await prcRegistryRepository.updatePrcDetails(prc.id, cleanPatch)
  if (error || !data) throw new Error(error || 'No se pudo actualizar el PRC.')

  const entityName = `${formatPrcNumberLabel(prc.prc_number)} · ${prc.contractor_name}`
  for (const [field, nextVal] of Object.entries(cleanPatch)) {
    if (String(prc[field] ?? '') !== String(nextVal ?? '')) {
      await logCellChange({
        ...AUDIT_META,
        entityId: prc.id,
        entityName,
        field,
        fieldLabel: field,
        oldValue: prc[field] ?? null,
        newValue: nextVal ?? null,
        changeOrigin: 'PRC_MODAL_EDIT',
        user: actor,
      })
    }
  }

  return data
}
