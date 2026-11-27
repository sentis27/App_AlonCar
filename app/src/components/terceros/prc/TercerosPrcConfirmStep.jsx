/**
 * TercerosPrcConfirmStep.jsx
 * Pantalla de Doble Confirmación reutilizable (Paso 2) antes de consumir un número de PRC.
 */
import React from 'react'
import { ShieldCheck } from 'lucide-react'
import { PRC_BUSINESS_RULE_NOTICE } from '../../../schemas/prcRegistry.schema'
import { formatDateAr } from '../../../lib/dateTimeCanonical'
import { formatPrcNumberLabel } from '../../../lib/prcRegistryRules'

export default function TercerosPrcConfirmStep({
  previewNumber = 2000,
  isAdditional = false,
  parentPrc = null,
  formData = {},
  selectedShipName = 'Sin Buque',
  selectedWoLabel = 'Sin OT',
  computedUsd = 0,
  saving = false,
  errorMsg = '',
  onBack,
  onConfirm,
}) {
  return (
    <div className="p-5 space-y-4 text-xs">
      <div className="p-4 rounded-xl bg-amber-950/35 border border-amber-500/50 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
            Doble Confirmación Requerida
          </span>
          <span className="px-2.5 py-0.5 rounded-lg bg-amber-500 text-slate-950 font-mono font-black text-sm">
            PRC #{previewNumber}
          </span>
        </div>
        <p className="text-amber-100 leading-relaxed">
          {PRC_BUSINESS_RULE_NOTICE} El número <strong>#{previewNumber}</strong> es único e inmutable: una vez confirmado no podrá modificarse ni borrarse (solo anular tachado).
        </p>
      </div>

      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5 text-slate-300">
        {isAdditional && parentPrc && (
          <div>
            <span className="text-slate-500">Vínculo:</span>{' '}
            <strong className="text-purple-300">Adicional al {formatPrcNumberLabel(parentPrc.prc_number)}</strong>
          </div>
        )}
        <div><span className="text-slate-500">Contratista:</span> <strong className="text-white">{formData.contractor_name}</strong></div>
        <div><span className="text-slate-500">Barco / OT:</span> <strong className="text-cyan-300">{selectedShipName}</strong> · <span>{selectedWoLabel}</span></div>
        <div>
          <span className="text-slate-500">Fecha:</span> <span className="font-mono">{formatDateAr(formData.issue_date)}</span> ·{' '}
          <span className="text-slate-500">Importe:</span>{' '}
          <strong className="font-mono text-emerald-300">
            AR$ {Number(formData.amount_ars || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </strong>{' '}
          (US$ {computedUsd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
        </div>
        <div><span className="text-slate-500">Descripción:</span> <span className="text-white">{formData.description}</span></div>
      </div>

      {errorMsg && (
        <div className="p-2.5 rounded-lg bg-rose-950/70 border border-rose-500/50 text-rose-200 font-semibold">
          {errorMsg}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
        <button type="button" onClick={onBack} disabled={saving} className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer">
          Volver / Cancelar
        </button>
        <button type="button" onClick={onConfirm} disabled={saving} className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
          <ShieldCheck className="w-4 h-4" />
          <span>{saving ? 'Emitiendo...' : `Confirmar y Emitir PRC #${previewNumber}`}</span>
        </button>
      </div>
    </div>
  )
}
