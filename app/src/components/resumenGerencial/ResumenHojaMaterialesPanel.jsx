import React, { useMemo, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import KpiRadar from '../KpiRadar'
import CrawlerSearchBar from '../CrawlerSearchBar'
import GridStatusBarBottom from '../GridStatusBarBottom'
import { matchesUniversalSearch } from '../../lib/searchEngine'
import { formatUsd, formatKg } from '../../lib/drydockCatalogConstants'
import { CostSheetHeaderBar, ReadOnlyGridRibbon } from './CostSheetChrome'

/**
 * Hoja Solo Lectura: MATERIALES (MATERIALES GENERAL / MATERIALES POR O.T).
 * Estructura Zona 2 + Zona 3 + Zona 4 + Zona 5 para visualización sin edición.
 */
export default function ResumenHojaMaterialesPanel({
  ship,
  otRows = [],
  activeOtId,
  costScope = 'GENERAL',
  materialRows = [],
  onSelectSheet,
  onChangeCostScope,
  onSelectOt,
  onBackToSummary
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [kpiFilter, setKpiFilter] = useState('ALL')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [onlyKgPositive, setOnlyKgPositive] = useState(false)

  // Base según Buque + Alcance (GENERAL vs POR O.T)
  const scopedBaseRows = useMemo(() => {
    return materialRows.filter((r) => {
      if (ship?.id && r.shipId !== ship.id) return false
      if (costScope === 'OT' && activeOtId) {
        if (activeOtId === 'SIN_OT') return !r.workOrderId
        return r.workOrderId === activeOtId
      }
      return true
    })
  }, [materialRows, ship?.id, costScope, activeOtId])

  const kpiCards = useMemo(() => {
    const matsDirect = scopedBaseRows.filter((r) => r.category === 'MATERIALES')
    const consumables = scopedBaseRows.filter((r) => r.category === 'CONSUMIBLES')
    const eppRef = scopedBaseRows.filter((r) => r.isSafetyReference)
    const withKg = scopedBaseRows.filter((r) => Number(r.weightKg) > 0)
    const missingOt = scopedBaseRows.filter((r) => r.hasMissingOt)
    const zeroPrice = scopedBaseRows.filter((r) => r.hasZeroPrice && !r.isDeletionRequested)

    const sumUsd = (arr, key = 'shipDirectUsd') =>
      arr.reduce((acc, item) => acc + (Number(item[key]) || 0), 0)
    const sumKg = withKg.reduce((acc, item) => acc + (Number(item.weightKg) || 0), 0)

    return [
      {
        id: 'MATERIALES',
        label: 'Materiales Directos',
        count: formatUsd(sumUsd(matsDirect), 0),
        subtext: `${matsDirect.length} movs. cargados`,
        colorTheme: 'blue'
      },
      {
        id: 'CONSUMIBLES',
        label: 'Consumibles Obra',
        count: formatUsd(sumUsd(consumables), 0),
        subtext: `${consumables.length} consumibles imputados`,
        colorTheme: 'cyan'
      },
      {
        id: 'EPP_REF',
        label: 'Elem. Seguridad (Ref.)',
        count: formatUsd(sumUsd(eppRef, 'referenceUsd'), 0),
        subtext: `${eppRef.length} retiros EPP · No suman`,
        colorTheme: 'amber'
      },
      {
        id: 'PESO_KG',
        label: 'Peso Total Instalado',
        count: formatKg(sumKg, 1),
        subtext: `${withKg.length} ítems con pesaje`,
        colorTheme: 'purple'
      },
      {
        id: 'SIN_OT',
        label: 'Sin Cargar OT',
        count: missingOt.length,
        subtext: 'Movimientos sin OT vinculada',
        colorTheme: 'rose'
      },
      {
        id: 'PRECIO_0',
        label: 'Precio US$ = $0',
        count: zeroPrice.length,
        subtext: 'Alertas sin valorización',
        colorTheme: 'pink'
      }
    ]
  }, [scopedBaseRows])

  const filteredRows = useMemo(() => {
    return scopedBaseRows.filter((row) => {
      if (kpiFilter === 'MATERIALES' && row.category !== 'MATERIALES') return false
      if (kpiFilter === 'CONSUMIBLES' && row.category !== 'CONSUMIBLES') return false
      if (kpiFilter === 'EPP_REF' && !row.isSafetyReference) return false
      if (kpiFilter === 'PESO_KG' && Number(row.weightKg) <= 0) return false
      if (kpiFilter === 'SIN_OT' && !row.hasMissingOt) return false
      if (kpiFilter === 'PRECIO_0' && (!row.hasZeroPrice || row.isDeletionRequested)) return false

      if (categoryFilter !== 'ALL' && row.category !== categoryFilter) return false
      if (onlyKgPositive && Number(row.weightKg) <= 0) return false
      if (searchQuery && !matchesUniversalSearch(row, searchQuery)) return false
      return true
    })
  }, [scopedBaseRows, kpiFilter, categoryFilter, onlyKgPositive, searchQuery])

  const summaryStats = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => {
        acc.directUsd += r.shipDirectUsd || 0
        acc.refUsd += r.referenceUsd || 0
        acc.weightKg += r.weightKg || 0
        return acc
      },
      { directUsd: 0, refUsd: 0, weightKg: 0 }
    )
  }, [filteredRows])

  const hasFilters = Boolean(searchQuery || kpiFilter !== 'ALL' || categoryFilter !== 'ALL' || onlyKgPositive)

  const handleClearFilters = () => {
    setSearchQuery('')
    setKpiFilter('ALL')
    setCategoryFilter('ALL')
    setOnlyKgPositive(false)
  }

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

      {/* ZONA 3: CRAWLER SEARCH + FILTROS LIMPIOS */}
      <div className="alon-zone-toolbar p-3 bg-slate-900/70 flex flex-wrap items-center gap-2.5">
        <CrawlerSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          onClear={() => setSearchQuery('')}
          placeholder="Buscar material, rubro, OT, solicitante, vale o factura... (Ctrl+F)"
        />

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none"
        >
          <option value="ALL">Categoría: Todas</option>
          <option value="MATERIALES">Materiales</option>
          <option value="CONSUMIBLES">Consumibles</option>
          <option value="SEGURIDAD">Elem. Seguridad</option>
        </select>

        <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={onlyKgPositive}
            onChange={(e) => setOnlyKgPositive(e.target.checked)}
            className="rounded border-slate-600"
          />
          Solo KG &gt; 0
        </label>

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
            { key: 'otNumber', label: 'O.T' },
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
                    <td className="px-2.5 py-1.5 whitespace-nowrap font-mono text-cyan-300 font-semibold">
                      {r.otNumber}
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
