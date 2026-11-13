import React from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { RESUMEN_GERENCIAL_TABS } from '../../lib/drydockCatalogConstants'
import { exportToSpreadsheet } from '../../lib/exportEngine'

const TAB_ACTIVE_CLASSES = {
  cyan: 'bg-cyan-500/20 text-cyan-200 border-cyan-400 shadow-sm shadow-cyan-500/20',
  violet: 'bg-violet-500/20 text-violet-200 border-violet-400 shadow-sm shadow-violet-500/20',
  emerald: 'bg-emerald-500/20 text-emerald-200 border-emerald-400 shadow-sm shadow-emerald-500/20'
}

/**
 * Zona 1 Canónica del Resumen Gerencial:
 * Pestañas de colores (Cian / Violeta / Esmeralda), Buque, Alcance (Activas/Histórico/Mixto), Año y Exportación.
 */
export default function ResumenGerencialHeader({
  activeTab,
  onSelectTab,
  selectableShips = [],
  selectedShipId,
  onChangeShip,
  scope,
  onChangeScope,
  yearFilter,
  onChangeYear,
  availableYears = [],
  shipSummary,
  loading = false,
  onRefresh
}) {
  const currentTabMeta =
    RESUMEN_GERENCIAL_TABS.find((t) => t.id === activeTab) || RESUMEN_GERENCIAL_TABS[0]

  const handleExportSummary = () => {
    if (!shipSummary) return
    exportToSpreadsheet({
      filename: `resumen_gs004_${shipSummary.ship?.name || 'obra'}.xls`,
      columns: [
        { key: 'otNumber', label: 'O.T' },
        { key: 'title', label: 'Título' },
        { key: 'materialesUsd', label: 'Materiales US$' },
        { key: 'consumiblesObraUsd', label: 'Consumibles US$' },
        { key: 'tercerosUsd', label: 'Terceros US$' },
        { key: 'horasTotalUsd', label: 'Horas US$' },
        { key: 'directTotalUsd', label: 'Total OT US$' },
        { key: 'weightKg', label: 'Peso KG' }
      ],
      rows: shipSummary.otRows
    })
  }

  return (
    <div className="alon-zone-context p-4 bg-slate-900/80 space-y-3">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl font-black text-white tracking-tight">Resumen Gerencial</h1>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/15 text-sky-300 border border-sky-400/35">
            GS-004 · {currentTabMeta.badge}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/85 p-1 rounded-xl border border-slate-800">
          {RESUMEN_GERENCIAL_TABS.map((tab) => {
            const isAct = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  isAct
                    ? TAB_ACTIVE_CLASSES[tab.colorTheme]
                    : 'border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-800/80">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedShipId}
            onChange={(e) => onChangeShip(e.target.value)}
            className="bg-slate-950 border border-cyan-500/40 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white outline-none"
          >
            {selectableShips.map((s) => (
              <option key={s.id} value={s.id}>
                Buque: {s.name} ({s.status || 'Activo'})
              </option>
            ))}
          </select>

          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[11px]">
            {[
              { id: 'activas', label: 'Obras Activas' },
              { id: 'historico', label: 'Histórico' },
              { id: 'mixto', label: 'Mixto' }
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onChangeScope(s.id)}
                className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
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
            value={yearFilter}
            onChange={(e) => onChangeYear(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none"
          >
            <option value="TODOS">Año: Todos</option>
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                Año {yr}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {shipSummary && (
            <button
              type="button"
              onClick={handleExportSummary}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar GS-004
            </button>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>
    </div>
  )
}
