import React, { useState } from 'react'
import { Download, Plus, Printer, Rocket, AlertTriangle, Megaphone, FolderPlus, Minimize2, RefreshCw } from 'lucide-react'
import { OFFICIAL_RUBROS_CATALOG } from '../../lib/tradesCatalog'
import { formatUsd } from '../../lib/drydockCatalogConstants'
import BillingSimpleHoverHint from './BillingSimpleHoverHint'
import BillingStickyTotalsBar from './BillingStickyTotalsBar'

const IMPORT_ALL_HINT = (
  <div className="space-y-1">
    <div>Trae por única vez en modo fantasma las OTs activas con descripción cargada.</div>
    <div><strong>Trae OTs nuevas sin modificar lo ya hecho.</strong></div>
  </div>
)

const REFRESH_COSTS_HINT = (
  <div className="space-y-1">
    <div>Recarga costos operativos en vivo y sincroniza las OTs activas del barco.</div>
    <div><strong>No trae OTs nuevas.</strong> Para incorporarlas, usá <strong>Importar Todo del Barco</strong>.</div>
  </div>
)

const SEND_TO_BILLING_HINT = (
  <div>
    Al tocar <strong>Enviar a Facturación</strong>, el sistema guarda el PDF del Remito como adjunto vinculado al Barco, a la Fecha de impresión y al Nº de Presupuesto.
  </div>
)

/**
 * Cabezal Fijo e Inmovilizado (`sticky top`) de la Mesa de Facturación:
 * - Botones operativos (`Importar Todo`, `Actualizar Costos`, `+ Delimitador Rubro`, `+ Bloque Libre`, `Auto-Ajustar A4`, `PDF Cliente`, `Enviar a Facturación` con globo flotante blanco).
 * - Franja financiera fija (`BillingStickyTotalsBar`) siempre visible al bajar por el remito.
 */
