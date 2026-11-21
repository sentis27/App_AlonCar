import React, { useMemo } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { cleanShipName } from '../../lib/laborConstants.js'
import { normalizeText } from '../../lib/tradesCatalog.js'
import { getRowWorkerPickerState, buildCrewRubroOptions } from '../../lib/laborRowOptions.js'
import { isMergedWorkOrder } from '../../lib/workOrderUnificationEngine.js'
import LaborSearchableSelect from './LaborSearchableSelect.jsx'
import { WorkOrderSelectorWithHover } from '../workOrders/WorkOrderSelectorWithHover.jsx'

/**
 * Tarjeta de operario en 2 renglones fluidos (0 px de scroll horizontal).
 * Renglón 1: # + Tipo · Operario / Prestador · Rubro + 🔓 · (Multi-Barco: Barco + OT).
 * Renglón 2: Hs Normales · Ext. 50% · Ext. 100% · Total · Tarea / Observaciones · 🗑️.
 */
export default function LaborCrewRow({
  row,
  index,
  isMultiOtMode,
  canRemove,
  ships = [],
  workOrders = [],
  workItems = [],
  eligibleCatalog = null,
  selectedContractorGroup = '',
  isWorkersExpanded = false,
  onToggleWorkersExpanded,
  selectedShipId,
  selectedWorkOrderId,
  isRowEmergencyOpen,
  onUpdateRow,
  onSelectWorker,
  onRemoveRow,
  onToggleRubroEmergency,
  onResolveHomonym
}) {
  const hNorm = parseFloat(row.hours_normal) || 0
  const h50 = parseFloat(row.hours_extra_50) || 0
  const h100 = parseFloat(row.hours_extra_100) || 0
  const totalRow = hNorm + h50 + h100

  const hasLoanedRubro = Boolean(
    row.worker_type === 'Astillero' &&
      row.default_rubro &&
      row.default_rubro !== 'General' &&
      row.rubro &&
      normalizeText(row.rubro) !== normalizeText(row.default_rubro)
  )

  const effectiveRowShipId = row.ship_id || selectedShipId
  const effectiveRowWoId = row.work_order_id || selectedWorkOrderId
  const rowEnabledWorkOrders = workOrders.filter(wo => {
    if (isMergedWorkOrder(wo)) return false
    if (String(wo.ship_id) !== String(effectiveRowShipId)) return false
    return workItems.some(i => String(i.work_order_id) === String(wo.id) && i.status === 'En ejecución')
  })

  const workerPicker = useMemo(() => getRowWorkerPickerState({
    catalog: eligibleCatalog,
    shipId: effectiveRowShipId,
    workOrderId: effectiveRowWoId,
    selectedContractorGroup,
    isMultiOtMode,
    isExpanded: isWorkersExpanded,
    workOrders,
    workItems
  }), [eligibleCatalog, effectiveRowShipId, effectiveRowWoId, selectedContractorGroup, isMultiOtMode, isWorkersExpanded, workOrders, workItems])

  const rubroOptions = useMemo(() => buildCrewRubroOptions(row, isRowEmergencyOpen), [row, isRowEmergencyOpen])

  const typeBadgeClass =
    row.worker_type === 'Astillero'
      ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
      : row.worker_type === 'Taller'
      ? 'bg-purple-950 text-purple-300 border-purple-800'
      : 'bg-amber-950 text-amber-300 border-amber-800'

  return (
    <div
      className={`p-2.5 rounded-xl border transition-colors space-y-2 w-full min-w-0 ${
        row.needs_review
          ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-400/60'
          : 'bg-slate-950/75 border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Renglón 1: Identificación, Rubro y Destino Barco/OT */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
        <div className={`${isMultiOtMode ? 'md:col-span-4' : 'md:col-span-7'} min-w-0 space-y-1`}>
          {row.homonym_candidates && row.homonym_candidates.length > 1 && (
            <div className="p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-[10px] text-amber-200 space-y-1">
              <div className="font-bold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                <span>Homónimo &ldquo;{row.worker_raw}&rdquo;: elegí operario</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {row.homonym_candidates.map(cand => (
                  <button
                    key={cand.name}
                    type="button"
                    onClick={() => onResolveHomonym(row.id, cand)}
                    className="px-2 py-0.5 rounded bg-amber-500/30 hover:bg-amber-500/50 text-amber-100 border border-amber-400/40 text-[10px] font-semibold cursor-pointer"
                  >
                    {cand.name} ({cand.trade})
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-5 h-5 shrink-0 rounded bg-slate-800 text-slate-300 font-mono text-[10px] font-bold flex items-center justify-center">
              {index + 1}
            </span>
            <span
              className={`px-1.5 py-1 rounded border text-[9px] font-bold shrink-0 uppercase ${typeBadgeClass}`}
              title={`Tipo: ${row.worker_type}`}
            >
              {row.worker_type === 'Contratista' ? 'Contr.' : row.worker_type}
            </span>
            <div className="flex-1 min-w-0">
              <LaborSearchableSelect
                required
                value={row.worker_name}
                options={workerPicker.options}
                placeholder="Operario / prestador..."
                headerTitle={isWorkersExpanded ? `🔓 Padrón Completo [H] (${workerPicker.options.length})` : `-- Habilitados en Barco (${workerPicker.options.length}) --`}
                emptyMessage={workerPicker.isEmptyStrict ? '⚠️ Sin operarios con OT activa en este barco.' : 'Sin coincidencias para el filtro.'}
                inputClassName="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary font-medium"
                onChangeText={(val) => onUpdateRow(row.id, 'worker_name', val)}
                onSelectOption={(val) => (onSelectWorker ? onSelectWorker(row.id, val) : onUpdateRow(row.id, 'worker_name', val))}
                expandConfig={{
                  isExpanded: isWorkersExpanded,
                  onToggleExpand: (next) => onToggleWorkersExpanded?.(typeof next === 'boolean' ? next : !isWorkersExpanded),
                  enabledCount: workerPicker.enabledCount,
                  expandedCount: workerPicker.expandedCount
                }}
                fallbackExpandCountFn={(q) => {
                  const cleanQ = normalizeText(q)
                  if (!cleanQ) return workerPicker.expandedCount
                  const full = getRowWorkerPickerState({ catalog: eligibleCatalog, shipId: effectiveRowShipId, workOrderId: effectiveRowWoId, selectedContractorGroup, isMultiOtMode, isExpanded: true, workOrders, workItems })
                  return full.options.filter((o) => normalizeText(o.searchKeywords || o.label).includes(cleanQ)).length
                }}
              />
            </div>
          </div>
        </div>

        <div className={`${isMultiOtMode ? 'md:col-span-3' : 'md:col-span-5'} min-w-0`}>
          <div className="flex items-center gap-1 min-w-0">
            <div className="flex-1 min-w-0">
              <LaborSearchableSelect
                required
                value={row.rubro}
                options={rubroOptions}
                placeholder="Elegir rubro..."
                headerTitle={isRowEmergencyOpen ? `🔓 Catálogo Completo de Rubros (${rubroOptions.length})` : `⭐ Rubros del Operario (${rubroOptions.length})`}
                emptyMessage="Sin rubros coincidentes (probá con 🔓)."
                inputClassName={`bg-slate-900 border rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary font-medium ${hasLoanedRubro ? 'border-purple-500 text-purple-200' : 'border-slate-700'}`}
                onChangeText={(val) => onUpdateRow(row.id, 'rubro', val)}
                onSelectOption={(val) => onUpdateRow(row.id, 'rubro', val)}
              />
            </div>
            <button
              type="button"
              onClick={() => onToggleRubroEmergency(row.id)}
              className={`p-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors shrink-0 ${
                isRowEmergencyOpen
                  ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
              }`}
              title="Puerta de Emergencia: desbloquear lista completa de rubros para préstamos operativos"
            >
              🔓
            </button>
          </div>
        </div>

        {isMultiOtMode && (
          <>
            <div className="md:col-span-2 min-w-0">
              <select
                value={row.ship_id || selectedShipId}
                onChange={(e) => onUpdateRow(row.id, 'ship_id', e.target.value)}
                title="Barco asignado a esta fila"
                className="w-full bg-slate-900 border border-purple-500/40 rounded-lg px-2 py-1.5 text-xs text-purple-200 font-semibold focus:outline-none focus:border-cyan-400"
              >
                {ships.map(s => (
                  <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                    {cleanShipName(s.name)}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3 min-w-0">
              <WorkOrderSelectorWithHover
                value={row.work_order_id || selectedWorkOrderId || ''}
                onChange={(nextWoId) => onUpdateRow(row.id, 'work_order_id', nextWoId)}
                availableWos={rowEnabledWorkOrders}
                ship={ships.find((s) => String(s.id) === String(effectiveRowShipId)) || null}
                workItems={workItems}
                allWorkOrders={workOrders}
                contractorName={selectedContractorGroup}
                placeholder="-- ⚠️ OT en blanco --"
                showPreviewCard={false}
              />
            </div>
          </>
        )}
      </div>

      {/* Renglón 2: Horas, Total, Observación amplia y Eliminar */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-1.5 border-t border-slate-800/70">
        <div className="flex items-center gap-1.5 shrink-0">
          <label className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
            <span>Norm</span>
            <input
              type="number"
              step="0.5"
              min="0"
              max="24"
              value={row.hours_normal}
              onChange={(e) => onUpdateRow(row.id, 'hours_normal', e.target.value)}
              className="w-14 bg-slate-900 border border-slate-700 rounded-lg px-1.5 py-1 text-xs text-white text-center font-bold focus:outline-none focus:border-primary font-mono"
            />
          </label>
          <label className="flex items-center gap-1 text-[10px] font-bold text-cyan-400">
            <span>50%</span>
            <input
              type="number"
              step="0.5"
              min="0"
              max="24"
              value={row.hours_extra_50}
              onChange={(e) => onUpdateRow(row.id, 'hours_extra_50', e.target.value)}
              className="w-14 bg-slate-900 border border-cyan-800/60 rounded-lg px-1.5 py-1 text-xs text-cyan-300 text-center font-bold focus:outline-none focus:border-primary font-mono"
            />
          </label>
          <label className="flex items-center gap-1 text-[10px] font-bold text-amber-400">
            <span>100%</span>
            <input
              type="number"
              step="0.5"
              min="0"
              max="24"
              value={row.hours_extra_100}
              onChange={(e) => onUpdateRow(row.id, 'hours_extra_100', e.target.value)}
              className="w-14 bg-slate-900 border border-amber-800/60 rounded-lg px-1.5 py-1 text-xs text-amber-300 text-center font-bold focus:outline-none focus:border-primary font-mono"
            />
          </label>
          <span className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 font-mono font-extrabold text-primary text-[11px] whitespace-nowrap">
            {totalRow} hs
          </span>
        </div>

        <input
          type="text"
          placeholder="Tarea / Observaciones del trabajo..."
          value={row.notes}
          onChange={(e) => onUpdateRow(row.id, 'notes', e.target.value)}
          className="flex-1 min-w-[180px] bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary"
        />

        <button
          type="button"
          disabled={!canRemove}
          onClick={() => onRemoveRow(row.id)}
          className="p-1.5 text-slate-500 hover:text-rose-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-lg hover:bg-rose-500/10 cursor-pointer shrink-0"
          title="Eliminar fila"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
