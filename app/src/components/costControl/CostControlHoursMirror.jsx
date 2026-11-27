import { useState, useMemo } from 'react'
import { Clock, ArrowLeft, GitFork, Pencil } from 'lucide-react'
import CanonicalOtBadge from '../canonical/CanonicalOtBadge.jsx'
import CostControlSplitHoursRow from './CostControlSplitHoursRow.jsx'
import CostControlMirrorQuincenaCard from './CostControlMirrorQuincenaCard.jsx'
import { buildContractorHoursMirror } from '../../lib/costControlMirrorHelpers.js'
import { buildLookupMap } from '../../lib/gridPerformanceHelpers.js'

export default function CostControlHoursMirror({
  laborLogs = [],
  workers = [],
  ships = [],
  workOrders = [],
  workItems = [],
  snapshot = null,
  activeContractorEntity = '',
  focusedRow = null,
  selectedTxIds = new Set(),
  saving = false,
  onApplyShipOtToMaterials,
  onMoveDateToPrevQuincena,
  onUpdateLaborLog,
  onSplitLaborLog,
  onOpenLaborShipOtModal,
}) {
  const [selectedTargetKey, setSelectedTargetKey] = useState(null)
  const [splittingLogId, setSplittingLogId] = useState(null)
  const [editingHoursLogId, setEditingHoursLogId] = useState(null)
  const [hoursDraft, setHoursDraft] = useState('')

  const shipsById = useMemo(() => buildLookupMap(ships), [ships])
  const workOrdersById = useMemo(() => buildLookupMap(workOrders), [workOrders])

  const mirror = useMemo(
    () =>
      buildContractorHoursMirror({
        laborLogs,
        workers,
        ships,
        workOrders,
        entity: activeContractorEntity,
        periodKey: snapshot?.periodKey || '',
        prevPeriodKey: snapshot?.prevPeriodKey || '',
        focusDateIso: focusedRow?.dateIso || '',
        focusShipId: focusedRow?.shipId || null,
        focusOtTitle: focusedRow?.otTitle || focusedRow?.otNumber || '',
      }),
    [laborLogs, workers, ships, workOrders, activeContractorEntity, snapshot, focusedRow]
  )

  const targetMaterialIds = useMemo(
    () => (selectedTxIds.size > 0 ? Array.from(selectedTxIds) : focusedRow ? [focusedRow.id] : []),
    [selectedTxIds, focusedRow]
  )

  const effectiveDayLog = useMemo(() => {
    if (selectedTargetKey?.startsWith('day:')) {
      const id = selectedTargetKey.slice(4)
      const hit = mirror.dayLogs.find((l) => String(l.id) === id)
      if (hit) return hit
    }
    return mirror.dayLogs[0] || null
  }, [selectedTargetKey, mirror.dayLogs])

  const effectiveTarget = useMemo(() => {
    if (selectedTargetKey?.startsWith('day:')) {
      const hit = mirror.dayLogs.find((l) => String(l.id) === selectedTargetKey.slice(4))
      if (hit) return { key: `day:${hit.id}`, shipId: hit.ship_id || null, shipName: hit.shipName, workOrderId: hit.work_order_id || null, otLabel: hit.otLabel }
    }
    if (selectedTargetKey?.startsWith('q:')) {
      const hit = mirror.quincenaGroups.find((g) => g.key === selectedTargetKey.slice(2))
      if (hit) return { key: `q:${hit.key}`, shipId: hit.shipId, shipName: hit.shipName, workOrderId: hit.workOrderId, otLabel: hit.otLabel }
    }
    const otHit = mirror.quincenaGroups.find((g) => g.matchesFocusOtOnOtherShip)
    if (otHit) return { key: `q:${otHit.key}`, shipId: otHit.shipId, shipName: otHit.shipName, workOrderId: otHit.workOrderId, otLabel: otHit.otLabel }
    if (mirror.dayLogs[0]) {
      const d = mirror.dayLogs[0]
      return { key: `day:${d.id}`, shipId: d.ship_id || null, shipName: d.shipName, workOrderId: d.work_order_id || null, otLabel: d.otLabel }
    }
    if (mirror.quincenaGroups[0]) {
      const g = mirror.quincenaGroups[0]
      return { key: `q:${g.key}`, shipId: g.shipId, shipName: g.shipName, workOrderId: g.workOrderId, otLabel: g.otLabel }
    }
    return null
  }, [selectedTargetKey, mirror.dayLogs, mirror.quincenaGroups])

  const startHoursEdit = (log) => {
    setEditingHoursLogId(log.id)
    setHoursDraft(String(log.totalHours ?? 0))
  }

  const commitInlineHours = async (log) => {
    const val = Number(hoursDraft)
    setEditingHoursLogId(null)
    if (!Number.isFinite(val) || val < 0 || val === log.totalHours) return
    await onUpdateLaborLog({
      logId: log.id,
      patch: { hours_normal: val, hours_extra_50: 0, hours_extra_100: 0 },
      previousLog: log,
    })
  }

  return (
    <div className="rounded-2xl border border-indigo-500/35 border-t-2 border-t-indigo-400 bg-slate-950/95 p-4 space-y-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Clock className="w-4 h-4 text-indigo-300 shrink-0" />
          <h2 className="text-sm font-black text-white truncate">
            Espejo de Horas · {activeContractorEntity || 'Sin contratista'}
          </h2>
        </div>
        {focusedRow && (
          <span className="px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-[11px] font-mono text-cyan-200">
            Día enfocado: {focusedRow.dateAr}
          </span>
        )}
      </div>

      {/* BLOQUE 1: Qué hizo ESE MISMO DÍA */}
      <div className="rounded-xl bg-slate-900/75 border border-slate-800 p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-black text-cyan-200 uppercase tracking-wider">
            Qué hizo el {focusedRow?.dateAr || 'día seleccionado'} (Mismo día)
          </h3>
          <span className="text-[11px] font-mono text-slate-300">
            Total día: <strong className="text-white">{mirror.dayTotalHours} hs</strong>
          </span>
        </div>

        {!focusedRow ? (
          <p className="text-xs text-slate-400">Seleccioná una línea de material a la izquierda para inspeccionar ese día.</p>
        ) : mirror.dayLogs.length === 0 ? (
          <p className="text-xs text-amber-300/90">
            Sin horas cargadas para {activeContractorEntity} el {focusedRow.dateAr}. Revisá el mapa de quincena abajo o la quincena anterior.
          </p>
        ) : (
          <div className="space-y-1.5">
            {mirror.dayLogs.map((log) => {
              const targetKey = `day:${log.id}`
              const isSelected = effectiveTarget?.key === targetKey
              const shipObj = log.ship_id ? shipsById.get(log.ship_id) : null
              const woObj = log.work_order_id ? workOrdersById.get(log.work_order_id) : null

              return (
                <div key={log.id}>
                  <div
                    onClick={() => setSelectedTargetKey(targetKey)}
                    className={`rounded-lg border px-2.5 py-2 text-xs cursor-pointer transition-all flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-cyan-950/60 border-cyan-400 shadow-sm'
                        : 'bg-slate-950/90 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-cyan-200">{log.shipName}</span>
                        <CanonicalOtBadge wo={woObj} ship={shipObj} workItems={workItems} workOrders={workOrders} variant="inline" />
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">{log.worker_name}</div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {editingHoursLogId === log.id ? (
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          autoFocus
                          value={hoursDraft}
                          onChange={(e) => setHoursDraft(e.target.value)}
                          onBlur={() => commitInlineHours(log)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitInlineHours(log)
                            if (e.key === 'Escape') setEditingHoursLogId(null)
                          }}
                          className="w-16 bg-slate-950 text-cyan-200 border border-cyan-400 rounded px-1.5 py-0.5 text-xs font-mono"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => startHoursEdit(log)}
                          className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 font-mono font-bold text-slate-100 cursor-pointer"
                          title="Editar horas trabajadas en línea"
                        >
                          {log.totalHours} hs ✎
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenLaborShipOtModal(log)}
                        className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 border border-slate-700 cursor-pointer"
                        title="Corregir Buque y OT en este parte de horas"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {splittingLogId === log.id && (
                    <CostControlSplitHoursRow
                      key={`${log.id}:${focusedRow?.id || ''}`}
                      sourceLog={log}
                      dayLogs={mirror.dayLogs}
                      focusedMaterialRow={focusedRow}
                      ships={ships}
                      workOrders={workOrders}
                      workItems={workItems}
                      saving={saving}
                      onConfirmSplit={onSplitLaborLog}
                      onCancel={() => setSplittingLogId(null)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-slate-800/80">
          <button
            type="button"
            disabled={saving || !effectiveTarget?.shipId || targetMaterialIds.length === 0}
            onClick={() =>
              onApplyShipOtToMaterials({
                txIds: targetMaterialIds,
                shipId: effectiveTarget.shipId,
                workOrderId: effectiveTarget.workOrderId,
              })
            }
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 disabled:opacity-40 text-cyan-200 border border-cyan-500/40 text-xs font-black transition-colors cursor-pointer"
            title={
              effectiveTarget
                ? `Aplicar ${effectiveTarget.shipName} · ${effectiveTarget.otLabel} a ${targetMaterialIds.length} línea(s) de material`
                : 'Seleccioná una fila de horas para aplicar su Buque/OT'
            }
          >
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
            <span>Aplicar Buque/OT a Material ({targetMaterialIds.length})</span>
          </button>

          <button
            type="button"
            disabled={saving || !effectiveDayLog}
            onClick={() =>
              setSplittingLogId((prev) => (prev === effectiveDayLog?.id ? null : effectiveDayLog?.id || null))
            }
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-40 text-white text-xs font-black shadow cursor-pointer"
            title="Inserta una línea inmediatamente debajo conservando fecha y operario, copiando Barco y OT del material"
          >
            <GitFork className="w-3.5 h-3.5 shrink-0" />
            <span>Desdoblar fila de horas</span>
          </button>
        </div>
      </div>

      <CostControlMirrorQuincenaCard
        mirror={mirror}
        snapshot={snapshot}
        activeContractorEntity={activeContractorEntity}
        focusedRow={focusedRow}
        effectiveTarget={effectiveTarget}
        targetMaterialIds={targetMaterialIds}
        shipsById={shipsById}
        workOrdersById={workOrdersById}
        workItems={workItems}
        workOrders={workOrders}
        saving={saving}
        onSelectTargetKey={setSelectedTargetKey}
        onMoveDateToPrevQuincena={onMoveDateToPrevQuincena}
      />
    </div>
  )
}