export default function BillingWorkspaceToolbar({
  shipName = '',
  grandTotal = null,
  readyToImportCount = 0,
  emptyDescriptionAlerts = [],
  orphanSummary = null,
  importing = false,
  refreshingCosts = false,
  sendingToBilling = false,
  autoFitting = false,
  printDensity = 'normal',
  autoFitPreview = null,
  isSentMode = false,
  onImportAll,
  onRefreshCosts,
  onNotifyEmptyOts,
  onAddRubroDelimiter,
  onAddFreeBlock,
  onAutoFitA4,
  onPrintCleanPdf,
  onSendShipToFinalBilling
}) {
  const [showRubroMenu, setShowRubroMenu] = useState(false)
  const [notifyingEmpty, setNotifyingEmpty] = useState(false)

  const handleNotifyAllEmpty = async () => {
    try {
      setNotifyingEmpty(true)
      await onNotifyEmptyOts?.()
    } finally {
      setNotifyingEmpty(false)
    }
  }

  return (
    <div className="sticky -top-3 sm:-top-4 md:-top-5 z-30 bg-slate-950/95 backdrop-blur-md -mx-1 px-1 pt-1 pb-2 space-y-2 border-b border-slate-800/70">
      <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <BillingSimpleHoverHint side="bottom" content={IMPORT_ALL_HINT}>
            <button
              type="button"
              disabled={importing || isSentMode}
              onClick={onImportAll}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {importing ? 'Importando...' : `Importar Todo del Barco${readyToImportCount > 0 ? ` (${readyToImportCount})` : ''}`}
              </span>
            </button>
          </BillingSimpleHoverHint>

          <BillingSimpleHoverHint side="bottom" content={REFRESH_COSTS_HINT}>
            <button
              type="button"
              disabled={refreshingCosts}
              onClick={onRefreshCosts}
              className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingCosts ? 'animate-spin' : ''}`} />
              <span>{refreshingCosts ? 'Actualizando...' : 'Actualizar Costos'}</span>
            </button>
          </BillingSimpleHoverHint>

          <div className="relative">
            <button
              type="button"
              disabled={isSentMode}
              onClick={() => setShowRubroMenu((v) => !v)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 border border-slate-600 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
              title="Insertar título separador por rubro (CALDERERÍA activa KG en CANT.)"
            >
              <FolderPlus className="w-3.5 h-3.5 text-cyan-300" />
              <span>+ Delimitador Rubro</span>
            </button>
            {showRubroMenu && (
              <div className="absolute left-0 top-full mt-1 z-40 w-52 max-h-60 overflow-y-auto rounded-xl bg-slate-950 border border-cyan-500/60 shadow-2xl p-1 space-y-0.5">
                {OFFICIAL_RUBROS_CATALOG.map((r) => (
                  <button
                    key={r.code}
                    type="button"
                    onClick={() => {
                      setShowRubroMenu(false)
                      onAddRubroDelimiter?.(r.code, r.label.toUpperCase())
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-cyan-500/20 text-xs font-bold text-slate-200 flex items-center justify-between cursor-pointer"
                  >
                    <span>{r.label.toUpperCase()}</span>
                    {r.code === 'CALDERERIA' && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-sky-900 text-sky-200">KG</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={isSentMode}
            onClick={onAddFreeBlock}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 border border-slate-600 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
            title="Agregar un bloque comercial libre (bonificación, nota o ítem sin OT)"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-300" />
            <span>+ Bloque Libre</span>
          </button>

          <button
            type="button"
            disabled={autoFitting || isSentMode}
            onClick={onAutoFitA4}
            className={`px-2.5 py-1.5 rounded-lg disabled:opacity-50 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer border transition-colors ${
              printDensity === 'compact'
                ? 'bg-emerald-950/80 hover:bg-emerald-900/80 text-emerald-200 border-emerald-500/60'
                : autoFitPreview?.canSavePages
                  ? 'bg-amber-950/70 hover:bg-amber-900/70 text-amber-200 border-amber-500/60'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-600'
            }`}
            title="Auto-ajustar tipografía y espaciado de subtrabajos al formato A4"
          >
            <Minimize2 className="w-3.5 h-3.5 text-emerald-300" />
            <span>{autoFitting ? 'Ajustando...' : printDensity === 'compact' ? 'Auto-Ajuste A4 ✓' : 'Auto-Ajustar A4'}</span>
            {autoFitPreview?.canSavePages ? (
              <span className="px-1 py-0.2 rounded bg-amber-500/25 text-amber-200 font-mono text-[10px]">
                {autoFitPreview.currentPages}→{autoFitPreview.targetPages}h
              </span>
            ) : printDensity === 'compact' ? (
              <span className="px-1 py-0.2 rounded bg-emerald-500/25 text-emerald-200 font-mono text-[10px]">
                Compacto
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={onPrintCleanPdf}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-200 border border-cyan-500/40 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
            title="Abrir vista limpia A4 para imprimir o guardar PDF para el cliente"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>PDF Cliente</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isSentMode && (
            <BillingSimpleHoverHint side="bottom-end" content={SEND_TO_BILLING_HINT}>
              <button
                type="button"
                disabled={sendingToBilling}
                onClick={onSendShipToFinalBilling}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-emerald-500 hover:brightness-110 disabled:opacity-50 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Rocket className="w-3.5 h-3.5" />
                <span>{sendingToBilling ? 'Archivando y enviando...' : 'Enviar a Facturación'}</span>
              </button>
            </BillingSimpleHoverHint>
          )}
        </div>
      </div>

      {/* Franja Financiera Inmovilizada: siempre visible mientras se baja por el remito */}
      <BillingStickyTotalsBar shipName={shipName} grandTotal={grandTotal} />

      {/* Alertas compactas: OTs con descripción vacía + Costos Huérfanos */}
      {(emptyDescriptionAlerts.length > 0 || (orphanSummary && orphanSummary.directTotalUsd > 0)) && (
        <div className="flex flex-wrap items-center gap-2">
          {emptyDescriptionAlerts.length > 0 && (
            <div className="flex-1 min-w-[260px] px-3 py-1.5 rounded-xl bg-amber-950/60 border border-amber-500/60 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-amber-200 min-w-0">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="truncate">
                  <strong>{emptyDescriptionAlerts.length} OT{emptyDescriptionAlerts.length === 1 ? '' : 's'} con descripción vacía</strong> (no importadas):{' '}
                  {emptyDescriptionAlerts.slice(0, 3).map((e) => `${e.otNumber} ${e.title}`).join(' · ')}
                  {emptyDescriptionAlerts.length > 3 ? '…' : ''}
                </span>
              </div>
              <button
                type="button"
                disabled={notifyingEmpty}
                onClick={handleNotifyAllEmpty}
                className="px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-black text-[11px] inline-flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Megaphone className="w-3 h-3" />
                <span>{notifyingEmpty ? 'Notificando...' : 'Notificar Ampliar (1 clic)'}</span>
              </button>
            </div>
          )}

          {orphanSummary && orphanSummary.directTotalUsd > 0 && (
            <div className="px-3 py-1.5 rounded-xl bg-rose-950/60 border border-rose-500/60 text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                <strong>Costos sin OT en {shipName}:</strong> {formatUsd(orphanSummary.directTotalUsd)} (solo aviso · no se importan a factura)
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
