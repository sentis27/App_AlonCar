import React, { useMemo } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { cleanShipName } from '../../lib/laborConstants.js'
import { normalizeText } from '../../lib/tradesCatalog.js'
import { getRowWorkerPickerState, buildCrewRubroOptions } from '../../lib/laborRowOptions.js'
import { isMergedWorkOrder } from '../../lib/workOrderUnificationEngine.js'
import LaborSearchableSelect from './LaborSearchableSelect.jsx'
import { WorkOrderSelectorWithHover } from '../workOrders/WorkOrderSelectorWithHover.jsx'

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

  return (
    <div
      className={`p-3 rounded-xl border transition-colors ${
        row.needs_review
          ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-400/60'
          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
      }`}
    >
      <div
        className={`grid ${
          isMultiOtMode
            ? 'grid-cols-[105px_minmax(190px,1.4fr)_minmax(180px,1.3fr)_minmax(210px,1.6fr)_68px_68px_68px_60px_minmax(150px,1.2fr)_36px]'
            : 'grid-cols-[115px_minmax(200px,1.5fr)_minmax(190px,1.4fr)_72px_72px_72px_65px_minmax(150px,1.1fr)_38px]'
        } gap-2.5 items-center`}
      >
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-5 h-5 shrink-0 rounded bg-slate-800 text-slate-300 font-mono text-[11px] font-bold flex items-center justify-center">
            {index + 1}
          </span>
          <span
            className={`w-[78px] text-[10px] font-bold px-1.5 py-1.5 rounded border text-center truncate ${
              row.worker_type === 'Astillero'
                ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                : row.worker_type === 'Taller'
                ? 'bg-purple-950 text-purple-300 border-purple-800'
                : 'bg-amber-950 text-amber-300 border-amber-800'
            }`}
          >
            {row.worker_type}
          </span>
        </div>

        <div className="space-y-1">
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

          <LaborSearchableSelect
            required
            value={row.worker_name}
            options={workerPicker.options}
            placeholder="Escribir o elegir operario..."
            headerTitle={isWorkersExpanded ? `🔓 Padrón Completo [H] (${workerPicker.options.length})` : `-- Habilitados en Barco (${workerPicker.options.length}) --`}
            emptyMessage={workerPicker.isEmptyStrict ? '⚠️ Sin operarios con OT activa en este barco.' : 'Sin coincidencias para el filtro.'}
            inputClassName="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary font-medium"
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

        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <LaborSearchableSelect
              required
              value={row.rubro}
              options={rubroOptions}
              placeholder="Elegir o filtrar rubro..."
              headerTitle={isRowEmergencyOpen ? `🔓 Catálogo Completo de Rubros (${rubroOptions.length})` : `⭐ Rubros del Operario (${rubroOptions.length})`}
              emptyMessage="Sin rubros coincidentes (probá con 🔓)."
              inputClassName={`bg-slate-900 border rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary font-medium ${hasLoanedRubro ? 'border-purple-500 text-purple-200' : 'border-slate-700'}`}
              onChangeText={(val) => onUpdateRow(row.id, 'rubro', val)}
              onSelectOption={(val) => onUpdateRow(row.id, 'rubro', val)}
            />
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
          <div className="space-y-1">
            <select
              value={row.ship_id || selectedShipId}
              onChange={(e) => onUpdateRow(row.id, 'ship_id', e.target.value)}
              className="w-full bg-slate-900 border border-purple-500/40 rounded-lg px-2 py-1 text-[11px] text-purple-200 focus:outline-none"
            >
              {ships.map(s => (
                <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                  {cleanShipName(s.name)}
                </option>
              ))}
            </select>
            <WorkOrderSelectorWithHover
              value={row.work_order_id || selectedWorkOrderId || ''}
              onChange={(nextWoId) => onUpdateRow(row.id, 'work_order_id', nextWoId)}
              availableWos={rowEnabledWorkOrders}
              ship={ships.find((s) => String(s.id) === String(effectiveRowShipId)) || null}
              workItems={workItems}
              allWorkOrders={workOrders}
              contractorName={selectedContractorGroup}
              placeholder="-- ⚠️ OT en blanco --"
            />
          </div>
        )}

        <div>
          <input
            type="number"
            step="0.5"
            min="0"
            max="24"
            value={row.hours_normal}
            onChange={(e) => onUpdateRow(row.id, 'hours_normal', e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-1.5 py-1.5 text-xs text-white text-center font-bold focus:outline-none focus:border-primary font-mono"
          />
        </div>

        <div>
          <input
            type="number"
            step="0.5"
            min="0"
            max="24"
            value={row.hours_extra_50}
            onChange={(e) => onUpdateRow(row.id, 'hours_extra_50', e.target.value)}
            className="w-full bg-slate-900 border border-cyan-800/60 rounded-lg px-1.5 py-1.5 text-xs text-cyan-300 text-center font-bold focus:outline-none focus:border-primary font-mono"
          />
        </div>

        <div>
          <input
            type="number"
            step="0.5"
            min="0"
            max="24"
            value={row.hours_extra_100}
            onChange={(e) => onUpdateRow(row.id, 'hours_extra_100', e.target.value)}
            className="w-full bg-slate-900 border border-amber-800/60 rounded-lg px-1.5 py-1.5 text-xs text-amber-300 text-center font-bold focus:outline-none focus:border-primary font-mono"
          />
        </div>

        <div className="text-center font-mono font-extrabold text-primary text-xs bg-slate-900/80 py-1.5 rounded-lg border border-slate-800">
          {totalRow} hs
        </div>

        <div>
          <input
            type="text"
            placeholder="Tarea / Nota..."
            value={row.notes}
            onChange={(e) => onUpdateRow(row.id, 'notes', e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            disabled={!canRemove}
            onClick={() => onRemoveRow(row.id)}
            className="p-1.5 text-slate-500 hover:text-rose-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded hover:bg-rose-500/10 cursor-pointer"
            title="Eliminar fila"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
