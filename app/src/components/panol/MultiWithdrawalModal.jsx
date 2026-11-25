import { useState, useMemo } from 'react'
import { Package, Check, Edit3 } from 'lucide-react'
import { getContractorEnabledWos, evaluateAllocationState, normalizeText } from '../../lib/allocationEngine'
import {
  isGasMaterial,
  stripGasTagFromNotes,
  parseGasInfoFromNotes,
  findLinkedGasMovement
} from '../../lib/panolConstants'
import { PANOL_WITHDRAWAL_STEP_HELP } from '../../lib/businessHelpRegistry'
import { CanonicalStepperModal, CanonicalStepperStep } from '../canonical/CanonicalStepperModal.jsx'
import { toArIsoDate, getTodayArIso } from '../../lib/dateTimeCanonical.js'
import MultiWithdrawalDestinationStep from './MultiWithdrawalDestinationStep.jsx'
import MultiWithdrawalItemsStep from './MultiWithdrawalItemsStep.jsx'

const createEmptyWithdrawalItem = () => ({
  material_id: '', quantity: 1, customCostCenter: '', notes: '',
  gasOperationType: 'PRIMERA_ENTREGA', supplierDeliveredId: '', supplierReturnedId: ''
})

/**
 * MultiWithdrawalModal.jsx
 * Modal Canónico de Salida Multi-Material de Pañol (Alta, Edición ✏️ y Entrega EPP).
 * Stepper Vertical Zero-Scroll de 3 pasos (`CanonicalStepperModal` + `StepHelpBadge` en portal
 * con apertura hacia arriba en el Paso 3), OTs solo texto flotante (`FL-002`) y miniaturas 5cm × 5cm.
 */
