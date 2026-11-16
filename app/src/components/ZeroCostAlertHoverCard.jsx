import React from 'react'
import { AlertTriangle, FileText, Package, Wrench } from 'lucide-react'

/**
 * Tarjeta flotante/embebida compartida para inspección al hover de alertas $0 (Terceros y Materiales).
 * Sigue la estética canónica de `WorkOrderScopeHoverCard.jsx` (`bg-slate-950/95 border-2 rounded-xl shadow-2xl`).
 * Muestra Contratista/Solicitante, OT, Nº Presupuesto/Origen, Buque y Observaciones del trabajo pendiente.
 */
export default function ZeroCostAlertHoverCard({
  kind = 'TERCEROS',
  items = [],
  title,
  emptyText = 'Sin líneas pendientes de valorización.',
  maxItems = 12,
  showShip = true,
  className = ''
}) {
  const isTerceros = kind === 'TERCEROS'
  const Icon = isTerceros ? Wrench : Package
  const accentBorder = isTerceros ? 'border-amber-500/55' : 'border-rose-500/55'
  const badgeStyle = isTerceros
    ? 'bg-amber-950 text-amber-300 border-amber-700'
    : 'bg-rose-950 text-rose-300 border-rose-700'
  const visibleItems = items.slice(0, maxItems)
  const extraCount = Math.max(0, items.length - visibleItems.length)

  return (
    <div
      className={`p-3 bg-slate-950/95 rounded-xl border-2 ${accentBorder} text-[11px] text-slate-200 space-y-2 shadow-2xl shadow-black/70 backdrop-blur-md ${className}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`p-1 rounded-md border shrink-0 ${badgeStyle}`}>
            <Icon className="w-3.5 h-3.5" />
          </span>
          <div className="min-w-0">
            <div className="font-extrabold text-white text-xs truncate">
              {title || (isTerceros ? 'Terceros Pendientes de Costo ($0)' : 'Materiales Imputados Sin Precio ($0)')}
            </div>
            <div className="text-[10px] text-slate-400">
              {items.length} {items.length === 1 ? 'registro pendiente de valorizar' : 'registros pendientes de valorizar'}
            </div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-300 shrink-0">
          <AlertTriangle className="w-3 h-3" />
          Pre-Facturación
        </span>
      </div>

      {visibleItems.length === 0 ? (
        <div className="text-[11px] text-emerald-300/90 py-1">{emptyText}</div>
      ) : (
        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
          {visibleItems.map((item) => (
            <div
              key={item.id}
              className="p-2 rounded-lg border border-slate-800 bg-slate-900/85 space-y-1"
            >
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/70 shrink-0">
                    {item.otLabel ||
                      (item.otNumber === 'Sin OT'
                        ? 'S/OT · Sin OT asignada'
                        : item.otTitle
                          ? `${item.otNumber} · ${item.otTitle}`
                          : `OT #${item.otNumber}`)}
                  </span>
                  {showShip && item.shipName && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 border border-slate-700 shrink-0">
                      {item.shipName}
                    </span>
                  )}
                  <span className="font-bold text-white truncate max-w-[220px]">
                    {isTerceros ? item.contractorName : item.materialName}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0 text-[10px]">
                  {isTerceros && item.budgetNumber && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-950/80 text-sky-300 border border-sky-700/60 font-mono">
                      <FileText className="w-2.5 h-2.5" />
                      Presup. {item.budgetNumber}
                    </span>
                  )}
                  {!isTerceros && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                        item.sourceType === 'COMPRA_DIRECTA'
                          ? 'bg-violet-950 text-violet-300 border-violet-700'
                          : 'bg-amber-950 text-amber-300 border-amber-700'
                      }`}
                    >
                      {item.sourceType === 'COMPRA_DIRECTA' ? 'Compra Directa' : 'Pañol'}
                    </span>
                  )}
                </div>
              </div>

              {!isTerceros && (
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>
                    Responsable / Contratista: <strong className="text-slate-200">{item.contractorName}</strong>
                  </span>
                  {item.qty > 0 && (
                    <span className="font-mono text-slate-300">
                      {item.qty} {item.unitMeasure || 'un.'}
                    </span>
                  )}
                </div>
              )}

              <div className="text-[10.5px] text-amber-200/90 leading-snug bg-slate-950/70 rounded px-2 py-1 border border-slate-800/80">
                <span className="text-slate-400 font-semibold uppercase text-[9px] mr-1">Obs:</span>
                {item.observations || 'Sin observación registrada.'}
              </div>
            </div>
          ))}
          {extraCount > 0 && (
            <div className="text-[10px] text-center text-cyan-300 font-semibold pt-0.5">
              +{extraCount} registros adicionales (clic en la tarjeta para ver planilla filtrada)
            </div>
          )}
        </div>
      )}
    </div>
  )
}
