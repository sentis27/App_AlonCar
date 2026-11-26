/**
 * thirdPartyCcLedgerMutations.js
 * Mutaciones auditadas del DEBE y HABER para Cuentas Corrientes de Talleres.
 */
import { logCellChange, logRowAction } from '../lib/auditService.js'
import { getTodayArIso } from '../lib/dateTimeCanonical.js'
import { computePaymentNetUsd, formatQuincenaLabelAr } from '../lib/thirdPartyCcEngine.js'
import { thirdPartyCcEntriesRepository, thirdPartyCcPaymentsRepository } from '../repositories/thirdPartyCcRepository.js'

const AUDIT_META = {
  entityType: 'third_party_cc',
  sheetName: 'Terceros · Cuentas Corrientes',
  moduleRoute: '/terceros?tab=cuentas-corrientes',
}

export async function saveCcEntryOverrideService({ account, row, patch, actor = 'ADMIN' }) {
  if (!account?.id || !row) throw new Error('Movimiento del DEBE inválido.')
  const nowIso = new Date().toISOString()
  let saved = null

  if (row.entrySource === 'MANUAL' && row.overrideId) {
    const { data, error } = await thirdPartyCcEntriesRepository.updateById(row.overrideId, { ...patch, updated_at: nowIso })
    if (error) throw new Error(error)
    saved = data
  } else {
    const payload = {
      account_id: account.id, entry_source: row.entrySource || 'PANOL_REMITO', source_key: row.sourceKey,
      remito_number: row.remitoNumber, entry_date: row.entryDate, quincena_label: row.quincenaLabel,
      weight_kg: Number(row.weightKg || 0), rate_usd_applied: patch.rate_usd_applied ?? row.rateUsdApplied,
      is_special_rate: patch.is_special_rate ?? row.isSpecialRate,
      special_rate_reason: patch.special_rate_reason !== undefined ? patch.special_rate_reason : row.specialRateReason || null,
      amount_usd: patch.amount_usd ?? row.amountUsd,
      is_cancelled: patch.is_cancelled ?? row.manualCancelled,
      cancelled_at: patch.cancelled_at !== undefined ? patch.cancelled_at : (patch.is_cancelled ? nowIso : null),
      ship_id: row.shipId || null, work_order_id: row.workOrderId || null, description: row.description || null,
      created_by: actor, updated_at: nowIso,
    }
    const { data, error } = await thirdPartyCcEntriesRepository.upsertBySourceKey(payload)
    if (error) throw new Error(error)
    saved = data
  }

  await logCellChange({
    ...AUDIT_META,
    entityId: saved?.id || row.sourceKey || row.id,
    entityName: `${account.legal_name || account.operational_name} · Remito ${row.remitoNumber}`,
    field: 'rate_usd_applied' in patch ? 'rate_usd_applied' : 'is_cancelled',
    fieldLabel: 'rate_usd_applied' in patch ? 'Tarifa Especial US$/kg' : 'Estado Cancelado',
    oldValue: 'rate_usd_applied' in patch ? row.rateUsdApplied : row.isCancelled,
    newValue: 'rate_usd_applied' in patch ? patch.rate_usd_applied : patch.is_cancelled,
    changeOrigin: 'INLINE_CELL',
    user: actor,
  })
  return saved
}

