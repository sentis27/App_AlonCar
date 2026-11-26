import { useState, useEffect, useMemo } from 'react'
import { Lightbulb, X, ShoppingCart, RefreshCw, CheckCircle2, Calendar } from 'lucide-react'
import { OFFICIAL_UNITS, normalizeUnitMeasure } from '../../lib/comprasConstants'
import { computeMaterial6MonthConsumption, fetchMaterial6MonthTransactionsService } from '../../lib/materialConsumptionEngine'
import { useSheetSelection } from '../../hooks/grid/useSheetSelection'
import { CONSUMPTION_6M_SHEET_COLUMNS } from '../../lib/sheetColumnsOperational'
import GridStatusBarBottom from '../GridStatusBarBottom'

export default function MaterialConsumption6MModal({
  material, inventoryTx = [], workOrders = [], ships = [], virtualStockInfo = null, onReponer = null, onClose
}) {
  const [remoteTx, setRemoteTx] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')

  useEffect(() => {
    let active = true
    async function loadHistory() {
      if (!material?.id) { setLoading(false); return }
      setLoading(true); setFetchError('')
      try {
        const rows = await fetchMaterial6MonthTransactionsService(material.id)
        if (active) setRemoteTx(rows)
      } catch (err) {
        if (active) setFetchError(err?.message || 'No se pudo consultar el historial completo; se muestra la caché local.')
      } finally {
        if (active) setLoading(false)
      }
    }
    loadHistory()
    return () => { active = false }
  }, [material?.id])

  const virtualQty = Number(virtualStockInfo?.virtualQty) || 0
  const effectiveTx = remoteTx ?? inventoryTx
  const summary = useMemo(
    () => computeMaterial6MonthConsumption({ material, transactions: effectiveTx, workOrders, ships, virtualQty }),
    [material, effectiveTx, workOrders, ships, virtualQty]
  )
  const sheet = useSheetSelection({ rows: summary.months, columns: CONSUMPTION_6M_SHEET_COLUMNS, getRowId: (m) => m.key })

  const unitFullLabel = useMemo(() => {
    const norm = normalizeUnitMeasure(material?.unit_measure, material?.name)
    return OFFICIAL_UNITS.find((u) => u.value === norm)?.label || norm
  }, [material?.unit_measure, material?.name])

  const formatQty = (val) => `${Number(val || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })} ${summary.unitShort}`

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div ref={sheet.containerRef} tabIndex={0} onKeyDown={sheet.handleKeyDown} className="alon-modal-card max-w-3xl border border-amber-500/40 shadow-amber-500/10 focus:outline-none">
        <div className="alon-modal-header bg-slate-950/90">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shrink-0 shadow-lg shadow-amber-500/20">
              <Lightbulb className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-amber-300 tracking-wide truncate">ASISTENTE INTELIGENTE DE CONSUMO — ÚLTIMOS 6 MESES</h3>
              <p className="text-xs text-slate-300 truncate">
                Material: <strong className="text-white">{material?.name}</strong>
                <span className="mx-1.5 text-slate-600">•</span>
                Unidad del Sistema: <strong className="text-cyan-300">{unitFullLabel}</strong>
              </p>
            </div>
          </div>
          <button type="button" tabIndex={-1} onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer shrink-0"><X className="w-5 h-5" /></button>
        </div>

        <div className="alon-modal-body space-y-3 text-xs">
          {fetchError && <div className="p-2 rounded-lg bg-amber-950/50 border border-amber-600/50 text-amber-200 text-[11px]">{fetchError}</div>}

          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex items-center gap-3 flex-wrap text-[11px]">
              <span className="text-slate-400">Stock Actual: <strong className="text-emerald-300 font-mono">{Number(material?.current_stock || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })} {summary.unitShort}</strong></span>
              <span className="text-slate-700">|</span>
              <span className="text-slate-400">Stock Mínimo: <strong className="text-slate-200 font-mono">{Number(material?.minimum_stock || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })} {summary.unitShort}</strong></span>
              <span className="text-slate-700">|</span>
              <span className="text-slate-400">Retiros (6m): <strong className="text-cyan-300 font-mono">{summary.totalWithdrawals}</strong></span>
              {virtualQty > 0 && (
                <><span className="text-slate-700">|</span><span className="text-slate-400">Stock Virtual: <strong className="text-cyan-300 font-mono">+{virtualQty.toLocaleString('es-AR', { maximumFractionDigits: 2 })} {summary.unitShort}</strong></span></>
              )}
            </div>
            {loading && <span className="inline-flex items-center gap-1.5 text-[10px] text-amber-300 font-bold"><RefreshCw className="w-3 h-3 animate-spin" /><span>Sincronizando historial...</span></span>}
          </div>

          <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/70">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th {...sheet.getHeaderProps('month', 'py-2.5 px-3 w-32')}>Mes</th>
                  <th {...sheet.getHeaderProps('quantity', 'py-2.5 px-3 w-32 text-right')}>Cantidad</th>
                  <th {...sheet.getHeaderProps('workOrders', 'py-2.5 px-3')}>Órdenes de Trabajo (Únicas en el Mes)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {summary.months.map((m, rowIdx) => {
                  const cpM = sheet.getCellProps(rowIdx, 'month'), cpQ = sheet.getCellProps(rowIdx, 'quantity'), cpWo = sheet.getCellProps(rowIdx, 'workOrders')
                  return (
                    <tr key={m.key} className={m.quantity > 0 ? 'hover:bg-slate-900/70' : 'opacity-60'}>
                      <td {...cpM.domProps} className={`py-2.5 px-3 font-bold text-slate-200 whitespace-nowrap ${cpM.className}`}>
                        <span className="inline-flex items-center gap-1.5"><Calendar className="w-3 h-3 text-cyan-400/80" /><span>{m.monthLabel}</span><span className="text-[10px] font-mono text-slate-500">{m.year}</span></span>
                      </td>
                      <td {...cpQ.domProps} className={`py-2.5 px-3 text-right font-mono whitespace-nowrap ${cpQ.className}`}>
                        <span className={m.quantity > 0 ? 'font-black text-white text-sm' : 'text-slate-500'}>{formatQty(m.quantity)}</span>
                      </td>
                      <td {...cpWo.domProps} className={`py-2 px-3 ${cpWo.className}`}>
                        {m.uniqueWorkOrders.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {m.uniqueWorkOrders.map((wo) => {
                              const tooltipParts = [`${wo.withdrawalsCount} retiro${wo.withdrawalsCount === 1 ? '' : 's'} (${formatQty(wo.quantity)})`, wo.otNumbers.length > 0 ? `OTs: ${wo.otNumbers.join(', ')}` : '', wo.ships.length > 0 ? `Buques: ${wo.ships.join(', ')}` : ''].filter(Boolean)
                              return <span key={wo.key} title={tooltipParts.join(' · ')} className="inline-flex items-center px-2 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-500/40 text-cyan-200 font-semibold text-[11px] hover:border-cyan-300 transition-colors cursor-default">{wo.label}</span>
                            })}
                          </div>
                        ) : <span className="text-slate-600 italic text-[11px]">Sin consumos registrados</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <GridStatusBarBottom
            isFixed={false} filteredCount={summary.months.length} totalCount={summary.months.length} entityName="meses"
            selectionStats={sheet.selectionStats} onClearSelection={sheet.clearSelection}
            globalAggregates={[
              { label: 'TOTAL 6M', value: formatQty(summary.grandTotal), highlight: true },
              { label: 'PROM/MES', value: `${formatQty(summary.monthlyAverage)}/mes` }
            ]}
          />

          <div className="flex justify-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>OTs únicas por mes (sin repetir aunque tenga múltiples retiros)</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-gradient-to-r from-emerald-950/60 via-slate-950 to-amber-950/60 border border-emerald-500/40">
            <div className="flex items-center justify-between sm:block px-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 block">TOTAL GENERAL (6 MESES)</span>
              <span className="text-base font-black font-mono text-white">{formatQty(summary.grandTotal)}</span>
            </div>
            <div className="flex items-center justify-between sm:block px-2 sm:border-l sm:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block">PROMEDIO MENSUAL</span>
              <span className="text-base font-black font-mono text-amber-200">{formatQty(summary.monthlyAverage)}/mes</span>
            </div>
            <div className="flex items-center justify-between sm:block px-2 sm:border-l sm:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 block">VITALIDAD ESTIMADA</span>
              <div>
                <span className={`text-sm font-black font-mono ${summary.vitality.physical.status === 'CRITICO' || summary.vitality.physical.status === 'NEGATIVO' || summary.vitality.physical.status === 'AGOTADO' ? 'text-rose-300' : summary.vitality.physical.status === 'ALERTA' ? 'text-amber-300' : summary.vitality.physical.status === 'SALUDABLE' ? 'text-emerald-300' : 'text-slate-300'}`}>{summary.vitality.physical.label}</span>
                {summary.vitality.hasVirtual && <span className="block text-[10px] font-mono text-cyan-300/90">Con tránsito (+{virtualQty}): {summary.vitality.withVirtual.label}</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="alon-modal-footer">
          {onReponer && (
            <button type="button" onClick={() => onReponer(material)} className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-md">
              <ShoppingCart className="w-3.5 h-3.5 stroke-[2.5]" /><span>Reponer en Compras</span>
            </button>
          )}
          <button type="button" onClick={onClose} className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer text-xs">Cerrar</button>
        </div>
      </div>
    </div>
  )
}
