import React from 'react'
import { ArrowLeft, Download, Eye, ShieldAlert } from 'lucide-react'
import { formatUsd, formatKg } from '../../lib/drydockCatalogConstants'
import { exportToSpreadsheet } from '../../lib/exportEngine'

/**
 * Vista 1B: Matriz Horizontal de Órdenes de Trabajo equivalente a `RESUMEN 2` de GS-004.
 * Arquetipo B (Gallina · Solo Análisis).
 */
export default function ResumenMatrizOtsPanel({
  summary,
  activeOtId,
  onSelectOtAndInspect,
  onBackToSummary
}) {
  const { ship, totals, otRows = [] } = summary || {}

  if (!ship || !totals) return null

  const handleExport = () => {
    exportToSpreadsheet({
      filename: `resumen2_matriz_ots_${ship.name.replace(/\s+/g, '_')}.xls`,
      columns: [
        { key: 'otNumber', label: 'O.T.' },
        { key: 'title', label: 'Título OT' },
        { key: 'tercerosUsd', label: 'Terceros US$' },
        { key: 'materialesUsd', label: 'Materiales US$' },
        { key: 'consumiblesObraUsd', label: 'Consumibles US$' },
        { key: 'horasTotalUsd', label: 'Horas US$' },
        { key: 'matPlusConsUsd', label: 'Mat+Cons US$' },
        { key: 'manoObraTotalUsd', label: 'M.O Total US$' },
        { key: 'directTotalUsd', label: 'Total OT US$' },
        { key: 'weightKg', label: 'KG por OT' },
        { key: 'seguridadReferenciaUsd', label: 'EPP Ref (No suma) US$' },
        { key: 'description', label: 'Descripción de trabajo' }
      ],
      rows: otRows
    })
  }

  return (
    <div className="bg-slate-900/75 border border-cyan-500/35 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToSummary}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-cyan-200 border border-slate-700 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver a RESUMEN (Donuts)
          </button>
          <div>
            <h3 className="text-sm font-bold text-slate-100">
              MATRIZ CONSOLIDADA DE ÓRDENES DE TRABAJO (RESUMEN 2) — {ship.name}
            </h3>
            <p className="text-[11px] text-slate-400">
              Clic en cualquier fila para seleccionar la OT activa y volver al desglose visual.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          Exportar Matriz (.xls)
        </button>
      </div>

      <div className="overflow-x-auto max-h-[62vh]">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-950 border-b border-slate-700">
            {/* Fila 1: Totales acumulados globales equivalentes a fila 1 de RESUMEN 2 */}
            <tr className="bg-cyan-950/45 border-b border-cyan-500/30 text-[11px] font-extrabold text-cyan-200 tabular-nums">
              <th className="px-3 py-2">TOTALES ({otRows.length} OTs)</th>
              <th className="px-3 py-2 text-right">{formatUsd(totals.tercerosUsd)}</th>
              <th className="px-3 py-2 text-right">{formatUsd(totals.materialesUsd)}</th>
              <th className="px-3 py-2 text-right">{formatUsd(totals.consumiblesObraUsd)}</th>
              <th className="px-3 py-2 text-right">{formatUsd(totals.horasTotalUsd)}</th>
              <th className="px-3 py-2 text-right bg-cyan-900/30">{formatUsd(totals.matPlusConsUsd)}</th>
              <th className="px-3 py-2 text-right bg-emerald-900/25">{formatUsd(totals.manoObraTotalUsd)}</th>
              <th className="px-3 py-2 text-right bg-amber-500/15 text-amber-300">{formatUsd(totals.directTotalUsd)}</th>
              <th className="px-3 py-2 text-right text-sky-300">{formatKg(totals.weightKg, 2)}</th>
              <th className="px-3 py-2 text-right text-amber-300/80" title="Solo informativo · No suma al Total">
                {formatUsd(totals.seguridadReferenciaUsd)}*
              </th>
              <th className="px-3 py-2 text-slate-300">TOTAL GENERAL OBRA</th>
            </tr>

            {/* Fila 2: Encabezados de columna */}
            <tr className="text-[10px] uppercase tracking-wider text-slate-400 bg-slate-900">
              <th className="px-3 py-2">Orden de Trabajo</th>
              <th className="px-3 py-2 text-right">Terceros</th>
              <th className="px-3 py-2 text-right">Materiales</th>
              <th className="px-3 py-2 text-right">Consumibles</th>
              <th className="px-3 py-2 text-right">Hora</th>
              <th className="px-3 py-2 text-right border-l border-slate-800 text-cyan-300">Mat+Cons</th>
              <th className="px-3 py-2 text-right text-emerald-300">M.O</th>
              <th className="px-3 py-2 text-right text-amber-300">Total por O.T</th>
              <th className="px-3 py-2 text-right text-sky-300">KG por O.T</th>
              <th className="px-3 py-2 text-right text-amber-400">
                <span className="inline-flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" />
                  EPP Ref*
                </span>
              </th>
              <th className="px-3 py-2">Descripción de trabajo</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/70">
            {otRows.map((row) => {
              const isSelected = row.id === activeOtId
              return (
                <tr
                  key={row.id}
                  onClick={() => onSelectOtAndInspect(row.id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-cyan-950/35 text-white'
                      : 'hover:bg-slate-800/60 text-slate-200'
                  }`}
                >
                  <td className="px-3 py-2 font-semibold whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="text-cyan-300 font-mono">{row.otNumber}</span>
                      <span className="text-slate-200 truncate max-w-[180px]">{row.title}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatUsd(row.tercerosUsd)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatUsd(row.materialesUsd)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatUsd(row.consumiblesObraUsd)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatUsd(row.horasTotalUsd)}</td>
                  <td className="px-3 py-2 text-right tabular-nums border-l border-slate-800 font-semibold text-cyan-200">
                    {formatUsd(row.matPlusConsUsd)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-200">
                    {formatUsd(row.manoObraTotalUsd)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-extrabold text-amber-300 bg-amber-500/5">
                    {formatUsd(row.directTotalUsd)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-sky-200">
                    {formatKg(row.weightKg, 2)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-amber-400/80 italic">
                    {row.seguridadReferenciaUsd > 0 ? formatUsd(row.seguridadReferenciaUsd) : '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-400 max-w-[300px] truncate" title={row.description}>
                    {row.description}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
