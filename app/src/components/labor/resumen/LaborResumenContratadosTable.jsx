/**
 * LaborResumenContratadosTable.jsx
 * Botón 3 ("Contratados") de `4. Resumen Horas` — réplica fiel de la hoja `CONTRATADOS`:
 * 14 columnas exactas, franjas de color por contratista, `% AVANCE PRC` automático, observaciones in-situ
 * y Cierre de Quincena inmutable. Sin tarjetas KPI ni cruce `Σ MAT. PAÑOL vs LISTA`.
 */
import React, { useMemo, useRef, useState } from 'react'
import { Download, Lock, RotateCcw } from 'lucide-react'
import CanonicalOtBadge from '../../canonical/CanonicalOtBadge'
import CanonicalPrcBadge from '../../canonical/CanonicalPrcBadge'
import CanonicalProgressiveTableFooter from '../../canonical/CanonicalProgressiveTableFooter'
import CanonicalZone3Toolbar from '../../canonical/CanonicalZone3Toolbar'
import GridStatusBarBottom from '../../GridStatusBarBottom'
import HighlightText from '../../HighlightText'
import { useProgressiveRows } from '../../../hooks/useProgressiveRows'
import { useSheetSelection } from '../../../hooks/grid/useSheetSelection'
import { exportToSpreadsheet } from '../../../lib/exportEngine'
import { getFilterSelectClass } from '../../../lib/filterThemeConstants'
import { matchesUniversalSearch } from '../../../lib/searchEngine'
import { buildContratadosExportPayload, CONTRATADOS_SHEET_COLUMNS } from '../../../lib/contractorSettlementEngine'

