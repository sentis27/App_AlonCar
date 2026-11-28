/**
 * TesoreriaContratadosHeader.jsx
 * Zona 1 (.alon-zone-context) para `3. Contratados`:
 * selector principal de Contratista/Taller, quincena, condiciones de contrato y acciones.
 */
import React from 'react'
import { BookOpen, Plus, FilePlus2, RefreshCw, Download, ShieldAlert, Info } from 'lucide-react'
import CanonicalActiveSubmoduleBadge from '../../canonical/CanonicalActiveSubmoduleBadge'

export default function TesoreriaContratadosHeader({
  activeSubmodule = null,
  entities = [],
  selectedEntity = null,
  onSelectEntity,
  selectedPeriod = '',
  periods = [],
  onPeriodChange,
  canManageCc = false,
  loading = false,
  onStartInlineRow,
  onOpenNewModal,
  onRefresh,
  onExport,
}) {
  const w = selectedEntity?.worker || null
  const isWorkshop = selectedEntity?.entityType === 'WORKSHOP_CC'
  const consPct = Number(w?.consumables_discount_pct || 0)
  const safetyMode = String(w?.safety_items || '').trim().toUpperCase()

  return (
    <div className="alon-zone-context">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>

          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <CanonicalActiveSubmoduleBadge
                label={activeSubmodule?.label || '3. Contratados'}
                theme={activeSubmodule?.theme || 'amber'}
              />
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-950/90 text-amber-200 border border-amber-500/40">
                GALLO · LIBRO DE CUENTA CORRIENTE POR BARCO
              </span>
              {isWorkshop && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                  TALLER US$ · CONECTADO A CONTROL PAMPA
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="text-[11px] font-bold uppercase text-slate-400">Contratista / Taller:</label>
              <select
                value={selectedEntity?.id || ''}
                onChange={(e) => onSelectEntity?.(e.target.value)}
                className="bg-slate-950 border border-amber-500/60 rounded-xl px-3 py-1.5 text-xs font-black text-amber-200 focus:outline-none focus:border-amber-400 max-w-full sm:min-w-[280px] cursor-pointer"
              >
                {entities.map((ent) => (
                  <option key={ent.id} value={ent.id}>
                    {ent.entityType === 'WORKSHOP_CC' ? `🏭 ${ent.label} [US$]` : `${ent.hasActivity ? '● ' : '○ '}${ent.label}`}
                  </option>
                ))}
              </select>

              <select
                value={selectedPeriod}
                onChange={(e) => onPeriodChange?.(e.target.value)}
                title="Quincena activa para absorber retiros de Pañol y pre-cargar período"
                className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-cyan-300 cursor-pointer"
              >
                {periods.map((p) => (
                  <option key={p} value={p}>Quincena {p}</option>
                ))}
              </select>
            </div>

            {selectedEntity && (
              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                {w?.trade && (
                  <span className="px-2 py-0.5 rounded bg-slate-950/90 border border-slate-700 text-slate-300 font-bold">
                    Rubro: {w.trade}
                  </span>
                )}
                {!isWorkshop && w && (
                  <span className="px-2 py-0.5 rounded bg-slate-950/90 border border-cyan-800/60 text-cyan-200 font-semibold">
                    Consumibles: {consPct > 0 ? `Desc. ${consPct}%` : (w.consumables || 'A cargo cliente')}
                  </span>
                )}
                {!isWorkshop && safetyMode && (
                  <span
                    className={`px-2 py-0.5 rounded border font-semibold inline-flex items-center gap-1 ${
                      safetyMode === 'ASTILLERO'
                        ? 'bg-sky-950/80 border-sky-500/40 text-sky-200'
                        : 'bg-slate-950/90 border-slate-700 text-slate-300'
                    }`}
                  >
                    <ShieldAlert className="w-3 h-3 shrink-0" />
                    EPP / Seguro: {safetyMode}
                  </span>
                )}
                {w?.notes && (
                  <span
                    title={w.notes}
                    className="px-2 py-0.5 rounded bg-amber-950/50 border border-amber-500/35 text-amber-200 inline-flex items-center gap-1 max-w-md truncate"
                  >
                    <Info className="w-3 h-3 shrink-0" />
                    {w.notes}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canManageCc && selectedEntity && (
            <>
              <button
                type="button"
                onClick={onStartInlineRow}
                className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.6]" />
                <span>+ Fila en Blanco</span>
              </button>
              <button
                type="button"
                onClick={onOpenNewModal}
                className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
              >
                <FilePlus2 className="w-3.5 h-3.5" />
                <span>+ Cargar Movimiento</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
          <button
            type="button"
            onClick={onExport}
            className="px-3 py-2 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>
    </div>
  )
}
