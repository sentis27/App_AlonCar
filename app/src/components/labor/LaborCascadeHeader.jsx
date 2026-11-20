import React from 'react'
import { Link } from 'react-router-dom'
import { Ship, Briefcase, ClipboardList, Calendar, AlertTriangle } from 'lucide-react'
import { cleanShipName } from '../../lib/laborConstants.js'
import { WorkOrderSelectorWithHover } from '../workOrders/WorkOrderSelectorWithHover.jsx'

export default function LaborCascadeHeader({
  ships = [],
  workOrders = [],
  workItems = [],
  selectedShipId,
  setSelectedShipId,
  selectedContractorGroup,
  onContractorGroupChange,
  enabledContractorsForShip = [],
  isHeaderContractorsExpanded = false,
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
  compact = false
}) {
  return (
    <div className={compact ? 'space-y-2' : 'alon-zone-entry p-4 space-y-3'}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 items-end">
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
            <Ship className="w-3 h-3 text-cyan-400" />
            <span>Barco / Buque <span className="text-rose-400">*</span></span>
          </label>
          <select
            autoFocus
            value={selectedShipId}
            onChange={(e) => setSelectedShipId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-cyan-400"
          >
            {ships.map((ship) => (
              <option key={ship.id} value={ship.id} className="bg-slate-900">
                {cleanShipName(ship.name)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
            <Briefcase className="w-3 h-3 text-amber-400" />
            <span>Contratista / Grupo</span>
          </label>
          <select
            value={selectedContractorGroup}
            onChange={(e) => onContractorGroupChange(e.target.value)}
            className="w-full bg-slate-950 border border-amber-500/40 rounded-lg px-2.5 py-1.5 text-xs text-amber-200 font-bold focus:outline-none focus:border-amber-400"
          >
            {enabledContractorsForShip.length === 0 ? (
              <option value="">🔒 Sin habilitados (En ejecución)</option>
            ) : (
              enabledContractorsForShip.map((contractor) => (
                <option key={contractor} value={contractor} className="bg-slate-900 text-white">
                  {contractor}
                </option>
              ))
            )}
            {selectedShipId && !isHeaderContractorsExpanded && (
              <option value="__EXPANDIR_CONTRATISTAS__" className="bg-slate-900 text-amber-300 font-bold">
                🔓 Expandir (Todos los contratistas y Astillero)...
              </option>
            )}
            {selectedShipId && isHeaderContractorsExpanded && (
              <option value="__CONTRAER_CONTRATISTAS__" className="bg-slate-900 text-sky-300 font-bold">
                🔒 Contraer (Solo habilitados del barco)
              </option>
            )}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
            <ClipboardList className="w-3 h-3 text-emerald-400" />
            <span>OT ({availableWorkOrders.length} hab. / Opcional)</span>
          </label>
          <WorkOrderSelectorWithHover
            value={selectedWorkOrderId}
            onChange={(nextWoId) => setSelectedWorkOrderId(nextWoId)}
            availableWos={availableWorkOrders}
            ship={ships.find((s) => String(s.id) === String(selectedShipId)) || null}
            workItems={workItems}
            allWorkOrders={workOrders.length ? workOrders : availableWorkOrders}
            contractorName={selectedContractorGroup}
            placeholder="-- ⚠️ Dejar OT en blanco --"
            showPreviewCard={false}
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-cyan-400" />
            <span>Fecha Trabajo</span>
          </label>
          <input
            type="date"
            value={dateLogged}
            onChange={(e) => setDateLogged(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1">
            Modalidad (Col. F)
          </label>
          <select
            value={workType}
            onChange={(e) => setWorkType(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-cyan-400"
          >
            <option value="HORA">Por Hora</option>
            <option value="PRESUPUESTO">Presupuesto</option>
            <option value="CONTROL">Control</option>
          </select>
        </div>
      </div>

      {activeItemsForSelectedWo.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[11px] font-semibold text-cyan-300 shrink-0">
            Subtarea de {currentWorkOrder?.ot_number || currentWorkOrder?.title} ({activeItemsForSelectedWo.length}):
          </label>
          <select
            value={selectedWorkItemId}
            onChange={(e) => setSelectedWorkItemId(e.target.value)}
            className="flex-1 min-w-[260px] bg-slate-950 border border-cyan-500/40 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-cyan-400"
          >
            {activeItemsForSelectedWo.map((item, idx) => (
              <option key={item.id} value={item.id} className="bg-slate-900">
                Trabajo #{idx + 1}: {item.description}
              </option>
            ))}
          </select>
        </div>
      )}

      {!currentWorkOrder && (
        <div className="px-3 py-1.5 rounded-xl bg-amber-950/30 border border-amber-500/40 flex items-center justify-between gap-2 text-[11px] text-amber-200">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">
              Sin OT &ldquo;En ejecución&rdquo; seleccionada: podés cargar en blanco, usar <strong>Multi-Barco</strong> o abrir la OT.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {blockedWorkItemsForShip.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-800/50 font-semibold">
                🔒 {blockedWorkItemsForShip.length} bloq.
              </span>
            )}
            <Link to="/ots" className="px-2.5 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold">
              Ir a OTs
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
