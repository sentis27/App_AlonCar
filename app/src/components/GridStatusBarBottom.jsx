import React from 'react'
import { AlertTriangle, X, Hash } from 'lucide-react'

/**
 * GridStatusBarBottom
 * 
 * Barra Inferior Flotante Canónica y Estandarizada para todos los Módulos de Carga de Datos.
 * Cumple con el estándar visual de Imagen 5 / docs/02_producto/estandares/05_BARRA_INFERIOR_FLOTANTE_CALCULOS_Y_LIMPIEZA.md
 * 
 * Características:
 * 1. Extremo Izquierdo: 
 *    - Contador total: "🌐 Todo el filtro: X pedidos/retiros/registros"
 *    - Badge de advertencia: "[⚠️ Filtro Activo (X de Total)]" con botón de acción directa "[✕ Limpiar Todo]"
 *    - Modo filas tildadas opcional: "📌 Selección: Y filas"
 * 2. Extremo Derecho (Motor Matemático Dinámico Sheets/Excel):
 *    - Si hay selección manual por rango de celdas (mouse drag o shift+click):
 *      * Si son celdas de texto: Proyecta "📋 RECUENTO: N celdas seleccionadas" (resuelve selección de texto).
 *      * Si son celdas numéricas: Proyecta "Σ SUMA", "Ø PROM", "MÍN / MÁX".
 *      * Botón "✕ Salir" para deseleccionar.
 *    - Si no hay selección manual: Proyecta las sumatorias y promedios globales del filtro activo (Σ Cant, Σ AR$, Σ US$, Ø).
 */
