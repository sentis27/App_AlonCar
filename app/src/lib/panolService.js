/**
 * panolService.js
 * Capa de servicio y persistencia para Pañol Central & Materiales (M4).
 * Cumple Candado Mecánico #3 (Cero SQL en Vista) y #4 (Trazabilidad en audit_logs).
 */

import { supabase } from './supabase.js'
import { logCellChange, logRowAction } from './auditService.js'
import { assignMonotonicFolios, stampNewRecordWithFolio } from './monotonicFolioEngine.js'
import { normalizeText, setAllocationWorkersCache } from './allocationEngine.js'

export async function fetchPanolData() {
  const [matRes, invRes, gasRes, rubrosRes, supRes, shipsRes, woRes, workersRes, workItemsRes, alertsRes] =
    await Promise.all([
      supabase.from('materials').select('*').order('name'),
      supabase.from('inventory_transactions').select('*').order('transaction_date', { ascending: false }).limit(800),
      supabase.from('gas_cylinder_movements').select('*').order('movement_date', { ascending: false }).limit(800),
      supabase.from('material_rubros').select('*').order('name'),
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('ships').select('*').order('name'),
      supabase.from('work_orders').select('*').order('created_at', { ascending: false }),
      supabase.from('workers').select('*').order('name'),
      supabase.from('work_items').select('id, work_order_id, contractors, description, status, foreman_name').order('created_at', { ascending: true }),
      supabase.from('compliance_alerts').select('*').eq('status', 'PENDIENTE')
    ])

  if (workersRes.data) {
    setAllocationWorkersCache(workersRes.data)
  }

  return {
    materials: matRes.data || [],
    inventoryTx: invRes.data ? assignMonotonicFolios(invRes.data, { dateField: 'transaction_date' }) : [],
    gasMovements: gasRes.data || [],
    rubros: rubrosRes.data || [],
    suppliers: supRes.data || [],
    ships: shipsRes.data || [],
    workOrders: woRes.data || [],
    workers: workersRes.data || [],
    workItems: workItemsRes.data || [],
    pendingAlerts: alertsRes.data || []
  }
}

export async function saveShipAndWorkOrderService({
  txId,
  newShipId,
  newWorkOrderId,
  tx,
  ships,
  user,
  getEnabledWorkersAndContractors
}) {
  const cleanShipId = (newShipId === '__ASTILLERO_STOCK__' || !newShipId) ? null : newShipId
  const cleanWoId = (!cleanShipId || !newWorkOrderId) ? null : newWorkOrderId
  const updates = { ship_id: cleanShipId, work_order_id: cleanWoId }
  const currentWorkerOrContractor = tx?.worker_name || tx?.contractor_name

  let deassigned = false
  if (currentWorkerOrContractor && cleanShipId && getEnabledWorkersAndContractors) {
    const enabled = getEnabledWorkersAndContractors(cleanShipId, cleanWoId)
    const isValid = enabled.astilleroWorkers.some(w => normalizeText(w.name) === normalizeText(currentWorkerOrContractor)) ||
      enabled.contractorGroups.some(g => normalizeText(g) === normalizeText(currentWorkerOrContractor))
    if (!isValid) {
      updates.contractor_name = ''
      updates.worker_name = ''
      updates.worker_id = null
      deassigned = true
    }
  }

  if (cleanShipId && !cleanWoId) {
    supabase.from('compliance_alerts').insert({
      alert_type: 'SIN_OT',
      entity_type: 'inventory_transactions',
      entity_id: txId,
      ship_id: cleanShipId,
      alert_message: `Retiro registrado (⚠️ Sin OT) en buque ${ships.find(s => s.id === cleanShipId)?.name || cleanShipId} por ${currentWorkerOrContractor || 'Personal'}.`,
      status: 'PENDIENTE'
    }).then(() => {})
  }

  const { error } = await supabase.from('inventory_transactions').update(updates).eq('id', txId)
  if (error) throw error

  logCellChange({
    entityType: 'inventory_transactions',
    entityId: txId,
    entityName: `Retiro #${txId}`,
    field: 'ship_id',
    fieldLabel: 'Barco / OT',
    oldValue: `${tx?.ship_id || 'Sin buque'} / ${tx?.work_order_id || 'Sin OT'}`,
    newValue: `${cleanShipId || 'Sin buque'} / ${cleanWoId || 'Sin OT'}`,
    sheetName: 'Pañol · Stock y Movimientos',
    moduleRoute: '/panol',
    changeOrigin: 'MODAL_PICKER',
    user: user?.email
  })

  return { updates, deassigned }
}

