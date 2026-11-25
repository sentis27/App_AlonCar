import React from 'react'
import {
  Download,
  RefreshCw,
  BarChart3,
  ReceiptText,
  Radio,
  DollarSign
} from 'lucide-react'
import { RESUMEN_GERENCIAL_TABS, formatUsd } from '../../lib/drydockCatalogConstants'
import { formatTimeAr } from '../../lib/dateTimeCanonical'
import { exportToSpreadsheet } from '../../lib/exportEngine'
import { getFilterSelectClass } from '../../lib/filterThemeConstants'
import CanonicalActiveSubmoduleBadge from '../canonical/CanonicalActiveSubmoduleBadge'

const SCOPE_OPTIONS = [
  {
    id: 'activas',
    label: 'Obras Activas',
    activeCls:
      'bg-emerald-500/25 border-emerald-400 text-emerald-100 font-extrabold shadow-sm shadow-emerald-500/25 ring-1 ring-emerald-400/40',
    inactiveCls:
      'bg-slate-950 border-emerald-500/55 text-emerald-300/90 hover:border-emerald-400 hover:text-emerald-200'
  },
  {
    id: 'historico',
    label: 'Histórico',
    activeCls:
      'bg-amber-950/90 border-amber-400 text-amber-200 font-extrabold shadow-sm shadow-amber-500/20 ring-1 ring-amber-400/35',
    inactiveCls:
      'bg-slate-950 border-slate-700/90 text-slate-400 hover:border-amber-500/65 hover:text-amber-200'
  },
  {
    id: 'mixto',
    label: 'Mixto',
    activeCls:
      'bg-sky-950/90 border-sky-400 text-sky-200 font-extrabold shadow-sm shadow-sky-500/20 ring-1 ring-sky-400/35',
    inactiveCls:
      'bg-slate-950 border-slate-700/90 text-slate-400 hover:border-sky-500/65 hover:text-sky-200'
  }
]

/**
 * Zona 1 Canónica del Resumen Gerencial (Pestañas migradas al Menú Lateral Acordeón):
 * - Fila 1: Identidad analítica + submódulo activo + Dólar Ref. + Exportar / En vivo / Actualizar.
 * - Fila 2: Parámetros iniciales arriba (Buque, Orden de Trabajo, Alcance y Año).
 */