export default function GridStatusBarBottom({
  filteredCount = 0,
  totalCount = 0,
  entityName = 'registros',
  hasActiveFilter = false,
  onClearFilters,
  selectionStats = null, // { count, numericCount, sum, avg, min, max }
  onClearSelection = null,
  customSelection = null, // { count, label, onClear }
  globalAggregates = [], // [{ label: 'Σ Cant', value: '120' }, { label: 'Σ AR$', value: '$50.000', highlight: true }, ...]
  extraActions = null,
  children = null,
  isFixed = true
}) {
  const hasRangeSelection = Boolean(selectionStats && selectionStats.count > 0)
  const isNumericSelection = hasRangeSelection && (selectionStats.numericCount > 0)

  const containerClasses = isFixed
    ? "fixed bottom-4 left-4 right-4 md:left-64 z-40 bg-slate-900/98 border-2 border-cyan-400 shadow-2xl shadow-cyan-500/30 rounded-2xl px-4 py-2.5 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs animate-in slide-in-from-bottom duration-200 font-mono select-none"
    : "w-full bg-slate-900/98 border-2 border-cyan-400 shadow-2xl shadow-cyan-500/30 rounded-2xl px-4 py-2.5 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs font-mono select-none"

  return (
    <div className={containerClasses}>
      {/* ========================================================= */}
      {/* SECCIÓN IZQUIERDA: CONTADORES Y ALERTAS DE FILTRO         */}
      {/* ========================================================= */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Total del filtro activo */}
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 px-2.5 py-1 rounded-lg text-slate-300 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span>
            Todo el filtro: <strong className="text-white font-bold">{filteredCount}</strong> {entityName}
          </span>
        </div>

        {/* ALERTA VISUAL DE FILTRO ACTIVO CON BOTÓN DE LIMPIEZA */}
        {hasActiveFilter && (
          <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-400/80 px-2.5 py-1 rounded-lg text-amber-300 font-bold text-xs shadow-md">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              Filtro Activo ({filteredCount} de {totalCount})
            </span>
            {onClearFilters && (
              <button
                type="button"
                onClick={onClearFilters}
                className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-[10px] shadow transition-all cursor-pointer"
                title="Restablecer todos los filtros y volver a la vista completa"
              >
                <X className="w-3 h-3 stroke-[3]" />
                <span>Limpiar Todo</span>
              </button>
            )}
          </div>
        )}

        {/* Filas tildadas manualmente con checkbox si aplica */}
        {customSelection && customSelection.count > 0 && (
          <div className="flex items-center gap-2 bg-cyan-950 border border-cyan-400 px-2.5 py-1 rounded-lg text-cyan-300 font-extrabold shadow-sm">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
            <span>📌 {customSelection.count} {customSelection.label || 'filas tildadas'}</span>
            {customSelection.onClear && (
              <button
                type="button"
                onClick={customSelection.onClear}
                className="ml-1 text-cyan-400 hover:text-white transition-colors cursor-pointer text-xs underline"
                title="Quitar selección"
              >
                ✕ Limpiar
              </button>
            )}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* SECCIÓN DERECHA: MOTOR MATEMÁTICO DINÁMICO (SHEETS-LIKE)  */}
      {/* ========================================================= */}
      <div className="flex flex-wrap items-center gap-2.5">
        {hasRangeSelection ? (
          /* MODO VIVO SHEETS: CELDAS SELECCIONADAS */
          <div className="flex flex-wrap items-center gap-2 font-mono">
            <div className="flex items-center gap-1.5 bg-emerald-950/90 border border-emerald-500/90 px-2.5 py-1 rounded-lg text-emerald-300 font-black text-xs shadow-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span>SELECCIÓN ({selectionStats.count} celdas)</span>
            </div>

            {isNumericSelection ? (
              <>
                <div className="flex items-baseline gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-cyan-500/60 shadow">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Σ SUMA:</span>
                  <span className="text-sm font-extrabold text-cyan-300">
                    ${typeof selectionStats.sum === 'number'
                      ? selectionStats.sum.toLocaleString('es-AR', { maximumFractionDigits: 2 })
                      : selectionStats.sum}
                  </span>
                </div>

                <div className="flex items-baseline gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Ø PROM:</span>
                  <span className="text-xs font-bold text-white">
                    ${typeof selectionStats.avg === 'number'
                      ? selectionStats.avg.toLocaleString('es-AR', { maximumFractionDigits: 2 })
                      : selectionStats.avg}
                  </span>
                </div>

                <div className="flex items-baseline gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-[11px] text-slate-300">
                  <span>MÍN: <strong className="text-slate-100">${selectionStats.min?.toLocaleString('es-AR')}</strong></span>
                  <span className="mx-1 text-slate-600">·</span>
                  <span>MÁX: <strong className="text-slate-100">${selectionStats.max?.toLocaleString('es-AR')}</strong></span>
                </div>
              </>
            ) : (
              /* CASO CELDAS DE TEXTO: RECUENTO EXPLÍCITO (Solución definitiva para selección de texto) */
              <div className="flex items-baseline gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-cyan-500/60 shadow text-cyan-300 font-bold">
                <Hash className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="text-[10px] uppercase font-bold text-slate-400">RECUENTO:</span>
                <span className="text-xs font-bold text-cyan-300">
                  {selectionStats.count} celdas seleccionadas
                </span>
              </div>
            )}

            {onClearSelection && (
              <button
                type="button"
                onClick={onClearSelection}
                className="ml-1 text-slate-400 hover:text-white transition-colors cursor-pointer text-xs underline"
                title="Quitar selección de rango"
              >
                ✕ Salir
              </button>
            )}
          </div>
        ) : (
          /* MODO TOTALES GENERALES DEL FILTRO */
          globalAggregates.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 font-mono">
              {globalAggregates.map((agg, idx) => (
                <div
                  key={`agg_${agg.label || idx}`}
                  className={`flex items-baseline gap-1 ${
                    agg.highlight
                      ? 'bg-slate-950 px-2 py-0.5 rounded border border-cyan-500/40 text-cyan-300 font-extrabold'
                      : 'text-slate-300'
                  }`}
                >
                  <span className="text-[10px] uppercase font-bold text-slate-400">{agg.label}:</span>
                  <span className={`text-xs font-bold ${agg.highlight ? 'text-cyan-300 text-sm' : 'text-white'}`}>
                    {agg.value}
                  </span>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Acciones contextuales o botones extra */}
      {(extraActions || children) && (
        <div className="flex flex-wrap items-center gap-2">
          {extraActions}
          {children}
        </div>
      )}
    </div>
  )
}
