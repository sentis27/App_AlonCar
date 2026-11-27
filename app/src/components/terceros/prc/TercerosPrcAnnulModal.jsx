/**
 * TercerosPrcAnnulModal.jsx
 * Modal de anulación irreversible (tachado sin reuso de número) en Base de datos de PRC.
 */
import React, { useState, useEffect } from 'react'
import { Ban, X, AlertTriangle } from 'lucide-react'
import { formatDateAr } from '../../../lib/dateTimeCanonical'
import { formatPrcNumberLabel } from '../../../lib/prcRegistryRules'

export default function TercerosPrcAnnulModal({
  isOpen = false,
  prc = null,
  onClose,
  onConfirmAnnul,
}) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setReason('')
    setErrorMsg('')
    setSaving(false)
  }, [isOpen, prc?.id])

  if (!isOpen || !prc) return null

  const label = formatPrcNumberLabel(prc.prc_number)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const clean = String(reason || '').trim()
    if (clean.length < 3) {
      setErrorMsg('Ingresá un motivo de anulación (mínimo 3 caracteres).')
      return
    }
    try {
      setSaving(true)
      setErrorMsg('')
      await onConfirmAnnul?.(prc, clean)
      onClose?.()
    } catch (err) {
      setErrorMsg(err?.message || 'No se pudo anular el PRC.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-rose-500/40 shadow-2xl overflow-hidden font-sans">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-rose-950/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-300">
              <Ban className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Anular {label}</h3>
              <p className="text-[11px] text-rose-300/90">El número quedará tachado y nunca se reutilizará</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              <strong>Anulación definitiva:</strong> {label} pasará a estado <strong>ANULADO</strong> (tachado en la planilla) y dejará de sumar. Si hay un reemplazo o cambio, emití un PRC nuevo.
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1 text-slate-300">
            <div><span className="text-slate-500">Contratista:</span> <strong className="text-white">{prc.contractor_name}</strong></div>
            <div><span className="text-slate-500">Fecha:</span> <span className="font-mono">{formatDateAr(prc.issue_date)}</span> · <span className="text-slate-500">Importe:</span> <strong className="font-mono text-white">AR$ {Number(prc.amount_ars || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
            {prc.description && <div><span className="text-slate-500">Descripción:</span> {prc.description}</div>}
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Motivo de anulación *
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Error de carga, trabajo cancelado por armador, reemplazado por PRC #..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-400"
              autoFocus
            />
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-950/70 border border-rose-500/50 text-rose-200 font-semibold">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => onClose?.()}
              disabled={saving}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>{saving ? 'Anulando...' : `Anular y Tachar ${label}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
