import React from 'react'
import { Loader2 } from 'lucide-react'
import { formatNoticeUsd } from '../../lib/workOrderUnificationEngine'

/**
 * Cartel simple de aviso (fondo blanco, texto oscuro) que resume las líneas y
 * costos totales en US$ que se trasladarán en los 4 módulos de imputación.
 */
export default function WorkOrderCostPreviewBox({
  summary = null,
  loading = false,
  error = '',
  title = 'Movimientos vinculados que se van a mover:',
}) {
  const rows = summary?.rows || [
    { key: 'panol', label: 'PAÑOL', count: 0, totalUsd: 0 },
    { key: 'terceros', label: 'TERCEROS', count: 0, totalUsd: 0 },
    { key: 'compras', label: 'COMPRAS', count: 0, totalUsd: 0 },
    { key: 'horas', label: 'HORAS', count: 0, totalUsd: 0 },
  ]

  return (
    <div className="rounded-xl bg-white text-slate-900 border border-slate-300 px-4 py-3 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-700 mb-2">
        {title}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-2 text-xs font-semibold text-slate-600">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-700" />
          <span>Calculando movimientos vinculados...</span>
        </div>
      ) : error ? (
        <div className="text-xs font-semibold text-rose-700 py-1">{error}</div>
      ) : (
        <div className="space-y-1 font-mono text-xs tabular-nums">
          {rows.map((row) => (
            <div
              key={row.key}
              className="grid grid-cols-[56px_110px_1fr] items-center py-0.5 border-b border-slate-200 last:border-b-0"
            >
              <span className="font-black text-slate-900 text-right pr-3">{row.count}</span>
              <span className="font-bold text-slate-800">{row.label}</span>
              <span className="font-black text-slate-900 text-right">
                {formatNoticeUsd(row.totalUsd)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
