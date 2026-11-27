import { useState, useRef, useMemo } from 'react'
import { Check, Undo2, Clock, Wrench } from 'lucide-react'
import CanonicalZone3Toolbar from '../canonical/CanonicalZone3Toolbar.jsx'
import CanonicalOtBadge from '../canonical/CanonicalOtBadge.jsx'
import CanonicalProgressiveTableFooter from '../canonical/CanonicalProgressiveTableFooter.jsx'
import GridStatusBarBottom from '../GridStatusBarBottom.jsx'
import HighlightText from '../HighlightText.jsx'
import CostControlThirdPartyTable from './CostControlThirdPartyTable.jsx'
import { useSheetSelection } from '../../hooks/grid/useSheetSelection.js'
import { useProgressiveRows } from '../../hooks/useProgressiveRows.js'
import { matchesUniversalSearch } from '../../lib/searchEngine.js'
import { getFilterSelectClass } from '../../lib/filterThemeConstants.js'
import { buildLookupMap } from '../../lib/gridPerformanceHelpers.js'

const LABOR_ONLY_COLUMNS = [
  { key: 'entity', label: 'Contratista', isNumeric: false, getValue: (r) => r.entity || '' },
  { key: 'shipOt', label: 'Buque / OT', isNumeric: false, getValue: (r) => `${r.shipName || ''} · ${r.otLabel || ''}` },
  { key: 'days', label: 'Días / Últ. Fecha', type: 'date', getValue: (r) => r.lastDateAr || '' },
  { key: 'totalHours', label: 'Total Horas', isNumeric: true, formatType: 'number', getValue: (r) => Number(r.totalHours ?? 0) },
  { key: 'approval', label: 'Check Rápido', isNumeric: false, getValue: (r) => (r.isApproved ? 'Aprobado' : 'Pendiente') },
]

/**
 * Panel del submódulo 2: Comparador de Horas sin Materiales (check rápido ✓ Aprobado)
 * y retiros de Talleres Externos que no imputan parte diario (cruzados contra Terceros).
 */
