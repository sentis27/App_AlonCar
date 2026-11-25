import { useMemo, useRef, useState } from 'react'
import { ArrowDownUp, History, RefreshCw, Scale, Trash2 } from 'lucide-react'
import { useProgressiveRows } from '../../hooks/useProgressiveRows'
import { buildLookupMap } from '../../lib/gridPerformanceHelpers'
import { matchesUniversalSearch } from '../../lib/searchEngine'
import { formatDateAr, getTodayArIso } from '../../lib/dateTimeCanonical'
import { formatUnitMeasureShort } from '../../lib/unitMeasureUtils'
import {
  STOCK_REASON_LABELS,
  MATERIAL_CONDITION_LABELS,
  deleteStockAdjustmentService
} from '../../lib/stockControlService'
import GridRibbon from '../GridRibbon'
import GridStatusBarBottom from '../GridStatusBarBottom'
import CanonicalProgressiveTableFooter from '../canonical/CanonicalProgressiveTableFooter'
import HighlightText from '../HighlightText'

const CONDITION_BADGE_CLASSES = {
  DISPONIBLE: 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60',
  EN_CUARENTENA: 'bg-amber-950/70 text-amber-300 border-amber-600/60',
  OBSOLETO: 'bg-slate-800 text-slate-400 border-slate-700',
  DANADO: 'bg-rose-950/70 text-rose-300 border-rose-600/60'
}

