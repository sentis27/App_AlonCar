/**
 * contractorLedgerService.js
 * Capa de servicio para `3. Contratados` (`/tesoreria?tab=contratados`).
 * Opera 100% vía repositorios y audita toda mutación en `audit_logs` (`SKL-015`).
 */
import { logCellChange } from '../lib/auditService.js'
import { getTodayArIso, toArIsoDate } from '../lib/dateTimeCanonical.js'
import { getFortnightPeriodKey } from '../lib/materialPricingPolicy.js'
import { fetchContractorDeductionsForPeriod } from '../lib/contractorDeductionsService.js'
import { parseInlineConceptSmart } from '../lib/contractorLedgerHelpers.js'
import { contractorCcRepository } from '../repositories/contractorCcRepository.js'
import { prcRegistryRepository } from '../repositories/prcRegistryRepository.js'
import { laborLogsRepository } from '../repositories/laborLogsRepository.js'
import { rateCardsRepository } from '../repositories/rateCardsRepository.js'
import { workersRepository } from '../repositories/workersRepository.js'
import { shipsRepository } from '../repositories/shipsRepository.js'
import { workOrdersRepository } from '../repositories/workOrdersRepository.js'
import { workItemsRepository } from '../repositories/workItemsRepository.js'
import { macroVariablesRepository } from '../repositories/macroVariablesRepository.js'
import { thirdPartyCcPaymentsRepository } from '../repositories/thirdPartyCcRepository.js'
import { deleteContractorCcMovementService, saveContractorCcMovementService } from './contractorCcService.js'
import { deleteCcPaymentService, fetchThirdPartyCcData, saveCcPaymentService } from './thirdPartyCcService.js'

const AUDIT_META_CC = {
  entityType: 'contractor_cc_movements',
  sheetName: 'Tesorería · 3. Contratados',
  moduleRoute: '/tesoreria?tab=contratados',
}

const AUDIT_META_WS = {
  entityType: 'third_party_cc',
  sheetName: 'Tesorería · 3. Contratados (Taller)',
  moduleRoute: '/tesoreria?tab=contratados',
}

export async function fetchContractorLedgerWorkspaceData(periodKey) {
  const [
    movRes, closuresRes, prcRes, logsRes, rcRes, workersRes, shipsRes, woRes, wiRes, mvRes, deductionsData, thirdPartyCcData,
  ] = await Promise.all([
    contractorCcRepository.listMovements(),
    contractorCcRepository.listClosures(),
    prcRegistryRepository.listCanonicalPrcs(),
    laborLogsRepository.listLaborLogs(),
    rateCardsRepository.listRateCards(),
    workersRepository.listWorkers({
      select: 'id, name, work_group, trade, admin_center, consumables, consumables_discount_pct, safety_items, status, hourly_rate_ars, category, notes',
      orderBy: [{ column: 'name', ascending: true }],
    }),
    shipsRepository.listShips({ select: 'id, name', orderBy: [{ column: 'name', ascending: true }] }),
    workOrdersRepository.listCanonicalWorkOrders(),
    workItemsRepository.listCanonicalWorkItems(),
    macroVariablesRepository.listMacroVariables(),
    fetchContractorDeductionsForPeriod(periodKey),
    fetchThirdPartyCcData(),
  ])

  const firstErr = [movRes, closuresRes, prcRes, logsRes, rcRes, workersRes, shipsRes, woRes, wiRes, mvRes].find((r) => r?.error)?.error
  if (firstErr) throw new Error(firstErr)

  return {
    movements: movRes.data || [],
    closures: closuresRes.data || [],
    prcs: prcRes.data || [],
    laborLogs: logsRes.data || [],
    rateCards: rcRes.data || [],
    workers: workersRes.data || [],
    ships: shipsRes.data || [],
    workOrders: woRes.data || [],
    workItems: wiRes.data || [],
    macroVariables: mvRes.data || [],
    deductionsData,
    thirdPartyCcData,
  }
}