export async function saveInlineTxService({ txId, field, value, tx, materials, user }) {
  const updates = { [field]: value }
  if (field === 'quantity_withdrawn' || field === 'material_id') {
    const targetMat = materials.find((m) => m.id === (field === 'material_id' ? value : tx?.material_id))
    if (targetMat) {
      updates.weight_total = (Number(targetMat.weight_kg) || 0) * (field === 'quantity_withdrawn' ? Number(value) : Number(tx?.quantity_withdrawn) || 1)
    }
  }

  const { error } = await supabase.from('inventory_transactions').update(updates).eq('id', txId)
  if (error) throw error

  logCellChange({
    entityType: 'inventory_transactions',
    entityId: txId,
    entityName: tx?.material_id || txId,
    field,
    fieldLabel: field,
    oldValue: tx ? tx[field] : '',
    newValue: value,
    sheetName: 'Pañol · Stock y Movimientos',
    moduleRoute: '/panol',
    changeOrigin: 'INLINE_CELL',
    user: user?.email
  })

  return updates
}

export async function saveInlineMaterialService({ matId, field, value, materials, user }) {
  const parsedValue = ['weight_kg', 'current_stock', 'minimum_stock', 'security_factor'].includes(field)
    ? Number(value) || 0
    : field === 'requires_stock_control'
    ? Boolean(value)
    : value

  const updates = { [field]: parsedValue }
  const { error } = await supabase.from('materials').update(updates).eq('id', matId)
  if (error) throw error

  const mat = materials.find((m) => m.id === matId)
  logCellChange({
    entityType: 'materials',
    entityId: matId,
    entityName: mat?.name || matId,
    field,
    fieldLabel: field,
    oldValue: mat ? mat[field] : null,
    newValue: parsedValue,
    sheetName: 'Pañol · Catálogo Maestro',
    moduleRoute: '/panol',
    changeOrigin: 'INLINE_CELL',
    user: user?.email
  })

  return updates
}

