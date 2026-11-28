/**
 * TesoreriaContratadosGrid.jsx
 * Zona 4 (.alon-zone-grid) + Zona 5 (GridStatusBarBottom) de `3. Contratados`.
 * Implementa Motor Excel/Sheets (FL-027), render progresivo (FL-025) y edición in-situ.
 */
import React, { useRef, useMemo } from 'react'
import { Plus, Ship } from 'lucide-react'
import CanonicalProgressiveTableFooter from '../../canonical/CanonicalProgressiveTableFooter'
import GridStatusBarBottom from '../../GridStatusBarBottom'
import { useProgressiveRows } from '../../../hooks/useProgressiveRows'
import { useSheetSelection } from '../../../hooks/grid/useSheetSelection'
import {
  RESUMEN_TAB_ID,
  formatLedgerMoney,
  getLedgerSheetColumns,
} from '../../../lib/contractorLedgerHelpers'
import TesoreriaContratadosInlineRow from './TesoreriaContratadosInlineRow'
import TesoreriaContratadosRow from './TesoreriaContratadosRow'

export default function TesoreriaContratadosGrid({
  entityLabel = '',
  activeTabId = RESUMEN_TAB_ID,
  activeTabLabel = 'RESUMEN',
  resumenSortMode = 'grouped',
  currency = 'ARS',
  rows = [],
  totalCount = 0,
  resetKey = '',
  searchTerm = '',
  hasActiveFilters = false,
  onClearAllFilters,
  ships = [],
  contractorPrcs = [],
  workOrders = [],
  workItems = [],
  canManageCc = false,
  isAddingInline = false,
  onStartInlineRow,
  onSaveInlineRow,
  onCancelInlineRow,
  editingCell = null,
  onStartEditCell,
  onChangeEditValue,
  onCommitEditCell,
  onCancelEditCell,
  onEditRow,
  onQuickResolveInvoice,
  onDeleteRow,
}) {
  const scrollRef = useRef(null)
  const columns = useMemo(() => getLedgerSheetColumns(currency), [currency])
  const sheet = useSheetSelection({ rows, columns, getRowId: (r) => r.id, sortable: false })
  const { visibleItems, visibleCount, hasMore, remainingCount, loadMore, showAll, sentinelRef } = useProgressiveRows({
    items: rows,
    scrollContainerRef: scrollRef,
    resetKey,
  })

  const totals = useMemo(() => {
    let paid = 0
    let accrued = 0
    for (const r of rows) {
      paid += Number(r.paidAmount || 0)
      accrued += Number(r.accruedAmount || 0)
    }
    const lastRow = rows[rows.length - 1]
    const finalBal = lastRow ? Number(lastRow.activeRunningBalance ?? lastRow.runningBalance ?? 0) : 0
    return { paid, accrued, finalBal }
  }, [rows])

  const isResumen = activeTabId === RESUMEN_TAB_ID
  const showBlockSeparators = isResumen && resumenSortMode === 'grouped' && !hasActiveFilters
  const balCls = totals.finalBal < -0.005 ? 'text-rose-300' : totals.finalBal > 0.005 ? 'text-cyan-300' : 'text-emerald-300'

  return (
    <div ref={sheet.containerRef} tabIndex={0} onKeyDown={sheet.handleKeyDown} className="alon-zone-grid flex flex-col focus:outline-none">
      <div className="alon-grid-ribbon">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-black text-amber-300 uppercase tracking-wider">{entityLabel}</span>
          <span className="text-slate-400 font-mono">· {activeTabLabel} ({rows.length} de {totalCount})</span>
          {canManageCc && !isAddingInline && (
            <button
              type="button"
              onClick={onStartInlineRow}
              className="ml-1 px-2 py-0.5 rounded-md bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/60 text-amber-200 font-black text-[10px] inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>+ Fila en Blanco</span>
            </button>
          )}
        </div>
        <div className="text-[10px] text-slate-400">
          Doble clic en celda ✎ para editar directo · Clic en encabezado para sumar columna
        </div>
      </div>

      <div ref={scrollRef} className="alon-grid-scroll">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="alon-grid-thead sticky top-0 z-10 text-[10px] uppercase tracking-wider text-slate-300">
            <tr>
              <th className="py-2 px-2 text-center w-12">#</th>
              <th {...sheet.getHeaderProps('concept', 'py-2 px-2')}>CONCEPTO / DETALLE ✎</th>
              <th {...sheet.getHeaderProps('entryDate', 'py-2 px-2 whitespace-nowrap')}>FECHA ✎</th>
              <th {...sheet.getHeaderProps('paidAmount', 'py-2 px-2 text-right whitespace-nowrap')}>MONTO PAGADO ✎</th>
              <th {...sheet.getHeaderProps('accruedAmount', 'py-2 px-2 text-right whitespace-nowrap')}>QUINCENA / PRC ✎</th>
              <th {...sheet.getHeaderProps('runningBalance', 'py-2 px-2 text-right whitespace-nowrap')}>SALDO</th>
              <th {...sheet.getHeaderProps('refDisplay', 'py-2 px-2 whitespace-nowrap')}>PRC / OT / FACTURA ✎</th>
              <th {...sheet.getHeaderProps('observations', 'py-2 px-2')}>NOTAS ✎</th>
              <th className="py-2 px-2 text-right whitespace-nowrap">Acciones</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/70">
            {isAddingInline && (
              <TesoreriaContratadosInlineRow
                activeTabId={activeTabId}
                activeTabLabel={activeTabLabel}
                currency={currency}
                ships={ships}
                contractorPrcs={contractorPrcs}
                onSave={onSaveInlineRow}
                onCancel={onCancelInlineRow}
              />
            )}

            {visibleItems.length === 0 && !isAddingInline ? (
              <tr>
                <td colSpan={9} className="py-10 text-center text-slate-500">
                  Sin movimientos en <strong>{activeTabLabel}</strong>. Usá <strong>+ Fila en Blanco</strong> para cargar directo en la planilla.
                </td>
              </tr>
            ) : (
              visibleItems.map((row, rowIdx) => (
                <React.Fragment key={row.id}>
                  {showBlockSeparators && row.isBlockStart && (
                    <tr className="bg-slate-900/95 border-y border-amber-500/30">
                      <td colSpan={9} className="py-1.5 px-3">
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="inline-flex items-center gap-1.5 font-black text-amber-300 uppercase tracking-wider">
                            <Ship className="w-3.5 h-3.5 text-cyan-400" />
                            <span>{row.blockShipLabel}</span>
                          </span>
                          <span className={`font-mono font-bold ${Math.abs(row.blockBalance) <= 0.01 ? 'text-emerald-300' : 'text-rose-300'}`}>
                            {Math.abs(row.blockBalance) <= 0.01 ? 'SALDADO $ 0,00' : `Saldo barco: ${formatLedgerMoney(row.blockBalance, currency)}`}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                  <TesoreriaContratadosRow
                    row={row}
                    rowIdx={rowIdx}
                    currency={currency}
                    showShipTag={isResumen && !showBlockSeparators}
                    sheet={sheet}
                    searchTerm={searchTerm}
                    workOrders={workOrders}
                    workItems={workItems}
                    canManageCc={canManageCc}
                    editingCell={editingCell}
                    onStartEditCell={onStartEditCell}
                    onChangeEditValue={onChangeEditValue}
                    onCommitEditCell={onCommitEditCell}
                    onCancelEditCell={onCancelEditCell}
                    onEditRow={onEditRow}
                    onQuickResolveInvoice={onQuickResolveInvoice}
                    onDeleteRow={onDeleteRow}
                  />
                </React.Fragment>
              ))
            )}

            <CanonicalProgressiveTableFooter
              visibleCount={visibleCount}
              totalCount={rows.length}
              hasMore={hasMore}
              remainingCount={remainingCount}
              loadMore={loadMore}
              showAll={showAll}
              sentinelRef={sentinelRef}
              colSpan={9}
              entityLabel="renglones del libro"
            />
          </tbody>

          {rows.length > 0 && (
            <tfoot className="bg-slate-950/95 border-t border-slate-700 text-[11px] font-mono font-bold">
              <tr>
                <td colSpan={3} className="py-2 px-3 text-right text-slate-300 uppercase">
                  Totales {activeTabLabel} ({rows.length} mov.)
                </td>
                <td className="py-2 px-2 text-right text-emerald-300 whitespace-nowrap">
                  {formatLedgerMoney(totals.paid, currency)}
                </td>
                <td className="py-2 px-2 text-right text-amber-300 whitespace-nowrap">
                  {formatLedgerMoney(totals.accrued, currency)}
                </td>
                <td className={`py-2 px-2 text-right font-black whitespace-nowrap ${balCls}`}>
                  {formatLedgerMoney(totals.finalBal, currency)}
                </td>
                <td colSpan={3} className="py-2 px-2 text-slate-400">
                  {totals.finalBal < -0.005 ? 'Saldo pendiente a pagar' : totals.finalBal > 0.005 ? 'Adelanto a favor del astillero' : 'Cuenta saldada'}
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
        entityName="renglones"
        hasActiveFilter={hasActiveFilters}
        onClearFilters={onClearAllFilters}
        selectionStats={sheet.selectionStats}
        onClearSelection={sheet.clearSelection}
      />
    </div>
  )
}
