import React from 'react'
import { Plus, Download, Sparkles } from 'lucide-react'
import { exportToSpreadsheet } from '../lib/exportEngine'

/**
 * GridRibbon
 * 
 * Cinta Superior Canónica de Grilla (Zona 4) para AlonCar ERP.
 * Cumple con el Estándar 04:
 * 1. Extremo Izquierdo: Badge `[⚡ MODO PLANILLA]` (o `[CELDA A1]`) + Texto de atajos de teclado.
 * 2. Extremo Derecho: Botón `[+ Insertar Fila en #X]`, botón `[📥 Exportar (.csv/Excel)]`, contador de Undo y conteo de filas.
 */
export default function GridRibbon({
  activeCellBadge = null,
  onInsertRow = null,
  insertRowLabel = '+ Insertar Fila en #1',
  undoCount = 0,
  maxUndo = 50,
  totalRows = 0,
  entityName = 'filas',
  // Exportación automática integrada
  exportRows = null,
  exportFilename = 'exportacion_aloncar',
  exportColumns = null,
  onExport = null,
  extraActions = null,
  children = null
}) {
  const handleDefaultExport = () => {
    if (onExport) {
      onExport()
      return
    }
    if (exportRows && exportRows.length > 0) {
      exportToSpreadsheet({
        filename: exportFilename,
        rows: exportRows,
        columns: exportColumns
      })
    } else {
      alert('No hay filas visibles para exportar.')
    }
  }

  const showExportButton = Boolean(onExport || (exportRows && exportRows.length > 0))

  return (
    <div className="alon-grid-ribbon flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 text-xs select-none">
      {/* SECCIÓN IZQUIERDA: BADGE DE MODO Y ATAJOS DE TECLADO */}
      <div className="flex items-center gap-2">
        <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black font-mono text-[10px]">
          {activeCellBadge ? `CELDA ${activeCellBadge}` : '⚡ MODO PLANILLA'}
        </span>
        <span className="text-slate-400 text-[11px] hidden sm:inline">
          Doble clic o <strong className="text-slate-200">Enter</strong> para editar • Arrastrar esquina celeste o <strong className="text-slate-200">Ctrl+D</strong> para rellenar
        </span>
      </div>

      {/* SECCIÓN DERECHA: BOTONES DE ACCIÓN, EXPORTACIÓN Y CONTADORES */}
      <div className="flex items-center gap-2.5">
        {/* Botón de Insertar Fila Canónico */}
        {onInsertRow && (
          <button
            type="button"
            onClick={onInsertRow}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-950/40 cursor-pointer transition-all hover:scale-[1.02]"
            title="Insertar una nueva fila en blanco en la grilla"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>{insertRowLabel}</span>
          </button>
        )}

        {/* Botón Canónico de Exportar a Excel/Sheets */}
        {showExportButton && (
          <button
            type="button"
            onClick={handleDefaultExport}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600/80 text-slate-200 hover:text-white font-semibold text-xs shadow transition-all cursor-pointer"
            title="Exportar datos a formato Excel / Google Sheets (.csv)"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Exportar</span>
          </button>
        )}

        {/* Acciones extra */}
        {extraActions}
        {children}

        {/* Contadores de Memoria Undo y Filas */}
        <div className="flex items-center gap-1.5 text-slate-500 font-mono text-[10px]">
          <span>Undo: {undoCount}/{maxUndo}</span>
          <span>•</span>
          <span>{totalRows} {entityName}</span>
        </div>
      </div>
    </div>
  )
}
