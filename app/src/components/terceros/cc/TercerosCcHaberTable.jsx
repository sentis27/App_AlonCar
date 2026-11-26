/**
 * TercerosCcHaberTable.jsx
 * Panel derecho del Libro en "T": HABER (Pagos en USD, AR$/E-Cheqs con o sin IVA y Canjes).
 * Cumple formato fecha DD/MM/AAAA (FL-024), FL-025 y motor Excel/Sheets (FL-027) con barra propia.
 */
import React, { useRef, useMemo } from 'react'
import { Edit3, Trash2, Receipt, Banknote, ArrowLeftRight } from 'lucide-react'
import CanonicalProgressiveTableFooter from '../../canonical/CanonicalProgressiveTableFooter'
import GridStatusBarBottom from '../../GridStatusBarBottom'
import { useProgressiveRows } from '../../../hooks/useProgressiveRows'
import { useSheetSelection } from '../../../hooks/grid/useSheetSelection'
import { CC_HABER_SHEET_COLUMNS } from '../../../lib/sheetColumnsOperational'
import { formatDateAr } from '../../../lib/dateTimeCanonical'

const PAYMENT_TYPE_META = {
  EFECTIVO_USD: { label: 'Efectivo US$', cls: 'bg-emerald-950/80 text-emerald-300 border-emerald-600/60', Icon: Banknote },
  TRANSFERENCIA_ARS: { label: 'Transf. AR$', cls: 'bg-cyan-950/80 text-cyan-300 border-cyan-600/60', Icon: Banknote },
  ECHEQ_ARS: { label: 'E-Cheq AR$', cls: 'bg-indigo-950/80 text-indigo-300 border-indigo-500/60', Icon: Receipt },
  COMPENSACION_PANOL: { label: 'Remito Pañol', cls: 'bg-amber-950/80 text-amber-300 border-amber-500/60', Icon: ArrowLeftRight },
  COMPENSACION_TRABAJO: { label: 'Canje Trabajo', cls: 'bg-purple-950/80 text-purple-300 border-purple-500/60', Icon: ArrowLeftRight },
}

