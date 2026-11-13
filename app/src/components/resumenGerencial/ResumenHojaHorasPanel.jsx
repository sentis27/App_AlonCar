import React, { useMemo, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import KpiRadar from '../KpiRadar'
import CrawlerSearchBar from '../CrawlerSearchBar'
import GridStatusBarBottom from '../GridStatusBarBottom'
import { matchesUniversalSearch } from '../../lib/searchEngine'
import { formatUsd } from '../../lib/drydockCatalogConstants'
import { CostSheetHeaderBar, ReadOnlyGridRibbon } from './CostSheetChrome'

/**
 * Hoja Solo Lectura: HORAS (HORAS GENERALES / HORAS POR O.T).
 * Visibiliza valorización horaria, DEC-013 (Presupuestos = $0) y alertas "R"/"RR".
 */
export default function ResumenHojaHorasPanel({
  ship,
  otRows = [],
  activeOtId,
  costScope = 'GENERAL',
  laborRows = [],
  onSelectSheet,
  onChangeCostScope,
  onSelectOt,
  onBackToSummary
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [kpiFilter, setKpiFilter] = useState('ALL')
  const [workerTypeFilter, setWorkerTypeFilter] = useState('ALL')

  const scopedBaseRows = useMemo(() => {
    return laborRows.filter((r) => {
      if (ship?.id && r.shipId !== ship.id) return false
      if (costScope === 'OT' && activeOtId) {
        if (activeOtId === 'SIN_OT') return !r.workOrderId
        return r.workOrderId === activeOtId
      }
      return true
    })
  }, [laborRows, ship?.id, costScope, activeOtId])

  const kpiCards = useMemo(() => {
    const approved = scopedBaseRows.filter((r) => !r.isPendingR && !r.isPresupuesto)
    const pendingR = scopedBaseRows.filter((r) => r.isPendingR && !r.isCorrectedRR)
    const correctedRR = scopedBaseRows.filter((r) => r.isCorrectedRR)
    const missingOt = scopedBaseRows.filter((r) => r.hasMissingOt)
    const budgetDec013 = scopedBaseRows.filter((r) => r.isPresupuesto)

    const sumHrs = (arr) => arr.reduce((acc, r) => acc + (r.hoursPhysical || 0), 0)
    const sumCost = (arr, field = 'costUsd') => arr.reduce((acc, r) => acc + (r[field] || 0), 0)

    return [
      {
        id: 'APPROVED',
        label: 'Horas Aprobadas (S)',
        count: formatUsd(sumCost(approved, 'approvedUsd'), 0),
        subtext: `${sumHrs(approved).toFixed(1)} hs físicas (${approved.length} partes)`,
        colorTheme: 'emerald'
      },
      {
        id: 'PENDING_R',
        label: 'Pendientes Revisión ("R")',
        count: formatUsd(sumCost(pendingR, 'pendingRUsd'), 0),
        subtext: `${sumHrs(pendingR).toFixed(1)} hs en revisión`,
        colorTheme: 'amber'
      },
      {
        id: 'CORRECTED_RR',
        label: 'Corregidas ("RR")',
        count: correctedRR.length,
        subtext: `${sumHrs(correctedRR).toFixed(1)} hs corregidas`,
        colorTheme: 'cyan'
      },
      {
        id: 'SIN_OT',
        label: 'Sin OT Asignada',
        count: missingOt.length,
        subtext: 'Partes pendientes de vincular OT',
        colorTheme: 'rose'
      },
      {
        id: 'DEC_013',
        label: 'Presupuesto (DEC-013)',
        count: budgetDec013.length,
        subtext: `${sumHrs(budgetDec013).toFixed(1)} hs ($0 automático)`,
        colorTheme: 'purple'
      }
    ]
  }, [scopedBaseRows])

  const filteredRows = useMemo(() => {
    return scopedBaseRows.filter((row) => {
      if (kpiFilter === 'APPROVED' && (row.isPendingR || row.isPresupuesto)) return false
      if (kpiFilter === 'PENDING_R' && !(row.isPendingR && !row.isCorrectedRR)) return false
      if (kpiFilter === 'CORRECTED_RR' && !row.isCorrectedRR) return false
      if (kpiFilter === 'SIN_OT' && !row.hasMissingOt) return false
      if (kpiFilter === 'DEC_013' && !row.isPresupuesto) return false

      if (workerTypeFilter !== 'ALL' && row.workerType !== workerTypeFilter) return false
      if (searchQuery && !matchesUniversalSearch(row, searchQuery)) return false
      return true
    })
  }, [scopedBaseRows, kpiFilter, workerTypeFilter, searchQuery])

  const summaryStats = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => {
        acc.hoursPhysical += r.hoursPhysical || 0
        acc.hoursEquiv += r.hoursEquiv || 0
        acc.totalUsd += r.costUsd || 0
        return acc
      },
      { hoursPhysical: 0, hoursEquiv: 0, totalUsd: 0 }
    )
  }, [filteredRows])

  const hasFilters = Boolean(searchQuery || kpiFilter !== 'ALL' || workerTypeFilter !== 'ALL')

  const handleClearFilters = () => {
    setSearchQuery('')
    setKpiFilter('ALL')
    setWorkerTypeFilter('ALL')
  }

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

      <div className="alon-zone-toolbar p-3 bg-slate-900/70 flex flex-wrap items-center gap-2.5">
        <CrawlerSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          onClear={() => setSearchQuery('')}
          placeholder="Buscar operario, contratista, oficio, OT, PRC o notas... (Ctrl+F)"
        />

        <select
          value={workerTypeFilter}
          onChange={(e) => setWorkerTypeFilter(e.target.value)}
          className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none"
        >
          <option value="ALL">Centro: Todos</option>
          <option value="Astillero">Astillero (Hs + Recargos)</option>
          <option value="Contratista">Contratista (Tarifa Fija)</option>
        </select>

        {hasFilters && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-200 border border-slate-600 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restablecer
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
            { key: 'otNumber', label: 'O.T' },
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
                    <td className="px-2.5 py-1.5 whitespace-nowrap font-mono text-cyan-300 font-semibold">
                      {r.otNumber}
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
