import React, { useMemo, useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useModuleFilterMemory, resolveInitialModuleFilters } from '../../hooks/useModuleFilterMemory'
import { useReadOnlySheetSelection } from '../../hooks/grid/useReadOnlySheetSelection'
import { useProgressiveRows } from '../../hooks/useProgressiveRows'
import KpiRadar from '../KpiRadar'
import GridStatusBarBottom from '../GridStatusBarBottom'
import CanonicalProgressiveTableFooter from '../canonical/CanonicalProgressiveTableFooter'
import HighlightText from '../HighlightText'
import { formatUsd, formatKg } from '../../lib/drydockCatalogConstants'
import { formatDateAr, formatDayMonthAr } from '../../lib/dateTimeCanonical'
import {
  scopeResumenRows,
  extractUniqueSortedOptions,
  computeMaterialesKpis,
  filterResumenMaterialRows,
  buildCleanSheetShortcutFilters
} from '../../lib/resumenHojaFilters'
import { CostSheetHeaderBar, ReadOnlyGridRibbon } from './CostSheetChrome'
import ResumenHojaMaterialesToolbar from './ResumenHojaMaterialesToolbar'
import { exportPlateCutsReport } from '../../lib/plateCutsExport'
import { formatFormulaNumericDisplay } from '../../lib/formulaEngine'
import { matchesMaterialQuickType } from '../../lib/filterThemeConstants'
import { Scissors } from 'lucide-react'
import CanonicalOtBadge from '../canonical/CanonicalOtBadge'

const MATERIALES_SELECTION_COLUMNS = [
  { key: 'date', label: 'Fecha', isNumeric: false, getValue: (r) => formatDateAr(r.date, { fallback: '' }) },
  { key: 'sourceLabel', label: 'Origen', isNumeric: false, getValue: (r) => (r.sourceType === 'COMPRA_DIRECTA' ? 'OC DIRECTA' : 'PAÑOL') },
  { key: 'otLabel', label: 'O.T', isNumeric: false, getValue: (r) => r.otLabel || r.otNumber || '' },
  { key: 'workerName', label: 'Solicitante', isNumeric: false, getValue: (r) => r.workerName || '' },
  { key: 'materialName', label: 'Material / Insumo', isNumeric: false, getValue: (r) => r.materialName || '' },
  { key: 'qty', label: 'Cant.', isNumeric: true, formatType: 'number', getValue: (r) => Number(r.qty) || 0 },
  { key: 'weightKg', label: 'KG', isNumeric: true, formatType: 'kg', getValue: (r) => (Number(r.weightKg) > 0 ? Number(r.weightKg) : null) },
  { key: 'unitUsd', label: 'P.Unit US$', isNumeric: true, formatType: 'usd', getValue: (r) => Number(r.unitUsd) || 0 },
  { key: 'shipDirectUsd', label: 'Total Obra US$', isNumeric: true, formatType: 'usd', getValue: (r) => Number(r.shipDirectUsd) || 0 },
  { key: 'notes', label: 'Comp. / Notas', isNumeric: false, getValue: (r) => r.voucherNumber || r.notes || '' }
]

/**
 * Hoja Solo Lectura: MATERIALES (MATERIALES GENERAL / MATERIALES POR O.T).
 * Estructura Zona 2 + Zona 3 + Zona 4 + Zona 5 para visualización sin edición.
 */
