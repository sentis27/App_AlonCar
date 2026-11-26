import React, { useState, useEffect } from 'react'
import { AlertTriangle, X, ChevronUp, Copy, Check } from 'lucide-react'
import { formatSheetMetric } from '../lib/sheetSelectionEngine'

/**
 * GridStatusBarBottom
 *
 * Barra Inferior Canónica de toda planilla (Estándar 05 · FL-027). Una por tabla (`isFixed={false}`)
 * o flotante global (`isFixed`).
 *
 * - Izquierda: "Todo el filtro: X registros", badge de Filtro Activo con [✕ Limpiar Todo], filas tildadas.
 * - Derecha (motor Sheets): al seleccionar celdas, rangos salteados (Ctrl+Clic) o una columna entera
 *   (clic en encabezado) proyecta Σ SUMA / Ø PROM / CANTIDAD y un menú ▾ con TODAS las métricas
 *   (Suma, Promedio, Mínimo, Máximo, Cantidad, Contar números, Únicos). Clic en cualquier valor = copiar.
 *   Sin selección: totales generales del filtro (`globalAggregates`).
 */
function MetricChip({ label, value, onCopy, strong = false, copied = false }) {
  return (
    <button
      type="button"
      onClick={() => onCopy(label, value)}
      title="Clic para copiar este valor"
      className={`flex items-baseline gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border cursor-pointer transition-colors hover:border-cyan-300 ${strong ? 'border-cyan-500/70' : 'border-slate-700'}`}
    >
      <span className="text-[10px] uppercase font-bold text-slate-400">{label}:</span>
      <span className={`font-extrabold ${strong ? 'text-sm text-cyan-300' : 'text-xs text-white'}`}>{value}</span>
      {copied && <Check className="w-3 h-3 text-emerald-400 self-center" />}
    </button>
  )
}

function buildMetricList(stats) {
  const fmt = (v) => formatSheetMetric(v, stats.formatType)
  const list = []
  if (stats.numericCount > 0) {
    list.push(['Suma', fmt(stats.sum)], ['Promedio', fmt(stats.avg)], ['Mínimo', fmt(stats.min)], ['Máximo', fmt(stats.max)])
  }
  list.push(['Cantidad', String(stats.count)], ['Contar números', String(stats.numericCount)], ['Únicos', String(stats.unique ?? 0)])
  return list
}

