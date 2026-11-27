import { useState, useMemo } from 'react'
import {
  X,
  AlertCircle,
  ShoppingCart,
  Send,
  UserCheck,
  Flame
} from 'lucide-react'
import { normalizeText } from '../../lib/allocationEngine'
import { isGasMaterial } from '../../lib/panolConstants'
import { formatDateAr, getTodayArIso } from '../../lib/dateTimeCanonical'
import { PANOL_QUICK_PURCHASE_STEP_HELP, PANOL_GAS_CONTRACTOR_STEP_HELP } from '../../lib/businessHelpRegistry'
import { CanonicalStepperModal, CanonicalStepperStep } from '../canonical/CanonicalStepperModal.jsx'
import { MaterialAutocompleteInput } from './MaterialAutocompleteInput.jsx'
import MultiWithdrawalModal from './MultiWithdrawalModal.jsx'
import { GasFinalReturnModal } from './GasFinalReturnModal.jsx'
import { GasSupplierMovementModal } from './GasSupplierMovementModal.jsx'
import MaterialCatalogFormModal from './MaterialCatalogFormModal.jsx'
import MaterialRubrosManagerModal from './MaterialRubrosManagerModal.jsx'
import MaterialConsumption6MModal from './MaterialConsumption6MModal.jsx'
import StockAdjustModal from './StockAdjustModal.jsx'
import MaterialStockKardexModal from './MaterialStockKardexModal.jsx'
import StockAuditBatchModal from './StockAuditBatchModal.jsx'
import {
  updateCatalogMaterialService,
  uploadMaterialImageService
} from '../../lib/panolCatalogService'
import {
  createStockAdjustmentService,
  createStockRecountAdjustmentService,
  createStockAuditBatchService
} from '../../lib/stockControlService'
import {
  saveMultiWithdrawalService,
  createMaterialService,
  createDirectPurchaseOrderService,
  submitRequestOtService,
  submitWorkerPermissionService,
  fetchPendingPanolAlertsService,
  registerGasFinalReturnService,
  saveSupplierGasBatchService,
  createQuickGasMaterialService,
  saveContractorGasMovementService
} from '../../lib/panolService'

// ==============================================================================
// 1. BUSCADOR INTELIGENTE DE MATERIALES (RE-EXPORT MODULAR)
// ==============================================================================
export { MaterialAutocompleteInput as MaterialSearchInput }

// ==============================================================================
// 2. MODAL DE RETIRO MULTI-MATERIAL (RE-EXPORT MODULAR · STEPPER VERTICAL)
// ==============================================================================
export { MultiWithdrawalModal }

// ==============================================================================
// 3. MODAL DE PEDIDO DE COMPRA DIRECTO
// ==============================================================================
export function QuickPurchaseModal({ material, initialQuantity, initialUrgency = 'SIN_APURO', onClose, onConfirm }) {
  const [quantity, setQuantity] = useState(initialQuantity || '')
  const [urgency, setUrgency] = useState(initialUrgency || 'SIN_APURO')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const today = formatDateAr(getTodayArIso())

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await onConfirm({ material, quantity, urgency })
    } catch {
      // Toast gestionado por el llamador
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <CanonicalStepperModal
      isOpen={true}
      onClose={onClose}
      maxWidthClass="max-w-3xl"
      icon={<ShoppingCart className="w-5 h-5 text-cyan-400" />}
      title="PEDIDO DIRECTO A COMPRAS"
      onSubmit={handleSubmit}
      footerLeft={
        <button type="button" onClick={onClose} className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer">
          Cancelar
        </button>
      }
      footerRight={
        <button type="submit" disabled={isSubmitting} className="px-4 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black flex items-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-600/30 disabled:opacity-50">
          <ShoppingCart className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>{isSubmitting ? 'Enviando...' : 'Confirmar Pedido a Compras'}</span>
        </button>
      }
    >
      <CanonicalStepperStep step={1} helpEntry={PANOL_QUICK_PURCHASE_STEP_HELP[1]} title="MATERIAL Y DESTINO EN COMPRAS">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-2.5 rounded-xl bg-slate-950 border border-slate-800">
          <div className="sm:col-span-2">
            <span className="text-[10px] text-slate-500 uppercase font-mono font-bold block">Material / Insumo Requerido</span>
            <span className="font-bold text-white text-sm block truncate">{material?.name}</span>
            <span className="text-[11px] text-cyan-400 font-mono">Unidad oficial: {material?.unit_measure || 'un.'}</span>
          </div>
          <div className="text-[11px] text-slate-300 space-y-0.5 sm:border-l sm:border-slate-800 sm:pl-3">
            <div><span className="text-slate-400">Destino:</span> <strong className="text-white">Stock Pañol</strong></div>
            <div><span className="text-slate-400">Estado:</span> <strong className="font-mono text-cyan-300">PEDIR</strong></div>
            <div><span className="text-slate-400">Fecha:</span> <span className="font-mono">{today}</span></div>
          </div>
        </div>
      </CanonicalStepperStep>

      <CanonicalStepperStep step={2} helpEntry={PANOL_QUICK_PURCHASE_STEP_HELP[2]} title="CANTIDAD Y URGENCIA" isLast={true}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-400 font-semibold text-[11px] mb-1">Cantidad a Pedir ({material?.unit_measure || 'un.'})</label>
            <input type="number" min="0.1" step="any" autoFocus required value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="1" className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono font-bold focus:outline-none focus:border-cyan-400" />
          </div>
          <div>
            <label className="block text-slate-400 font-semibold text-[11px] mb-1">Nivel de Urgencia</label>
            <select value={urgency} onChange={(e) => setUrgency(e.target.value)} className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold focus:outline-none focus:border-cyan-400">
              <option value="SIN_APURO">🟢 Sin Apuro (Normal)</option>
              <option value="URGENTE">🔴 Urgente (Prioridad Alta)</option>
              <option value="PROXIMA_SALIDA">🟡 Próxima Salida de Buque</option>
            </select>
          </div>
        </div>
      </CanonicalStepperStep>
    </CanonicalStepperModal>
  )
}

