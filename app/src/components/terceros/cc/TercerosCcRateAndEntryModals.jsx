/**
 * TercerosCcRateAndEntryModals.jsx
 * Modales Stepper Canónicos (FL-020) para:
 * 1. Gestión inmutable de Tarifario US$/kg por vigencia (`TercerosCcRateHistoryModal`)
 * 2. Alta/Edición de ajustes manuales en el DEBE (`TercerosCcManualEntryModal`)
 */
import React, { useState, useEffect } from 'react'
import { SlidersHorizontal, FilePlus2, Save, Plus } from 'lucide-react'
import { CanonicalStepperModal, CanonicalStepperStep } from '../../canonical/CanonicalStepperModal'
import { TERCEROS_CC_RATE_STEP_HELP, TERCEROS_CC_MANUAL_ENTRY_STEP_HELP } from '../../../lib/businessHelpRegistry'
import { getTodayArIso, formatDateAr } from '../../../lib/dateTimeCanonical'

const INPUT_CLS = 'w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-400'

export function TercerosCcRateHistoryModal({
  isOpen = false,
  onClose,
  account = null,
  rateHistory = [],
  onAddRate,
}) {
  const [effectiveFrom, setEffectiveFrom] = useState(getTodayArIso())
  const [rateUsdPerKg, setRateUsdPerKg] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (isOpen) {
      setEffectiveFrom(getTodayArIso())
      setRateUsdPerKg(String(account?.current_rate_usd ?? ''))
      setNotes('')
      setErrorMsg('')
    }
  }, [isOpen, account])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    try {
      setSaving(true)
      await onAddRate?.({ effectiveFrom, rateUsdPerKg, notes })
      onClose?.()
    } catch (err) {
      setErrorMsg(err?.message || 'Error al registrar tarifa.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <CanonicalStepperModal
      isOpen={isOpen}
      onClose={onClose}
      title="Tarifario Histórico US$/kg"
      subtitle={`Cuenta: ${account?.legal_name || account?.operational_name || ''}`}
      icon={<SlidersHorizontal className="w-5 h-5 text-sky-400" />}
      maxWidthClass="max-w-2xl"
      onSubmit={handleSubmit}
      footerLeft={errorMsg ? <span className="text-rose-300 font-bold">{errorMsg}</span> : null}
      footerRight={
        <>
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer">
            Cerrar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-black inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{saving ? 'Guardando...' : 'Aplicar Nueva Vigencia'}</span>
          </button>
        </>
      }
    >
      <CanonicalStepperStep step={1} helpEntry={TERCEROS_CC_RATE_STEP_HELP[1]} title="1. Vigencias Registradas y Nueva Tarifa" isLast>
        <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/70 divide-y divide-slate-800">
          {(rateHistory || []).length === 0 ? (
            <div className="p-3 text-slate-500 text-center">Sin vigencias históricas cargadas todavía.</div>
          ) : (
            rateHistory.map((rh, idx) => (
              <div key={rh.id} className="px-3 py-1.5 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-cyan-300 font-bold">Desde {formatDateAr(rh.effective_from)}</span>
                  {idx === 0 && <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700 text-[9px] font-black">VIGENTE</span>}
                  {rh.notes && <span className="text-slate-400">{rh.notes}</span>}
                </div>
                <span className="font-mono font-black text-white">US$ {Number(rh.rate_usd_per_kg).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}/kg</span>
              </div>
            ))
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Vigente Desde</label>
            <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className={INPUT_CLS} required />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Nueva Tarifa US$/kg</label>
            <input type="number" step="0.0001" value={rateUsdPerKg} onChange={(e) => setRateUsdPerKg(e.target.value)} className={INPUT_CLS} required />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Motivo / Acuerdo</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej. Actualización quincenal" className={INPUT_CLS} />
          </div>
        </div>
      </CanonicalStepperStep>
    </CanonicalStepperModal>
  )
}

export function TercerosCcManualEntryModal({
  isOpen = false,
  onClose,
  account = null,
  editingEntry = null,
  onSave,
}) {
  const [formData, setFormData] = useState({
    entry_date: getTodayArIso(),
    remito_number: '',
    weight_kg: '0',
    rate_usd_applied: String(account?.current_rate_usd ?? 0),
    amount_usd: '',
    is_special_rate: false,
    special_rate_reason: '',
    description: '',
  })
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!isOpen) return
    if (editingEntry) {
      setFormData({
        entry_date: editingEntry.entryDate || getTodayArIso(),
        remito_number: editingEntry.remitoNumber || '',
        weight_kg: String(editingEntry.weightKg ?? 0),
        rate_usd_applied: String(editingEntry.rateUsdApplied ?? 0),
        amount_usd: String(editingEntry.amountUsd ?? ''),
        is_special_rate: Boolean(editingEntry.isSpecialRate),
        special_rate_reason: editingEntry.specialRateReason || '',
        description: editingEntry.description || '',
      })
    } else {
      setFormData({
        entry_date: getTodayArIso(),
        remito_number: '',
        weight_kg: '0',
        rate_usd_applied: String(account?.current_rate_usd ?? 0),
        amount_usd: '',
        is_special_rate: false,
        special_rate_reason: '',
        description: '',
      })
    }
    setErrorMsg('')
  }, [isOpen, editingEntry, account])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    try {
      setSaving(true)
      await onSave?.(formData, editingEntry)
      onClose?.()
    } catch (err) {
      setErrorMsg(err?.message || 'Error al guardar el ajuste.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <CanonicalStepperModal
      isOpen={isOpen}
      onClose={onClose}
      title={editingEntry ? 'Editar Ajuste Manual DEBE' : 'Nuevo Ajuste / Trabajo Manual (DEBE)'}
      subtitle={`Cuenta: ${account?.legal_name || account?.operational_name || ''}`}
      icon={<FilePlus2 className="w-5 h-5 text-amber-400" />}
      maxWidthClass="max-w-2xl"
      onSubmit={handleSubmit}
      footerLeft={errorMsg ? <span className="text-rose-300 font-bold">{errorMsg}</span> : null}
      footerRight={
        <>
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black inline-flex items-center gap-1.5 cursor-pointer">
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Guardando...' : 'Guardar Ajuste DEBE'}</span>
          </button>
        </>
      }
    >
      <CanonicalStepperStep step={1} helpEntry={TERCEROS_CC_MANUAL_ENTRY_STEP_HELP[1]} title="1. Datos del Trabajo o Ajuste" isLast>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Fecha</label>
            <input type="date" value={formData.entry_date} onChange={(e) => setFormData((p) => ({ ...p, entry_date: e.target.value }))} className={INPUT_CLS} required />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Nº Remito / Ref.</label>
            <input type="text" value={formData.remito_number} onChange={(e) => setFormData((p) => ({ ...p, remito_number: e.target.value }))} placeholder="Ej. 2320 / AJUSTE" className={INPUT_CLS} required />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Kilos (opcional)</label>
            <input type="number" step="0.01" value={formData.weight_kg} onChange={(e) => setFormData((p) => ({ ...p, weight_kg: e.target.value }))} className={INPUT_CLS} />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Tarifa US$/kg</label>
            <input type="number" step="0.0001" value={formData.rate_usd_applied} onChange={(e) => setFormData((p) => ({ ...p, rate_usd_applied: e.target.value }))} className={INPUT_CLS} />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Monto Directo US$ (opcional)</label>
            <input type="number" step="0.01" value={formData.amount_usd} onChange={(e) => setFormData((p) => ({ ...p, amount_usd: e.target.value }))} placeholder="O calcula Kg × Tarifa" className={INPUT_CLS} />
          </div>
          <label className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 mt-4 cursor-pointer">
            <input type="checkbox" checked={formData.is_special_rate} onChange={(e) => setFormData((p) => ({ ...p, is_special_rate: e.target.checked }))} />
            <span className="text-xs text-sky-300 font-bold">Marcar tarifa azul</span>
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input type="text" value={formData.special_rate_reason} onChange={(e) => setFormData((p) => ({ ...p, special_rate_reason: e.target.value }))} placeholder="Motivo tarifa especial (si aplica)" className={INPUT_CLS} />
          <input type="text" value={formData.description} onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))} placeholder="Descripción del trabajo / observación" className={INPUT_CLS} />
        </div>
      </CanonicalStepperStep>
    </CanonicalStepperModal>
  )
}
