import React from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, Ship, Briefcase, Calendar, Info, AlertTriangle } from 'lucide-react'
import { cleanShipName } from '../../lib/laborConstants.js'

export default function LaborCascadeHeader({
  ships = [],
  selectedShipId,
  setSelectedShipId,
  selectedContractorGroup,
  onContractorGroupChange,
  enabledContractorsForShip = [],
  selectedWorkOrderId,
  setSelectedWorkOrderId,
  availableWorkOrders = [],
  selectedWorkItemId,
  setSelectedWorkItemId,
  activeItemsForSelectedWo = [],
  dateLogged,
  setDateLogged,
  workType,
  setWorkType,
  blockedWorkItemsForShip = [],
  currentWorkOrder,
  currentWorkItem
}) {
  return (
    <div className="alon-zone-entry p-5 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-xs uppercase tracking-wider font-bold text-primary flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            Orden de Trabajo & Destino Por Defecto (Filtro de Habilitación en Cascada)
          </h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-700/50 font-bold">
            Solo OTs &ldquo;En ejecución&rdquo;
          </span>
        </div>
        <div className="flex items-center gap-2">
          {blockedWorkItemsForShip.length > 0 && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/70 text-amber-300 border border-amber-800/50 font-semibold"
              title="Trabajos bloqueados para recibir costos."
            >
              🔒 {blockedWorkItemsForShip.length} trabajo(s) bloqueado(s) en este barco
            </span>
          )}
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-cyan-950/70 text-cyan-400 border border-cyan-800/40 font-semibold font-mono">
            Centro de Costo: CLIENTE (Fijo)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold flex items-center justify-center">
              1
            </span>
            <Ship className="w-3.5 h-3.5 text-cyan-400" />
            Barco / Embarcación
          </label>
          <select
            value={selectedShipId}
            onChange={(e) => setSelectedShipId(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
          >
            {ships.map(ship => (
              <option key={ship.id} value={ship.id} className="bg-slate-900">
                {cleanShipName(ship.name)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center justify-center">
              2
            </span>
            <Briefcase className="w-3.5 h-3.5 text-amber-400" />
            Contratista / Grupo Habilitado
          </label>
          <select
            value={selectedContractorGroup}
            onChange={(e) => onContractorGroupChange(e.target.value)}
            className="w-full bg-slate-950/80 border border-amber-500/40 rounded-lg px-3 py-2 text-xs text-amber-200 font-semibold focus:outline-none focus:border-amber-400"
          >
            {enabledContractorsForShip.length === 0 ? (
              <option value="">🔒 Sin contratistas habilitados (En ejecución)</option>
            ) : (
              enabledContractorsForShip.map(contractor => (
                <option key={contractor} value={contractor} className="bg-slate-900 text-white">
                  {contractor}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold flex items-center justify-center">
              3
            </span>
            <ClipboardList className="w-3.5 h-3.5 text-emerald-400" />
            OT ({availableWorkOrders.length} hab. / Opcional)
          </label>
          <select
            value={selectedWorkOrderId}
            onChange={(e) => setSelectedWorkOrderId(e.target.value)}
            className={`w-full bg-slate-950/80 border rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-400 ${
              !selectedWorkOrderId ? 'border-amber-500/60 text-amber-300' : 'border-emerald-500/40 text-white'
            }`}
          >
            <option value="" className="bg-slate-900 text-amber-300 font-bold">
              -- ⚠️ Dejar OT en blanco (Pendiente de apertura) --
            </option>
            {availableWorkOrders.map(wo => (
              <option key={wo.id} value={wo.id} className="bg-slate-900 text-white">
                {wo.ot_number ? `${wo.ot_number} — ` : ''}{wo.title}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              Fecha Trabajo
            </label>
            <input
              type="date"
              value={dateLogged}
              onChange={(e) => setDateLogged(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Modalidad
            </label>
            <select
              value={workType}
              onChange={(e) => setWorkType(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
            >
              <option value="HORA">Por Hora</option>
              <option value="PRESUPUESTO">Presupuesto</option>
              <option value="CONTROL">Control</option>
            </select>
          </div>
        </div>
      </div>

      {activeItemsForSelectedWo.length > 1 && (
        <div className="pt-1">
          <label className="block text-[11px] font-semibold text-cyan-300 mb-1">
            Trabajo específico dentro de {currentWorkOrder?.ot_number || currentWorkOrder?.title} ({activeItemsForSelectedWo.length} habilitados para {selectedContractorGroup}):
          </label>
          <select
            value={selectedWorkItemId}
            onChange={(e) => setSelectedWorkItemId(e.target.value)}
            className="w-full bg-slate-950 border border-cyan-500/40 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
          >
            {activeItemsForSelectedWo.map((item, idx) => (
              <option key={item.id} value={item.id} className="bg-slate-900">
                Trabajo #{idx + 1}: {item.description}
              </option>
            ))}
          </select>
        </div>
      )}

      {currentWorkOrder ? (
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div>
                <span className="font-mono font-bold text-emerald-300 mr-1.5">
                  [{currentWorkOrder.ot_number || 'OT'}]
                </span>
                <strong className="text-white">{currentWorkOrder.title}: </strong>
                <span className="text-slate-200 font-medium">
                  {currentWorkItem?.description || currentWorkOrder.description || 'Sin descripción detallada registrada.'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                <span>
                  Jefe de Obra: <strong className="text-cyan-300">{currentWorkItem?.foreman_name || currentWorkOrder.foreman_name || 'S/D'}</strong>
                </span>
                <span>&bull;</span>
                <span>
                  Contratistas habilitados:{' '}
                  <strong className="text-amber-300">
                    {(currentWorkItem?.contractors || []).join(' / ') || selectedContractorGroup || 'Astillero'}
                  </strong>
                </span>
              </div>
            </div>
          </div>
          <Link to="/ots" className="shrink-0 text-[11px] text-cyan-400 hover:text-cyan-300 underline font-semibold">
            Ver en Órdenes de Trabajo &rarr;
          </Link>
        </div>
      ) : (
        <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 flex items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              No hay Órdenes de Trabajo en estado <strong>&ldquo;En ejecución&rdquo;</strong> habilitadas para este barco/contratista. Podés elegir otro barco en cada fila (Modo Multi-Barco) o habilitar la OT en Órdenes de Trabajo.
            </span>
          </div>
          <Link
            to="/ots"
            className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold"
          >
            Ir a OTs
          </Link>
        </div>
      )}
    </div>
  )
}
