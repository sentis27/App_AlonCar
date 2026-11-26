/**
 * TercerosCcDebeTable.jsx
 * Panel izquierdo del Libro en "T": DEBE (Trabajos / Remitos absorbidos).
 * Incluye desglose por chapa/OT con CanonicalOtBadge, edición inline de tarifa
 * especial (azul), motor Excel/Sheets (FL-027) con barra inferior propia y FL-025.
 */
import React, { useState, useRef, useMemo } from 'react'
import { ChevronDown, ChevronRight, CheckCircle2, Clock, Edit3, Trash2, Link2 } from 'lucide-react'
import CanonicalOtBadge from '../../canonical/CanonicalOtBadge'
import CanonicalProgressiveTableFooter from '../../canonical/CanonicalProgressiveTableFooter'
import GridStatusBarBottom from '../../GridStatusBarBottom'
import { useProgressiveRows } from '../../../hooks/useProgressiveRows'
import { useSheetSelection } from '../../../hooks/grid/useSheetSelection'
import { CC_DEBE_SHEET_COLUMNS } from '../../../lib/sheetColumnsOperational'
import { formatDateAr } from '../../../lib/dateTimeCanonical'

const fmtUsd = (val) => `US$ ${Number(val || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtRate = (val) => `US$ ${Number(val || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
const fmtKg = (val) => Number(val || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function getRemitoPillClass(tier) {
  if (tier === 'cancelled_current') return 'bg-emerald-700/85 text-white border-emerald-400'
  if (tier === 'cancelled_historical') return 'bg-emerald-400/20 text-emerald-200 border-emerald-400/60'
  if (tier === 'special') return 'bg-sky-500/25 text-sky-200 border-sky-400/75'
  return 'bg-amber-500/15 text-amber-200 border-amber-500/50'
}

export default function TercerosCcDebeTable({
  rows = [], resetKey = '', searchTerm = '', cancellationMode = 'FIFO', pricingMode = 'PER_KG',
  workOrders = [], workItems = [], ships = [], canManageCc = false,
  onSaveSpecialRate, onToggleManualCancel, onEditManualEntry, onDeleteManualEntry,
}) {
  const scrollRef = useRef(null)
  const [expandedKeys, setExpandedKeys] = useState(() => new Set())
  const [editingRate, setEditingRate] = useState({ id: null, value: '' })

  const sheet = useSheetSelection({ rows, columns: CC_DEBE_SHEET_COLUMNS, getRowId: (r) => r.id, sortable: true })
  const { visibleItems, visibleCount, hasMore, remainingCount, loadMore, showAll, sentinelRef } = useProgressiveRows({
    items: sheet.sortedRows, scrollContainerRef: scrollRef, resetKey,
  })

  const woById = useMemo(() => new Map((workOrders || []).map((w) => [w.id, w])), [workOrders])
  const shipById = useMemo(() => new Map((ships || []).map((s) => [s.id, s])), [ships])
  const debeTotals = useMemo(() => rows.reduce((acc, r) => ({
    kg: acc.kg + (Number(r.weightKg) || 0),
    usd: acc.usd + (Number(r.amountUsd) || 0)
  }), { kg: 0, usd: 0 }), [rows])

  const toggleExpand = (rowId) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(rowId)) next.delete(rowId)
      else next.add(rowId)
      return next
    })
  }

  const commitRateEdit = (row) => {
    const raw = editingRate.value
    setEditingRate({ id: null, value: '' })
    const num = Number(String(raw || '').replace(',', '.'))
    if (!Number.isFinite(num) || num < 0) return
    if (Number(num.toFixed(4)) === Number(Number(row.rateUsdApplied || 0).toFixed(4))) return
    const reason = window.prompt('Motivo del ajuste especial de tarifa (ej. acero inoxidable / espesor):', row.specialRateReason || 'Ajuste especial a la tarifa')
    if (reason === null) return
    onSaveSpecialRate?.(row, num, reason)
  }

  return (
    <div ref={sheet.containerRef} tabIndex={0} onKeyDown={sheet.handleKeyDown} className="alon-zone-grid flex flex-col focus:outline-none">
      <div className="alon-grid-ribbon">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-black text-amber-300 uppercase tracking-wider">DEBE · Trabajos y Remitos</span>
          <span className="text-slate-400 font-mono">({rows.length} ítems)</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-400 flex-wrap">
          <span className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Cancelado</span>
          <span className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-sky-400 inline-block" /> Tarifa especial</span>
          <span className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Pendiente</span>
        </div>
      </div>

      <div ref={scrollRef} className="alon-grid-scroll">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="alon-grid-thead sticky top-0 z-10 text-[10px] uppercase tracking-wider text-slate-300">
            <tr>
              <th {...sheet.getHeaderProps('remitoNumber', 'py-2 px-2.5')}>Remito AlonCar{sheet.getSortIndicator('remitoNumber')}</th>
              <th {...sheet.getHeaderProps('quincenaLabel', 'py-2 px-2')}>Quincena / Obra{sheet.getSortIndicator('quincenaLabel')}</th>
              <th {...sheet.getHeaderProps('weightKg', 'py-2 px-2 text-right')}>Kilos{sheet.getSortIndicator('weightKg')}</th>
              <th {...sheet.getHeaderProps('rateUsdApplied', 'py-2 px-2 text-right')}>{pricingMode === 'BY_VOUCHER' ? 'Base' : 'Tarifa US$/kg ✎'}{sheet.getSortIndicator('rateUsdApplied')}</th>
              <th {...sheet.getHeaderProps('amountUsd', 'py-2 px-2 text-right')}>Monto US${sheet.getSortIndicator('amountUsd')}</th>
              <th {...sheet.getHeaderProps('status', 'py-2 px-2 text-center')}>Estado{sheet.getSortIndicator('status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {visibleItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  No hay trabajos o remitos registrados en el DEBE con los filtros actuales.
                </td>
              </tr>
            ) : (
              visibleItems.map((row, rowIdx) => {
                const isExpanded = expandedKeys.has(row.id)
                const canExpand = (row.items && row.items.length > 0) || Boolean(row.description) || Boolean(row.specialRateReason)
                const primaryWo = row.workOrderId ? woById.get(row.workOrderId) || null : null
                const primaryShip = row.shipId ? shipById.get(row.shipId) || null : null
                const cpRem = sheet.getCellProps(rowIdx, 'remitoNumber')
                const cpQuin = sheet.getCellProps(rowIdx, 'quincenaLabel')
                const cpKg = sheet.getCellProps(rowIdx, 'weightKg')
                const cpRate = sheet.getCellProps(rowIdx, 'rateUsdApplied')
                const cpUsd = sheet.getCellProps(rowIdx, 'amountUsd')
                const cpSt = sheet.getCellProps(rowIdx, 'status')

                return (
                  <React.Fragment key={row.id}>
                    <tr className="hover:bg-slate-900/70 transition-colors">
                      <td {...cpRem.domProps} className={`py-2 px-2.5 whitespace-nowrap ${cpRem.className}`}>
                        <div className="flex items-center gap-1.5">
                          {canExpand ? (
                            <button type="button" onClick={() => toggleExpand(row.id)} className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer" title="Desplegar detalle de chapas, barco y OT">
                              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                          ) : <span className="w-4 inline-block" />}
                          <span className={`px-2 py-0.5 rounded border font-mono font-black text-[11px] ${getRemitoPillClass(row.visualTier)}`}>{row.remitoNumber}</span>
                          {row.tercerosLink?.hasTercerosVoucher && (
                            <span className="text-cyan-300" title={`Vinculado a ${row.tercerosLink.count} comprobante(s) en Terceros`}><Link2 className="w-3 h-3" /></span>
                          )}
                        </div>
                      </td>

                      <td {...cpQuin.domProps} className={`py-2 px-2 ${cpQuin.className}`}>
                        <div className="font-bold text-slate-200 whitespace-nowrap">{row.quincenaLabel}</div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[10px] font-mono text-slate-400">{formatDateAr(row.entryDate)}</span>
                          <CanonicalOtBadge wo={primaryWo} ship={primaryShip} workItems={workItems} workOrders={workOrders} searchQuery={searchTerm} variant="compact" className="text-[10px] text-slate-400" />
                        </div>
                      </td>

                      <td {...cpKg.domProps} className={`py-2 px-2 text-right font-mono text-slate-200 whitespace-nowrap ${cpKg.className}`}>
                        {row.weightKg > 0 ? fmtKg(row.weightKg) : '—'}
                      </td>

                      <td
                        {...cpRate.domProps}
                        className={`py-2 px-2 text-right font-mono whitespace-nowrap ${cpRate.className}`}
                        onDoubleClick={() => { if (canManageCc && pricingMode !== 'BY_VOUCHER') setEditingRate({ id: row.id, value: String(row.rateUsdApplied ?? 0) }) }}
                        title={row.isSpecialRate ? `Tarifa especial: ${row.specialRateReason || 'Ajuste manual'} (doble clic para editar)` : canManageCc && pricingMode !== 'BY_VOUCHER' ? 'Doble clic para aplicar ajuste especial a la tarifa (azul)' : undefined}
                      >
                        {editingRate.id === row.id ? (
                          <input
                            type="number" step="0.0001" autoFocus value={editingRate.value}
                            onChange={(e) => setEditingRate((prev) => ({ ...prev, value: e.target.value }))}
                            onBlur={() => commitRateEdit(row)}
                            onKeyDown={(e) => { if (e.key === 'Enter') commitRateEdit(row); if (e.key === 'Escape') setEditingRate({ id: null, value: '' }) }}
                            className="w-20 px-1.5 py-0.5 rounded bg-slate-950 border border-sky-400 text-sky-200 text-right font-mono text-xs focus:outline-none"
                          />
                        ) : (
                          <span className={row.isSpecialRate ? 'text-sky-300 font-black underline decoration-sky-500/60 cursor-pointer' : 'text-slate-300 cursor-pointer'}>
                            {row.rateUsdApplied > 0 ? fmtRate(row.rateUsdApplied) : '—'}
                          </span>
                        )}
                      </td>

                      <td {...cpUsd.domProps} className={`py-2 px-2 text-right font-mono font-black whitespace-nowrap ${row.isSpecialRate ? 'text-sky-300' : row.isCancelled ? 'text-emerald-300' : 'text-amber-200'} ${cpUsd.className}`}>
                        {fmtUsd(row.amountUsd)}
                      </td>

                      <td {...cpSt.domProps} className={`py-2 px-2 text-center whitespace-nowrap ${cpSt.className}`}>
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => { if (canManageCc && cancellationMode !== 'FIFO') onToggleManualCancel?.(row) }}
                            disabled={!canManageCc || cancellationMode === 'FIFO'}
                            title={cancellationMode === 'FIFO' ? 'Modo FIFO automático activo (cambiá a Manual en Zona 3 si querés tildar fila por fila)' : 'Clic para marcar o desmarcar como cancelado'}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${row.isCancelled ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/60' : 'bg-amber-950/70 text-amber-300 border-amber-500/50'} ${cancellationMode === 'MANUAL' && canManageCc ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}`}
                          >
                            {row.isCancelled ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            <span>{row.isCancelled ? 'Cancelado' : 'Pendiente'}</span>
                          </button>
                          {row.entrySource === 'MANUAL' && canManageCc && (
                            <>
                              <button type="button" onClick={() => onEditManualEntry?.(row)} className="p-1 text-slate-400 hover:text-cyan-300 cursor-pointer" title="Editar ajuste manual"><Edit3 className="w-3.5 h-3.5" /></button>
                              <button type="button" onClick={() => onDeleteManualEntry?.(row)} className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer" title="Eliminar ajuste manual"><Trash2 className="w-3.5 h-3.5" /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-slate-900/55">
                        <td colSpan={6} className="px-4 py-2 text-[11px] text-slate-300 space-y-1.5 border-l-2 border-l-cyan-500/60">
                          {row.specialRateReason && <div className="text-sky-300 font-semibold">Tarifa especial: {row.specialRateReason}</div>}
                          {row.description && <div className="text-slate-300">Detalle: {row.description}</div>}
                          {row.items?.length > 0 && (
                            <div className="space-y-1 pt-0.5">
                              {row.items.map((it) => (
                                <div key={it.id} className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/70 px-2.5 py-1 rounded border border-slate-800">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-white">{it.materialName}</span>
                                    <span className="text-cyan-300 font-mono">{it.quantity} {it.unitMeasure} ({fmtKg(it.weightKg)} kg)</span>
                                    <CanonicalOtBadge wo={it.workOrder} ship={{ id: it.shipId, name: it.shipName }} workItems={workItems} workOrders={workOrders} searchQuery={searchTerm} variant="inline" className="text-[11px]" />
                                  </div>
                                  <span className="text-[10px] text-slate-400">{it.shipName}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })
            )}
            <CanonicalProgressiveTableFooter visibleCount={visibleCount} totalCount={rows.length} hasMore={hasMore} remainingCount={remainingCount} loadMore={loadMore} showAll={showAll} sentinelRef={sentinelRef} colSpan={6} entityLabel="trabajos del DEBE" />
          </tbody>
        </table>
      </div>

      <div className="p-2 border-t border-slate-800/80">
        <GridStatusBarBottom
          isFixed={false}
          filteredCount={rows.length}
          totalCount={rows.length}
          entityName="trabajos DEBE"
          selectionStats={sheet.selectionStats}
          onClearSelection={sheet.clearSelection}
          globalAggregates={[
            ...(debeTotals.kg > 0 ? [{ label: 'Σ KG', value: `${fmtKg(debeTotals.kg)} kg` }] : []),
            { label: 'Σ DEBE', value: fmtUsd(debeTotals.usd), highlight: true }
          ]}
        />
      </div>
    </div>
  )
}
