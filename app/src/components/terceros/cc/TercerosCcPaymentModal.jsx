/**
 * TercerosCcPaymentModal.jsx
 * Modal Stepper Canónico (FL-020) para registrar pagos o compensaciones (HABER)
 * con conversión AR$/TC y descuento automático de IVA 21%.
 */
import React, { useState, useEffect, useMemo } from 'react'
import { Banknote, Save } from 'lucide-react'
import { CanonicalStepperModal, CanonicalStepperStep } from '../../canonical/CanonicalStepperModal'
import { TERCEROS_CC_PAYMENT_STEP_HELP } from '../../../lib/businessHelpRegistry'
import { getTodayArIso } from '../../../lib/dateTimeCanonical'
import { getDollarRateForDate } from '../../../lib/tercerosConstants'
import { computePaymentNetUsd } from '../../../lib/thirdPartyCcEngine'

const INPUT_CLS = 'w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400'

export default function TercerosCcPaymentModal({
  isOpen = false,
  onClose,
  account = null,
  editingPayment = null,
  macroVariables = [],
  onSave,
}) {
  const [formData, setFormData] = useState({
    payment_date: getTodayArIso(),
    payment_type: 'TRANSFERENCIA_ARS',
    amount_usd: '',
    amount_ars: '',
    exchange_rate: '1500',
    has_iva: false,
    iva_pct: '21',
    has_invoice: false,
    invoice_number: '',
    panol_remito_number: '',
    observations: '',
  })
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!isOpen) return
    if (editingPayment) {
      setFormData({
        payment_date: editingPayment.payment_date || getTodayArIso(),
        payment_type: editingPayment.payment_type || 'TRANSFERENCIA_ARS',
        amount_usd: String(editingPayment.amount_usd ?? ''),
        amount_ars: String(editingPayment.amount_ars ?? ''),
        exchange_rate: String(editingPayment.exchange_rate ?? getDollarRateForDate(editingPayment.payment_date || getTodayArIso(), macroVariables)),
        has_iva: Boolean(editingPayment.has_iva),
        iva_pct: String(editingPayment.iva_pct ?? 21),
        has_invoice: Boolean(editingPayment.has_invoice),
        invoice_number: editingPayment.invoice_number || '',
        panol_remito_number: editingPayment.panol_remito_number || '',
        observations: editingPayment.observations || '',
      })
    } else {
      const today = getTodayArIso()
      setFormData({
        payment_date: today,
        payment_type: 'TRANSFERENCIA_ARS',
        amount_usd: '',
        amount_ars: '',
        exchange_rate: String(getDollarRateForDate(today, macroVariables)),
        has_iva: false,
        iva_pct: '21',
        has_invoice: false,
        invoice_number: '',
        panol_remito_number: '',
        observations: '',
      })
    }
    setErrorMsg('')
  }, [isOpen, editingPayment, macroVariables])

  const preview = useMemo(() => computePaymentNetUsd({
    paymentType: formData.payment_type,
    amountUsd: formData.amount_usd,
    amountArs: formData.amount_ars,
    exchangeRate: formData.exchange_rate,
    hasIva: formData.has_iva,
    ivaPct: formData.iva_pct,
  }), [formData])

  const isCashUsd = formData.payment_type === 'EFECTIVO_USD'
  const isPanolComp = formData.payment_type === 'COMPENSACION_PANOL'

  const handleDateChange = (nextDate) => {
    const suggestedTc = getDollarRateForDate(nextDate, macroVariables)
    setFormData((prev) => ({
      ...prev,
      payment_date: nextDate,
      exchange_rate: prev.exchange_rate ? prev.exchange_rate : String(suggestedTc),
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    try {
      setSaving(true)
      await onSave?.(formData, editingPayment)
      onClose?.()
    } catch (err) {
      setErrorMsg(err?.message || 'Error al registrar el pago.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <CanonicalStepperModal
      isOpen={isOpen}
      onClose={onClose}
      title={editingPayment ? 'Editar Pago / Compensación' : 'Registrar Pago / Canje (HABER)'}
      subtitle={`Cuenta: ${account?.legal_name || account?.operational_name || ''}`}
      icon={<Banknote className="w-5 h-5 text-emerald-400" />}
      maxWidthClass="max-w-3xl"
      onSubmit={handleSubmit}
      footerLeft={errorMsg ? <span className="text-rose-300 font-bold">{errorMsg}</span> : (
        <span className="text-xs text-emerald-300 font-mono font-bold">
          Neto a imputar en C.C.: +US$ {preview.netUsd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          {preview.grossUsdWithIva ? ` (Bruto c/IVA: US$ ${preview.grossUsdWithIva.toLocaleString('es-AR', { minimumFractionDigits: 2 })})` : ''}
        </span>
      )}
      footerRight={
        <>
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || preview.netUsd <= 0}
            className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Guardando...' : 'Guardar Movimiento'}</span>
          </button>
        </>
      }
    >
      <CanonicalStepperStep step={1} helpEntry={TERCEROS_CC_PAYMENT_STEP_HELP[1]} title="1. Fecha y Modalidad de Cancelación">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Fecha de Pago / Canje</label>
            <input type="date" value={formData.payment_date} onChange={(e) => handleDateChange(e.target.value)} className={INPUT_CLS} required />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Modalidad</label>
            <select value={formData.payment_type} onChange={(e) => setFormData((p) => ({ ...p, payment_type: e.target.value }))} className={INPUT_CLS}>
              <option value="EFECTIVO_USD">Efectivo US$ (Dólares billete)</option>
              <option value="TRANSFERENCIA_ARS">Transferencia / Pesos AR$</option>
              <option value="ECHEQ_ARS">E-Cheqs AR$ (c/ o s/ Factura)</option>
              <option value="COMPENSACION_PANOL">Compensación Remito Pañol (Manual)</option>
              <option value="COMPENSACION_TRABAJO">Canje por Trabajo / Insumo AlonCar</option>
            </select>
          </div>
        </div>
      </CanonicalStepperStep>

      <CanonicalStepperStep step={2} helpEntry={TERCEROS_CC_PAYMENT_STEP_HELP[2]} title="2. Importes, IVA, Comprobante y Observaciones" isLast>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {isCashUsd ? (
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Importe US$ Billete</label>
              <input type="number" step="0.01" value={formData.amount_usd} onChange={(e) => setFormData((p) => ({ ...p, amount_usd: e.target.value }))} placeholder="6000" className={INPUT_CLS} required />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Importe Pesos AR$ (opcional si ponés US$)</label>
                <input type="number" step="0.01" value={formData.amount_ars} onChange={(e) => setFormData((p) => ({ ...p, amount_ars: e.target.value }))} placeholder="36000000" className={INPUT_CLS} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Tipo de Cambio (AR$/US$)</label>
                <input type="number" step="0.01" value={formData.exchange_rate} onChange={(e) => setFormData((p) => ({ ...p, exchange_rate: e.target.value }))} className={INPUT_CLS} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">O Importe Directo US$</label>
                <input type="number" step="0.01" value={formData.amount_usd} onChange={(e) => setFormData((p) => ({ ...p, amount_usd: e.target.value }))} placeholder="Si no va por AR$" className={INPUT_CLS} />
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {!isCashUsd && (
            <label className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 cursor-pointer">
              <input type="checkbox" checked={formData.has_iva} onChange={(e) => setFormData((p) => ({ ...p, has_iva: e.target.checked }))} />
              <span className="text-xs text-slate-200 font-bold">Descontar IVA ({formData.iva_pct}%)</span>
            </label>
          )}
          <label className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 cursor-pointer">
            <input type="checkbox" checked={formData.has_invoice} onChange={(e) => setFormData((p) => ({ ...p, has_invoice: e.target.checked }))} />
            <span className="text-xs text-slate-200 font-bold">Con Factura Fiscal</span>
          </label>
          {formData.has_invoice && (
            <input type="text" value={formData.invoice_number} onChange={(e) => setFormData((p) => ({ ...p, invoice_number: e.target.value }))} placeholder="Nº Factura (ej. FC Nº 3)" className={INPUT_CLS} />
          )}
          {isPanolComp && (
            <input type="text" value={formData.panol_remito_number} onChange={(e) => setFormData((p) => ({ ...p, panol_remito_number: e.target.value }))} placeholder="Nº Remito Pañol (ej. 1900)" className={INPUT_CLS} />
          )}
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Observaciones</label>
          <input
            type="text"
            value={formData.observations}
            onChange={(e) => setFormData((p) => ({ ...p, observations: e.target.value }))}
            placeholder="Ej. Pagado con 4 E-Cheqs / Remito Pañol / Mecanizado polea..."
            className={INPUT_CLS}
          />
        </div>
      </CanonicalStepperStep>
    </CanonicalStepperModal>
  )
}