export default function GridStatusBarBottom({
  filteredCount = 0,
  totalCount = 0,
  entityName = 'registros',
  hasActiveFilter = false,
  onClearFilters,
  selectionStats = null,
  onClearSelection = null,
  customSelection = null, // { count, label, onClear }
  globalAggregates = [], // [{ label: 'Σ Cant', value: '120', highlight }]
  extraActions = null,
  children = null,
  isFixed = true
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [copiedKey, setCopiedKey] = useState('')
  const hasRangeSelection = Boolean(selectionStats && ((selectionStats.totalCells || 0) > 1 || selectionStats.count > 0))
  const isNumericSelection = hasRangeSelection && selectionStats.numericCount > 0
  const isMenuOpen = hasRangeSelection && menuOpen

  useEffect(() => {
    if (!copiedKey) return undefined
    const t = setTimeout(() => setCopiedKey(''), 1400)
    return () => clearTimeout(t)
  }, [copiedKey])

  const copyValue = (label, value) => {
    try { navigator.clipboard?.writeText(String(value)) } catch { /* sin portapapeles */ }
    setCopiedKey(label)
  }

  const scopeLabel = selectionStats?.scope === 'column'
    ? `COLUMNA: ${selectionStats.columnLabel || ''}`
    : selectionStats?.scope === 'multi'
    ? `SELECCIÓN SALTEADA (${selectionStats?.totalCells} celdas)`
    : `SELECCIÓN (${selectionStats?.totalCells || selectionStats?.count || 0} celdas)`

  const fmt = (v) => formatSheetMetric(v, selectionStats?.formatType)
  const containerClasses = isFixed
    ? 'fixed bottom-4 left-4 right-4 md:left-64 z-40 bg-slate-900/98 border-2 border-cyan-400 shadow-2xl shadow-cyan-500/30 rounded-2xl px-4 py-2.5 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs animate-in slide-in-from-bottom duration-200 font-mono select-none'
    : 'w-full bg-slate-900/98 border-2 border-cyan-400 shadow-2xl shadow-cyan-500/30 rounded-2xl px-4 py-2.5 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs font-mono select-none'

  return (
    <div className={containerClasses}>
      {/* IZQUIERDA: CONTADORES Y ALERTAS DE FILTRO */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 px-2.5 py-1 rounded-lg text-slate-300 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span>Todo el filtro: <strong className="text-white font-bold">{filteredCount}</strong> {entityName}</span>
        </div>

        {hasActiveFilter && (
          <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-400/80 px-2.5 py-1 rounded-lg text-amber-300 font-bold text-xs shadow-md">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Filtro Activo ({filteredCount} de {totalCount})</span>
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

        {customSelection && customSelection.count > 0 && (
          <div className="flex items-center gap-2 bg-cyan-950 border border-cyan-400 px-2.5 py-1 rounded-lg text-cyan-300 font-extrabold shadow-sm">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
            <span>📌 {customSelection.count} {customSelection.label || 'filas tildadas'}</span>
            {customSelection.onClear && (
              <button type="button" onClick={customSelection.onClear} className="ml-1 text-cyan-400 hover:text-white transition-colors cursor-pointer text-xs underline" title="Quitar selección">
                ✕ Limpiar
              </button>
            )}
          </div>
        )}
      </div>

      {/* DERECHA: MOTOR MATEMÁTICO SHEETS */}
      <div className="flex flex-wrap items-center gap-2.5">
        {hasRangeSelection ? (
          <div className="relative flex flex-wrap items-center gap-2 font-mono">
            <div className="flex items-center gap-1.5 bg-emerald-950/90 border border-emerald-500/90 px-2.5 py-1 rounded-lg text-emerald-300 font-black text-xs shadow-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="max-w-[220px] truncate">{scopeLabel}</span>
            </div>

            {isNumericSelection && (
              <>
                <MetricChip label="Σ SUMA" value={fmt(selectionStats.sum)} strong onCopy={copyValue} copied={copiedKey === 'Σ SUMA'} />
                <MetricChip label="Ø PROM" value={fmt(selectionStats.avg)} onCopy={copyValue} copied={copiedKey === 'Ø PROM'} />
              </>
            )}
            <MetricChip label="CANTIDAD" value={String(selectionStats.count)} strong={!isNumericSelection} onCopy={copyValue} copied={copiedKey === 'CANTIDAD'} />

            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-950 border border-slate-600 text-slate-200 hover:border-cyan-300 cursor-pointer font-bold"
              title="Ver todas las métricas (Suma, Promedio, Mínimo, Máximo, Cantidad, Contar números, Únicos)"
            >
              <span>Σ</span>
              <ChevronUp className={`w-3 h-3 transition-transform ${isMenuOpen ? '' : 'rotate-180'}`} />
            </button>

            {isMenuOpen && (
              <div className="absolute bottom-full right-0 mb-2 min-w-[230px] bg-slate-950 border border-cyan-400/70 rounded-xl shadow-2xl shadow-black/60 py-1 z-50">
                {buildMetricList(selectionStats).map(([label, value]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => copyValue(label, value)}
                    className="w-full flex items-center justify-between gap-6 px-3 py-1.5 text-left hover:bg-cyan-950/70 cursor-pointer"
                    title="Clic para copiar"
                  >
                    <span className="text-slate-300 font-semibold">{label}:</span>
                    <span className="flex items-center gap-1.5 text-white font-extrabold">
                      {value}
                      {copiedKey === label ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-500" />}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {onClearSelection && (
              <button type="button" onClick={onClearSelection} className="ml-1 text-slate-400 hover:text-white transition-colors cursor-pointer text-xs underline" title="Quitar selección">
                ✕ Salir
              </button>
            )}
          </div>
        ) : (
          globalAggregates.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 font-mono">
              {globalAggregates.map((agg, idx) => (
                <div
                  key={`agg_${agg.label || idx}`}
                  className={`flex items-baseline gap-1 ${agg.highlight ? 'bg-slate-950 px-2 py-0.5 rounded border border-cyan-500/40 text-cyan-300 font-extrabold' : 'text-slate-300'}`}
                >
                  <span className="text-[10px] uppercase font-bold text-slate-400">{agg.label}:</span>
                  <span className={`text-xs font-bold ${agg.highlight ? 'text-cyan-300 text-sm' : 'text-white'}`}>{agg.value}</span>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {(extraActions || children) && (
        <div className="flex flex-wrap items-center gap-2">
          {extraActions}
          {children}
        </div>
      )}
    </div>
  )
}
