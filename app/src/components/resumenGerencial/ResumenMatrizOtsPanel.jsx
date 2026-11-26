import React, { useState } from 'react'
import { ArrowLeft, Download, Eye, ShieldAlert, Megaphone, ReceiptText, CheckCircle2 } from 'lucide-react'
import { formatUsd, formatKg } from '../../lib/drydockCatalogConstants'
import { exportToSpreadsheet } from '../../lib/exportEngine'
import CanonicalOtBadge from '../canonical/CanonicalOtBadge'

const OT_STATUS_PILLS = {
  'EN EJECUCION': 'bg-emerald-950/80 text-emerald-300 border-emerald-500/60',
  'EN PROGRESO': 'bg-emerald-950/80 text-emerald-300 border-emerald-500/60',
  FINALIZADO: 'bg-cyan-950/80 text-cyan-300 border-cyan-500/60',
  'PENDIENTE REMITO': 'bg-blue-950/80 text-blue-300 border-blue-500/60',
  'REMITO REALIZADO/PDTE FIRMA': 'bg-indigo-950/80 text-indigo-300 border-indigo-500/60',
  'FINALIZADO COSTO FINAL DE OBRA': 'bg-teal-950/80 text-teal-300 border-teal-500/60',
  FACTURADO: 'bg-purple-950/80 text-purple-300 border-purple-500/60',
  'PENDIENTE DE INICIO': 'bg-amber-950/80 text-amber-300 border-amber-500/60',
  DESESTIMADO: 'bg-rose-950/80 text-rose-300 border-rose-600/60'
}

function getStatusPillClass(status = '') {
  const key = String(status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim()
  return OT_STATUS_PILLS[key] || 'bg-slate-800 text-slate-300 border-slate-600'
}

/**
 * Vista 1B: Matriz Horizontal de Órdenes de Trabajo equivalente a `RESUMEN 2` de GS-004.
 * Incluye estado visual de cada OT y accesos directos `[📣 Ampliar]` y `[🧾 Facturar]`.
 */
export default function ResumenMatrizOtsPanel({
  summary,
  activeOtId,
  onSelectOtAndInspect,
  onBackToSummary,
  onRequestExpansion,
  onSendOtToBilling
}) {
  const { ship, totals, otRows = [] } = summary || {}
  const [busyOtId, setBusyOtId] = useState(null)

  if (!ship || !totals) return null

  const handleExport = () => {
    exportToSpreadsheet({
      filename: `resumen2_matriz_ots_${ship.name.replace(/\s+/g, '_')}.xls`,
      columns: [
        { key: 'otNumber', label: 'O.T.' },
        { key: 'status', label: 'Estado OT' },
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

  const handleRowAction = async (e, row, actionFn) => {
    e.stopPropagation()
    if (!actionFn || row.id === 'SIN_OT') return
    try {
      setBusyOtId(row.id)
      await actionFn(row)
    } finally {
      setBusyOtId(null)
    }
  }

  return (
    <div className="bg-slate-900/75 border border-cyan-500/35 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToSummary}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-950/55 hover:bg-rose-900/70 text-rose-200 hover:text-white border-2 border-rose-500/85 hover:border-rose-400 cursor-pointer transition-all shadow-sm shadow-rose-950/30 whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver a Resumen GS-004
          </button>
          <div>
            <h3 className="text-sm font-bold text-slate-100">
              MATRIZ CONSOLIDADA DE ÓRDENES DE TRABAJO (RESUMEN 2) — {ship.name}
            </h3>
            <p className="text-[11px] text-slate-400">
              Clic en cualquier fila para ver sus donuts · Usá <strong>Ampliar</strong> o <strong>Facturar</strong> para operar directo sobre la OT.
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

      <div className="overflow-x-auto max-h-[calc(100vh-250px)] overflow-y-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-950 border-b border-slate-700">
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
              <th className="px-3 py-2 text-right text-emerald-300">ACCIONES</th>
            </tr>

            <tr className="text-[10px] uppercase tracking-wider text-slate-400 bg-slate-900">
              <th className="px-3 py-2">Orden de Trabajo & Estado</th>
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
              <th className="px-3 py-2 text-right">Facturación / Acuse</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/70">
            {otRows.map((row) => {
              const isSelected = row.id === activeOtId
              const isOrphan = row.id === 'SIN_OT'
              return (
                <tr
                  key={row.id}
                  onClick={() => onSelectOtAndInspect(row.id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? 'bg-cyan-950/35 text-white' : 'hover:bg-slate-800/60 text-slate-200'
                  }`}
                >
                  <td className="px-3 py-2 font-semibold whitespace-nowrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Eye className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <CanonicalOtBadge
                        wo={row.wo || null}
                        ship={ship}
                        otNumber={row.otNumber}
                        otTitle={row.title}
                        tooltipOverride={row.canonicalTooltip || ''}
                        variant="inline"
                        sinOtLabel="S/OT · Sin OT asignada"
                        className="max-w-[235px]"
                      />
                      <span
                        className={`px-1.5 py-0.5 rounded border text-[9px] font-black uppercase ${getStatusPillClass(row.status)}`}
                        title={`Estado operativo de la OT: ${row.status}`}
                      >
                        {row.status}
                      </span>
                      {row.foremanReviewStatus === 'REQUESTED' && (
                        <span className="px-1.5 py-0.5 rounded bg-orange-950 text-orange-200 border border-orange-500/70 text-[9px] font-black" title="Ampliación solicitada a Jefe de Obra + Administrador">
                          📣 Ampliar
                        </span>
                      )}
                      {row.foremanReviewStatus === 'RESOLVED' && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-200 border border-emerald-500/70 text-[9px] font-black" title="Ampliación comercial resuelta y lista en billing_description">
                          ✅ Ampliado
                        </span>
                      )}
                    </div>
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
                  <td className="px-3 py-2 text-slate-400 max-w-[240px] truncate" title={row.description}>
                    {row.description}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {!isOrphan && (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={busyOtId === row.id}
                          onClick={(e) => handleRowAction(e, row, onRequestExpansion)}
                          className="px-2 py-1 rounded-md text-[10px] font-bold bg-orange-500/15 hover:bg-orange-500/30 text-orange-200 border border-orange-500/45 inline-flex items-center gap-1 cursor-pointer"
                          title="Solicitar ampliación de detalle comercial (billing_description) al Jefe de Obra + Administrador"
                        >
                          <Megaphone className="w-3 h-3" />
                          <span>Ampliar</span>
                        </button>
                        <button
                          type="button"
                          disabled={busyOtId === row.id}
                          onClick={(e) => handleRowAction(e, row, onSendOtToBilling)}
                          className={`px-2 py-1 rounded-md text-[10px] font-bold border inline-flex items-center gap-1 cursor-pointer ${
                            row.isInBilling
                              ? 'bg-emerald-950/70 hover:bg-emerald-900/70 text-emerald-300 border-emerald-500/60'
                              : 'bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-200 border-cyan-400/60'
                          }`}
                          title={row.isInBilling ? 'Ya está en la Hoja de Facturación · Clic para abrirla' : 'Enviar esta OT a la Hoja de Facturación del barco'}
                        >
                          {row.isInBilling ? <CheckCircle2 className="w-3 h-3" /> : <ReceiptText className="w-3 h-3" />}
                          <span>{row.isInBilling ? 'En Factura' : 'Facturar'}</span>
                        </button>
                      </div>
                    )}
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
