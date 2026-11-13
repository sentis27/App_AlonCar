import React, { useMemo, useState, useEffect } from 'react'
import {
  Ship,
  Layers,
  BarChart2,
  BookmarkPlus,
  Trash2,
  Ruler,
  Info
} from 'lucide-react'
import { formatUsd, formatKg } from '../../lib/drydockCatalogConstants'
import ComparadorNivel2OtTable from './ComparadorNivel2OtTable'

const METRIC_MODES = [
  { id: 'STACKED_USD', label: 'Costo Total Apilado (US$)', unit: 'USD' },
  { id: 'COST_KG', label: 'Costo / KG (US$/kg)', unit: 'USD/KG' },
  { id: 'KG_HOUR', label: 'Productividad (KG/Hora)', unit: 'KG/H' },
  { id: 'COST_M2', label: 'Costo / m² Superficie', unit: 'USD/M2' },
  { id: 'KG_M2', label: 'Kilos / m² Superficie', unit: 'KG/M2' }
]

/**
 * Submódulo 2 (Gallina): Comparador Multidimensional de Obras con Canvas Interactivo.
 * Arquitectura de 3 paneles:
 * 1. Lista de Buques disponibles
 * 2. OTs / Rubros en común
 * 3. Canvas Comparativo (Nivel 1 apilado/ratios con inspector sin superposición + Nivel 2 OT-OT)
 */
