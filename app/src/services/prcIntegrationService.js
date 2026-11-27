/**
 * prcIntegrationService.js
 * Orquestación Etapa 2 (SKL-015 / SKL-019): Emisión atómica e integración cruzada
 * entre `Base de datos de PRC` (`#2000+`), Órdenes de Trabajo (`/ots`) y Terceros (`/terceros`).
 */
import { logCellChange } from '../lib/auditService.js'
import { getTodayArIso } from '../lib/dateTimeCanonical.js'
import { evaluateFormulaInput } from '../lib/formulaEngine.js'
import {
  buildPrcLookupMaps, evaluateWorkItemPrcEligibility, formatPrcNumberLabel,
  isEligibleContractorForPrc, resolveLatestDollarRate, resolvePrcForThirdPartyService, resolvePrcForWorkItem,
} from '../lib/prcRegistryRules.js'
import { saveServiceService } from '../lib/tercerosService.js'
import { saveThirdPartyCascadeService } from '../lib/workOrdersService.js'
import { macroVariablesRepository } from '../repositories/macroVariablesRepository.js'
import { prcRegistryRepository } from '../repositories/prcRegistryRepository.js'
import { thirdPartyServicesRepository } from '../repositories/thirdPartyServicesRepository.js'
import { workItemsRepository } from '../repositories/workItemsRepository.js'
import { issueNewPrcService } from './prcRegistryService.js'

async function resolveFx(macroVariables = []) {
  const fromProp = resolveLatestDollarRate(macroVariables)
  if (fromProp > 0) return fromProp
  const res = await macroVariablesRepository.listMacroVariables()
  return resolveLatestDollarRate(res?.data || []) || 1500
}

function findWorkerForContractor(name, workers = []) {
  const key = String(name || '').trim().toUpperCase()
  if (!key) return null
  const hits = (workers || []).filter(
    (w) => String(w?.work_group || '').trim().toUpperCase() === key || String(w?.name || '').trim().toUpperCase() === key
  )
  return hits.find((w) => String(w.status || 'ACTIVO').toUpperCase() === 'ACTIVO') || hits[0] || null
}

function assertContractorAllowedForPrc(name, workers = []) {
  const cleanName = String(name || '').trim()
  if (!cleanName) throw new Error('Seleccioná un contratista externo antes de elegir PRC.')
  if (cleanName.toUpperCase() === 'ASTILLERO' || cleanName.toUpperCase().startsWith('ASTILLERO.')) {
    throw new Error('Los presupuestos (PRC) aplican únicamente a contratistas externos dentro del astillero.')
  }
  const worker = findWorkerForContractor(cleanName, workers)
  if (worker) {
    const check = isEligibleContractorForPrc(worker)
    if (!check.eligible) throw new Error(check.reason)
  }
  return worker
}

function buildPrcFromServicePayload({ src, worker, fx, thirdPartyServiceId = null }) {
  const evalAmt = evaluateFormulaInput(src.amount_ars, { allowNegative: false, maxDecimals: 2, emptyValue: 0 })
  const amountArs = evalAmt.ok ? Number(evalAmt.value || 0) : (Number(src.amount_ars) || 0)
  const exchangeRate = Number(src.usd_rate) || fx
  const amountUsd = Number(src.amount_usd) > 0 ? Number(src.amount_usd) : (exchangeRate > 0 ? Number((amountArs / exchangeRate).toFixed(2)) : 0)
  return {
    contractor_worker_id: worker?.id || src.contractor_id || null,
    contractor_name: src.contractor_name,
    ship_id: src.ship_id || null,
    work_order_id: src.work_order_id || null,
    work_item_id: src.work_item_id || null,
    third_party_service_id: thirdPartyServiceId,
    description: src.direct_observations || src.specific_observations || `Comprobante Terceros · ${src.contractor_name}`,
    amount_ars: amountArs,
    amount_usd: amountUsd,
    exchange_rate: exchangeRate,
    issue_date: src.service_date || src.entry_date || getTodayArIso(),
    observations: src.specific_observations || null,
  }
}

