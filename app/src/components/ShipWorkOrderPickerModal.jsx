import { useState, useEffect, useMemo } from 'react'
import { Ship, ClipboardList, Search, AlertTriangle, Check, X, Anchor, Building2, Star } from 'lucide-react'

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

  // OTs disponibles para el buque seleccionado (priorizando las del contratista arriba)
  const availableWorkOrders = useMemo(() => {
    if (!selectedShipId || selectedShipId === ASTILLERO_STOCK_TOKEN) return []
    const shipWos = workOrders.filter((wo) => String(wo.ship_id) === String(selectedShipId))
    return [...shipWos].sort((a, b) => {
      const aMatch = contractorWoSet.has(a.id) ? 1 : 0
      const bMatch = contractorWoSet.has(b.id) ? 1 : 0
      if (aMatch !== bMatch) return bMatch - aMatch
      return String(a.ot_number || '').localeCompare(String(b.ot_number || ''), undefined, { numeric: true })
    })
  }, [workOrders, selectedShipId, contractorWoSet])

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

  if (!isOpen) return null

  const isAstilleroStock = selectedShipId === ASTILLERO_STOCK_TOKEN
  const selectedShip = !isAstilleroStock ? ships.find((s) => String(s.id) === String(selectedShipId)) : null
  const selectedWo = workOrders.find((w) => String(w.id) === String(selectedWoId))
  const contractorMatchedCount = availableWorkOrders.filter((w) => contractorWoSet.has(w.id)).length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-slate-900 border-2 border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
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
              {(contractorName || workerName) && (
                <p className="text-[11px] text-slate-400">
                  Referido a: <span className="font-bold text-cyan-300">{contractorName || workerName}</span>
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="p-5 space-y-4 text-xs">
          {/* PASO 1: SELECCIONAR BUQUE */}
          <div>
            <label className="block text-[11px] uppercase font-bold text-cyan-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Ship className="w-3.5 h-3.5 text-cyan-400" />
                <span>1. Buque / Destino</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Si cambia el barco, la OT se resetea</span>
            </label>

            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                autoFocus
                placeholder="Buscar barco por nombre o iniciales..."
                value={shipQuery}
                onChange={(e) => setShipQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-sans"
              />
            </div>

            <select
              value={selectedShipId}
              onChange={(e) => handleShipChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 font-sans"
              size={Math.min(6, Math.max(3, filteredShips.length + (allowAstilleroStock ? 1 : 0)))}
            >
              {allowAstilleroStock && (
                <option value={ASTILLERO_STOCK_TOKEN} className="py-1.5 px-2 font-bold text-emerald-300 bg-slate-950">
                  🏢 ASTILLERO — PAÑOL / STOCK GENERAL
                </option>
              )}
              {filteredShips.map((s) => (
                <option key={s.id} value={s.id} className="py-1 px-2 font-medium bg-slate-950 text-white">
                  🚢 {s.name} {s.client_name ? `(${s.client_name})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* PASO 2: ORDEN DE TRABAJO */}
          {isAstilleroStock ? (
            <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-200 flex items-start gap-2.5">
              <Building2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-xs">Destino Astillero / Stock de Pañol</div>
                <p className="text-[10px] text-slate-300 mt-0.5">
                  Quedará registrado como reposición de stock o insumo general del astillero sin OT de buque (visible en la sub-pill &quot;Astillero&quot; del KPI Falta Cargar OT).
                </p>
              </div>
            </div>
          ) : (
            <div className="pt-2 border-t border-slate-800/80">
              <label className="block text-[11px] uppercase font-bold text-slate-200 mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ClipboardList className="w-3.5 h-3.5 text-emerald-400" />
                  <span>2. Orden de Trabajo (OT)</span>
                </div>
                {selectedShip && (
                  <span className="text-[10px] text-slate-400 font-normal">
                    {availableWorkOrders.length} OTs en {selectedShip.name}
                    {contractorMatchedCount > 0 ? ` (${contractorMatchedCount} del contratista ★)` : ''}
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
                className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 mb-2.5 ${
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

              {/* Selector de OT */}
              <div className="space-y-1.5">
                {availableWorkOrders.length === 0 ? (
                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-amber-300/80 text-center text-[11px]">
                    Este buque no tiene OTs registradas todavía. Se guardará con OT en blanco.
                  </div>
                ) : (
                  <select
                    value={leaveOtBlank ? '' : selectedWoId}
                    onChange={(e) => {
                      const val = e.target.value
                      setSelectedWoId(val)
                      setLeaveOtBlank(!val)
                    }}
                    className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-xs text-white focus:outline-none font-sans ${
                      !leaveOtBlank && selectedWoId ? 'border-emerald-400' : 'border-slate-700 focus:border-cyan-400'
                    }`}
                  >
                    <option value="">-- Seleccionar OT abierta (o dejar en blanco arriba) --</option>
                    {availableWorkOrders.map((wo) => {
                      const isForContractor = contractorWoSet.has(wo.id)
                      return (
                        <option key={wo.id} value={wo.id} className="bg-slate-950 text-white">
                          {isForContractor ? '★ ' : ''}
                          {wo.ot_number ? `${wo.ot_number}: ` : ''}
                          {wo.title || wo.description}
                          {isForContractor ? ' [Asignada al contratista]' : ''}
                        </option>
                      )
                    })}
                  </select>
                )}

                {!leaveOtBlank && selectedWo && (
                  <div className="p-2.5 bg-emerald-950/30 rounded-lg border border-emerald-500/40 text-[11px] text-slate-200 flex items-start gap-2">
                    <span className="font-mono text-emerald-300 font-bold bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-700 shrink-0">
                      {selectedWo.ot_number || 'OT'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-white truncate">{selectedWo.title}</div>
                      {selectedWo.description && selectedWo.description !== selectedWo.title && (
                        <div className="text-[10px] text-slate-400 truncate">{selectedWo.description}</div>
                      )}
                      {contractorWoSet.has(selectedWo.id) && (
                        <div className="text-[10px] text-amber-300 font-bold flex items-center gap-1 mt-0.5">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span>OT vinculada a este contratista</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Pie con Acciones */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancelar (Esc)
          </button>

          <button
            type="button"
            disabled={saving || !selectedShipId || (!isAstilleroStock && !leaveOtBlank && !selectedWoId)}
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold rounded-lg text-xs shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>{saving ? 'Guardando...' : 'Aplicar Asignación'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