export async function saveInlineLedgerRowService({
  entity, draft = {}, currentPeriod = '', fortnightDollarRate = 1500, prcs = [], actor = 'TESORERIA',
}) {
  if (!entity) throw new Error('Seleccioná un contratista o taller.')
  const paidNum = Math.max(0, Number(String(draft.paidAmount ?? '').replace(',', '.')) || 0)
  const accruedNum = Math.max(0, Number(String(draft.accruedAmount ?? '').replace(',', '.')) || 0)
  if (paidNum <= 0 && accruedNum <= 0) throw new Error('Ingresá un importe en Monto Pagado o Quincena/PRC.')

  const entryDate = toArIsoDate(draft.entryDate) || getTodayArIso()
  const parsed = parseInlineConceptSmart(draft.concept)

  if (entity.entityType === 'WORKSHOP_CC') {
    const wsPayType = parsed.category === 'RTO_PANOL'
      ? 'COMPENSACION_PANOL'
      : parsed.payment_method === 'ECHEQ'
      ? 'ECHEQ_ARS'
      : parsed.payment_method === 'TRANSFERENCIA'
      ? 'TRANSFERENCIA_ARS'
      : 'EFECTIVO_USD'
    return saveCcPaymentService({
      account: entity.ccAccount,
      formData: {
        payment_date: entryDate,
        payment_type: wsPayType,
        amount_usd: paidNum,
        amount_ars: 0,
        exchange_rate: fortnightDollarRate || 1500,
        has_iva: false,
        iva_pct: 21,
        has_invoice: Boolean(String(draft.invoiceNumber || '').trim()),
        invoice_number: String(draft.invoiceNumber || '').trim(),
        panol_remito_number: parsed.panol_remito_number || '',
        observations: [draft.concept, draft.observations].filter(Boolean).join(' · '),
        source_module: 'TESORERIA',
      },
      actor,
      sourceModule: 'TESORERIA',
    })
  }

  const isHaber = accruedNum > 0 && paidNum <= 0
  const amountArs = isHaber ? accruedNum : paidNum
  const direction = isHaber ? 'HABER' : 'DEBE'
  const category = isHaber ? (draft.prcId ? 'DEVENGADO_PRC' : (parsed.category === 'BONIFICACION' ? 'BONIFICACION' : 'DEVENGADO_QUINCENA')) : parsed.category
  const periodKey = getFortnightPeriodKey(entryDate) || currentPeriod
  const invNum = String(draft.invoiceNumber || '').trim()
  const invStatus = invNum ? 'CON_FACTURA' : (direction === 'DEBE' && category === 'ADELANTO' ? 'DEBE_FACTURA' : 'NO_APLICA')
  const obs = String(draft.observations || '').trim() || (!parsed.payment_reference && !parsed.panol_remito_number ? String(draft.concept || '').trim() : '')

  return saveContractorCcMovementService({
    payload: {
      movement_date: entryDate,
      period_key: periodKey,
      contractor_worker_id: entity.worker?.id || null,
      contractor_group: entity.baseGroup,
      ship_id: draft.shipId || null,
      work_order_id: draft.workOrderId || null,
      prc_id: draft.prcId || null,
      settlement_scope: draft.prcId ? 'PRESUPUESTO' : (draft.shipId ? 'HORA' : 'GENERAL'),
      direction,
      category,
      payment_method: isHaber ? null : parsed.payment_method,
      payment_reference: isHaber ? null : (parsed.payment_reference || null),
      invoice_status: invStatus,
      invoice_number: invNum || null,
      panol_remito_number: parsed.panol_remito_number || null,
      amount_ars: amountArs,
      exchange_rate: fortnightDollarRate || null,
      observations: obs || null,
      source_module: 'TESORERIA',
    },
    prcs,
    actor,
  })
}

