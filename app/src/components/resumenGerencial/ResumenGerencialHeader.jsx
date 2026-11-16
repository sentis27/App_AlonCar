import React from 'react'
import {
  Download,
  RefreshCw,
  BarChart3,
  Table2,
  ReceiptText,
  Ship,
  Radio
} from 'lucide-react'
import { RESUMEN_GERENCIAL_TABS, formatUsd } from '../../lib/drydockCatalogConstants'
import { exportToSpreadsheet } from '../../lib/exportEngine'

const TAB_ACTIVE_CLASSES = {
  cyan: 'bg-cyan-500/20 text-cyan-200 border-cyan-400 shadow-sm shadow-cyan-500/20',
  sky: 'bg-sky-500/20 text-sky-200 border-sky-400 shadow-sm shadow-sky-500/20',
  violet: 'bg-violet-500/20 text-violet-200 border-violet-400 shadow-sm shadow-violet-500/20',
  emerald: 'bg-emerald-500/20 text-emerald-200 border-emerald-400 shadow-sm shadow-emerald-500/20'
}

/** Ícono contextual por pestaña en Zona 1 (incluyendo barco VS barco para Comparador de Obras). */
function TabIcon({ icon }) {
  if (icon === 'BarChart3') return <BarChart3 className="w-3.5 h-3.5 shrink-0 text-cyan-300" />
  if (icon === 'Table2') return <Table2 className="w-3.5 h-3.5 shrink-0 text-sky-300" />
  if (icon === 'ReceiptText') return <ReceiptText className="w-3.5 h-3.5 shrink-0 text-emerald-300" />
  if (icon !== 'ShipCompare') return null
  return (
    <span className="inline-flex items-center gap-0.5 shrink-0 text-violet-300" aria-hidden="true">
      <Ship className="w-3.5 h-3.5" />
      <span className="px-0.5 rounded bg-violet-500/25 border border-violet-400/40 text-[8px] font-black leading-tight text-violet-200">VS</span>
      <Ship className="w-3.5 h-3.5" />
    </span>
  )
}

/**
 * Zona 1 Canónica del Resumen Gerencial:
 * - Divide visualmente: (A) Hojas de Obra Activa [Resumen, Matriz OTs] vs (B) Herramientas Independientes [Remito Comercial, Comparador].
 * - Centraliza TODOS los parámetros iniciales arriba: Buque, Orden de Trabajo (OT), Alcance (por defecto Obras Activas) y Año.
 */