const fmtUsd = (val) => `US$ ${Number(val || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtArs = (val) => `AR$ ${Number(val || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function TercerosCcHaberTable({
  rows = [], resetKey = '', canManageCc = false, onEditPayment, onDeletePayment,
}) {
  const scrollRef = useRef(null)
  const sheet = useSheetSelection({ rows, columns: CC_HABER_SHEET_COLUMNS, getRowId: (r) => r.id, sortable: true })
  const { visibleItems, visibleCount, hasMore, remainingCount, loadMore, showAll, sentinelRef } = useProgressiveRows({
    items: sheet.sortedRows, scrollContainerRef: scrollRef, resetKey,
  })
  const totalHaberUsd = useMemo(() => rows.reduce((s, r) => s + (Number(r.amount_usd) || 0), 0), [rows])

  return (
    <div ref={sheet.containerRef} tabIndex={0} onKeyDown={sheet.handleKeyDown} className="alon-zone-grid flex flex-col focus:outline-none">
      <div className="alon-grid-ribbon">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-black text-emerald-300 uppercase tracking-wider">HABER · Pagos y Compensaciones</span>
          <span className="text-slate-400 font-mono">({rows.length} movimientos)</span>
        </div>
        <span className="text-[10px] text-slate-400">Neto imputado en US$ (sin IVA)</span>
      </div>

      <div ref={scrollRef} className="alon-grid-scroll">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="alon-grid-thead sticky top-0 z-10 text-[10px] uppercase tracking-wider text-slate-300">
            <tr>
              <th {...sheet.getHeaderProps('payment_date', 'py-2 px-2.5')}>Fecha Pago{sheet.getSortIndicator('payment_date')}</th>
              <th {...sheet.getHeaderProps('payment_type', 'py-2 px-2')}>Modalidad{sheet.getSortIndicator('payment_type')}</th>
              <th {...sheet.getHeaderProps('amount_usd', 'py-2 px-2 text-right')}>Neto US${sheet.getSortIndicator('amount_usd')}</th>
              <th {...sheet.getHeaderProps('detail', 'py-2 px-2')}>Detalle / Comprobante{sheet.getSortIndicator('detail')}</th>
              <th {...sheet.getHeaderProps('observations', 'py-2 px-2')}>Observaciones{sheet.getSortIndicator('observations')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {visibleItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500">
                  No hay pagos ni compensaciones registrados en el HABER.
                </td>
              </tr>
            ) : (
              visibleItems.map((p, rowIdx) => {
                const meta = PAYMENT_TYPE_META[p.payment_type] || PAYMENT_TYPE_META.EFECTIVO_USD
                const IconComp = meta.Icon
                const cpDate = sheet.getCellProps(rowIdx, 'payment_date')
                const cpType = sheet.getCellProps(rowIdx, 'payment_type')
                const cpUsd = sheet.getCellProps(rowIdx, 'amount_usd')
                const cpDet = sheet.getCellProps(rowIdx, 'detail')
                const cpObs = sheet.getCellProps(rowIdx, 'observations')
                return (
                  <tr key={p.id} className="hover:bg-slate-900/70 transition-colors align-top">
                    <td {...cpDate.domProps} className={`py-2 px-2.5 font-mono text-slate-200 whitespace-nowrap ${cpDate.className}`}>
                      {formatDateAr(p.payment_date)}
                    </td>

                    <td {...cpType.domProps} className={`py-2 px-2 whitespace-nowrap ${cpType.className}`}>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.cls}`}>
                        <IconComp className="w-3 h-3" />
                        <span>{meta.label}</span>
                      </span>
                      {p.source_module === 'TESORERIA' && <div className="text-[9px] text-cyan-300 font-mono mt-0.5">Origen: Tesorería</div>}
                    </td>

                    <td {...cpUsd.domProps} className={`py-2 px-2 text-right font-mono whitespace-nowrap ${cpUsd.className}`}>
                      <div className="font-black text-emerald-300">+{fmtUsd(p.amount_usd)}</div>
                      {p.has_iva && Number(p.gross_usd_with_iva) > 0 && <div className="text-[10px] text-slate-400">c/IVA: {fmtUsd(p.gross_usd_with_iva)}</div>}
                    </td>

                    <td {...cpDet.domProps} className={`py-2 px-2 text-[11px] text-slate-300 ${cpDet.className}`}>
                      {Number(p.amount_ars) > 0 && (
                        <div className="font-mono">{fmtArs(p.amount_ars)} {p.exchange_rate ? `· TC ${Number(p.exchange_rate).toLocaleString('es-AR')}` : ''}</div>
                      )}
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {p.has_invoice && p.invoice_number && <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-cyan-200">{p.invoice_number}</span>}
                        {p.panol_remito_number && <span className="px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-700/60 text-[10px] font-mono text-amber-200">Rem. Pañol #{p.panol_remito_number}</span>}
                        {!p.has_invoice && !p.panol_remito_number && p.payment_type === 'EFECTIVO_USD' && <span className="text-[10px] text-slate-500">Sin factura</span>}
                      </div>
                    </td>

                    <td {...cpObs.domProps} className={`py-2 px-2 text-slate-300 ${cpObs.className}`}>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11px] leading-snug">{p.observations || '—'}</span>
                        {canManageCc && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button type="button" onClick={() => onEditPayment?.(p)} className="p-1 text-slate-400 hover:text-cyan-300 cursor-pointer" title="Editar pago / compensación"><Edit3 className="w-3.5 h-3.5" /></button>
                            <button type="button" onClick={() => onDeletePayment?.(p)} className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer" title="Eliminar pago / compensación"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
            <CanonicalProgressiveTableFooter visibleCount={visibleCount} totalCount={rows.length} hasMore={hasMore} remainingCount={remainingCount} loadMore={loadMore} showAll={showAll} sentinelRef={sentinelRef} colSpan={5} entityLabel="pagos del HABER" />
          </tbody>
        </table>
      </div>

      <div className="p-2 border-t border-slate-800/80">
        <GridStatusBarBottom
          isFixed={false}
          filteredCount={rows.length}
          totalCount={rows.length}
          entityName="pagos HABER"
          selectionStats={sheet.selectionStats}
          onClearSelection={sheet.clearSelection}
          globalAggregates={[{ label: 'Σ HABER', value: fmtUsd(totalHaberUsd), highlight: true }]}
        />
      </div>
    </div>
  )
}
