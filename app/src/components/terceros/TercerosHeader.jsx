/**
 * TercerosHeader.jsx
 * Zona 1: Contexto Operativo y Selector de Terminales de Rol (M5 / DEC-017).
 */

import React from 'react'
import { Wrench, ShieldCheck, Plus, Sparkles } from 'lucide-react'

export default function TercerosHeader({
  activeRolePerspective,
  setActiveRolePerspective,
  canEditAmounts,
  onOpenNewModal
}) {
  return (
    <div className="alon-zone-context space-y-3 p-4">
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
            </div>
            <p className="text-xs text-slate-400">
              Gestión y auditoría de comprobantes (PRC, RMO, RPF, FCR, SDT), cotización quincenal y conformidad de obra.
            </p>
          </div>
        </div>

        {/* SELECTOR DE TERMINALES & ACCIÓN RÁPIDA */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-950/90 border border-slate-800 p-1 rounded-xl flex items-center gap-1 text-xs shadow-inner">
            <span className="text-[10px] uppercase font-bold text-slate-400 px-2 flex items-center gap-1 hidden sm:flex">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> Terminal:
            </span>
            <button
              type="button"
              onClick={() => setActiveRolePerspective('admin')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeRolePerspective === 'admin'
                  ? 'bg-cyan-500 text-slate-950 shadow-md ring-1 ring-cyan-400/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
              title="Terminal Jorge Sentis: Control total, edición de montos autorizada, auditoría y configuración general"
            >
              <span>👑 Admin</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveRolePerspective('maria_jose')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeRolePerspective === 'maria_jose'
                  ? 'bg-amber-400 text-slate-950 shadow-md ring-1 ring-amber-400/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
              title="Terminal María José: Carga y valorización de comprobantes, control de facturación, reclamos de RPF, edición de montos y evolución a factura"
            >
              <span>📋 María José</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveRolePerspective('jefe_obra')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeRolePerspective === 'jefe_obra'
                  ? 'bg-emerald-400 text-slate-950 shadow-md ring-1 ring-emerald-400/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
              title="Terminal Jefe de Obra: Auditoría técnica y conformidad de trabajos ejecutados en obra, notas técnicas"
            >
              <span>🛠️ Jefe Obra</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveRolePerspective('direccion')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeRolePerspective === 'direccion'
                  ? 'bg-purple-400 text-slate-950 shadow-md ring-1 ring-purple-400/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
              title="Terminal Dirección: Solo lectura gerencial en USD por buque y órdenes de trabajo"
            >
              <span>👁️ Dirección</span>
            </button>
          </div>

          {/* Botón Nuevo Comprobante */}
          {activeRolePerspective !== 'direccion' && (
            <button
              type="button"
              onClick={onOpenNewModal}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Cargar Comprobante</span>
            </button>
          )}
        </div>
      </div>

      {/* SUB-BARRA DE ORIENTACIÓN DEL PUESTO ACTIVO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-sky-500/20 text-xs">
        <div className="flex items-center gap-2 text-cyan-300 font-bold tracking-wide uppercase text-[11px]">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>
            {activeRolePerspective === 'admin' && 'Terminal Administrador General — Control Maestro, Tasas & Finanzas'}
            {activeRolePerspective === 'maria_jose' && 'Terminal Administración Comercial (María José) — Ciclo de Comprobantes & Valorización'}
            {activeRolePerspective === 'jefe_obra' && 'Terminal Jefes de Obra — Conformidad Técnica de Trabajos en Barco'}
            {activeRolePerspective === 'direccion' && 'Terminal Dirección Estratégica (Hugo) — Supervisión Ejecutiva de Costos'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${
            canEditAmounts 
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60' 
              : 'bg-slate-900 text-slate-400 border-slate-800'
          }`}>
            {canEditAmounts ? '🔓 Edición de montos AR$/US$ Habilitada' : '🔒 Solo Lectura de Montos'}
          </span>
        </div>
      </div>
    </div>
  )
}
