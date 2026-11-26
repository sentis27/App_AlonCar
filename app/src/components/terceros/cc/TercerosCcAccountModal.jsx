/**
 * TercerosCcAccountModal.jsx
 * Modal Stepper Canónico (FL-020) para abrir nuevas Cuentas Corrientes a cualquier taller
 * en modalidad POR_KILO o POR_COMPROBANTE.
 */
import React, { useState, useMemo } from 'react'
import { Wallet, Save } from 'lucide-react'
import { CanonicalStepperModal, CanonicalStepperStep } from '../../canonical/CanonicalStepperModal'
import { TERCEROS_CC_ACCOUNT_STEP_HELP } from '../../../lib/businessHelpRegistry'
import { getTodayArIso } from '../../../lib/dateTimeCanonical'

const INPUT_CLS = 'w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400'

export default function TercerosCcAccountModal({
  isOpen = false,
  onClose,
  contractors = [],
  existingAccounts = [],
  onSave,
}) {
  const existingWorkerIds = useMemo(
    () => new Set((existingAccounts || []).filter((a) => a.is_active !== false).map((a) => a.worker_id)),
    [existingAccounts]
  )
  const availableWorkers = useMemo(
    () => (contractors || []).filter((w) => !existingWorkerIds.has(w.id)),
    [contractors, existingWorkerIds]
  )

  const [formData, setFormData] = useState({
    worker_id: '',
    legal_name: '',
    pricing_mode: 'PER_KG',
    current_rate_usd: '1.25',
    opening_balance_usd: '0',
    opening_balance_date: getTodayArIso(),
    cancellation_mode: 'FIFO',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleWorkerChange = (workerId) => {
    const found = availableWorkers.find((w) => w.id === workerId)
    setFormData((prev) => ({
      ...prev,
      worker_id: workerId,
      legal_name: found ? found.name : prev.legal_name,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    try {
      setSaving(true)
      await onSave?.(formData)
      onClose?.()
    } catch (err) {
      setErrorMsg(err?.message || 'No se pudo crear la cuenta corriente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <CanonicalStepperModal
      isOpen={isOpen}
      onClose={onClose}
      title="Nueva Cuenta Corriente de Taller"
      subtitle="Habilitá una cuenta por kilo enviado desde Pañol o por comprobantes de Terceros"
      icon={<Wallet className="w-5 h-5 text-emerald-400" />}
      maxWidthClass="max-w-3xl"
      onSubmit={handleSubmit}
      footerLeft={errorMsg ? <span className="text-rose-300 font-bold">{errorMsg}</span> : null}
      footerRight={
        <>
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !formData.worker_id}
            className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Creando...' : 'Crear Cuenta Corriente'}</span>
          </button>
        </>
      }
    >
      <CanonicalStepperStep step={1} helpEntry={TERCEROS_CC_ACCOUNT_STEP_HELP[1]} title="1. Taller, Razón Social y Modalidad">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Nombre Operativo (Padrón)</label>
            <select value={formData.worker_id} onChange={(e) => handleWorkerChange(e.target.value)} className={INPUT_CLS} required>
              <option value="">Seleccionar taller / contratista...</option>
              {availableWorkers.map((w) => (
                <option key={w.id} value={w.id}>{w.name} [{w.trade || 'SIN RUBRO'}]</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Razón Social / Nombre Carpeta</label>
            <input
              type="text"
              value={formData.legal_name}
              onChange={(e) => setFormData((p) => ({ ...p, legal_name: e.target.value }))}
              placeholder="Ej. PAMPA NAVAL"
              className={INPUT_CLS}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">¿Cómo se absorben los trabajos (DEBE)?</label>
            <select
              value={formData.pricing_mode}
              onChange={(e) => setFormData((p) => ({ ...p, pricing_mode: e.target.value }))}
              className={INPUT_CLS}
            >
              <option value="PER_KG">Por Kilo de Material en Pañol (Remitos MATERIALES × Tarifa US$/kg)</option>
              <option value="BY_VOUCHER">Por Comprobante en Terceros (Absorbe facturas/remitos de ese taller)</option>
            </select>
          </div>
        </div>
      </CanonicalStepperStep>

      <CanonicalStepperStep step={2} helpEntry={TERCEROS_CC_ACCOUNT_STEP_HELP[2]} title="2. Tarifa Inicial, Saldo Base y Cancelación" isLast>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {formData.pricing_mode === 'PER_KG' && (
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Tarifa Inicial US$/kg</label>
              <input
                type="number"
                step="0.0001"
                value={formData.current_rate_usd}
                onChange={(e) => setFormData((p) => ({ ...p, current_rate_usd: e.target.value }))}
                className={INPUT_CLS}
              />
            </div>
          )}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Saldo Inicial US$ (0 = en cero)</label>
            <input
              type="number"
              step="0.01"
              value={formData.opening_balance_usd}
              onChange={(e) => setFormData((p) => ({ ...p, opening_balance_usd: e.target.value }))}
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Fecha de Corte / Arranque</label>
            <input
              type="date"
              value={formData.opening_balance_date}
              onChange={(e) => setFormData((p) => ({ ...p, opening_balance_date: e.target.value }))}
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Modo Cancelados (Verde)</label>
            <select
              value={formData.cancellation_mode}
              onChange={(e) => setFormData((p) => ({ ...p, cancellation_mode: e.target.value }))}
              className={INPUT_CLS}
            >
              <option value="FIFO">FIFO Automático (por antigüedad)</option>
              <option value="MANUAL">Manual (tilde fila por fila)</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Notas de Cuenta</label>
            <input
              type="text"
              value={formData.notes}
              onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Ej. Acuerdos especiales, condiciones de pago..."
              className={INPUT_CLS}
            />
          </div>
        </div>
      </CanonicalStepperStep>
    </CanonicalStepperModal>
  )
}
