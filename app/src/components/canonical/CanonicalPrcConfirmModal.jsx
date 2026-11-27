/**
 * CanonicalPrcConfirmModal.jsx
 * Pieza Visual Única (Capa 3 · SKL-019): Modal universal de Doble Confirmación antes de
 * consumir un número correlativo de `Base de datos de PRC` (#2000+).
 */
import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Lock, ShieldCheck, X } from 'lucide-react'
import { PRC_BUSINESS_RULE_NOTICE } from '../../schemas/prcRegistry.schema'
import { previewNextPrcNumberService } from '../../services/prcRegistryService'

export default function CanonicalPrcConfirmModal({
  isOpen = false,
  context = null, // { title, contractorName, shipName, otLabel, description, amountArs, sourceLabel }
  allowSkipPrc = false,
  skipLabel = 'Solo marcar PRESUPUESTO sin PRC',
  onCancel,
  onSkipPrc,
  onConfirm,
}) {
  const [nextNumber, setNextNumber] = useState(2000)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!isOpen) return
    let active = true
    setConfirming(false)
    setErrorMsg('')
    setLoadingPreview(true)
    previewNextPrcNumberService()
      .then((num) => {
        if (active && Number.isFinite(Number(num))) setNextNumber(Number(num))
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingPreview(false)
      })
    return () => { active = false }
  }, [isOpen])

  if (!isOpen || typeof document === 'undefined') return null

  const handleConfirmClick = async () => {
    try {
      setConfirming(true)
      setErrorMsg('')
      await onConfirm?.(nextNumber)
    } catch (err) {
      setErrorMsg(err?.message || 'No se pudo emitir el PRC.')
      setConfirming(false)
    }
  }

  const handleSkipClick = async () => {
    try {
      setConfirming(true)
      setErrorMsg('')
      await onSkipPrc?.()
    } catch (err) {
      setErrorMsg(err?.message || 'No se pudo guardar.')
      setConfirming(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 font-sans">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-amber-500/60 shadow-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-amber-950/35">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-300">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">
                {context?.title || `¿Confirmás generar el PRC #${nextNumber}?`}
              </h3>
              <p className="text-[11px] text-amber-300/90">
                Doble confirmación obligatoria · Numeración automática única
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={confirming}
            onClick={() => onCancel?.()}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3.5 text-xs">
          <div className="p-3.5 rounded-xl bg-amber-950/35 border border-amber-500/50 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase text-amber-300">
                <Lock className="w-3.5 h-3.5" /> Próximo número a asignar
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-amber-500 text-slate-950 font-mono font-black text-sm">
                {loadingPreview ? 'Calculando...' : `PRC #${nextNumber}`}
              </span>
            </div>
            <div className="flex items-start gap-2 text-amber-100 leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{PRC_BUSINESS_RULE_NOTICE}</span>
            </div>
          </div>

          {context && (
            <div className="p-3.5 rounded-xl bg-slate-950/85 border border-slate-800 space-y-1 text-slate-300">
              {context.contractorName && (
                <div><span className="text-slate-500">Contratista:</span> <strong className="text-white">{context.contractorName}</strong></div>
              )}
              {(context.shipName || context.otLabel) && (
                <div>
                  <span className="text-slate-500">Barco / OT:</span>{' '}
                  <strong className="text-cyan-300">{context.shipName || 'Sin Buque'}</strong>
                  {context.otLabel ? ` · ${context.otLabel}` : ''}
                </div>
              )}
              {Number(context.amountArs) > 0 && (
                <div>
                  <span className="text-slate-500">Importe:</span>{' '}
                  <strong className="font-mono text-emerald-300">
                    AR$ {Number(context.amountArs).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </div>
              )}
              {context.description && (
                <div><span className="text-slate-500">Trabajo:</span> <span className="text-white">{context.description}</span></div>
              )}
            </div>
          )}

          <p className="text-[11px] text-slate-400">
            El número de PRC es único e inmutable (no se puede editar ni borrar, solo anular tachado). Si elegís <strong>Cancelar</strong>, no se consume ningún número.
          </p>

          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-950/70 border border-rose-500/50 text-rose-200 font-semibold">
              {errorMsg}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              disabled={confirming}
              onClick={() => onCancel?.()}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer"
            >
              Cancelar
            </button>
            {allowSkipPrc && (
              <button
                type="button"
                disabled={confirming}
                onClick={handleSkipClick}
                className="px-3 py-2 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 text-cyan-200 border border-cyan-500/50 font-bold cursor-pointer"
              >
                {skipLabel}
              </button>
            )}
            <button
              type="button"
              disabled={confirming || loadingPreview}
              onClick={handleConfirmClick}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{confirming ? 'Emitiendo...' : `Confirmar y emitir PRC #${nextNumber}`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
