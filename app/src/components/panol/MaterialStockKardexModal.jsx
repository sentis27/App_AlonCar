import { useEffect, useMemo, useState } from 'react'
import { History, RefreshCw, Scale, ShoppingCart, X } from 'lucide-react'
import { fetchMaterialKardexDataService } from '../../lib/panolKardexService'
import { formatDateAr, formatDateTimeAr } from '../../lib/dateTimeCanonical'
import { formatUnitMeasureShort } from '../../lib/unitMeasureUtils'
import { useSheetSelection } from '../../hooks/grid/useSheetSelection'
import { KARDEX_SHEET_COLUMNS } from '../../lib/sheetColumnsOperational'
import GridStatusBarBottom from '../GridStatusBarBottom'

const SOURCE_BADGES = {
  COMPRA: { label: 'Compra Recibida', cls: 'bg-cyan-950/90 text-cyan-300 border-cyan-500/50' },
  AJUSTE: { label: 'Entrada / Ajuste', cls: 'bg-teal-950/90 text-teal-300 border-teal-500/50' },
  RETIRO: { label: 'Retiro Pañol', cls: 'bg-rose-950/80 text-rose-300 border-rose-500/40' }
}

const FILTER_TABS = [
  { id: 'ALL', label: 'Todos' },
  { id: 'COMPRA', label: 'Compras (+)' },
  { id: 'AJUSTE', label: 'Entradas & Ajustes' },
  { id: 'RETIRO', label: 'Retiros Pañol (−)' }
]

