import { useState, useEffect, useMemo } from 'react'
import { Ship, ClipboardList, Search, AlertTriangle, Check, X, Anchor, Building2, Star, Eye, EyeOff } from 'lucide-react'
import { getWorkOrderConsolidatedScope, deduplicateWorkOrdersWithScope, formatWorkOrderTooltipCanonical } from '../lib/workOrdersConstants.js'
import { WorkOrderScopeHoverCard } from './workOrders/WorkOrderScopeHoverCard.jsx'

/**
 * ShipWorkOrderPickerModal
 * 
 * Ventana emergente compacta y enfocada para la edición con doble clic (o Enter)
 * de la celda única `Barco / OT` en Terceros, Horas y Compras.
 * 
 * Reglas de Negocio:
 * - Si se cambia el barco, la OT se limpia automáticamente a menos que el usuario elija una OT de ese nuevo barco.
 * - Destaca las OTs vinculadas al contratista/operario de la fila (`workItems`), priorizándolas arriba de la lista.
 * - Permite explícitamente guardar con OT en blanco (`work_order_id = null`), sumando al KPI "⚠️ Falta Cargar OT".
 * - OTs finalizadas quedan ocultas por defecto para carga de datos (regla naval de imputación).
 * - Selector interactivo limpio con previsualización canónica en hover (Imagen 2).
 */
