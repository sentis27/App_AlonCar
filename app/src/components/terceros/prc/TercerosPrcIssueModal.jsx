/**
 * TercerosPrcIssueModal.jsx
 * Modal de emisión (con Doble Confirmación), adicional vinculado y edición de detalle
 * manteniendo el `prc_number` 100% inmutable.
 */
import React, { useState, useEffect, useMemo } from 'react'
import { FileSpreadsheet, ShieldCheck, Lock, X, AlertTriangle, GitBranchPlus, Save } from 'lucide-react'
import { PRC_BUSINESS_RULE_NOTICE } from '../../../schemas/prcRegistry.schema'
import { getTodayArIso } from '../../../lib/dateTimeCanonical'
import {
  formatPrcNumberLabel,
  getEligiblePrcContractors,
  resolveLatestDollarRate,
} from '../../../lib/prcRegistryRules'
import TercerosPrcConfirmStep from './TercerosPrcConfirmStep'

const INPUT_CLS =
  'w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400'

function buildInitialForm({ editingPrc, parentPrc, isEdit, isAdditional, defaultFx }) {
  const src = isEdit ? editingPrc : isAdditional ? parentPrc : null
  return {
    contractor_worker_id: src?.contractor_worker_id || '',
    contractor_name: src?.contractor_name || '',
    ship_id: src?.ship_id || '',
    work_order_id: src?.work_order_id || '',
    description: isEdit ? (editingPrc?.description || '') : (isAdditional && parentPrc ? `Adicional al ${formatPrcNumberLabel(parentPrc.prc_number)}: ` : ''),
    amount_ars: isEdit ? String(editingPrc?.amount_ars ?? '') : '',
    exchange_rate: String((isEdit && editingPrc?.exchange_rate) || defaultFx),
    issue_date: (isEdit && editingPrc?.issue_date) || getTodayArIso(),
    status: (isEdit && editingPrc?.status) || 'ACTIVO',
    observations: isEdit ? (editingPrc?.observations || '') : '',
  }
}