export default function PanolEntradasPanel({
  stockAdjustments = [], setStockAdjustments, materials = [], setMaterials,
  searchQuery = '', filterReason = 'TODOS', filterDirection = 'TODOS',
  hasActiveFilters = false, onClearFilters, onOpenStockAdjustModal, onOpenKardexModal,
  isAdmin = false, user = null, showFeedback, loading = false
}) {
  const scrollRef = useRef(null)
  const [deletingId, setDeletingId] = useState(null)
  const materialById = useMemo(() => buildLookupMap(materials), [materials])

  const filteredAdjustments = useMemo(() => (stockAdjustments || []).filter((adj) => {
    const qty = Number(adj.quantity) || 0
    if (filterReason && filterReason !== 'TODOS' && adj.reason_type !== filterReason) return false
    if (filterDirection === 'ENTRADAS' && qty <= 0) return false
    if (filterDirection === 'SALIDAS' && qty >= 0) return false
    if (!searchQuery?.trim()) return true
    const mat = adj.material_id ? materialById.get(String(adj.material_id)) : null
    const searchable = [
      mat?.name || '', mat?.rubro || '', formatDateAr(adj.date),
      STOCK_REASON_LABELS[adj.reason_type] || adj.reason_type || '',
      MATERIAL_CONDITION_LABELS[adj.material_condition] || adj.material_condition || '',
      adj.notes || '', adj.created_by || ''
    ].join(' ')
    return matchesUniversalSearch(searchable, searchQuery)
  }), [stockAdjustments, filterReason, filterDirection, searchQuery, materialById])

  const totals = useMemo(() => {
    let totalIn = 0
    let totalOut = 0
    for (const adj of filteredAdjustments) {
      const q = Number(adj.quantity) || 0
      if (q > 0) totalIn += q
      else if (q < 0) totalOut += Math.abs(q)
    }
    return {
      totalIn: Number(totalIn.toFixed(3)),
      totalOut: Number(totalOut.toFixed(3)),
      netBalance: Number((totalIn - totalOut).toFixed(3))
    }
  }, [filteredAdjustments])

  const { visibleItems, visibleCount, hasMore, remainingCount, loadMore, showAll, sentinelRef } = useProgressiveRows({
    items: filteredAdjustments, scrollContainerRef: scrollRef,
    resetKey: `${searchQuery}|${filterReason}|${filterDirection}|${stockAdjustments.length}`
  })

  const handleDeleteAdjustment = async (adj) => {
    const mat = adj.material_id ? materialById.get(String(adj.material_id)) : null
    if (!window.confirm(`¿Eliminar este movimiento (${adj.quantity > 0 ? '+' : ''}${adj.quantity}) de "${mat?.name || 'Material'}"?\n\nPostgreSQL recalculará y restaurará el Stock Físico automáticamente.`)) return
    try {
      setDeletingId(adj.id)
      const res = await deleteStockAdjustmentService({ adjustment: adj, user })
      setStockAdjustments?.((prev) => prev.filter((item) => item.id !== adj.id))
      if (adj.material_id) {
        setMaterials?.((prev) => prev.map((m) => (m.id === adj.material_id ? { ...m, current_stock: res.newStock } : m)))
      }
      showFeedback('success', 'Movimiento eliminado y Stock Físico recalculado en BD.')
    } catch (err) {
      showFeedback('error', 'Error eliminando movimiento: ' + (err?.message || err))
    } finally {
      setDeletingId(null)
    }
  }

  const exportColumns = useMemo(() => [
    { key: 'date', label: 'Fecha', formatter: (v) => formatDateAr(v, { fallback: '' }) },
    { key: 'material_id', label: 'Material', formatter: (v) => materialById.get(String(v))?.name || '' },
    { key: 'rubro', label: 'Rubro', formatter: (_v, row) => materialById.get(String(row.material_id))?.rubro || '' },
    { key: 'quantity', label: 'Movimiento' },
    { key: 'reason_type', label: 'Motivo', formatter: (v) => STOCK_REASON_LABELS[v] || v },
    { key: 'material_condition', label: 'Estado', formatter: (v) => MATERIAL_CONDITION_LABELS[v] || v },
    { key: 'notes', label: 'Observaciones' },
    { key: 'created_by', label: 'Registrado por' }
  ], [materialById])

  return (
    <div className="alon-zone-grid font-sans">
      <GridRibbon
        onInsertRow={() => onOpenStockAdjustModal?.(null)}
        insertRowLabel="+ Nueva Entrada / Ajuste"
        totalRows={filteredAdjustments.length}
        entityName="movimientos"
        exportRows={filteredAdjustments}
        exportColumns={exportColumns}
        exportFilename={`panol_entradas_ajustes_${getTodayArIso()}`}
      />

      <div ref={scrollRef} className="alon-grid-scroll">
        <table className="w-full text-left text-[11px] border-collapse">
          <thead className="sticky top-0 z-20 alon-grid-thead">
            <tr>
              <th className="py-2 px-2 w-10 text-center">#</th>
              <th className="py-2 px-2">Fecha</th>
              <th className="py-2 px-2">Material / Insumo</th>
              <th className="py-2 px-2">Rubro</th>
              <th className="py-2 px-2 text-right">Movimiento</th>
              <th className="py-2 px-2">Motivo</th>
              <th className="py-2 px-2 text-center">Estado</th>
              <th className="py-2 px-2">Observaciones</th>
              <th className="py-2 px-2">Registrado por</th>
              <th className="py-2 px-2 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-500 text-xs">
                  <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin mx-auto mb-2" />
                  <span>Cargando movimientos de Entradas & Ajustes...</span>
                </td>
              </tr>
            ) : filteredAdjustments.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-500 text-xs space-y-1">
                  <ArrowDownUp className="w-6 h-6 text-slate-600 mx-auto mb-1" />
                  <p>Sin entradas ni ajustes registrados con los filtros actuales.</p>
                </td>
              </tr>
            ) : (
              visibleItems.map((adj, idx) => {
                const mat = adj.material_id ? materialById.get(String(adj.material_id)) : null
                const qty = Number(adj.quantity) || 0
                const isEntry = qty > 0
                const unitShort = formatUnitMeasureShort(mat?.unit_measure)
                const condCls = CONDITION_BADGE_CLASSES[adj.material_condition] || CONDITION_BADGE_CLASSES.DISPONIBLE

                return (
                  <tr key={adj.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-1.5 px-2 text-center font-mono text-[10px] text-slate-500">{idx + 1}</td>
                    <td className="py-1.5 px-2 font-mono text-slate-300 whitespace-nowrap">
                      <HighlightText text={formatDateAr(adj.date)} query={searchQuery} />
                    </td>
                    <td className="py-1.5 px-2 font-bold text-white max-w-[230px] truncate">
                      {mat ? (
                        <button
                          type="button"
                          onClick={() => onOpenKardexModal?.(mat)}
                          className="text-left hover:text-cyan-300 transition-colors truncate max-w-full cursor-pointer"
                          title="Clic para ver Kárdex cronológico del material"
                        >
                          <HighlightText text={mat.name} query={searchQuery} />
                        </button>
                      ) : <span className="text-slate-500">Material eliminado</span>}
                    </td>
                    <td className="py-1.5 px-2 text-slate-400 truncate max-w-[130px]">{mat?.rubro || '—'}</td>
                    <td className="py-1.5 px-2 text-right font-mono font-black whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded border text-[10.5px] ${isEntry ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40' : 'bg-rose-950/70 text-rose-300 border-rose-500/40'}`}>
                        {isEntry ? `+${qty}` : qty} {unitShort}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-slate-200 whitespace-nowrap">
                      <HighlightText text={STOCK_REASON_LABELS[adj.reason_type] || adj.reason_type} query={searchQuery} />
                    </td>
                    <td className="py-1.5 px-2 text-center whitespace-nowrap">
                      <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-bold ${condCls}`}>
                        {MATERIAL_CONDITION_LABELS[adj.material_condition] || adj.material_condition}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-slate-300 max-w-[220px] truncate" title={adj.notes || ''}>
                      <HighlightText text={adj.notes || '—'} query={searchQuery} />
                    </td>
                    <td className="py-1.5 px-2 text-slate-400 text-[10.5px] truncate max-w-[140px]">
                      <HighlightText text={adj.created_by || 'Sistema'} query={searchQuery} />
                    </td>
                    <td className="py-1.5 px-2 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        {mat && (
                          <>
                            <button
                              type="button"
                              onClick={() => onOpenKardexModal?.(mat)}
                              className="w-6 h-6 rounded-lg bg-cyan-950/90 hover:bg-cyan-500 border border-cyan-500/50 text-cyan-300 hover:text-slate-950 flex items-center justify-center cursor-pointer"
                              title="Ver Kárdex cronológico del material"
                            >
                              <History className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenStockAdjustModal?.(mat)}
                              className="w-6 h-6 rounded-lg bg-emerald-950/90 hover:bg-emerald-500 border border-emerald-500/50 text-emerald-300 hover:text-slate-950 flex items-center justify-center cursor-pointer"
                              title="Nuevo movimiento / recuento sobre este material"
                            >
                              <Scale className="w-3 h-3" />
                            </button>
                          </>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            disabled={deletingId === adj.id}
                            onClick={() => handleDeleteAdjustment(adj)}
                            className="w-6 h-6 rounded-lg bg-rose-950/80 hover:bg-rose-500 border border-rose-500/50 text-rose-300 hover:text-slate-950 flex items-center justify-center cursor-pointer disabled:opacity-40"
                            title="Eliminar movimiento y recalcular Stock Físico (Solo Admin)"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
            <CanonicalProgressiveTableFooter
              visibleCount={visibleCount} totalCount={filteredAdjustments.length} hasMore={hasMore}
              remainingCount={remainingCount} loadMore={loadMore} showAll={showAll}
              sentinelRef={sentinelRef} colSpan={10} entityLabel="movimientos"
            />
          </tbody>
        </table>
      </div>

      <GridStatusBarBottom
        filteredCount={filteredAdjustments.length}
        totalCount={stockAdjustments.length}
        entityName="movimientos"
        hasActiveFilter={hasActiveFilters}
        onClearFilters={onClearFilters}
        globalAggregates={[
          { label: 'Σ Entradas (+)', value: `+${totals.totalIn}` },
          { label: 'Σ Salidas (−)', value: `−${totals.totalOut}` },
          { label: 'Balance Neto', value: totals.netBalance > 0 ? `+${totals.netBalance}` : totals.netBalance, highlight: true }
        ]}
      />
    </div>
  )
}
