/**
 * TesoreriaCcTable.jsx
 * Planilla operativa de Cuenta Corriente & Pagos de Contratistas (Gallo · FL-025 · FL-027 · CanonicalOtBadge).
 */
import React, { useRef } from 'react'
import { Edit3, FileWarning, Trash2 } from 'lucide-react'
import CanonicalOtBadge from '../canonical/CanonicalOtBadge'
import CanonicalPrcBadge from '../canonical/CanonicalPrcBadge'
import CanonicalProgressiveTableFooter from '../canonical/CanonicalProgressiveTableFooter'
import GridStatusBarBottom from '../GridStatusBarBottom'
import HighlightText from '../HighlightText'
import { useProgressiveRows } from '../../hooks/useProgressiveRows'
import { useSheetSelection } from '../../hooks/grid/useSheetSelection'
import { formatDateAr } from '../../lib/dateTimeCanonical'
import { CC_SCOPE_LABELS, CONTRACTOR_CC_SHEET_COLUMNS } from '../../lib/contractorCcRules'

const fmtArs = (v) => `AR$ ${Number(v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function TesoreriaCcTable({
  rows = [],
  totalCount = 0,
  summary = { totalDebeArs: 0, totalHaberArs: 0, netBalanceArs: 0, debeFacturaCount: 0 },
  resetKey = '',
  searchTerm = '',
  hasActiveFilters = false,
  onClearAllFilters,
  workOrders = [],
  workItems = [],
  canManageCc = false,
  onEditRow,
  onQuickResolveInvoice,
  onDeleteRow,
}) {
  const scrollRef = useRef(null)
  const sheet = useSheetSelection({ rows, columns: CONTRACTOR_CC_SHEET_COLUMNS, getRowId: (r) => r.id, sortable: true })
  const { visibleItems, visibleCount, hasMore, remainingCount, loadMore, showAll, sentinelRef } = useProgressiveRows({
    items: sheet.sortedRows,
    scrollContainerRef: scrollRef,
    resetKey,
  })

  return (
    <div ref={sheet.containerRef} tabIndex={0} onKeyDown={sheet.handleKeyDown} className="alon-zone-grid flex flex-col focus:outline-none">
      <div className="alon-grid-ribbon">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-black text-emerald-300 uppercase tracking-wider">Cuenta Corriente & Pagos de Contratistas</span>
          <span className="text-slate-400 font-mono">({rows.length} de {totalCount})</span>
        </div>
        <div className="text-[10px] text-slate-400">
          Clic para seleccionar · Doble clic en encabezado para ordenar
        </div>
      </div>

      <div ref={scrollRef} className="alon-grid-scroll">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="alon-grid-thead sticky top-0 z-10 text-[10px] uppercase tracking-wider text-slate-300">
            <tr>
              <th {...sheet.getHeaderProps('movement_date', 'py-2 px-2 whitespace-nowrap')}>Fecha{sheet.getSortIndicator('movement_date')}</th>
              <th {...sheet.getHeaderProps('period_key', 'py-2 px-2 whitespace-nowrap')}>Quincena{sheet.getSortIndicator('period_key')}</th>
              <th {...sheet.getHeaderProps('contractor_group', 'py-2 px-2')}>Contratista{sheet.getSortIndicator('contractor_group')}</th>
              <th {...sheet.getHeaderProps('categoryLabel', 'py-2 px-2')}>Categoría / Alcance{sheet.getSortIndicator('categoryLabel')}</th>
              <th {...sheet.getHeaderProps('prcDisplay', 'py-2 px-2 whitespace-nowrap')}>PRC{sheet.getSortIndicator('prcDisplay')}</th>
              <th {...sheet.getHeaderProps('otLabel', 'py-2 px-2')}>Buque / OT{sheet.getSortIndicator('otLabel')}</th>
              <th {...sheet.getHeaderProps('paymentMethodLabel', 'py-2 px-2')}>Medio / Ref.{sheet.getSortIndicator('paymentMethodLabel')}</th>
              <th {...sheet.getHeaderProps('invoiceLabel', 'py-2 px-2 whitespace-nowrap')}>Factura{sheet.getSortIndicator('invoiceLabel')}</th>
              <th {...sheet.getHeaderProps('debeArs', 'py-2 px-2 text-right whitespace-nowrap')}>DEBE AR${sheet.getSortIndicator('debeArs')}</th>
              <th {...sheet.getHeaderProps('haberArs', 'py-2 px-2 text-right whitespace-nowrap')}>HABER AR${sheet.getSortIndicator('haberArs')}</th>
              <th {...sheet.getHeaderProps('observations', 'py-2 px-2')}>Observaciones{sheet.getSortIndicator('observations')}</th>
              <th className="py-2 px-2.5 text-right whitespace-nowrap">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {visibleItems.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-10 text-center text-slate-500">
                  No hay movimientos registrados para los filtros seleccionados. Usá <strong>+ Cargar Movimiento</strong> o pasá los retiros pendientes de Pañol.
                </td>
              </tr>
            ) : (
              visibleItems.map((row, rowIdx) => {
                const cDate = sheet.getCellProps(rowIdx, 'movement_date')
                const cPer = sheet.getCellProps(rowIdx, 'period_key')
                const cContr = sheet.getCellProps(rowIdx, 'contractor_group')
                const cCat = sheet.getCellProps(rowIdx, 'categoryLabel')
                const cPrc = sheet.getCellProps(rowIdx, 'prcDisplay')
                const cOt = sheet.getCellProps(rowIdx, 'otLabel')
                const cPay = sheet.getCellProps(rowIdx, 'paymentMethodLabel')
                const cInv = sheet.getCellProps(rowIdx, 'invoiceLabel')
                const cDebe = sheet.getCellProps(rowIdx, 'debeArs')
                const cHaber = sheet.getCellProps(rowIdx, 'haberArs')
                const cObs = sheet.getCellProps(rowIdx, 'observations')

                return (
                  <tr key={row.id} className="hover:bg-slate-900/70 transition-colors align-top">
                    <td {...cDate.domProps} className={`py-2 px-2 font-mono text-slate-300 whitespace-nowrap ${cDate.className}`}>
                      {formatDateAr(row.movement_date)}
                    </td>
                    <td {...cPer.domProps} className={`py-2 px-2 font-mono text-cyan-300 whitespace-nowrap ${cPer.className}`}>
                      <HighlightText text={row.period_key} query={searchTerm} />
                    </td>
                    <td {...cContr.domProps} className={`py-2 px-2 font-bold text-white ${cContr.className}`}>
                      <HighlightText text={row.contractor_group} query={searchTerm} />
                    </td>
                    <td {...cCat.domProps} className={`py-2 px-2 ${cCat.className}`}>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${row.categoryBadgeCls}`}>
                        {row.categoryLabel}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {CC_SCOPE_LABELS[row.settlement_scope] || row.settlement_scope}
                      </div>
                    </td>
                    <td {...cPrc.domProps} className={`py-2 px-2 whitespace-nowrap ${cPrc.className}`}>
                      {row.prcRecord || row.prc_number ? (
                        <CanonicalPrcBadge
                          prc={row.prcRecord}
                          additionals={row.prcAdditionals}
                          legacyNumber={row.prc_number ? String(row.prc_number) : ''}
                          variant="pill"
                          searchQuery={searchTerm}
                        />
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td {...cOt.domProps} className={`py-2 px-2 max-w-[190px] ${cOt.className}`}>
                      <CanonicalOtBadge
                        wo={row.workOrder}
                        ship={row.shipRecord}
                        workItems={workItems}
                        workOrders={workOrders}
                        sinOtLabel={row.shipName || 'General'}
                        searchQuery={searchTerm}
                        variant="compact"
                      />
                    </td>
                    <td {...cPay.domProps} className={`py-2 px-2 text-slate-300 ${cPay.className}`}>
                      <div className="font-semibold">{row.paymentMethodLabel}</div>
                      {row.payment_reference && (
                        <div className="text-[10px] font-mono text-slate-400"><HighlightText text={row.payment_reference} query={searchTerm} /></div>
                      )}
                    </td>
                    <td {...cInv.domProps} className={`py-2 px-2 whitespace-nowrap ${cInv.className}`}>
                      {row.invoice_status === 'DEBE_FACTURA' && canManageCc ? (
                        <button
                          type="button"
                          onClick={() => onQuickResolveInvoice?.(row)}
                          title="Clic para cargar Nº de Factura recibida"
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border cursor-pointer hover:brightness-110 ${row.invoiceBadgeCls}`}
                        >
                          <FileWarning className="w-3 h-3" />
                          <span>DEBE FACTURA</span>
                        </button>
                      ) : (
                        <div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${row.invoiceBadgeCls}`}>
                            {row.invoiceLabel}
                          </span>
                          {row.invoice_number && (
                            <div className="text-[10px] font-mono text-slate-300 mt-0.5">
                              <HighlightText text={row.invoice_number} query={searchTerm} />
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td {...cDebe.domProps} className={`py-2 px-2 text-right font-mono font-bold whitespace-nowrap ${row.debeArs > 0 ? 'text-rose-300' : 'text-slate-600'} ${cDebe.className}`}>
                      {row.debeArs > 0 ? fmtArs(row.debeArs) : '—'}
                    </td>
                    <td {...cHaber.domProps} className={`py-2 px-2 text-right font-mono font-bold whitespace-nowrap ${row.haberArs > 0 ? 'text-emerald-300' : 'text-slate-600'} ${cHaber.className}`}>
                      {row.haberArs > 0 ? fmtArs(row.haberArs) : '—'}
                    </td>
                    <td {...cObs.domProps} className={`py-2 px-2 max-w-[230px] text-[11px] text-slate-300 ${cObs.className}`}>
                      <HighlightText text={row.observations || '—'} query={searchTerm} />
                    </td>
                    <td className="py-2 px-2.5 whitespace-nowrap text-right">
                      {canManageCc ? (
                        <div className="inline-flex items-center gap-1">
                          <button type="button" onClick={() => onEditRow?.(row)} title="Editar movimiento" className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => onDeleteRow?.(row)} title="Eliminar movimiento" className="p-1.5 rounded-lg bg-rose-950/70 hover:bg-rose-800/70 text-rose-300 border border-rose-500/40 cursor-pointer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] font-mono text-slate-600">Solo lectura</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
            <CanonicalProgressiveTableFooter
              visibleCount={visibleCount}
              totalCount={rows.length}
              hasMore={hasMore}
              remainingCount={remainingCount}
              loadMore={loadMore}
              showAll={showAll}
              sentinelRef={sentinelRef}
              colSpan={12}
              entityLabel="movimientos CC"
            />
          </tbody>
          {rows.length > 0 && (
            <tfoot className="bg-slate-950/95 border-t border-slate-700 text-[11px] font-mono font-bold">
              <tr>
                <td colSpan={8} className="py-2 px-3 text-right text-slate-300 uppercase">
                  Totales filtrados ({rows.length} mov.) · Saldo Neto (HABER − DEBE):{' '}
                  <span className={summary.netBalanceArs >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                    {fmtArs(summary.netBalanceArs)}
                  </span>
                </td>
                <td className="py-2 px-2 text-right text-rose-300 whitespace-nowrap">{fmtArs(summary.totalDebeArs)}</td>
                <td className="py-2 px-2 text-right text-emerald-300 whitespace-nowrap">{fmtArs(summary.totalHaberArs)}</td>
                <td colSpan={2} className="py-2 px-2 text-slate-400">
                  {summary.debeFacturaCount > 0 ? `${summary.debeFacturaCount} pend. factura` : 'Facturación al día'}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <GridStatusBarBottom
        isFixed={false}
        filteredCount={rows.length}
        totalCount={totalCount}
        entityName="movimientos CC"
        hasActiveFilter={hasActiveFilters}
        onClearFilters={onClearAllFilters}
        selectionStats={sheet.selectionStats}
        onClearSelection={sheet.clearSelection}
      />
    </div>
  )
}
