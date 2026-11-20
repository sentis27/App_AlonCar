import React, { useMemo, useState } from 'react'
import { Ship, Plus, Search, ChevronLeft, ChevronRight, CheckCircle2, RotateCcw } from 'lucide-react'
import { formatUsd } from '../../lib/drydockCatalogConstants'

/**
 * Columna 1 (Izquierda) — Menú Lateral Multi-Barco Independiente (`🚢 EN FACTURACIÓN`).
 * Muestra únicamente los barcos que el Gerente abrió explícitamente con `[+ Sumar Barco]`
 * (`billing_workspace_status === 'EN_PREPARACION'`), con pestaña secundaria para ver
 * los ya enviados a cobro (`ENVIADO_A_FACTURACION`).
 */
export default function BillingShipSidebarRail({
  ships = [],
  activeShipId,
  shipCardMetaMap = {},
  onSelectShip,
  onAddShipToWorkspace,
  onReopenShipFromSent
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [listMode, setListMode] = useState('EN_PREPARACION') // 'EN_PREPARACION' | 'ENVIADO_A_FACTURACION'
  const [search, setSearch] = useState('')
  const [showAddPicker, setShowAddPicker] = useState(false)
  const [addShipId, setAddShipId] = useState('')

  const nonAstilleroShips = useMemo(
    () => (ships || []).filter((s) => String(s.name || '').trim().toUpperCase() !== 'ASTILLERO'),
    [ships]
  )

  const inPrepShips = useMemo(
    () => nonAstilleroShips
      .filter((s) => s.billing_workspace_status === 'EN_PREPARACION')
      .sort((a, b) => String(b.billing_opened_at || '').localeCompare(String(a.billing_opened_at || ''))),
    [nonAstilleroShips]
  )

  const sentShips = useMemo(
    () => nonAstilleroShips
      .filter((s) => s.billing_workspace_status === 'ENVIADO_A_FACTURACION')
      .sort((a, b) => String(b.billing_sent_at || '').localeCompare(String(a.billing_sent_at || ''))),
    [nonAstilleroShips]
  )

  const availableToAdd = useMemo(
    () => nonAstilleroShips
      .filter((s) => s.billing_workspace_status !== 'EN_PREPARACION')
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
    [nonAstilleroShips]
  )

  const visibleList = useMemo(() => {
    const base = listMode === 'EN_PREPARACION' ? inPrepShips : sentShips
    const q = search.trim().toLowerCase()
    if (!q) return base
    return base.filter((s) => `${s.name || ''} ${s.client_name || ''}`.toLowerCase().includes(q))
  }, [listMode, inPrepShips, sentShips, search])

  const handleConfirmAdd = async () => {
    const target = availableToAdd.find((s) => s.id === addShipId) || availableToAdd[0]
    if (!target) return
    await onAddShipToWorkspace?.(target)
    setShowAddPicker(false)
    setAddShipId('')
    setListMode('EN_PREPARACION')
  }

  if (collapsed) {
    return (
      <div className="w-11 shrink-0 bg-slate-950 border border-slate-800 rounded-xl flex flex-col items-center py-3 gap-3">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 cursor-pointer"
          title="Expandir menú de Barcos en Facturación"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="flex flex-col items-center gap-1.5">
          <Ship className="w-4 h-4 text-emerald-400" />
          <span className="text-[10px] font-black text-emerald-300">{inPrepShips.length}</span>
        </div>
      </div>
    )
  }

  return (
    <aside className="w-full lg:w-56 xl:w-60 shrink-0 bg-slate-950 border border-slate-800/90 rounded-xl flex flex-col overflow-hidden">
      <div className="px-3 py-2.5 bg-slate-900/90 border-b border-slate-800 space-y-2">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <Ship className="w-4 h-4 text-emerald-400 shrink-0" />
            <h3 className="text-[11px] font-black uppercase tracking-wider text-white truncate">
              En Facturación ({inPrepShips.length})
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            title="Contraer menú lateral"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px] font-bold">
          <button
            type="button"
            onClick={() => setListMode('EN_PREPARACION')}
            className={`py-1 rounded-md cursor-pointer transition-colors ${
              listMode === 'EN_PREPARACION' ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Activos ({inPrepShips.length})
          </button>
          <button
            type="button"
            onClick={() => setListMode('ENVIADO_A_FACTURACION')}
            className={`py-1 rounded-md cursor-pointer transition-colors ${
              listMode === 'ENVIADO_A_FACTURACION' ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Listos ({sentShips.length})
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar barco..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-6 pr-2 py-1 text-[11px] text-white focus:border-emerald-400 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setAddShipId(availableToAdd[0]?.id || '')
              setShowAddPicker((v) => !v)
            }}
            className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black inline-flex items-center gap-1 cursor-pointer shrink-0"
            title="Sumar un barco a tu mesa de facturación en simultáneo"
          >
            <Plus className="w-3 h-3" />
            <span>Sumar</span>
          </button>
        </div>

        {showAddPicker && (
          <div className="p-2 rounded-lg bg-slate-900 border border-emerald-500/50 space-y-1.5">
            <label className="text-[10px] font-bold text-emerald-300 block">Elegir barco para abrir hoja:</label>
            <select
              value={addShipId}
              onChange={(e) => setAddShipId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] text-white focus:outline-none"
            >
              {availableToAdd.length === 0 ? (
                <option value="">Todos los barcos ya están abiertos</option>
              ) : (
                availableToAdd.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.billing_workspace_status === 'ENVIADO_A_FACTURACION' ? ' (Enviado)' : ''}
                  </option>
                ))
              )}
            </select>
            <div className="flex justify-end gap-1">
              <button type="button" onClick={() => setShowAddPicker(false)} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] cursor-pointer">
                Cancelar
              </button>
              <button
                type="button"
                disabled={availableToAdd.length === 0}
                onClick={handleConfirmAdd}
                className="px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-[10px] font-bold cursor-pointer"
              >
                Abrir Hoja
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 max-h-[calc(100vh-280px)]">
        {visibleList.length === 0 ? (
          <div className="p-4 text-center text-[11px] text-slate-500 border border-dashed border-slate-800 rounded-lg">
            {listMode === 'EN_PREPARACION'
              ? 'No hay barcos abiertos en mesa. Tocá "+ Sumar" para comenzar.'
              : 'Todavía no enviaste barcos a la bandeja de cobro.'}
          </div>
        ) : (
          visibleList.map((ship) => {
            const isActive = ship.id === activeShipId
            const meta = shipCardMetaMap[ship.id] || { totalUsd: 0, otCount: 0, hasAlerts: false }
            const displayUsd = listMode === 'ENVIADO_A_FACTURACION' && ship.billing_total_snapshot_usd != null
              ? Number(ship.billing_total_snapshot_usd)
              : meta.totalUsd

            return (
              <div
                key={ship.id}
                onClick={() => onSelectShip?.(ship.id)}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                  isActive
                    ? 'bg-emerald-950/60 border-emerald-400 shadow-md shadow-emerald-950/50 ring-1 ring-emerald-400/50'
                    : 'bg-slate-900/75 border-slate-800 hover:border-slate-600 hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isActive ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/50' : 'bg-slate-800 text-slate-300'
                    }`}>
                      <Ship className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className={`text-xs font-black uppercase truncate ${isActive ? 'text-emerald-200' : 'text-white'}`}>
                        {ship.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">
                        {formatUsd(displayUsd, 0)} · {meta.otCount} OT{meta.otCount === 1 ? '' : 's'}
                      </div>
                    </div>
                  </div>
                  {meta.hasAlerts && listMode === 'EN_PREPARACION' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0 mt-1" title="Tiene alertas de ítems sin valorizar o descripciones vacías" />
                  )}
                  {listMode === 'ENVIADO_A_FACTURACION' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" title="Enviado a Facturación" />
                  )}
                </div>

                {listMode === 'ENVIADO_A_FACTURACION' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onReopenShipFromSent?.(ship)
                    }}
                    className="mt-2 w-full py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Volver a Preparación</span>
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>

      <div className="px-3 py-2 border-t border-slate-800 bg-slate-950 text-[10px] text-slate-500 text-center">
        1 clic para saltar entre barcos en simultáneo
      </div>
    </aside>
  )
}
