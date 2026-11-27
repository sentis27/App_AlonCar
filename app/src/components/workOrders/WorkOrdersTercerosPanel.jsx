import { useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, Plus, ExternalLink, Pencil } from 'lucide-react'
import HighlightText from '../HighlightText'
import GridStatusBarBottom from '../GridStatusBarBottom'
import CanonicalProgressiveTableFooter from '../canonical/CanonicalProgressiveTableFooter'
import CanonicalPrcBadge from '../canonical/CanonicalPrcBadge'
import { resolvePrcForThirdPartyService } from '../../lib/prcRegistryRules'
import { useProgressiveRows } from '../../hooks/useProgressiveRows'
import { useSheetSelection } from '../../hooks/grid/useSheetSelection'
import { buildLookupMap, formatArsCached } from '../../lib/gridPerformanceHelpers'
import { buildWorkOrdersTercerosSheetColumns } from '../../lib/sheetColumnsOperational'
import { formatShortDate } from '../../lib/workOrdersConstants'
import { matchesUniversalSearch } from '../../lib/searchEngine'

export default function WorkOrdersTercerosPanel({
  thirdPartyServices = [], workOrders = [], searchQuery = '', onOpenTpCascadeModal, setEditingThirdParty, prcMaps = null
}) {
  const scrollRef = useRef(null)
  const workOrdersById = useMemo(() => buildLookupMap(workOrders), [workOrders])

  const filteredTps = useMemo(() => thirdPartyServices.filter((tp) => {
    if (!searchQuery.trim()) return true
    const wo = tp.work_order_id ? workOrdersById.get(String(tp.work_order_id)) : null
    return matchesUniversalSearch({ ...tp, shipName: wo?.ships?.name, otNumber: wo?.ot_number, otTitle: wo?.title }, searchQuery)
  }), [thirdPartyServices, workOrdersById, searchQuery])

  const columns = useMemo(() => buildWorkOrdersTercerosSheetColumns(workOrdersById), [workOrdersById])
  const sheet = useSheetSelection({ rows: filteredTps, columns, getRowId: (r) => r.id, sortable: true })
  const totalArs = useMemo(() => filteredTps.reduce((s, tp) => s + (Number(tp.amount_ars) || 0), 0), [filteredTps])

  const { visibleItems: visibleTps, visibleCount, hasMore, remainingCount, loadMore, showAll, sentinelRef } = useProgressiveRows({
    items: sheet.sortedRows, scrollContainerRef: scrollRef, resetKey: searchQuery
  })

  return (
    <div ref={sheet.containerRef} tabIndex={0} onKeyDown={sheet.handleKeyDown} className="alon-zone-grid rounded-2xl p-5 shadow-xl space-y-4 font-sans focus:outline-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-base font-black text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-400" />
            Registros en Terceros Generados desde Órdenes de Trabajo (Estado PRC)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Cada registro recibe las <strong>Observaciones Directas</strong> desde la Descripción del trabajo en la OT y admite <strong>Observaciones Específicas</strong> propias del módulo de Terceros.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/terceros" className="px-3.5 py-2 bg-gradient-to-r from-primary to-blue-500 hover:brightness-110 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-500/20 shrink-0">
            <ExternalLink className="w-4 h-4 stroke-[2.5]" />
            <span>Abrir Módulo Completo de Terceros ↗</span>
          </Link>
          <button type="button" onClick={onOpenTpCascadeModal} className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-lg shadow-purple-600/20 shrink-0">
            <Plus className="w-4 h-4" />
            <span>+ Carga Rápida</span>
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="alon-grid-scroll border border-slate-800 rounded-xl">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="sticky top-0 z-20 bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800 shadow-sm backdrop-blur-md">
            <tr>
              <th {...sheet.getHeaderProps('service_date', 'py-3 px-3 bg-slate-950')}>Fecha{sheet.getSortIndicator('service_date')}</th>
              <th {...sheet.getHeaderProps('ship_wo', 'py-3 px-3 bg-slate-950')}>Barco & OT{sheet.getSortIndicator('ship_wo')}</th>
              <th {...sheet.getHeaderProps('contractor_name', 'py-3 px-3 bg-slate-950')}>Proveedor / Contratista [3ros]{sheet.getSortIndicator('contractor_name')}</th>
              <th {...sheet.getHeaderProps('status', 'py-3 px-3 text-center bg-slate-950')}>Estado / Comprobante{sheet.getSortIndicator('status')}</th>
              <th {...sheet.getHeaderProps('amount_ars', 'py-3 px-3 text-right bg-slate-950')}>Importe AR${sheet.getSortIndicator('amount_ars')}</th>
              <th {...sheet.getHeaderProps('direct_observations', 'py-3 px-3 min-w-[220px] text-cyan-300 bg-slate-950')}>Observaciones Directas (Desde OT){sheet.getSortIndicator('direct_observations')}</th>
              <th {...sheet.getHeaderProps('specific_observations', 'py-3 px-3 min-w-[220px] text-purple-300 bg-slate-950')}>Observaciones Específicas (Módulo Terceros){sheet.getSortIndicator('specific_observations')}</th>
              <th className="py-3 px-3 text-right bg-slate-950">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium">
            {filteredTps.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-slate-500">
                  Aún no hay registros PRC generados en Terceros. Al crear un trabajo con un único contratista que tenga el permiso <strong>3ros</strong> activo, podrás activar la carga automática a Terceros.
                </td>
              </tr>
            ) : (
              <>
              {visibleTps.map((tp, rowIdx) => {
                const wo = tp.work_order_id ? workOrdersById.get(String(tp.work_order_id)) : null
                const tpDate = tp.service_date || (tp.created_at ? String(tp.created_at).split('T')[0] : null)
                const cpDate = sheet.getCellProps(rowIdx, 'service_date'), cpShip = sheet.getCellProps(rowIdx, 'ship_wo'), cpCont = sheet.getCellProps(rowIdx, 'contractor_name'), cpSt = sheet.getCellProps(rowIdx, 'status'), cpArs = sheet.getCellProps(rowIdx, 'amount_ars'), cpDir = sheet.getCellProps(rowIdx, 'direct_observations'), cpSpec = sheet.getCellProps(rowIdx, 'specific_observations')
                return (
                  <tr key={tp.id} className="hover:bg-slate-800/30 transition-colors align-top">
                    <td {...cpDate.domProps} className={`py-3 px-3 font-mono text-[11px] text-slate-300 ${cpDate.className}`}>{formatShortDate(tpDate, true)}</td>
                    <td {...cpShip.domProps} className={`py-3 px-3 ${cpShip.className}`}>
                      <span className="font-bold text-white block"><HighlightText text={wo?.ships?.name || 'Barco'} query={searchQuery} /></span>
                      <span className="font-mono text-[11px] text-primary font-bold"><HighlightText text={wo?.ot_number} query={searchQuery} /> &bull; <HighlightText text={wo?.title} query={searchQuery} /></span>
                    </td>
                    <td {...cpCont.domProps} className={`py-3 px-3 ${cpCont.className}`}>
                      <span className="font-mono font-extrabold text-purple-300 px-2 py-0.5 rounded bg-purple-950 border border-purple-700"><HighlightText text={tp.contractor_name} query={searchQuery} /></span>
                    </td>
                    <td {...cpSt.domProps} className={`py-3 px-3 text-center ${cpSt.className}`}>
                      {(() => {
                        const prcInfo = resolvePrcForThirdPartyService(tp, prcMaps)
                        if (prcInfo.hasOfficialPrc || tp.status === 'PRC' || tp.voucher_type === 'PRC') {
                          return (
                            <CanonicalPrcBadge
                              prc={prcInfo.prc}
                              additionals={prcInfo.additionals}
                              legacyNumber={tp.budget_number || tp.voucher_number || 'S/N'}
                              variant="pill"
                              searchQuery={searchQuery}
                            />
                          )
                        }
                        return (
                          <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700 font-mono font-bold text-[10px]">
                            {tp.status || 'PRC'} {tp.voucher_number ? `#${tp.voucher_number}` : ''}
                          </span>
                        )
                      })()}
                    </td>
                    <td {...cpArs.domProps} className={`py-3 px-3 text-right font-mono font-bold text-emerald-400 ${cpArs.className}`}>${formatArsCached(tp.amount_ars || 0)}</td>
                    <td {...cpDir.domProps} className={`py-3 px-3 ${cpDir.className}`}>
                      <div className="p-2 rounded-lg bg-slate-950 border border-cyan-900/50 text-slate-200 whitespace-pre-wrap text-[11px]"><HighlightText text={tp.direct_observations || '-'} query={searchQuery} /></div>
                    </td>
                    <td {...cpSpec.domProps} className={`py-3 px-3 ${cpSpec.className}`}>
                      <div className="p-2 rounded-lg bg-slate-950 border border-purple-900/50 text-purple-200 whitespace-pre-wrap text-[11px]">
                        {tp.specific_observations ? <HighlightText text={tp.specific_observations} query={searchQuery} /> : <span className="text-slate-500 italic">Sin observaciones específicas cargadas</span>}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button type="button" onClick={() => setEditingThirdParty(tp)} className="px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-bold cursor-pointer inline-flex items-center gap-1">
                        <Pencil className="w-3 h-3" />
                        <span>Editar Obs. Específica</span>
                      </button>
                    </td>
                  </tr>
                )
              })}
              <CanonicalProgressiveTableFooter visibleCount={visibleCount} totalCount={filteredTps.length} hasMore={hasMore} remainingCount={remainingCount} loadMore={loadMore} showAll={showAll} sentinelRef={sentinelRef} colSpan={8} entityLabel="registros" />
              </>
            )}
          </tbody>
        </table>
      </div>

      <GridStatusBarBottom
        isFixed={false} filteredCount={filteredTps.length} totalCount={thirdPartyServices.length} entityName="comprobantes"
        selectionStats={sheet.selectionStats} onClearSelection={sheet.clearSelection}
        globalAggregates={[{ label: 'Σ AR$', value: `AR$ ${totalArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, highlight: true }]}
      />
    </div>
  )
}
