/**
 * contractorCcFormHelpers.js
 * Helpers puros de formulario y exportación para Cuenta Corriente & Pagos (`/tesoreria?tab=movimientos`).
 */
import { formatDateAr, getTodayArIso } from './dateTimeCanonical.js'
import { normalizeContractorKey } from './contractorCcRules.js'

export function buildInitialCcMovementForm({
  initialRow = null,
  currentPeriod = '',
  fortnightDollarRate = 1500,
  presetInvoiceOnly = false,
  presetDefaults = null,
} = {}) {
  if (initialRow) {
    return {
      movement_date: String(initialRow.movement_date || getTodayArIso()).slice(0, 10),
      period_key: initialRow.period_key || currentPeriod,
      contractor_group: initialRow.contractor_group || '',
      contractor_worker_id: initialRow.contractor_worker_id || '',
      settlement_scope: initialRow.settlement_scope || 'HORA',
      prc_id: initialRow.prc_id || '',
      ship_id: initialRow.ship_id || '',
      work_order_id: initialRow.work_order_id || '',
      category: initialRow.category || 'ADELANTO',
      direction: initialRow.direction || 'DEBE',
      payment_method: initialRow.payment_method || 'TRANSFERENCIA',
      payment_reference: initialRow.payment_reference || '',
      invoice_status: presetInvoiceOnly ? 'CON_FACTURA' : (initialRow.invoice_status || 'NO_APLICA'),
      invoice_number: initialRow.invoice_number || '',
      amount_ars: String(initialRow.amount_ars ?? ''),
      exchange_rate: initialRow.exchange_rate ? String(initialRow.exchange_rate) : String(fortnightDollarRate || 1500),
      amount_usd: initialRow.amount_usd !== null && initialRow.amount_usd !== undefined ? String(initialRow.amount_usd) : '',
      observations: initialRow.observations || '',
      source_module: initialRow.source_module || 'TESORERIA',
      inventory_transaction_ids: initialRow.inventory_transaction_ids || [],
    }
  }
  return {
    movement_date: getTodayArIso(),
    period_key: presetDefaults?.period_key || currentPeriod,
    contractor_group: presetDefaults?.contractor_group || '',
    contractor_worker_id: presetDefaults?.contractor_worker_id || '',
    settlement_scope: presetDefaults?.settlement_scope || 'HORA',
    prc_id: presetDefaults?.prc_id || '',
    ship_id: presetDefaults?.ship_id || '',
    work_order_id: presetDefaults?.work_order_id || '',
    category: presetDefaults?.category || 'ADELANTO',
    direction: presetDefaults?.direction || 'DEBE',
    payment_method: presetDefaults?.payment_method || 'TRANSFERENCIA',
    payment_reference: '',
    invoice_status: 'DEBE_FACTURA',
    invoice_number: '',
    amount_ars: '',
    exchange_rate: String(fortnightDollarRate || 1500),
    amount_usd: '',
    observations: '',
    source_module: 'TESORERIA',
    inventory_transaction_ids: [],
  }
}

export function validateCcMovementForm(form = {}) {
  if (!String(form.contractor_group || '').trim()) return 'Seleccioná un contratista.'
  if (!/^\d{4}-\d{2}-(1Q|2Q)$/.test(String(form.period_key || '').trim())) {
    return 'La quincena debe tener formato YYYY-MM-1Q o YYYY-MM-2Q (ej. 2026-11-2Q).'
  }
  const amt = Number(form.amount_ars)
  if (!Number.isFinite(amt) || amt < 0) return 'Ingresá un importe válido en AR$.'
  if (form.invoice_status === 'CON_FACTURA' && !String(form.invoice_number || '').trim()) {
    return 'Si seleccionás Con Factura, ingresá el Nº de factura o cambiá el estado a DEBE FACTURA.'
  }
  return null
}

export function resolveMatchedContractorId(contractorGroup, contractors = []) {
  const key = normalizeContractorKey(contractorGroup)
  return contractors.find((c) => normalizeContractorKey(c.name) === key)?.id || null
}

export function buildCcExportPayload(filteredRows = [], periodLabel = 'historico') {
  return {
    filename: `cuenta_corriente_contratistas_${periodLabel}`,
    rows: filteredRows.map((r) => ({
      fecha: formatDateAr(r.movement_date),
      quincena: r.period_key,
      contratista: r.contractor_group,
      categoria: r.categoryLabel,
      alcance: r.settlement_scope,
      prc: r.prcDisplay,
      barco: r.shipName,
      ot: r.otLabel,
      medio: r.paymentMethodLabel,
      ref: r.payment_reference || '',
      facturaEstado: r.invoiceLabel,
      facturaNro: r.invoice_number || '',
      debeArs: r.debeArs,
      haberArs: r.haberArs,
      observaciones: r.observations || '',
    })),
    columns: [
      { key: 'fecha', label: 'Fecha' }, { key: 'quincena', label: 'Quincena' }, { key: 'contratista', label: 'Contratista' },
      { key: 'categoria', label: 'Categoría' }, { key: 'alcance', label: 'Alcance' }, { key: 'prc', label: 'Nº PRC' },
      { key: 'barco', label: 'Barco' }, { key: 'ot', label: 'OT' }, { key: 'medio', label: 'Medio de Pago' },
      { key: 'ref', label: 'Referencia' }, { key: 'facturaEstado', label: 'Estado Factura' }, { key: 'facturaNro', label: 'Nº Factura' },
      { key: 'debeArs', label: 'DEBE AR$' }, { key: 'haberArs', label: 'HABER AR$' }, { key: 'observaciones', label: 'Observaciones' },
    ],
  }
}
