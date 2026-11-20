import React, { useMemo, useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useModuleFilterMemory, resolveInitialModuleFilters } from '../../hooks/useModuleFilterMemory'
import KpiRadar from '../KpiRadar'
import CrawlerSearchBar from '../CrawlerSearchBar'
import GridStatusBarBottom from '../GridStatusBarBottom'
import { formatUsd } from '../../lib/drydockCatalogConstants'
import { CLEAR_FILTER_BTN_CLASS, getFilterSelectClass } from '../../lib/filterThemeConstants'
import {
  scopeResumenRows,
  extractUniqueSortedOptions,
  computeHorasKpis,
  filterResumenLaborRows
} from '../../lib/resumenHojaFilters'
import { CostSheetHeaderBar, ReadOnlyGridRibbon } from './CostSheetChrome'
import CanonicalOtBadge from '../canonical/CanonicalOtBadge'

/**
 * Hoja Solo Lectura: HORAS (HORAS GENERALES / HORAS POR O.T).
 * Visibiliza valorización horaria, DEC-013 (Presupuestos = $0) y alertas "R"/"RR".
 */
export default function ResumenHojaHorasPanel({
  ship,
  otRows = [],
  activeOtId,
  costScope = 'GENERAL',
  initialKpiFilter = 'ALL',
  laborRows = [],
  onSelectSheet,
  onChangeCostScope,
  onSelectOt,
  onBackToSummary
}) {
  const { user, profile } = useAuth()
  const initialFilters = useMemo(
    () => resolveInitialModuleFilters(user, profile, 'resumen_horas', initialKpiFilter && initialKpiFilter !== 'ALL' ? { kpiFilter: initialKpiFilter } : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const [searchQuery, setSearchQuery] = useState(initialFilters.searchQuery)
  const [kpiFilter, setKpiFilter] = useState(initialFilters.kpiFilter)
  const [otFilter, setOtFilter] = useState(initialFilters.otFilter)
  const [workerFilter, setWorkerFilter] = useState(initialFilters.workerFilter)
  const [rubroFilter, setRubroFilter] = useState(initialFilters.rubroFilter)

  useEffect(() => {
    if (initialKpiFilter && initialKpiFilter !== 'ALL') {
      setKpiFilter(initialKpiFilter)
    }
  }, [initialKpiFilter])

  const shipId = ship?.id || null
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
  const summaryStats = useMemo(
    () => filteredRows.reduce((acc, r) => ({
      hoursPhysical: acc.hoursPhysical + (r.hoursPhysical || 0),
      hoursEquiv: acc.hoursEquiv + (r.hoursEquiv || 0),
      totalUsd: acc.totalUsd + (r.costUsd || 0)
    }), { hoursPhysical: 0, hoursEquiv: 0, totalUsd: 0 }),
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
        onSelectOt={onSelectOt}
        onBackToSummary={onBackToSummary}
      />

      <div className="alon-zone-kpis p-3 bg-slate-900/70">
        <KpiRadar
          title="⏱️ RADAR DE MANO DE OBRA, RECARGOS Y DEC-013 (SOLO LECTURA)"
          subtitle="Clic en cualquier tarjeta para aislar estado o modalidad"
          cards={kpiCards}
          activeFilterId={kpiFilter === 'ALL' ? null : kpiFilter}
          onCardClick={(id) => setKpiFilter((prev) => (prev === id ? 'ALL' : id))}
        />
      </div>

      <div className="alon-zone-toolbar p-3 bg-slate-900/70 flex flex-wrap items-center gap-2">
        <CrawlerSearchBar
          compact
          value={searchQuery}
          onChange={setSearchQuery}
          onClear={() => setSearchQuery('')}
          viewsController={viewsController}
          placeholder="Buscar operario, contratista, oficio, OT, PRC o notas... (Ctrl+F)"
        />

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

        {hasFilters && (
          <button
            type="button"
            onClick={handleClearFilters}
            className={CLEAR_FILTER_BTN_CLASS}
            title="Limpiar todos los filtros"
          >
            <X className="w-3.5 h-3.5" />
            <span>Limpiar filtro</span>
          </button>
        )}
      </div>

      <div className="alon-zone-grid overflow-hidden bg-slate-900/75">
        <ReadOnlyGridRibbon
          badgeText={`👁️ HORAS · ${costScope === 'OT' ? 'POR O.T' : 'GENERAL'} (SOLO LECTURA)`}
          hintText="Vista de consulta protegida · Valorizada por tarifario quincenal (Astillero c/ recargos, Presupuestos $0)."
          totalRows={filteredRows.length}
          entityName="partes"
          exportRows={filteredRows}
          exportFilename={`gs004_horas_${ship?.name || 'buque'}.csv`}
          exportColumns={[
            { key: 'date', label: 'Fecha' },
            { key: 'otLabel', label: 'O.T' },
            { key: 'workerName', label: 'Operario' },
            { key: 'workerType', label: 'Centro' },
            { key: 'rubro', label: 'Oficio' },
            { key: 'workType', label: 'Modalidad' },
            { key: 'hoursPhysical', label: 'Hs Físicas' },
            { key: 'hoursEquiv', label: 'Hs Equiv' },
            { key: 'hourlyRateUsd', label: 'Tarifa US$/h' },
            { key: 'costUsd', label: 'Costo US$' },
            { key: 'approvalStatus', label: 'Estado' },
            { key: 'notes', label: 'Notas' }
          ]}
        />

        <div className="overflow-x-auto max-h-[54vh]">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="alon-grid-thead sticky top-0 z-10 text-[10px] uppercase tracking-wider text-slate-300">
              <tr>
                <th className="px-2.5 py-2 w-10 text-center">#</th>
                <th className="px-2.5 py-2">Fecha</th>
                <th className="px-2.5 py-2">O.T</th>
                <th className="px-2.5 py-2">Operario / Contratista</th>
                <th className="px-2.5 py-2">Centro</th>
                <th className="px-2.5 py-2">Oficio / Rubro</th>
                <th className="px-2.5 py-2">Modalidad</th>
                <th className="px-2.5 py-2 text-right">Hs Fís.</th>
                <th className="px-2.5 py-2 text-right">Hs Equiv.</th>
                <th className="px-2.5 py-2 text-right">Tarifa US$</th>
                <th className="px-2.5 py-2">Fuente</th>
                <th className="px-2.5 py-2 text-right">Costo US$</th>
                <th className="px-2.5 py-2">Estado</th>
                <th className="px-2.5 py-2">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-4 py-8 text-center text-slate-500">
                    No hay partes horarios registrados para los filtros actuales.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-slate-800/45 text-slate-200 transition-colors">
                    <td className="px-2.5 py-1.5 text-center font-mono text-slate-500">{idx + 1}</td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap font-mono">{r.date || '—'}</td>
                    <td className="px-2.5 py-1.5 max-w-[205px]">
                      <CanonicalOtBadge wo={otRowMap.get(r.workOrderId)?.wo || null} ship={ship} otNumber={r.otNumber} otTitle={r.otTitle} tooltipOverride={otRowMap.get(r.workOrderId)?.canonicalTooltip || ''} variant="compact" className="font-mono text-cyan-300 font-semibold" />
                    </td>
                    <td className="px-2.5 py-1.5 font-medium text-white truncate max-w-[180px]">
                      {r.workerName}
                    </td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          r.workerType === 'Contratista'
                            ? 'bg-violet-500/20 text-violet-300'
                            : 'bg-sky-500/15 text-sky-300'
                        }`}
                      >
                        {r.workerType}
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5 text-slate-400">{r.rubro}</td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">
                      {r.isPresupuesto ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-200">
                          PRESUP. $0
                        </span>
                      ) : (
                        <span className="text-slate-300">{r.workType}</span>
                      )}
                    </td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums">{r.hoursPhysical}</td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums text-cyan-200">{r.hoursEquiv}</td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums">{formatUsd(r.hourlyRateUsd)}</td>
                    <td className="px-2.5 py-1.5 text-[10px] font-mono text-slate-400">{r.rateSource}</td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums font-bold text-emerald-300">
                      {formatUsd(r.costUsd)}
                    </td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          r.isPendingR
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-emerald-500/15 text-emerald-300'
                        }`}
                      >
                        {r.approvalStatus}
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5 text-slate-400 truncate max-w-[180px]" title={r.notes}>
                      {r.notes || '—'}
                    </td>
                  </tr>
                ))
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
          globalAggregates={[
            { label: 'TOTAL HORAS US$', value: formatUsd(summaryStats.totalUsd), highlight: true },
            { label: 'HORAS FÍSICAS', value: `${summaryStats.hoursPhysical.toFixed(1)} hs` },
            { label: 'HORAS EQUIVALENTES', value: `${summaryStats.hoursEquiv.toFixed(1)} hs` }
          ]}
        />
      </div>
    </div>
  )
}
