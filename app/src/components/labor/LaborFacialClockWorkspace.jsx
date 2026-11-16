import React, { useState } from 'react'
import { Ship, Anchor, ChevronDown, ChevronRight, GripVertical, Plus } from 'lucide-react'

/**
 * Tablero interactivo de Reloj Facial (Split PC Drag & Drop + Celular Táctil).
 */
export default function LaborFacialClockWorkspace({
  groups = [],
  visibleShips = [],
  shipLocationTab,
  setShipLocationTab,
  activeTargetShip,
  setSelectedShipId,
  expandedGroups,
  onToggleGroupExpand,
  onOpenAssignment,
  onSimulateEntry
}) {
  const [dragTargetShipId, setDragTargetShipId] = useState(null)
  const [dragPayload, setDragPayload] = useState(null)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
      {/* BARCOS POR ESTADÍA (arriba en celular para tocar con el pulgar; derecha en PC) */}
      <div className="lg:col-span-7 lg:order-2 alon-chunk-emerald space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-black uppercase text-emerald-300 flex items-center gap-1.5">
            <Ship className="w-4 h-4" /> Barcos por Estadía ({visibleShips.length})
          </span>
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center text-[11px]">
            <button
              type="button"
              onClick={() => setShipLocationTab('ASTILLERO')}
              className={`px-3 py-1 rounded-lg font-bold cursor-pointer ${shipLocationTab === 'ASTILLERO' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
            >
              En Astillero (Varadero / Muelle)
            </button>
            <button
              type="button"
              onClick={() => setShipLocationTab('PUERTO')}
              className={`px-3 py-1 rounded-lg font-bold cursor-pointer ${shipLocationTab === 'PUERTO' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
            >
              <Anchor className="w-3 h-3 inline mr-1" />En Puerto
            </button>
          </div>
        </div>

        {visibleShips.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-700 rounded-xl">
            No hay barcos registrados en {shipLocationTab === 'ASTILLERO' ? 'Astillero' : 'Puerto'}.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {visibleShips.map(ship => {
              const isSelected = activeTargetShip?.id === ship.id
              const isDropOver = dragTargetShipId === ship.id
              return (
                <div
                  key={ship.id}
                  onClick={() => setSelectedShipId(ship.id)}
                  onDragOver={(e) => { e.preventDefault(); setDragTargetShipId(ship.id) }}
                  onDragLeave={() => setDragTargetShipId(null)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragTargetShipId(null)
                    if (dragPayload) onOpenAssignment(ship, dragPayload.workers, dragPayload.label)
                    setDragPayload(null)
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer select-none space-y-1.5 ${
                    isDropOver
                      ? 'bg-emerald-950/80 border-emerald-400 border-dashed ring-2 ring-emerald-400 scale-[1.02]'
                      : isSelected
                      ? 'bg-cyan-950/60 border-cyan-400 ring-1 ring-cyan-400'
                      : 'bg-slate-950/90 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="font-black text-xs text-white truncate">{ship.name}</div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-cyan-300 truncate">{ship.locationLabel}</span>
                    <span className="text-[11px] font-mono font-bold text-emerald-300">{ship.hoursToday}h</span>
                  </div>
                  {isDropOver && <div className="text-[10px] font-bold text-emerald-300 text-center pt-1">Soltar aquí</div>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* SÁBANA DE PERSONAL PRESENTE (izquierda en PC, debajo en celular) */}
      <div className="lg:col-span-5 lg:order-1 alon-chunk-sky space-y-2.5 max-h-[52vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-black uppercase text-sky-300">Sábana Presentes ({groups.length} grupos)</span>
          <span className="text-[10px] text-slate-400 hidden sm:inline">Arrastrá al barco o usá + Asignar</span>
        </div>

        {groups.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-700 rounded-xl space-y-2">
            <p>Todavía no importaste el CSV de ingreso de hoy.</p>
            <button type="button" onClick={onSimulateEntry} className="px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold cursor-pointer">
              Cargar Muestra desde Padrón
            </button>
          </div>
        ) : (
          groups.map(group => {
            const isOpen = expandedGroups.has(group.groupName)
            const pct = group.totalEstimated > 0 ? Math.min(100, Math.round((group.totalLogged / group.totalEstimated) * 100)) : 0
            return (
              <div
                key={group.groupName}
                draggable
                onDragStart={() => setDragPayload({ workers: group.workers, label: group.groupName })}
                className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 hover:border-cyan-500/50 space-y-2 cursor-grab active:cursor-grabbing"
              >
                <div className="flex items-center justify-between gap-2">
                  <button type="button" onClick={() => onToggleGroupExpand(group.groupName)} className="flex items-center gap-1.5 min-w-0 text-left cursor-pointer">
                    <GripVertical className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                    <span className="text-xs font-black text-white truncate">{group.groupName} ({group.workers.length})</span>
                  </button>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[11px] font-mono font-bold ${group.totalPending === 0 ? 'text-emerald-400' : 'text-amber-300'}`}>
                      {group.totalLogged}/{group.totalEstimated}h
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenAssignment(activeTargetShip, group.workers, group.groupName)}
                      className="px-2 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-[10px] font-black flex items-center gap-0.5 cursor-pointer"
                      title={`Asignar grupo a ${activeTargetShip?.name || 'barco seleccionado'}`}
                    >
                      <Plus className="w-3 h-3 stroke-[3]" /> Asignar
                    </button>
                  </div>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div className={`h-full transition-all ${pct >= 100 ? 'bg-emerald-400' : 'bg-cyan-400'}`} style={{ width: `${pct}%` }} />
                </div>
                {isOpen && (
                  <div className="space-y-1 pt-1 border-t border-slate-800/80">
                    {group.workers.map(w => (
                      <div
                        key={w.worker_name}
                        draggable
                        onDragStart={(e) => { e.stopPropagation(); setDragPayload({ workers: [w], label: w.worker_name }) }}
                        className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-800/80 text-[11px] cursor-grab"
                      >
                        <span className="text-slate-200 truncate">{w.worker_name}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`font-mono font-bold ${w.pendingHours === 0 ? 'text-emerald-400' : 'text-amber-300'}`}>
                            {w.loggedHours}/{w.estimated_hours}h
                          </span>
                          <button
                            type="button"
                            onClick={() => onOpenAssignment(activeTargetShip, [w], w.worker_name)}
                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-cyan-300 text-[10px] font-bold cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
