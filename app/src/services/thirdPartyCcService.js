/**
 * thirdPartyCcService.js
 * Lectura consolidada y gestión de cuentas/tarifas (SKL-015 / SKL-019) para Cuentas Corrientes de Talleres.
 */
import { logCellChange, logRowAction } from '../lib/auditService.js'
import { getTodayArIso } from '../lib/dateTimeCanonical.js'
import {
  thirdPartyCcAccountsRepository,
  thirdPartyCcRateHistoryRepository,
  thirdPartyCcEntriesRepository,
  thirdPartyCcPaymentsRepository,
} from '../repositories/thirdPartyCcRepository.js'
import { inventoryTransactionsRepository } from '../repositories/inventoryTransactionsRepository.js'
import { materialsRepository } from '../repositories/materialsRepository.js'
import { thirdPartyServicesRepository } from '../repositories/thirdPartyServicesRepository.js'
import { workOrdersRepository } from '../repositories/workOrdersRepository.js'
import { workItemsRepository } from '../repositories/workItemsRepository.js'
import { shipsRepository } from '../repositories/shipsRepository.js'
import { workersRepository } from '../repositories/workersRepository.js'
import { macroVariablesRepository } from '../repositories/macroVariablesRepository.js'

export {
  saveCcEntryOverrideService,
  saveCcManualEntryService,
  deleteCcManualEntryService,
  saveCcPaymentService,
  deleteCcPaymentService,
} from './thirdPartyCcLedgerMutations.js'

const AUDIT_META = {
  entityType: 'third_party_cc',
  sheetName: 'Terceros · Cuentas Corrientes',
  moduleRoute: '/terceros?tab=cuentas-corrientes',
}

export async function fetchThirdPartyCcData() {
  const [accRes, rhRes, entRes, payRes, txRes, matRes, srvRes, woRes, wiRes, shpRes, wkrRes, mvRes] = await Promise.all([
    thirdPartyCcAccountsRepository.listAccounts(),
    thirdPartyCcRateHistoryRepository.listByAccount(),
    thirdPartyCcEntriesRepository.listByAccount(),
    thirdPartyCcPaymentsRepository.listByAccount(),
    inventoryTransactionsRepository.listWithVoucherNumber(),
    materialsRepository.listMaterials({ select: 'id, name, category, unit_measure, weight_kg' }),
    thirdPartyServicesRepository.listServices(),
    workOrdersRepository.listCanonicalWorkOrders(),
    workItemsRepository.listCanonicalWorkItems(),
    shipsRepository.listShips({ select: 'id, name' }),
    workersRepository.listThirdPartyEnabled(),
    macroVariablesRepository.listMacroVariables(),
  ])

  if (accRes.error) throw new Error(accRes.error)
  if (rhRes.error) throw new Error(rhRes.error)
  if (entRes.error) throw new Error(entRes.error)
  if (payRes.error) throw new Error(payRes.error)

  return {
    accounts: accRes.data || [],
    rateHistory: rhRes.data || [],
    savedEntries: entRes.data || [],
    payments: payRes.data || [],
    panolRemitoTx: txRes.data || [],
    materials: matRes.data || [],
    thirdPartyServices: srvRes.data || [],
    workOrders: woRes.data || [],
    workItems: wiRes.data || [],
    ships: shpRes.data || [],
    contractors: wkrRes.data || [],
    macroVariables: mvRes.data || [],
  }
}

export async function createCcAccountService({ formData, contractors = [], actor = 'ADMIN' }) {
  const worker = contractors.find((w) => w.id === formData.worker_id)
  if (!worker) throw new Error('Seleccioná un taller/contratista habilitado en el padrón.')

  const initialRate = Number(formData.current_rate_usd || 0)
  const startDate = formData.opening_balance_date || getTodayArIso()
  const payload = {
    worker_id: worker.id,
    operational_name: worker.name,
    legal_name: String(formData.legal_name || worker.name).trim().toUpperCase(),
    pricing_mode: formData.pricing_mode || 'PER_KG',
    current_rate_usd: initialRate,
    opening_balance_usd: Number(formData.opening_balance_usd || 0),
    opening_balance_date: startDate,
    material_categories: ['MATERIALES'],
    cancellation_mode: formData.cancellation_mode || 'FIFO',
    is_active: true,
    notes: formData.notes?.trim() || null,
    created_by: actor,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await thirdPartyCcAccountsRepository.insertOne(payload)
  if (error) throw new Error(error)

  if (payload.pricing_mode === 'PER_KG') {
    await workersRepository.updateById(
      worker.id,
      { can_withdraw_materials: true, updated_at: new Date().toISOString() },
      { select: null }
    )
  }

  if (payload.pricing_mode === 'PER_KG' && initialRate > 0) {
    const { error: rhErr } = await thirdPartyCcRateHistoryRepository.insertOne({
      account_id: data.id,
      effective_from: startDate,
      rate_usd_per_kg: initialRate,
      notes: 'Tarifa inicial de apertura',
      created_by: actor,
    })
    if (rhErr) throw new Error(rhErr)
  }

  await logRowAction({
    action: 'ROW_INSERT', ...AUDIT_META, entityId: data.id,
    entityName: `${payload.legal_name} (${payload.operational_name})`,
    rowData: data, changeOrigin: 'MODAL_FORM', user: actor,
  })
  return data
}

export async function addCcRateHistoryService({ account, effectiveFrom, rateUsdPerKg, notes = '', actor = 'ADMIN' }) {
  if (!account?.id) throw new Error('Cuenta corriente no seleccionada.')
  const rate = Number(rateUsdPerKg)
  if (!Number.isFinite(rate) || rate < 0) throw new Error('La tarifa US$/kg debe ser mayor o igual a 0.')

  const { data, error } = await thirdPartyCcRateHistoryRepository.insertOne({
    account_id: account.id,
    effective_from: effectiveFrom || getTodayArIso(),
    rate_usd_per_kg: rate,
    notes: notes?.trim() || null,
    created_by: actor,
  })
  if (error) throw new Error(error)

  await thirdPartyCcAccountsRepository.updateById(
    account.id,
    { current_rate_usd: rate, updated_at: new Date().toISOString() },
    { select: null }
  )

  await logRowAction({
    action: 'ROW_INSERT', ...AUDIT_META, entityId: data.id,
    entityName: `${account.legal_name || account.operational_name} · Tarifa US$ ${rate}/kg`,
    rowData: data, changeOrigin: 'MODAL_FORM', user: actor,
  })
  return data
}

export async function updateCcCancellationModeService({ account, cancellationMode, actor = 'ADMIN' }) {
  const nextMode = cancellationMode === 'MANUAL' ? 'MANUAL' : 'FIFO'
  const { error } = await thirdPartyCcAccountsRepository.updateById(
    account.id,
    { cancellation_mode: nextMode, updated_at: new Date().toISOString() },
    { select: null }
  )
  if (error) throw new Error(error)
  await logCellChange({
    ...AUDIT_META, entityId: account.id, entityName: account.legal_name || account.operational_name,
    field: 'cancellation_mode', fieldLabel: 'Modo de Cancelación',
    oldValue: account.cancellation_mode, newValue: nextMode,
    changeOrigin: 'TOOLBAR_TOGGLE', user: actor,
  })
}