export default function MultiWithdrawalModal({
  materials, suppliers = [], gasStats = null, gasMovements = [],
  ships, workOrders, workItems, astilleroWorkers = [], contractorGroups = [],
  unauthorizedWorkers = [], getEnabledWorkersAndContractors, pendingAlerts = [],
  isAdmin, editingRow, onRequestOt, onRequestWorkerPermission, onClose, onSave
}) {
  const linkedGasMovement = useMemo(
    () => (editingRow ? findLinkedGasMovement(editingRow, gasMovements) : null),
    [editingRow, gasMovements]
  )
  const parsedGasNotes = useMemo(
    () => (editingRow ? parseGasInfoFromNotes(editingRow.notes, suppliers) : null),
    [editingRow, suppliers]
  )

  const [shipId, setShipId] = useState(editingRow?.ship_id || '')
  const [contractorGroup, setContractorGroup] = useState(editingRow?.worker_name || editingRow?.contractor_name || '')
  const [workOrderId, setWorkOrderId] = useState(editingRow?.work_order_id || '')
  const [isOtEmpty, setIsOtEmpty] = useState(Boolean(editingRow && !editingRow.work_order_id))
  const [isExpandedContractors, setIsExpandedContractors] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [date, setDate] = useState(
    editingRow?.transaction_date
      ? toArIsoDate(editingRow.transaction_date)
      : getTodayArIso()
  )
  const [voucherNumber, setVoucherNumber] = useState(editingRow?.voucher_number || '')
  const [notes, setNotes] = useState(() => (editingRow ? stripGasTagFromNotes(editingRow.notes || '') : ''))
  const [items, setItems] = useState(() => {
    if (editingRow) {
      return [{
        material_id: editingRow.material_id || '',
        quantity: editingRow.quantity_withdrawn || 1,
        customCostCenter: editingRow.cost_center || '',
        notes: '',
        gasOperationType: linkedGasMovement?.operation_type || parsedGasNotes?.gasOperationType || 'PRIMERA_ENTREGA',
        supplierDeliveredId: linkedGasMovement?.supplier_delivered_id || parsedGasNotes?.supplierDeliveredId || '',
        supplierReturnedId: linkedGasMovement?.supplier_returned_id || parsedGasNotes?.supplierReturnedId || ''
      }]
    }
    return [createEmptyWithdrawalItem()]
  })

  const gasSuppliers = useMemo(() => {
    const flagged = suppliers.filter((s) => s.is_gas_supplier)
    return flagged.length > 0 ? flagged : suppliers
  }, [suppliers])

  const shipEnabled = useMemo(() => {
    if (!shipId || typeof getEnabledWorkersAndContractors !== 'function') return { astilleroWorkers, contractorGroups }
    return getEnabledWorkersAndContractors(shipId, null, { strictShipFilter: true })
  }, [getEnabledWorkersAndContractors, shipId, astilleroWorkers, contractorGroups])

  const shipEnabledAstSet = useMemo(
    () => new Set(shipEnabled.astilleroWorkers.map((w) => normalizeText(w.name))),
    [shipEnabled]
  )
  const shipEnabledCntSet = useMemo(
    () => new Set(shipEnabled.contractorGroups.map((g) => normalizeText(g))),
    [shipEnabled]
  )

  const enabled = useMemo(() => {
    if (isExpandedContractors) return { astilleroWorkers, contractorGroups }
    if (shipId && !isOtEmpty && workOrderId && typeof getEnabledWorkersAndContractors === 'function') {
      return getEnabledWorkersAndContractors(shipId, workOrderId, { strictShipFilter: true })
    }
    return shipEnabled
  }, [isExpandedContractors, shipId, isOtEmpty, workOrderId, getEnabledWorkersAndContractors, shipEnabled, astilleroWorkers, contractorGroups])

  const availableWos = useMemo(
    () => getContractorEnabledWos(shipId, contractorGroup, workOrders, workItems, { astilleroWorkers, contractorGroups }),
    [shipId, contractorGroup, workOrders, workItems, astilleroWorkers, contractorGroups]
  )

  const allocState = useMemo(
    () => evaluateAllocationState({
      shipId, workOrderId: isOtEmpty ? null : workOrderId, contractorName: contractorGroup,
      isSinOt: isOtEmpty, availableWos, pendingAlerts
    }),
    [shipId, isOtEmpty, workOrderId, contractorGroup, availableWos, pendingAlerts]
  )

  const isSelectedContractorWithoutShipOt = Boolean(
    shipId && contractorGroup &&
      !shipEnabledAstSet.has(normalizeText(contractorGroup)) &&
      !shipEnabledCntSet.has(normalizeText(contractorGroup))
  )

  const handleAddItem = () => setItems((prev) => [...prev, createEmptyWithdrawalItem()])
  const handleRemoveItem = (index) => {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleItemChange = (index, field, value) => {
    setItems((prev) => {
      const next = [...prev]
      const current = { ...next[index], [field]: value }
      if (field === 'material_id') {
        const selectedMat = materials.find((m) => m.id === value)
        if (isGasMaterial(selectedMat)) {
          current.gasOperationType = current.gasOperationType || 'PRIMERA_ENTREGA'
          current.supplierDeliveredId = current.supplierDeliveredId || ''
          current.supplierReturnedId = current.supplierReturnedId || ''
          current.quantity = Math.max(1, Math.round(Number(current.quantity) || 1))
        }
      }
      next[index] = current
      return next
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return
    if (!shipId) return alert('Debes seleccionar un Barco.')
    if (!contractorGroup) return alert('Debes seleccionar un Operario o Contratista.')
    if (!isOtEmpty && !workOrderId) return alert('Debes seleccionar una OT o marcar la casilla (⚠️ Sin OT).')

    const validItems = items.filter((it) => it.material_id && Number(it.quantity) > 0)
    if (validItems.length === 0) return alert('Debes cargar al menos un material válido con cantidad mayor a 0.')

    for (const it of validItems) {
      const mat = materials.find((m) => m.id === it.material_id)
      if (isGasMaterial(mat)) {
        const op = it.gasOperationType || 'PRIMERA_ENTREGA'
        if (!it.supplierDeliveredId) return alert(`Seleccioná la Marca / Proveedor Entregada para "${mat.name}".`)
        if (op === 'RECAMBIO_1X1' && !it.supplierReturnedId) {
          return alert(`En Recambio 1x1 debés seleccionar la Marca / Proveedor Devuelta para "${mat.name}".`)
        }
      }
    }

    try {
      setIsSubmitting(true)
      await onSave({
        shipId, workOrderId: isOtEmpty ? null : workOrderId, contractorGroup,
        voucherNumber, notes, date, items: validItems, editId: editingRow?.id || null, linkedGasMovement
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <CanonicalStepperModal
      isOpen={true}
      onClose={onClose}
      maxWidthClass="max-w-5xl"
      icon={editingRow ? <Edit3 className="w-4 h-4 text-cyan-400" /> : <Package className="w-4 h-4 text-emerald-400" />}
      title={editingRow ? 'REGISTRAR SALIDA MULTI-MATERIAL DE PAÑOL — MODO EDICIÓN' : 'REGISTRAR SALIDA MULTI-MATERIAL DE PAÑOL'}
      onSubmit={handleSubmit}
      footerLeft={
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer disabled:opacity-50"
        >
          Cancelar
        </button>
      }
      footerRight={
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-wait"
        >
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{isSubmitting ? 'Guardando...' : editingRow ? 'Guardar Cambios' : `Confirmar Retiro (${items.length} materiales)`}</span>
        </button>
      }
    >
      <CanonicalStepperStep step={1} helpEntry={PANOL_WITHDRAWAL_STEP_HELP[1]}>
        <MultiWithdrawalDestinationStep
          ships={ships} workOrders={workOrders} workItems={workItems}
          astilleroWorkers={astilleroWorkers} contractorGroups={contractorGroups}
          unauthorizedWorkers={unauthorizedWorkers} getEnabledWorkersAndContractors={getEnabledWorkersAndContractors}
          shipId={shipId} setShipId={setShipId} contractorGroup={contractorGroup} setContractorGroup={setContractorGroup}
          workOrderId={workOrderId} setWorkOrderId={setWorkOrderId} isOtEmpty={isOtEmpty} setIsOtEmpty={setIsOtEmpty}
          isExpandedContractors={isExpandedContractors} setIsExpandedContractors={setIsExpandedContractors}
          enabled={enabled} shipEnabledAstSet={shipEnabledAstSet} shipEnabledCntSet={shipEnabledCntSet}
          availableWos={availableWos} allocState={allocState}
          isSelectedContractorWithoutShipOt={isSelectedContractorWithoutShipOt}
          onRequestOt={onRequestOt} onRequestWorkerPermission={onRequestWorkerPermission}
        />
      </CanonicalStepperStep>

      <CanonicalStepperStep step={2} helpEntry={PANOL_WITHDRAWAL_STEP_HELP[2]}>
        <MultiWithdrawalItemsStep
          items={items} materials={materials} gasSuppliers={gasSuppliers} gasStats={gasStats}
          contractorGroup={contractorGroup} isAdmin={isAdmin}
          onAddItem={handleAddItem} onRemoveItem={handleRemoveItem} onItemChange={handleItemChange}
        />
      </CanonicalStepperStep>

      <CanonicalStepperStep
        step={3}
        helpEntry={PANOL_WITHDRAWAL_STEP_HELP[3]}
        title="FECHA, Nº REMITO Y OBSERVACIONES"
        isLast={true}
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          <div className="md:col-span-3">
            <label className="block text-slate-400 font-semibold text-[11px] mb-1">Fecha del Retiro</label>
            <input
              type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
            />
          </div>
          <div className="md:col-span-3">
            <label className="flex items-center justify-between text-slate-400 font-semibold text-[11px] mb-1">
              <span>Nº Remito AlonCar</span>
              <span className="text-[9px] text-cyan-400 font-mono">PAÑOL</span>
            </label>
            <input
              type="text" value={voucherNumber} onChange={(e) => setVoucherNumber(e.target.value)}
              placeholder="Ej: 2530"
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-cyan-500/40 text-cyan-200 font-mono text-xs focus:outline-none focus:border-cyan-400"
            />
          </div>
          <div className="md:col-span-6">
            <label className="block text-slate-400 font-semibold text-[11px] mb-1">Observaciones Generales</label>
            <input
              type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Retiro para reparación de mamparo en bodega de popa..."
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>
      </CanonicalStepperStep>
    </CanonicalStepperModal>
  )
}

export { MultiWithdrawalModal }