export async function saveMultiWithdrawalService({
  shipId,
  workOrderId,
  contractorGroup,
  notes,
  date,
  items,
  editId,
  materials,
  astilleroWorkers,
  user
}) {
  const matchedAst = astilleroWorkers.find((w) => w.name.toUpperCase() === String(contractorGroup || '').toUpperCase())
  const workerName = matchedAst ? matchedAst.name : contractorGroup || 'Sin asignar'
  const workerId = matchedAst && matchedAst.id !== matchedAst.name ? matchedAst.id : null

  if (editId) {
    const item = items[0]
    const mat = materials.find((m) => m.id === item.material_id)
    const qty = Number(item.quantity) || 1
    const updates = {
      material_id: item.material_id || null,
      quantity_withdrawn: qty,
      ship_id: shipId || null,
      work_order_id: workOrderId || null,
      contractor_name: workerName,
      worker_name: workerName,
      worker_id: workerId,
      cost_center: item.customCostCenter || 'CLIENTE',
      weight_total: (Number(mat?.weight_kg) || 0) * qty,
      movement_type: mat?.category === 'ELEM.SEGURIDAD' ? 'ENTREGA_EPP' : 'CONSUMO_OBRA',
      notes: item.notes ? `${notes} - ${item.notes}`.trim() : notes,
      transaction_date: date || new Date().toISOString()
    }
    const { error: updErr } = await supabase.from('inventory_transactions').update(updates).eq('id', editId)
    if (updErr) throw updErr

    logRowAction({
      action: 'MODAL_SAVE',
      entityType: 'inventory_transactions',
      entityId: editId,
      entityName: `Retiro #${editId}`,
      changes: updates,
      sheetName: 'Pañol · Stock y Movimientos',
      moduleRoute: '/panol',
      changeOrigin: 'MODAL_WITHDRAWAL',
      user: user?.email
    })

    return { isEdit: true, updates }
  }

  const txInserts = []
  const matUpdates = []

  for (const item of items) {
    const mat = materials.find((m) => m.id === item.material_id)
    if (!mat) continue
    const qty = Number(item.quantity) || 1
    matUpdates.push({ id: mat.id, newStock: (Number(mat.current_stock) || 0) - qty })
    txInserts.push({
      material_id: mat.id,
      quantity_withdrawn: qty,
      ship_id: shipId || null,
      work_order_id: workOrderId || null,
      contractor_name: workerName,
      worker_name: workerName,
      worker_id: workerId,
      cost_center: item.customCostCenter || 'CLIENTE',
      weight_total: (Number(mat.weight_kg) || 0) * qty,
      movement_type: mat.category === 'ELEM.SEGURIDAD' ? 'ENTREGA_EPP' : 'CONSUMO_OBRA',
      notes: item.notes ? `${notes} - ${item.notes}`.trim() : notes,
      transaction_date: date || new Date().toISOString()
    })
  }

  const { data: createdTxs, error: txErr } = await supabase.from('inventory_transactions').insert(txInserts).select()
  if (txErr) throw txErr

  for (const upd of matUpdates) {
    await supabase.from('materials').update({ current_stock: upd.newStock }).eq('id', upd.id)
  }

  logRowAction({
    action: 'ROW_INSERT',
    entityType: 'inventory_transactions',
    entityId: createdTxs?.[0]?.id || 'batch',
    entityName: `Retiro múltiple (${txInserts.length} items)`,
    rowData: { count: txInserts.length, contractor: workerName, ship_id: shipId },
    sheetName: 'Pañol · Stock y Movimientos',
    moduleRoute: '/panol',
    changeOrigin: 'MODAL_WITHDRAWAL',
    user: user?.email
  })

  return { isEdit: false, createdTxs: createdTxs || [], matUpdates }
}

export async function insertBlankRowService({ inventoryTx }) {
  const newTx = {
    material_id: null,
    quantity_withdrawn: null,
    ship_id: null,
    work_order_id: null,
    contractor_name: '',
    cost_center: null,
    weight_total: null,
    notes: '',
    transaction_date: new Date().toISOString().split('T')[0]
  }
  const stampedTx = stampNewRecordWithFolio(newTx, inventoryTx)
  const { data, error } = await supabase.from('inventory_transactions').insert([newTx]).select().single()
  if (error) throw error
  return { ...data, _rowSeq: stampedTx._rowSeq }
}

export async function duplicateTxService({ tx, user }) {
  const cloned = {
    ...tx,
    id: undefined,
    created_at: undefined,
    notes: `Copia de retiro - ${tx.notes || ''}`.trim(),
    transaction_date: new Date().toISOString()
  }
  delete cloned.id
  delete cloned.created_at
  delete cloned._rowSeq

  const { data, error } = await supabase.from('inventory_transactions').insert([cloned]).select().single()
  if (error) throw error

  logRowAction({
    action: 'ROW_DUPLICATE',
    entityType: 'inventory_transactions',
    entityId: data.id,
    entityName: `Retiro duplicado #${data.id}`,
    rowData: cloned,
    sheetName: 'Pañol · Stock y Movimientos',
    moduleRoute: '/panol',
    changeOrigin: 'GRID_ACTION',
    user: user?.email
  })

  return data
}

