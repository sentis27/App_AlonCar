import { useMemo, useRef } from 'react'
import { CheckCircle2, ClipboardCheck, History, RefreshCw, AlertTriangle } from 'lucide-react'
import { useProgressiveRows } from '../../hooks/useProgressiveRows'
import { buildLookupMap } from '../../lib/gridPerformanceHelpers'
import { matchesUniversalSearch } from '../../lib/searchEngine'
import { formatDateAr, getTodayArIso } from '../../lib/dateTimeCanonical'
import { formatUnitMeasureShort } from '../../lib/unitMeasureUtils'
import { computeStockAuditMetrics, MATERIAL_CONDITION_LABELS } from '../../lib/stockControlService'
import GridRibbon from '../GridRibbon'
import GridStatusBarBottom from '../GridStatusBarBottom'
import CanonicalProgressiveTableFooter from '../canonical/CanonicalProgressiveTableFooter'
import HighlightText from '../HighlightText'

export default function PanolStockAuditPanel({
  stockAudits = [], materials = [], searchQuery = '', filterRubro = 'TODOS', filterAuditStatus = 'TODOS',
  hasActiveFilters = false, onClearFilters, onOpenAuditBatchModal, onOpenKardexModal, loading = false
}) {
  const scrollRef = useRef(null)
  const materialById = useMemo(() => buildLookupMap(materials), [materials])

  const filteredAudits = useMemo(() => (stockAudits || []).filter((audit) => {
    const mat = audit.material_id ? materialById.get(String(audit.material_id)) : null
    const rubroName = String(mat?.rubro || 'SIN RUBRO').toUpperCase()
    if (filterRubro && filterRubro !== 'TODOS' && rubroName !== filterRubro.toUpperCase()) return false
    if (filterAuditStatus && filterAuditStatus !== 'TODOS' && audit.status !== filterAuditStatus) return false
    if (!searchQuery?.trim()) return true
    const searchable = [
      mat?.name || '', rubroName, formatDateAr(audit.date),
      audit.status === 'OK' ? 'OK correcto exacto' : 'DISCREPANCY error diferencia',
      MATERIAL_CONDITION_LABELS[audit.material_condition] || audit.material_condition || '',
      audit.notes || '', audit.audited_by || ''
    ].join(' ')
    return matchesUniversalSearch(searchable, searchQuery)
  }), [stockAudits, filterRubro, filterAuditStatus, searchQuery, materialById])

  const metrics = useMemo(() => computeStockAuditMetrics(filteredAudits), [filteredAudits])
  const adjustedCount = useMemo(() => filteredAudits.filter((a) => Boolean(a.adjustment_id)).length, [filteredAudits])

  const { visibleItems, visibleCount, hasMore, remainingCount, loadMore, showAll, sentinelRef } = useProgressiveRows({
    items: filteredAudits, scrollContainerRef: scrollRef,
    resetKey: `${searchQuery}|${filterRubro}|${filterAuditStatus}|${stockAudits.length}`
  })

  const exportColumns = useMemo(() => [
    { key: 'date', label: 'Fecha', formatter: (v) => formatDateAr(v, { fallback: '' }) },
    { key: 'material_id', label: 'Material', formatter: (v) => materialById.get(String(v))?.name || '' },
    { key: 'rubro', label: 'Rubro', formatter: (_v, row) => materialById.get(String(row.material_id))?.rubro || '' },
    { key: 'system_quantity', label: 'Stock Sistema' },
    { key: 'counted_quantity', label: 'Conteo Físico' },
    { key: 'calculated_delta', label: 'Diferencia' },
    { key: 'status', label: 'Resultado' },
    { key: 'material_condition', label: 'Condición', formatter: (v) => MATERIAL_CONDITION_LABELS[v] || v },
    { key: 'audited_by', label: 'Auditor' },
    { key: 'notes', label: 'Observaciones' }
  ], [materialById])

  return (
    <div className="space-y-3 font-sans">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 font-mono">
        <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
          <span className="block text-[10px] uppercase font-bold text-slate-400">Controles Registrados</span>
          <span className="text-lg font-black text-white">{metrics.total}</span>
        </div>
        <div className="p-3 rounded-xl bg-emerald-950/35 border border-emerald-500/40">
          <span className="block text-[10px] uppercase font-bold text-emerald-400">% Datos Correctos</span>
          <span className="text-lg font-black text-emerald-300">{metrics.okPct}%</span>
          <span className="ml-2 text-[10px] text-emerald-400/80">({metrics.okCount} OK)</span>
        </div>
        <div className="p-3 rounded-xl bg-rose-950/35 border border-rose-500/40">
          <span className="block text-[10px] uppercase font-bold text-rose-400">% Con Error</span>
          <span className="text-lg font-black text-rose-300">{metrics.errorPct}%</span>
          <span className="ml-2 text-[10px] text-rose-400/80">({metrics.discrepancyCount} dif.)</span>
        </div>
        <div className="p-3 rounded-xl bg-cyan-950/35 border border-cyan-500/40">
          <span className="block text-[10px] uppercase font-bold text-cyan-400">Ajustes Aplicados</span>
          <span className="text-lg font-black text-cyan-300">{adjustedCount}</span>
          <span className="ml-2 text-[10px] text-cyan-400/80">compensatorios</span>
        </div>
      </div>

      <div className="alon-zone-grid">
        <GridRibbon
          onInsertRow={() => onOpenAuditBatchModal?.()}
          insertRowLabel="+ Nuevo Control por Rubro"
          totalRows={filteredAudits.length}
          entityName="controles"
          exportRows={filteredAudits}
          exportColumns={exportColumns}
          exportFilename={`panol_control_stock_${getTodayArIso()}`}
        />

        <div ref={scrollRef} className="alon-grid-scroll">
          <table className="w-full text-left text-[11px] border-collapse">
            <thead className="sticky top-0 z-20 alon-grid-thead">
              <tr>
                <th className="py-2 px-2 w-10 text-center">#</th>
                <th className="py-2 px-2">Fecha</th>
                <th className="py-2 px-2">Material / Insumo</th>
                <th className="py-2 px-2">Rubro</th>
                <th className="py-2 px-2 text-right">Stock Sistema</th>
                <th className="py-2 px-2 text-right">Conteo Físico</th>
                <th className="py-2 px-2 text-right">Diferencia</th>
                <th className="py-2 px-2 text-center">Resultado</th>
                <th className="py-2 px-2 text-center">Condición</th>
                <th className="py-2 px-2">Auditor / Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500 text-xs">
                    <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin mx-auto mb-2" />
                    <span>Cargando bitácora de Control Físico de Stock...</span>
                  </td>
                </tr>
              ) : filteredAudits.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500 text-xs space-y-1">
                    <ClipboardCheck className="w-6 h-6 text-slate-600 mx-auto mb-1" />
                    <p>Sin controles físicos registrados para los filtros seleccionados.</p>
                  </td>
                </tr>
              ) : (
                visibleItems.map((audit, idx) => {
                  const mat = audit.material_id ? materialById.get(String(audit.material_id)) : null
                  const unitShort = formatUnitMeasureShort(mat?.unit_measure)
                  const delta = Number(audit.calculated_delta) || 0
                  const isOk = audit.status === 'OK' || Math.abs(delta) <= 0.0005

                  return (
                    <tr key={audit.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-1.5 px-2 text-center font-mono text-[10px] text-slate-500">{idx + 1}</td>
                      <td className="py-1.5 px-2 font-mono text-slate-300 whitespace-nowrap">
                        <HighlightText text={formatDateAr(audit.date)} query={searchQuery} />
                      </td>
                      <td className="py-1.5 px-2 font-bold text-white max-w-[230px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {mat ? (
                            <>
                              <button
                                type="button"
                                onClick={() => onOpenKardexModal?.(mat)}
                                className="text-left hover:text-cyan-300 truncate cursor-pointer"
                                title="Clic para ver Kárdex cronológico"
                              >
                                <HighlightText text={mat.name} query={searchQuery} />
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenKardexModal?.(mat)}
                                className="w-5 h-5 rounded bg-slate-900 hover:bg-cyan-500 border border-slate-700 text-cyan-300 hover:text-slate-950 inline-flex items-center justify-center shrink-0 cursor-pointer"
                                title="Abrir Kárdex del material"
                              >
                                <History className="w-3 h-3" />
                              </button>
                            </>
                          ) : <span className="text-slate-500">Material eliminado</span>}
                        </div>
                      </td>
                      <td className="py-1.5 px-2 text-slate-400 truncate max-w-[130px]">{mat?.rubro || '—'}</td>
                      <td className="py-1.5 px-2 text-right font-mono text-slate-300 whitespace-nowrap">{audit.system_quantity} {unitShort}</td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold text-white whitespace-nowrap">{audit.counted_quantity} {unitShort}</td>
                      <td className={`py-1.5 px-2 text-right font-mono font-black whitespace-nowrap ${isOk ? 'text-emerald-300' : delta > 0 ? 'text-cyan-300' : 'text-rose-300'}`}>
                        {isOk ? '0' : `${delta > 0 ? `+${delta}` : delta}`} {unitShort}
                      </td>
                      <td className="py-1.5 px-2 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-bold ${isOk ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40' : 'bg-rose-950/70 text-rose-300 border-rose-500/40'}`}>
                            {isOk ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                            <span>{isOk ? 'OK' : 'DIFERENCIA'}</span>
                          </span>
                          {audit.adjustment_id && (
                            <span className="px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 text-[9px] font-bold">Ajustado</span>
                          )}
                        </div>
                      </td>
                      <td className="py-1.5 px-2 text-center whitespace-nowrap text-[10px] text-slate-300">
                        {MATERIAL_CONDITION_LABELS[audit.material_condition] || audit.material_condition}
                      </td>
                      <td className="py-1.5 px-2 max-w-[210px] truncate text-slate-300" title={audit.notes || ''}>
                        <span className="text-slate-400">{audit.audited_by || 'Pañol'}:</span>{' '}
                        <HighlightText text={audit.notes || 'Sin obs.'} query={searchQuery} />
                      </td>
                    </tr>
                  )
                })
              )}
              <CanonicalProgressiveTableFooter
                visibleCount={visibleCount} totalCount={filteredAudits.length} hasMore={hasMore}
                remainingCount={remainingCount} loadMore={loadMore} showAll={showAll}
                sentinelRef={sentinelRef} colSpan={10} entityLabel="controles"
              />
            </tbody>
          </table>
        </div>

        <GridStatusBarBottom
          filteredCount={filteredAudits.length}
          totalCount={stockAudits.length}
          entityName="controles"
          hasActiveFilter={hasActiveFilters}
          onClearFilters={onClearFilters}
          globalAggregates={[
            { label: '% Datos Correctos', value: `${metrics.okPct}%`, highlight: true },
            { label: '% Con Error', value: `${metrics.errorPct}%` },
            { label: 'Ajustes Aplicados', value: adjustedCount }
          ]}
        />
      </div>
    </div>
  )
}