export async function issueAndLinkPrcFromTercerosInlineService({
  service, contractors = [], macroVariables = [], prcs = [], actor = 'ADMIN',
}) {
  if (!service?.id) throw new Error('Comprobante de Terceros inválido.')
  const worker = assertContractorAllowedForPrc(service.contractor_name, contractors)
  const existing = resolvePrcForThirdPartyService(service, buildPrcLookupMaps(prcs))
  const fx = await resolveFx(macroVariables)

  let prc = existing.prc && existing.prc.status !== 'ANULADO' ? existing.prc : null
  if (!prc) {
    prc = await issueNewPrcService({
      formData: buildPrcFromServicePayload({ src: service, worker, fx, thirdPartyServiceId: service.id }),
      contractors, macroVariables, actor, sourceModule: 'TERCEROS_FILAS',
    })
  }

  const numStr = String(prc.prc_number)
  const { error: updErr } = await thirdPartyServicesRepository.updateById(
    service.id,
    { voucher_type: 'PRC', status: 'PRC', budget_number: numStr, voucher_number: numStr, updated_at: new Date().toISOString() },
    { select: null }
  )
  if (updErr) throw new Error(updErr)

  await logCellChange({
    entityType: 'third_party_services', entityId: service.id, entityName: service.contractor_name || String(service.id),
    field: 'voucher_type', fieldLabel: 'Comprobante PRC', oldValue: service.voucher_type || '',
    newValue: formatPrcNumberLabel(prc.prc_number), sheetName: 'Terceros · Servicios y Facturación',
    moduleRoute: '/terceros', changeOrigin: 'INLINE_PRC_CONFIRM', user: actor,
  })
  return { prc, budgetNumber: numStr }
}

export async function issueAndSaveServicePrcModalService({
  formData, editingService = null, canEditAmounts = false, contractors = [], macroVariables = [], workItems = [], actor = 'ADMIN',
}) {
  const worker = assertContractorAllowedForPrc(formData?.contractor_name, contractors)
  const fx = await resolveFx(macroVariables)
  const prc = await issueNewPrcService({
    formData: buildPrcFromServicePayload({ src: formData, worker, fx, thirdPartyServiceId: editingService?.id || null }),
    contractors, macroVariables, actor, sourceModule: 'TERCEROS_FILAS',
  })

  const numStr = String(prc.prc_number)
  const savedRes = await saveServiceService({
    formData: { ...formData, voucher_type: 'PRC', budget_number: numStr, voucher_number: numStr },
    editingService, canEditAmounts, contractors, macroVariables, workItems, actor,
  })
  if (savedRes?.id && !prc.third_party_service_id) {
    await prcRegistryRepository.updatePrcDetails(prc.id, { third_party_service_id: savedRes.id })
  }
  return { ...savedRes, prc, budgetNumber: numStr }
}

