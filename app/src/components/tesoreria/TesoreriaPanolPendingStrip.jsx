/**
 * TesoreriaPanolPendingStrip.jsx
 * Franja operativa compacta (sin tarjetas de KPI) para absorber en 1 clic
 * los retiros cobrables de Pañol de la quincena hacia Cuenta Corriente sin duplicarlos.
 */
import React from 'react'
import { CheckCircle2, PackageCheck, ArrowRightCircle } from 'lucide-react'

const fmtArs = (v) => `AR$ ${Number(v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtUsd = (v) => `US$ ${Number(v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function TesoreriaPanolPendingStrip({
  pendingReport = null,
  periodKey = '',
  fortnightDollarRate = 1500,
  canManageCc = false,
  absorbingKey = null,
  onAbsorbOne,
  onAbsorbAll,
}) {
  if (!pendingReport) return null
  const { pendingBatches = [], totalPeriodTxCount = 0, totalAlreadyAbsorbedCount = 0, pendingTotalArs = 0 } = pendingReport

  if (pendingBatches.length === 0) {
    if (totalPeriodTxCount > 0) {
      return (
        <div className="px-3.5 py-2 rounded-xl bg-emerald-950/35 border border-emerald-500/40 flex items-center justify-between gap-2 text-xs text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Pañol {periodKey}:</strong> los <strong>{totalAlreadyAbsorbedCount}</strong> retiros cobrables ya fueron pasados a Cuenta Corriente (bloqueo anti-duplicado activo).
            </span>
          </div>
          <span className="text-[10px] font-mono text-emerald-300/80">TC Quincenal: AR$ {fortnightDollarRate}</span>
        </div>
      )
    }
    return (
      <div className="px-3.5 py-2 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between gap-2 text-xs text-slate-400">
        <span>Sin retiros de Pañol cobrables registrados en la quincena <strong className="text-slate-200">{periodKey}</strong>.</span>
        <span className="text-[10px] font-mono text-slate-500">TC Quincenal: AR$ {fortnightDollarRate}</span>
      </div>
    )
  }

  return (
    <div className="p-3 rounded-xl bg-amber-950/25 border border-amber-500/40 space-y-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <PackageCheck className="w-4 h-4 text-amber-300 shrink-0" />
          <span className="font-black text-amber-200">
            Retiros de Pañol pendientes de pasar a CC ({periodKey})
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-950/80 border border-amber-500/30 font-mono text-[11px] text-amber-300 font-bold">
            {pendingBatches.length} contratista(s) · Total {fmtArs(pendingTotalArs)}
          </span>
          <span className="text-[10px] font-mono text-slate-400">TC Materiales: AR$ {fortnightDollarRate}</span>
        </div>

        {canManageCc && pendingBatches.length > 1 && (
          <button
            type="button"
            disabled={Boolean(absorbingKey)}
            onClick={onAbsorbAll}
            className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-[11px] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowRightCircle className="w-3.5 h-3.5" />
            <span>{absorbingKey === 'ALL' ? 'Pasando todos...' : `Confirmar y pasar todos (${pendingBatches.length})`}</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {pendingBatches.map((batch) => {
          const isBusy = absorbingKey === batch.contractorLabel || absorbingKey === 'ALL'
          return (
            <div
              key={batch.contractorLabel}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950/90 border border-slate-700/90"
            >
              <div>
                <div className="font-bold text-white text-[11px] leading-tight">{batch.contractorLabel}</div>
                <div className="text-[10px] font-mono text-slate-400">
                  {batch.pendingCount} retiro(s) · <strong className="text-amber-300">{fmtArs(batch.pendingTotalArs)}</strong>
                  <span className="text-slate-500"> ({fmtUsd(batch.pendingTotalUsd)})</span>
                  {batch.alreadyAbsorbedCount > 0 && (
                    <span className="text-emerald-400 ml-1">({batch.alreadyAbsorbedCount} ya en CC)</span>
                  )}
                </div>
              </div>
              {canManageCc && (
                <button
                  type="button"
                  disabled={Boolean(absorbingKey)}
                  onClick={() => onAbsorbOne?.(batch)}
                  className="px-2.5 py-1 rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black text-[10px] inline-flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <ArrowRightCircle className="w-3 h-3" />
                  <span>{isBusy ? 'Pasando...' : 'Pasar a CC'}</span>
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
