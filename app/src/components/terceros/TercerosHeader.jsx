/**
 * TercerosHeader.jsx
 * Zona 1 limpia: Contexto Operativo y Acción Principal (permisos derivados automáticamente del usuario).
 */

import React from 'react'
import { Wrench, Plus } from 'lucide-react'

export default function TercerosHeader({
  canEditAmounts = true,
  canMutateRows = true,
  onOpenNewModal
}) {
  return (
    <div className="alon-zone-context p-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-slate-950 shrink-0">
            <Wrench className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-black text-white tracking-wide">
                TERCEROS & TALLERES EXTERNOS
              </h1>
              <span className="text-[10px] font-mono tracking-widest text-cyan-400/90 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded-md uppercase font-bold">
                M3 · Servicios & Facturación
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${
                  canEditAmounts
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                {canEditAmounts ? '🔓 Edición de montos habilitada' : '🔒 Solo lectura de montos'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Gestión y auditoría de comprobantes (PRC, RMO, RPF, FCR, SDT), cotización quincenal y conformidad de obra.
            </p>
          </div>
        </div>

        {/* Acción Principal */}
        {canMutateRows && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenNewModal}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Cargar Comprobante</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
