import React from 'react'
import { formatUsd } from '../../lib/drydockCatalogConstants'
import { PAIRED_GRID_CLASS as PAIRED_GRID } from '../../lib/billingSheetMath'

/**
 * Franja Financiera Inmovilizada (Imagen 1): acompaña al Gerente al bajar por las
 * hojas del remito, mostrando siempre frente a sus ojos el acumulado general de
 * venta (Exento, Gravado, I.V.A., Valor de Venta) frente al Costo Operativo y Margen.
 */
export default function BillingStickyTotalsBar({ shipName = '', grandTotal = null }) {
  const exentoUsd = Number(grandTotal?.exentoUsd) || 0
  const gravadoUsd = Number(grandTotal?.gravadoUsd) || 0
  const ivaUsd = Number(grandTotal?.ivaUsd) || 0
  const totalUsd = Number(grandTotal?.totalUsd) || 0
  const opCostUsd = Number(grandTotal?.operationalCostUsd) || 0
  const margenUsd = Number(grandTotal?.margenRealUsd) || 0
  const margenPct = Number(grandTotal?.margenPct) || 0

  return (
    <div className={PAIRED_GRID}>
      {/* Izquierda de la línea roja: BUQUE + Exento / Gravado / IVA / VALOR DE VENTA (TOTAL) */}
      <div className="bg-white text-slate-950 rounded-lg border-2 border-slate-900 shadow-lg overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-[minmax(120px,1.15fr)_1fr_1fr_1fr_minmax(150px,1.25fr)] divide-x divide-slate-400">
          <div className="bg-amber-400 px-2.5 py-1.5 flex flex-col justify-center min-w-0">
            <span className="text-[8px] font-black uppercase tracking-wider text-slate-800 leading-none">
              BUQUE
            </span>
            <span className="text-xs font-black uppercase text-slate-950 truncate mt-0.5" title={shipName}>
              {shipName || 'A DEFINIR'}
            </span>
          </div>

          <div className="px-2 py-1 flex flex-col justify-center">
            <span className="text-[9px] font-bold text-slate-600 leading-none">Exento:</span>
            <span className="text-xs font-mono font-black text-slate-950 tabular-nums mt-0.5">
              {formatUsd(exentoUsd)}
            </span>
          </div>

          <div className="px-2 py-1 flex flex-col justify-center">
            <span className="text-[9px] font-bold text-slate-600 leading-none">Gravado:</span>
            <span className="text-xs font-mono font-black text-slate-950 tabular-nums mt-0.5">
              {formatUsd(gravadoUsd)}
            </span>
          </div>

          <div className="px-2 py-1 flex flex-col justify-center">
            <span className="text-[9px] font-bold text-slate-600 leading-none">I.V.A. (21%):</span>
            <span className="text-xs font-mono font-black text-slate-950 tabular-nums mt-0.5">
              {formatUsd(ivaUsd)}
            </span>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-amber-400 border-2 border-rose-600 px-2.5 py-1 flex flex-col justify-center">
            <span className="text-[8px] font-black uppercase tracking-wider text-slate-900 leading-none">
              VALOR DE VENTA (TOTAL)
            </span>
            <span className="text-sm font-mono font-black text-slate-950 tabular-nums leading-tight mt-0.5">
              {formatUsd(totalUsd)}
            </span>
          </div>
        </div>
      </div>

      {/* Línea vertical roja */}
      <div className="hidden xl:block bg-rose-600 rounded-full" />

      {/* Derecha de la línea roja: COSTO OPERATIVO TOTAL + MARGEN REAL */}
      <div className="grid grid-cols-2 rounded-lg overflow-hidden border-2 border-slate-900 bg-white shadow-lg">
        <div className="px-2 py-1 flex flex-col justify-center border-r border-slate-400 bg-white">
          <span className="text-[8px] font-black uppercase text-slate-700 leading-none">
            COSTO OPERATIVO TOTAL
          </span>
          <span className="text-sm font-mono font-black text-blue-700 tabular-nums leading-tight mt-0.5">
            {formatUsd(opCostUsd)}
          </span>
        </div>
        <div className={`px-2 py-1 flex flex-col justify-center ${margenUsd >= 0 ? 'bg-emerald-950 text-emerald-200' : 'bg-rose-950 text-rose-200'}`}>
          <span className="text-[8px] font-black uppercase leading-none opacity-85">
            MARGEN REAL
          </span>
          <span className="text-xs font-mono font-black tabular-nums leading-tight mt-0.5">
            {margenUsd >= 0 ? '+' : ''}{formatUsd(margenUsd, 0)} ({margenPct}%)
          </span>
        </div>
      </div>
    </div>
  )
}
