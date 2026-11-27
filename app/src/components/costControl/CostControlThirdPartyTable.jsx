import { useRef, useMemo } from 'react'
import { CheckCircle2, AlertTriangle, Wrench } from 'lucide-react'
import CanonicalOtBadge from '../canonical/CanonicalOtBadge.jsx'
import CanonicalProgressiveTableFooter from '../canonical/CanonicalProgressiveTableFooter.jsx'
import GridStatusBarBottom from '../GridStatusBarBottom.jsx'
import HighlightText from '../HighlightText.jsx'
import { useSheetSelection } from '../../hooks/grid/useSheetSelection.js'
import { useProgressiveRows } from '../../hooks/useProgressiveRows.js'
import { buildLookupMap } from '../../lib/gridPerformanceHelpers.js'

const THIRD_PARTY_COLUMNS = [
  { key: 'date', label: 'Fecha', type: 'date', getValue: (r) => r.dateAr || '' },
  { key: 'voucher', label: 'Vale', isNumeric: false, getValue: (r) => r.voucherNumber || '' },
  {
    key: 'material',
    label: 'Material / Cant.',
    isNumeric: false,
    getValue: (r) => `${r.materialName || ''} (${r.quantity || 0} ${r.unitMeasure || ''})`,
  },
  { key: 'entity', label: 'Taller Externo', isNumeric: false, getValue: (r) => r.entity || '' },
  { key: 'shipOt', label: 'Buque / OT', isNumeric: false, getValue: (r) => `${r.shipName || ''} · ${r.otLabel || ''}` },
  {
    key: 'thirdPartyStatus',
    label: 'Respaldo Terceros',
    isNumeric: false,
    getValue: (r) => (r.hasThirdPartyMatch ? 'En Terceros' : 'Sin servicio en Terceros'),
  },
]

/**
 * Grilla dedicada a retiros de pañol realizados por talleres externos (can_impute_hours = false).
 * Cruza contra `third_party_services` para detectar si ya existe servicio cargado en Terceros.
 */
export default function CostControlThirdPartyTable({
  rows = [],
  totalCount = 0,
  ships = [],
  workOrders = [],
  workItems = [],
  searchQuery = '',
  hasActiveFilters = false,
  onClearAllFilters,
}) {
  const scrollContainerRef = useRef(null)
  const shipsById = useMemo(() => buildLookupMap(ships), [ships])
  const workOrdersById = useMemo(() => buildLookupMap(workOrders), [workOrders])

  const sheet = useSheetSelection({ rows, columns: THIRD_PARTY_COLUMNS, getRowId: (r) => r.id, sortable: true })
  const progressive = useProgressiveRows({
    items: sheet.sortedRows,
    resetKey: `${searchQuery}|${rows.length}`,
    scrollContainerRef,
    activeIndex: sheet.activeCell?.rowIndex ?? -1,
  })

  return (
    <div className="space-y-2.5">
      <div className="alon-zone-grid">
        <div className="alon-grid-ribbon">
          <div className="flex items-center gap-2">
            <Wrench className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
            <span className="font-black text-indigo-200 uppercase tracking-wider">
              Retiros de Talleres Externos ({rows.length})
            </span>
          </div>
          <span className="text-[10px] text-slate-400">
            Talleres que no cargan parte diario (<code>can_impute_hours = false</code>) · Cruzados contra Terceros
          </span>
        </div>

        <div ref={scrollContainerRef} tabIndex={0} onKeyDown={sheet.handleKeyDown} className="alon-grid-scroll">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="alon-grid-thead">
              <tr>
                {THIRD_PARTY_COLUMNS.map((col) => {
                  const hdr = sheet.getHeaderProps(col.key, 'px-3 py-2 whitespace-nowrap')
                  return (
                    <th key={col.key} {...hdr}>
                      {col.label}{sheet.getSortIndicator(col.key)}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {progressive.visibleItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    Sin retiros de pañol de talleres externos en esta quincena.
                  </td>
                </tr>
              ) : (
                progressive.visibleItems.map((row, rowIdx) => {
                  const dateCell = sheet.getCellProps(rowIdx, 'date')
                  const voucherCell = sheet.getCellProps(rowIdx, 'voucher')
                  const matCell = sheet.getCellProps(rowIdx, 'material')
                  const entCell = sheet.getCellProps(rowIdx, 'entity')
                  const shipOtCell = sheet.getCellProps(rowIdx, 'shipOt')
                  const statusCell = sheet.getCellProps(rowIdx, 'thirdPartyStatus')
                  const shipObj = row.shipId ? shipsById.get(row.shipId) : null
                  const woObj = row.workOrderId ? workOrdersById.get(row.workOrderId) : null

                  return (
                    <tr key={row.id} className="hover:bg-slate-900/55 transition-colors">
                      <td {...dateCell.domProps} className={`px-3 py-2 font-mono text-slate-200 whitespace-nowrap ${dateCell.className}`}>
                        <HighlightText text={row.dateAr} query={searchQuery} />
                      </td>
                      <td {...voucherCell.domProps} className={`px-3 py-2 font-mono text-slate-300 whitespace-nowrap ${voucherCell.className}`}>
                        <HighlightText text={row.voucherNumber} query={searchQuery} />
                      </td>
                      <td {...matCell.domProps} className={`px-3 py-2 min-w-[210px] ${matCell.className}`}>
                        <div className="font-semibold text-white">
                          <HighlightText text={row.materialName} query={searchQuery} />
                        </div>
                        <div className="text-[11px] font-mono text-cyan-300">
                          {row.quantity} {row.unitMeasure}
                        </div>
                      </td>
                      <td {...entCell.domProps} className={`px-3 py-2 font-bold text-indigo-200 whitespace-nowrap ${entCell.className}`}>
                        <HighlightText text={row.entity} query={searchQuery} />
                      </td>
                      <td {...shipOtCell.domProps} className={`px-3 py-2 min-w-[190px] ${shipOtCell.className}`}>
                        <div className="font-bold text-cyan-200 text-[11px] truncate">
                          <HighlightText text={row.shipName} query={searchQuery} />
                        </div>
                        <CanonicalOtBadge
                          wo={woObj}
                          ship={shipObj}
                          workItems={workItems}
                          workOrders={workOrders}
                          variant="inline"
                          searchQuery={searchQuery}
                        />
                      </td>
                      <td {...statusCell.domProps} className={`px-3 py-2 whitespace-nowrap ${statusCell.className}`}>
                        {row.hasThirdPartyMatch ? (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-500/50"
                            title="Existe servicio registrado en Terceros para este Barco, OT y Taller"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>✓ En Terceros</span>
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-950/90 text-amber-300 border border-amber-500/50"
                            title="Sin servicio cargado en Terceros para este Barco, OT y Taller"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>⚠ Sin servicio en Terceros</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
              <CanonicalProgressiveTableFooter
                visibleCount={progressive.visibleCount}
                totalCount={progressive.totalCount}
                hasMore={progressive.hasMore}
                remainingCount={progressive.remainingCount}
                loadMore={progressive.loadMore}
                showAll={progressive.showAll}
                sentinelRef={progressive.sentinelRef}
                colSpan={6}
                entityLabel="retiros de talleres externos"
              />
            </tbody>
          </table>
        </div>
      </div>

      <GridStatusBarBottom
        isFixed={false}
        filteredCount={rows.length}
        totalCount={totalCount}
        entityName="retiros de talleres"
        hasActiveFilter={hasActiveFilters}
        onClearFilters={onClearAllFilters}
        selectionStats={sheet.selectionStats}
        onClearSelection={sheet.clearSelection}
      />
    </div>
  )
}
