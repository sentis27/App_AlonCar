/**
 * TercerosPrcRegistryTable.jsx
 * Planilla oficial `Base de datos de PRC` (Gallo · FL-025 · FL-027 · CanonicalOtBadge).
 * El `Nº PRC` es fijo e inmutable; anular tacha la fila y crear adicional encadena al padre.
 */
import React, { useMemo, useRef } from 'react'
import { Ban, CheckCircle2, Edit3, GitBranchPlus, Lock, RotateCcw } from 'lucide-react'
import CanonicalOtBadge from '../../canonical/CanonicalOtBadge'
import CanonicalProgressiveTableFooter from '../../canonical/CanonicalProgressiveTableFooter'
import GridStatusBarBottom from '../../GridStatusBarBottom'
import HighlightText from '../../HighlightText'
import { useProgressiveRows } from '../../../hooks/useProgressiveRows'
import { useSheetSelection } from '../../../hooks/grid/useSheetSelection'
import { formatDateAr } from '../../../lib/dateTimeCanonical'
import { formatPrcNumberLabel, PRC_REGISTRY_SHEET_COLUMNS } from '../../../lib/prcRegistryRules'

const fmtArs = (v) => `AR$ ${Number(v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtUsd = (v) => `US$ ${Number(v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function PrcStatusPill({ row }) {
  if (row.status === 'ANULADO') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-950/80 text-rose-300 border border-rose-500/60"
        title={row.annulled_reason ? `Anulado: ${row.annulled_reason}` : 'PRC Anulado'}
      >
        <Ban className="w-3 h-3" /> ANULADO
      </span>
    )
  }
  if (row.status === 'TERMINADO') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-950/80 text-emerald-300 border border-emerald-500/50">
        <CheckCircle2 className="w-3 h-3" /> TERMINADO
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-950/80 text-amber-300 border border-amber-500/50">
      ACTIVO
    </span>
  )
}

