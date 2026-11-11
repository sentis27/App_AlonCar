/**
 * TercerosFichasPanel.jsx
 * Vista de Tarjetas y Fichas 360° para Terceros y Contratistas (M5 / DEC-017).
 */

import React from 'react'
import {
  Ship,
  Sparkles,
  History,
  Edit3,
  Trash2
} from 'lucide-react'
import { VOUCHER_TYPES, formatDate } from '../../lib/tercerosConstants.js'

export default function TercerosFichasPanel({
  filteredServices = [],
  shipMap = new Map(),
  otMap = new Map(),
  contractorMap = new Map(),
  selectedIds = new Set(),
  handleRowClick,
  handleCheckboxToggle,
  handleClearSelection,
  canEditAmounts = false,
  activeRolePerspective = 'maria_jose',
  handleOpenEvolutionModal,
  setHistoryService,
  handleOpenEditModal,
  handleDeleteService,
  stats
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredServices.map((srv, index) => {
          const shipName = shipMap.get(srv.ship_id)?.name || 'Sin Buque'
          const ot = otMap.get(srv.work_order_id)
          const voucherConfig = VOUCHER_TYPES.find((v) => v.code === srv.voucher_type) || VOUCHER_TYPES[0]
          const isEvolvable = srv.voucher_type === 'RMO' || srv.voucher_type === 'RPF'
          const contractorObj = contractorMap.get(srv.contractor_name?.toUpperCase()?.trim())
          const effectiveTrade = srv.trade || (contractorObj?.trade && contractorObj.trade !== 'MANUAL' ? contractorObj.trade : null)
          const isSelected = selectedIds.has(srv.id)

          return (
            <div
              key={srv.id}
              onClick={(e) => handleRowClick(srv.id, index, e)}
              className={`border rounded-2xl p-5 space-y-4 flex flex-col justify-between shadow-lg transition-all cursor-pointer select-none ${
                isSelected
                  ? 'border-cyan-400 bg-cyan-950/40 ring-1 ring-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.2)]'
                  : srv.voucher_type === 'RPF'
                  ? 'border-amber-500/40 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20'
                  : 'border-slate-800 bg-slate-900/90 hover:border-slate-700'
              }`}
            >
              {/* Header de la tarjeta */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleCheckboxToggle(srv.id, index, e)}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500/30 cursor-pointer"
                    />
                    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${voucherConfig.color}`}>
                      {srv.voucher_type} - {voucherConfig.label.split(' - ')[1] || srv.voucher_type}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    {formatDate(srv.service_date || srv.entry_date)}
                  </span>
                </div>

                <div>
                  <h3 className="font-extrabold text-base text-white tracking-wide uppercase truncate" title={srv.contractor_name}>
                    {srv.contractor_name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {effectiveTrade ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium font-mono">
                        {effectiveTrade}
                      </span>
                    ) : (
                      <span className="text-[10px] text-rose-400 font-semibold">⚠️ Sin Rubro</span>
                    )}
                  </div>
                </div>

                {/* Números de Comprobantes Asociados */}
                <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800/80 space-y-1 font-mono text-xs">
                  {/* Factura Fiscal FCR / FCA */}
                  {(srv.invoice_number || (['FCR', 'FCA', 'FAC', 'REC', 'FCB', 'FCC'].includes(srv.voucher_type) && srv.voucher_number)) && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-emerald-400 font-bold">FACTURA:</span>
                      <span className="text-emerald-300 font-bold">{srv.invoice_number || srv.voucher_number}</span>
                    </div>
                  )}

                  {/* Presupuesto Interno PRC */}
                  {(srv.budget_number || (srv.voucher_type === 'PRC' && srv.voucher_number)) && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-amber-400 font-bold">PRESUPUESTO:</span>
                      <span className="text-amber-300 font-bold">{srv.budget_number || srv.voucher_number}</span>
                    </div>
                  )}

                  {/* Remito Aloncar */}
                  {srv.internal_remito_number && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-cyan-400 font-bold">REMITO ALONCAR:</span>
                      <span className="text-cyan-300 font-bold">#{srv.internal_remito_number}</span>
                    </div>
                  )}

                  {/* Remito Proveedor */}
                  {(srv.supplier_remito_number || (['RMO', 'RPF'].includes(srv.voucher_type) && srv.voucher_number)) && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-purple-400 font-bold">REMITO PROV:</span>
                      <span className="text-purple-300 font-bold">{srv.supplier_remito_number || srv.voucher_number}</span>
                    </div>
                  )}

                  {!srv.invoice_number && !srv.budget_number && !srv.internal_remito_number && !srv.supplier_remito_number && !srv.voucher_number && (
                    <span className="text-slate-600 italic text-[11px] block text-center font-sans">Sin comprobante numerado</span>
                  )}
                </div>
              </div>

              {/* Buque y OT */}
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <Ship className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>{shipName}</span>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                  {ot ? (
                    <>
                      <span className="font-mono text-cyan-300 font-bold bg-cyan-950/80 px-1 rounded border border-cyan-800/60">
                        {ot.ot_number}
                      </span>
                      <span className="truncate text-slate-300 text-[11px]">{ot.title}</span>
                    </>
                  ) : (
                    <span className="text-amber-400 text-xs">⚠️ Sin Orden de Trabajo asignada</span>
                  )}
                </div>
              </div>

              {/* Observaciones Directas y Específicas */}
              {(srv.direct_observations || srv.specific_observations) && (
                <div className="space-y-1 text-xs text-slate-400">
                  {srv.direct_observations && (
                    <div className="line-clamp-2" title={srv.direct_observations}>
                      <span className="font-semibold text-slate-300">Tarea:</span> {srv.direct_observations}
                    </div>
                  )}
                  {srv.specific_observations && (
                    <div className="line-clamp-2 text-slate-500 italic" title={srv.specific_observations}>
                      <span className="font-semibold text-slate-400 font-sans not-italic">Obs:</span> {srv.specific_observations}
                    </div>
                  )}
                </div>
              )}

              {/* Importe y Cotización */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Importe AR$</span>
                  <span className="font-mono font-bold text-slate-200 text-sm">
                    ${Number(srv.amount_ars).toLocaleString('es-AR')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-cyan-400 uppercase font-bold block">Costo Total US$</span>
                  <span className="font-mono font-extrabold text-cyan-300 text-lg">
                    ${Number(srv.amount_usd || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Footer de Tarjeta con Acciones */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <span className="text-[10px] text-slate-500 font-mono">
                  Cotiz: ${Number(srv.usd_rate || 0).toLocaleString('es-AR')}
                </span>

                <div className="flex items-center gap-1">
                  {isEvolvable && activeRolePerspective !== 'direccion' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenEvolutionModal(srv)
                      }}
                      className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500 hover:text-slate-950 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                      title="Evolucionar a Factura oficial (FCR)"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>⚡ Factura</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setHistoryService(srv)
                    }}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    title="Ver trazabilidad"
                  >
                    <History className="w-4 h-4" />
                  </button>

                  {activeRolePerspective !== 'direccion' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenEditModal(srv)
                      }}
                      className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Editar"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}

                  {canEditAmounts && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteService(srv)
                      }}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* BARRA DE TOTALES Y ESTADÍSTICAS REACTIVA (MODO FICHAS) */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xl">
        <div className="flex items-center gap-3">
          {stats?.isCustomSelection ? (
            <div className="flex items-center gap-2 bg-cyan-950/80 border border-cyan-500/60 px-2.5 py-1 rounded-lg text-cyan-300 font-bold">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
              <span>📌 Selección Manual: {stats.count} de {stats.totalVisible} fichas</span>
              <button
                type="button"
                onClick={handleClearSelection}
                className="ml-1 text-cyan-400 hover:text-white transition-colors cursor-pointer text-xs underline"
              >
                ✕ Limpiar
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 px-2.5 py-1 rounded-lg text-slate-300 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>🌐 Todo el filtro: {stats?.count || 0} fichas</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 sm:gap-6 font-mono">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-400">Σ AR$:</span>
            <span className="text-sm font-extrabold text-white">
              ${(stats?.sumArs || 0).toLocaleString('es-AR')}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] uppercase font-bold text-cyan-400">Σ US$:</span>
            <span className="text-sm font-extrabold text-cyan-300">
              ${(stats?.sumUsd || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 hidden md:flex">
            <span className="text-[10px] uppercase font-bold text-slate-400">Ø AR$:</span>
            <span className="text-xs font-semibold text-slate-300">
              ${(stats?.avgArs || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 hidden md:flex">
            <span className="text-[10px] uppercase font-bold text-cyan-400">Ø US$:</span>
            <span className="text-xs font-semibold text-cyan-200">
              ${(stats?.avgUsd || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