const fmtArs = (v) => `$ ${Number(v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtHs = (v) => Number(v || 0).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })

export default function LaborResumenContratadosTable({
  settlement = { isClosed: false, closureMeta: null, rows: [], totals: {}, fortnightDollarRate: 1500 },
  periodKey = '',
  workOrders = [],
  workItems = [],
  ships = [],
  canManage = false,
  isMasterAdmin = false,
  loading = false,
  onSaveObservation,
  onCloseQuincena,
  onReopenQuincena,
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [contractorFilter, setContractorFilter] = useState('todos')
  const [typeFilter, setTypeFilter] = useState('todos')
  const [obsDrafts, setObsDrafts] = useState({})
  const [busyAction, setBusyAction] = useState(false)
  const searchRef = useRef(null)
  const scrollRef = useRef(null)

  const contractorOptions = useMemo(() => {
    const names = Array.from(new Set((settlement.rows || []).map((r) => r.contractorLabel).filter(Boolean)))
    return names.sort((a, b) => a.localeCompare(b, 'es'))
  }, [settlement.rows])

  const filteredRows = useMemo(() => (settlement.rows || []).filter((r) => {
    if (contractorFilter !== 'todos' && r.contractorLabel !== contractorFilter) return false
    if (typeFilter !== 'todos' && r.workType !== typeFilter) return false
    if (searchTerm && !matchesUniversalSearch(r, searchTerm)) return false
    return true
  }), [settlement.rows, contractorFilter, typeFilter, searchTerm])

  const filteredTotals = useMemo(() => ({
    hours: filteredRows.reduce((s, r) => s + Number(r.hours || 0), 0),
    grossArs: filteredRows.reduce((s, r) => s + Number(r.grossArs || 0), 0),
    materialsArs: filteredRows.reduce((s, r) => s + Number(r.materialsArs || 0), 0),
    advancesArs: filteredRows.reduce((s, r) => s + Number(r.advancesArs || 0), 0),
    netPayableArs: filteredRows.reduce((s, r) => s + Number(r.netPayableArs || 0), 0),
  }), [filteredRows])

  const sheet = useSheetSelection({ rows: filteredRows, columns: CONTRATADOS_SHEET_COLUMNS, getRowId: (r) => r.rowKey, sortable: true })
  const { visibleItems, visibleCount, hasMore, remainingCount, loadMore, showAll, sentinelRef } = useProgressiveRows({
    items: sheet.sortedRows,
    scrollContainerRef: scrollRef,
    resetKey: `${periodKey}|${contractorFilter}|${typeFilter}|${searchTerm}`,
  })

  const hasActiveFilters = Boolean(searchTerm || contractorFilter !== 'todos' || typeFilter !== 'todos')
  const clearAllFilters = () => { setSearchTerm(''); setContractorFilter('todos'); setTypeFilter('todos') }

  const commitObservation = async (row) => {
    if (settlement.isClosed || !canManage) return
    const nextVal = obsDrafts[row.rowKey]
    if (nextVal === undefined || nextVal === (row.observations || '')) return
    await onSaveObservation?.(row, nextVal)
  }

  const handleCloseClick = async () => {
    if (!canManage || settlement.isClosed) return
    const ok = window.confirm(`¿Cerrar e inmovilizar la liquidación de Contratados de ${periodKey} (${settlement.rows.length} filas · Total A Pagar ${fmtArs(settlement.totals?.totalNetPayableArs)})?`)
    if (!ok) return
    setBusyAction(true)
    try { await onCloseQuincena?.() } finally { setBusyAction(false) }
  }

  const handleReopenClick = async () => {
    if (!isMasterAdmin || !settlement.closureMeta?.id) return
    if (!window.confirm(`¿Reabrir la quincena ${periodKey} a modo Borrador en vivo?`)) return
    setBusyAction(true)
    try { await onReopenQuincena?.(settlement.closureMeta.id) } finally { setBusyAction(false) }
  }

  return (
    <div className="space-y-2.5 font-sans">
      <div className="px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-slate-300">
            VALOR DÓLAR PARA MATERIALES: <strong className="text-amber-300 font-black">{fmtArs(settlement.fortnightDollarRate)}</strong>
          </span>
          <span className="font-mono text-slate-300">
            TOTAL HORAS: <strong className="text-cyan-300 font-black">{fmtHs(filteredTotals.hours)} hs</strong>
          </span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${settlement.isClosed ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50' : 'bg-amber-950/70 text-amber-300 border-amber-500/50'}`}>
            {settlement.isClosed ? <><Lock className="w-3 h-3" /> QUINCENA CERRADA</> : 'BORRADOR EN VIVO'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!settlement.isClosed && canManage && (
            <button type="button" disabled={busyAction} onClick={handleCloseClick} className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black text-xs inline-flex items-center gap-1.5 cursor-pointer">
              <Lock className="w-3.5 h-3.5" />
              <span>Cerrar Quincena</span>
            </button>
          )}
          {settlement.isClosed && isMasterAdmin && (
            <button type="button" disabled={busyAction} onClick={handleReopenClick} className="px-3 py-1.5 rounded-lg bg-amber-950/80 hover:bg-amber-900 border border-amber-500/50 text-amber-200 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reabrir Borrador</span>
            </button>
          )}
          <button type="button" onClick={() => exportToSpreadsheet(buildContratadosExportPayload(filteredRows, periodKey, settlement.fortnightDollarRate))} className="px-3 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-200 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer">
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      <CanonicalZone3Toolbar
        searchValue={searchTerm} onSearchChange={setSearchTerm} searchInputRef={searchRef}
        searchPlaceholder="Buscar contratista, cliente/barco, OT, PRC o observaciones..."
        hasActiveFilters={hasActiveFilters} onClearAllFilters={clearAllFilters}
        counterText={`${filteredRows.length} de ${(settlement.rows || []).length} filas`}
        filters={(
          <>
            <select value={contractorFilter} onChange={(e) => setContractorFilter(e.target.value)} className={getFilterSelectClass('contractor', contractorFilter !== 'todos')}>
              <option value="todos">Contratista (Todos)</option>
              {contractorOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={getFilterSelectClass('category', typeFilter !== 'todos')}>
              <option value="todos">Tipo Trabajo (Todos)</option>
              <option value="HORA">HORA</option>
              <option value="PRESUPUESTO">PRESUPUESTO</option>
            </select>
          </>
        )}
      />

      <div ref={sheet.containerRef} tabIndex={0} onKeyDown={sheet.handleKeyDown} className="alon-zone-grid flex flex-col focus:outline-none">
        <div ref={scrollRef} className="alon-grid-scroll">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead className="alon-grid-thead sticky top-0 z-10 text-[10px] uppercase tracking-wider text-slate-200">
              <tr>
                <th {...sheet.getHeaderProps('contractorLabel', 'py-2 px-2 whitespace-nowrap')}>CONTRATISTA{sheet.getSortIndicator('contractorLabel')}</th>
                <th {...sheet.getHeaderProps('shipName', 'py-2 px-2 whitespace-nowrap')}>CLIENTE{sheet.getSortIndicator('shipName')}</th>
                <th {...sheet.getHeaderProps('otLabel', 'py-2 px-2')}>ORDEN TRABAJO{sheet.getSortIndicator('otLabel')}</th>
                <th {...sheet.getHeaderProps('workType', 'py-2 px-2 whitespace-nowrap')}>TIPO TRABAJO{sheet.getSortIndicator('workType')}</th>
                <th {...sheet.getHeaderProps('prcDisplay', 'py-2 px-2 whitespace-nowrap')}>Nº PRC{sheet.getSortIndicator('prcDisplay')}</th>
                <th {...sheet.getHeaderProps('hours', 'py-2 px-2 text-right whitespace-nowrap')}>HORAS{sheet.getSortIndicator('hours')}</th>
                <th {...sheet.getHeaderProps('hourlyRateArs', 'py-2 px-2 text-right whitespace-nowrap')}>$/h{sheet.getSortIndicator('hourlyRateArs')}</th>
                <th {...sheet.getHeaderProps('grossArs', 'py-2 px-2 text-right whitespace-nowrap')}>Importe a pagar{sheet.getSortIndicator('grossArs')}</th>
                <th {...sheet.getHeaderProps('materialsArs', 'py-2 px-2 text-right whitespace-nowrap')}>MATERIALES{sheet.getSortIndicator('materialsArs')}</th>
                <th {...sheet.getHeaderProps('advancesArs', 'py-2 px-2 text-right whitespace-nowrap')}>ANTICIPOS{sheet.getSortIndicator('advancesArs')}</th>
                <th {...sheet.getHeaderProps('netPayableArs', 'py-2 px-2 text-right whitespace-nowrap')}>A PAGAR{sheet.getSortIndicator('netPayableArs')}</th>
                <th {...sheet.getHeaderProps('progressPct', 'py-2 px-2 text-right whitespace-nowrap')}>AVANCE PRC{sheet.getSortIndicator('progressPct')}</th>
                <th {...sheet.getHeaderProps('prcStatus', 'py-2 px-2 whitespace-nowrap')}>ESTADO PRC{sheet.getSortIndicator('prcStatus')}</th>
                <th {...sheet.getHeaderProps('observations', 'py-2 px-2 min-w-[160px]')}>OBSERVACIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {loading ? (
                <tr><td colSpan={14} className="py-10 text-center text-cyan-300 font-semibold">Calculando hoja Contratados {periodKey}...</td></tr>
              ) : visibleItems.length === 0 ? (
                <tr><td colSpan={14} className="py-10 text-center text-slate-400">No hay imputaciones ni descuentos de contratistas para <strong>{periodKey}</strong>.</td></tr>
              ) : (
                visibleItems.map((row, rowIdx) => {
                  const obsVal = obsDrafts[row.rowKey] !== undefined ? obsDrafts[row.rowKey] : (row.observations || '')
                  const pct = row.progressPct
                  const pctCls = pct === null || pct === undefined ? 'text-slate-600' : pct > 100 ? 'text-rose-300 font-black' : pct >= 85 ? 'text-amber-300 font-bold' : 'text-cyan-300 font-bold'
                  return (
                    <tr key={row.rowKey} className={`${row.bandStyle?.rowBg || ''} ${row.bandStyle?.borderAccent || ''} hover:brightness-110 transition-all`}>
                      <td {...sheet.getCellProps(rowIdx, 'contractorLabel').domProps} className={`py-1.5 px-2 whitespace-nowrap ${sheet.getCellProps(rowIdx, 'contractorLabel').className}`}>
                        <span className={`inline-block px-2 py-0.5 rounded border font-black text-[10px] ${row.bandStyle?.chipBg || 'bg-slate-800 text-white'}`}>
                          <HighlightText text={row.contractorLabel} query={searchTerm} />
                        </span>
                      </td>
                      <td {...sheet.getCellProps(rowIdx, 'shipName').domProps} className={`py-1.5 px-2 font-semibold text-white whitespace-nowrap ${sheet.getCellProps(rowIdx, 'shipName').className}`}>
                        <HighlightText text={row.shipName} query={searchTerm} />
                      </td>
                      <td {...sheet.getCellProps(rowIdx, 'otLabel').domProps} className={`py-1.5 px-2 max-w-[180px] ${sheet.getCellProps(rowIdx, 'otLabel').className}`}>
                        <CanonicalOtBadge wo={row.workOrder} ship={row.shipRecord || ships.find((s) => s.id === row.shipId)} workItems={workItems} workOrders={workOrders} sinOtLabel={row.otLabel || 'HORA GENERAL'} searchQuery={searchTerm} variant="compact" />
                      </td>
                      <td {...sheet.getCellProps(rowIdx, 'workType').domProps} className={`py-1.5 px-2 font-bold whitespace-nowrap ${row.workType === 'PRESUPUESTO' ? 'text-amber-300' : 'text-slate-200'} ${sheet.getCellProps(rowIdx, 'workType').className}`}>{row.workType}</td>
                      <td {...sheet.getCellProps(rowIdx, 'prcDisplay').domProps} className={`py-1.5 px-2 whitespace-nowrap ${sheet.getCellProps(rowIdx, 'prcDisplay').className}`}>
                        {row.prcRecord || row.prcNumber ? <CanonicalPrcBadge prc={row.prcRecord} additionals={row.prcAdditionals} legacyNumber={row.prcNumber ? String(row.prcNumber) : ''} variant="pill" searchQuery={searchTerm} /> : <span className="text-slate-600">—</span>}
                      </td>
                      <td {...sheet.getCellProps(rowIdx, 'hours').domProps} className={`py-1.5 px-2 text-right font-mono text-slate-200 whitespace-nowrap ${sheet.getCellProps(rowIdx, 'hours').className}`}>{fmtHs(row.hours)}</td>
                      <td {...sheet.getCellProps(rowIdx, 'hourlyRateArs').domProps} className={`py-1.5 px-2 text-right font-mono text-slate-300 whitespace-nowrap ${sheet.getCellProps(rowIdx, 'hourlyRateArs').className}`}>{row.hourlyRateArs > 0 ? fmtArs(row.hourlyRateArs) : '$ 0,00'}</td>
                      <td {...sheet.getCellProps(rowIdx, 'grossArs').domProps} className={`py-1.5 px-2 text-right font-mono font-semibold text-white whitespace-nowrap ${sheet.getCellProps(rowIdx, 'grossArs').className}`}>{fmtArs(row.grossArs)}</td>
                      <td {...sheet.getCellProps(rowIdx, 'materialsArs').domProps} className={`py-1.5 px-2 text-right font-mono whitespace-nowrap ${row.materialsArs > 0 ? 'text-amber-300' : 'text-slate-500'} ${sheet.getCellProps(rowIdx, 'materialsArs').className}`}>{fmtArs(row.materialsArs)}</td>
                      <td {...sheet.getCellProps(rowIdx, 'advancesArs').domProps} className={`py-1.5 px-2 text-right font-mono whitespace-nowrap ${row.advancesArs > 0 ? 'text-cyan-300' : 'text-slate-500'} ${sheet.getCellProps(rowIdx, 'advancesArs').className}`}>{fmtArs(row.advancesArs)}</td>
                      <td {...sheet.getCellProps(rowIdx, 'netPayableArs').domProps} className={`py-1.5 px-2 text-right font-mono font-black whitespace-nowrap ${row.netPayableArs < 0 ? 'text-rose-300' : 'text-emerald-300'} ${sheet.getCellProps(rowIdx, 'netPayableArs').className}`}>{fmtArs(row.netPayableArs)}</td>
                      <td {...sheet.getCellProps(rowIdx, 'progressPct').domProps} className={`py-1.5 px-2 text-right font-mono whitespace-nowrap ${pctCls} ${sheet.getCellProps(rowIdx, 'progressPct').className}`} title={pct !== null && pct !== undefined ? `${fmtHs(row.prcCumulativeHours)} hs imputadas / ${fmtHs(row.estimatedHours)} hs estimadas` : 'Sin PRC con tarifa'}>
                        {pct !== null && pct !== undefined ? `${pct}%` : '—'}
                      </td>
                      <td {...sheet.getCellProps(rowIdx, 'prcStatus').domProps} className={`py-1.5 px-2 font-bold whitespace-nowrap text-slate-300 ${sheet.getCellProps(rowIdx, 'prcStatus').className}`}>{row.prcStatus}</td>
                      <td {...sheet.getCellProps(rowIdx, 'observations').domProps} className={`py-1 px-2 ${sheet.getCellProps(rowIdx, 'observations').className}`}>
                        {!settlement.isClosed && canManage ? (
                          <input
                            type="text"
                            value={obsVal}
                            onChange={(e) => setObsDrafts((prev) => ({ ...prev, [row.rowKey]: e.target.value }))}
                            onBlur={() => commitObservation(row)}
                            placeholder="Observación..."
                            className="w-full bg-slate-950/70 border border-slate-700/80 focus:border-cyan-400 rounded px-2 py-0.5 text-[11px] text-white outline-none"
                          />
                        ) : (
                          <span className="text-slate-300"><HighlightText text={row.observations || '—'} query={searchTerm} /></span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
              <CanonicalProgressiveTableFooter visibleCount={visibleCount} totalCount={filteredRows.length} hasMore={hasMore} remainingCount={remainingCount} loadMore={loadMore} showAll={showAll} sentinelRef={sentinelRef} colSpan={14} entityLabel="filas de contratados" />
            </tbody>
            {filteredRows.length > 0 && (
              <tfoot className="bg-slate-950/95 border-t border-slate-700 text-[11px] font-mono font-black">
                <tr>
                  <td colSpan={5} className="py-2 px-3 text-right text-slate-300 uppercase">TOTALES ({filteredRows.length} filas)</td>
                  <td className="py-2 px-2 text-right text-cyan-300 whitespace-nowrap">{fmtHs(filteredTotals.hours)}</td>
                  <td className="py-2 px-2" />
                  <td className="py-2 px-2 text-right text-white whitespace-nowrap">{fmtArs(filteredTotals.grossArs)}</td>
                  <td className="py-2 px-2 text-right text-amber-300 whitespace-nowrap">{fmtArs(filteredTotals.materialsArs)}</td>
                  <td className="py-2 px-2 text-right text-cyan-300 whitespace-nowrap">{fmtArs(filteredTotals.advancesArs)}</td>
                  <td className={`py-2 px-2 text-right whitespace-nowrap ${filteredTotals.netPayableArs < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{fmtArs(filteredTotals.netPayableArs)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <GridStatusBarBottom isFixed={false} filteredCount={filteredRows.length} totalCount={(settlement.rows || []).length} entityName="contratados" hasActiveFilter={hasActiveFilters} onClearFilters={clearAllFilters} selectionStats={sheet.selectionStats} onClearSelection={sheet.clearSelection} />
      </div>
    </div>
  )
}
