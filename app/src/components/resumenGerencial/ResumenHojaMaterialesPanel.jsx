import React, { useMemo, useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useModuleFilterMemory, resolveInitialModuleFilters } from '../../hooks/useModuleFilterMemory'
import KpiRadar from '../KpiRadar'
import GridStatusBarBottom from '../GridStatusBarBottom'
import { formatUsd, formatKg } from '../../lib/drydockCatalogConstants'
import {
  scopeResumenRows,
  extractUniqueSortedOptions,
  computeMaterialesKpis,
  filterResumenMaterialRows
} from '../../lib/resumenHojaFilters'
import { CostSheetHeaderBar, ReadOnlyGridRibbon } from './CostSheetChrome'
import ResumenHojaMaterialesToolbar from './ResumenHojaMaterialesToolbar'

/**
 * Hoja Solo Lectura: MATERIALES (MATERIALES GENERAL / MATERIALES POR O.T).
 * Estructura Zona 2 + Zona 3 + Zona 4 + Zona 5 para visualización sin edición.
 */
export default function ResumenHojaMaterialesPanel({
  ship,
  otRows = [],
  activeOtId,
  costScope = 'GENERAL',
  initialKpiFilter = 'ALL',
  materialRows = [],
  onSelectSheet,
  onChangeCostScope,
  onSelectOt,
  onBackToSummary
}) {
  const { user, profile } = useAuth()
  const initialFilters = useMemo(
    () => resolveInitialModuleFilters(user, profile, 'resumen_materiales', initialKpiFilter && initialKpiFilter !== 'ALL' ? { kpiFilter: initialKpiFilter } : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const [searchQuery, setSearchQuery] = useState(initialFilters.searchQuery)
  const [kpiFilter, setKpiFilter] = useState(initialFilters.kpiFilter)
  const [otFilter, setOtFilter] = useState(initialFilters.otFilter)
  const [contractorFilter, setContractorFilter] = useState(initialFilters.contractorFilter)
  const [showMateriales, setShowMateriales] = useState(initialFilters.showMateriales !== false)
  const [showConsumibles, setShowConsumibles] = useState(initialFilters.showConsumibles !== false)
  const [materialQuick, setMaterialQuick] = useState(initialFilters.materialQuick)
  const [onlyKgPositive, setOnlyKgPositive] = useState(Boolean(initialFilters.onlyKgPositive))

  useEffect(() => {
    if (initialKpiFilter && initialKpiFilter !== 'ALL') {
      setKpiFilter(initialKpiFilter)
    }
  }, [initialKpiFilter])

  const shipId = ship?.id || null
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
        onSelectOt={onSelectOt}
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
          hintText="Vista de consulta protegida · Para corregir precios o asignaciones utilizá Pañol o Compras."
          totalRows={filteredRows.length}
          entityName="movimientos"
          exportRows={filteredRows}
          exportFilename={`gs004_materiales_${ship?.name || 'buque'}.csv`}
          exportColumns={[
            { key: 'date', label: 'Fecha' },
            { key: 'sourceType', label: 'Origen' },
            { key: 'otLabel', label: 'O.T' },
            { key: 'materialName', label: 'Material' },
            { key: 'rubro', label: 'Rubro' },
            { key: 'category', label: 'Clasificación' },
            { key: 'qty', label: 'Cant' },
            { key: 'unitMeasure', label: 'Unidad' },
            { key: 'weightKg', label: 'KG' },
            { key: 'unitUsd', label: 'P.Unit US$' },
            { key: 'shipDirectUsd', label: 'Total Obra US$' },
            { key: 'referenceUsd', label: 'Ref EPP US$' },
            { key: 'workerName', label: 'Solicitante' }
          ]}
        />

        <div className="overflow-x-auto max-h-[54vh]">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="alon-grid-thead sticky top-0 z-10 text-[10px] uppercase tracking-wider text-slate-300">
              <tr>
                <th className="px-2.5 py-2 w-10 text-center">#</th>
                <th className="px-2.5 py-2">Fecha</th>
                <th className="px-2.5 py-2">Origen</th>
                <th className="px-2.5 py-2">O.T</th>
                <th className="px-2.5 py-2">Material / Insumo</th>
                <th className="px-2.5 py-2">Rubro</th>
                <th className="px-2.5 py-2">Clasificación</th>
                <th className="px-2.5 py-2 text-right">Cant.</th>
                <th className="px-2.5 py-2 text-right">KG</th>
                <th className="px-2.5 py-2 text-right">P.Unit US$</th>
                <th className="px-2.5 py-2 text-right">Total Obra US$</th>
                <th className="px-2.5 py-2 text-right">Ref. EPP*</th>
                <th className="px-2.5 py-2">Solicitante</th>
                <th className="px-2.5 py-2">Comp. / Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-4 py-8 text-center text-slate-500">
                    No se encontraron movimientos de materiales con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-slate-800/45 text-slate-200 transition-colors">
                    <td className="px-2.5 py-1.5 text-center font-mono text-slate-500">{idx + 1}</td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap font-mono text-slate-300">{r.date || '—'}</td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">
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
                    <td className="px-2.5 py-1.5 font-mono text-cyan-300 font-semibold max-w-[200px] truncate" title={r.otLabel || r.otNumber}>
                      {r.otLabel || (r.otTitle ? `${r.otNumber} · ${r.otTitle}` : r.otNumber)}
                    </td>
                    <td className="px-2.5 py-1.5 font-medium text-white max-w-[220px] truncate" title={r.materialName}>
                      {r.materialName}
                    </td>
                    <td className="px-2.5 py-1.5 text-slate-400">{r.rubro}</td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          r.isSafetyReference
                            ? 'bg-amber-500/20 text-amber-300'
                            : r.category === 'CONSUMIBLES'
                              ? 'bg-sky-500/20 text-sky-300'
                              : 'bg-emerald-500/15 text-emerald-300'
                        }`}
                      >
                        {r.isSafetyReference ? 'EPP (REF)' : r.category}
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums whitespace-nowrap">
                      {r.qty} <span className="text-slate-500">{r.unitMeasure}</span>
                    </td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums text-purple-200">
                      {r.weightKg > 0 ? formatKg(r.weightKg, 1) : '—'}
                    </td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums text-slate-300">
                      {formatUsd(r.unitUsd)}
                    </td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums font-bold text-emerald-300">
                      {formatUsd(r.shipDirectUsd)}
                    </td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums text-amber-300 italic">
                      {r.referenceUsd > 0 ? formatUsd(r.referenceUsd) : '—'}
                    </td>
                    <td className="px-2.5 py-1.5 text-slate-300 truncate max-w-[140px]">{r.workerName}</td>
                    <td className="px-2.5 py-1.5 text-slate-400 truncate max-w-[180px]" title={r.notes}>
                      {r.voucherNumber || r.notes || '—'}
                    </td>
                  </tr>
                ))
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
