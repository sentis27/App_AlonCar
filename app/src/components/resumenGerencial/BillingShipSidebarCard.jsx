import React from 'react'
import { CheckCircle2, RotateCcw, X, FileText } from 'lucide-react'
import { formatUsd } from '../../lib/drydockCatalogConstants'
import BillingSimpleHoverHint from './BillingSimpleHoverHint'

const COLOR_RULE_HINT = (
  <div className="space-y-1">
    <div><strong>Amarillo:</strong> En proceso de facturación (remito no terminado).</div>
    <div><strong>Verde:</strong> Revisado por Gerencia con costos finales, listo para empezar a facturar.</div>
  </div>
)

/**
 * Tarjeta individual de barco dentro del Menú Lateral Multi-Barco (`BillingShipSidebarRail`).
 * Diseño limpio: color Amarillo/Verde con ayuda flotante blanca únicamente al pasar el mouse
 * por los botones de color, más botón `[X]` para retirar el barco de la mesa.
 */
export default function BillingShipSidebarCard({
  ship,
  listMode = 'EN_PREPARACION',
  isActive = false,
  meta = { totalUsd: 0, otCount: 0, hasAlerts: false },
  onSelectShip,
  onSetShipColor,
  onRemoveShipFromWorkspace,
  onReopenShipFromSent
}) {
  const colorMode = ship.billing_layout_meta?.workspaceColor === 'VERDE' ? 'VERDE' : 'AMARILLO'
  const isGreen = colorMode === 'VERDE'
  const isSent = listMode === 'ENVIADO_A_FACTURACION'
  const displayUsd = isSent && ship.billing_total_snapshot_usd != null
    ? Number(ship.billing_total_snapshot_usd)
    : meta.totalUsd
  const latestPdf = Array.isArray(ship.billing_layout_meta?.archivedPdfs)
    ? ship.billing_layout_meta.archivedPdfs[0]
    : null

  const cardClass = isSent
    ? (isActive ? 'bg-cyan-950/60 border-cyan-400 ring-1 ring-cyan-400/50' : 'bg-slate-900/75 border-slate-800 hover:border-slate-600')
    : isGreen
      ? (isActive ? 'bg-emerald-950/75 border-emerald-400 ring-1 ring-emerald-400/60 shadow-md' : 'bg-emerald-950/30 border-emerald-600/60 hover:border-emerald-400')
      : (isActive ? 'bg-amber-950/70 border-amber-400 ring-1 ring-amber-400/60 shadow-md' : 'bg-amber-950/25 border-amber-500/55 hover:border-amber-400')

  return (
    <div
      onClick={() => onSelectShip?.(ship.id)}
      className={`p-2.5 rounded-xl border cursor-pointer transition-all space-y-2 ${cardClass}`}
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
            isSent ? 'bg-cyan-400' : isGreen ? 'bg-emerald-400' : 'bg-amber-400'
          }`} />
          <div className="min-w-0">
            <div className={`text-xs font-black uppercase truncate ${
              isSent ? 'text-white' : isGreen ? 'text-emerald-200' : 'text-amber-200'
            }`}>
              {ship.name}
            </div>
            <div className="text-[10px] text-slate-300 font-mono truncate">
              {formatUsd(displayUsd, 0)} · {meta.otCount} OT{meta.otCount === 1 ? '' : 's'}
            </div>
          </div>
        </div>

        {!isSent ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRemoveShipFromWorkspace?.(ship)
            }}
            className="p-1 rounded-md bg-rose-950/70 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-700/50 cursor-pointer shrink-0 transition-colors"
            title="Quitar este barco del panel izquierdo (no borra el buque del sistema)"
          >
            <X className="w-3 h-3" />
          </button>
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" title="Enviado a Facturación" />
        )}
      </div>

      {!isSent ? (
        <BillingSimpleHoverHint side="right" content={COLOR_RULE_HINT} className="flex items-center gap-1 w-full">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (colorMode !== 'AMARILLO') onSetShipColor?.(ship, 'AMARILLO')
            }}
            className={`flex-1 py-0.5 rounded text-[10px] font-black border cursor-pointer transition-colors ${
              !isGreen
                ? 'bg-amber-400 border-amber-300 text-slate-950'
                : 'bg-slate-950/70 border-amber-500/50 text-amber-300 hover:bg-amber-950/70'
            }`}
          >
            Amarillo
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (colorMode !== 'VERDE') onSetShipColor?.(ship, 'VERDE')
            }}
            className={`flex-1 py-0.5 rounded text-[10px] font-black border cursor-pointer transition-colors ${
              isGreen
                ? 'bg-emerald-500 border-emerald-300 text-slate-950'
                : 'bg-slate-950/70 border-emerald-500/50 text-emerald-300 hover:bg-emerald-950/70'
            }`}
          >
            Pasar a Verde
          </button>
        </BillingSimpleHoverHint>
      ) : (
        <div className="space-y-1.5">
          {latestPdf?.fileUrl && (
            <a
              href={latestPdf.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="w-full py-1 px-2 rounded-md bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-600/50 text-cyan-200 text-[10px] font-bold inline-flex items-center justify-center gap-1"
            >
              <FileText className="w-3 h-3 shrink-0" />
              <span className="truncate">
                PDF {latestPdf.budgetNumber ? `#${latestPdf.budgetNumber}` : 'Archivado'}
              </span>
            </a>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onReopenShipFromSent?.(ship)
            }}
            className="w-full py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Volver a Preparación</span>
          </button>
        </div>
      )}
    </div>
  )
}