// 4. MODAL ALTA / EDICIÓN DE MATERIAL (RE-EXPORT MODULAR <= 250L)
export { MaterialCatalogFormModal as NewMaterialModal }

// ==============================================================================
// 5. SUBCOMPONENTE: AJUSTE DE STOCK FÍSICO (RE-EXPORT MODULAR CANÓNICO)
// ==============================================================================
export { StockAdjustModal }

// ==============================================================================
// 6. SUBCOMPONENTE: MOVIMIENTO DE GASES Y CILINDROS
// ==============================================================================
export function GasMovementModal({ operationType, materials, suppliers, ships, workOrders, workers, onClose, onSave }) {
  const [opType, setOpType] = useState(operationType || 'PRIMERA_ENTREGA')
  const [materialId, setMaterialId] = useState('')
  const [shipId, setShipId] = useState('')
  const [contractorName, setContractorName] = useState('')
  const [supplierDeliveredId, setSupplierDeliveredId] = useState('')
  const [supplierReturnedId, setSupplierReturnedId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!materialId) return alert('Debes seleccionar un tipo de gas.')
    if (!contractorName) return alert('Debes seleccionar un contratista.')

    onSave({
      operation_type: opType,
      material_id: materialId,
      ship_id: shipId || null,
      contractor_name: contractorName,
      supplier_delivered_id: supplierDeliveredId || null,
      supplier_returned_id: supplierReturnedId || null,
      quantity: Number(quantity) || 1,
      notes
    })
  }

  return (
    <CanonicalStepperModal
      isOpen={true}
      onClose={onClose}
      maxWidthClass="max-w-5xl"
      icon={<Flame className="w-5 h-5 text-amber-400" />}
      title="MOVIMIENTO DE TUBOS DE GAS (CONTRATISTAS)"
      onSubmit={handleSubmit}
      footerLeft={
        <button type="button" onClick={onClose} className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer">
          Cancelar
        </button>
      }
      footerRight={
        <button type="submit" className="px-5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black cursor-pointer shadow-lg shadow-amber-600/30">
          Guardar Movimiento
        </button>
      }
    >
      <CanonicalStepperStep step={1} helpEntry={PANOL_GAS_CONTRACTOR_STEP_HELP[1]} title="OPERACIÓN, CONTRATISTA Y BUQUE">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          <div>
            <label className="block text-slate-400 font-semibold text-[11px] mb-1">Tipo de Operación Canónica</label>
            <select value={opType} onChange={(e) => setOpType(e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-amber-400 font-bold focus:outline-none focus:border-cyan-400">
              <option value="PRIMERA_ENTREGA">1. Primera Entrega (+1 deuda, -1 lleno)</option>
              <option value="RECAMBIO_1X1">2. Recambio 1x1 con Cruce (+1 vacío, -1 lleno)</option>
              <option value="DEVOLUCION_FINAL">3. Devolución Final (-1 deuda, +1 vacío)</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-400 font-semibold text-[11px] mb-1">Contratista <span className="text-rose-400">*</span></label>
            <input type="text" required placeholder="Ej: TANO, BOLTRI..." value={contractorName} onChange={(e) => setContractorName(e.target.value.toUpperCase())} className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white uppercase focus:outline-none focus:border-cyan-400" />
          </div>
          <div>
            <label className="block text-slate-400 font-semibold text-[11px] mb-1">Buque / Destino</label>
            <select value={shipId} onChange={(e) => setShipId(e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-cyan-400">
              <option value="">(Sin Barco / Astillero)</option>
              {ships.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      </CanonicalStepperStep>

      <CanonicalStepperStep step={2} helpEntry={PANOL_GAS_CONTRACTOR_STEP_HELP[2]} title="GAS, MARCAS Y CANTIDAD">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
          <div>
            <label className="block text-slate-400 font-semibold text-[11px] mb-1">Gas / Tubo <span className="text-rose-400">*</span></label>
            <select value={materialId} onChange={(e) => setMaterialId(e.target.value)} required className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-cyan-400">
              <option value="">Seleccionar Gas...</option>
              {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-slate-400 font-semibold text-[11px] mb-1">Marca Entregada</label>
            <select value={supplierDeliveredId} onChange={(e) => setSupplierDeliveredId(e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-cyan-400">
              <option value="">Seleccionar Marca...</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-slate-400 font-semibold text-[11px] mb-1">Marca Devuelta</label>
            <select value={supplierReturnedId} onChange={(e) => setSupplierReturnedId(e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-cyan-400">
              <option value="">Seleccionar Marca...</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-slate-400 font-semibold text-[11px] mb-1">Cantidad Tubos</label>
            <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:border-cyan-400" />
          </div>
        </div>
      </CanonicalStepperStep>

      <CanonicalStepperStep step={3} helpEntry={PANOL_GAS_CONTRACTOR_STEP_HELP[3]} title="OBSERVACIONES / TRAZABILIDAD" isLast={true}>
        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: Tubo de acetileno entregado para corte en grada..." className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-cyan-400" />
      </CanonicalStepperStep>
    </CanonicalStepperModal>
  )
}

// ==============================================================================
// 7. MODAL SOLICITAR APERTURA DE OT A JORGE SENTIS
// ==============================================================================
export function RequestOtModal({
  isOpen,
  shipId,
  targetWorkerOrContractor,
  reason,
  ships,
  astilleroWorkers,
  contractorGroups,
  onChangeShipId,
  onChangeTargetWorkerOrContractor,
  onChangeReason,
  onClose,
  onSubmit
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 font-sans">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <AlertCircle className="w-5 h-5" />
            <span>Solicitar Apertura de OT a Jorge Sentis</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-300">
          El operario o contratista no cuenta con una OT habilitada en este buque. 
          Al confirmar, se enviará una notificación prioritaria a <strong>Jorge Sentis (Administrador)</strong> para la apertura de la nueva OT y se habilitará la entrega provisoria bajo <strong>(⚠️ Sin OT)</strong>.
        </p>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">Buque / Destino</label>
            <select
              value={shipId}
              onChange={(e) => onChangeShipId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
            >
              <option value="">-- Seleccionar Buque --</option>
              {ships.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">Operario o Contratista Requerido</label>
            <select
              value={targetWorkerOrContractor}
              onChange={(e) => onChangeTargetWorkerOrContractor(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-amber-400 font-bold focus:outline-none focus:border-amber-400"
            >
              <option value="">-- Seleccionar de la nómina completa --</option>
              <optgroup label="⭐ Personal Astillero (Aloncar)">
                {astilleroWorkers.map((w) => (
                  <option key={`req_ast_${w.id || w.name}`} value={w.name}>
                    {w.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="🏗️ Contratistas Externos">
                {contractorGroups.map((grp) => (
                  <option key={`req_cnt_${grp}`} value={grp}>
                    {grp}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">Motivo / Tareas a Realizar</label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => onChangeReason(e.target.value)}
              placeholder="Ej: Se requiere retirar insumos para tareas urgentes no contempladas en las OTs actuales..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-lg shadow-amber-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Enviar Alerta a Jorge Sentis</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ==============================================================================
// 8. MODAL SOLICITAR HABILITACIÓN DE OPERARIO A JORGE SENTIS
// ==============================================================================
export function WorkerPermissionModal({
  isOpen,
  workerId,
  reason,
  unauthorizedWorkers,
  onChangeWorkerId,
  onChangeReason,
  onClose,
  onSubmit
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const filteredWorkers = useMemo(() => {
    const q = normalizeText(searchTerm)
    if (!q) return unauthorizedWorkers
    return unauthorizedWorkers.filter(
      (w) =>
        normalizeText(w.name).includes(q) ||
        normalizeText(w.trade).includes(q) ||
        normalizeText(w.admin_center).includes(q) ||
        normalizeText(w.work_group).includes(q)
    )
  }, [unauthorizedWorkers, searchTerm])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 font-sans">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
            <UserCheck className="w-5 h-5" />
            <span>Solicitar Habilitación de Operario a Jorge Sentis</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          La persona seleccionada no cuenta con permiso de retiro de materiales en Pañol (<strong>P</strong>).
          Al enviar esta solicitud, <strong>Jorge Sentis (Administrador)</strong> recibirá una alerta para habilitarlo en el Padrón de Personal.
        </p>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">
              Buscar Operario o Contratista sin Permiso ({filteredWorkers.length} de {unauthorizedWorkers.length})
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrar por nombre, empresa o rubro..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white mb-2 focus:outline-none focus:border-cyan-400"
            />
            <select
              value={workerId}
              onChange={(e) => onChangeWorkerId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-cyan-400 font-bold focus:outline-none focus:border-cyan-400"
            >
              <option value="">-- Seleccionar Operario / Contratista a Habilitar --</option>
              {filteredWorkers.map((w) => (
                <option key={`unauth_${w.id}`} value={w.id}>
                  {w.name} ({w.admin_center || 'Astillero'}{w.work_group && w.work_group !== w.name ? ` · ${w.work_group}` : ''}{w.trade ? ` - ${w.trade}` : ''})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">Motivo / Justificación</label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => onChangeReason(e.target.value)}
              placeholder="Ej: Asignado a tareas urgentes en dique, requiere retirar insumos de trabajo y EPP..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Enviar Solicitud a Jorge Sentis</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ==============================================================================
// 9. MODAL PREVISUALIZAR IMAGEN TÉCNICA
// ==============================================================================
export function ImagePreviewModal({ previewImage, onClose }) {
  if (!previewImage) return null

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer font-sans"
    >
      <div className="max-w-2xl max-h-[85vh] bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden p-2 shadow-2xl">
        <img src={previewImage} alt="Material Técnico" className="w-full h-auto max-h-[80vh] object-contain rounded-xl" />
      </div>
    </div>
  )
}

// ==============================================================================
// 10. CONTENEDOR MODULAR UNIFICADO DE MODALES DE PAÑOL
// ==============================================================================
export function PanolModalsContainer({
  showWithdrawalModal,
  setShowWithdrawalModal,
  editingWithdrawalRow,
  setEditingWithdrawalRow,
  materialFormModal = { isOpen: false, material: null },
  setMaterialFormModal,
  showRubrosModal = false,
  setShowRubrosModal,
  consumption6MModal = { isOpen: false, material: null },
  setConsumption6MModal,
  showStockAdjustModal,
  setShowStockAdjustModal,
  showAuditBatchModal = false, setShowAuditBatchModal = null, setStockAudits = null,
  kardexModal = { isOpen: false, material: null }, setKardexModal = null, setStockAdjustments = null,
  virtualStockMap = null,
  showGasModal,
  setShowGasModal,
  gasFinalReturnModal,
  setGasFinalReturnModal,
  gasSupplierModal,
  setGasSupplierModal,
  quickPurchaseModal,
  setQuickPurchaseModal,
  requestOtModal,
  setRequestOtModal,
  workerPermissionModal,
  setWorkerPermissionModal,
  previewImage,
  setPreviewImage,
  materials,
  setMaterials,
  inventoryTx = [],
  setInventoryTx,
  gasMovements = [],
  setGasMovements,
  gasStats = null,
  ships,
  workOrders,
  workItems,
  astilleroWorkers,
  contractorGroups,
  unauthorizedWorkers,
  getEnabledWorkersAndContractors,
  pendingAlerts,
  setPendingAlerts,
  suppliers,
  rubros,
  workers,
  macroVariables = [],
  pricingPolicy = null,
  isAdmin,
  user,
  showFeedback,
  onRefreshData = null,
  navigate = null
}) {
  const handleSaveMultiWithdrawal = async (payload) => {
    try {
      const res = await saveMultiWithdrawalService({
        ...payload, originalTx: editingWithdrawalRow, gasMovements, materials, suppliers,
        ships, workItems, astilleroWorkers, workers, macroVariables, pricingPolicy, user
      })
      if (res.isEdit) {
        setInventoryTx((prev) => prev.map((t) => (t.id === payload.editId ? { ...t, ...res.updates } : t)))
        if (res.matUpdates?.length > 0) {
          setMaterials((prev) => prev.map((m) => {
            const upd = res.matUpdates.find((u) => u.id === m.id)
            return upd ? { ...m, current_stock: upd.newStock } : m
          }))
        }
        if (setGasMovements) {
          setGasMovements((prev) => {
            let next = prev
            if (res.deletedGasMovementId) {
              next = next.filter((g) => g.id !== res.deletedGasMovementId)
            }
            if (res.updatedGasMovement) {
              next = next.map((g) => (g.id === res.updatedGasMovement.id ? res.updatedGasMovement : g))
            }
            if (res.createdGasMovements?.length > 0) {
              next = [...res.createdGasMovements, ...next]
            }
            return next
          })
        }
        setShowWithdrawalModal(false)
        setEditingWithdrawalRow(null)
        showFeedback('success', 'Fila modificada y sincronizada con éxito.')
        return
      }
      setInventoryTx((prev) => [...res.createdTxs, ...prev])
      setMaterials((prev) => prev.map((m) => {
        const upd = res.matUpdates.find((u) => u.id === m.id)
        return upd ? { ...m, current_stock: upd.newStock } : m
      }))
      if (res.createdGasMovements?.length > 0 && setGasMovements) {
        setGasMovements((prev) => [...res.createdGasMovements, ...prev])
      }
      const gasMsg = res.createdGasMovements?.length > 0
        ? ` (+ ${res.createdGasMovements.length} mov. en Control de Gases)`
        : ''
      showFeedback('success', `Retiro confirmado: ${res.createdTxs.length} insumos registrados${gasMsg}.`)
      setShowWithdrawalModal(false)
    } catch (err) {
      showFeedback('error', 'Error registrando retiro: ' + err.message)
    }
  }

  const handleSaveMaterialForm = async ({ material, formData, imageFile }) => {
    try {
      if (material?.id) {
        const updated = await updateCatalogMaterialService({
          material,
          formData,
          imageFile,
          existingMaterials: materials,
          isAdmin,
          user
        })
        setMaterials((prev) => prev.map((m) => (m.id === material.id ? { ...m, ...updated } : m)))
        if (isAdmin && onRefreshData) onRefreshData({ silent: true })
        showFeedback(
          'success',
          isAdmin
            ? `Material "${updated.name}" actualizado con éxito.`
            : `Foto de "${material.name}" actualizada con éxito.`
        )
        setMaterialFormModal({ isOpen: false, material: null })
        return
      }

      let imageUrl = null
      if (imageFile) {
        imageUrl = await uploadMaterialImageService({ materialName: formData?.name, imageFile })
      }
      const data = await createMaterialService({
        formData: { ...formData, image_url: imageUrl },
        existingMaterials: materials,
        user
      })
      setMaterials((prev) => [data, ...prev])
      showFeedback('success', `Material "${data.name}" agregado con éxito al Catálogo B.D.`)
      setMaterialFormModal({ isOpen: false, material: null })
    } catch (e) {
      showFeedback('error', 'Error guardando material: ' + e.message)
      throw e
    }
  }

  const handleSaveStockAdjust = async (payload) => {
    try {
      const targetMat = payload?.material || materials.find((m) => m.id === payload?.materialId)
      const isRecount = payload?.mode === 'RECOUNT'
      const res = isRecount
        ? await createStockRecountAdjustmentService({
            material: targetMat, targetStock: payload.quantity,
            reasonType: payload.reasonType || 'AUDIT_CORRECTION',
            materialCondition: payload.materialCondition || 'DISPONIBLE',
            date: payload.date, notes: payload.notes, user
          })
        : await createStockAdjustmentService({
            materialId: payload.materialId,
            quantity: payload.mode === 'EXIT' ? -Math.abs(Number(payload.quantity)) : Math.abs(Number(payload.quantity)),
            reasonType: payload.reasonType || 'MANUAL_ENTRY',
            materialCondition: payload.materialCondition || 'DISPONIBLE',
            date: payload.date, notes: payload.notes, material: targetMat, user
          })
      if (res.skipped) {
        showFeedback('success', 'Sin cambios: el recuento físico coincide con el stock actual.')
        setShowStockAdjustModal({ isOpen: false, material: null, initialMode: null })
        return
      }
      setMaterials((prev) => prev.map((m) => (m.id === payload.materialId ? { ...m, current_stock: res.newStock } : m)))
      if (res.adjustment && setStockAdjustments) {
        setStockAdjustments((prev) => [res.adjustment, ...prev])
      }
      showFeedback('success', 'Movimiento de stock registrado y recalculado en PostgreSQL.')
      setShowStockAdjustModal({ isOpen: false, material: null, initialMode: null })
    } catch (err) {
      showFeedback('error', 'Error al registrar movimiento: ' + err.message)
      throw err
    }
  }

  const handleSaveAuditBatch = async (payload) => {
    try {
      const res = await createStockAuditBatchService({ ...payload, user })
      if (res.createdAudits?.length > 0 && setStockAudits) setStockAudits((prev) => [...res.createdAudits, ...prev])
      if (res.createdAdjustments?.length > 0 && setStockAdjustments) setStockAdjustments((prev) => [...res.createdAdjustments, ...prev])
      if (res.stockByMaterialId?.size > 0) {
        setMaterials((prev) => prev.map((m) => (res.stockByMaterialId.has(String(m.id)) ? { ...m, current_stock: res.stockByMaterialId.get(String(m.id)) } : m)))
      }
      showFeedback('success', `Control físico guardado: ${res.createdAudits.length} ítem(s)${res.createdAdjustments.length > 0 ? ` · ${res.createdAdjustments.length} ajuste(s) aplicado(s)` : ''}.`)
      setShowAuditBatchModal?.(false)
    } catch (err) {
      showFeedback('error', 'Error guardando control físico: ' + err.message)
      throw err
    }
  }

  const handleSaveGasMovement = async (gasData) => {
    try {
      const data = await saveContractorGasMovementService({ gasData, user })
      if (setGasMovements) setGasMovements((prev) => [data, ...prev])
      showFeedback('success', 'Movimiento de gas registrado y auditado correctamente.')
      setShowGasModal({ isOpen: false, operationType: 'PRIMERA_ENTREGA' })
    } catch (e) {
      showFeedback('error', 'Error en movimiento de tubos: ' + e.message)
    }
  }

  const handleConfirmGasSupplierModal = async (payload) => {
    try {
      const created = await saveSupplierGasBatchService({
        ...payload,
        suppliers,
        materials,
        user
      })
      if (created?.length > 0 && setGasMovements) {
        setGasMovements((prev) => [...created, ...prev])
      }
      const supName = suppliers.find((s) => s.id === payload.supplierId)?.name || 'Gasera'
      showFeedback(
        'success',
        `Remito / Movimiento registrado con ${supName}: ${created.length} renglón(es) en Trazabilidad.`
      )
      if (setGasSupplierModal) {
        setGasSupplierModal({ isOpen: false, supplierId: '' })
      }
    } catch (e) {
      showFeedback('error', 'Error registrando movimiento con empresa gasera: ' + e.message)
    }
  }

  const handleCreateQuickGas = async (rawName) => {
    try {
      const created = await createQuickGasMaterialService({ name: rawName, user })
      if (created?.id) {
        setMaterials((prev) => (prev.some((m) => m.id === created.id) ? prev : [...prev, created]))
        showFeedback('success', `Tipo de gas "${created.name}" agregado al Catálogo B.D (Stock 0).`)
      }
      return created
    } catch (e) {
      showFeedback('error', 'Error creando tipo de gas: ' + e.message)
      return null
    }
  }

  const handleConfirmGasFinalReturn = async (payload) => {
    try {
      const created = await registerGasFinalReturnService({ ...payload, user })
      if (created?.length > 0 && setGasMovements) {
        setGasMovements((prev) => [...created, ...prev])
      }
      const totalQty = (created || []).reduce((acc, row) => acc + (Number(row.quantity) || 0), 0)
      showFeedback('success', `Devolución Final registrada: ${totalQty} tubo(s) devuelto(s) a patio.`)
      if (setGasFinalReturnModal) {
        setGasFinalReturnModal({ isOpen: false, contractorName: '' })
      }
    } catch (e) {
      showFeedback('error', 'Error registrando devolución final: ' + e.message)
    }
  }

  const handleConfirmQuickPurchase = async (args) => {
    try {
      await createDirectPurchaseOrderService({ ...args, ships, user })
      setQuickPurchaseModal({ isOpen: false, material: null, quantity: '', urgency: 'SIN_APURO' })
      showFeedback('success', `Pedido de "${args.material?.name}" enviado a Compras.`)
    } catch (e) {
      showFeedback('error', 'Error al generar pedido: ' + e.message)
    }
  }

  const handleSubmitRequestOt = async () => {
    try {
      await submitRequestOtService({ requestOtModal, ships })
      setRequestOtModal({ isOpen: false, txId: null, shipId: '', targetWorkerOrContractor: '', reason: '' })
      showFeedback('success', '🔔 Alerta enviada a Jorge Sentis para apertura de OT.')
      const updatedAlerts = await fetchPendingPanolAlertsService()
      if (updatedAlerts && setPendingAlerts) setPendingAlerts(updatedAlerts)
    } catch (e) {
      showFeedback('error', 'Error al solicitar OT: ' + e.message)
    }
  }

  const handleSubmitWorkerPermission = async () => {
    try {
      await submitWorkerPermissionService({ workerPermissionModal, workers, user })
      setWorkerPermissionModal({ isOpen: false, workerId: '', reason: '' })
      showFeedback('success', '🔔 Alerta enviada a Jorge Sentis para habilitar operario en Pañol.')
      const updatedAlerts = await fetchPendingPanolAlertsService()
      if (updatedAlerts && setPendingAlerts) setPendingAlerts(updatedAlerts)
    } catch (e) {
      showFeedback('error', 'Error al solicitar habilitación: ' + e.message)
    }
  }

  return (
    <>
      {showWithdrawalModal && (
        <MultiWithdrawalModal
          key={editingWithdrawalRow?.id || 'new-withdrawal'}
          materials={materials} suppliers={suppliers} gasStats={gasStats} gasMovements={gasMovements}
          ships={ships} workOrders={workOrders} workItems={workItems}
          astilleroWorkers={astilleroWorkers} contractorGroups={contractorGroups} unauthorizedWorkers={unauthorizedWorkers}
          getEnabledWorkersAndContractors={getEnabledWorkersAndContractors} pendingAlerts={pendingAlerts}
          isAdmin={isAdmin} editingRow={editingWithdrawalRow}
          onRequestOt={(targetShipId, preselectedWorker) => setRequestOtModal({ isOpen: true, txId: null, shipId: targetShipId || '', targetWorkerOrContractor: preselectedWorker || '', reason: '' })}
          onRequestWorkerPermission={() => setWorkerPermissionModal({ isOpen: true, workerId: '', reason: '' })}
          onClose={() => { setShowWithdrawalModal(false); setEditingWithdrawalRow(null) }}
          onSave={handleSaveMultiWithdrawal}
        />
      )}

      {materialFormModal?.isOpen && (
        <MaterialCatalogFormModal
          key={materialFormModal.material?.id || 'new-material'}
          material={materialFormModal.material} rubros={rubros} materials={materials}
          isAdmin={isAdmin} pricingPolicy={pricingPolicy}
          onOpenRubrosManager={isAdmin ? () => setShowRubrosModal(true) : null}
          onClose={() => setMaterialFormModal({ isOpen: false, material: null })}
          onSave={handleSaveMaterialForm}
        />
      )}

      {showRubrosModal && (
        <MaterialRubrosManagerModal
          rubros={rubros} materials={materials} isAdmin={isAdmin} user={user}
          onRefreshData={onRefreshData} showFeedback={showFeedback} onClose={() => setShowRubrosModal(false)}
        />
      )}

      {consumption6MModal?.isOpen && consumption6MModal.material && (
        <MaterialConsumption6MModal
          material={consumption6MModal.material} inventoryTx={inventoryTx} workOrders={workOrders} ships={ships}
          virtualStockInfo={virtualStockMap?.get(String(consumption6MModal.material.id)) || null}
          onReponer={navigate ? (mat) => { setConsumption6MModal({ isOpen: false, material: null }); navigate(`/compras?nuevo=true&materialId=${mat.id}&materialName=${encodeURIComponent(mat.name)}`) } : null}
          onClose={() => setConsumption6MModal({ isOpen: false, material: null })}
        />
      )}

      {showAuditBatchModal && (
        <StockAuditBatchModal materials={materials} rubros={rubros} onClose={() => setShowAuditBatchModal?.(false)} onSave={handleSaveAuditBatch} />
      )}

      {showStockAdjustModal.isOpen && (
        <StockAdjustModal
          material={showStockAdjustModal.material}
          materials={materials}
          initialMode={showStockAdjustModal.initialMode || null}
          onClose={() => setShowStockAdjustModal({ isOpen: false, material: null, initialMode: null })}
          onSave={handleSaveStockAdjust}
        />
      )}

      {kardexModal?.isOpen && kardexModal.material && (
        <MaterialStockKardexModal
          material={materials.find((m) => m.id === kardexModal.material.id) || kardexModal.material}
          onClose={() => setKardexModal?.({ isOpen: false, material: null })}
          onOpenStockAdjust={(mat) => {
            setKardexModal?.({ isOpen: false, material: null })
            setShowStockAdjustModal({ isOpen: true, material: mat, initialMode: 'ENTRY' })
          }}
          onOpenQuickPurchase={(mat) => {
            setKardexModal?.({ isOpen: false, material: null })
            setQuickPurchaseModal({ isOpen: true, material: mat, quantity: '', urgency: 'SIN_APURO' })
          }}
        />
      )}

      {showGasModal.isOpen && (
        <GasMovementModal
          operationType={showGasModal.operationType}
          materials={materials.filter((m) => isGasMaterial(m))}
          suppliers={suppliers.filter((s) => s.is_gas_supplier)}
          ships={ships}
          workOrders={workOrders}
          workers={workers}
          onClose={() => setShowGasModal({ isOpen: false, operationType: 'PRIMERA_ENTREGA' })}
          onSave={handleSaveGasMovement}
        />
      )}

      {gasFinalReturnModal?.isOpen && (
        <GasFinalReturnModal
          key={gasFinalReturnModal.contractorName}
          isOpen={gasFinalReturnModal.isOpen}
          contractorName={gasFinalReturnModal.contractorName}
          contractorData={gasStats?.contractorDebts?.[gasFinalReturnModal.contractorName] || null}
          ships={ships}
          onClose={() => setGasFinalReturnModal({ isOpen: false, contractorName: '' })}
          onConfirm={handleConfirmGasFinalReturn}
        />
      )}

      {gasSupplierModal?.isOpen && (
        <GasSupplierMovementModal
          key={gasSupplierModal.supplierId || 'gas-supplier-new'}
          isOpen={gasSupplierModal.isOpen}
          initialSupplierId={gasSupplierModal.supplierId || ''}
          suppliers={suppliers.filter((s) => s.is_gas_supplier)}
          materials={materials.filter((m) => isGasMaterial(m))}
          gasStats={gasStats}
          onClose={() => setGasSupplierModal({ isOpen: false, supplierId: '' })}
          onConfirm={handleConfirmGasSupplierModal}
          onCreateQuickGas={handleCreateQuickGas}
        />
      )}

      {quickPurchaseModal.isOpen && (
        <QuickPurchaseModal
          material={quickPurchaseModal.material}
          initialQuantity={quickPurchaseModal.quantity}
          initialUrgency={quickPurchaseModal.urgency || 'SIN_APURO'}
          onClose={() => setQuickPurchaseModal({ isOpen: false, material: null, quantity: '', urgency: 'SIN_APURO' })}
          onConfirm={handleConfirmQuickPurchase}
        />
      )}

      <ImagePreviewModal
        previewImage={previewImage}
        onClose={() => setPreviewImage(null)}
      />

      <RequestOtModal
        isOpen={requestOtModal.isOpen}
        shipId={requestOtModal.shipId}
        targetWorkerOrContractor={requestOtModal.targetWorkerOrContractor}
        reason={requestOtModal.reason}
        ships={ships}
        astilleroWorkers={astilleroWorkers}
        contractorGroups={contractorGroups}
        onChangeShipId={(val) => setRequestOtModal((prev) => ({ ...prev, shipId: val }))}
        onChangeTargetWorkerOrContractor={(val) => setRequestOtModal((prev) => ({ ...prev, targetWorkerOrContractor: val }))}
        onChangeReason={(val) => setRequestOtModal((prev) => ({ ...prev, reason: val }))}
        onClose={() => setRequestOtModal({ isOpen: false, txId: null, shipId: '', targetWorkerOrContractor: '', reason: '' })}
        onSubmit={handleSubmitRequestOt}
      />

      <WorkerPermissionModal
        isOpen={workerPermissionModal.isOpen}
        workerId={workerPermissionModal.workerId}
        reason={workerPermissionModal.reason}
        unauthorizedWorkers={unauthorizedWorkers}
        onChangeWorkerId={(val) => setWorkerPermissionModal((prev) => ({ ...prev, workerId: val }))}
        onChangeReason={(val) => setWorkerPermissionModal((prev) => ({ ...prev, reason: val }))}
        onClose={() => setWorkerPermissionModal({ isOpen: false, workerId: '', reason: '' })}
        onSubmit={handleSubmitWorkerPermission}
      />
    </>
  )
}