export async function requestDeletionTxService({ tx, userIdentifier }) {
  const { error } = await supabase
    .from('inventory_transactions')
    .update({
      is_deletion_requested: true,
      deletion_requested_at: new Date().toISOString(),
      deletion_requested_by: userIdentifier
    })
    .eq('id', tx.id)
  if (error) throw error

  logRowAction({
    action: 'STATUS_CHANGE',
    entityType: 'inventory_transactions',
    entityId: tx.id,
    entityName: `Solicitud baja #${tx.id}`,
    changes: { is_deletion_requested: true, deletion_requested_by: userIdentifier },
    sheetName: 'Pañol · Stock y Movimientos',
    moduleRoute: '/panol',
    changeOrigin: 'GRID_ACTION',
    user: userIdentifier
  })
}

export async function permanentDeleteTxService({ tx, materials, user }) {
  const mat = materials.find((m) => m.id === tx.material_id)
  if (mat) {
    const restoredStock = (Number(mat.current_stock) || 0) + (Number(tx.quantity_withdrawn) || 0)
    await supabase.from('materials').update({ current_stock: restoredStock }).eq('id', mat.id)
  }

  const { error } = await supabase.from('inventory_transactions').delete().eq('id', tx.id)
  if (error) throw error

  logRowAction({
    action: 'ROW_DELETE',
    entityType: 'inventory_transactions',
    entityId: tx.id,
    entityName: `Retiro eliminado #${tx.id}`,
    rowData: tx,
    sheetName: 'Pañol · Stock y Movimientos',
    moduleRoute: '/panol',
    changeOrigin: 'GRID_ACTION',
    user: user?.email
  })
}

export async function restoreTxService({ tx }) {
  const { error } = await supabase
    .from('inventory_transactions')
    .update({ is_deletion_requested: false, deletion_requested_at: null, deletion_requested_by: null })
    .eq('id', tx.id)
  if (error) throw error
}

export async function submitRequestOtService({ requestOtModal, ships }) {
  const targetShip = ships.find((s) => s.id === requestOtModal.shipId)
  const shipName = targetShip?.name || 'Astillero General'
  const { error } = await supabase.from('compliance_alerts').insert([{
    ship_id: requestOtModal.shipId || null,
    entity_type: 'work_orders',
    entity_id: requestOtModal.shipId || '00000000-0000-0000-0000-000000000000',
    responsible_role: 'admin',
    status: 'PENDIENTE',
    escalated_to_admin: true,
    alert_message: `Solicitud de Apertura de OT en buque ${shipName} para ${requestOtModal.targetWorkerOrContractor}. Motivo: ${requestOtModal.reason || 'Sin detalles'}`.trim()
  }])
  if (error) throw error
}

export async function submitWorkerPermissionService({ workerPermissionModal, workers }) {
  const targetWorker = workers.find((w) => w.id === workerPermissionModal.workerId)
  const { error } = await supabase.from('compliance_alerts').insert([{
    ship_id: null,
    entity_type: 'workers',
    entity_id: targetWorker?.id,
    responsible_role: 'admin',
    status: 'PENDIENTE',
    escalated_to_admin: true,
    alert_message: `Solicitud de Habilitación para retiro de Pañol: ${targetWorker?.name}. Motivo: ${workerPermissionModal.reason || 'Sin detalles'}`.trim()
  }])
  if (error) throw error
}

export async function createDirectPurchaseOrderService({ material, quantity, urgency, ships }) {
  const astilleroShip = ships.find((s) => (s.name || '').toUpperCase().includes('ASTILLERO')) || ships[0]
  const { error } = await supabase.from('purchase_orders').insert([{
    material_id: material?.id || null,
    material_name_raw: material?.name || 'Insumo',
    quantity: quantity ? Number(quantity) : 1,
    unit_measure: material?.unit_measure || 'unidad',
    charge_type: 'VIA_PANOL',
    ship_id: astilleroShip?.id || null,
    requested_by_name: 'PAÑOL',
    order_date: new Date().toISOString().split('T')[0],
    status: 'PEDIR',
    urgency,
    notes: 'Solicitud directa generada desde Pañol'
  }])
  if (error) throw error
}