export async function patchInlineLedgerCellService({ entity, row, field, value, fortnightDollarRate = 1500, actor = 'TESORERIA' }) {
  if (!row?.isEditable) return null

  if (row.origin === 'WORKSHOP_PAYMENT' && row.rawPayment?.id) {
    const p = row.rawPayment
    const patch = { updated_at: new Date().toISOString() }
    let oldVal = ''
    let newVal = value
    if (field === 'entryDate') {
      oldVal = p.payment_date
      patch.payment_date = toArIsoDate(value) || p.payment_date
      newVal = patch.payment_date
    } else if (field === 'paidAmount') {
      const num = Math.max(0, Number(String(value ?? '').replace(',', '.')) || 0)
      if (num <= 0) throw new Error('El pago en US$ debe ser mayor a 0.')
      oldVal = p.amount_usd
      patch.amount_usd = num
      newVal = num
    } else if (field === 'invoiceNumber') {
      oldVal = p.invoice_number || ''
      const clean = String(value || '').trim()
      patch.invoice_number = clean || null
      patch.has_invoice = Boolean(clean)
      newVal = clean
    } else if (field === 'observations') {
      oldVal = p.observations || ''
      patch.observations = String(value || '').trim() || null
      newVal = patch.observations || ''
    } else return null

    const { data, error } = await thirdPartyCcPaymentsRepository.updateById(p.id, patch)
    if (error) throw new Error(error)
    await logCellChange({ ...AUDIT_META_WS, entityId: p.id, entityName: entity?.label || 'Taller', field, oldValue: oldVal, newValue: newVal, user: actor })
    return data
  }

  if (row.origin === 'CC_MOVEMENT' && row.rawMovement?.id) {
    const m = row.rawMovement
    const patch = {}
    let oldVal = ''
    let newVal = value
    const fx = Number(m.exchange_rate || fortnightDollarRate || 1500)
    if (field === 'entryDate') {
      oldVal = m.movement_date
      const cleanDate = toArIsoDate(value) || m.movement_date
      patch.movement_date = cleanDate
      patch.period_key = getFortnightPeriodKey(cleanDate) || m.period_key
      newVal = cleanDate
    } else if (field === 'concept') {
      oldVal = row.concept
      const clean = String(value || '').trim()
      if (m.payment_reference || m.payment_method) patch.payment_reference = clean || null
      else patch.observations = clean || null
      newVal = clean
    } else if (field === 'paidAmount' || field === 'accruedAmount') {
      const num = Math.max(0, Number(String(value ?? '').replace(',', '.')) || 0)
      oldVal = m.amount_ars
      patch.direction = field === 'accruedAmount' ? 'HABER' : 'DEBE'
      patch.amount_ars = num
      patch.amount_usd = fx > 0 ? Number((num / fx).toFixed(2)) : null
      newVal = num
    } else if (field === 'invoiceNumber') {
      oldVal = m.invoice_number || ''
      const clean = String(value || '').trim()
      patch.invoice_number = clean || null
      patch.invoice_status = clean ? 'CON_FACTURA' : 'DEBE_FACTURA'
      newVal = clean
    } else if (field === 'observations') {
      oldVal = m.observations || ''
      patch.observations = String(value || '').trim() || null
      newVal = patch.observations || ''
    } else return null

    const { data, error } = await contractorCcRepository.updateMovement(m.id, patch)
    if (error) throw new Error(error)
    await logCellChange({ ...AUDIT_META_CC, entityId: m.id, entityName: `${m.contractor_group} · ${m.category}`, field, oldValue: oldVal, newValue: newVal, user: actor })
    return data
  }
  return null
}

export async function deleteLedgerRowService({ row, actor = 'TESORERIA' }) {
  if (row?.origin === 'CC_MOVEMENT' && row.rawMovement?.id) return deleteContractorCcMovementService({ row: row.rawMovement, actor })
  if (row?.origin === 'WORKSHOP_PAYMENT' && row.rawPayment?.id) return deleteCcPaymentService({ payment: row.rawPayment, actor })
  throw new Error('Este movimiento proviene de otro módulo y no se elimina desde esta planilla.')
}
