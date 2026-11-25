import React, { useMemo, useState, useEffect, useRef } from 'react'
import { HelpCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useModuleFilterMemory, resolveInitialModuleFilters } from '../../hooks/useModuleFilterMemory'
import { useReadOnlySheetSelection } from '../../hooks/grid/useReadOnlySheetSelection'
import { useProgressiveRows } from '../../hooks/useProgressiveRows'
import KpiRadar from '../KpiRadar'
import CanonicalZone3Toolbar from '../canonical/CanonicalZone3Toolbar'
import CanonicalProgressiveTableFooter from '../canonical/CanonicalProgressiveTableFooter'
import GridStatusBarBottom from '../GridStatusBarBottom'
import HighlightText from '../HighlightText'
import { formatUsd, formatArs } from '../../lib/drydockCatalogConstants'
import { formatDateAr } from '../../lib/dateTimeCanonical'
import { getFilterSelectClass } from '../../lib/filterThemeConstants'
import {
  scopeResumenRows,
  extractUniqueSortedOptions,
  computeTercerosKpis,
  filterResumenThirdPartyRows,
  buildCleanSheetShortcutFilters
} from '../../lib/resumenHojaFilters'
import { CostSheetHeaderBar, ReadOnlyGridRibbon } from './CostSheetChrome'
import CanonicalOtBadge from '../canonical/CanonicalOtBadge'

const TERCEROS_SELECTION_COLUMNS = [
  { key: 'date', label: 'Fecha', isNumeric: false, getValue: (r) => formatDateAr(r.date, { fallback: '' }) },
  { key: 'otLabel', label: 'O.T', isNumeric: false, getValue: (r) => r.otLabel || r.otNumber || '' },
  { key: 'contractorName', label: 'Contratista / Taller', isNumeric: false, getValue: (r) => r.contractorName || '' },
  { key: 'rubro', label: 'Rubro', isNumeric: false, getValue: (r) => r.rubro || '' },
  { key: 'amountArs', label: 'Importe ARS', isNumeric: true, formatType: 'ars', getValue: (r) => (Number(r.amountArs) > 0 ? Number(r.amountArs) : null) },
  { key: 'amountUsd', label: 'Total US$', isNumeric: true, formatType: 'usd', getValue: (r) => Number(r.amountUsd) || 0 },
  { key: 'observations', label: 'Observaciones', isNumeric: false, getValue: (r) => r.observations || '' },
  { key: 'usdRate', label: 'TC', isNumeric: false, getValue: (r) => (r.usdRate ? String(r.usdRate) : '') }
]

/**
 * Hoja Solo Lectura: TERCEROS (TERCEROS GENERAL / TERCEROS POR O.T).
 */
