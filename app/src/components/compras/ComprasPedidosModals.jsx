import ShipWorkOrderPickerModal from '../ShipWorkOrderPickerModal'
import ContractorPickerModal from '../ContractorPickerModal'
import OrderFormModal from './OrderFormModal'
import NewMaterialModal from './NewMaterialModal'
import {
  ReconcileModal,
  BatchOrderWhatsAppModal,
  OrderAttachmentsModal,
  PartialDeliveryModal,
  SeCompraAlertModal,
  AssignSupplierModal,
  FreightModal,
  SupplierHelperModal,
  MandadosModal
} from './ComprasAuxModals'

const EXTRA_REQUESTER_OPTIONS = [
  { name: 'PAÑOL', label: 'PAÑOL (Central / Reposición de Stock)' },
  { name: 'ADMINISTRACION', label: 'ADMINISTRACION' },
  { name: 'OFICINA TECNICA', label: 'OFICINA TECNICA' },
  { name: 'MANTENIMIENTO', label: 'MANTENIMIENTO' },
  { name: 'CALIDAD / SEGURIDAD', label: 'CALIDAD / SEGURIDAD' }
]

export default function ComprasPedidosModals({
  purchaseOrders,
  setPurchaseOrders,
  suppliers,
  materials,
  ships,
  workOrders,
  workItems,
  workers,
  documents,
  setDocuments,
  systemSettings,
  contractorGroups,
  astilleroWorkers,
  currentFortnight,
  viewMode,
  isSupervisorOrAdmin,
  showOrderModal,
  setShowOrderModal,
  editingOrder,
  modals,
  selectedOrderIds,
  setSelectedOrderIds,
  pushUndoAction,
  saveInlineEdit,
  handleApplySupplierHelper,
  handleNewMaterialSuccess,
  handleReconcileSuccess,
  handleFreightSuccess,
  handleShipWorkOrderSave,
  showFeedbackMsg
}) {
  const {
    shipPickerModal, setShipPickerModal,
    contractorPickerModal, setContractorPickerModal,
    showNewMaterialModal, setShowNewMaterialModal,
    pendingMaterialOrder, setPendingMaterialOrder,
    showOrderDocsModal, setShowOrderDocsModal,
    selectedOrderForDocs, setSelectedOrderForDocs,
    showPartialModal, setShowPartialModal,
    partialDeliveryOrder, setPartialDeliveryOrder,
    showSeCompraModal, setShowSeCompraModal,
    seCompraAlertOrder, setSeCompraAlertOrder,
    showAssignSupplierModal, setShowAssignSupplierModal,
    seCompraAlertSettings,
    showReconcileModal, setShowReconcileModal,
    reconcileTarget, setReconcileTarget,
    showFreightModal, setShowFreightModal,
    freightTargetOrder, setFreightTargetOrder,
    showBatchOrderModal, setShowBatchOrderModal,
    showSupplierHelperModal, setShowSupplierHelperModal,
    supplierHelperTarget, setSupplierHelperTarget,
    showMandadosModal, setShowMandadosModal,
    mandadosPreselectedIds, setMandadosPreselectedIds
  } = modals

  return (
    <>
      {showOrderModal && (
        <OrderFormModal
          order={editingOrder}
          ships={ships}
          workOrders={workOrders}
          suppliers={suppliers}
          materials={materials}
          workers={workers}
          contractorGroups={contractorGroups}
          currentFortnight={currentFortnight}
          viewMode={viewMode}
          isSupervisorOrAdmin={isSupervisorOrAdmin}
          onClose={() => setShowOrderModal(false)}
          onSuccess={(savedOrders) => {
            if (editingOrder) {
              setPurchaseOrders((prev) => prev.map((p) => (p.id === savedOrders[0].id ? savedOrders[0] : p)))
              showFeedbackMsg('success', 'Pedido actualizado correctamente.')
            } else {
              setPurchaseOrders((prev) => [...savedOrders, ...prev])
              showFeedbackMsg('success', `Se registraron ${savedOrders.length} materiales en la solicitud.`)
            }
            setShowOrderModal(false)
          }}
        />
      )}

      {showNewMaterialModal && pendingMaterialOrder && (
        <NewMaterialModal
          order={pendingMaterialOrder}
          onClose={() => { setShowNewMaterialModal(false); setPendingMaterialOrder(null) }}
          onDismissed={async (orderId) => {
            const targetPo = purchaseOrders.find((p) => p.id === orderId)
            pushUndoAction([{ rowId: orderId, colId: 'no_catalog_required', oldValue: Boolean(targetPo?.no_catalog_required), newValue: true }])
            setPurchaseOrders((prev) => prev.map((p) => (p.id === orderId ? { ...p, no_catalog_required: true } : p)))
            showFeedbackMsg('success', 'Se descartó el alta en catálogo (en rojo). Podés deshacer con Ctrl+Z.')
            setShowNewMaterialModal(false)
            setPendingMaterialOrder(null)
          }}
          onSuccess={handleNewMaterialSuccess}
        />
      )}

      {showReconcileModal && reconcileTarget && (
        <ReconcileModal
          target={reconcileTarget}
          onClose={() => { setShowReconcileModal(false); setReconcileTarget(null) }}
          onSuccess={handleReconcileSuccess}
          purchaseOrders={purchaseOrders}
        />
      )}

      {showFreightModal && freightTargetOrder && (
        <FreightModal
          order={freightTargetOrder}
          onClose={() => { setShowFreightModal(false); setFreightTargetOrder(null) }}
          onSuccess={handleFreightSuccess}
        />
      )}

      {showBatchOrderModal && (
        <BatchOrderWhatsAppModal
          selectedOrderIds={selectedOrderIds}
          purchaseOrders={purchaseOrders}
          suppliers={suppliers}
          systemSettings={systemSettings}
          onClose={() => setShowBatchOrderModal(false)}
          onSuccess={(updatedIds) => {
            setPurchaseOrders((prev) => prev.map((p) => (updatedIds.includes(p.id) ? { ...p, status: 'PEDIDO' } : p)))
            setShowBatchOrderModal(false)
            showFeedbackMsg('success', 'Pedidos emitidos por WhatsApp y actualizados a estado PEDIDO.')
          }}
        />
      )}

      {showOrderDocsModal && selectedOrderForDocs && (
        <OrderAttachmentsModal
          order={selectedOrderForDocs}
          documents={documents}
          suppliers={suppliers}
          ships={ships}
          workOrders={workOrders}
          onClose={() => { setShowOrderDocsModal(false); setSelectedOrderForDocs(null) }}
          onDocAdded={(newDoc) => { setDocuments((prev) => [newDoc, ...prev]); showFeedbackMsg('success', 'Documento adjuntado correctamente a la orden.') }}
          onDocUpdated={(updatedDoc) => { setDocuments((prev) => prev.map((d) => (d.id === updatedDoc.id ? updatedDoc : d))); showFeedbackMsg('success', 'Documento actualizado correctamente.') }}
          onDocDeleted={(deletedId) => { setDocuments((prev) => prev.filter((d) => d.id !== deletedId)); showFeedbackMsg('success', 'Documento eliminado correctamente.') }}
        />
      )}

      {showPartialModal && partialDeliveryOrder && (
        <PartialDeliveryModal
          order={partialDeliveryOrder}
          suppliers={suppliers}
          ships={ships}
          workOrders={workOrders}
          onClose={() => { setShowPartialModal(false); setPartialDeliveryOrder(null) }}
          onSuccess={({ originalOrder, childOrder, newDocs }) => {
            setPurchaseOrders((prev) => [childOrder, ...prev.map((p) => (p.id === originalOrder.id ? originalOrder : p))])
            if (newDocs?.length > 0) setDocuments((prev) => [...newDocs, ...prev])
            setShowPartialModal(false)
            setPartialDeliveryOrder(null)
            showFeedbackMsg('success', `Recepción parcial registrada: ${originalOrder.quantity} unidades ingresadas, ${childOrder.quantity} en reclamo pendiente.`)
          }}
        />
      )}

      {showSeCompraModal && seCompraAlertOrder && (
        <SeCompraAlertModal
          order={seCompraAlertOrder}
          alertSettings={seCompraAlertSettings}
          ships={ships}
          workOrders={workOrders}
          onClose={() => { setShowSeCompraModal(false); setSeCompraAlertOrder(null) }}
        />
      )}

      {showAssignSupplierModal && (
        <AssignSupplierModal
          selectedOrderIds={selectedOrderIds}
          suppliers={suppliers}
          onClose={() => setShowAssignSupplierModal(false)}
          onSuccess={(supplierId) => {
            setPurchaseOrders((prev) => prev.map((p) => (selectedOrderIds.has(p.id) ? { ...p, supplier_id: supplierId } : p)))
            const supName = suppliers.find((s) => s.id === supplierId)?.name || 'Proveedor'
            showFeedbackMsg('success', `Proveedor "${supName}" asignado a ${selectedOrderIds.size} pedidos.`)
            setSelectedOrderIds(new Set())
            setShowAssignSupplierModal(false)
          }}
        />
      )}

      <ShipWorkOrderPickerModal
        isOpen={shipPickerModal.isOpen}
        onClose={() => setShipPickerModal({ isOpen: false, orderId: null, shipId: '', workOrderId: '', chargeType: 'DIRECT', contractorName: '' })}
        ships={ships}
        workOrders={workOrders}
        workItems={workItems}
        currentShipId={shipPickerModal.shipId}
        currentWorkOrderId={shipPickerModal.workOrderId}
        currentChargeType={shipPickerModal.chargeType}
        allowAstilleroStock={true}
        contractorName={shipPickerModal.contractorName}
        title="Asignar Buque y Orden de Trabajo (Compras)"
        onSave={handleShipWorkOrderSave}
      />

      <ContractorPickerModal
        isOpen={contractorPickerModal.isOpen}
        onClose={() => setContractorPickerModal({ isOpen: false, orderId: null, currentValue: '', shipName: '', workOrderTitle: '', isOtBlank: true })}
        currentValue={contractorPickerModal.currentValue}
        shipName={contractorPickerModal.shipName}
        workOrderTitle={contractorPickerModal.workOrderTitle}
        isOtBlank={contractorPickerModal.isOtBlank}
        astilleroWorkers={astilleroWorkers}
        contractorGroups={contractorGroups}
        extraOptions={EXTRA_REQUESTER_OPTIONS}
        title="Asignar Solicitante (Compras)"
        onSelect={(selectedName) => { if (contractorPickerModal.orderId) saveInlineEdit(contractorPickerModal.orderId, 'requested_by_name', selectedName) }}
      />

      {showSupplierHelperModal && supplierHelperTarget && (
        <SupplierHelperModal
          order={supplierHelperTarget}
          purchaseOrders={purchaseOrders}
          suppliers={suppliers}
          ships={ships}
          workOrders={workOrders}
          onClose={() => { setShowSupplierHelperModal(false); setSupplierHelperTarget(null) }}
          onApply={handleApplySupplierHelper}
        />
      )}

      {showMandadosModal && (
        <MandadosModal
          purchaseOrders={purchaseOrders}
          suppliers={suppliers}
          workers={workers}
          preselectedIds={mandadosPreselectedIds}
          onDispatched={(dispatchedIds, info) => {
            setPurchaseOrders((prev) => prev.map((p) => (dispatchedIds.includes(p.id) ? { ...p, ...info } : p)))
            setSelectedOrderIds(new Set())
            showFeedbackMsg('success', `🛵 Retiro de mandado registrado para ${dispatchedIds.length} ítem(s).`)
          }}
          onClose={() => { setShowMandadosModal(false); setMandadosPreselectedIds([]) }}
        />
      )}
    </>
  )
}