export async function issueAndLinkPrcFromWorkOrderRowService({
  targetRow, workers = [], macroVariables = [], prcs = [], user = null,
}) {
  if (!targetRow) throw new Error('Fila de Orden de Trabajo inválida.')
  const elig = evaluateWorkItemPrcEligibility(targetRow, workers)
  if (!elig.eligible) throw new Error(elig.reason)

  const actor = user?.email || user?.full_name || 'Supervisor'
  let workItemId = targetRow.isPlaceholder ? null : targetRow.id
  if (targetRow.isPlaceholder) {
    const { data: createdWi, error: insErr } = await workItemsRepository.insertOne({
      work_order_id: targetRow.work_order_id, description: targetRow.description || targetRow.wo?.title || '',
      status: targetRow.status || 'En ejecución', foreman_name: targetRow.foreman_name || 'ALE CAMADELLI',
      work_type: 'PRESUPUESTO', assignment_type: targetRow.assignment_type || 'Presupuesto General',
      contractors: targetRow.contractors || [], contractor_name: (targetRow.contractors || []).join(', ') || null,
      send_to_third_party_prc: true, updated_at: new Date().toISOString(),
    })
    if (insErr || !createdWi?.id) throw new Error(insErr || 'No se pudo crear el ítem de trabajo.')
    workItemId = createdWi.id
  } else {
    const { error: wiErr } = await workItemsRepository.updateById(
      workItemId, { work_type: 'PRESUPUESTO', send_to_third_party_prc: true, updated_at: new Date().toISOString() }, { select: null }
    )
    if (wiErr) throw new Error(wiErr)
  }

  const existingMatch = resolvePrcForWorkItem({ ...targetRow, id: workItemId }, buildPrcLookupMaps(prcs))
  const fx = await resolveFx(macroVariables)
  let prc = existingMatch.prc && existingMatch.prc.status !== 'ANULADO' ? existingMatch.prc : null

  if (!prc) {
    prc = await issueNewPrcService({
      formData: {
        contractor_worker_id: elig.contractorWorkerId, contractor_name: elig.contractorName,
        ship_id: targetRow.wo?.ship_id || null, work_order_id: targetRow.work_order_id || null, work_item_id: workItemId,
        third_party_service_id: targetRow.thirdPartyRecord?.id || null,
        description: targetRow.description || targetRow.wo?.title || `Trabajo OT · ${elig.contractorName}`,
        amount_ars: Number(targetRow.thirdPartyRecord?.amount_ars || 0), exchange_rate: fx, issue_date: getTodayArIso(),
      },
      contractors: workers, macroVariables, actor, sourceModule: 'OT_UNIFICADO',
    })
  }

  const workerObj = findWorkerForContractor(elig.contractorName, workers)
  const resolvedTrade = workerObj?.trade && workerObj.trade.toUpperCase().trim() !== 'MANUAL' ? workerObj.trade : null
  const numStr = String(prc.prc_number)
  const todayIso = getTodayArIso()
  const { data: tpRow, error: tpErr } = await thirdPartyServicesRepository.upsertOne(
    {
      work_item_id: workItemId, work_order_id: targetRow.work_order_id, ship_id: targetRow.wo?.ship_id || null,
      contractor_id: workerObj?.id || null, contractor_name: elig.contractorName, trade: resolvedTrade,
      status: 'PRC', voucher_type: 'PRC', budget_number: numStr, voucher_number: numStr,
      amount_ars: Number(targetRow.thirdPartyRecord?.amount_ars || 0),
      service_date: targetRow.thirdPartyRecord?.service_date || todayIso,
      entry_date: targetRow.thirdPartyRecord?.entry_date || todayIso,
      direct_observations: targetRow.description || targetRow.wo?.title || 'Sin descripción en OT',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'work_item_id' }
  )
  if (tpErr) throw new Error(tpErr)
  if (tpRow?.id && !prc.third_party_service_id) {
    await prcRegistryRepository.updatePrcDetails(prc.id, { third_party_service_id: tpRow.id })
  }
  return { prc, workItemId, thirdPartyService: tpRow || null }
}

export async function issueAndSaveTpCascadePrcService({
  tpCascadeForm, selectedWorkItem, workers = [], macroVariables = [], user = null,
}) {
  if (!selectedWorkItem) throw new Error('Seleccioná un Barco, Contratista habilitado y Orden de Trabajo.')
  const worker = assertContractorAllowedForPrc(tpCascadeForm.contractor_name, workers)
  const actor = user?.email || user?.full_name || 'Supervisor'
  const fx = await resolveFx(macroVariables)
  const prc = await issueNewPrcService({
    formData: {
      contractor_worker_id: worker?.id || null, contractor_name: tpCascadeForm.contractor_name,
      ship_id: tpCascadeForm.ship_id || selectedWorkItem.wo?.ship_id || null,
      work_order_id: selectedWorkItem.work_order_id || null, work_item_id: selectedWorkItem.id,
      description: selectedWorkItem.description || selectedWorkItem.wo?.title || `PRC Terceros · ${tpCascadeForm.contractor_name}`,
      amount_ars: Number(tpCascadeForm.amount_ars || 0), exchange_rate: fx,
      issue_date: tpCascadeForm.service_date || getTodayArIso(), observations: tpCascadeForm.specific_observations || null,
    },
    contractors: workers, macroVariables, actor, sourceModule: 'OT_UNIFICADO',
  })

  const numStr = String(prc.prc_number)
  await saveThirdPartyCascadeService({ ...tpCascadeForm, status: 'PRC', voucher_number: numStr }, selectedWorkItem, workers, user)
  return { prc, budgetNumber: numStr }
}
