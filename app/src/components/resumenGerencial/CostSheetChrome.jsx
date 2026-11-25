import React from 'react'
import {
  ArrowLeft,
  Eye,
  Package,
  Clock,
  Wrench,
  Download,
  Lock
} from 'lucide-react'
import { exportToSpreadsheet } from '../../lib/exportEngine'

const SHEETS = [
  {
    id: 'materiales',
    label: 'MATERIALES',
    icon: Package,
    inactiveCls:
      'bg-slate-950 border border-blue-500/75 text-blue-200 hover:bg-blue-950/50 hover:border-blue-400',
    activeCls:
      'bg-blue-950/95 border-2 border-blue-400 text-white shadow-sm shadow-blue-500/25 ring-1 ring-blue-400/35'
  },
  {
    id: 'horas',
    label: 'HORAS',
    icon: Clock,
    inactiveCls:
      'bg-slate-950 border border-violet-500/75 text-violet-200 hover:bg-violet-950/50 hover:border-violet-400',
    activeCls:
      'bg-violet-950/95 border-2 border-violet-400 text-white shadow-sm shadow-violet-500/25 ring-1 ring-violet-400/35'
  },
  {
    id: 'terceros',
    label: 'TERCEROS',
    icon: Wrench,
    inactiveCls:
      'bg-slate-950 border border-emerald-500/75 text-emerald-200 hover:bg-emerald-950/50 hover:border-emerald-400',
    activeCls:
      'bg-emerald-950/95 border-2 border-emerald-400 text-white shadow-sm shadow-emerald-500/25 ring-1 ring-emerald-400/35'
  }
]

/**
 * Barra superior compartida (Zona 2) para las 3 Hojas de Costo Solo Lectura (Arquetipo Gallina).
 * Distribución equilibrada en 3 anclajes sin duplicar Buque/OT de Zona 1:
 * - Izquierda: volver a GS-004 RESUMEN.
 * - Centro: selector compacto MATERIALES / HORAS / TERCEROS + Solo Lectura.
 * - Derecha: interruptor GENERAL TODO EL BUQUE / POR O.T.
 */
export function CostSheetHeaderBar({
  activeSheet,
  costScope,
  shipName,
  otRows = [],
  activeOtId,
  onSelectSheet,
  onChangeCostScope,
  onBackToSummary
}) {
  const activeOt = otRows.find((o) => o.id === activeOtId) || null
  const activeOtDisplay = activeOt?.otLabel || (activeOt ? `${activeOt.otNumber} · ${activeOt.title}` : 'O.T.')
  const isGeneral = costScope === 'GENERAL'

  return (
    <div
      className={`rounded-xl px-3 py-2 grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-center gap-2 border transition-colors ${
        isGeneral
          ? 'bg-cyan-950/20 border-cyan-500/45'
          : 'bg-violet-950/25 border-violet-500/45'
      }`}
    >
      {/* Izquierda: Volver a Resumen GS-004 */}
      <div className="flex items-center justify-start">
        <button
          type="button"
          onClick={onBackToSummary}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-950/55 hover:bg-rose-900/70 text-rose-200 hover:text-white border-2 border-rose-500/85 hover:border-rose-400 cursor-pointer transition-all shadow-sm shadow-rose-950/30 whitespace-nowrap"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver a Resumen GS-004
        </button>
      </div>

      {/* Centro: Selector de hoja + Solo Lectura */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <div className="inline-flex items-center gap-1 bg-slate-950/95 border border-slate-800 rounded-lg p-0.5">
          {SHEETS.map((s) => {
            const Icon = s.icon
            const isActive = activeSheet === s.id
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelectSheet(s.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap ${
                  isActive ? s.activeCls : s.inactiveCls
                }`}
              >
                <Icon className="w-3 h-3" />
                {s.label}
              </button>
            )
          })}
        </div>

        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10.5px] font-bold bg-sky-950/60 text-sky-300 border border-sky-400/50 whitespace-nowrap select-none">
          <Eye className="w-3 h-3" />
          Solo Lectura
          <Lock className="w-2.5 h-2.5 opacity-80" />
        </span>
      </div>

      {/* Esquina derecha: Switch compacto GENERAL TODO EL BUQUE / POR O.T. */}
      <div className="flex items-center justify-start lg:justify-end">
        <div className="inline-flex items-center gap-1 bg-slate-950/95 border border-slate-800 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => onChangeCostScope('GENERAL')}
            title={shipName ? `Ver todos los movimientos del buque ${shipName}` : 'Ver todos los movimientos del buque'}
            className={`px-2.5 py-1 rounded-md text-[10.5px] font-extrabold uppercase tracking-wide cursor-pointer transition-all whitespace-nowrap ${
              costScope === 'GENERAL'
                ? 'bg-cyan-950/95 text-cyan-100 border-2 border-cyan-400 shadow-sm shadow-cyan-500/25'
                : 'bg-slate-950 text-slate-400 hover:text-cyan-200 border border-cyan-500/45 hover:border-cyan-400/80'
            }`}
          >
            General Todo el Buque
          </button>
          <button
            type="button"
            onClick={() => onChangeCostScope('OT')}
            title={activeOt ? (activeOt.canonicalTooltip || activeOtDisplay) : 'Filtrar por la Orden de Trabajo seleccionada en Zona 1'}
            className={`px-2.5 py-1 rounded-md text-[10.5px] font-extrabold uppercase tracking-wide cursor-pointer transition-all whitespace-nowrap ${
              costScope === 'OT'
                ? 'bg-violet-950/95 text-violet-100 border-2 border-violet-400 shadow-sm shadow-violet-500/25'
                : 'bg-slate-950 text-slate-400 hover:text-violet-200 border border-violet-500/45 hover:border-violet-400/80'
            }`}
          >
            Por O.T.
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Cinta superior de Zona 4 adaptada a auditoría de solo lectura (sin "+ Fila", sin Undo ni atajos de mutación).
 */
export function ReadOnlyGridRibbon({
  badgeText,
  hintText,
  totalRows = 0,
  entityName = 'registros',
  exportRows = [],
  exportFilename = 'export_solo_lectura',
  exportColumns = [],
  extraActions = null
}) {
  const handleExport = () => {
    exportToSpreadsheet({
      filename: exportFilename,
      rows: exportRows,
      columns: exportColumns
    })
  }

  return (
    <div className="alon-grid-ribbon flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 text-xs select-none">
      <div className="flex items-center gap-2">
        <span className="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-400/40 text-sky-200 font-black font-mono text-[10px]">
          {badgeText}
        </span>
        <span className="text-slate-400 text-[11px] hidden sm:inline">{hintText}</span>
      </div>

      <div className="flex items-center gap-2.5">
        {extraActions}
        <button
          type="button"
          onClick={handleExport}
          disabled={!exportRows || exportRows.length === 0}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-600/80 text-slate-200 hover:text-white font-semibold text-xs cursor-pointer transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-cyan-400" />
          Exportar (.csv)
        </button>
        <span className="text-slate-400 font-mono text-[11px]">
          {totalRows} {entityName}
        </span>
      </div>
    </div>
  )
}