export default function ShipWorkOrderPickerModal({
  isOpen,
  onClose,
  ships = [],
  workOrders = [],
  workItems = [],
  currentShipId = '',
  currentWorkOrderId = '',
  currentChargeType = '',
  allowAstilleroStock = false,
  contractorName = '',
  workerName = '',
  onSave,
  title = 'Asignar Buque y Orden de Trabajo'
}) {
  const ASTILLERO_STOCK_TOKEN = '__ASTILLERO_STOCK__'

  const [selectedShipId, setSelectedShipId] = useState(currentShipId || '')
  const [selectedWoId, setSelectedWoId] = useState(currentWorkOrderId || '')
  const [leaveOtBlank, setLeaveOtBlank] = useState(!currentWorkOrderId)
  const [shipQuery, setShipQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [showFinalized, setShowFinalized] = useState(false)
  const [hoveredWo, setHoveredWo] = useState(null)

  useEffect(() => {
    if (isOpen) {
      if (allowAstilleroStock && !currentShipId && currentChargeType && currentChargeType !== 'DIRECT') {
        setSelectedShipId(ASTILLERO_STOCK_TOKEN)
      } else {
        setSelectedShipId(currentShipId || '')
      }
      setSelectedWoId(currentWorkOrderId || '')
      setLeaveOtBlank(!currentWorkOrderId)
      setShipQuery('')
      setSaving(false)
      setShowFinalized(false)
      setHoveredWo(null)
    }
  }, [isOpen, currentShipId, currentWorkOrderId, currentChargeType, allowAstilleroStock])

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  // Filtrado de Buques por búsqueda
  const filteredShips = useMemo(() => {
    if (!shipQuery.trim()) return ships
    const q = shipQuery.toLowerCase().trim()
    return ships.filter((s) => (s.name || '').toLowerCase().includes(q))
  }, [ships, shipQuery])

  // Identificar qué OTs tienen asignado al contratista / operario actual en work_items
  const contractorWoSet = useMemo(() => {
    const refName = (contractorName || workerName || '').toUpperCase().trim()
    if (!refName || !Array.isArray(workItems) || workItems.length === 0) return new Set()
    const cleanRef = refName.split('(')[0].trim()
    const matched = new Set()
    workItems.forEach((wi) => {
      const list = Array.isArray(wi.contractors) ? wi.contractors : []
      if (list.some((c) => String(c || '').toUpperCase().includes(cleanRef) || cleanRef.includes(String(c || '').toUpperCase()))) {
        if (wi.work_order_id) matched.add(wi.work_order_id)
      }
    })
    return matched
  }, [workItems, contractorName, workerName])

  // Todas las OTs consolidadas del barco
  const allDeduplicatedWos = useMemo(() => {
    if (!selectedShipId || selectedShipId === ASTILLERO_STOCK_TOKEN) return []
    const shipWos = workOrders.filter((wo) => String(wo.ship_id) === String(selectedShipId))
    return deduplicateWorkOrdersWithScope(shipWos, workItems)
  }, [workOrders, workItems, selectedShipId])

  // Recuento de OTs finalizadas
  const finalizedCount = useMemo(() => {
    return allDeduplicatedWos.filter((w) => w.isActiveForImputation === false).length
  }, [allDeduplicatedWos])

  // OTs disponibles para carga de datos (excluyendo finalizadas a menos que se pidan o sea la actual)
  const availableWorkOrders = useMemo(() => {
    const pool = allDeduplicatedWos.filter((wo) => {
      if (showFinalized) return true
      if (currentWorkOrderId && (wo.id === currentWorkOrderId || (wo._allWoIds || []).includes(currentWorkOrderId))) {
        return true
      }
      return wo.isActiveForImputation !== false
    })

    return pool.sort((a, b) => {
      const aMatch = (a._allWoIds || [a.id]).some((id) => contractorWoSet.has(id)) ? 1 : 0
      const bMatch = (b._allWoIds || [b.id]).some((id) => contractorWoSet.has(id)) ? 1 : 0
      if (aMatch !== bMatch) return bMatch - aMatch
      return String(a.ot_number || '').localeCompare(String(b.ot_number || ''), undefined, { numeric: true })
    })
  }, [allDeduplicatedWos, contractorWoSet, showFinalized, currentWorkOrderId])

  const handleShipChange = (newShipId) => {
    setSelectedShipId(newShipId)
    if (newShipId === ASTILLERO_STOCK_TOKEN || String(newShipId) !== String(currentShipId)) {
      setSelectedWoId('')
      setLeaveOtBlank(true)
    }
  }

  const handleSave = async () => {
    if (!selectedShipId) {
      alert('Debes seleccionar al menos un Buque o Destino.')
      return
    }

    try {
      setSaving(true)
      const isAstilleroStock = selectedShipId === ASTILLERO_STOCK_TOKEN
      const finalShipId = isAstilleroStock ? null : selectedShipId
      const finalWoId = isAstilleroStock || leaveOtBlank ? null : (selectedWoId || null)
      await onSave({
        shipId: finalShipId,
        workOrderId: finalWoId,
        isAstilleroStock
      })
      onClose()
    } catch (err) {
      console.error('Error guardando Buque y OT:', err)
      alert('Error al guardar: ' + (err.message || err))
    } finally {
      setSaving(false)
    }
  }

  const selectedWo = useMemo(() => {
    return workOrders.find((w) => String(w.id) === String(selectedWoId))
  }, [workOrders, selectedWoId])

  // OT en previsualización (prioriza hover para inspección ágil, luego la seleccionada)
  const activePreviewWo = hoveredWo || selectedWo

  const previewScope = useMemo(() => {
    if (!activePreviewWo) return null
    return getWorkOrderConsolidatedScope(activePreviewWo, workItems, workOrders, {
      contractorFilter: contractorName || workerName,
      maxSummaryTasks: 12
    })
  }, [activePreviewWo, workItems, workOrders, contractorName, workerName])

  if (!isOpen) return null

  const isAstilleroStock = selectedShipId === ASTILLERO_STOCK_TOKEN
  const selectedShip = !isAstilleroStock ? ships.find((s) => String(s.id) === String(selectedShipId)) : null
  const contractorMatchedCount = availableWorkOrders.filter((w) => contractorWoSet.has(w.id)).length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-700 flex items-center justify-center text-cyan-400">
              <Anchor className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">{title}</h3>
              <p className="text-[11px] text-slate-400">
                {contractorName || workerName ? (
                  <span>
                    Fila de: <strong className="text-amber-300">{contractorName || workerName}</strong>
                  </span>
                ) : (
                  'Selecciona buque y OT o déjala en blanco para imputación posterior'
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* PASO 1: BUQUE / DESTINO */}
          <div>
            <label className="block text-[11px] uppercase font-bold text-slate-200 mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Ship className="w-3.5 h-3.5 text-cyan-400" />
                <span>1. Buque / Destino</span>
              </div>
              <span className="text-[10px] text-slate-400 font-normal">
                Si cambia el barco, la OT se resetea
              </span>
            </label>

            {/* Buscador de barcos */}
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                autoFocus
                value={shipQuery}
                onChange={(e) => setShipQuery(e.target.value)}
                placeholder="Buscar barco por nombre o iniciales..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Selector de buques */}
            <div className="max-h-28 overflow-y-auto border border-slate-700/80 rounded-lg bg-slate-950 p-1 space-y-0.5">
              {allowAstilleroStock && (
                <button
                  type="button"
                  onClick={() => handleShipChange(ASTILLERO_STOCK_TOKEN)}
                  className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between transition-colors cursor-pointer ${
                    selectedShipId === ASTILLERO_STOCK_TOKEN
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'text-emerald-300 hover:bg-emerald-950/40'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>ASTILLERO — PAÑOL / STOCK GENERAL</span>
                  </span>
                  {selectedShipId === ASTILLERO_STOCK_TOKEN && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              )}

              {filteredShips.map((s) => {
                const isSelected = selectedShipId === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleShipChange(s.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-600 text-white font-bold'
                        : 'text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <Ship className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                      <span className="truncate">{s.name}</span>
                      {s.client_name && (
                        <span className="text-[10px] text-slate-400 font-normal">({s.client_name})</span>
                      )}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                )
              })}

              {filteredShips.length === 0 && (
                <div className="px-3 py-2 text-center text-xs text-slate-500 italic">
                  No se encontraron buques con ese nombre
                </div>
              )}
            </div>
          </div>

          {/* PASO 2: ORDEN DE TRABAJO */}
          {selectedShipId && (
            isAstilleroStock ? (
              <div className="p-3 bg-emerald-950/30 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-xs">Destino Astillero / Stock de Pañol</div>
                  <p className="text-[10px] text-slate-300 mt-0.5">
                    Quedará registrado como reposición de stock o insumo general del astillero sin OT de buque.
                  </p>
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <label className="block text-[11px] uppercase font-bold text-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5 text-emerald-400" />
                    <span>2. Orden de Trabajo (OT)</span>
                  </div>
                  {selectedShip && (
                    <span className="text-[10px] text-slate-400 font-normal">
                      {availableWorkOrders.length} OT{availableWorkOrders.length !== 1 ? 's' : ''} activa{availableWorkOrders.length !== 1 ? 's' : ''} en {selectedShip.name}
                      {contractorMatchedCount > 0 ? ` (${contractorMatchedCount} ★)` : ''}
                    </span>
                  )}
                </label>

                {/* CASILLA REGLA DURA: DEJAR OT EN BLANCO */}
                <div
                  onClick={() => {
                    const next = !leaveOtBlank
                    setLeaveOtBlank(next)
                    if (next) setSelectedWoId('')
                  }}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                    leaveOtBlank
                      ? 'bg-amber-950/45 border-amber-400 text-amber-200 shadow-md shadow-amber-950/30'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={leaveOtBlank}
                    onChange={() => {}}
                    className="mt-0.5 w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0 cursor-pointer accent-amber-500"
                  />
                  <div className="flex-1">
                    <div className="font-bold text-xs flex items-center gap-1 text-amber-300">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Dejar OT en blanco (OT aún no abierta o pendiente)</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                      Guarda el barco hoy y suma <strong>+1 al KPI &quot;⚠️ Falta Cargar OT&quot;</strong> (alerta activa para el usuario y el Administrador).
                    </p>
                  </div>
                </div>

                {/* SELECTOR INTERACTIVO Y LIMPIO DE OTs CON HOVER CANÓNICO */}
                {!leaveOtBlank && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Selecciona una OT de la lista (pasa el cursor para ver el alcance):</span>
                      {finalizedCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowFinalized(!showFinalized)}
                          className="text-[10px] text-cyan-400 hover:text-cyan-300 underline font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          {showFinalized ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          <span>{showFinalized ? 'Ocultar finalizadas' : `Ver finalizadas (${finalizedCount})`}</span>
                        </button>
                      )}
                    </div>

                    {availableWorkOrders.length === 0 ? (
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-amber-300/90 text-center text-xs space-y-1">
                        <AlertTriangle className="w-4 h-4 text-amber-400 mx-auto" />
                        <div>No hay OTs activas en este buque.</div>
                        <div className="text-[10px] text-slate-400">
                          {finalizedCount > 0
                            ? `Existen ${finalizedCount} OTs pero ya están finalizadas. Haz clic arriba en "Ver finalizadas" si requieres imputar excepcionalmente.`
                            : 'Se guardará como "⚠️ Sin OT" para que Admin o Jefe abran la obra.'}
                        </div>
                      </div>
                    ) : (
                      <div className="max-h-36 overflow-y-auto border border-slate-700/80 rounded-xl bg-slate-950 p-1 space-y-1">
                        {availableWorkOrders.map((wo) => {
                          const isSelected = String(selectedWoId) === String(wo.id)
                          const isHovered = hoveredWo?.id === wo.id
                          const isForContractor = (wo._allWoIds || [wo.id]).some((id) => contractorWoSet.has(id))
                          const otNum = wo.ot_number || (wo.id ? String(wo.id).slice(0, 4) : 'OT')
                          const otTitle = wo.title || wo.description || 'Sin título'
                          const isClosed = wo.isActiveForImputation === false

                          return (
                            <button
                              key={wo.id}
                              type="button"
                              onClick={() => {
                                setSelectedWoId(wo.id)
                                setLeaveOtBlank(false)
                              }}
                              onMouseEnter={() => setHoveredWo(wo)}
                              onMouseLeave={() => setHoveredWo(null)}
                              title={formatWorkOrderTooltipCanonical(wo, selectedShip, workItems, workOrders)}
                              className={`w-full text-left p-2 rounded-lg border text-xs flex items-center justify-between gap-2 transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-emerald-950/60 border-emerald-400 text-white shadow-md shadow-emerald-950/40'
                                  : isHovered
                                  ? 'bg-slate-800/80 border-cyan-400 text-cyan-200'
                                  : isClosed
                                  ? 'bg-slate-900/40 border-slate-800 text-slate-500 opacity-60'
                                  : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                                  isSelected
                                    ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                                    : 'bg-slate-950 text-slate-400 border-slate-700'
                                }`}>
                                  OT #{otNum}
                                </span>
                                <span className="font-bold text-xs truncate">
                                  {otTitle}
                                </span>
                                {isForContractor && (
                                  <span className="text-[9px] text-amber-300 font-bold flex items-center gap-0.5 shrink-0 bg-amber-950/70 px-1 py-0.2 rounded border border-amber-600/60">
                                    <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                                    <span>Asignada</span>
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {isClosed ? (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-slate-950 text-slate-400 border border-slate-800 font-bold">
                                    Finalizada
                                  </span>
                                ) : (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                                    {wo.consolidatedTasks?.length || 0} tareas
                                  </span>
                                )}
                                {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* TARJETA CANÓNICA IDÉNTICA A PLANILLA (IMAGEN 2) CON ALCANCE Y TACHADO */}
                    {activePreviewWo && (
                      <WorkOrderScopeHoverCard
                        wo={activePreviewWo}
                        ship={selectedShip}
                        workItems={workItems}
                        allWorkOrders={workOrders}
                        contractorFilter={contractorName || workerName}
                        isHoverPreview={Boolean(hoveredWo && hoveredWo.id !== selectedWoId)}
                      />
                    )}
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {/* Pie */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800 cursor-pointer"
          >
            Cancelar (Esc)
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !selectedShipId}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg ${
              saving || !selectedShipId
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-950/50'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>{saving ? 'Guardando...' : 'Aplicar Asignación'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