export default function ResumenHojaTercerosPanel({
  ship,
  otRows = [],
  activeOtId,
  costScope = 'GENERAL',
  launchIntent = null,
  initialKpiFilter = 'ALL',
  thirdPartyRows = [],
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
      return buildCleanSheetShortcutFilters('resumen_terceros', launchIntent?.kpi || 'ALL')
    }
    return resolveInitialModuleFilters(
      user,
      profile,
      'resumen_terceros',
      effectiveShortcutKpi ? { kpiFilter: effectiveShortcutKpi } : {}
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [searchQuery, setSearchQuery] = useState(initialFilters.searchQuery)
  const [kpiFilter, setKpiFilter] = useState(initialFilters.kpiFilter)
  const [otFilter, setOtFilter] = useState(initialFilters.otFilter)
  const [contractorFilter, setContractorFilter] = useState(initialFilters.contractorFilter)
  const [voucherFilter, setVoucherFilter] = useState(initialFilters.voucherFilter)

  const lastHandledLaunchSeqRef = useRef(launchIntent?.seq || 0)
  useEffect(() => {
    if (launchIntent?.mode === 'SUMMARY_SHORTCUT' && launchIntent?.seq && launchIntent.seq !== lastHandledLaunchSeqRef.current) {
      lastHandledLaunchSeqRef.current = launchIntent.seq
      const clean = buildCleanSheetShortcutFilters('resumen_terceros', launchIntent.kpi || 'ALL')
      setSearchQuery(clean.searchQuery)
      setKpiFilter(clean.kpiFilter)
      setOtFilter(clean.otFilter)
      setContractorFilter(clean.contractorFilter)
      setVoucherFilter(clean.voucherFilter)
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
    () => scopeResumenRows(thirdPartyRows, { shipId, costScope, activeOtId }),
    [thirdPartyRows, shipId, costScope, activeOtId]
  )
  const contractorOptions = useMemo(
    () => extractUniqueSortedOptions(scopedBaseRows, (r) => r.contractorName),
    [scopedBaseRows]
  )
  const voucherTypes = useMemo(
    () => extractUniqueSortedOptions(scopedBaseRows, (r) => r.voucherType),
    [scopedBaseRows]
  )
  const kpiCards = useMemo(() => computeTercerosKpis(scopedBaseRows), [scopedBaseRows])
  const filteredRows = useMemo(
    () => filterResumenThirdPartyRows(scopedBaseRows, { kpiFilter, costScope, otFilter, contractorFilter, voucherFilter, searchQuery }),
    [scopedBaseRows, kpiFilter, costScope, otFilter, contractorFilter, voucherFilter, searchQuery]
  )
  const sheetSelection = useReadOnlySheetSelection({ rows: filteredRows, columns: TERCEROS_SELECTION_COLUMNS, getRowId: (r) => r.id })
  const { visibleItems: visibleRows, visibleCount, hasMore, remainingCount, loadMore, showAll, sentinelRef } = useProgressiveRows({
    items: filteredRows,
    activeIndex: sheetSelection.activeCell?.rowIndex ?? -1,
    scrollContainerRef: sheetSelection.containerRef,
    resetKey: `${shipId}|${costScope}|${activeOtId || ''}|${kpiFilter}|${otFilter}|${contractorFilter}|${voucherFilter}|${searchQuery}`
  })
  const summaryStats = useMemo(
    () => filteredRows.reduce((acc, r) => ({
      totalUsd: acc.totalUsd + (r.amountUsd || 0),
      totalArs: acc.totalArs + (r.amountArs || 0)
    }), { totalUsd: 0, totalArs: 0 }),
    [filteredRows]
  )

  const hasFilters = Boolean(
    searchQuery ||
    kpiFilter !== 'ALL' ||
    (costScope === 'GENERAL' && otFilter !== 'ALL') ||
    contractorFilter !== 'ALL' ||
    voucherFilter !== 'ALL'
  )

  const handleClearFilters = () => {
    setSearchQuery('')
    setKpiFilter('ALL')
    setOtFilter('ALL')
    setContractorFilter('ALL')
    setVoucherFilter('ALL')
  }

  const viewsController = useModuleFilterMemory({
    moduleKey: 'resumen_terceros',
    currentFilters: { searchQuery, kpiFilter, otFilter, contractorFilter, voucherFilter },
    setters: { searchQuery: setSearchQuery, kpiFilter: setKpiFilter, otFilter: setOtFilter, contractorFilter: setContractorFilter, voucherFilter: setVoucherFilter },
    summaryContext: { otRows },
    hasActiveFilters: hasFilters
  })

  return (
    <div className="space-y-3">
      <CostSheetHeaderBar
        activeSheet="terceros"
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
          title="🔧 RADAR DE TERCEROS, SUBCONTRATOS Y TALLERES (SOLO LECTURA)"
          subtitle="Clic en cualquier tarjeta para ver el detalle"
          cards={kpiCards}
          activeFilterId={kpiFilter === 'ALL' ? null : kpiFilter}
          onCardClick={(id) => setKpiFilter((prev) => (prev === id ? 'ALL' : id))}
        />
      </div>

      <CanonicalZone3Toolbar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Buscar contratista, rubro, OT, comprobante o detalle... (Ctrl+F | Esc limpia todo)"
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
              value={contractorFilter}
              onChange={(e) => setContractorFilter(e.target.value)}
              className={getFilterSelectClass('contractor', contractorFilter !== 'ALL', 'max-w-[190px]')}
              title="Filtrar por Contratista"
            >
              <option value="ALL" className="bg-slate-900">Contratista: Todos</option>
              {contractorOptions.map((c) => (
                <option key={c} value={c} className="bg-slate-900">
                  {c}
                </option>
              ))}
            </select>

            <select
              value={voucherFilter}
              onChange={(e) => setVoucherFilter(e.target.value)}
              className={getFilterSelectClass('voucher', voucherFilter !== 'ALL')}
              title="Filtrar por Comprobante"
            >
              <option value="ALL" className="bg-slate-900">Comprobante: Todos</option>
              {voucherTypes.map((vt) => (
                <option key={vt} value={vt} className="bg-slate-900">
                  {vt}
                </option>
              ))}
            </select>
          </>
        }
      />

      <div className="alon-zone-grid overflow-hidden bg-slate-900/75">
        <ReadOnlyGridRibbon
          badgeText={`👁️ TERCEROS · ${costScope === 'OT' ? 'POR O.T' : 'GENERAL'} (SOLO LECTURA)`}
          hintText="Ordenado por O.T. · Arrastrá sobre Importe ARS o Total US$ para sumar, o sobre texto para contar."
          totalRows={filteredRows.length}
          entityName="comprobantes"
          exportRows={filteredRows}
          exportFilename={`gs004_terceros_${ship?.name || 'buque'}.csv`}
          exportColumns={[
            { key: 'date', label: 'Fecha', formatter: (v) => formatDateAr(v, { fallback: '' }) },
            { key: 'otLabel', label: 'O.T' },
            { key: 'contractorName', label: 'Contratista' },
            { key: 'rubro', label: 'Rubro' },
            { key: 'voucherType', label: 'Comprobante' },
            { key: 'voucherNumber', label: 'Nro Comp.' },
            { key: 'amountArs', label: 'Importe ARS' },
            { key: 'amountUsd', label: 'Total US$' },
            { key: 'observations', label: 'Observaciones' },
            { key: 'usdRate', label: 'TC (Tipo de Cambio)' }
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
                <th className="px-2.5 py-2">Fecha</th>
                <th className="px-2.5 py-2">O.T</th>
                <th className="px-2.5 py-2">Contratista / Taller</th>
                <th className="px-2.5 py-2">Rubro</th>
                <th className="px-2.5 py-2 text-right">Importe ARS</th>
                <th className="px-2.5 py-2 text-right">Total US$</th>
                <th className="px-2.5 py-2">Observaciones</th>
                <th
                  className="px-2.5 py-2 text-right"
                  title="Tipo de cambio aplicado (cotización AR$ / US$ utilizada para convertir el importe a dólares)"
                >
                  <span className="inline-flex items-center justify-end gap-1 cursor-help">
                    <span>TC</span>
                    <HelpCircle className="w-3 h-3 text-cyan-400" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    No hay comprobantes de terceros para los filtros actuales.
                  </td>
                </tr>
              ) : (
                <>
                {visibleRows.map((r, idx) => {
                  const cpDate = sheetSelection.getCellProps(idx, 'date')
                  const cpOt = sheetSelection.getCellProps(idx, 'otLabel')
                  const cpContractor = sheetSelection.getCellProps(idx, 'contractorName')
                  const cpRubro = sheetSelection.getCellProps(idx, 'rubro')
                  const cpArs = sheetSelection.getCellProps(idx, 'amountArs')
                  const cpUsd = sheetSelection.getCellProps(idx, 'amountUsd')
                  const cpObs = sheetSelection.getCellProps(idx, 'observations')
                  const cpTc = sheetSelection.getCellProps(idx, 'usdRate')

                  return (
                    <tr key={r.id} className="hover:bg-slate-800/45 text-slate-200 transition-colors">
                      <td className="px-2.5 py-1.5 text-center font-mono text-slate-500 select-none">{idx + 1}</td>
                      <td {...cpDate.domProps} className={`px-2.5 py-1.5 whitespace-nowrap font-mono ${cpDate.className}`}>
                        {formatDateAr(r.date)}
                      </td>
                      <td {...cpOt.domProps} className={`px-2.5 py-1.5 max-w-[205px] ${cpOt.className}`}>
                        <CanonicalOtBadge wo={otRowMap.get(r.workOrderId)?.wo || null} ship={ship} otNumber={r.otNumber} otTitle={r.otTitle} searchQuery={searchQuery} tooltipOverride={otRowMap.get(r.workOrderId)?.canonicalTooltip || ''} variant="compact" className="font-mono text-cyan-300 font-semibold" />
                      </td>
                      <td {...cpContractor.domProps} className={`px-2.5 py-1.5 font-medium text-white truncate max-w-[190px] ${cpContractor.className}`} title={r.contractorName}>
                        <HighlightText text={r.contractorName} query={searchQuery} />
                      </td>
                      <td {...cpRubro.domProps} className={`px-2.5 py-1.5 text-slate-400 ${cpRubro.className}`}>
                        <HighlightText text={r.rubro} query={searchQuery} />
                      </td>
                      <td {...cpArs.domProps} className={`px-2.5 py-1.5 text-right tabular-nums text-slate-300 ${cpArs.className}`}>
                        {r.amountArs > 0 ? formatArs(r.amountArs, 0) : '—'}
                      </td>
                      <td {...cpUsd.domProps} className={`px-2.5 py-1.5 text-right tabular-nums font-bold text-emerald-300 ${cpUsd.className}`}>
                        {formatUsd(r.amountUsd)}
                      </td>
                      <td {...cpObs.domProps} className={`px-2.5 py-1.5 text-slate-400 truncate max-w-[200px] ${cpObs.className}`} title={r.observations}>
                        {r.observations ? <HighlightText text={r.observations} query={searchQuery} /> : '—'}
                      </td>
                      <td
                        {...cpTc.domProps}
                        className={`px-2.5 py-1.5 text-right tabular-nums text-slate-400 ${cpTc.className}`}
                        title={r.usdRate ? `Tipo de cambio aplicado: $${Number(r.usdRate).toLocaleString('es-AR')} ARS por US$` : 'Tipo de cambio'}
                      >
                        {r.usdRate}
                      </td>
                    </tr>
                  )
                })}
                <CanonicalProgressiveTableFooter
                  visibleCount={visibleCount} totalCount={filteredRows.length} hasMore={hasMore}
                  remainingCount={remainingCount} loadMore={loadMore} showAll={showAll}
                  sentinelRef={sentinelRef} colSpan={9} entityLabel="comprobantes"
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
          entityName="comprobantes"
          hasActiveFilter={hasFilters}
          onClearFilters={handleClearFilters}
          selectionStats={sheetSelection.selectionStats}
          onClearSelection={sheetSelection.clearSelection}
          globalAggregates={[
            { label: 'TOTAL TERCEROS US$', value: formatUsd(summaryStats.totalUsd), highlight: true },
            { label: 'ACUMULADO ARS', value: formatArs(summaryStats.totalArs, 0) }
          ]}
        />
      </div>
    </div>
  )
}
