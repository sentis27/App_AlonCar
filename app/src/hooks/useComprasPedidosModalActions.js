import { useCallback } from 'react'
import { buildBatchStatusMeta } from '../lib/comprasPedidosGridHelpers'
import {
  updatePedidoFieldService,
  updatePedidoFieldsWithAuditService,
  silentUpdatePedidoService,
  incrementMaterialStockService,
  batchUpdatePedidosService,
  reconcilePedidosBatchService
} from '../services/comprasPedidosService'

export function useComprasPedidosModalActions({
  purchaseOrders,
  setPurchaseOrders,
  materials,
  setMaterials,
  ships,
  suppliers,
  selectedOrderIds,
  setSelectedOrderIds,
  batchTargetStatus,
  user,
  profile,
  pushUndoAction,
  fetchData,
  showFeedbackMsg,
  setShowPartialModal,
  setPartialDeliveryOrder,
  setShowSeCompraModal,
  setSeCompraAlertOrder,
  setShowSupplierHelperModal,
  setSupplierHelperTarget,
  setShowNewMaterialModal,
  pendingMaterialOrder,
  setPendingMaterialOrder,
  reconcileTarget,
  setShowReconcileModal,
  setReconcileTarget,
  freightTargetOrder,
  setShowFreightModal,
  setFreightTargetOrder,
  shipPickerModal
}) {
  const handleBatchDismissCatalogAlta = useCallback(async () => {
    if (selectedOrderIds.size === 0) return
    try {
      const idsArray = Array.from(selectedOrderIds)
      const previousValues = {}
      const batchItems = idsArray.map((id) => {
        const po = purchaseOrders.find((p) => p.id === id)
        previousValues[id] = Boolean(po?.no_catalog_required)
        return {
          entityId: id,
          entityName: po?.material_name_raw || `OC #${id}`,
          field: 'no_catalog_required',
          fieldLabel: 'NO requiere alta en catálogo',
          oldValue: previousValues[id],
          newValue: true
        }
      })
      await batchUpdatePedidosService({
        targetIds: idsArray,
        dbPayload: { no_catalog_required: true, updated_at: new Date().toISOString() },
        colKey: 'no_catalog_required',
        batchItems
      })
      pushUndoAction({
        colKey: 'no_catalog_required',
        colLabel: 'NO requiere alta en catálogo',
        actionLabel: 'Omitir Alta Catálogo',
        previousValues,
        newValue: true,
        timestamp: Date.now()
      })
      setPurchaseOrders((prev) => prev.map((p) => (selectedOrderIds.has(p.id) ? { ...p, no_catalog_required: true } : p)))
      showFeedbackMsg('success', `Se marcó "NO requiere alta en catálogo" para ${idsArray.length} pedido(s). (Ctrl+Z para deshacer)`)
      setSelectedOrderIds(new Set())
    } catch (err) {
      console.error('Error omitiendo alta en lote:', err)
      showFeedbackMsg('error', 'Error al omitir alta: ' + err.message)
    }
  }, [selectedOrderIds, purchaseOrders, pushUndoAction, setPurchaseOrders, showFeedbackMsg, setSelectedOrderIds])

  const handleApplySupplierHelper = useCallback(async (orderId, updates) => {
    const target = purchaseOrders.find((p) => p.id === orderId)
    if (!target) return
    const previousValues = {
      [orderId]: {
        supplier_id: target.supplier_id,
        supplier_quoted_price: target.supplier_quoted_price,
        system_unit_price: target.system_unit_price,
        order_date: target.order_date,
        fortnight_period: target.fortnight_period,
        status: target.status
      }
    }
    const supName = suppliers.find((s) => s.id === updates.supplier_id)?.name || 'Proveedor'
    try {
      await updatePedidoFieldsWithAuditService({
        orderId, updates, auditField: 'supplier_id', auditLabel: 'Proveedor',
        oldValue: target.supplier_id, newValue: supName, entityName: target.material_name_raw
      })
      pushUndoAction({
        colKey: 'supplier_helper', colLabel: 'Asistente de Proveedor', actionLabel: 'Asignar Proveedor Sugerido',
        previousValues, newValue: updates, timestamp: Date.now()
      })
      setPurchaseOrders((prev) => prev.map((p) => (p.id === orderId ? { ...p, ...updates } : p)))
      showFeedbackMsg('success', `Proveedor "${supName}" y condiciones asignadas con éxito. (Ctrl+Z para deshacer)`)
      setShowSupplierHelperModal(false)
      setSupplierHelperTarget(null)
    } catch (err) {
      console.error('Error aplicando asistente de proveedor:', err)
      showFeedbackMsg('error', 'Error al asignar proveedor: ' + err.message)
    }
  }, [purchaseOrders, suppliers, pushUndoAction, setPurchaseOrders, showFeedbackMsg, setShowSupplierHelperModal, setSupplierHelperTarget])

  const handleQuickStatusChange = useCallback(async (orderId, newStatus) => {
    try {
      const order = purchaseOrders.find((p) => p.id === orderId)
      if (!order) return
      if (newStatus === 'PEDIDO INCOMPLETO') { setPartialDeliveryOrder(order); setShowPartialModal(true); return }
      if (newStatus === 'SE COMPRA?') {
        const updates = { status: 'SE COMPRA?', updated_at: new Date().toISOString() }
        await silentUpdatePedidoService(orderId, updates)
        setPurchaseOrders((prev) => prev.map((p) => (p.id === orderId ? { ...p, ...updates } : p)))
        setSeCompraAlertOrder({ ...order, status: 'SE COMPRA?' })
        setShowSeCompraModal(true)
        showFeedbackMsg('success', 'Marcado como "SE COMPRA?". Abriendo panel de alerta gerencial...')
        return
      }
      if (newStatus === 'RECIBIDO' && order.charge_type === 'VIA_PANOL' && order.material_id) {
        const mat = materials.find((m) => m.id === order.material_id)
        if (mat) {
          const newStock = (mat.current_stock || 0) + Number(order.quantity)
          await incrementMaterialStockService(mat.id, newStock)
          setMaterials((prev) => prev.map((m) => (m.id === mat.id ? { ...m, current_stock: newStock } : m)))
        }
      }
      pushUndoAction({ colKey: 'status', colLabel: 'Estado', actionLabel: 'Cambio de estado', previousValues: { [orderId]: order.status }, newValue: newStatus, timestamp: Date.now() })
      await updatePedidoFieldService({ orderId, field: 'status', newValue: newStatus, oldValue: order.status, entityName: order.material_name_raw, fieldLabel: 'Estado' })
      setPurchaseOrders((prev) => prev.map((p) => (p.id === orderId ? { ...p, status: newStatus, updated_at: new Date().toISOString() } : p)))
      showFeedbackMsg('success', `Estado actualizado a "${newStatus}"`)
    } catch (err) {
      console.error('Error cambiando estado:', err)
      showFeedbackMsg('error', 'Error al actualizar estado: ' + err.message)
    }
  }, [purchaseOrders, materials, setMaterials, setPartialDeliveryOrder, setShowPartialModal, setPurchaseOrders, setSeCompraAlertOrder, setShowSeCompraModal, pushUndoAction, showFeedbackMsg])

  const handleBatchStatusApply = useCallback(async () => {
    if (selectedOrderIds.size === 0) return
    const ids = Array.from(selectedOrderIds)
    const targetStatus = batchTargetStatus
    let convertToDirect = false
    if (targetStatus === 'RECIB.COMP.DIRECT') {
      const nonDirect = ids.map((id) => purchaseOrders.find((p) => p.id === id)).filter((p) => p && p.charge_type !== 'DIRECT')
      if (nonDirect.length > 0 && confirm(`Hay ${nonDirect.length} pedido(s) con destino "PAÑOL". Para cumplir la regla de auditoría de Costo Directo, ¿deseas cambiar automáticamente su destino a "DIRECTO"?`)) {
        convertToDirect = true
      }
    }
    const { previousValues, batchItems } = buildBatchStatusMeta(ids, purchaseOrders, targetStatus)
    const dbPayload = { status: targetStatus, updated_at: new Date().toISOString(), ...(convertToDirect ? { charge_type: 'DIRECT' } : {}) }
    try {
      await batchUpdatePedidosService({ targetIds: ids, dbPayload, colKey: 'status', batchItems })
      pushUndoAction({ colKey: 'status', colLabel: 'Estado en bloque', actionLabel: `Cambio masivo a ${targetStatus}`, previousValues, newValue: dbPayload, timestamp: Date.now() })
      setPurchaseOrders((prev) => prev.map((p) => (ids.includes(p.id) ? { ...p, ...dbPayload } : p)))
      setSelectedOrderIds(new Set())
      showFeedbackMsg('success', `Se cambió el estado a "${targetStatus}" en ${ids.length} pedidos. (Ctrl+Z para deshacer)`)
    } catch (err) {
      console.error('Error en cambio de estado masivo:', err)
      showFeedbackMsg('error', 'Error en cambio de estado: ' + err.message)
    }
  }, [selectedOrderIds, batchTargetStatus, purchaseOrders, pushUndoAction, setPurchaseOrders, setSelectedOrderIds, showFeedbackMsg])

  const handleNewMaterialSuccess = useCallback(async (newMaterial) => {
    setMaterials((prev) => [...prev, newMaterial])
    const updates = { material_id: newMaterial.id, is_new_material: false, system_unit_price: newMaterial.cost_ars, unit_measure: newMaterial.unit_measure }
    await silentUpdatePedidoService(pendingMaterialOrder.id, { ...updates, updated_at: new Date().toISOString() })
    setPurchaseOrders((prev) => prev.map((p) => (p.id === pendingMaterialOrder.id ? { ...p, ...updates } : p)))
    const rubroNotice = newMaterial.rubro_status === 'PENDIENTE_HOMOLOGACION' ? ' (Se envió alerta al Administrador para homologar el nuevo rubro).' : '.'
    showFeedbackMsg('success', `Material "${newMaterial.name}" dado de alta en catálogo${rubroNotice}`)
    setShowNewMaterialModal(false)
    setPendingMaterialOrder(null)
  }, [pendingMaterialOrder, setMaterials, setPurchaseOrders, showFeedbackMsg, setShowNewMaterialModal, setPendingMaterialOrder])

  const handleReconcileSuccess = useCallback(async ({ invoiceNumber, orderIds, action = 'reconcile' }) => {
    const isUnreconcile = action === 'unreconcile'
    const updates = isUnreconcile
      ? { is_reconciled: false, invoice_number: null, reconciled_at: null, reconciled_by: null }
      : { is_reconciled: true, invoice_number: invoiceNumber, reconciled_at: new Date().toISOString(), reconciled_by: profile?.full_name || user?.email?.split('@')[0] || 'Supervisor' }
    pushUndoAction(
      orderIds.map((id) => {
        const prevOrder = purchaseOrders.find((p) => p.id === id)
        return {
          rowId: id, colId: 'reconciliation',
          oldValue: { is_reconciled: Boolean(prevOrder?.is_reconciled), invoice_number: prevOrder?.invoice_number || null, reconciled_at: prevOrder?.reconciled_at || null, reconciled_by: prevOrder?.reconciled_by || null },
          newValue: updates
        }
      })
    )
    await reconcilePedidosBatchService(orderIds, updates)
    setPurchaseOrders((prev) => prev.map((p) => (orderIds.includes(p.id) ? { ...p, ...updates } : p)))
    if (reconcileTarget?.mode === 'selected') setSelectedOrderIds(new Set())
    showFeedbackMsg('success', isUnreconcile ? `Se quitó la conciliación de ${orderIds.length} registro(s).` : `Se conciliaron ${orderIds.length} compras con comprobante ${invoiceNumber}.`)
    setShowReconcileModal(false)
    setReconcileTarget(null)
  }, [profile, user, purchaseOrders, pushUndoAction, setPurchaseOrders, reconcileTarget, setSelectedOrderIds, showFeedbackMsg, setShowReconcileModal, setReconcileTarget])

  const handleFreightSuccess = useCallback(async (freightUpdates) => {
    pushUndoAction([{
      rowId: freightTargetOrder.id, colId: 'freight',
      oldValue: { freight_transport_name: freightTargetOrder.freight_transport_name || null, freight_request_date: freightTargetOrder.freight_request_date || null, freight_estimated_date: freightTargetOrder.freight_estimated_date || null },
      newValue: freightUpdates
    }])
    try {
      await silentUpdatePedidoService(freightTargetOrder.id, { ...freightUpdates, updated_at: new Date().toISOString() })
      setPurchaseOrders((prev) => prev.map((p) => (p.id === freightTargetOrder.id ? { ...p, ...freightUpdates } : p)))
      showFeedbackMsg('success', 'Datos de flete y transporte guardados correctamente.')
      setShowFreightModal(false)
      setFreightTargetOrder(null)
    } catch (error) {
      showFeedbackMsg('error', 'Error al guardar datos de flete: ' + error.message)
    }
  }, [freightTargetOrder, pushUndoAction, setPurchaseOrders, showFeedbackMsg, setShowFreightModal, setFreightTargetOrder])

  const handleShipWorkOrderSave = useCallback(async ({ shipId, workOrderId, isAstilleroStock }) => {
    const orderId = shipPickerModal.orderId
    const target = purchaseOrders.find((p) => p.id === orderId)
    if (!target) return
    const astShip = ships.find((s) => s.name === 'ASTILLERO')
    const resolvedShipId = isAstilleroStock ? (astShip?.id || null) : shipId
    const resolvedChargeType = isAstilleroStock || (astShip && resolvedShipId === astShip.id) ? 'VIA_PANOL' : 'DIRECT'

    pushUndoAction({
      colKey: 'ship_id', colLabel: 'Buque / OT', actionLabel: 'Cambio de Buque y OT',
      previousValues: { [orderId]: { ship_id: target.ship_id, work_order_id: target.work_order_id, charge_type: target.charge_type } },
      newValue: { ship_id: resolvedShipId, work_order_id: workOrderId, charge_type: resolvedChargeType }, timestamp: Date.now()
    })
    setPurchaseOrders((prev) => prev.map((p) => (p.id === orderId ? { ...p, ship_id: resolvedShipId, work_order_id: workOrderId, charge_type: resolvedChargeType } : p)))
    try {
      await silentUpdatePedidoService(orderId, { ship_id: resolvedShipId, work_order_id: workOrderId, charge_type: resolvedChargeType, updated_at: new Date().toISOString() })
      showFeedbackMsg('success', !workOrderId ? 'Destino asignado. OT dejada en blanco (sumada a KPI Falta Cargar OT).' : 'Buque y OT asignados con éxito.')
    } catch (err) {
      console.error('Error guardando Buque y OT en Compras:', err)
      showFeedbackMsg('error', 'Error al guardar Buque y OT: ' + err.message)
      if (fetchData) fetchData()
    }
  }, [shipPickerModal, purchaseOrders, ships, pushUndoAction, setPurchaseOrders, showFeedbackMsg, fetchData])

  return {
    handleBatchDismissCatalogAlta, handleApplySupplierHelper, handleQuickStatusChange,
    handleBatchStatusApply, handleNewMaterialSuccess, handleReconcileSuccess,
    handleFreightSuccess, handleShipWorkOrderSave
  }
}