export default function ComparadorObrasCanvasPanel({
  comparatorData = [],
  savedViews = [],
  activeShipId = null,
  onSaveAdhocArea,
  onSavePresetView,
  onDeletePresetView
}) {
  const [selectedShipIds, setSelectedShipIds] = useState(() => {
    const nonEmpty = comparatorData.filter((s) => s.directTotalUsd > 0).slice(0, 3).map((s) => s.shipId)
    if (nonEmpty.length > 0) return nonEmpty
    return activeShipId ? [activeShipId] : comparatorData.slice(0, 2).map((s) => s.shipId)
  })
  const [selectedOtKeys, setSelectedOtKeys] = useState([])
  const [metricMode, setMetricMode] = useState('STACKED_USD')
  const [canvasLevel, setCanvasLevel] = useState('NIVEL_1')
  const [hoveredShipId, setHoveredShipId] = useState(null)
  const [presetName, setPresetName] = useState('')
  const [editingAreaByShip, setEditingAreaByShip] = useState({})

  useEffect(() => {
    const nextAreas = {}
    comparatorData.forEach((s) => {
      nextAreas[s.shipId] = String(s.superficieM2 || '')
    })
    setEditingAreaByShip(nextAreas)
  }, [comparatorData])

  const selectedShipsData = useMemo(() => {
    const map = new Map(comparatorData.map((s) => [s.shipId, s]))
    return selectedShipIds.map((id) => map.get(id)).filter(Boolean)
  }, [comparatorData, selectedShipIds])

  // Catálogo de OTs presentes en al menos 1 de los buques seleccionados, destacando coincidencias
  const availableOts = useMemo(() => {
    const counts = new Map()
    selectedShipsData.forEach((ship) => {
      const seenInShip = new Set()
      ship.otRows.forEach((ot) => {
        const key = String(ot.otNumber || ot.title || ot.id).trim().toUpperCase()
        if (!counts.has(key)) {
          counts.set(key, {
            key,
            label: ot.title && ot.title !== 'Sin título' ? `${ot.otNumber} · ${ot.title}` : ot.otNumber,
            shipCount: 0
          })
        }
        if (!seenInShip.has(key)) {
          seenInShip.add(key)
          counts.get(key).shipCount += 1
        }
      })
    })
    return Array.from(counts.values()).sort((a, b) => b.shipCount - a.shipCount)
  }, [selectedShipsData])

  // Recalcular valores de cada buque si hay filtro explícito de OTs en panel 2
  const chartShips = useMemo(() => {
    return selectedShipsData.map((ship) => {
      if (selectedOtKeys.length === 0) return ship

      const matchingOts = ship.otRows.filter((ot) =>
        selectedOtKeys.includes(String(ot.otNumber || ot.title || ot.id).trim().toUpperCase())
      )
      const mat = matchingOts.reduce((a, o) => a + o.materialesUsd, 0)
      const cons = matchingOts.reduce((a, o) => a + o.consumiblesObraUsd, 0)
      const terc = matchingOts.reduce((a, o) => a + o.tercerosUsd, 0)
      const hrsUsd = matchingOts.reduce((a, o) => a + o.horasTotalUsd, 0)
      const seg = matchingOts.reduce((a, o) => a + o.seguridadReferenciaUsd, 0)
      const direct = mat + cons + terc + hrsUsd
      const kg = matchingOts.reduce((a, o) => a + o.weightKg, 0)
      const physHrs = matchingOts.reduce((a, o) => a + o.physicalHours, 0)
      const area = ship.superficieM2 || 0

      return {
        ...ship,
        materialesUsd: mat,
        consumiblesObraUsd: cons,
        tercerosUsd: terc,
        horasTotalUsd: hrsUsd,
        seguridadReferenciaUsd: seg,
        directTotalUsd: direct,
        weightKg: kg,
        physicalHours: physHrs,
        costPerKg: kg > 0 ? Number((direct / kg).toFixed(2)) : 0,
        kgPerHour: physHrs > 0 ? Number((kg / physHrs).toFixed(2)) : 0,
        costPerM2: area > 0 ? Number((direct / area).toFixed(2)) : 0,
        kgPerM2: area > 0 ? Number((kg / area).toFixed(2)) : 0
      }
    })
  }, [selectedShipsData, selectedOtKeys])

  const getMetricValue = (ship) => {
    if (metricMode === 'COST_KG') return ship.costPerKg
    if (metricMode === 'KG_HOUR') return ship.kgPerHour
    if (metricMode === 'COST_M2') return ship.costPerM2
    if (metricMode === 'KG_M2') return ship.kgPerM2
    return ship.directTotalUsd
  }

  const formatMetricValue = (val) => {
    if (metricMode === 'COST_KG') return `${formatUsd(val, 2)}/kg`
    if (metricMode === 'KG_HOUR') return `${val.toLocaleString('es-AR', { maximumFractionDigits: 2 })} kg/h`
    if (metricMode === 'COST_M2') return `${formatUsd(val, 2)}/m²`
    if (metricMode === 'KG_M2') return `${val.toLocaleString('es-AR', { maximumFractionDigits: 2 })} kg/m²`
    return formatUsd(val, 0)
  }

  const maxMetric = useMemo(() => {
    const m = Math.max(0, ...chartShips.map(getMetricValue))
    return m > 0 ? m : 1
  }, [chartShips, metricMode])

  const hoveredShip = chartShips.find((s) => s.shipId === hoveredShipId) || chartShips[0] || null

  const toggleShip = (shipId) => {
    setSelectedShipIds((prev) =>
      prev.includes(shipId) ? prev.filter((id) => id !== shipId) : [...prev, shipId]
    )
  }

  const toggleOtKey = (key) => {
    setSelectedOtKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const commitAdhocArea = (shipId) => {
    const num = Math.max(0, Number(editingAreaByShip[shipId]) || 0)
    if (onSaveAdhocArea) {
      onSaveAdhocArea(shipId, num)
    }
  }

  const handleSavePreset = () => {
    const cleanName = presetName.trim()
    if (!cleanName || !onSavePresetView) return
    onSavePresetView({
      id: `view_${Date.now()}`,
      name: cleanName,
      shipIds: selectedShipIds,
      otKeys: selectedOtKeys,
      metricMode,
      createdAt: new Date().toISOString()
    })
    setPresetName('')
  }

  const applyPreset = (view) => {
    if (!view) return
    setSelectedShipIds(Array.isArray(view.shipIds) ? view.shipIds : [])
    setSelectedOtKeys(Array.isArray(view.otKeys) ? view.otKeys : [])
    if (view.metricMode) setMetricMode(view.metricMode)
  }

  return (
    <div className="space-y-4">
      {/* Barra de vistas guardadas + modo de métrica + nivel */}
      <div className="bg-slate-900/75 border border-violet-500/35 rounded-xl p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-950/90 border border-slate-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setCanvasLevel('NIVEL_1')}
              className={`px-3 py-1 rounded-md text-xs font-bold cursor-pointer ${
                canvasLevel === 'NIVEL_1'
                  ? 'bg-violet-600/30 text-violet-200 border border-violet-400/50'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              Nivel 1 · Macro por Buque
            </button>
            <button
              type="button"
              onClick={() => setCanvasLevel('NIVEL_2')}
              className={`px-3 py-1 rounded-md text-xs font-bold cursor-pointer ${
                canvasLevel === 'NIVEL_2'
                  ? 'bg-violet-600/30 text-violet-200 border border-violet-400/50'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              Nivel 2 · Productividad OT
            </button>
          </div>

          <select
            value={metricMode}
            onChange={(e) => setMetricMode(e.target.value)}
            className="bg-slate-950 border border-violet-500/40 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-violet-100 outline-none"
          >
            {METRIC_MODES.map((m) => (
              <option key={m.id} value={m.id}>
                Métrica Canvas: {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Vistas guardadas en Supabase system_settings */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Nombre vista comparativa..."
            className="bg-slate-950 border border-slate-700 focus:border-violet-400 rounded-lg px-2.5 py-1 text-xs text-slate-200 outline-none w-44"
          />
          <button
            type="button"
            onClick={handleSavePreset}
            disabled={!presetName.trim() || selectedShipIds.length === 0}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-violet-600/25 hover:bg-violet-600/40 disabled:opacity-40 text-violet-200 border border-violet-400/40 cursor-pointer"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            Guardar Vista
          </button>

          {savedViews.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {savedViews.slice(0, 4).map((v) => (
                <div
                  key={v.id}
                  className="inline-flex items-center rounded-md bg-slate-950 border border-slate-700 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => applyPreset(v)}
                    className="px-2 py-1 text-[11px] font-semibold text-violet-200 hover:bg-violet-500/20 cursor-pointer"
                  >
                    {v.name}
                  </button>
                  {onDeletePresetView && (
                    <button
                      type="button"
                      onClick={() => onDeletePresetView(v.id)}
                      className="px-1.5 py-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                      title="Eliminar vista guardada"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ARQUITECTURA DE 3 PANELES: [1. Buques] <-> [2. OTs en Común] -> [3. Canvas] */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* PANEL 1: BUQUES DISPONIBLES */}
        <div className="lg:col-span-3 bg-slate-900/75 border border-slate-700/80 rounded-xl overflow-hidden flex flex-col">
          <div className="px-3.5 py-2.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-violet-300 flex items-center gap-1.5">
              <Ship className="w-3.5 h-3.5" />
              1. Buques Disponibles
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {selectedShipIds.length}/{comparatorData.length}
            </span>
          </div>

          <div className="p-2 space-y-1.5 max-h-[520px] overflow-y-auto">
            {comparatorData.map((ship) => {
              const checked = selectedShipIds.includes(ship.shipId)
              return (
                <div
                  key={ship.shipId}
                  className={`p-2.5 rounded-lg border transition-colors ${
                    checked
                      ? 'bg-violet-950/35 border-violet-400/50 text-white'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleShip(ship.shipId)}
                      className="mt-0.5 rounded border-slate-600"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold truncate">{ship.shipName}</span>
                        <span className="text-[10px] text-emerald-300 font-bold tabular-nums shrink-0">
                          {formatUsd(ship.directTotalUsd, 0)}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {ship.clientName} · {ship.esloraMts ? `${ship.esloraMts}m` : 'Eslora s/d'} ·{' '}
                        {formatKg(ship.weightKg, 0)}
                      </div>
                    </div>
                  </label>

                  {/* Input Ad-Hoc de m² de superficie */}
                  <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[10px]">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Ruler className="w-3 h-3 text-cyan-400" />
                      Sup. ad-hoc (m²):
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={editingAreaByShip[ship.shipId] ?? ''}
                      onChange={(e) =>
                        setEditingAreaByShip((prev) => ({ ...prev, [ship.shipId]: e.target.value }))
                      }
                      onBlur={() => commitAdhocArea(ship.shipId)}
                      placeholder="0"
                      className="w-16 bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded px-1.5 py-0.5 text-right text-cyan-200 font-semibold tabular-nums outline-none"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* PANEL 2: OTs EN COMÚN */}
        <div className="lg:col-span-3 bg-slate-900/75 border border-slate-700/80 rounded-xl overflow-hidden flex flex-col">
          <div className="px-3.5 py-2.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              2. OTs Comparables
            </span>
            {selectedOtKeys.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedOtKeys([])}
                className="text-[10px] text-cyan-300 underline cursor-pointer"
              >
                Todas
              </button>
            )}
          </div>

          <div className="p-2 space-y-1 max-h-[520px] overflow-y-auto">
            {availableOts.length === 0 ? (
              <p className="p-4 text-xs text-slate-500 text-center">
                Seleccioná buques en el Panel 1 para cruzar sus OTs.
              </p>
            ) : (
              availableOts.map((ot) => {
                const active = selectedOtKeys.includes(ot.key)
                return (
                  <label
                    key={ot.key}
                    className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border cursor-pointer text-xs transition-colors ${
                      active
                        ? 'bg-cyan-950/40 border-cyan-400/50 text-cyan-100'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleOtKey(ot.key)}
                        className="rounded border-slate-600 shrink-0"
                      />
                      <span className="truncate">{ot.label}</span>
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                        ot.shipCount > 1
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                      title={`Presente en ${ot.shipCount} buques seleccionados`}
                    >
                      {ot.shipCount}B
                    </span>
                  </label>
                )
              })
            )}
          </div>
        </div>

        {/* PANEL 3: CANVAS COMPARATIVO INTERACTIVO */}
        <div className="lg:col-span-6 space-y-3">
          {canvasLevel === 'NIVEL_2' ? (
            <ComparadorNivel2OtTable
              selectedShipsData={chartShips}
              selectedOtKeys={selectedOtKeys}
            />
          ) : (
            <div className="bg-slate-900/75 border border-violet-500/35 rounded-xl p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-violet-300" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-violet-200">
                    3. Canvas Comparativo —{' '}
                    {METRIC_MODES.find((m) => m.id === metricMode)?.label}
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[10px]">
                  <span className="inline-flex items-center gap-1 text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400 inline-block" /> Materiales
                  </span>
                  <span className="inline-flex items-center gap-1 text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-sm bg-sky-400 inline-block" /> Consumibles
                  </span>
                  <span className="inline-flex items-center gap-1 text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" /> Terceros
                  </span>
                  <span className="inline-flex items-center gap-1 text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" /> Horas
                  </span>
                </div>
              </div>

              {/* Inspector superior dedicado sin superposición sobre barras */}
              {hoveredShip && (
                <div className="bg-slate-950/90 border border-cyan-500/35 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-6 gap-2 text-[11px]">
                  <div className="col-span-2 sm:col-span-2">
                    <span className="text-[10px] text-cyan-400 font-bold uppercase flex items-center gap-1">
                      <Info className="w-3 h-3" /> Inspector Detalle (Hover)
                    </span>
                    <div className="text-sm font-black text-white truncate">{hoveredShip.shipName}</div>
                    <div className="text-[10px] text-slate-400">
                      {formatKg(hoveredShip.weightKg, 0)} · {hoveredShip.physicalHours} hs ·{' '}
                      {hoveredShip.superficieM2 > 0 ? `${hoveredShip.superficieM2} m²` : 'm² ad-hoc 0'}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Materiales</span>
                    <strong className="text-cyan-300 tabular-nums">
                      {formatUsd(hoveredShip.materialesUsd, 0)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Consumibles</span>
                    <strong className="text-sky-300 tabular-nums">
                      {formatUsd(hoveredShip.consumiblesObraUsd, 0)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Terceros</span>
                    <strong className="text-amber-300 tabular-nums">
                      {formatUsd(hoveredShip.tercerosUsd, 0)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Horas / EPP Ref*</span>
                    <strong className="text-emerald-300 tabular-nums block">
                      {formatUsd(hoveredShip.horasTotalUsd, 0)}
                    </strong>
                    <span className="text-[9px] text-amber-300/80">
                      EPP Ref: {formatUsd(hoveredShip.seguridadReferenciaUsd, 0)}
                    </span>
                  </div>
                </div>
              )}

              {/* Barras comparativas limpias (horizontales o proporcionales sin superposición) */}
              {chartShips.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  Seleccioná al menos 1 buque en el Panel 1 para comparar en el Canvas.
                </div>
              ) : (
                <div className="space-y-3">
                  {chartShips.map((ship) => {
                    const metricVal = getMetricValue(ship)
                    const barWidthPct = Math.max(4, Math.min(100, (metricVal / maxMetric) * 100))
                    const totalD = ship.directTotalUsd || 1
                    const wMat = (ship.materialesUsd / totalD) * 100
                    const wCons = (ship.consumiblesObraUsd / totalD) * 100
                    const wTerc = (ship.tercerosUsd / totalD) * 100
                    const wHrs = (ship.horasTotalUsd / totalD) * 100

                    return (
                      <div
                        key={ship.shipId}
                        onMouseEnter={() => setHoveredShipId(ship.shipId)}
                        className={`p-3 rounded-xl border transition-colors cursor-pointer ${
                          hoveredShip?.shipId === ship.shipId
                            ? 'bg-slate-950/90 border-violet-400/60'
                            : 'bg-slate-950/60 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-white">{ship.shipName}</span>
                            <span className="text-[10px] text-slate-400 ml-2">
                              ({ship.clientName})
                            </span>
                          </div>
                          <div className="text-right tabular-nums shrink-0">
                            <span className="text-sm font-black text-violet-200">
                              {formatMetricValue(metricVal)}
                            </span>
                            <span className="text-[10px] text-slate-400 ml-2">
                              US$/kg: {formatUsd(ship.costPerKg, 1)} · {ship.kgPerHour} kg/h
                            </span>
                          </div>
                        </div>

                        <div className="w-full h-5 bg-slate-900 rounded-md overflow-hidden p-0.5 border border-slate-800">
                          {metricMode === 'STACKED_USD' ? (
                            <div
                              className="h-full rounded flex overflow-hidden transition-all duration-300"
                              style={{ width: `${barWidthPct}%` }}
                            >
                              <div className="bg-cyan-400 h-full" style={{ width: `${wMat}%` }} />
                              <div className="bg-sky-400 h-full" style={{ width: `${wCons}%` }} />
                              <div className="bg-amber-400 h-full" style={{ width: `${wTerc}%` }} />
                              <div className="bg-emerald-400 h-full" style={{ width: `${wHrs}%` }} />
                            </div>
                          ) : (
                            <div
                              className="h-full rounded bg-gradient-to-r from-violet-500 to-cyan-400 transition-all duration-300"
                              style={{ width: `${barWidthPct}%` }}
                            />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
