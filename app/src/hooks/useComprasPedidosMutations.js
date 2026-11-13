import { useCallback } from 'react'
import { deduceUnitMeasure } from '../lib/comprasConstants'
import { computeFortnightFromDate, getNextUrgency } from '../lib/comprasPedidosHelpers'
import {
  computeAdjacentCreatedAt,
  buildBlankOrderPayload,
  buildAdjacentOrderPayload,
  buildDuplicateOrderPayload
} from '../lib/comprasPedidosGridHelpers'
import {
  updatePedidoFieldService,
  updatePedidoFieldsWithAuditService,
  insertPedidoService,
  restorePedidoRowService,
  deletePedidoService,
  pastePedidoRowService,
  silentUpdatePedidoService
} from '../services/comprasPedidosService'

export function useComprasPedidosMutations({
  purchaseOrders,
  setPurchaseOrders,
  ships,
  filteredOrders,
  selectedOrderIds,
  setSelectedOrderIds,
  currentFortnight,
  user,
  profile,
  pushUndoAction,
  setInlineEdit,
  showFeedbackMsg
}) {
  const getFortnight = useCallback((d) => computeFortnightFromDate(d, currentFortnight), [currentFortnight])

  const registerInsertUndo = useCallback((actionLabel, insertedRow, onRestore) => {
    pushUndoAction({
      actionLabel,
      undoFn: async () => {
        await deletePedidoService({ orderId: insertedRow.id, audit: false })
        setPurchaseOrders((prev) => prev.filter((p) => p.id !== insertedRow.id))
      },
      redoFn: async () => {
        await restorePedidoRowService(insertedRow)
        onRestore(insertedRow)
      }
    })
  }, [pushUndoAction, setPurchaseOrders])

  const saveInlineEdit = useCallback(async (orderId, field, newValue) => {
    setInlineEdit({ orderId: null, field: null, value: '' })
    const targetOrder = purchaseOrders.find((p) => p.id === orderId)
    if (!targetOrder || targetOrder[field] === newValue) return

    pushUndoAction({
      colKey: field,
      colLabel: field,
      actionLabel: 'Edición en celda',
      previousValues: { [orderId]: targetOrder[field] },
      newValue,
      timestamp: Date.now()
    })

    const extraFields = {}
    if (field === 'order_date') extraFields.fortnight_period = getFortnight(newValue)
    else if (field === 'material_name_raw') extraFields.unit_measure = deduceUnitMeasure(String(newValue || ''))
    else if (field === 'charge_type' && newValue !== 'DIRECT') extraFields.work_order_id = null

    setPurchaseOrders((prev) => prev.map((p) => (p.id === orderId ? { ...p, [field]: newValue, ...extraFields } : p)))
    try {
      await updatePedidoFieldService({
        orderId, field, newValue, oldValue: targetOrder[field], extraFields, entityName: targetOrder.material_name_raw
      })
      showFeedbackMsg('success', 'Campo actualizado correctamente.')
    } catch (err) {
      console.error('Error guardando edición rápida:', err)
      showFeedbackMsg('error', 'Error al guardar: ' + err.message)
      setPurchaseOrders((prev) => prev.map((p) => (p.id === orderId ? targetOrder : p)))
    }
  }, [purchaseOrders, setInlineEdit, pushUndoAction, getFortnight, setPurchaseOrders, showFeedbackMsg])

  const saveInlineMaterialAndObs = useCallback(async (orderId, materialName, observations) => {
    setInlineEdit({ orderId: null, field: null, value: '', obsValue: '' })
    const targetOrder = purchaseOrders.find((p) => p.id === orderId)
    if (!targetOrder) return

    const newMaterial = (materialName || '').trim()
    const newObs = observations !== undefined ? (observations || '').trim() : (targetOrder.observations || '')
    const updates = {
      material_name_raw: newMaterial,
      unit_measure: deduceUnitMeasure(newMaterial),
      observations: newObs || null
    }

    pushUndoAction([
      { rowId: orderId, colId: 'material_name_raw', oldValue: targetOrder.material_name_raw, newValue: newMaterial },
      { rowId: orderId, colId: 'observations', oldValue: targetOrder.observations || null, newValue: newObs || null }
    ])
    setPurchaseOrders((prev) => prev.map((p) => (p.id === orderId ? { ...p, ...updates } : p)))

    try {
      await updatePedidoFieldsWithAuditService({
        orderId, updates, auditField: 'material_name_raw', auditLabel: 'Material',
        oldValue: targetOrder.material_name_raw, newValue: newMaterial, entityName: newMaterial
      })
      showFeedbackMsg('success', 'Material y observaciones guardados.')
    } catch (err) {
      console.error('Error guardando material y observaciones:', err)
      showFeedbackMsg('error', 'Error al guardar: ' + err.message)
      setPurchaseOrders((prev) => prev.map((p) => (p.id === orderId ? targetOrder : p)))
    }
  }, [purchaseOrders, setInlineEdit, pushUndoAction, setPurchaseOrders, showFeedbackMsg])

  const handleCycleUrgency = useCallback(async (orderId, currentUrgency) => {
    await saveInlineEdit(orderId, 'urgency', getNextUrgency(currentUrgency))
  }, [saveInlineEdit])

  const handleAddNewBlankOrder = useCallback(async () => {
    const todayStr = new Date().toISOString().split('T')[0]
    const astShip = ships.find((s) => (s.name || '').toUpperCase().includes('ASTILLERO'))
    const payload = buildBlankOrderPayload({
      todayStr,
      fortnight: getFortnight(todayStr),
      defaultUser: profile?.full_name || user?.email?.split('@')[0] || 'PAÑOL',
      astShipId: astShip?.id || null
    })
    try {
      const data = await insertPedidoService({ payload, auditAction: 'ROW_INSERT', entityName: 'Fila rápida en blanco', details: { newOrder: payload } })
      setPurchaseOrders((prev) => [...prev, data])
      registerInsertUndo('Crear fila rápida', data, (row) => setPurchaseOrders((prev) => [...prev, row]))
      showFeedbackMsg('success', 'Nuevo pedido rápido insertado al pie. Escribe el material directamente.')
      setTimeout(() => setInlineEdit({ orderId: data.id, field: 'material_name_raw', value: '', obsValue: '' }), 50)
    } catch (err) {
      console.error('Error creando pedido rápido:', err)
      showFeedbackMsg('error', 'Error al insertar pedido: ' + err.message)
    }
  }, [profile, user, ships, getFortnight, setPurchaseOrders, registerInsertUndo, showFeedbackMsg, setInlineEdit])

  const handleInsertOrderContext = useCallback(async (referenceOrder, rowIndex, position = 'below') => {
    if (!referenceOrder) return
    const refDate = referenceOrder.order_date || new Date().toISOString().split('T')[0]
    const payload = buildAdjacentOrderPayload(referenceOrder, {
      refDate,
      fortnight: referenceOrder.fortnight_period || getFortnight(refDate),
      createdAtMs: computeAdjacentCreatedAt(referenceOrder, filteredOrders, rowIndex, position)
    })
    const spliceRow = (list, row) => {
      const refIdx = list.findIndex((p) => p.id === referenceOrder.id)
      const idx = refIdx !== -1 ? (position === 'below' ? refIdx + 1 : refIdx) : list.length
      const copy = [...list]
      copy.splice(idx, 0, row)
      return copy
    }
    try {
      const data = await insertPedidoService({ payload, auditAction: 'ROW_INSERT', entityName: 'Fila contigua', details: { position, refId: referenceOrder.id } })
      setPurchaseOrders((prev) => spliceRow(prev, data))
      registerInsertUndo('Insertar fila contigua', data, (row) => setPurchaseOrders((prev) => spliceRow(prev, row)))
      showFeedbackMsg('success', `Fila insertada ${position === 'below' ? 'debajo' : 'arriba'}. Escribe el material directamente.`)
      setTimeout(() => setInlineEdit({ orderId: data.id, field: 'material_name_raw', value: '', obsValue: '' }), 50)
    } catch (err) {
      console.error('Error insertando fila contigua:', err)
      showFeedbackMsg('error', 'Error al insertar fila: ' + err.message)
    }
  }, [filteredOrders, getFortnight, setPurchaseOrders, registerInsertUndo, showFeedbackMsg, setInlineEdit])

  const handleDuplicateOrder = useCallback(async (order) => {
    const todayStr = new Date().toISOString().split('T')[0]
    const payload = buildDuplicateOrderPayload(order, { todayStr, fortnight: getFortnight(todayStr) })
    try {
      const data = await insertPedidoService({ payload, auditAction: 'ROW_DUPLICATE', entityName: order.material_name_raw, details: { sourceOrderId: order.id } })
      setPurchaseOrders((prev) => [...prev, data])
      registerInsertUndo(`Duplicar ${order.material_name_raw || 'pedido'}`, data, (row) => setPurchaseOrders((prev) => [...prev, row]))
      showFeedbackMsg('success', `Pedido "${order.material_name_raw || 'S/D'}" duplicado al final con fecha de hoy.`)
    } catch (err) {
      console.error('Error duplicando pedido:', err)
      showFeedbackMsg('error', 'Error al duplicar pedido: ' + err.message)
    }
  }, [getFortnight, setPurchaseOrders, registerInsertUndo, showFeedbackMsg])

  const handlePasteRow = useCallback(async ({ sourceRow, targetRow }) => {
    if (!sourceRow || !targetRow || sourceRow.id === targetRow.id) return
    const keys = [
      'ship_id', 'work_order_id', 'charge_type', 'requested_by_name', 'material_name_raw',
      'material_id', 'quantity', 'unit_measure', 'supplier_quoted_price', 'system_unit_price',
      'supplier_id', 'urgency', 'observations'
    ]
    const fieldsToCopy = Object.fromEntries(keys.map((k) => [k, sourceRow[k]]))
    const previousValues = Object.fromEntries(keys.map((k) => [k, targetRow[k]]))

    pushUndoAction({
      actionLabel: 'Pegar fila completa',
      undoFn: async () => {
        await silentUpdatePedidoService(targetRow.id, previousValues)
        setPurchaseOrders((prev) => prev.map((p) => (p.id === targetRow.id ? { ...p, ...previousValues } : p)))
      },
      redoFn: async () => {
        await silentUpdatePedidoService(targetRow.id, fieldsToCopy)
        setPurchaseOrders((prev) => prev.map((p) => (p.id === targetRow.id ? { ...p, ...fieldsToCopy } : p)))
      }
    })
    setPurchaseOrders((prev) => prev.map((p) => (p.id === targetRow.id ? { ...p, ...fieldsToCopy } : p)))
    try {
      await pastePedidoRowService({ targetId: targetRow.id, fieldsToCopy, entityName: targetRow.material_name_raw, sourceId: sourceRow.id })
      showFeedbackMsg('success', `Datos copiados en fila ${targetRow.material_name_raw || 'vacía'}.`)
    } catch (err) {
      console.error('Error al pegar fila:', err)
      showFeedbackMsg('error', 'Error al pegar fila: ' + err.message)
      setPurchaseOrders((prev) => prev.map((p) => (p.id === targetRow.id ? { ...p, ...previousValues } : p)))
    }
  }, [pushUndoAction, setPurchaseOrders, showFeedbackMsg])

  const handleDeleteOrder = useCallback(async (id) => {
    if (!confirm('¿Estás seguro de eliminar este registro de compra?')) return
    try {
      const orderToDelete = purchaseOrders.find((p) => p.id === id)
      await deletePedidoService({ orderId: id, entityName: orderToDelete?.material_name_raw || 'Pedido' })
      setPurchaseOrders((prev) => prev.filter((p) => p.id !== id))
      if (selectedOrderIds.has(id)) {
        const next = new Set(selectedOrderIds)
        next.delete(id)
        setSelectedOrderIds(next)
      }
      showFeedbackMsg('success', 'Registro eliminado correctamente.')
    } catch (err) {
      console.error('Error eliminando compra:', err)
      showFeedbackMsg('error', 'Error al eliminar: ' + err.message)
    }
  }, [purchaseOrders, setPurchaseOrders, selectedOrderIds, setSelectedOrderIds, showFeedbackMsg])

  return {
    saveInlineEdit, saveInlineMaterialAndObs, handleCycleUrgency,
    handleAddNewBlankOrder, handleInsertOrderContext, handleDuplicateOrder,
    handlePasteRow, handleDeleteOrder
  }
}
