import { useState, useEffect, useMemo } from 'react'
import { Ship, ClipboardList, Search, AlertTriangle, Check, X, Anchor } from 'lucide-react'

/**
 * ShipWorkOrderPickerModal
 * 
 * Ventana emergente compacta y enfocada para la edición con doble clic
 * de la celda única `Barco / OT` en Terceros, Horas y Compras.
 * 
 * Regla de Negocio:
 * - Si se cambia el barco, la OT se limpia automáticamente a menos que el usuario elija una OT de ese nuevo barco.
 * - Permite explícitamente guardar con OT en blanco (`work_order_id = null`), sumando al KPI "Falta Cargar OT".
 */
export default function ShipWorkOrderPickerModal({
  isOpen,
  onClose,
  ships = [],
  workOrders = [],
  workItems = [],
  currentShipId = '',
  currentWorkOrderId = '',
  contractorName = '',
  workerName = '',
  onSave,
  title = 'Asignar Buque y Orden de Trabajo'
}) {
  const [selectedShipId, setSelectedShipId] = useState(currentShipId || '')
  const [selectedWoId, setSelectedWoId] = useState(currentWorkOrderId || '')
  const [leaveOtBlank, setLeaveOtBlank] = useState(!currentWorkOrderId)
  const [shipQuery, setShipQuery] = useState('')
  const [saving, setSaving] = useState(false)

  // Sincronizar estado cuando abre el modal
  useEffect(() => {
    if (isOpen) {
      setSelectedShipId(currentShipId || '')
      setSelectedWoId(currentWorkOrderId || '')
      setLeaveOtBlank(!currentWorkOrderId)
      setShipQuery('')
      setSaving(false)
    }
  }, [isOpen, currentShipId, currentWorkOrderId])

  // Filtrado de Buques por búsqueda
  const filteredShips = useMemo(() => {
    if (!shipQuery.trim()) return ships
    const q = shipQuery.toLowerCase().trim()
    return ships.filter((s) => (s.name || '').toLowerCase().includes(q))
  }, [ships, shipQuery])

  // OTs disponibles para el buque seleccionado
  const availableWorkOrders = useMemo(() => {
    if (!selectedShipId) return []
    return workOrders.filter((wo) => wo.ship_id === selectedShipId)
  }, [workOrders, selectedShipId])

  // Si cambia el barco y la OT seleccionada no pertenece a ese barco, resetear la OT
  const handleShipChange = (newShipId) => {
    setSelectedShipId(newShipId)
    if (newShipId !== currentShipId) {
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
      const finalWoId = leaveOtBlank ? null : (selectedWoId || null)
      await onSave({
        shipId: selectedShipId,
        workOrderId: finalWoId
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

  const selectedShip = ships.find((s) => s.id === selectedShipId)
  const selectedWo = workOrders.find((w) => w.id === selectedWoId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
              <Anchor className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">{title}</h3>
              {(contractorName || workerName) && (
                <p className="text-[11px] text-slate-400">
                  Imputado para: <span className="font-semibold text-cyan-300">{contractorName || workerName}</span>
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
            <label className="block text-[11px] uppercase font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Ship className="w-3.5 h-3.5 text-cyan-400" />
              <span>1. Buque / Embarcación de Destino</span>
            </label>
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Escribe para buscar barco..."
                value={shipQuery}
                onChange={(e) => setShipQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-sans"
              />
            </div>
            <select
              value={selectedShipId}
              onChange={(e) => handleShipChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 font-sans"
              size={Math.min(5, Math.max(3, filteredShips.length))}
            >
              {filteredShips.map((s) => (
                <option key={s.id} value={s.id} className="py-1 px-2 font-medium">
                  {s.name} {s.client_name ? `(${s.client_name})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* PASO 2: ORDEN DE TRABAJO */}
          <div className="pt-2 border-t border-slate-800/80">
            <label className="block text-[11px] uppercase font-bold text-slate-300 mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5 text-cyan-400" />
                <span>2. Orden de Trabajo (OT)</span>
              </div>
              {selectedShip && (
                <span className="text-[10px] text-slate-500 font-normal">
                  ({availableWorkOrders.length} OTs disponibles para {selectedShip.name})
                </span>
              )}
            </label>

            {/* CASILLA REGLA DURA: DEJAR OT EN BLANCO */}
            <div 
              onClick={() => {
                setLeaveOtBlank(!leaveOtBlank)
                if (!leaveOtBlank) setSelectedWoId('')
              }}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 mb-2.5 ${
                leaveOtBlank
                  ? 'bg-amber-950/40 border-amber-500/80 text-amber-200'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <input
                type="checkbox"
                checked={leaveOtBlank}
                onChange={() => {}} // Manejado por el div
                className="mt-0.5 w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0 cursor-pointer accent-amber-500"
              />
              <div className="flex-1">
                <div className="font-bold text-xs flex items-center gap-1 text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Dejar OT en blanco (Pendiente de apertura o asignación)</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                  Permite imputar el costo/horas al barco inmediatamente. Esta fila sumará al <strong>KPI &quot;Falta Cargar OT&quot;</strong> y alertará al Administrador y al Jefe de Obra para que abran la OT correspondiente.
                </p>
              </div>
            </div>

            {/* Selector de OT si no está en blanco */}
            {!leaveOtBlank && (
              <div className="space-y-1.5">
                {availableWorkOrders.length === 0 ? (
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-slate-500 text-center text-xs">
                    Este buque aún no tiene OTs activas registradas. Deberás dejar la OT en blanco o abrir una nueva OT.
                  </div>
                ) : (
                  <select
                    value={selectedWoId}
                    onChange={(e) => setSelectedWoId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 font-sans"
                  >
                    <option value="">-- Seleccionar Orden de Trabajo --</option>
                    {availableWorkOrders.map((wo) => (
                      <option key={wo.id} value={wo.id}>
                        {wo.ot_number ? `${wo.ot_number}: ` : ''}{wo.title || wo.description}
                      </option>
                    ))}
                  </select>
                )}

                {selectedWo && (
                  <div className="p-2 bg-slate-950/60 rounded-lg border border-slate-800/80 text-[11px] text-slate-300 flex items-start gap-2">
                    <span className="font-mono text-cyan-400 font-bold bg-cyan-950/80 px-1 py-0.5 rounded border border-cyan-800/50 shrink-0">
                      {selectedWo.ot_number || 'OT'}
                    </span>
                    <span className="truncate">{selectedWo.description || selectedWo.title}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Pie con Acciones */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={saving || !selectedShipId || (!leaveOtBlank && !selectedWoId)}
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-lg text-xs shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{saving ? 'Guardando...' : 'Aplicar Asignación'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