export default function ResumenGerencialHeader({
  activeTab,
  activeSubmodule,
  selectableShips = [],
  selectedShipId,
  onChangeShip,
  otRows = [],
  selectedOtId,
  onChangeOt,
  scope,
  onChangeScope,
  yearFilter,
  onChangeYear,
  availableYears = [],
  shipSummary,
  dollarRate = 1500,
  loading = false,
  onRefresh,
  realtimeStatus = 'CONNECTING',
  lastSyncAt = null
}) {
  const currentTabMeta =
    RESUMEN_GERENCIAL_TABS.find((t) => t.id === activeTab) || RESUMEN_GERENCIAL_TABS[0]

  const isObraScopedView = currentTabMeta.menuGroup === 'OBRA'
  const isRemitoView = activeTab === 'remito'

  const handleExportSummary = () => {
    if (!shipSummary) return
    exportToSpreadsheet({
      filename: `resumen_gs004_${shipSummary.ship?.name || 'obra'}.xls`,
      columns: [
        { key: 'otNumber', label: 'O.T' }, { key: 'title', label: 'Título' },
        { key: 'materialesUsd', label: 'Materiales US$' }, { key: 'consumiblesObraUsd', label: 'Consumibles US$' },
        { key: 'tercerosUsd', label: 'Terceros US$' }, { key: 'horasTotalUsd', label: 'Horas US$' },
        { key: 'directTotalUsd', label: 'Total OT US$' }, { key: 'weightKg', label: 'Peso KG' }
      ],
      rows: shipSummary.otRows
    })
  }

  const formattedSyncTime = lastSyncAt
    ? formatTimeAr(lastSyncAt, { includeSeconds: true, fallback: null })
    : null

  return (
    <div className="alon-zone-context p-3 bg-slate-900/80 space-y-2 shrink-0">
      {/* Fila 1: Identidad analítica + Submódulo Activo + Dólar Ref. + Acciones de sincronización */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl font-black text-white tracking-tight">Resumen Gerencial</h1>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/15 text-sky-300 border border-sky-400/35">
            {isRemitoView ? <ReceiptText className="w-3.5 h-3.5 shrink-0" /> : <BarChart3 className="w-3.5 h-3.5 shrink-0" />}
            <span>GS-004 · {currentTabMeta.badge}</span>
          </span>
          <CanonicalActiveSubmoduleBadge
            label={activeSubmodule?.label || currentTabMeta.label}
            theme={activeSubmodule?.theme || currentTabMeta.colorTheme || 'cyan'}
          />

          {/* Dólar Ref. en Zona 1 (solo lectura desde Macro Variables / Tarifarios) */}
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/95 border border-emerald-500/45 select-none shadow-sm"
            title="Tipo de cambio de referencia vigente (solo lectura desde Macro Variables / Tarifarios)"
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Dólar Ref.</span>
            <span className="text-sm font-black text-emerald-300 tabular-nums leading-none">
              ${Number(dollarRate || 1500).toLocaleString('es-AR')}
            </span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 shrink-0">
          {shipSummary && isObraScopedView && (
            <button
              type="button"
              onClick={handleExportSummary}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar GS-004
            </button>
          )}
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border ${
              realtimeStatus === 'SUBSCRIBED' ? 'bg-emerald-950/45 border-emerald-500/35 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}
            title={
              realtimeStatus === 'SUBSCRIBED'
                ? `Sincronización en vivo (Supabase Realtime + foco)${formattedSyncTime ? ` · Última carga ${formattedSyncTime}` : ''}`
                : `Sincronización automática por foco/intervalo${formattedSyncTime ? ` · Última carga ${formattedSyncTime}` : ''}`
            }
          >
            <Radio className={`w-3 h-3 ${realtimeStatus === 'SUBSCRIBED' ? 'animate-pulse text-emerald-400' : ''}`} />
            <span>{realtimeStatus === 'SUBSCRIBED' ? 'En vivo' : 'Auto-sync'}</span>
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            title="Forzar recarga manual de todas las tablas desde Supabase (no modifica datos)"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Fila 2: Parámetros Iniciales de Zona 1 (Buque + OT arriba) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
        {isObraScopedView ? (
          <div className="w-full grid grid-cols-1 lg:grid-cols-[minmax(0,44%)_1fr] items-center gap-2 lg:gap-3">
            <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 min-w-0">
              <select
                aria-label="Seleccionar Buque"
                value={selectedShipId}
                onChange={(e) => onChangeShip(e.target.value)}
                className={`w-full sm:w-auto shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold outline-none cursor-pointer transition-all min-h-[32px] border-2 ${
                  selectedShipId
                    ? 'bg-cyan-950/75 border-cyan-400 text-cyan-50 shadow-sm shadow-cyan-500/20'
                    : 'bg-slate-950 border-cyan-500/60 text-cyan-200 hover:border-cyan-400'
                }`}
              >
                {selectableShips.length === 0 ? (
                  <option value="" className="bg-slate-900">Sin buques para este alcance</option>
                ) : (
                  selectableShips.map((s) => (
                    <option key={s.id} value={s.id} className="bg-slate-900">Buque: {s.name} ({s.status || 'Activo'})</option>
                  ))
                )}
              </select>

              <select
                aria-label="Seleccionar Orden de Trabajo"
                value={selectedOtId || ''}
                onChange={(e) => onChangeOt(e.target.value)}
                disabled={otRows.length === 0}
                className={`w-full sm:w-auto lg:flex-1 lg:min-w-0 max-w-full sm:max-w-[350px] rounded-lg px-2.5 py-1 text-xs font-bold outline-none cursor-pointer transition-all disabled:opacity-50 min-h-[32px] border-2 ${
                  selectedOtId
                    ? 'bg-fuchsia-950/55 border-fuchsia-400/90 text-fuchsia-100 shadow-sm shadow-fuchsia-500/20'
                    : 'bg-slate-950 border-violet-500/60 text-violet-200 hover:border-fuchsia-400'
                }`}
                title={otRows.find((o) => o.id === selectedOtId)?.canonicalTooltip || 'Filtra el detalle por Orden de Trabajo manteniendo intacto el Costo General del buque'}
              >
                {otRows.length === 0 ? (
                  <option value="" className="bg-slate-900">Sin OTs para este buque/alcance</option>
                ) : (
                  otRows.map((o) => (
                    <option key={o.id} value={o.id} className="bg-slate-900">
                      OT: {o.otLabel || `${o.otNumber} · ${o.title}`} ({formatUsd(o.directTotalUsd, 0)})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="hidden md:flex items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-950/95 border border-slate-800 rounded-lg p-0.5 text-[11px]">
                {SCOPE_OPTIONS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onChangeScope(s.id)}
                    className={`px-2.5 py-1 rounded-md border font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      scope === s.id ? s.activeCls : s.inactiveCls
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <select
                aria-label="Filtrar Año"
                value={yearFilter}
                onChange={(e) => onChangeYear(e.target.value)}
                className={getFilterSelectClass('period', yearFilter !== 'TODOS', 'min-h-[32px] py-1')}
              >
                <option value="TODOS" className="bg-slate-900">Año: Todos</option>
                {availableYears.map((yr) => <option key={yr} value={yr} className="bg-slate-900">Año {yr}</option>)}
              </select>
            </div>
          </div>
        ) : isRemitoView ? (
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <span className="text-[11px] text-emerald-200 bg-emerald-950/40 border border-emerald-500/40 px-2.5 py-1 rounded-lg font-medium">
              Mesa Independiente Multi-Barco · Consultá Resumen Gerencial o Matriz OTs en otro barco sin cambiar tu hoja de facturación actual
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <span className="text-[11px] text-violet-200 bg-violet-950/30 border border-violet-500/35 px-2.5 py-1 rounded-lg font-medium">
              Comparador multi-buque independiente (seleccioná las obras a contrastar en el panel izquierdo)
            </span>
            <select aria-label="Filtrar Año en Comparador" value={yearFilter} onChange={(e) => onChangeYear(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 outline-none">
              <option value="TODOS">Año: Todos</option>
              {availableYears.map((yr) => <option key={yr} value={yr}>Año {yr}</option>)}
            </select>
          </div>
        )}
      </div>
    </div>
  )
}
