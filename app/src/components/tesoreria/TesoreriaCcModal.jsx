/**
 * TesoreriaCcModal.jsx
 * Modal de carga y edición de movimientos de Cuenta Corriente & Pagos (Graciela).
 * Reemplaza la planilla externa IMPORT.CC.CONTRATADOS / REGISTRO.PAGOS y vincula PRCs oficiales (#2000+).
 */
import React, { useState, useMemo, useEffect, useRef } from 'react'
import { X, Save, DollarSign, FileText, Info } from 'lucide-react'
import {
  CONTRACTOR_CC_CATEGORIES, CONTRACTOR_CC_DIRECTIONS, CONTRACTOR_CC_INVOICE_STATUSES,
  CONTRACTOR_CC_PAYMENT_METHODS, CONTRACTOR_CC_SCOPES,
} from '../../schemas/contractorCc.schema'
import { PRC_BUSINESS_RULE_NOTICE } from '../../schemas/prcRegistry.schema'
import {
  CC_CATEGORY_META, CC_INVOICE_STATUS_META, CC_PAYMENT_METHOD_LABELS,
  CC_SCOPE_LABELS, DEFAULT_DIRECTION_BY_CATEGORY, normalizeContractorKey,
} from '../../lib/contractorCcRules'
import {
  buildInitialCcMovementForm, resolveMatchedContractorId, validateCcMovementForm,
} from '../../lib/contractorCcFormHelpers'
import { formatPrcNumberLabel } from '../../lib/prcRegistryRules'

function Field({ label, children, className = '' }) {
  return (
    <label className={`space-y-1 ${className}`.trim()}>
      <span className="text-[10px] font-bold uppercase text-slate-400">{label}</span>
      {children}
    </label>
  )
}

const INPUT_CLS = 'w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white'

