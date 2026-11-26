import React, { useMemo, useState, useEffect, useRef } from 'react'
import { HelpCircle, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useModuleFilterMemory, resolveInitialModuleFilters } from '../../hooks/useModuleFilterMemory'
import { useReadOnlySheetSelection } from '../../hooks/grid/useReadOnlySheetSelection'
import { useProgressiveRows } from '../../hooks/useProgressiveRows'
import KpiRadar from '../KpiRadar'
import CanonicalZone3Toolbar from '../canonical/CanonicalZone3Toolbar'
import CanonicalProgressiveTableFooter from '../canonical/CanonicalProgressiveTableFooter'
import GridStatusBarBottom from '../GridStatusBarBottom'
import HighlightText from '../HighlightText'
import { formatUsd } from '../../lib/drydockCatalogConstants'
import { formatDateAr } from '../../lib/dateTimeCanonical'
import { getFilterSelectClass } from '../../lib/filterThemeConstants'
import {
  scopeResumenRows,
  extractUniqueSortedOptions,
  computeHorasKpis,
  filterResumenLaborRows,
  buildCleanSheetShortcutFilters,
  resolveHorasShortcutBadge
} from '../../lib/resumenHojaFilters'
import { CostSheetHeaderBar, ReadOnlyGridRibbon } from './CostSheetChrome'
import CanonicalOtBadge from '../canonical/CanonicalOtBadge'
import OvertimeBreakdownCell from './OvertimeBreakdownCell'

const HORAS_SELECTION_COLUMNS = [
  { key: 'date', label: 'Fecha', isNumeric: false, getValue: (r) => formatDateAr(r.date, { fallback: '' }) },
  { key: 'otLabel', label: 'O.T', isNumeric: false, getValue: (r) => r.otLabel || r.otNumber || '' },
  { key: 'workerName', label: 'Operario / Contratista', isNumeric: false, getValue: (r) => r.workerName || '' },
  { key: 'rubro', label: 'Oficio / Rubro', isNumeric: false, getValue: (r) => r.rubro || '' },
  { key: 'workType', label: 'Modalidad', isNumeric: false, getValue: (r) => (r.isPresupuesto ? 'PRESUP. $0' : r.workType || '') },
  { key: 'hoursNormal', label: 'Hs Norm.', isNumeric: true, formatType: 'hours', getValue: (r) => Number(r.hoursNormal) || 0 },
  { key: 'hoursExtraEquiv', label: 'Hs Extra', isNumeric: true, formatType: 'hours', getValue: (r) => (Number(r.hoursExtraEquiv) > 0 ? Number(r.hoursExtraEquiv) : null) },
  { key: 'hourlyRateUsd', label: 'Tarifa US$', isNumeric: true, formatType: 'usd', getValue: (r) => (r.isPresupuesto ? 0 : Number(r.hourlyRateUsd) || 0) },
  { key: 'costUsd', label: 'Costo US$', isNumeric: true, formatType: 'usd', getValue: (r) => (r.isPresupuesto ? 0 : Number(r.costUsd) || 0) },
  { key: 'notes', label: 'Notas', isNumeric: false, getValue: (r) => r.notes || '' }
]

/**
 * Hoja Solo Lectura: HORAS (HORAS GENERALES / HORAS POR O.T).
 * Visibiliza valorización horaria, DEC-013 (Presupuestos = $0) y alertas "R"/"RR".
 */