export default function MaterialStockKardexModal({ material, onClose, onOpenStockAdjust = null, onOpenQuickPurchase = null }) {
  const [sourceFilter, setSourceFilter] = useState('ALL')
  const [state, setState] = useState(() => ({
    loadedForId: null, error: '',
    data: { entries: [], totalIn: 0, totalOut: 0, virtualQty: 0, pendingOrdersCount: 0, currentStockDb: Number(material?.current_stock) || 0 }
  }))

  useEffect(() => {
    if (!material?.id) return
    let cancelled = false
    const targetId = material.id
    fetchMaterialKardexDataService(targetId)
      .then((res) => { if (!cancelled) setState({ loadedForId: targetId, error: '', data: res }) })
      .catch((err) => { if (!cancelled) setState((prev) => ({ loadedForId: targetId, error: err?.message || 'Error cargando Kárdex del material.', data: prev.data })) })
    return () => { cancelled = true }
  }, [material?.id])

  const loading = Boolean(material?.id && state.loadedForId !== material.id)
  const { error, data } = state
  const unitShort = formatUnitMeasureShort(material?.unit_measure)
  const stockMin = Number(material?.minimum_stock) || 0
  const physicalStock = Number(data.currentStockDb ?? material?.current_stock ?? 0)
  const isCritical = Boolean(material?.requires_stock_control) && physicalStock <= stockMin

  const visibleEntries = useMemo(
    () => (sourceFilter === 'ALL' ? data.entries : data.entries.filter((e) => e.sourceType === sourceFilter)),
    [data.entries, sourceFilter]
  )
  const sheet = useSheetSelection({ rows: visibleEntries, columns: KARDEX_SHEET_COLUMNS, getRowId: (r) => r.id, sortable: true })

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !sheet.selectionRange && !sheet.activeCell) onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, sheet.selectionRange, sheet.activeCell])

  if (!material) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 font-sans">
      <div ref={sheet.containerRef} tabIndex={0} onKeyDown={sheet.handleKeyDown} className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden text-xs focus:outline-none">
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shrink-0"><History className="w-4 h-4" /></div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-black text-white uppercase tracking-wide truncate">{material.name}</h2>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${material.requires_stock_control ? 'bg-emerald-950 text-emerald-300 border-emerald-700' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                  {material.requires_stock_control ? 'Control Físico' : 'Sin Control'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">{material.rubro || 'SIN RUBRO'} · {material.category || 'MATERIALES'} · Unidad oficial: {material.unit_measure || 'Unidad'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer shrink-0"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 px-5 py-3 bg-slate-950/50 border-b border-slate-800 font-mono">
          <div className={`p-2 rounded-xl border ${isCritical ? 'bg-rose-950/40 border-rose-500/50' : 'bg-slate-900 border-slate-800'}`}>
            <span className="block text-[9px] uppercase text-slate-400 font-bold">Stock Físico Actual</span>
            <span className={`text-sm font-black ${isCritical ? 'text-rose-300' : 'text-emerald-300'}`}>{physicalStock} {unitShort}</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
            <span className="block text-[9px] uppercase text-slate-400 font-bold">Stock Mínimo</span>
            <span className="text-sm font-black text-slate-200">{stockMin} {unitShort}</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-900 border border-cyan-500/30">
            <span className="block text-[9px] uppercase text-cyan-400 font-bold">Stock Virtual ({data.pendingOrdersCount})</span>
            <span className="text-sm font-black text-cyan-300">+{data.virtualQty} {unitShort}</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
            <span className="block text-[9px] uppercase text-emerald-400 font-bold">Total Entradas (+)</span>
            <span className="text-sm font-black text-emerald-300">+{data.totalIn} {unitShort}</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
            <span className="block text-[9px] uppercase text-rose-400 font-bold">Total Salidas (−)</span>
            <span className="text-sm font-black text-rose-300">−{data.totalOut} {unitShort}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTER_TABS.map((t) => (
              <button key={t.id} type="button" onClick={() => setSourceFilter(t.id)} className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${sourceFilter === t.id ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'}`}>{t.label}</button>
            ))}
          </div>
          <span className="text-[11px] font-mono text-slate-400">{visibleEntries.length} movimiento(s) · más reciente arriba</span>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="py-12 text-center text-slate-400"><RefreshCw className="w-5 h-5 text-cyan-400 animate-spin mx-auto mb-2" /><span>Calculando Kárdex cronológico desde Compras, Entradas y Retiros...</span></div>
          ) : error ? (
            <div className="m-5 p-3 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-200 font-bold">{error}</div>
          ) : visibleEntries.length === 0 ? (
            <div className="py-12 text-center text-slate-500">Sin movimientos registrados para este filtro.</div>
          ) : (
            <table className="w-full text-left text-[11px] border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                <tr>
                  <th {...sheet.getHeaderProps('date', 'py-2 px-3')}>Fecha y Hora{sheet.getSortIndicator('date')}</th>
                  <th {...sheet.getHeaderProps('sourceType', 'py-2 px-3')}>Origen{sheet.getSortIndicator('sourceType')}</th>
                  <th {...sheet.getHeaderProps('reference', 'py-2 px-3')}>Referencia / Notas{sheet.getSortIndicator('reference')}</th>
                  <th {...sheet.getHeaderProps('delta', 'py-2 px-3 text-right')}>Movimiento{sheet.getSortIndicator('delta')}</th>
                  <th {...sheet.getHeaderProps('runningBalance', 'py-2 px-3 text-right')}>Saldo Acum.{sheet.getSortIndicator('runningBalance')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {sheet.sortedRows.map((ev, rowIdx) => {
                  const badge = SOURCE_BADGES[ev.sourceType] || SOURCE_BADGES.AJUSTE
                  const isPositive = ev.delta > 0
                  const cpDate = sheet.getCellProps(rowIdx, 'date'), cpSrc = sheet.getCellProps(rowIdx, 'sourceType'), cpRef = sheet.getCellProps(rowIdx, 'reference'), cpDel = sheet.getCellProps(rowIdx, 'delta'), cpBal = sheet.getCellProps(rowIdx, 'runningBalance')
                  return (
                    <tr key={ev.id} className="hover:bg-slate-800/40">
                      <td {...cpDate.domProps} className={`py-2 px-3 font-mono text-slate-300 whitespace-nowrap ${cpDate.className}`}>{formatDateTimeAr(ev.timestampIso, { fallback: formatDateAr(ev.dateIso) })}</td>
                      <td {...cpSrc.domProps} className={`py-2 px-3 whitespace-nowrap ${cpSrc.className}`}><span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${badge.cls}`}>{badge.label}</span></td>
                      <td {...cpRef.domProps} className={`py-2 px-3 max-w-[300px] ${cpRef.className}`}>
                        <div className="font-semibold text-white truncate">{ev.reference || '—'}</div>
                        {ev.notes && <div className="text-[10px] text-slate-400 truncate" title={ev.notes}>{ev.notes}</div>}
                      </td>
                      <td {...cpDel.domProps} className={`py-2 px-3 text-right font-mono font-black whitespace-nowrap ${isPositive ? 'text-emerald-300' : 'text-rose-300'} ${cpDel.className}`}>{isPositive ? `+${ev.delta}` : ev.delta} {unitShort}</td>
                      <td {...cpBal.domProps} className={`py-2 px-3 text-right font-mono font-bold whitespace-nowrap ${ev.runningBalance < 0 ? 'text-rose-400' : 'text-cyan-200'} ${cpBal.className}`}>{ev.runningBalance} {unitShort}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-4 py-2 border-t border-slate-800 bg-slate-950/50">
          <GridStatusBarBottom
            isFixed={false} filteredCount={visibleEntries.length} totalCount={data.entries.length} entityName="movimientos"
            hasActiveFilter={sourceFilter !== 'ALL'} onClearFilters={() => setSourceFilter('ALL')}
            selectionStats={sheet.selectionStats} onClearSelection={sheet.clearSelection}
            globalAggregates={[{ label: 'Stock Físico', value: `${physicalStock} ${unitShort}`, highlight: true }]}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-t border-slate-800 bg-slate-950/70">
          <div className="flex flex-wrap items-center gap-2">
            {onOpenStockAdjust && (
              <button type="button" onClick={() => onOpenStockAdjust(material)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-slate-950 font-black text-xs cursor-pointer">
                <Scale className="w-3.5 h-3.5" /><span>+ Registrar Entrada / Ajuste</span>
              </button>
            )}
            {onOpenQuickPurchase && (
              <button type="button" onClick={() => onOpenQuickPurchase(material)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/60 text-cyan-300 font-bold text-xs cursor-pointer">
                <ShoppingCart className="w-3.5 h-3.5" /><span>Pedir a Compras</span>
              </button>
            )}
          </div>
          <button type="button" onClick={onClose} className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer">Cerrar</button>
        </div>
      </div>
    </div>
  )
}
