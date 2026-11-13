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
  { id: 'materiales', label: 'MATERIALES', icon: Package },
  { id: 'horas', label: 'HORAS', icon: Clock },
  { id: 'terceros', label: 'TERCEROS', icon: Wrench }
]

/**
 * Barra superior compartida para las 3 Hojas de Costo Solo Lectura (Arquetipo Gallina).
 * Permite volver a GS-004 RESUMEN, cambiar entre GENERAL / POR O.T. y navegar entre hojas.
 */
export function CostSheetHeaderBar({
  activeSheet,
  costScope,
  shipName,
  otRows = [],
  activeOtId,
  onSelectSheet,
  onChangeCostScope,
  onSelectOt,
  onBackToSummary
}) {
  const activeOt = otRows.find((o) => o.id === activeOtId) || null

  return (
    <div className="bg-slate-900/80 border border-cyan-500/35 rounded-xl p-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={onBackToSummary}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-cyan-200 border border-slate-600/80 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver a Resumen GS-004
        </button>

        {/* Selector de hoja */}
        <div className="flex items-center bg-slate-950/90 border border-slate-800 rounded-lg p-0.5">
          {SHEETS.map((s) => {
            const Icon = s.icon
            const isActive = activeSheet === s.id
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelectSheet(s.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {s.label}
              </button>
            )
          })}
        </div>

        {/* Badge obligatorio Gallina Solo Lectura */}
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-500/10 text-sky-300 border border-sky-400/35">
          <Eye className="w-3.5 h-3.5" />
          Gallina · Solo Lectura
          <Lock className="w-3 h-3 opacity-80" />
        </span>
      </div>

      {/* Switch GENERAL (todo el buque) <-> POR O.T. (OT específica) */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-slate-400 font-semibold">
          Buque: <strong className="text-slate-100">{shipName}</strong>
        </span>

        <div className="flex items-center bg-slate-950/90 border border-slate-800 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => onChangeCostScope('GENERAL')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase cursor-pointer transition-colors ${
              costScope === 'GENERAL'
                ? 'bg-cyan-600/30 text-cyan-200 border border-cyan-400/50'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            General (Todo el Buque)
          </button>
          <button
            type="button"
            onClick={() => onChangeCostScope('OT')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase cursor-pointer transition-colors ${
              costScope === 'OT'
                ? 'bg-violet-600/30 text-violet-200 border border-violet-400/50'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            Por O.T {activeOt ? `(${activeOt.otNumber})` : ''}
          </button>
        </div>

        {costScope === 'OT' && otRows.length > 0 && (
          <select
            value={activeOtId || ''}
            onChange={(e) => onSelectOt(e.target.value)}
            className="bg-slate-950 border border-violet-500/40 rounded-lg px-2 py-1 text-xs font-semibold text-violet-100 outline-none"
          >
            {otRows.map((o) => (
              <option key={o.id} value={o.id}>
                {o.otNumber} · {o.title}
              </option>
            ))}
          </select>
        )}
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
  exportColumns = []
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