export default function ResumenHojaHorasPanel({
  ship,
  otRows = [],
  activeOtId,
  costScope = 'GENERAL',
  launchIntent = null,
  initialKpiFilter = 'ALL',
  laborRows = [],
  onSelectSheet,
  onChangeCostScope,
  onBackToSummary
}) {
  const { user, profile } = useAuth()
  const isSummaryShortcut = launchIntent?.mode === 'SUMMARY_SHORTCUT'
  const effectiveShortcutKpi = isSummaryShortcut
    ? (launchIntent?.kpi || 'ALL')
    : (initialKpiFilter && initialKpiFilter !== 'ALL' ? initialKpiFilter : null)

  const initialFilters = useMemo(() => {
    if (isSummaryShortcut) {
      return buildCleanSheetShortcutFilters('resumen_horas', launchIntent?.kpi || 'ALL')
    }
    return resolveInitialModuleFilters(
      user,
      profile,
      'resumen_horas',
      effectiveShortcutKpi ? { kpiFilter: effectiveShortcutKpi } : {}
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [searchQuery, setSearchQuery] = useState(initialFilters.searchQuery)
  const [kpiFilter, setKpiFilter] = useState(initialFilters.kpiFilter)
  const [otFilter, setOtFilter] = useState(initialFilters.otFilter)
  const [workerFilter, setWorkerFilter] = useState(initialFilters.workerFilter)
  const [rubroFilter, setRubroFilter] = useState(initialFilters.rubroFilter)

  const lastHandledLaunchSeqRef = useRef(launchIntent?.seq || 0)
  useEffect(() => {
    if (launchIntent?.mode === 'SUMMARY_SHORTCUT' && launchIntent?.seq && launchIntent.seq !== lastHandledLaunchSeqRef.current) {
      lastHandledLaunchSeqRef.current = launchIntent.seq
      const clean = buildCleanSheetShortcutFilters('resumen_horas', launchIntent.kpi || 'ALL')
      setSearchQuery(clean.searchQuery)
      setKpiFilter(clean.kpiFilter)
      setOtFilter(clean.otFilter)
      setWorkerFilter(clean.workerFilter)
      setRubroFilter(clean.rubroFilter)
    }
  }, [launchIntent])

  const shipId = ship?.id || null
  const prevShipIdRef = useRef(shipId)
  useEffect(() => {
    if (prevShipIdRef.current && shipId && prevShipIdRef.current !== shipId) {
      if (otFilter !== 'ALL' && otFilter !== 'SIN_OT' && !otRows.some((o) => String(o.id) === String(otFilter))) {
        setOtFilter('ALL')
      }
    }
    prevShipIdRef.current = shipId
  }, [shipId, otRows, otFilter])

  const otRowMap = useMemo(() => new Map(otRows.map((o) => [o.id, o])), [otRows])
  const scopedBaseRows = useMemo(
    () => scopeResumenRows(laborRows, { shipId, costScope, activeOtId }),
    [laborRows, shipId, costScope, activeOtId]
  )
  const workerOptions = useMemo(
    () => extractUniqueSortedOptions(scopedBaseRows, (r) => r.workerName),
    [scopedBaseRows]
  )
  const rubroOptions = useMemo(
    () => extractUniqueSortedOptions(scopedBaseRows, (r) => r.rubro),
    [scopedBaseRows]
  )
  const kpiCards = useMemo(() => computeHorasKpis(scopedBaseRows), [scopedBaseRows])
  const filteredRows = useMemo(
    () => filterResumenLaborRows(scopedBaseRows, { kpiFilter, costScope, otFilter, workerFilter, rubroFilter, searchQuery }),
    [scopedBaseRows, kpiFilter, costScope, otFilter, workerFilter, rubroFilter, searchQuery]
  )
  const sheetSelection = useReadOnlySheetSelection({ rows: filteredRows, columns: HORAS_SELECTION_COLUMNS, getRowId: (r) => r.id })
  const { visibleItems: visibleRows, visibleCount, hasMore, remainingCount, loadMore, showAll, sentinelRef } = useProgressiveRows({
    items: filteredRows,
    activeIndex: sheetSelection.activeCell?.rowIndex ?? -1,
    scrollContainerRef: sheetSelection.containerRef,
    resetKey: `${shipId}|${costScope}|${activeOtId || ''}|${kpiFilter}|${otFilter}|${workerFilter}|${rubroFilter}|${searchQuery}`
  })
  const shortcutBadge = resolveHorasShortcutBadge(kpiFilter)
  const summaryStats = useMemo(
    () => filteredRows.reduce((acc, r) => ({
      hoursPhysical: acc.hoursPhysical + (r.hoursPhysical || 0),
      hoursExtraEquiv: acc.hoursExtraEquiv + (r.hoursExtraEquiv || 0),
      presupuestoHours: acc.presupuestoHours + (r.isPresupuesto ? (r.hoursPhysical || 0) : 0),
      totalUsd: acc.totalUsd + (r.costUsd || 0)
    }), { hoursPhysical: 0, hoursExtraEquiv: 0, presupuestoHours: 0, totalUsd: 0 }),
    [filteredRows]
  )

  const hasFilters = Boolean(
    searchQuery ||
    kpiFilter !== 'ALL' ||
    (costScope === 'GENERAL' && otFilter !== 'ALL') ||
    workerFilter !== 'ALL' ||
    rubroFilter !== 'ALL'
  )

  const handleClearFilters = () => {
    setSearchQuery('')
    setKpiFilter('ALL')
    setOtFilter('ALL')
    setWorkerFilter('ALL')
    setRubroFilter('ALL')
  }

  const viewsController = useModuleFilterMemory({
    moduleKey: 'resumen_horas',
    currentFilters: { searchQuery, kpiFilter, otFilter, workerFilter, rubroFilter },
    setters: { searchQuery: setSearchQuery, kpiFilter: setKpiFilter, otFilter: setOtFilter, workerFilter: setWorkerFilter, rubroFilter: setRubroFilter },
    summaryContext: { otRows },
    hasActiveFilters: hasFilters
  })

  return (
    <div className="space-y-3">
      <CostSheetHeaderBar
        activeSheet="horas"
        costScope={costScope}
        shipName={ship?.name || 'Buque'}
        otRows={otRows}
        activeOtId={activeOtId}
        onSelectSheet={onSelectSheet}
        onChangeCostScope={onChangeCostScope}
        onBackToSummary={onBackToSummary}
      />

      <div className="alon-zone-kpis p-3 bg-slate-900/70">
        <KpiRadar
          title="⏱️ RADAR DE MANO DE OBRA, RECARGOS Y PRESUPUESTO ($0) (SOLO LECTURA)"
          subtitle="Clic en cualquier tarjeta para aislar rubro, estado o modalidad · Modalidad CONTROL excluida"
          cards={kpiCards}
          activeFilterId={kpiFilter === 'ALL' ? null : kpiFilter}
          onCardClick={(id) => setKpiFilter((prev) => (prev === id ? 'ALL' : id))}
        />
      </div>

      <CanonicalZone3Toolbar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Buscar operario, contratista, oficio, OT, PRC o notas... (Ctrl+F | Esc limpia todo)"
        viewsController={viewsController}
        hasActiveFilters={hasFilters}
        onClearAllFilters={handleClearFilters}
        filters={
          <>
            {costScope === 'GENERAL' && (
              <select
                value={otFilter}
                onChange={(e) => setOtFilter(e.target.value)}
                className={getFilterSelectClass('ot', otFilter !== 'ALL', 'max-w-[180px]')}
                title="Filtrar por Orden de Trabajo"
              >
                <option value="ALL" className="bg-slate-900">OT: Todas</option>
                {otRows.map((o) => (
                  <option key={o.id} value={o.id} className="bg-slate-900">
                    {o.otLabel || `${o.otNumber} · ${o.title}`}
                  </option>
                ))}
              </select>
            )}

            <select
              value={workerFilter}
              onChange={(e) => setWorkerFilter(e.target.value)}
              className={getFilterSelectClass('contractor', workerFilter !== 'ALL', 'max-w-[200px]')}
              title="Filtrar por Operario o Contratista"
            >
              <option value="ALL" className="bg-slate-900">Operario / Contr.: Todos</option>
              {workerOptions.map((w) => (
                <option key={w} value={w} className="bg-slate-900">
                  {w}
                </option>
              ))}
            </select>

            <select
              value={rubroFilter}
              onChange={(e) => setRubroFilter(e.target.value)}
              className={getFilterSelectClass('trade', rubroFilter !== 'ALL', 'max-w-[165px]')}
              title="Filtrar por Rubro"
            >
              <option value="ALL" className="bg-slate-900">Rubro: Todos</option>
              {rubroOptions.map((r) => (
                <option key={r} value={r} className="bg-slate-900">
                  {r}
                </option>
              ))}
            </select>

            {shortcutBadge && (
              <button
                type="button"
                onClick={() => setKpiFilter('ALL')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border cursor-pointer transition-colors ${shortcutBadge.tone === 'emerald' ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400/70 text-emerald-200' : 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-400/70 text-amber-200'}`}
                title={shortcutBadge.title}
              >
                <span>{shortcutBadge.label}</span>
                <X className="w-3 h-3" />
              </button>
            )}
          </>
        }
      />

      <div className="alon-zone-grid overflow-hidden bg-slate-900/75">
        <ReadOnlyGridRibbon
          badgeText={`👁️ HORAS · ${costScope === 'OT' ? 'POR O.T' : 'GENERAL'} (SOLO LECTURA)`}
          hintText="Ordenado por O.T. · Arrastrá sobre Hs Norm., Hs Extra, Tarifa o Costo para sumar, o sobre texto para contar."
          totalRows={filteredRows.length}
          entityName="partes"
          exportRows={filteredRows}
          exportFilename={`gs004_horas_${ship?.name || 'buque'}.csv`}
          exportColumns={[
            { key: 'date', label: 'Fecha', formatter: (v) => formatDateAr(v, { fallback: '' }) },
            { key: 'otLabel', label: 'O.T' },
            { key: 'workerName', label: 'Operario' },
            { key: 'workerType', label: 'Centro' },
            { key: 'rubro', label: 'Oficio' },
            { key: 'workType', label: 'Modalidad' },
            { key: 'hoursNormal', label: 'Hs Normales' },
            { key: 'hours50', label: 'Hs Extra 50%' },
            { key: 'hours100', label: 'Hs Extra 100%' },
            { key: 'hoursExtraEquiv', label: 'Hs Extra (Conv. Normal)' },
            { key: 'hoursPhysical', label: 'Hs Físicas' },
            { key: 'hoursEquiv', label: 'Hs Equiv Total' },
            { key: 'hourlyRateUsd', label: 'Tarifa US$/h' },
            { key: 'rateSource', label: 'Fuente Tarifa' },
            { key: 'costUsd', label: 'Costo US$' },
            { key: 'approvalStatus', label: 'Estado' },
            { key: 'notes', label: 'Notas' }
          ]}
        />

        <div
          ref={sheetSelection.containerRef}
          tabIndex={0}
          onKeyDown={sheetSelection.handleKeyDown}
          className="overflow-x-auto max-h-[54vh] focus:outline-none"
        >
          <table className="w-full text-xs text-left border-collapse">
            <thead className="alon-grid-thead sticky top-0 z-10 text-[10px] uppercase tracking-wider text-slate-300">
              <tr>
                <th className="px-2.5 py-2 w-10 text-center">#</th>
                <th {...sheetSelection.getHeaderProps('date', 'px-2.5 py-2')}>Fecha</th>
                <th {...sheetSelection.getHeaderProps('otLabel', 'px-2.5 py-2')}>O.T</th>
                <th {...sheetSelection.getHeaderProps('workerName', 'px-2.5 py-2')}>Operario / Contratista</th>
                <th {...sheetSelection.getHeaderProps('rubro', 'px-2.5 py-2')}>Oficio / Rubro</th>
                <th {...sheetSelection.getHeaderProps('workType', 'px-2.5 py-2')}>Modalidad</th>
                <th {...sheetSelection.getHeaderProps('hoursNormal', 'px-2.5 py-2 text-right')}>Hs Norm.</th>
                <th
                  {...sheetSelection.getHeaderProps('hoursExtraEquiv', 'px-2.5 py-2 text-right')}
                  title="Suma de horas extra convertidas a su valor de referencia en horas normales (50% × 1,5 y 100% × 2,0 en Astillero). Acercá el mouse a cada valor para ver el desglose."
                >
                  <span className="inline-flex items-center justify-end gap-1 cursor-help">
                    <span>Hs Extra</span>
                    <HelpCircle className="w-3 h-3 text-amber-400" />
                  </span>
                </th>
                <th {...sheetSelection.getHeaderProps('hourlyRateUsd', 'px-2.5 py-2 text-right')}>Tarifa US$</th>
                <th {...sheetSelection.getHeaderProps('costUsd', 'px-2.5 py-2 text-right')}>Costo US$</th>
                <th {...sheetSelection.getHeaderProps('notes', 'px-2.5 py-2')}>Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                    No hay partes horarios registrados para los filtros actuales.
                  </td>
                </tr>
              ) : (
                <>
                {visibleRows.map((r, idx) => {
                  const cpDate = sheetSelection.getCellProps(idx, 'date')
                  const cpOt = sheetSelection.getCellProps(idx, 'otLabel')
                  const cpWorker = sheetSelection.getCellProps(idx, 'workerName')
                  const cpRubro = sheetSelection.getCellProps(idx, 'rubro')
                  const cpWorkType = sheetSelection.getCellProps(idx, 'workType')
                  const cpHoursNorm = sheetSelection.getCellProps(idx, 'hoursNormal')
                  const cpHoursExtra = sheetSelection.getCellProps(idx, 'hoursExtraEquiv')
                  const cpRate = sheetSelection.getCellProps(idx, 'hourlyRateUsd')
                  const cpCost = sheetSelection.getCellProps(idx, 'costUsd')
                  const cpNotes = sheetSelection.getCellProps(idx, 'notes')

                  return (
                    <tr key={r.id} className="hover:bg-slate-800/45 text-slate-200 transition-colors">
                      <td className="px-2.5 py-1.5 text-center font-mono text-slate-500 select-none">{idx + 1}</td>
                      <td {...cpDate.domProps} className={`px-2.5 py-1.5 whitespace-nowrap font-mono ${cpDate.className}`}>
                        {formatDateAr(r.date)}
                      </td>
                      <td {...cpOt.domProps} className={`px-2.5 py-1.5 max-w-[205px] ${cpOt.className}`}>
                        <CanonicalOtBadge wo={otRowMap.get(r.workOrderId)?.wo || null} ship={ship} otNumber={r.otNumber} otTitle={r.otTitle} searchQuery={searchQuery} tooltipOverride={otRowMap.get(r.workOrderId)?.canonicalTooltip || ''} variant="compact" className="font-mono text-cyan-300 font-semibold" />
                      </td>
                      <td {...cpWorker.domProps} className={`px-2.5 py-1.5 font-medium text-white truncate max-w-[180px] ${cpWorker.className}`} title={r.workerName}>
                        <HighlightText text={r.workerName} query={searchQuery} />
                      </td>
                      <td {...cpRubro.domProps} className={`px-2.5 py-1.5 text-slate-400 ${cpRubro.className}`}>
                        <HighlightText text={r.rubro} query={searchQuery} />
                      </td>
                      <td {...cpWorkType.domProps} className={`px-2.5 py-1.5 whitespace-nowrap ${cpWorkType.className}`}>
                        {r.isPresupuesto ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-200">
                            PRESUP. $0
                          </span>
                        ) : (
                          <span className="text-slate-300">{r.workType}</span>
                        )}
                      </td>
                      <td
                        {...cpHoursNorm.domProps}
                        className={`px-2.5 py-1.5 text-right tabular-nums ${cpHoursNorm.className}`}
                        title={r.hoursExtraPhysical > 0 ? `Hs físicas totales en obra: ${r.hoursPhysical} hs (${r.hoursNormal} norm. + ${r.hoursExtraPhysical} extra)` : undefined}
                      >
                        {r.hoursNormal}
                      </td>
                      <td {...cpHoursExtra.domProps} className={`px-2.5 py-1.5 text-right ${cpHoursExtra.className}`}>
                        <OvertimeBreakdownCell row={r} />
                      </td>
                      <td
                        {...cpRate.domProps}
                        className={`px-2.5 py-1.5 text-right tabular-nums ${r.isPresupuesto ? 'text-purple-300/75' : ''} ${cpRate.className}`}
                        title={r.isPresupuesto ? 'Modalidad Presupuesto: no imputa tarifa horaria; el costo ingresa por Terceros' : undefined}
                      >
                        {formatUsd(r.isPresupuesto ? 0 : r.hourlyRateUsd)}
                      </td>
                      <td
                        {...cpCost.domProps}
                        className={`px-2.5 py-1.5 text-right tabular-nums font-bold ${
                          r.isPresupuesto ? 'text-purple-300/80' : 'text-emerald-300'
                        } ${cpCost.className}`}
                      >
                        {formatUsd(r.isPresupuesto ? 0 : r.costUsd)}
                      </td>
                      <td {...cpNotes.domProps} className={`px-2.5 py-1.5 text-slate-400 truncate max-w-[180px] ${cpNotes.className}`} title={r.notes}>
                        {r.notes ? <HighlightText text={r.notes} query={searchQuery} /> : '—'}
                      </td>
                    </tr>
                  )
                })}
                <CanonicalProgressiveTableFooter
                  visibleCount={visibleCount} totalCount={filteredRows.length} hasMore={hasMore}
                  remainingCount={remainingCount} loadMore={loadMore} showAll={showAll}
                  sentinelRef={sentinelRef} colSpan={11} entityLabel="partes"
                />
                </>
              )}
            </tbody>
          </table>
        </div>

        <GridStatusBarBottom
          isFixed={false}
          filteredCount={filteredRows.length}
          totalCount={scopedBaseRows.length}
          entityName="partes"
          hasActiveFilter={hasFilters}
          onClearFilters={handleClearFilters}
          selectionStats={sheetSelection.selectionStats}
          onClearSelection={sheetSelection.clearSelection}
          globalAggregates={[
            { label: 'TOTAL HORAS US$', value: formatUsd(summaryStats.totalUsd), highlight: true },
            { label: 'HORAS FÍSICAS', value: `${summaryStats.hoursPhysical.toFixed(1)} hs` },
            ...(summaryStats.presupuestoHours > 0
              ? [{ label: 'HS PRESUP. ($0)', value: `${summaryStats.presupuestoHours.toFixed(1)} hs` }]
              : []),
            { label: 'HORAS EXTRA (CONV.)', value: `${summaryStats.hoursExtraEquiv.toFixed(1)} hs` }
          ]}
        />
      </div>
    </div>
  )
}
