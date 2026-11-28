/**
 * TesoreriaContratadosBookTabs.jsx
 * Cinta inferior tipo Google Sheets con pestaña `RESUMEN` y solapas por Barco
 * (barcos abiertos visibles, saldados en $0 colapsables y `+ Barco`).
 */
import React, { useState } from 'react'
import { BarChart3, Ship, Plus, CheckCircle2, Eye, EyeOff, Wrench } from 'lucide-react'
import { GENERAL_SHIP_TAB_ID, RESUMEN_TAB_ID, formatLedgerMoney } from '../../../lib/contractorLedgerHelpers'

export default function TesoreriaContratadosBookTabs({
  shipTabs = [],
  activeTabId = RESUMEN_TAB_ID,
  onSelectTab,
  globalBalance = 0,
  currency = 'ARS',
  ships = [],
  canManageCc = false,
  onAddShipTab,
}) {
  const [showSettled, setShowSettled] = useState(false)
  const [addingShip, setAddingShip] = useState(false)

  const openTabs = shipTabs.filter((t) => !t.isSettled)
  const settledTabs = shipTabs.filter((t) => t.isSettled)
  const visibleShipTabs = showSettled ? [...openTabs, ...settledTabs] : openTabs
  const existingShipIds = new Set(shipTabs.map((t) => t.shipId).filter(Boolean))
  const availableShips = (ships || []).filter((s) => s?.id && !existingShipIds.has(s.id))

  const balColor = (bal) => (bal < -0.005 ? 'text-rose-300' : bal > 0.005 ? 'text-cyan-300' : 'text-emerald-300')

  return (
    <div className="px-3 py-2 rounded-xl bg-slate-900/95 border border-slate-800 flex flex-wrap items-center gap-1.5 text-xs">
      <button
        type="button"
        onClick={() => onSelectTab?.(RESUMEN_TAB_ID)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-black transition-all cursor-pointer ${
          activeTabId === RESUMEN_TAB_ID
            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 ring-1 ring-emerald-400/40'
            : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-emerald-500/50'
        }`}
      >
        <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
        <span>RESUMEN</span>
        <span className={`font-mono text-[11px] ${balColor(globalBalance)}`}>
          {formatLedgerMoney(globalBalance, currency)}
        </span>
      </button>

      {visibleShipTabs.map((tab) => {
        const isActive = activeTabId === tab.tabId
        const isGeneral = tab.tabId === GENERAL_SHIP_TAB_ID
        const Icon = isGeneral ? Wrench : tab.isSettled ? CheckCircle2 : Ship
        return (
          <button
            key={tab.tabId}
            type="button"
            onClick={() => onSelectTab?.(tab.tabId)}
            title={`${tab.label} · ${tab.rowCount} mov. · Saldo ${formatLedgerMoney(tab.balance, currency)}`}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-bold transition-all cursor-pointer ${
              isActive
                ? 'bg-amber-500/20 border-amber-400 text-amber-100 ring-1 ring-amber-400/40'
                : tab.isSettled
                ? 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-emerald-500/40'
                : 'bg-slate-950 border-slate-700 text-slate-200 hover:border-amber-500/50'
            }`}
          >
            <Icon className={`w-3 h-3 shrink-0 ${tab.isSettled ? 'text-emerald-400' : isGeneral ? 'text-slate-400' : 'text-cyan-400'}`} />
            <span className="truncate max-w-[150px]">{tab.label}</span>
            <span className={`font-mono text-[10px] ${balColor(tab.balance)}`}>
              {formatLedgerMoney(tab.balance, currency)}
            </span>
          </button>
        )
      })}

      {settledTabs.length > 0 && (
        <button
          type="button"
          onClick={() => setShowSettled((prev) => !prev)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 hover:border-emerald-500/50 text-emerald-300 font-bold text-[11px] cursor-pointer"
          title="Mostrar u ocultar pestañas de barcos ya saldados en $0,00"
        >
          {showSettled ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          <span>Saldados $0 ({settledTabs.length})</span>
        </button>
      )}

      {canManageCc && availableShips.length > 0 && (
        addingShip ? (
          <select
            autoFocus
            defaultValue=""
            onBlur={() => setAddingShip(false)}
            onChange={(e) => {
              const sid = e.target.value
              setAddingShip(false)
              if (sid) onAddShipTab?.(sid)
            }}
            className="bg-slate-950 border border-cyan-500/60 rounded-lg px-2 py-1 text-xs font-bold text-cyan-200 focus:outline-none cursor-pointer"
          >
            <option value="">Elegir barco...</option>
            {availableShips.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        ) : (
          <button
            type="button"
            onClick={() => setAddingShip(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/70 border border-cyan-500/40 text-cyan-200 font-bold text-[11px] cursor-pointer"
            title="Abrir una pestaña nueva para otro barco de este contratista"
          >
            <Plus className="w-3 h-3" />
            <span>+ Barco</span>
          </button>
        )
      )}
    </div>
  )
}