export default function TercerosPrcIssueModal({
  isOpen = false, mode = 'issue', editingPrc = null, parentPrc = null,
  workers = [], ships = [], workOrders = [], macroVariables = [],
  initialNextNumber = 2000, onPeekNextNumber, onClose, onIssuePrc, onUpdatePrc,
}) {
  const isEdit = mode === 'edit' && Boolean(editingPrc)
  const isAdditional = mode === 'additional' && Boolean(parentPrc)
  const eligibleContractors = useMemo(() => getEligiblePrcContractors(workers), [workers])
  const defaultFx = useMemo(() => resolveLatestDollarRate(macroVariables) || 1500, [macroVariables])

  const [step, setStep] = useState('form')
  const [previewNumber, setPreviewNumber] = useState(initialNextNumber)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [formData, setFormData] = useState(() => buildInitialForm({ defaultFx }))

  useEffect(() => {
    if (!isOpen) return
    setStep('form')
    setErrorMsg('')
    setSaving(false)
    setPreviewNumber(initialNextNumber)
    setFormData(buildInitialForm({ editingPrc, parentPrc, isEdit, isAdditional, defaultFx }))
    if (!isEdit && onPeekNextNumber) {
      onPeekNextNumber().then((num) => {
        if (Number.isFinite(Number(num))) setPreviewNumber(Number(num))
      }).catch(() => {})
    }
  }, [isOpen, isEdit, isAdditional, editingPrc, parentPrc, defaultFx, initialNextNumber, onPeekNextNumber])

  const filteredWos = useMemo(() => {
    if (!formData.ship_id) return workOrders || []
    return (workOrders || []).filter((wo) => wo.ship_id === formData.ship_id)
  }, [workOrders, formData.ship_id])

  const computedUsd = useMemo(() => {
    const ars = Number(formData.amount_ars || 0)
    const fx = Number(formData.exchange_rate || 0)
    if (!(ars > 0) || !(fx > 0)) return 0
    return Number((ars / fx).toFixed(2))
  }, [formData.amount_ars, formData.exchange_rate])

  if (!isOpen) return null

  const selectedShipName = ships.find((s) => s.id === formData.ship_id)?.name || 'Sin Buque'
  const selectedWo = workOrders.find((w) => w.id === formData.work_order_id)
  const selectedWoLabel = selectedWo ? `${selectedWo.ot_number ? `OT-${selectedWo.ot_number}` : ''} ${selectedWo.title || ''}`.trim() : 'Sin OT'
  const handleContractorSelect = (val) => {
    const found = eligibleContractors.find((c) => c.name === val)
    setFormData((prev) => ({ ...prev, contractor_name: val, contractor_worker_id: found?.id || '' }))
  }

  const validateForm = () => {
    if (!String(formData.contractor_name || '').trim()) return 'Seleccioná un contratista externo.'
    if (String(formData.description || '').trim().length < 3) return 'Ingresá la descripción del presupuesto (mínimo 3 caracteres).'
    const amt = Number(formData.amount_ars || 0)
    if (!Number.isFinite(amt) || amt < 0) return 'El importe AR$ debe ser mayor o igual a 0.'
    return ''
  }

  const handleContinueToConfirm = async (e) => {
    e.preventDefault()
    const err = validateForm()
    if (err) { setErrorMsg(err); return }
    setErrorMsg('')

    if (isEdit) {
      try {
        setSaving(true)
        await onUpdatePrc?.(editingPrc, {
          description: String(formData.description || '').trim(),
          amount_ars: Number(formData.amount_ars || 0),
          amount_usd: computedUsd,
          exchange_rate: Number(formData.exchange_rate) || defaultFx,
          issue_date: formData.issue_date || getTodayArIso(),
          status: formData.status === 'TERMINADO' ? 'TERMINADO' : 'ACTIVO',
          observations: formData.observations ? String(formData.observations).trim() : null,
        })
        onClose?.()
      } catch (saveErr) {
        setErrorMsg(saveErr?.message || 'Error al actualizar el PRC.')
      } finally {
        setSaving(false)
      }
      return
    }

    try {
      setSaving(true)
      if (onPeekNextNumber) {
        const freshNext = await onPeekNextNumber()
        if (Number.isFinite(Number(freshNext))) setPreviewNumber(Number(freshNext))
      }
      setStep('confirm')
    } catch (peekErr) {
      setErrorMsg(peekErr?.message || 'No se pudo consultar el próximo número correlativo.')
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmIssue = async () => {
    try {
      setSaving(true)
      setErrorMsg('')
      await onIssuePrc?.(
        {
          ...formData,
          amount_ars: Number(formData.amount_ars || 0),
          amount_usd: computedUsd,
          exchange_rate: Number(formData.exchange_rate) || defaultFx,
        },
        isAdditional ? parentPrc : null
      )
      onClose?.()
    } catch (err) {
      setErrorMsg(err?.message || 'No se pudo emitir el PRC.')
    } finally {
      setSaving(false)
    }
  }

  const titleText = isEdit
    ? `Editar Detalle · ${formatPrcNumberLabel(editingPrc.prc_number)}`
    : isAdditional
    ? `Nuevo Adicional al ${formatPrcNumberLabel(parentPrc.prc_number)}`
    : `Emitir Nuevo PRC · Próximo #${previewNumber}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-amber-500/40 shadow-2xl overflow-hidden font-sans">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-amber-950/25">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
              {isAdditional ? <GitBranchPlus className="w-4 h-4" /> : <FileSpreadsheet className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-black text-white">{titleText}</h3>
              <p className="text-[11px] text-amber-300/80">
                {isEdit ? 'El número oficial de PRC es inmutable (solo lectura)' : 'Numeración correlativa automática e inmutable desde #2000'}
              </p>
            </div>
          </div>
          <button type="button" onClick={() => onClose?.()} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === 'form' ? (
          <form onSubmit={handleContinueToConfirm} className="p-5 space-y-3.5 text-xs">
            <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{PRC_BUSINESS_RULE_NOTICE}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Nº PRC Oficial</label>
                <div className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-amber-300 font-mono font-black flex items-center justify-between">
                  <span>{isEdit ? formatPrcNumberLabel(editingPrc.prc_number) : `PRC #${previewNumber} (Auto)`}</span>
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Fecha *</label>
                <input type="date" value={formData.issue_date} onChange={(e) => setFormData((p) => ({ ...p, issue_date: e.target.value }))} className={INPUT_CLS} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Contratista Externo *</label>
                {isEdit || isAdditional ? (
                  <div className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-white font-bold truncate">{formData.contractor_name}</div>
                ) : (
                  <select value={formData.contractor_name} onChange={(e) => handleContractorSelect(e.target.value)} className={INPUT_CLS}>
                    <option value="">Seleccionar contratista...</option>
                    {eligibleContractors.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Barco / Destino</label>
                <select value={formData.ship_id} disabled={isEdit} onChange={(e) => setFormData((p) => ({ ...p, ship_id: e.target.value, work_order_id: '' }))} className={`${INPUT_CLS} disabled:opacity-60`}>
                  <option value="">Sin Buque / Astillero</option>
                  {(ships || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Orden de Trabajo (OT)</label>
                <select value={formData.work_order_id} disabled={isEdit} onChange={(e) => setFormData((p) => ({ ...p, work_order_id: e.target.value }))} className={`${INPUT_CLS} disabled:opacity-60`}>
                  <option value="">Sin OT específica</option>
                  {filteredWos.map((w) => <option key={w.id} value={w.id}>{w.ot_number ? `OT-${w.ot_number} · ` : ''}{w.title}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Descripción del Trabajo Presupuestado *</label>
              <textarea rows={2} value={formData.description} onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))} placeholder="Detalle claro del alcance del presupuesto..." className={INPUT_CLS} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Importe AR$ *</label><input type="number" step="0.01" min="0" value={formData.amount_ars} onChange={(e) => setFormData((p) => ({ ...p, amount_ars: e.target.value }))} placeholder="0.00" className={INPUT_CLS} /></div>
              <div><label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">TC Referencia</label><input type="number" step="0.01" min="1" value={formData.exchange_rate} onChange={(e) => setFormData((p) => ({ ...p, exchange_rate: e.target.value }))} className={INPUT_CLS} /></div>
              <div><label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Equivalente US$</label><div className="px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 font-mono font-bold text-emerald-300">US$ {computedUsd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {isEdit && (
                <div><label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Estado</label><select value={formData.status} onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))} className={INPUT_CLS}><option value="ACTIVO">ACTIVO</option><option value="TERMINADO">TERMINADO</option></select></div>
              )}
              <div className={isEdit ? 'sm:col-span-2' : 'sm:col-span-3'}><label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Observaciones</label><input type="text" value={formData.observations} onChange={(e) => setFormData((p) => ({ ...p, observations: e.target.value }))} placeholder="Notas internas..." className={INPUT_CLS} /></div>
            </div>

            {errorMsg && <div className="p-2.5 rounded-lg bg-rose-950/70 border border-rose-500/50 text-rose-200 font-semibold">{errorMsg}</div>}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button type="button" onClick={() => onClose?.()} className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer">Cancelar</button>
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                {isEdit ? <Save className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                <span>{isEdit ? 'Guardar Cambios' : 'Continuar y Confirmar PRC'}</span>
              </button>
            </div>
          </form>
        ) : (
          <TercerosPrcConfirmStep
            previewNumber={previewNumber}
            isAdditional={isAdditional}
            parentPrc={parentPrc}
            formData={formData}
            selectedShipName={selectedShipName}
            selectedWoLabel={selectedWoLabel}
            computedUsd={computedUsd}
            saving={saving}
            errorMsg={errorMsg}
            onBack={() => setStep('form')}
            onConfirm={handleConfirmIssue}
          />
        )}
      </div>
    </div>
  )
}
