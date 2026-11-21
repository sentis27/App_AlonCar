import { useState, useEffect, useMemo } from 'react'
import { Anchor, Check, AlertTriangle, Building2 } from 'lucide-react'
import { deduplicateWorkOrdersWithScope } from '../lib/workOrdersConstants.js'
import { PICKER_SHIP_WO_STEP_HELP } from '../lib/businessHelpRegistry.js'
import { CanonicalStepperModal, CanonicalStepperStep } from './canonical/CanonicalStepperModal.jsx'
import { WorkOrderSelectorWithHover } from './workOrders/WorkOrderSelectorWithHover.jsx'

const ASTILLERO_STOCK_TOKEN = '__ASTILLERO_STOCK__'

/**
 * ShipWorkOrderPickerModal
 * Selector canónico Zero-Scroll (Stepper Vertical 1 ➔ 2) para edición por doble clic o Enter
 * de la celda `Barco / OT` en Pañol, Horas, Terceros y Compras.
 *
 * Estandarizado al mismo patrón visual que Pañol (`MultiWithdrawalDestinationStep`):
 * - Paso 1: desplegable limpio de Barco / Buque (`<select>` escalable a 35+ buques sin cajas ni scroll).
 * - Paso 2: selector canónico `WorkOrderSelectorWithHover` (usa `CanonicalOtBadge` y
 *   `formatWorkOrderTooltipCanonical` con vista flotante completa + casilla `(⚠️ Sin OT)`).
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
  const [selectedShipId, setSelectedShipId] = useState(currentShipId || '')
  const [selectedWoId, setSelectedWoId] = useState(currentWorkOrderId || '')
  const [leaveOtBlank, setLeaveOtBlank] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const initialShipId =
      allowAstilleroStock && !currentShipId && currentChargeType && currentChargeType !== 'DIRECT'
        ? ASTILLERO_STOCK_TOKEN
        : (currentShipId || '')
    setSelectedShipId(initialShipId)
    setSelectedWoId(currentWorkOrderId || '')
    setLeaveOtBlank(false)
    setSaving(false)
  }, [isOpen, currentShipId, currentWorkOrderId, currentChargeType, allowAstilleroStock])

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

  const availableWorkOrders = useMemo(() => {
    if (!selectedShipId || selectedShipId === ASTILLERO_STOCK_TOKEN) return []
    const shipWos = workOrders.filter((wo) => String(wo.ship_id) === String(selectedShipId))
    const deduped = deduplicateWorkOrdersWithScope(shipWos, workItems)
    return deduped.sort((a, b) => {
      const aMatch = (a._allWoIds || [a.id]).some((id) => contractorWoSet.has(id)) ? 1 : 0
      const bMatch = (b._allWoIds || [b.id]).some((id) => contractorWoSet.has(id)) ? 1 : 0
      if (aMatch !== bMatch) return bMatch - aMatch
      const byTitle = String(a.title || a.description || '').trim().localeCompare(
        String(b.title || b.description || '').trim(), 'es', { sensitivity: 'base', numeric: true }
      )
      return byTitle !== 0
        ? byTitle
        : String(a.ot_number || '').localeCompare(String(b.ot_number || ''), undefined, { numeric: true })
    })
  }, [workOrders, workItems, selectedShipId, contractorWoSet])

  const handleShipChange = (newShipId) => {
    setSelectedShipId(newShipId)
    if (newShipId === ASTILLERO_STOCK_TOKEN || String(newShipId) !== String(currentShipId)) {
      setSelectedWoId('')
      setLeaveOtBlank(false)
    }
  }

  const handleWoChange = (nextWoId) => {
    setSelectedWoId(nextWoId)
    setLeaveOtBlank(!nextWoId)
  }

  const handleSave = async (e) => {
    if (e?.preventDefault) e.preventDefault()
    if (!selectedShipId) return alert('Debes seleccionar al menos un Buque o Destino.')
    try {
      setSaving(true)
      const isAstilleroStock = selectedShipId === ASTILLERO_STOCK_TOKEN
      await onSave({
        shipId: isAstilleroStock ? null : selectedShipId,
        workOrderId: isAstilleroStock || leaveOtBlank ? null : (selectedWoId || null),
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
  const activeOtCount = availableWorkOrders.filter((w) => w.isActiveForImputation !== false).length

  return (
    <CanonicalStepperModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidthClass="max-w-4xl"
      icon={
        <div className="w-7 h-7 rounded-lg bg-cyan-950 border border-cyan-600/70 flex items-center justify-center text-cyan-300">
          <Anchor className="w-4 h-4" />
        </div>
      }
      title={title}
      subtitle={
        contractorName || workerName
          ? `Fila de: ${contractorName || workerName}`
          : 'Elegí Buque y Orden de Trabajo o dejá la OT en blanco para imputación posterior'
      }
      onSubmit={handleSave}
      footerLeft={
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
        >
          Cancelar (Esc)
        </button>
      }
      footerRight={
        <button
          type="submit"
          disabled={saving || !selectedShipId}
          className="px-5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{saving ? 'Guardando...' : 'Aplicar Asignación'}</span>
        </button>
      }
    >
      <CanonicalStepperStep
        step={1}
        helpEntry={PICKER_SHIP_WO_STEP_HELP[1]}
        title="DESTINO E IMPUTACIÓN DE OBRA"
        subtitle="Barco / Buque ➔ Orden de Trabajo (OT)"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-400 font-semibold text-[11px] mb-1">
              Barco / Buque <span className="text-rose-400">*</span>
            </label>
            <select
              autoFocus
              value={selectedShipId}
              onChange={(e) => handleShipChange(e.target.value)}
              required
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold text-xs focus:outline-none focus:border-cyan-400"
            >
              <option value="">Seleccionar Barco...</option>
              {allowAstilleroStock && (
                <option value={ASTILLERO_STOCK_TOKEN}>ASTILLERO — PAÑOL / STOCK GENERAL</option>
              )}
              {ships.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.client_name ? ` (${s.client_name})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-400 font-semibold text-[11px]">
                Orden de Trabajo (OT){selectedShip ? ` · ${activeOtCount} activas` : ''}
              </label>
              {selectedShip && !isAstilleroStock && (
                <label
                  className="flex items-center gap-1 cursor-pointer text-[10px] text-amber-400 select-none"
                  title="Guarda el buque sin OT y suma +1 al KPI Falta Cargar OT"
                >
                  <input
                    type="checkbox"
                    tabIndex={-1}
                    checked={leaveOtBlank}
                    onChange={(e) => {
                      setLeaveOtBlank(e.target.checked)
                      if (e.target.checked) setSelectedWoId('')
                    }}
                    className="rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-0 cursor-pointer accent-amber-500"
                  />
                  <span>(⚠️ Sin OT)</span>
                </label>
              )}
            </div>

            {isAstilleroStock ? (
              <div className="px-2.5 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Stock General de Pañol (Sin OT de buque)</span>
              </div>
            ) : (
              <WorkOrderSelectorWithHover
                value={selectedWoId}
                onChange={handleWoChange}
                availableWos={availableWorkOrders}
                ship={selectedShip}
                workItems={workItems}
                allWorkOrders={workOrders}
                contractorName={contractorName || workerName}
                disabled={!selectedShipId || leaveOtBlank}
                isSinOt={leaveOtBlank}
                placeholder={!selectedShipId ? '-- 1° elegí un barco --' : '-- Seleccionar OT --'}
                showPreviewCard={false}
              />
            )}
          </div>
        </div>
      </CanonicalStepperStep>

      <CanonicalStepperStep
        step={2}
        helpEntry={PICKER_SHIP_WO_STEP_HELP[2]}
        title="RESUMEN DE IMPUTACIÓN"
        subtitle="Verificá el destino antes de aplicar"
        isLast={true}
      >
        <div className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            {isAstilleroStock ? (
              <>
                <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Se imputará a <strong className="text-emerald-300">ASTILLERO — PAÑOL / STOCK GENERAL</strong>.</span>
              </>
            ) : !selectedShip ? (
              <span className="text-slate-500">Elegí un barco arriba para habilitar las Órdenes de Trabajo.</span>
            ) : leaveOtBlank || !selectedWoId ? (
              <>
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Buque <strong className="text-white">{selectedShip.name}</strong> · <strong className="text-amber-300">⚠️ Sin OT</strong> (suma al KPI &ldquo;Falta Cargar OT&rdquo;).
                </span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Buque <strong className="text-white">{selectedShip.name}</strong> · OT seleccionada lista para aplicar.
                </span>
              </>
            )}
          </div>
          {selectedShip && !isAstilleroStock && (
            <span className="text-[10px] text-slate-500">
              Pasá el mouse sobre cualquier OT del desplegable para ver su alcance completo.
            </span>
          )}
        </div>
      </CanonicalStepperStep>
    </CanonicalStepperModal>
  )
}