export default function ResumenGerencialHeader({
  activeTab,
  onSelectTab,
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
  loading = false,
  onRefresh,
  realtimeStatus = 'CONNECTING',
  lastSyncAt = null
}) {
  const currentTabMeta =
    RESUMEN_GERENCIAL_TABS.find((t) => t.id === activeTab) || RESUMEN_GERENCIAL_TABS[0]

  const obraTabs = RESUMEN_GERENCIAL_TABS.filter((t) => t.menuGroup === 'OBRA')
  const toolTabs = RESUMEN_GERENCIAL_TABS.filter((t) => t.menuGroup === 'HERRAMIENTA')
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

  const renderTabButton = (tab) => {
    const isAct = activeTab === tab.id
    return (
      <button
        key={tab.id}
        type="button"
        onClick={() => onSelectTab(tab.id)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer whitespace-nowrap ${
          isAct
            ? TAB_ACTIVE_CLASSES[tab.colorTheme]
            : 'border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
        }`}
      >
        <TabIcon icon={tab.icon} />
        <span>{tab.label}</span>
      </button>
    )
  }

  const formattedSyncTime = lastSyncAt
    ? lastSyncAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  return (
    <div className="alon-zone-context p-3 bg-slate-900/80 space-y-2 shrink-0">
      {/* Fila 1: Identidad analítica (sin palabra Gallina) + 2 Grupos de Menú */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-black text-white tracking-tight">Resumen Gerencial</h1>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-300 border border-sky-400/35">
            {isRemitoView ? (
              <ReceiptText className="w-3 h-3 shrink-0" />
            ) : (
              <BarChart3 className="w-3 h-3 shrink-0" />
            )}
            <span>GS-004 · {currentTabMeta.badge}</span>
          </span>
        </div>

        {/* Dos tipos de menús separados visualmente */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-cyan-950/25 border border-cyan-500/35 px-1.5 py-1 rounded-xl">
            <span className="hidden sm:inline text-[9px] font-black uppercase tracking-wider text-cyan-300/90 px-1.5">
              Obra Filtrada:
            </span>
            {obraTabs.map(renderTabButton)}
          </div>

          <div className="hidden sm:block h-5 w-px bg-slate-700/80" aria-hidden="true" />

          <div className="flex items-center gap-1 bg-slate-950/90 border border-violet-500/30 px-1.5 py-1 rounded-xl">
            <span className="hidden sm:inline text-[9px] font-black uppercase tracking-wider text-violet-300/85 px-1.5">
              Independientes:
            </span>
            {toolTabs.map(renderTabButton)}
          </div>
        </div>
      </div>

      {/* Fila 2: Parámetros Iniciales de Zona 1 (Buque + OT arriba) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
        {isObraScopedView ? (
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <select
              aria-label="Seleccionar Buque"
              value={selectedShipId}
              onChange={(e) => onChangeShip(e.target.value)}
              className="w-full sm:w-auto bg-slate-950 border border-cyan-500/45 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white outline-none min-h-[34px]"
            >
              {selectableShips.length === 0 ? (
                <option value="">Sin buques para este alcance</option>
              ) : (
                selectableShips.map((s) => (
                  <option key={s.id} value={s.id}>
                    Buque: {s.name} ({s.status || 'Activo'})
                  </option>
                ))
              )}
            </select>

            <select
              aria-label="Seleccionar Orden de Trabajo"
              value={selectedOtId || ''}
              onChange={(e) => onChangeOt(e.target.value)}
              disabled={otRows.length === 0}
              className="w-full sm:w-auto sm:min-w-[230px] max-w-full sm:max-w-[340px] bg-slate-950 border border-violet-500/45 rounded-lg px-2.5 py-1.5 text-xs font-bold text-violet-100 outline-none disabled:opacity-50 min-h-[34px]"
              title="Filtra el detalle por Orden de Trabajo manteniendo intacto el Costo General del buque"
            >
              {otRows.length === 0 ? (
                <option value="">Sin OTs para este buque/alcance</option>
              ) : (
                otRows.map((o) => (
                  <option key={o.id} value={o.id}>
                    OT: {o.otNumber} · {o.title} ({formatUsd(o.directTotalUsd, 0)})
                  </option>
                ))
              )}
            </select>

            <div className="hidden md:flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[11px]">
              {[
                { id: 'activas', label: 'Obras Activas' },
                { id: 'historico', label: 'Histórico' },
                { id: 'mixto', label: 'Mixto' }
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onChangeScope(s.id)}
                  className={`px-2 py-1 rounded-md font-semibold cursor-pointer ${
                    scope === s.id
                      ? 'bg-sky-500/25 text-sky-200'
                      : 'text-slate-400 hover:text-slate-200'
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
              className="hidden md:block bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 outline-none"
            >
              <option value="TODOS">Año: Todos</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  Año {yr}
                </option>
              ))}
            </select>
          </div>
        ) : isRemitoView ? (
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <select
              aria-label="Seleccionar Buque para Remito Comercial"
              value={selectedShipId}
              onChange={(e) => onChangeShip(e.target.value)}
              className="w-full sm:w-auto bg-slate-950 border border-emerald-500/45 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white outline-none"
            >
              {selectableShips.map((s) => (
                <option key={s.id} value={s.id}>
                  Remito de Buque: {s.name} ({s.status || 'Activo'})
                </option>
              ))}
            </select>
            <span className="text-[11px] text-emerald-300/80 bg-emerald-950/30 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
              Módulo comercial independiente · Editá tarifas y líneas sin afectar el resumen contable
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
              realtimeStatus === 'SUBSCRIBED'
                ? 'bg-emerald-950/45 border-emerald-500/35 text-emerald-300'
                : 'bg-slate-900 border-slate-700 text-slate-400'
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
    </div>
  )
}
