import React, { useMemo, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import KpiRadar from '../KpiRadar'
import CrawlerSearchBar from '../CrawlerSearchBar'
import GridStatusBarBottom from '../GridStatusBarBottom'
import { matchesUniversalSearch } from '../../lib/searchEngine'
import { formatUsd, formatArs } from '../../lib/drydockCatalogConstants'
import { CostSheetHeaderBar, ReadOnlyGridRibbon } from './CostSheetChrome'

/**
 * Hoja Solo Lectura: TERCEROS (TERCEROS GENERAL / TERCEROS POR O.T).
 */
export default function ResumenHojaTercerosPanel({
  ship,
  otRows = [],
  activeOtId,
  costScope = 'GENERAL',
  thirdPartyRows = [],
  onSelectSheet,
  onChangeCostScope,
  onSelectOt,
  onBackToSummary
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [kpiFilter, setKpiFilter] = useState('ALL')
  const [voucherFilter, setVoucherFilter] = useState('ALL')

  const scopedBaseRows = useMemo(() => {
    return thirdPartyRows.filter((r) => {
      if (ship?.id && r.shipId !== ship.id) return false
      if (costScope === 'OT' && activeOtId) {
        if (activeOtId === 'SIN_OT') return !r.workOrderId
        return r.workOrderId === activeOtId
      }
      return true
    })
  }, [thirdPartyRows, ship?.id, costScope, activeOtId])

  const voucherTypes = useMemo(
    () => Array.from(new Set(scopedBaseRows.map((r) => r.voucherType).filter(Boolean))),
    [scopedBaseRows]
  )

  const kpiCards = useMemo(() => {
    const missingOt = scopedBaseRows.filter((r) => r.hasMissingOt)
    const zeroCost = scopedBaseRows.filter((r) => r.hasZeroCost)
    const rpf = scopedBaseRows.filter((r) => r.voucherType === 'RPF')
    const fcr = scopedBaseRows.filter((r) => r.voucherType === 'FCR')
    const prcRmo = scopedBaseRows.filter((r) => r.voucherType === 'PRC' || r.voucherType === 'RMO')

    const sumUsd = (arr) => arr.reduce((acc, item) => acc + (item.amountUsd || 0), 0)

    return [
      {
        id: 'FCR',
        label: 'FCR Facturados',
        count: formatUsd(sumUsd(fcr), 0),
        subtext: `${fcr.length} facturas rendidas`,
        colorTheme: 'emerald'
      },
      {
        id: 'PRC_RMO',
        label: 'PRC / RMO Vigentes',
        count: formatUsd(sumUsd(prcRmo), 0),
        subtext: `${prcRmo.length} comprobantes en obra`,
        colorTheme: 'cyan'
      },
      {
        id: 'RPF',
        label: 'RPF Pdte. Factura',
        count: formatUsd(sumUsd(rpf), 0),
        subtext: `${rpf.length} remitos sin facturar`,
        colorTheme: 'purple'
      },
      {
        id: 'SIN_OT',
        label: 'Falta Cargar OT',
        count: missingOt.length,
        subtext: 'Servicios sin OT asignada',
        colorTheme: 'rose'
      },
      {
        id: 'SIN_COSTO',
        label: 'Sin Costo ($0)',
        count: zeroCost.length,
        subtext: 'Pendientes de cotización',
        colorTheme: 'amber'
      }
    ]
  }, [scopedBaseRows])

  const filteredRows = useMemo(() => {
    return scopedBaseRows.filter((row) => {
      if (kpiFilter === 'FCR' && row.voucherType !== 'FCR') return false
      if (kpiFilter === 'PRC_RMO' && !['PRC', 'RMO'].includes(row.voucherType)) return false
      if (kpiFilter === 'RPF' && row.voucherType !== 'RPF') return false
      if (kpiFilter === 'SIN_OT' && !row.hasMissingOt) return false
      if (kpiFilter === 'SIN_COSTO' && !row.hasZeroCost) return false

      if (voucherFilter !== 'ALL' && row.voucherType !== voucherFilter) return false
      if (searchQuery && !matchesUniversalSearch(row, searchQuery)) return false
      return true
    })
  }, [scopedBaseRows, kpiFilter, voucherFilter, searchQuery])

  const summaryStats = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => {
        acc.totalUsd += r.amountUsd || 0
        acc.totalArs += r.amountArs || 0
        return acc
      },
      { totalUsd: 0, totalArs: 0 }
    )
  }, [filteredRows])

  const hasFilters = Boolean(searchQuery || kpiFilter !== 'ALL' || voucherFilter !== 'ALL')

  const handleClearFilters = () => {
    setSearchQuery('')
    setKpiFilter('ALL')
    setVoucherFilter('ALL')
  }

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
        onSelectOt={onSelectOt}
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

      <div className="alon-zone-toolbar p-3 bg-slate-900/70 flex flex-wrap items-center gap-2.5">
        <CrawlerSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          onClear={() => setSearchQuery('')}
          placeholder="Buscar contratista, rubro, OT, comprobante o detalle... (Ctrl+F)"
        />

        <select
          value={voucherFilter}
          onChange={(e) => setVoucherFilter(e.target.value)}
          className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none"
        >
          <option value="ALL">Comprobante: Todos</option>
          {voucherTypes.map((vt) => (
            <option key={vt} value={vt}>
              {vt}
            </option>
          ))}
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
          badgeText={`👁️ TERCEROS · ${costScope === 'OT' ? 'POR O.T' : 'GENERAL'} (SOLO LECTURA)`}
          hintText="Vista de consulta protegida · Para editar importes o estados ingresá a Terceros y Talleres."
          totalRows={filteredRows.length}
          entityName="comprobantes"
          exportRows={filteredRows}
          exportFilename={`gs004_terceros_${ship?.name || 'buque'}.csv`}
          exportColumns={[
            { key: 'date', label: 'Fecha' },
            { key: 'otNumber', label: 'O.T' },
            { key: 'contractorName', label: 'Contratista' },
            { key: 'rubro', label: 'Rubro' },
            { key: 'voucherType', label: 'Tipo' },
            { key: 'voucherNumber', label: 'Nro Comp.' },
            { key: 'amountArs', label: 'Importe ARS' },
            { key: 'usdRate', label: 'TC' },
            { key: 'amountUsd', label: 'Total US$' },
            { key: 'auditStatus', label: 'Auditoría' },
            { key: 'observations', label: 'Observaciones' }
          ]}
        />

        <div className="overflow-x-auto max-h-[54vh]">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="alon-grid-thead sticky top-0 z-10 text-[10px] uppercase tracking-wider text-slate-300">
              <tr>
                <th className="px-2.5 py-2 w-10 text-center">#</th>
                <th className="px-2.5 py-2">Fecha</th>
                <th className="px-2.5 py-2">O.T</th>
                <th className="px-2.5 py-2">Contratista / Taller</th>
                <th className="px-2.5 py-2">Rubro</th>
                <th className="px-2.5 py-2">Tipo</th>
                <th className="px-2.5 py-2">N° Comp.</th>
                <th className="px-2.5 py-2 text-right">Importe ARS</th>
                <th className="px-2.5 py-2 text-right">TC</th>
                <th className="px-2.5 py-2 text-right">Total US$</th>
                <th className="px-2.5 py-2">Auditoría</th>
                <th className="px-2.5 py-2">Observaciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-slate-500">
                    No hay comprobantes de terceros para los filtros actuales.
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
                    <td className="px-2.5 py-1.5 font-medium text-white truncate max-w-[190px]">
                      {r.contractorName}
                    </td>
                    <td className="px-2.5 py-1.5 text-slate-400">{r.rubro}</td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-200">
                        {r.voucherType}
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5 font-mono text-slate-300">{r.voucherNumber || '—'}</td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums text-slate-300">
                      {r.amountArs > 0 ? formatArs(r.amountArs, 0) : '—'}
                    </td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums text-slate-400">{r.usdRate}</td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums font-bold text-emerald-300">
                      {formatUsd(r.amountUsd)}
                    </td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                        {r.auditStatus}
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5 text-slate-400 truncate max-w-[200px]" title={r.observations}>
                      {r.observations || '—'}
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
          entityName="comprobantes"
          hasActiveFilter={hasFilters}
          onClearFilters={handleClearFilters}
          globalAggregates={[
            { label: 'TOTAL TERCEROS US$', value: formatUsd(summaryStats.totalUsd), highlight: true },
            { label: 'ACUMULADO ARS', value: formatArs(summaryStats.totalArs, 0) }
          ]}
        />
      </div>
    </div>
  )
}