export default function TercerosPrcRegistryTable({
  rows = [],
  totalCount = 0,
  resetKey = '',
  searchTerm = '',
  hasActiveFilters = false,
  onClearAllFilters,
  ships = [],
  workOrders = [],
  workItems = [],
  canManagePrc = false,
  onCreateAdditional,
  onEditPrc,
  onToggleTerminated,
  onOpenAnnul,
}) {
  const scrollRef = useRef(null)
  const sheet = useSheetSelection({ rows, columns: PRC_REGISTRY_SHEET_COLUMNS, getRowId: (r) => r.id, sortable: true })
  const { visibleItems, visibleCount, hasMore, remainingCount, loadMore, showAll, sentinelRef } = useProgressiveRows({
    items: sheet.sortedRows,
    scrollContainerRef: scrollRef,
    resetKey,
  })

  const woById = useMemo(() => new Map((workOrders || []).map((w) => [w.id, w])), [workOrders])
  const shipById = useMemo(() => new Map((ships || []).map((s) => [s.id, s])), [ships])

  return (
    <div ref={sheet.containerRef} tabIndex={0} onKeyDown={sheet.handleKeyDown} className="alon-zone-grid flex flex-col focus:outline-none">
      <div className="alon-grid-ribbon">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-black text-amber-300 uppercase tracking-wider">Libreta Oficial · Base de datos de PRC</span>
          <span className="text-slate-400 font-mono">({rows.length} de {totalCount})</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          <span className="inline-flex items-center gap-1"><Lock className="w-3 h-3 text-amber-400" /> Nº PRC inmutable</span>
          <span>Clic en columna = seleccionar · Doble clic en encabezado = ordenar</span>
        </div>
      </div>

      <div ref={scrollRef} className="alon-grid-scroll">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="alon-grid-thead sticky top-0 z-10 text-[10px] uppercase tracking-wider text-slate-300">
            <tr>
              <th {...sheet.getHeaderProps('prc_number', 'py-2 px-2.5 whitespace-nowrap')}>Nº PRC{sheet.getSortIndicator('prc_number')}</th>
              <th {...sheet.getHeaderProps('issue_date', 'py-2 px-2 whitespace-nowrap')}>Fecha{sheet.getSortIndicator('issue_date')}</th>
              <th {...sheet.getHeaderProps('contractor_name', 'py-2 px-2')}>Contratista{sheet.getSortIndicator('contractor_name')}</th>
              <th {...sheet.getHeaderProps('shipName', 'py-2 px-2')}>Barco{sheet.getSortIndicator('shipName')}</th>
              <th {...sheet.getHeaderProps('otLabel', 'py-2 px-2')}>Orden de Trabajo{sheet.getSortIndicator('otLabel')}</th>
              <th {...sheet.getHeaderProps('description', 'py-2 px-2 min-w-[200px]')}>Descripción{sheet.getSortIndicator('description')}</th>
              <th {...sheet.getHeaderProps('amount_ars', 'py-2 px-2 text-right whitespace-nowrap')}>Importe AR${sheet.getSortIndicator('amount_ars')}</th>
              <th {...sheet.getHeaderProps('amount_usd', 'py-2 px-2 text-right whitespace-nowrap')}>Importe US${sheet.getSortIndicator('amount_usd')}</th>
              <th {...sheet.getHeaderProps('parentLabel', 'py-2 px-2 whitespace-nowrap')}>Vínculo{sheet.getSortIndicator('parentLabel')}</th>
              <th {...sheet.getHeaderProps('status', 'py-2 px-2 whitespace-nowrap')}>Estado{sheet.getSortIndicator('status')}</th>
              <th {...sheet.getHeaderProps('observations', 'py-2 px-2')}>Observaciones{sheet.getSortIndicator('observations')}</th>
              <th className="py-2 px-2.5 text-right whitespace-nowrap">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {visibleItems.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-10 text-center text-slate-500">
                  No hay presupuestos PRC registrados con los filtros actuales. Usá <strong>+ Nuevo PRC</strong> o elegí PRC desde Unificado / Terceros.
                </td>
              </tr>
            ) : (
              visibleItems.map((row, rowIdx) => {
                const isAnnulled = row.status === 'ANULADO'
                const strikeCls = isAnnulled ? 'line-through decoration-rose-400/80 text-slate-400' : ''
                const wo = row.work_order_id ? woById.get(row.work_order_id) || null : null
                const ship = row.ship_id ? shipById.get(row.ship_id) || null : (wo?.ship_id ? shipById.get(wo.ship_id) || null : null)
                const cNum = sheet.getCellProps(rowIdx, 'prc_number')
                const cDate = sheet.getCellProps(rowIdx, 'issue_date')
                const cContr = sheet.getCellProps(rowIdx, 'contractor_name')
                const cShip = sheet.getCellProps(rowIdx, 'shipName')
                const cOt = sheet.getCellProps(rowIdx, 'otLabel')
                const cDesc = sheet.getCellProps(rowIdx, 'description')
                const cArs = sheet.getCellProps(rowIdx, 'amount_ars')
                const cUsd = sheet.getCellProps(rowIdx, 'amount_usd')
                const cLink = sheet.getCellProps(rowIdx, 'parentLabel')
                const cSt = sheet.getCellProps(rowIdx, 'status')
                const cObs = sheet.getCellProps(rowIdx, 'observations')

                return (
                  <tr
                    key={row.id}
                    className={`transition-colors align-top ${isAnnulled ? 'bg-rose-950/15 opacity-70' : 'hover:bg-slate-900/70'}`}
                  >
                    <td {...cNum.domProps} className={`py-2 px-2.5 whitespace-nowrap ${cNum.className}`}>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono font-black text-xs border ${isAnnulled ? 'bg-rose-950/70 text-rose-300 border-rose-600/50 line-through' : 'bg-amber-950/80 text-amber-300 border-amber-500/50'}`}>
                        {formatPrcNumberLabel(row.prc_number)}
                      </span>
                    </td>
                    <td {...cDate.domProps} className={`py-2 px-2 font-mono whitespace-nowrap ${strikeCls || 'text-slate-300'} ${cDate.className}`}>
                      {formatDateAr(row.issue_date)}
                    </td>
                    <td {...cContr.domProps} className={`py-2 px-2 font-bold ${strikeCls || 'text-white'} ${cContr.className}`}>
                      <HighlightText text={row.contractor_name} query={searchTerm} />
                    </td>
                    <td {...cShip.domProps} className={`py-2 px-2 whitespace-nowrap ${strikeCls || 'text-cyan-300 font-semibold'} ${cShip.className}`}>
                      <HighlightText text={row.shipName} query={searchTerm} />
                    </td>
                    <td {...cOt.domProps} className={`py-2 px-2 max-w-[190px] ${strikeCls} ${cOt.className}`}>
                      <CanonicalOtBadge wo={wo} ship={ship} workItems={workItems} workOrders={workOrders} searchQuery={searchTerm} variant="compact" />
                    </td>
                    <td {...cDesc.domProps} className={`py-2 px-2 max-w-[260px] ${strikeCls || 'text-slate-200'} ${cDesc.className}`}>
                      <HighlightText text={row.description || '—'} query={searchTerm} />
                    </td>
                    <td {...cArs.domProps} className={`py-2 px-2 text-right font-mono font-bold whitespace-nowrap ${strikeCls || 'text-emerald-300'} ${cArs.className}`}>
                      {fmtArs(row.amount_ars)}
                    </td>
                    <td {...cUsd.domProps} className={`py-2 px-2 text-right font-mono whitespace-nowrap ${strikeCls || 'text-slate-300'} ${cUsd.className}`}>
                      {fmtUsd(row.amount_usd)}
                    </td>
                    <td {...cLink.domProps} className={`py-2 px-2 whitespace-nowrap ${cLink.className}`}>
                      {row.parentLabel && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-950/80 text-purple-300 border border-purple-500/50">
                          {row.parentLabel}
                        </span>
                      )}
                      {row.additionalsCount > 0 && (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 ml-1"
                          title={`Adicionales: ${row.additionalsNumbers.map((n) => `#${n}`).join(', ')}`}
                        >
                          +{row.additionalsCount} adic.
                        </span>
                      )}
                      {!row.parentLabel && row.additionalsCount === 0 && <span className="text-slate-600">—</span>}
                    </td>
                    <td {...cSt.domProps} className={`py-2 px-2 whitespace-nowrap ${cSt.className}`}>
                      <PrcStatusPill row={row} />
                    </td>
                    <td {...cObs.domProps} className={`py-2 px-2 max-w-[190px] text-[11px] ${cObs.className}`}>
                      {isAnnulled && row.annulled_reason ? (
                        <span className="text-rose-300 font-semibold">Anulado: {row.annulled_reason}</span>
                      ) : (
                        <span className="text-slate-400"><HighlightText text={row.observations || '—'} query={searchTerm} /></span>
                      )}
                    </td>
                    <td className="py-2 px-2.5 whitespace-nowrap text-right">
                      {canManagePrc && !isAnnulled ? (
                        <div className="inline-flex items-center gap-1">
                          <button type="button" onClick={() => onCreateAdditional?.(row)} title={`Crear PRC adicional al #${row.prc_number}`} className="p-1.5 rounded-lg bg-purple-950/70 hover:bg-purple-800/70 text-purple-300 border border-purple-500/40 cursor-pointer">
                            <GitBranchPlus className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => onToggleTerminated?.(row)} title={row.status === 'TERMINADO' ? 'Reabrir a ACTIVO' : 'Marcar como TERMINADO'} className="p-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-800/70 text-emerald-300 border border-emerald-500/40 cursor-pointer">
                            {row.status === 'TERMINADO' ? <RotateCcw className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          </button>
                          <button type="button" onClick={() => onEditPrc?.(row)} title="Editar detalle (Nº PRC bloqueado)" className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => onOpenAnnul?.(row)} title="Anular y tachar este PRC" className="p-1.5 rounded-lg bg-rose-950/70 hover:bg-rose-800/70 text-rose-300 border border-rose-500/40 cursor-pointer">
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] font-mono text-slate-600">{isAnnulled ? 'Tachado' : 'Solo lectura'}</span>
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
              entityLabel="PRCs"
            />
          </tbody>
        </table>
      </div>

      <GridStatusBarBottom
        isFixed={false}
        filteredCount={rows.length}
        totalCount={totalCount}
        entityName="PRCs"
        hasActiveFilter={hasActiveFilters}
        onClearFilters={onClearAllFilters}
        selectionStats={sheet.selectionStats}
        onClearSelection={sheet.clearSelection}
      />
    </div>
  )
}