export default function ResumenHojaMaterialesPanel({
  ship,
  otRows = [],
  activeOtId,
  costScope = 'GENERAL',
  launchIntent = null,
  initialKpiFilter = 'ALL',
  materialRows = [],
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
      return buildCleanSheetShortcutFilters('resumen_materiales', launchIntent?.kpi || 'ALL')
    }
    return resolveInitialModuleFilters(
      user,
      profile,
      'resumen_materiales',
      effectiveShortcutKpi ? { kpiFilter: effectiveShortcutKpi } : {}
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [searchQuery, setSearchQuery] = useState(initialFilters.searchQuery)
  const [kpiFilter, setKpiFilter] = useState(initialFilters.kpiFilter)
  const [otFilter, setOtFilter] = useState(initialFilters.otFilter)
  const [contractorFilter, setContractorFilter] = useState(initialFilters.contractorFilter)
  const [showMateriales, setShowMateriales] = useState(initialFilters.showMateriales !== false)
  const [showConsumibles, setShowConsumibles] = useState(initialFilters.showConsumibles !== false)
  const [materialQuick, setMaterialQuick] = useState(initialFilters.materialQuick)
  const [onlyKgPositive, setOnlyKgPositive] = useState(Boolean(initialFilters.onlyKgPositive))

  const lastHandledLaunchSeqRef = useRef(launchIntent?.seq || 0)
  useEffect(() => {
    if (launchIntent?.mode === 'SUMMARY_SHORTCUT' && launchIntent?.seq && launchIntent.seq !== lastHandledLaunchSeqRef.current) {
      lastHandledLaunchSeqRef.current = launchIntent.seq
      const clean = buildCleanSheetShortcutFilters('resumen_materiales', launchIntent.kpi || 'ALL')
      setSearchQuery(clean.searchQuery)
      setKpiFilter(clean.kpiFilter)
      setOtFilter(clean.otFilter)
      setContractorFilter(clean.contractorFilter)
      setShowMateriales(clean.showMateriales !== false)
      setShowConsumibles(clean.showConsumibles !== false)
      setMaterialQuick(clean.materialQuick)
      setOnlyKgPositive(Boolean(clean.onlyKgPositive))
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
    () => scopeResumenRows(materialRows, { shipId, costScope, activeOtId }),
    [materialRows, shipId, costScope, activeOtId]
  )
  const contractorOptions = useMemo(
    () => extractUniqueSortedOptions(scopedBaseRows, (r) => r.contractorLabel || r.workerName),
    [scopedBaseRows]
  )
  const kpiCards = useMemo(() => computeMaterialesKpis(scopedBaseRows), [scopedBaseRows])
  const filteredRows = useMemo(
    () => filterResumenMaterialRows(scopedBaseRows, {
      kpiFilter, costScope, otFilter, contractorFilter, showMateriales, showConsumibles, materialQuick, onlyKgPositive, searchQuery
    }),
    [scopedBaseRows, kpiFilter, costScope, otFilter, contractorFilter, showMateriales, showConsumibles, materialQuick, onlyKgPositive, searchQuery]
  )
  const sheetSelection = useReadOnlySheetSelection({ rows: filteredRows, columns: MATERIALES_SELECTION_COLUMNS, getRowId: (r) => r.id })
  const { visibleItems: visibleRows, visibleCount, hasMore, remainingCount, loadMore, showAll, sentinelRef } = useProgressiveRows({
    items: filteredRows,
    activeIndex: sheetSelection.activeCell?.rowIndex ?? -1,
    scrollContainerRef: sheetSelection.containerRef,
    resetKey: `${shipId}|${costScope}|${activeOtId || ''}|${kpiFilter}|${otFilter}|${contractorFilter}|${showMateriales}|${showConsumibles}|${materialQuick}|${onlyKgPositive}|${searchQuery}`
  })
  const summaryStats = useMemo(
    () => filteredRows.reduce((acc, r) => ({
      directUsd: acc.directUsd + (r.shipDirectUsd || 0),
      refUsd: acc.refUsd + (r.referenceUsd || 0),
      weightKg: acc.weightKg + (r.weightKg || 0)
    }), { directUsd: 0, refUsd: 0, weightKg: 0 }),
    [filteredRows]
  )

  const hasFilters = Boolean(
    searchQuery ||
    kpiFilter !== 'ALL' ||
    (costScope === 'GENERAL' && otFilter !== 'ALL') ||
    contractorFilter !== 'ALL' ||
    !showMateriales ||
    !showConsumibles ||
    Boolean(materialQuick) ||
    onlyKgPositive
  )

  const handleClearFilters = () => {
    setSearchQuery('')
    setKpiFilter('ALL')
    setOtFilter('ALL')
    setContractorFilter('ALL')
    setShowMateriales(true)
    setShowConsumibles(true)
    setMaterialQuick('')
    setOnlyKgPositive(false)
  }

  const viewsController = useModuleFilterMemory({
    moduleKey: 'resumen_materiales',
    currentFilters: { searchQuery, kpiFilter, otFilter, contractorFilter, showMateriales, showConsumibles, materialQuick, onlyKgPositive },
    setters: { searchQuery: setSearchQuery, kpiFilter: setKpiFilter, otFilter: setOtFilter, contractorFilter: setContractorFilter, showMateriales: setShowMateriales, showConsumibles: setShowConsumibles, materialQuick: setMaterialQuick, onlyKgPositive: setOnlyKgPositive },
    summaryContext: { otRows },
    hasActiveFilters: hasFilters
  })

  return (
    <div className="space-y-3">
      <CostSheetHeaderBar
        activeSheet="materiales"
        costScope={costScope}
        shipName={ship?.name || 'Buque'}
        otRows={otRows}
        activeOtId={activeOtId}
        onSelectSheet={onSelectSheet}
        onChangeCostScope={onChangeCostScope}
        onBackToSummary={onBackToSummary}
      />

      {/* ZONA 2: RADAR DE KPIS */}
      <div className="alon-zone-kpis p-3 bg-slate-900/70">
        <KpiRadar
          title="📊 RADAR DE MATERIALES, CONSUMIBLES Y EPP (SOLO LECTURA)"
          subtitle="Clic en cualquier tarjeta para acotar la planilla"
          cards={kpiCards}
          activeFilterId={kpiFilter === 'ALL' ? null : kpiFilter}
          onCardClick={(id) => setKpiFilter((prev) => (prev === id ? 'ALL' : id))}
        />
      </div>

      {/* ZONA 3: CRAWLER SEARCH COMPACTO + FILTROS RÁPIDOS + LIMPIAR EN ESQUINA */}
      <ResumenHojaMaterialesToolbar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        costScope={costScope}
        otFilter={otFilter}
        setOtFilter={setOtFilter}
        otRows={otRows}
        contractorFilter={contractorFilter}
        setContractorFilter={setContractorFilter}
        contractorOptions={contractorOptions}
        showMateriales={showMateriales}
        setShowMateriales={setShowMateriales}
        showConsumibles={showConsumibles}
        setShowConsumibles={setShowConsumibles}
        materialQuick={materialQuick}
        setMaterialQuick={setMaterialQuick}
        onlyKgPositive={onlyKgPositive}
        setOnlyKgPositive={setOnlyKgPositive}
        hasFilters={hasFilters}
        onClearFilters={handleClearFilters}
        viewsController={viewsController}
      />

      {/* ZONA 4: GRILLA CANÓNICA DE SOLO LECTURA */}
      <div className="alon-zone-grid overflow-hidden bg-slate-900/75">
        <ReadOnlyGridRibbon
          badgeText={`👁️ MATERIALES · ${costScope === 'OT' ? 'POR O.T' : 'GENERAL'} (SOLO LECTURA)`}
          hintText="Ordenado por O.T. · Arrastrá sobre cualquier columna para sumar valores o contar filas (Esc limpia)."
          totalRows={filteredRows.length}
          entityName="movimientos"
          exportRows={filteredRows}
          exportFilename={`gs004_materiales_${ship?.name || 'buque'}.csv`}
          extraActions={
            (materialQuick === 'CHAPA' || filteredRows.some((r) => r.cutDimensionsLabel || matchesMaterialQuickType(r, 'CHAPA'))) && (
              <button
                type="button"
                onClick={() => {
                  const targetRows =
                    materialQuick === 'CHAPA'
                      ? filteredRows
                      : filteredRows.filter((r) => r.cutDimensionsLabel || matchesMaterialQuickType(r, 'CHAPA'))
                  exportPlateCutsReport({ rows: targetRows, shipName: ship?.name || 'buque' })
                }}
                disabled={filteredRows.length === 0}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900/90 disabled:opacity-40 border border-cyan-500/60 text-cyan-200 hover:text-white font-bold text-xs cursor-pointer transition-colors"
                title="Exportar informe trazado de cortes y parches de chapa (Medidas, Área, Fecha Reporte/Carga y Ubicación) para cliente y Jefe de Obra"
              >
                <Scissors className="w-3.5 h-3.5 text-cyan-300" />
                Reporte Parches / Cortes (.csv)
              </button>
            )
          }
          exportColumns={[
            { key: 'date', label: 'Fecha Reporte', formatter: (v) => formatDateAr(v, { fallback: '' }) },
            { key: 'createdAt', label: 'Fecha Carga', formatter: (v) => formatDateAr(v, { fallback: '' }) },
            { key: 'sourceType', label: 'Origen' },
            { key: 'otLabel', label: 'O.T' },
            { key: 'workerName', label: 'Solicitante' },
            { key: 'materialName', label: 'Material' },
            { key: 'rubro', label: 'Rubro' },
            { key: 'category', label: 'Clasificación' },
            { key: 'cutDimensionsLabel', label: 'Corte / Medidas' },
            { key: 'qtyFormula', label: 'Fórmula' },
            { key: 'qty', label: 'Cant' },
            { key: 'unitMeasure', label: 'Unidad' },
            { key: 'weightKg', label: 'KG' },
            { key: 'unitUsd', label: 'P.Unit US$' },
            { key: 'shipDirectUsd', label: 'Total Obra US$' },
            { key: 'referenceUsd', label: 'Ref EPP US$' },
            { key: 'notes', label: 'Ubicación / Notas' }
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
                <th {...sheetSelection.getHeaderProps('sourceLabel', 'px-2.5 py-2')}>Origen</th>
                <th {...sheetSelection.getHeaderProps('otLabel', 'px-2.5 py-2')}>O.T</th>
                <th {...sheetSelection.getHeaderProps('workerName', 'px-2.5 py-2')}>Solicitante</th>
                <th {...sheetSelection.getHeaderProps('materialName', 'px-2.5 py-2')}>Material / Insumo</th>
                <th {...sheetSelection.getHeaderProps('qty', 'px-2.5 py-2 text-right')}>Cant.</th>
                <th {...sheetSelection.getHeaderProps('weightKg', 'px-2.5 py-2 text-right')}>KG</th>
                <th {...sheetSelection.getHeaderProps('unitUsd', 'px-2.5 py-2 text-right')}>P.Unit US$</th>
                <th {...sheetSelection.getHeaderProps('shipDirectUsd', 'px-2.5 py-2 text-right')}>Total Obra US$</th>
                <th {...sheetSelection.getHeaderProps('notes', 'px-2.5 py-2')}>Comp. / Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                    No se encontraron movimientos de materiales con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                <>
                {visibleRows.map((r, idx) => {
                  const cpDate = sheetSelection.getCellProps(idx, 'date')
                  const cpSource = sheetSelection.getCellProps(idx, 'sourceLabel')
                  const cpOt = sheetSelection.getCellProps(idx, 'otLabel')
                  const cpWorker = sheetSelection.getCellProps(idx, 'workerName')
                  const cpMaterial = sheetSelection.getCellProps(idx, 'materialName')
                  const cpQty = sheetSelection.getCellProps(idx, 'qty')
                  const cpKg = sheetSelection.getCellProps(idx, 'weightKg')
                  const cpUnit = sheetSelection.getCellProps(idx, 'unitUsd')
                  const cpTotal = sheetSelection.getCellProps(idx, 'shipDirectUsd')
                  const cpNotes = sheetSelection.getCellProps(idx, 'notes')
                  const notesText = r.voucherNumber || r.notes || ''

                  return (
                    <tr key={r.id} className="hover:bg-slate-800/45 text-slate-200 transition-colors">
                      <td className="px-2.5 py-1.5 text-center font-mono text-slate-500 select-none">{idx + 1}</td>
                      <td
                        {...cpDate.domProps}
                        className={`px-2.5 py-1.5 whitespace-nowrap font-mono text-slate-300 ${cpDate.className}`}
                        title={r.createdAt ? `Fecha reporte: ${formatDateAr(r.date)} · Fecha carga: ${formatDateAr(r.createdAt)}` : undefined}
                      >
                        <div>{formatDateAr(r.date)}</div>
                        {r.createdAt && r.date && r.createdAt !== r.date && (
                          <div className="text-[9.5px] text-slate-500">Carga: {formatDayMonthAr(r.createdAt)}</div>
                        )}
                      </td>
                      <td {...cpSource.domProps} className={`px-2.5 py-1.5 whitespace-nowrap ${cpSource.className}`}>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            r.sourceType === 'COMPRA_DIRECTA'
                              ? 'bg-violet-500/20 text-violet-300'
                              : 'bg-cyan-500/15 text-cyan-300'
                          }`}
                        >
                          {r.sourceType === 'COMPRA_DIRECTA' ? 'OC DIRECTA' : 'PAÑOL'}
                        </span>
                      </td>
                      <td {...cpOt.domProps} className={`px-2.5 py-1.5 max-w-[205px] ${cpOt.className}`}>
                        <CanonicalOtBadge wo={otRowMap.get(r.workOrderId)?.wo || null} ship={ship} otNumber={r.otNumber} otTitle={r.otTitle} searchQuery={searchQuery} tooltipOverride={otRowMap.get(r.workOrderId)?.canonicalTooltip || ''} variant="compact" className="font-mono text-cyan-300 font-semibold" />
                      </td>
                      <td {...cpWorker.domProps} className={`px-2.5 py-1.5 text-slate-300 truncate max-w-[145px] ${cpWorker.className}`} title={r.workerName}>
                        <HighlightText text={r.workerName} query={searchQuery} />
                      </td>
                      <td {...cpMaterial.domProps} className={`px-2.5 py-1.5 font-medium text-white max-w-[240px] truncate ${cpMaterial.className}`} title={r.materialName}>
                        <HighlightText text={r.materialName} query={searchQuery} />
                      </td>
                      <td
                        {...cpQty.domProps}
                        className={`px-2.5 py-1.5 text-right tabular-nums whitespace-nowrap ${cpQty.className}`}
                        title={r.qtyFormula ? `Fórmula cargada: ${r.qtyFormula}` : undefined}
                      >
                        <div>
                          {formatFormulaNumericDisplay(r.qty, { maxDecimals: 3 })}{' '}
                          <span className="text-slate-500">{r.unitMeasure}</span>
                        </div>
                        {r.cutDimensionsLabel && (
                          <div className="text-[10px] font-mono text-cyan-300 font-semibold">
                            {r.cutDimensionsLabel}
                          </div>
                        )}
                      </td>
                      <td {...cpKg.domProps} className={`px-2.5 py-1.5 text-right tabular-nums text-purple-200 ${cpKg.className}`}>
                        {r.weightKg > 0 ? formatKg(r.weightKg, 1) : '—'}
                      </td>
                      <td {...cpUnit.domProps} className={`px-2.5 py-1.5 text-right tabular-nums text-slate-300 ${cpUnit.className}`}>
                        {formatUsd(r.unitUsd)}
                      </td>
                      <td {...cpTotal.domProps} className={`px-2.5 py-1.5 text-right tabular-nums font-bold text-emerald-300 ${cpTotal.className}`}>
                        {formatUsd(r.shipDirectUsd)}
                      </td>
                      <td {...cpNotes.domProps} className={`px-2.5 py-1.5 text-slate-400 truncate max-w-[180px] ${cpNotes.className}`} title={r.notes}>
                        {notesText ? <HighlightText text={notesText} query={searchQuery} /> : '—'}
                      </td>
                    </tr>
                  )
                })}
                <CanonicalProgressiveTableFooter
                  visibleCount={visibleCount} totalCount={filteredRows.length} hasMore={hasMore}
                  remainingCount={remainingCount} loadMore={loadMore} showAll={showAll}
                  sentinelRef={sentinelRef} colSpan={11} entityLabel="movimientos"
                />
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* ZONA 5: BARRA DE TOTALES */}
        <GridStatusBarBottom
          isFixed={false}
          filteredCount={filteredRows.length}
          totalCount={scopedBaseRows.length}
          entityName="movimientos"
          hasActiveFilter={hasFilters}
          onClearFilters={handleClearFilters}
          selectionStats={sheetSelection.selectionStats}
          onClearSelection={sheetSelection.clearSelection}
          globalAggregates={[
            { label: 'TOTAL OBRA (Mat+Cons)', value: formatUsd(summaryStats.directUsd), highlight: true },
            { label: 'PESO ACUMULADO', value: formatKg(summaryStats.weightKg, 1) },
            { label: 'REF. EPP (NO SUMA)', value: formatUsd(summaryStats.refUsd) }
          ]}
        />
      </div>
    </div>
  )
}