export async function saveCcManualEntryService({ account, formData, editingEntry = null, actor = 'ADMIN' }) {
  if (!account?.id) throw new Error('Cuenta corriente no seleccionada.')
  const weightKg = Number(formData.weight_kg || 0)
  const rateUsd = Number(formData.rate_usd_applied || 0)
  const hasExplicitAmount = formData.amount_usd !== '' && formData.amount_usd !== null && formData.amount_usd !== undefined
  const amountUsd = hasExplicitAmount ? Number(formData.amount_usd) : Number((weightKg * rateUsd).toFixed(2))
  const entryDate = formData.entry_date || getTodayArIso()

  const payload = {
    account_id: account.id, entry_source: 'MANUAL', remito_number: formData.remito_number?.trim() || 'AJUSTE',
    entry_date: entryDate, quincena_label: formatQuincenaLabelAr(entryDate),
    weight_kg: weightKg, rate_usd_applied: rateUsd, is_special_rate: Boolean(formData.is_special_rate),
    special_rate_reason: formData.special_rate_reason?.trim() || null, amount_usd: amountUsd,
    ship_id: formData.ship_id || null, work_order_id: formData.work_order_id || null,
    description: formData.description?.trim() || null, updated_at: new Date().toISOString(),
  }

  const res = editingEntry?.id
    ? await thirdPartyCcEntriesRepository.updateById(editingEntry.id, payload)
    : await thirdPartyCcEntriesRepository.insertOne({ ...payload, created_by: actor })
  if (res.error) throw new Error(res.error)

  await logRowAction({
    action: editingEntry?.id ? 'MODAL_SAVE' : 'ROW_INSERT',
    ...AUDIT_META, entityId: res.data.id,
    entityName: `${account.legal_name || account.operational_name} · ${payload.remito_number}`,
    rowData: res.data, changeOrigin: 'MODAL_FORM', user: actor,
  })
  return res.data
}

export async function deleteCcManualEntryService({ entry, actor = 'ADMIN' }) {
  const id = entry.overrideId || entry.id
  const { error } = await thirdPartyCcEntriesRepository.deleteById(id)
  if (error) throw new Error(error)
  await logRowAction({
    action: 'ROW_DELETE', ...AUDIT_META, entityId: id,
    entityName: `Ajuste DEBE ${entry.remitoNumber}`,
    rowData: { remitoNumber: entry.remitoNumber, amountUsd: entry.amountUsd },
    changeOrigin: 'GRID_ACTION', user: actor,
  })
}

export async function saveCcPaymentService({ account, formData, editingPayment = null, actor = 'ADMIN' }) {
  if (!account?.id) throw new Error('Cuenta corriente no seleccionada.')
  const hasIva = Boolean(formData.has_iva)
  const ivaPct = Number(formData.iva_pct ?? 21)
  const { netUsd, grossUsdWithIva } = computePaymentNetUsd({
    paymentType: formData.payment_type, amountUsd: formData.amount_usd, amountArs: formData.amount_ars,
    exchangeRate: formData.exchange_rate, hasIva, ivaPct,
  })
  if (netUsd <= 0) throw new Error('El importe neto en US$ debe ser mayor a 0.')

  const isCashUsd = formData.payment_type === 'EFECTIVO_USD'
  const payload = {
    account_id: account.id, payment_date: formData.payment_date || getTodayArIso(), payment_type: formData.payment_type,
    amount_usd: netUsd, amount_ars: isCashUsd ? 0 : Number(formData.amount_ars || 0),
    exchange_rate: isCashUsd ? null : (Number(formData.exchange_rate) || null),
    has_iva: isCashUsd ? false : hasIva, iva_pct: ivaPct, gross_usd_with_iva: grossUsdWithIva,
    has_invoice: Boolean(formData.has_invoice), invoice_number: formData.invoice_number?.trim() || null,
    panol_remito_number: formData.panol_remito_number?.trim() || null, source_module: 'MANUAL',
    observations: formData.observations?.trim() || null, updated_at: new Date().toISOString(),
  }

  const res = editingPayment?.id
    ? await thirdPartyCcPaymentsRepository.updateById(editingPayment.id, payload)
    : await thirdPartyCcPaymentsRepository.insertOne({ ...payload, created_by: actor })
  if (res.error) throw new Error(res.error)

  await logRowAction({
    action: editingPayment?.id ? 'MODAL_SAVE' : 'ROW_INSERT',
    ...AUDIT_META, entityId: res.data.id,
    entityName: `${account.legal_name || account.operational_name} · Pago US$ ${netUsd}`,
    rowData: res.data, changeOrigin: 'MODAL_FORM', user: actor,
  })
  return res.data
}

export async function deleteCcPaymentService({ payment, actor = 'ADMIN' }) {
  const { error } = await thirdPartyCcPaymentsRepository.deleteById(payment.id)
  if (error) throw new Error(error)
  await logRowAction({
    action: 'ROW_DELETE', ...AUDIT_META, entityId: payment.id,
    entityName: `Pago US$ ${payment.amount_usd} (${payment.payment_type})`,
    rowData: payment, changeOrigin: 'GRID_ACTION', user: actor,
  })
}
