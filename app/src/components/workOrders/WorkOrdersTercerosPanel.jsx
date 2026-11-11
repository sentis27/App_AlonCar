import { Link } from 'react-router-dom'
import { ShieldCheck, Plus, ExternalLink, Pencil } from 'lucide-react'
import HighlightText from '../HighlightText'
import { formatShortDate } from '../../lib/workOrdersConstants'
import { matchesUniversalSearch } from '../../lib/searchEngine'

export default function WorkOrdersTercerosPanel({
  thirdPartyServices = [],
  workOrders = [],
  searchQuery = '',
  onOpenTpCascadeModal,
  setEditingThirdParty
}) {
  const filteredTps = thirdPartyServices.filter((tp) => {
    if (!searchQuery.trim()) return true
    const wo = workOrders.find((w) => w.id === tp.work_order_id)
    return matchesUniversalSearch(
      {
        ...tp,
        shipName: wo?.ships?.name,
        otNumber: wo?.ot_number,
        otTitle: wo?.title
      },
      searchQuery
    )
  })

  return (
    <div className="alon-zone-grid rounded-2xl p-5 shadow-xl space-y-4 font-sans">
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
          <Link
            to="/terceros"
            className="px-3.5 py-2 bg-gradient-to-r from-primary to-blue-500 hover:brightness-110 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-500/20 shrink-0"
          >
            <ExternalLink className="w-4 h-4 stroke-[2.5]" />
            <span>Abrir Módulo Completo de Terceros ↗</span>
          </Link>
          <button
            type="button"
            onClick={onOpenTpCascadeModal}
            className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-lg shadow-purple-600/20 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>+ Carga Rápida</span>
          </button>
        </div>
      </div>

      <div className="alon-grid-scroll border border-slate-800 rounded-xl">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="sticky top-0 z-20 bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800 shadow-sm backdrop-blur-md">
            <tr>
              <th className="py-3 px-3 bg-slate-950">Fecha</th>
              <th className="py-3 px-3 bg-slate-950">Barco & OT</th>
              <th className="py-3 px-3 bg-slate-950">Proveedor / Contratista [3ros]</th>
              <th className="py-3 px-3 text-center bg-slate-950">Estado / Comprobante</th>
              <th className="py-3 px-3 text-right bg-slate-950">Importe AR$</th>
              <th className="py-3 px-3 min-w-[220px] text-cyan-300 bg-slate-950">Observaciones Directas (Desde OT)</th>
              <th className="py-3 px-3 min-w-[220px] text-purple-300 bg-slate-950">Observaciones Específicas (Módulo Terceros)</th>
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
              filteredTps.map((tp) => {
                const wo = workOrders.find((w) => w.id === tp.work_order_id)
                const tpDate = tp.service_date || (tp.created_at ? String(tp.created_at).split('T')[0] : null)
                return (
                  <tr key={tp.id} className="hover:bg-slate-800/30 transition-colors align-top">
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-300">
                      {formatShortDate(tpDate, true)}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-white block">
                        <HighlightText text={wo?.ships?.name || 'Barco'} query={searchQuery} />
                      </span>
                      <span className="font-mono text-[11px] text-primary font-bold">
                        <HighlightText text={wo?.ot_number} query={searchQuery} /> &bull; <HighlightText text={wo?.title} query={searchQuery} />
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono font-extrabold text-purple-300 px-2 py-0.5 rounded bg-purple-950 border border-purple-700">
                        <HighlightText text={tp.contractor_name} query={searchQuery} />
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700 font-mono font-bold text-[10px]">
                        {tp.status || 'PRC'} {tp.voucher_number ? `#${tp.voucher_number}` : ''}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                      ${Number(tp.amount_ars || 0).toLocaleString('es-AR')}
                    </td>
                    <td className="py-3 px-3">
                      <div className="p-2 rounded-lg bg-slate-950 border border-cyan-900/50 text-slate-200 whitespace-pre-wrap text-[11px]">
                        <HighlightText text={tp.direct_observations || '-'} query={searchQuery} />
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="p-2 rounded-lg bg-slate-950 border border-purple-900/50 text-purple-200 whitespace-pre-wrap text-[11px]">
                        {tp.specific_observations ? (
                          <HighlightText text={tp.specific_observations} query={searchQuery} />
                        ) : (
                          <span className="text-slate-500 italic">Sin observaciones específicas cargadas</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => setEditingThirdParty(tp)}
                        className="px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-bold cursor-pointer inline-flex items-center gap-1"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Editar Obs. Específica</span>
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