export default function CostControlLaborOnlyPanel({
  laborOnlyRows = [], thirdPartyMaterialRows = [], kpis = {},
  ships = [], workOrders = [], workItems = [],
  contractorFilter = '', shipFilter = '', searchQuery = '',
  onSearchChange, onClearAllFilters, saving = false,
  onApproveLaborOnly, onRevokeReview,
}) {
  const [viewMode, setViewMode] = useState('labor_only')
  const [approvalFilter, setApprovalFilter] = useState('ALL')
  const searchInputRef = useRef(null)
  const scrollContainerRef = useRef(null)

  const shipsById = useMemo(() => buildLookupMap(ships), [ships])
  const workOrdersById = useMemo(() => buildLookupMap(workOrders), [workOrders])

  const filteredLaborRows = useMemo(() => (laborOnlyRows || []).filter((r) => {
    if (contractorFilter && r.entity !== contractorFilter) return false
    if (shipFilter && String(r.shipId || '') !== String(shipFilter)) return false
    if (approvalFilter === 'PENDING' && r.isApproved) return false
    if (approvalFilter === 'APPROVED' && !r.isApproved) return false
    if (searchQuery && !matchesUniversalSearch(`${r.entity} ${r.shipName} ${r.otLabel} ${r.lastDateAr} ${r.totalHours}`, searchQuery)) return false
    return true
  }), [laborOnlyRows, contractorFilter, shipFilter, approvalFilter, searchQuery])

  const filteredThirdPartyRows = useMemo(() => (thirdPartyMaterialRows || []).filter((r) => {
    if (contractorFilter && r.entity !== contractorFilter) return false
    if (shipFilter && String(r.shipId || '') !== String(shipFilter)) return false
    if (searchQuery && !matchesUniversalSearch(`${r.dateAr} ${r.voucherNumber} ${r.materialName} ${r.shipName} ${r.otLabel} ${r.entity}`, searchQuery)) return false
    return true
  }), [thirdPartyMaterialRows, contractorFilter, shipFilter, searchQuery])

  const sheet = useSheetSelection({ rows: filteredLaborRows, columns: LABOR_ONLY_COLUMNS, getRowId: (r) => r.key, sortable: true })
  const progressive = useProgressiveRows({
    items: sheet.sortedRows,
    resetKey: `${viewMode}|${approvalFilter}|${contractorFilter}|${shipFilter}|${searchQuery}|${filteredLaborRows.length}`,
    scrollContainerRef,
    activeIndex: sheet.activeCell?.rowIndex ?? -1,
  })

  const totalFilteredHours = useMemo(
    () => filteredLaborRows.reduce((acc, r) => acc + (Number(r.totalHours) || 0), 0),
    [filteredLaborRows]
  )
  const hasActiveFilters = Boolean(contractorFilter || shipFilter || searchQuery || (viewMode === 'labor_only' && approvalFilter !== 'ALL'))
  const handleClear = () => { setApprovalFilter('ALL'); onClearAllFilters?.() }

  const kpiCards = [
    { id: 'pending', count: kpis.laborOnlyPending ?? 0, label: 'Pendientes de Check', active: viewMode === 'labor_only' && approvalFilter === 'PENDING', border: 'border-amber-500/60 bg-amber-950/35 text-amber-300', ring: 'ring-amber-400', title: 'Enfocar grupos de horas sin materiales pendientes de aprobación', onClick: () => { setViewMode('labor_only'); setApprovalFilter('PENDING') } },
    { id: 'approved', count: kpis.laborOnlyApproved ?? 0, label: 'Aprobados (Solo Mano de Obra)', active: viewMode === 'labor_only' && approvalFilter === 'APPROVED', border: 'border-emerald-500/60 bg-emerald-950/35 text-emerald-300', ring: 'ring-emerald-400', title: 'Enfocar trabajos válidos de solo mano de obra ya aprobados', onClick: () => { setViewMode('labor_only'); setApprovalFilter('APPROVED') } },
    { id: 'total_labor', count: kpis.laborOnlyTotal ?? 0, label: 'Total Horas sin Materiales', active: viewMode === 'labor_only' && approvalFilter === 'ALL', border: 'border-sky-500/60 bg-sky-950/35 text-sky-300', ring: 'ring-sky-400', title: 'Ver todos los grupos de horas sin retiros de pañol en la quincena', onClick: () => { setViewMode('labor_only'); setApprovalFilter('ALL') } },
    { id: 'third_party', count: kpis.thirdPartyLines ?? 0, label: 'Talleres Externos (Sin Parte)', active: viewMode === 'third_party', border: 'border-indigo-500/60 bg-indigo-950/35 text-indigo-300', ring: 'ring-indigo-400', title: 'Ver retiros de talleres externos que no cargan parte diario (cruce con Terceros)', onClick: () => setViewMode('third_party') },
  ]

  return (
    <div className="space-y-3">
      <div className="alon-zone-kpis space-y-2.5">
        <div className="text-[10px] font-black uppercase tracking-wider text-amber-300/90">
          📊 RADAR HORAS SIN MATERIALES & TALLERES EXTERNOS • Clic en cualquier tarjeta para enfocar
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {kpiCards.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={c.onClick}
              title={c.title}
              className={`rounded-xl border px-3 py-2 text-left transition-all cursor-pointer ${c.border} ${c.active ? `ring-2 ${c.ring} shadow-lg` : 'opacity-90 hover:opacity-100'}`}
            >
              <div className="text-2xl font-black font-mono leading-tight">{c.count}</div>
              <div className="text-[11px] font-bold text-slate-200 mt-0.5 leading-snug">{c.label}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="alon-workspace-block space-y-2.5">
        <CanonicalZone3Toolbar
          searchValue={searchQuery}
          onSearchChange={onSearchChange}
          searchInputRef={searchInputRef}
          searchPlaceholder="Buscar contratista, barco, OT, fecha o material... (Ctrl+F)"
          hasActiveFilters={hasActiveFilters}
          onClearAllFilters={handleClear}
          counterText={viewMode === 'labor_only' ? `${filteredLaborRows.length} de ${laborOnlyRows.length} grupos` : `${filteredThirdPartyRows.length} de ${thirdPartyMaterialRows.length} retiros`}
          filters={
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setViewMode('labor_only')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${viewMode === 'labor_only' ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-sm' : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-cyan-500/60'}`}
                title="Comparador de horas imputadas sin retiros de pañol"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Horas sin Materiales ({laborOnlyRows.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('third_party')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${viewMode === 'third_party' ? 'bg-indigo-500 text-white border-indigo-300 shadow-sm' : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-indigo-400/60'}`}
                title="Retiros de talleres externos cruzados contra Terceros"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Talleres Externos ({thirdPartyMaterialRows.length})</span>
              </button>
              {viewMode === 'labor_only' && (
                <select
                  aria-label="Estado de aprobación solo mano de obra"
                  value={approvalFilter}
                  onChange={(e) => setApprovalFilter(e.target.value)}
                  className={getFilterSelectClass('status', approvalFilter !== 'ALL', 'bg-slate-950')}
                >
                  <option value="ALL" className="bg-slate-950 text-slate-100">Todos los estados</option>
                  <option value="PENDING" className="bg-slate-950 text-slate-100">Solo pendientes</option>
                  <option value="APPROVED" className="bg-slate-950 text-slate-100">Solo aprobados</option>
                </select>
              )}
            </div>
          }
        />

        {viewMode === 'third_party' ? (
          <CostControlThirdPartyTable
            rows={filteredThirdPartyRows}
            totalCount={thirdPartyMaterialRows.length}
            ships={ships}
            workOrders={workOrders}
            workItems={workItems}
            searchQuery={searchQuery}
            hasActiveFilters={hasActiveFilters}
            onClearAllFilters={handleClear}
          />
        ) : (
          <div className="space-y-2.5">
            <div className="alon-zone-grid">
              <div className="alon-grid-ribbon">
                <span className="font-black text-emerald-300 uppercase tracking-wider">
                  Trabajos con Horas y sin Retiro de Pañol ({filteredLaborRows.length})
                </span>
                <span className="text-[10px] text-slate-400">
                  Verificá si el trabajo realmente no requirió material y marcá ✓ Aprobar en 1 clic
                </span>
              </div>

              <div ref={scrollContainerRef} tabIndex={0} onKeyDown={sheet.handleKeyDown} className="alon-grid-scroll">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="alon-grid-thead">
                    <tr>
                      {LABOR_ONLY_COLUMNS.map((col) => (
                        <th key={col.key} {...sheet.getHeaderProps(col.key, 'px-3 py-2 whitespace-nowrap')}>
                          {col.label}{sheet.getSortIndicator(col.key)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {progressive.visibleItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                          Sin grupos de horas sin materiales para los filtros actuales.
                        </td>
                      </tr>
                    ) : (
                      progressive.visibleItems.map((row, rowIdx) => {
                        const entCell = sheet.getCellProps(rowIdx, 'entity')
                        const shipOtCell = sheet.getCellProps(rowIdx, 'shipOt')
                        const daysCell = sheet.getCellProps(rowIdx, 'days')
                        const hrsCell = sheet.getCellProps(rowIdx, 'totalHours')
                        const appCell = sheet.getCellProps(rowIdx, 'approval')
                        const shipObj = row.shipId ? shipsById.get(row.shipId) : null
                        const woObj = row.workOrderId ? workOrdersById.get(row.workOrderId) : null

                        return (
                          <tr key={row.key} className="hover:bg-slate-900/55 transition-colors">
                            <td {...entCell.domProps} className={`px-3 py-2 font-bold text-amber-200 whitespace-nowrap ${entCell.className}`}>
                              <HighlightText text={row.entity} query={searchQuery} />
                            </td>
                            <td {...shipOtCell.domProps} className={`px-3 py-2 min-w-[200px] ${shipOtCell.className}`}>
                              <div className="font-bold text-cyan-200 text-[11px] truncate">
                                <HighlightText text={row.shipName} query={searchQuery} />
                              </div>
                              <CanonicalOtBadge wo={woObj} ship={shipObj} workItems={workItems} workOrders={workOrders} variant="inline" searchQuery={searchQuery} />
                            </td>
                            <td {...daysCell.domProps} className={`px-3 py-2 whitespace-nowrap ${daysCell.className}`}>
                              <div className="font-semibold text-slate-200">{row.daysCount} día(s) · {row.count} parte(s)</div>
                              <div className="text-[11px] font-mono text-slate-400">Últ. {row.lastDateAr}</div>
                            </td>
                            <td {...hrsCell.domProps} className={`px-3 py-2 font-mono font-bold text-cyan-300 whitespace-nowrap ${hrsCell.className}`}>
                              {row.totalHours} hs
                            </td>
                            <td {...appCell.domProps} className={`px-3 py-2 whitespace-nowrap ${appCell.className}`}>
                              {row.isApproved ? (
                                <div className="inline-flex items-center gap-1.5">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-950/90 text-emerald-300 border border-emerald-500/50" title={row.review?.reason || 'Aprobado como trabajo válido de solo mano de obra'}>
                                    <Check className="w-3.5 h-3.5" />
                                    <span>✓ Aprobado</span>
                                  </span>
                                  <button type="button" disabled={saving} onClick={(e) => { e.stopPropagation(); onRevokeReview(row.reviewKey) }} className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-300 border border-slate-700 cursor-pointer disabled:opacity-40" title="Revertir aprobación y volver a pendiente">
                                    <Undo2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button type="button" disabled={saving} onClick={(e) => { e.stopPropagation(); onApproveLaborOnly(row) }} className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-200 border border-emerald-400/60 text-xs font-black cursor-pointer disabled:opacity-40 transition-colors" title="Aprobar trabajo válido de solo mano de obra (sin retiro de materiales)">
                                  <Check className="w-3.5 h-3.5" />
                                  <span>✓ Aprobar</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                    <CanonicalProgressiveTableFooter
                      visibleCount={progressive.visibleCount} totalCount={progressive.totalCount}
                      hasMore={progressive.hasMore} remainingCount={progressive.remainingCount}
                      loadMore={progressive.loadMore} showAll={progressive.showAll}
                      sentinelRef={progressive.sentinelRef} colSpan={5} entityLabel="grupos de horas sin materiales"
                    />
                  </tbody>
                </table>
              </div>
            </div>

            <GridStatusBarBottom
              isFixed={false}
              filteredCount={filteredLaborRows.length}
              totalCount={laborOnlyRows.length}
              entityName="grupos sin materiales"
              hasActiveFilter={hasActiveFilters}
              onClearFilters={handleClear}
              selectionStats={sheet.selectionStats}
              onClearSelection={sheet.clearSelection}
              globalAggregates={[{ label: 'Σ Horas', value: `${totalFilteredHours.toFixed(1)} hs`, highlight: true }]}
            />
          </div>
        )}
      </div>
    </div>
  )
}