export default function TesoreriaCcModal({
  isOpen = false, initialRow = null, presetInvoiceOnly = false, presetDefaults = null, currentPeriod = '',
  availablePeriods = [], fortnightDollarRate = 1500, contractors = [], prcs = [], ships = [], workOrders = [],
  onClose, onSave,
}) {
  const [form, setForm] = useState(() =>
    buildInitialCcMovementForm({ initialRow, currentPeriod, fortnightDollarRate, presetInvoiceOnly, presetDefaults })
  )
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const invoiceInputRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    setForm(buildInitialCcMovementForm({ initialRow, currentPeriod, fortnightDollarRate, presetInvoiceOnly, presetDefaults }))
    setErrorMsg('')
    if (presetInvoiceOnly) setTimeout(() => invoiceInputRef.current?.focus(), 60)
  }, [isOpen, initialRow, currentPeriod, fortnightDollarRate, presetInvoiceOnly, presetDefaults])

  const filteredWos = useMemo(
    () => (form.ship_id ? (workOrders || []).filter((wo) => wo.ship_id === form.ship_id) : workOrders),
    [workOrders, form.ship_id]
  )

  const availablePrcs = useMemo(() => {
    const key = normalizeContractorKey(form.contractor_group)
    return (prcs || [])
      .filter((p) => p.status !== 'ANULADO' && (!key || normalizeContractorKey(p.contractor_name) === key))
      .sort((a, b) => Number(b.prc_number || 0) - Number(a.prc_number || 0))
  }, [prcs, form.contractor_group])

  if (!isOpen) return null

  const updateField = (key, val) => setForm((prev) => ({ ...prev, [key]: val }))

  const handleCategoryChange = (nextCategory) => {
    setForm((prev) => ({
      ...prev,
      category: nextCategory,
      direction: initialRow ? prev.direction : (DEFAULT_DIRECTION_BY_CATEGORY[nextCategory] || prev.direction),
      settlement_scope: !initialRow && nextCategory === 'DEVENGADO_PRC' ? 'PRESUPUESTO' : prev.settlement_scope,
    }))
  }

  const handleArsChange = (val) => {
    const numArs = Number(val)
    const fx = Number(form.exchange_rate)
    const nextUsd = Number.isFinite(numArs) && numArs > 0 && Number.isFinite(fx) && fx > 0
      ? (numArs / fx).toFixed(2)
      : (val === '' ? '' : form.amount_usd)
    setForm((prev) => ({ ...prev, amount_ars: val, amount_usd: nextUsd }))
  }

  const handlePrcSelect = (prcId) => {
    const chosen = (prcs || []).find((p) => p.id === prcId)
    if (!chosen) return updateField('prc_id', '')
    setForm((prev) => ({
      ...prev,
      prc_id: chosen.id,
      settlement_scope: 'PRESUPUESTO',
      contractor_group: prev.contractor_group || chosen.contractor_name || '',
      ship_id: chosen.ship_id || prev.ship_id,
      work_order_id: chosen.work_order_id || prev.work_order_id,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validationErr = validateCcMovementForm(form)
    if (validationErr) return setErrorMsg(validationErr)
    const matchedContrId = resolveMatchedContractorId(form.contractor_group, contractors)
    try {
      setSaving(true)
      setErrorMsg('')
      await onSave?.({
        id: initialRow?.id || null,
        payload: {
          ...form,
          contractor_worker_id: matchedContrId || form.contractor_worker_id || null,
          prc_id: form.prc_id || null, ship_id: form.ship_id || null,
          work_order_id: form.work_order_id || null, payment_method: form.payment_method || null,
        },
      })
    } catch (err) {
      setErrorMsg(err?.message || 'No se pudo guardar el movimiento.')
    } finally {
      setSaving(false)
    }
  }

  const periodOptions = Array.from(new Set([form.period_key, currentPeriod, ...(availablePeriods || [])].filter(Boolean)))
  const hasHistoricalContractor = form.contractor_group && !contractors.some((c) => c.name === form.contractor_group)

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 font-sans">
      <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-emerald-500/40 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="px-4 py-3 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-black text-white">
              {presetInvoiceOnly ? 'Completar Factura Pendiente' : initialRow ? 'Editar Movimiento de Cuenta Corriente' : 'Nuevo Movimiento de Cuenta Corriente'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto text-xs">
          {errorMsg && <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-500/60 text-rose-200 font-bold">{errorMsg}</div>}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <Field label="Fecha"><input type="date" value={form.movement_date} onChange={(e) => updateField('movement_date', e.target.value)} className={INPUT_CLS} /></Field>
            <Field label="Quincena">
              <select value={form.period_key} onChange={(e) => updateField('period_key', e.target.value)} className={INPUT_CLS}>
                {periodOptions.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Contratista *">
              <select value={form.contractor_group} onChange={(e) => updateField('contractor_group', e.target.value)} className={`${INPUT_CLS} font-semibold`}>
                <option value="">Seleccionar contratista...</option>
                {hasHistoricalContractor && <option value={form.contractor_group}>{form.contractor_group}</option>}
                {contractors.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <Field label="Categoría">
              <select value={form.category} onChange={(e) => handleCategoryChange(e.target.value)} className={INPUT_CLS}>
                {CONTRACTOR_CC_CATEGORIES.map((c) => <option key={c} value={c}>{CC_CATEGORY_META[c]?.label || c}</option>)}
              </select>
            </Field>
            <Field label="Dirección (DEBE / HABER)">
              <select value={form.direction} onChange={(e) => updateField('direction', e.target.value)} className={`${INPUT_CLS} font-bold`}>
                {CONTRACTOR_CC_DIRECTIONS.map((d) => <option key={d} value={d}>{d === 'DEBE' ? 'DEBE (Descuento / Pago emitido)' : 'HABER (A favor del contratista)'}</option>)}
              </select>
            </Field>
            <Field label="Alcance">
              <select value={form.settlement_scope} onChange={(e) => updateField('settlement_scope', e.target.value)} className={INPUT_CLS}>
                {CONTRACTOR_CC_SCOPES.map((s) => <option key={s} value={s}>{CC_SCOPE_LABELS[s] || s}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <Field label="PRC Oficial (#2000+)">
              <select value={form.prc_id} onChange={(e) => handlePrcSelect(e.target.value)} className="w-full bg-slate-950 border border-amber-700/60 rounded-lg px-2.5 py-1.5 text-amber-200">
                <option value="">Sin PRC específico</option>
                {availablePrcs.map((p) => (
                  <option key={p.id} value={p.id}>{formatPrcNumberLabel(p.prc_number)} · {p.contractor_name} · AR$ {Number(p.amount_ars || 0).toLocaleString('es-AR')}</option>
                ))}
              </select>
            </Field>
            <Field label="Barco">
              <select value={form.ship_id} onChange={(e) => { updateField('ship_id', e.target.value); updateField('work_order_id', '') }} className={INPUT_CLS}>
                <option value="">General / Sin barco</option>
                {ships.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Orden de Trabajo">
              <select value={form.work_order_id} onChange={(e) => updateField('work_order_id', e.target.value)} className={INPUT_CLS}>
                <option value="">Sin OT específica</option>
                {filteredWos.map((wo) => <option key={wo.id} value={wo.id}>{wo.ot_number ? `OT-${wo.ot_number}` : ''} {wo.title}</option>)}
              </select>
            </Field>
          </div>

          {form.settlement_scope === 'PRESUPUESTO' && (
            <div className="px-2.5 py-1.5 rounded-lg bg-amber-950/30 border border-amber-500/30 text-[10px] text-amber-200 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{PRC_BUSINESS_RULE_NOTICE}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <Field label="Importe AR$ *">
              <input type="number" step="0.01" min="0" value={form.amount_ars} onChange={(e) => handleArsChange(e.target.value)} placeholder="0.00" className="w-full bg-slate-950 border border-emerald-700/60 rounded-lg px-2.5 py-1.5 text-emerald-300 font-mono font-bold" />
            </Field>
            <Field label="Cotización Dólar">
              <input type="number" step="0.01" min="0" value={form.exchange_rate} onChange={(e) => updateField('exchange_rate', e.target.value)} className={`${INPUT_CLS} font-mono`} />
            </Field>
            <Field label="Equiv. US$">
              <input type="number" step="0.01" min="0" value={form.amount_usd} onChange={(e) => updateField('amount_usd', e.target.value)} placeholder="Auto" className={`${INPUT_CLS} font-mono`} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <Field label="Medio de Pago">
              <select value={form.payment_method} onChange={(e) => updateField('payment_method', e.target.value)} className={INPUT_CLS}>
                <option value="">Sin especificar</option>
                {CONTRACTOR_CC_PAYMENT_METHODS.map((m) => <option key={m} value={m}>{CC_PAYMENT_METHOD_LABELS[m] || m}</option>)}
              </select>
            </Field>
            <Field label="Nº Cheque / Ref."><input type="text" value={form.payment_reference} onChange={(e) => updateField('payment_reference', e.target.value)} placeholder="Ej: eCheq #4512" className={INPUT_CLS} /></Field>
            <Field label="Estado Factura">
              <select value={form.invoice_status} onChange={(e) => updateField('invoice_status', e.target.value)} className={INPUT_CLS}>
                {CONTRACTOR_CC_INVOICE_STATUSES.map((st) => <option key={st} value={st}>{CC_INVOICE_STATUS_META[st]?.label || st}</option>)}
              </select>
            </Field>
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1"><FileText className="w-3 h-3 text-cyan-400" /> Nº Factura</span>
              <input ref={invoiceInputRef} type="text" value={form.invoice_number} onChange={(e) => updateField('invoice_number', e.target.value)} placeholder="Ej: C-0002-000145" className={`${INPUT_CLS} font-mono`} />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400">Observaciones</span>
            <textarea rows={2} value={form.observations} onChange={(e) => updateField('observations', e.target.value)} placeholder="Detalle de pago, seguro/botines descontados o aclaración..." className={INPUT_CLS} />
          </label>

          <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer">Cancelar</button>
            <button type="submit" disabled={saving} className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black inline-flex items-center gap-1.5 cursor-pointer">
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Guardando...' : 'Guardar Movimiento'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
