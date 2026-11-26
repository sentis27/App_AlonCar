/**
 * TercerosCcHeaderAndKpis.jsx
 * Zona 1 (Contexto + Selector de Cuenta + Acciones) y Zona 2 (Radar KPIs 5 tarjetas)
 * para el submódulo de Cuentas Corrientes de Talleres.
 */
import React from 'react'
import { Wallet, Plus, SlidersHorizontal, Download, FilePlus2, Lock } from 'lucide-react'
import CanonicalActiveSubmoduleBadge from '../../canonical/CanonicalActiveSubmoduleBadge'

const fmtUsd = (val) => `US$ ${Number(val || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtKg = (val) => `${Number(val || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`

export default function TercerosCcHeaderAndKpis({
  activeSubmodule = null,
  accounts = [],
  selectedAccount = null,
  onSelectAccount,
  totals = {},
  statusFilter = 'todos',
  setStatusFilter,
  canManageCc = false,
  onOpenNewAccount,
  onOpenRateHistory,
  onOpenNewManualEntry,
  onOpenNewPayment,
  onExportCsv,
}) {
  const isPerKg = selectedAccount?.pricing_mode !== 'BY_VOUCHER'
  const balance = Number(totals.balanceUsd || 0)
  const balanceNegative = balance < 0
  const balanceFormatted = `${balanceNegative ? '-' : ''}${fmtUsd(Math.abs(balance))}`

  return (
    <>
      {/* ZONA 1: CONTEXTO Y ACCIONES PRINCIPALES */}
      <div className="alon-zone-context p-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950 shrink-0">
              <Wallet className="w-5 h-5 stroke-[2.4]" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-white tracking-wide">
                  CUENTAS CORRIENTES DE TALLERES
                </h1>
                <CanonicalActiveSubmoduleBadge
                  label={activeSubmodule?.shortLabel || 'Cuentas Corrientes'}
                  theme={activeSubmodule?.theme || 'emerald'}
                />
                {!canManageCc && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-700 font-mono">
                    <Lock className="w-3 h-3" /> Solo lectura
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cuenta:</label>
                <select
                  value={selectedAccount?.id || ''}
                  onChange={(e) => onSelectAccount?.(e.target.value)}
                  className="bg-slate-950 border border-emerald-500/50 rounded-lg px-2.5 py-1 text-xs font-bold text-emerald-200 focus:outline-none focus:border-emerald-400"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {(acc.legal_name || acc.operational_name)} · {acc.operational_name} ({acc.pricing_mode === 'BY_VOUCHER' ? 'Comprobantes' : 'Por Kilo'})
                    </option>
                  ))}
                </select>
                {selectedAccount && (
                  <span className="text-[11px] text-slate-400">
                    Modo: <strong className="text-cyan-300">{isPerKg ? 'Absorbe kilos de Pañol (MATERIALES)' : 'Absorbe comprobantes de Terceros'}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {canManageCc && (
              <>
                <button
                  type="button"
                  onClick={onOpenNewAccount}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  title="Crear una nueva carpeta de Cuenta Corriente para otro taller"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Nueva Cuenta</span>
                </button>
                {isPerKg && selectedAccount && (
                  <button
                    type="button"
                    onClick={onOpenRateHistory}
                    className="flex items-center gap-1.5 px-3 py-2 bg-sky-950/80 hover:bg-sky-900 text-sky-200 border border-sky-500/50 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    title="Ver o actualizar el tarifario US$/kg con historial inmutable"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Tarifas US$/kg</span>
                  </button>
                )}
                {selectedAccount && (
                  <button
                    type="button"
                    onClick={onOpenNewManualEntry}
                    className="flex items-center gap-1.5 px-3 py-2 bg-amber-950/80 hover:bg-amber-900 text-amber-200 border border-amber-500/50 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    title="Agregar ajuste o trabajo manual en el DEBE"
                  >
                    <FilePlus2 className="w-3.5 h-3.5" />
                    <span>Ajuste DEBE</span>
                  </button>
                )}
                {selectedAccount && (
                  <button
                    type="button"
                    onClick={onOpenNewPayment}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>Registrar Pago / Canje</span>
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              onClick={onExportCsv}
              disabled={!selectedAccount}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-cyan-200 border border-cyan-500/40 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-40"
              title="Exportar estado de cuenta DEBE y HABER a CSV/Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* ZONA 2: RADAR DE KPIS Y ALERTAS OPERATIVAS */}
      <div className="alon-zone-kpis p-3.5 space-y-2.5">
        <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-amber-300/90">
          <span>📊 RADAR DE KPIS Y ALERTAS OPERATIVAS • Clic en cualquier tarjeta para alternar vista</span>
          {Number(totals.openingBalanceUsd || 0) !== 0 && (
            <span className="font-mono text-slate-300">Saldo inicial: {fmtUsd(totals.openingBalanceUsd)}</span>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'special' ? 'todos' : 'special')}
            className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
              statusFilter === 'special'
                ? 'bg-sky-500/20 border-sky-400 ring-1 ring-sky-400/50'
                : 'bg-sky-950/35 border-sky-500/45 hover:border-sky-400'
            }`}
            title="Clic para ver solo trabajos con tarifa especial (azul)"
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-sky-300">
              {isPerKg ? 'Tarifa Vigente / kg' : 'Modalidad Cuenta'}
            </div>
            <div className="text-lg font-black text-white font-mono mt-0.5">
              {isPerKg ? fmtUsd(totals.currentRateUsd) : 'Por Comprobante'}
            </div>
            <div className="text-[10px] text-sky-300/80 mt-0.5">Clic: ver tarifas especiales</div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('todos')}
            className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
              statusFilter === 'todos'
                ? 'bg-cyan-500/20 border-cyan-400 ring-1 ring-cyan-400/50'
                : 'bg-cyan-950/35 border-cyan-500/45 hover:border-cyan-400'
            }`}
            title="Clic para mostrar todos los movimientos"
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">Total Kilos</div>
            <div className="text-lg font-black text-white font-mono mt-0.5">{fmtKg(totals.totalKilos)}</div>
            <div className="text-[10px] text-cyan-300/80 mt-0.5">Chapa / materiales absorbidos</div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'pendientes' ? 'todos' : 'pendientes')}
            className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
              statusFilter === 'pendientes'
                ? 'bg-amber-500/20 border-amber-400 ring-1 ring-amber-400/50'
                : 'bg-amber-950/35 border-amber-500/45 hover:border-amber-400'
            }`}
            title="Clic para enfocar remitos pendientes de pago"
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Total Trabajos (DEBE)</div>
            <div className="text-lg font-black text-amber-200 font-mono mt-0.5">-{fmtUsd(totals.totalDebeUsd)}</div>
            <div className="text-[10px] text-amber-300/85 mt-0.5">Pendiente: {fmtUsd(totals.pendingDebeUsd)}</div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'cancelados' ? 'todos' : 'cancelados')}
            className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
              statusFilter === 'cancelados'
                ? 'bg-emerald-500/20 border-emerald-400 ring-1 ring-emerald-400/50'
                : 'bg-emerald-950/35 border-emerald-500/45 hover:border-emerald-400'
            }`}
            title="Clic para ver remitos cancelados (verdes)"
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Pagos y Canjes (HABER)</div>
            <div className="text-lg font-black text-emerald-200 font-mono mt-0.5">+{fmtUsd(totals.totalHaberUsd)}</div>
            <div className="text-[10px] text-emerald-300/85 mt-0.5">Cubierto: {fmtUsd(totals.cancelledDebeUsd)}</div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('todos')}
            className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
              balanceNegative
                ? 'bg-rose-950/60 border-rose-500/75 hover:border-rose-400 shadow-md shadow-rose-950/40'
                : 'bg-emerald-950/60 border-emerald-500/75 hover:border-emerald-400 shadow-md shadow-emerald-950/40'
            }`}
            title="Saldo real = Saldo Inicial + Pagos/Canjes (HABER) - Trabajos (DEBE)"
          >
            <div className={`text-[10px] font-bold uppercase tracking-wider ${balanceNegative ? 'text-rose-300' : 'text-emerald-300'}`}>
              Saldo Cuenta Corriente
            </div>
            <div className={`text-lg font-black font-mono mt-0.5 ${balanceNegative ? 'text-rose-200' : 'text-emerald-200'}`}>
              {balanceFormatted}
            </div>
            <div className={`text-[10px] mt-0.5 ${balanceNegative ? 'text-rose-300/85' : 'text-emerald-300/85'}`}>
              {balanceNegative ? 'Saldo a pagar al taller' : 'A favor / Saldado'}
            </div>
          </button>
        </div>
      </div>
    </>
  )
}
