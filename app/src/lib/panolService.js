/**
 * panolService.js
 * Capa de servicio y persistencia para Pañol Central & Materiales (M4).
 * Cumple Candado Mecánico #3 (Cero SQL en Vista) y #4 (Trazabilidad en audit_logs).
 */

import { supabase } from './supabase.js'
import { logCellChange, logRowAction } from './auditService.js'
import { assignMonotonicFolios, stampNewRecordWithFolio } from './monotonicFolioEngine.js'
import { normalizeText, setAllocationWorkersCache } from './allocationEngine.js'
import { isGasMaterial, stripGasTagFromNotes, findLinkedGasMovement } from './panolConstants.js'

let _hasGasTxLinkCache = null

export async function supportsGasTxLink() {
  if (_hasGasTxLinkCache !== null) return _hasGasTxLinkCache
  try {
    const { error } = await supabase
      .from('gas_cylinder_movements')
      .select('inventory_transaction_id')
      .limit(1)
    _hasGasTxLinkCache = !error
  } catch {
    _hasGasTxLinkCache = false
  }
  return _hasGasTxLinkCache
}

/**
 * Valida y construye la carga útil canónica de gases (compartida entre alta y edición).
 */
export function buildGasMovementPayload({
  item,
  mat,
  date,
  rawNotes,
  suppliers = [],
  shipId,
  workOrderId,
  workerName,
  workerId,
  txId = null,
  includeTxLink = false
}) {
  const opType = item.gasOperationType || 'PRIMERA_ENTREGA'
  if (!['PRIMERA_ENTREGA', 'RECAMBIO_1X1'].includes(opType)) {
    throw new Error(`Operación de gas inválida para "${mat.name}". Las devoluciones finales se registran en Control de Gases.`)
  }
  if (!item.supplierDeliveredId) {
    throw new Error(`Debes seleccionar la Marca / Proveedor Entregada para "${mat.name}".`)
  }
  if (opType === 'RECAMBIO_1X1' && !item.supplierReturnedId) {
    throw new Error(`En Recambio 1x1 debes seleccionar la Marca / Proveedor Devuelta para "${mat.name}".`)
  }
  const intQty = Math.round(Number(item.quantity))
  if (!Number.isFinite(intQty) || intQty <= 0) {
    throw new Error(`La cantidad de tubos para "${mat.name}" debe ser al menos 1.`)
  }

  const cleanUserNotes = stripGasTagFromNotes(rawNotes)
  const supDelName = suppliers.find((s) => s.id === item.supplierDeliveredId)?.name || 'Marca entregada'
  const supRetName = suppliers.find((s) => s.id === item.supplierReturnedId)?.name || 'Marca devuelta'
  const gasTag = opType === 'RECAMBIO_1X1'
    ? `[Gas: Recambio 1x1 · Ent: ${supDelName} / Dev: ${supRetName}]`
    : `[Gas: Primera Entrega · Ent: ${supDelName}]`
  const itemNotes = [gasTag, cleanUserNotes].filter(Boolean).join(' ')

  const gasRecord = {
    movement_date: date ? new Date(`${date}T12:00:00`).toISOString() : new Date().toISOString(),
    operation_type: opType,
    material_id: mat.id,
    ship_id: shipId || null,
    work_order_id: workOrderId || null,
    contractor_name: workerName,
    worker_id: workerId,
    worker_name: workerName,
    supplier_delivered_id: item.supplierDeliveredId,
    supplier_returned_id: opType === 'RECAMBIO_1X1' ? item.supplierReturnedId : null,
    quantity: intQty,
    notes: itemNotes
  }

  if (includeTxLink && txId) {
    gasRecord.inventory_transaction_id = txId
  }

  return { itemNotes, gasRecord }
}

const _requirementIdCache = new Map()

const PANOL_REQUIREMENT_DEFS = {
  REQ_PANOL_HABILITACION_OPERARIO: {
    code: 'REQ_PANOL_HABILITACION_OPERARIO',
    module: 'panol',
    field_key: 'can_withdraw_materials',
    name: 'Solicitud de Habilitación de Operario para Retiro en Pañol (P)',
    description: 'Operario o contratista sin permiso de retiro de materiales requiere autorización de Jorge Sentis.',
    trigger_event: 'SOLICITUD_HABILITACION_PANOL',
    trigger_condition: { permission_field: 'can_withdraw_materials' },
    responsible_role: 'admin',
    default_notice_time: '09:00:00',
    default_notice_frequency: 'DIARIO',
    max_attempts: 5,
    escalation_role: 'admin',
    is_active: true
  },
  REQ_PANOL_APERTURA_OT: {
    code: 'REQ_PANOL_APERTURA_OT',
    module: 'panol',
    field_key: 'work_order_id',
    name: 'Solicitud de Apertura o Asignación de OT desde Pañol',
    description: 'Operario o contratista sin OT habilitada en el buque requiere apertura o asignación de OT.',
    trigger_event: 'SOLICITUD_APERTURA_OT_PANOL',
    trigger_condition: { requires_ot: true },
    responsible_role: 'admin',
    default_notice_time: '09:00:00',
    default_notice_frequency: 'DIARIO',
    max_attempts: 5,
    escalation_role: 'admin',
    is_active: true
  },
  REQ_PANOL_RETIRO_SIN_OT: {
    code: 'REQ_PANOL_RETIRO_SIN_OT',
    module: 'panol',
    field_key: 'work_order_id',
    name: 'Retiro de Pañol Registrado Sin OT (Provisorio)',
    description: 'Movimiento de pañol registrado bajo excepción (⚠️ Sin OT) pendiente de imputación a OT.',
    trigger_event: 'RETIRO_PANOL_SIN_OT',
    trigger_condition: { work_order_id: null },
    responsible_role: 'admin',
    default_notice_time: '09:00:00',
    default_notice_frequency: 'DIARIO',
    max_attempts: 5,
    escalation_role: 'admin',
    is_active: true
  }
}

export async function ensurePanolRequirementId(code) {
  if (_requirementIdCache.has(code)) return _requirementIdCache.get(code)
  const { data: existing, error: selErr } = await supabase
    .from('data_requirements')
    .select('id')
    .eq('code', code)
    .maybeSingle()

  if (!selErr && existing?.id) {
    _requirementIdCache.set(code, existing.id)
    return existing.id
  }

  const def = PANOL_REQUIREMENT_DEFS[code]
  if (!def) throw new Error(`Requisito de cumplimiento desconocido: ${code}`)

  const { data: upserted, error: upsErr } = await supabase
    .from('data_requirements')
    .upsert([def], { onConflict: 'code' })
    .select('id')
    .single()

  if (upsErr || !upserted?.id) {
    throw new Error(upsErr?.message || `No se pudo resolver requirement_id para ${code}`)
  }

  _requirementIdCache.set(code, upserted.id)
  return upserted.id
}

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
    const reqId = await ensurePanolRequirementId('REQ_PANOL_RETIRO_SIN_OT')
    const { error: alertErr } = await supabase.from('compliance_alerts').insert({
      requirement_id: reqId,
      entity_type: 'inventory_transactions',
      entity_id: txId,
      ship_id: cleanShipId,
      responsible_role: 'admin',
      escalated_to_admin: true,
      alert_message: `Retiro registrado (⚠️ Sin OT) en buque ${ships.find(s => s.id === cleanShipId)?.name || cleanShipId} por ${currentWorkerOrContractor || 'Personal'}.`,
      status: 'PENDIENTE'
    })
    if (alertErr) throw alertErr
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
  originalTx = null,
  linkedGasMovement = null,
  gasMovements = [],
  materials,
  suppliers = [],
  ships = [],
  astilleroWorkers,
  user
}) {
  const matchedAst = astilleroWorkers.find((w) => w.name.toUpperCase() === String(contractorGroup || '').toUpperCase())
  const workerName = matchedAst ? matchedAst.name : contractorGroup || 'Sin asignar'
  const workerId = matchedAst && matchedAst.id !== matchedAst.name ? matchedAst.id : null
  const includeTxLink = await supportsGasTxLink()

  if (editId) {
    const item = items[0]
    const mat = materials.find((m) => m.id === item.material_id)
    if (!mat) throw new Error('Debes seleccionar un material válido.')
    const qty = Number(item.quantity)
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error(`La cantidad para "${mat.name}" debe ser mayor a 0.`)
    }

    const baseUserNotes = stripGasTagFromNotes(item.notes ? `${notes} - ${item.notes}`.trim() : notes)
    const rowIsGas = isGasMaterial(mat)
    const existingGasMov = linkedGasMovement || (originalTx ? findLinkedGasMovement(originalTx, gasMovements) : null)

    let gasPayload = null
    if (rowIsGas) {
      gasPayload = buildGasMovementPayload({
        item,
        mat,
        date,
        rawNotes: baseUserNotes,
        suppliers,
        shipId,
        workOrderId,
        workerName,
        workerId,
        txId: editId,
        includeTxLink
      })
    }

    // Calcular ajustes de stock si cambió el material o la cantidad respecto a originalTx
    const matUpdates = []
    if (originalTx) {
      const oldMatId = originalTx.material_id
      const oldQty = Number(originalTx.quantity_withdrawn) || 0
      if (oldMatId === mat.id) {
        const diff = qty - oldQty
        if (Math.abs(diff) > 0.0001) {
          const prevStock = Number(mat.current_stock) || 0
          matUpdates.push({ id: mat.id, prevStock, newStock: prevStock - diff })
        }
      } else {
        if (oldMatId) {
          const oldMat = materials.find((m) => m.id === oldMatId)
          if (oldMat) {
            const oldPrevStock = Number(oldMat.current_stock) || 0
            matUpdates.push({ id: oldMat.id, prevStock: oldPrevStock, newStock: oldPrevStock + oldQty })
          }
        }
        const newPrevStock = Number(mat.current_stock) || 0
        matUpdates.push({ id: mat.id, prevStock: newPrevStock, newStock: newPrevStock - qty })
      }
    }

    const finalNotes = rowIsGas ? gasPayload.itemNotes : baseUserNotes
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
      notes: finalNotes,
      transaction_date: date ? new Date(`${date}T12:00:00`).toISOString() : new Date().toISOString()
    }

    const { error: updErr } = await supabase.from('inventory_transactions').update(updates).eq('id', editId)
    if (updErr) throw updErr

    for (const mUpd of matUpdates) {
      const { error: stErr } = await supabase
        .from('materials')
        .update({ current_stock: mUpd.newStock })
        .eq('id', mUpd.id)
      if (stErr) throw stErr
    }

    let createdGasMovements = []
    let updatedGasMovement = null
    let deletedGasMovementId = null

    if (rowIsGas) {
      if (existingGasMov?.id) {
        const { data: gUpd, error: gUpdErr } = await supabase
          .from('gas_cylinder_movements')
          .update(gasPayload.gasRecord)
          .eq('id', existingGasMov.id)
          .select()
          .single()
        if (gUpdErr) throw gUpdErr
        updatedGasMovement = gUpd

        logRowAction({
          action: 'MODAL_SAVE',
          entityType: 'gas_cylinders',
          entityId: existingGasMov.id,
          entityName: `Movimiento de gas editado #${existingGasMov.id}`,
          changes: gasPayload.gasRecord,
          sheetName: 'Pañol · Control de Gases Industriales',
          moduleRoute: '/panol',
          changeOrigin: 'MODAL_WITHDRAWAL_EDIT',
          user: user?.email
        })
      } else {
        const { data: gIns, error: gInsErr } = await supabase
          .from('gas_cylinder_movements')
          .insert([gasPayload.gasRecord])
          .select()
          .single()
        if (gInsErr) throw gInsErr
        createdGasMovements = gIns ? [gIns] : []

        logRowAction({
          action: 'ROW_INSERT',
          entityType: 'gas_cylinders',
          entityId: gIns?.id || 'gas-edit-insert',
          entityName: `Alta de gas desde edición #${editId}`,
          rowData: gasPayload.gasRecord,
          sheetName: 'Pañol · Control de Gases Industriales',
          moduleRoute: '/panol',
          changeOrigin: 'MODAL_WITHDRAWAL_EDIT',
          user: user?.email
        })
      }
    } else if (existingGasMov?.id) {
      const { error: gDelErr } = await supabase
        .from('gas_cylinder_movements')
        .delete()
        .eq('id', existingGasMov.id)
      if (gDelErr) throw gDelErr
      deletedGasMovementId = existingGasMov.id

      logRowAction({
        action: 'ROW_DELETE',
        entityType: 'gas_cylinders',
        entityId: existingGasMov.id,
        entityName: `Movimiento de gas removido por cambio a no-gas #${existingGasMov.id}`,
        rowData: existingGasMov,
        sheetName: 'Pañol · Control de Gases Industriales',
        moduleRoute: '/panol',
        changeOrigin: 'MODAL_WITHDRAWAL_EDIT',
        user: user?.email
      })
    }

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

    return {
      isEdit: true,
      updates,
      matUpdates,
      createdGasMovements,
      updatedGasMovement,
      deletedGasMovementId
    }
  }

  // Validación previa Fail-Fast (SKL-015): validar renglones comunes y de Gases antes de persistir
  const txInserts = []
  const matUpdates = []
  const gasItemsToCreate = []

  for (const item of items) {
    const mat = materials.find((m) => m.id === item.material_id)
    if (!mat) continue
    const qty = Number(item.quantity)
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error(`La cantidad para "${mat.name}" debe ser mayor a 0.`)
    }

    const isGas = isGasMaterial(mat)
    const rawUserNotes = stripGasTagFromNotes(item.notes ? `${notes} - ${item.notes}`.trim() : notes)
    let itemNotes = rawUserNotes

    if (isGas) {
      const built = buildGasMovementPayload({
        item,
        mat,
        date,
        rawNotes: rawUserNotes,
        suppliers,
        shipId,
        workOrderId,
        workerName,
        workerId,
        includeTxLink: false
      })
      itemNotes = built.itemNotes
      gasItemsToCreate.push({ txIndex: txInserts.length, gasRecord: built.gasRecord })
    }

    const prevStock = Number(mat.current_stock) || 0
    matUpdates.push({ id: mat.id, prevStock, newStock: prevStock - qty })
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
      notes: itemNotes,
      transaction_date: date ? new Date(`${date}T12:00:00`).toISOString() : new Date().toISOString()
    })
  }

  if (txInserts.length === 0) {
    throw new Error('No hay materiales válidos para registrar.')
  }

  const { data: createdTxs, error: txErr } = await supabase.from('inventory_transactions').insert(txInserts).select()
  if (txErr) throw txErr

  const rollbackCreatedTxs = async () => {
    const ids = (createdTxs || []).map((t) => t.id).filter(Boolean)
    if (ids.length > 0) {
      await supabase.from('inventory_transactions').delete().in('id', ids)
    }
  }

  const appliedStockRollbacks = []
  try {
    for (const upd of matUpdates) {
      const { error: stockErr } = await supabase
        .from('materials')
        .update({ current_stock: upd.newStock })
        .eq('id', upd.id)
      if (stockErr) throw stockErr
      appliedStockRollbacks.push(upd)
    }

    let createdGasMovements = []
    if (gasItemsToCreate.length > 0) {
      const gasPayloadRows = gasItemsToCreate.map(({ txIndex, gasRecord }) => {
        if (includeTxLink && createdTxs?.[txIndex]?.id) {
          return { ...gasRecord, inventory_transaction_id: createdTxs[txIndex].id }
        }
        return gasRecord
      })

      const { data: gasData, error: gasErr } = await supabase
        .from('gas_cylinder_movements')
        .insert(gasPayloadRows)
        .select()
      if (gasErr) throw gasErr
      createdGasMovements = gasData || []

      logRowAction({
        action: 'ROW_INSERT',
        entityType: 'gas_cylinders',
        entityId: createdGasMovements[0]?.id || 'gas-batch',
        entityName: `Entrega de gases (${createdGasMovements.length} mov.)`,
        rowData: { count: createdGasMovements.length, contractor: workerName, ship_id: shipId },
        sheetName: 'Pañol · Control de Gases Industriales',
        moduleRoute: '/panol',
        changeOrigin: 'MODAL_WITHDRAWAL',
        user: user?.email
      })
    }

    logRowAction({
      action: 'ROW_INSERT',
      entityType: 'inventory_transactions',
      entityId: createdTxs?.[0]?.id || 'batch',
      entityName: `Retiro múltiple (${txInserts.length} items)`,
      rowData: { count: txInserts.length, contractor: workerName, ship_id: shipId, has_gas: gasItemsToCreate.length > 0 },
      sheetName: 'Pañol · Stock y Movimientos',
      moduleRoute: '/panol',
      changeOrigin: 'MODAL_WITHDRAWAL',
      user: user?.email
    })

    // Si el retiro se registró bajo bypass (⚠️ Sin OT) en un buque, generar alerta visible para Jorge Sentis
    if (shipId && !workOrderId && createdTxs?.length > 0) {
      const reqId = await ensurePanolRequirementId('REQ_PANOL_RETIRO_SIN_OT')
      const shipName = ships.find((s) => s.id === shipId)?.name || shipId
      const { error: sinOtErr } = await supabase.from('compliance_alerts').insert([{
        requirement_id: reqId,
        ship_id: shipId,
        entity_type: 'inventory_transactions',
        entity_id: createdTxs[0].id,
        responsible_role: 'admin',
        escalated_to_admin: true,
        status: 'PENDIENTE',
        alert_message: `Retiro registrado (⚠️ Sin OT) en buque ${shipName} por ${workerName} (${createdTxs.length} renglón/es).`
      }])
      if (sinOtErr) throw sinOtErr
    }

    return { isEdit: false, createdTxs: createdTxs || [], matUpdates, createdGasMovements }
  } catch (err) {
    // Compensación atómica ante falla intermedia (SKL-015)
    for (const rb of appliedStockRollbacks) {
      await supabase.from('materials').update({ current_stock: rb.prevStock }).eq('id', rb.id)
    }
    await rollbackCreatedTxs()
    throw err
  }
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

export async function permanentDeleteTxService({ tx, materials, gasMovements = [], user }) {
  const mat = materials.find((m) => m.id === tx.material_id)
  if (mat && Number(tx.quantity_withdrawn)) {
    const restoredStock = (Number(mat.current_stock) || 0) + (Number(tx.quantity_withdrawn) || 0)
    await supabase.from('materials').update({ current_stock: restoredStock }).eq('id', mat.id)
  }

  const linkedGas = findLinkedGasMovement(tx, gasMovements)
  if (linkedGas?.id) {
    const { error: gDelErr } = await supabase.from('gas_cylinder_movements').delete().eq('id', linkedGas.id)
    if (gDelErr) throw gDelErr
  }

  const { error } = await supabase.from('inventory_transactions').delete().eq('id', tx.id)
  if (error) throw error

  logRowAction({
    action: 'ROW_DELETE',
    entityType: 'inventory_transactions',
    entityId: tx.id,
    entityName: `Retiro eliminado #${tx.id}`,
    rowData: { ...tx, deleted_gas_movement_id: linkedGas?.id || null },
    sheetName: 'Pañol · Stock y Movimientos',
    moduleRoute: '/panol',
    changeOrigin: 'GRID_ACTION',
    user: user?.email
  })

  return { deletedGasMovementId: linkedGas?.id || null }
}

/**
 * Registra DEVOLUCION_FINAL desde Control de Gases (trámite de devolución de tubo vacío).
 * Nunca modifica inventory_transactions ni materials.current_stock (no es un gasto de obra).
 */
export async function registerGasFinalReturnService({
  contractorName,
  shipId = null,
  workOrderId = null,
  movementDate,
  notes = '',
  returns = [],
  user
}) {
  const cleanContractor = String(contractorName || '').trim()
  if (!cleanContractor) {
    throw new Error('Debes indicar el contratista que devuelve el cilindro.')
  }
  const validReturns = (returns || []).filter((r) => Number(r.quantity) > 0)
  if (validReturns.length === 0) {
    throw new Error('Seleccioná al menos un tubo en poder del contratista para devolver.')
  }

  const inserts = validReturns.map((r) => {
    const intQty = Math.round(Number(r.quantity))
    if (!Number.isFinite(intQty) || intQty <= 0) {
      throw new Error('La cantidad a devolver debe ser al menos 1 tubo.')
    }
    if (!r.materialId) {
      throw new Error('Falta identificar el tipo de gas del tubo devuelto.')
    }
    if (!r.supplierReturnedId) {
      throw new Error('Falta identificar la marca / proveedor del tubo devuelto.')
    }
    return {
      movement_date: movementDate ? new Date(`${movementDate}T12:00:00`).toISOString() : new Date().toISOString(),
      operation_type: 'DEVOLUCION_FINAL',
      material_id: r.materialId,
      ship_id: shipId || null,
      work_order_id: workOrderId || null,
      contractor_name: cleanContractor,
      worker_id: null,
      worker_name: cleanContractor,
      supplier_delivered_id: null,
      supplier_returned_id: r.supplierReturnedId,
      quantity: intQty,
      cylinder_condition: 'VACIO',
      performed_by: user?.email || 'Pañol Central',
      notes: notes ? `Devolución final vacío: ${notes}` : 'Devolución final de tubo vacío'
    }
  })

  const { data, error } = await supabase.from('gas_cylinder_movements').insert(inserts).select()
  if (error) throw error

  logRowAction({
    action: 'ROW_INSERT',
    entityType: 'gas_cylinders',
    entityId: data?.[0]?.id || 'gas-return',
    entityName: `Devolución Final (${inserts.reduce((a, b) => a + b.quantity, 0)} tubo/s) · ${cleanContractor}`,
    rowData: { contractor: cleanContractor, returnsCount: inserts.length },
    sheetName: 'Pañol · Control de Gases Industriales',
    moduleRoute: '/panol',
    changeOrigin: 'MODAL_GAS_FINAL_RETURN',
    user: user?.email
  })

  return data || []
}

/**
 * Crea un nuevo tipo de gas en el Catálogo Maestro con stock inicial 0 (el stock físico se ingresa por Compras).
 */
export async function createQuickGasMaterialService({ name, user }) {
  const cleanName = String(name || '').trim().toUpperCase()
  if (!cleanName) {
    throw new Error('Ingresá el nombre del tipo de gas (ej: GAS CO2 TUBO).')
  }
  const normalizedName = cleanName.startsWith('GAS ') ? cleanName : `GAS ${cleanName}`

  const { data: existing } = await supabase
    .from('materials')
    .select('*')
    .ilike('name', normalizedName)
    .limit(1)
  if (existing && existing.length > 0) {
    return existing[0]
  }

  const payload = {
    name: normalizedName,
    rubro: 'GASES',
    category: 'CONSUMIBLES',
    unit_measure: 'Tubo',
    weight_kg: 0,
    requires_stock_control: true,
    current_stock: 0,
    minimum_stock: 1,
    security_factor: 1.06
  }

  const { data, error } = await supabase.from('materials').insert([payload]).select().single()
  if (error) throw error

  logRowAction({
    action: 'ROW_INSERT',
    entityType: 'materials',
    entityId: data.id,
    entityName: data.name,
    rowData: data,
    sheetName: 'Pañol · Catálogo B.D Materiales',
    moduleRoute: '/panol',
    changeOrigin: 'MODAL_GAS_QUICK_CREATE',
    user: user?.email
  })

  return data
}

/**
 * Registra movimientos de tubos con Empresas Gaseras (Saldo Inicial, Ingreso por Remito o Devolución de Vacíos/Llenos).
 * Respeta que el stock del Catálogo B.D se gestiona vía Compras, concentrándose en la trazabilidad de envases.
 */
export async function saveSupplierGasBatchService({
  supplierId,
  movementDate,
  remitoNumber = '',
  notes = '',
  lines = [],
  suppliers = [],
  materials = [],
  user
}) {
  if (!supplierId) {
    throw new Error('Debes seleccionar una Empresa Gasera.')
  }
  const targetSupplier = suppliers.find((s) => s.id === supplierId)
  if (!targetSupplier) {
    throw new Error('Empresa Gasera no encontrada en el padrón.')
  }

  const validOps = ['SALDO_INICIAL_PATIO', 'INGRESO_PROVEEDOR', 'DEVOLUCION_PROVEEDOR']
  const cleanRemito = String(remitoNumber || '').trim().toUpperCase()
  const cleanNotes = String(notes || '').trim()
  const actor = user?.email || 'Pañol Central'

  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error('Agregá al menos un renglón de tubos para registrar.')
  }

  const inserts = lines.map((line, index) => {
    const opType = line.operationType
    if (!validOps.includes(opType)) {
      throw new Error(`Tipo de operación inválido en el renglón #${index + 1}.`)
    }
    if (!line.materialId) {
      throw new Error(`Seleccioná el tipo de gas en el renglón #${index + 1}.`)
    }
    const mat = materials.find((m) => m.id === line.materialId)
    if (!mat) {
      throw new Error(`Material de gas no encontrado en el renglón #${index + 1}.`)
    }
    const intQty = Math.round(Number(line.quantity))
    if (!Number.isFinite(intQty) || intQty <= 0) {
      throw new Error(`La cantidad del renglón #${index + 1} (${mat.name}) debe ser al menos 1 tubo.`)
    }
    const defaultCond = opType === 'DEVOLUCION_PROVEEDOR' ? 'VACIO' : 'LLENO'
    const condition = String(line.condition || defaultCond).toUpperCase()
    if (!['LLENO', 'VACIO'].includes(condition)) {
      throw new Error(`Estado físico inválido en el renglón #${index + 1}.`)
    }

    const lineNotePrefix =
      opType === 'SALDO_INICIAL_PATIO'
        ? `Saldo Inicial Patio (${condition})`
        : opType === 'INGRESO_PROVEEDOR'
          ? `Ingreso Gasera (${condition})`
          : `Devolución a Gasera (${condition})`
    const composedNotes = [
      cleanRemito ? `Remito: ${cleanRemito}` : '',
      lineNotePrefix,
      String(line.notes || cleanNotes || '').trim()
    ]
      .filter(Boolean)
      .join(' · ')

    const isIngress = opType === 'SALDO_INICIAL_PATIO' || opType === 'INGRESO_PROVEEDOR'

    return {
      movement_date: movementDate ? new Date(`${movementDate}T12:00:00`).toISOString() : new Date().toISOString(),
      operation_type: opType,
      material_id: mat.id,
      ship_id: null,
      work_order_id: null,
      contractor_name: null,
      worker_id: null,
      worker_name: targetSupplier.name,
      supplier_delivered_id: isIngress ? targetSupplier.id : null,
      supplier_returned_id: isIngress ? null : targetSupplier.id,
      quantity: intQty,
      remito_number: cleanRemito || null,
      cylinder_condition: condition,
      performed_by: actor,
      notes: composedNotes
    }
  })

  const { data, error } = await supabase.from('gas_cylinder_movements').insert(inserts).select()
  if (error) throw error

  const created = data || []
  created.forEach((row) => {
    const matName = materials.find((m) => m.id === row.material_id)?.name || 'Gas'
    logRowAction({
      action: 'ROW_INSERT',
      entityType: 'gas_cylinders',
      entityId: row.id,
      entityName: `${row.operation_type} · ${row.quantity}x ${matName} (${targetSupplier.name})`,
      rowData: row,
      sheetName: 'Pañol · Control de Gases (Trazabilidad)',
      moduleRoute: '/panol',
      changeOrigin: 'MODAL_GAS_SUPPLIER_BATCH',
      user: actor
    })
  })

  return created
}

/**
 * Registra un movimiento individual con contratista desde GasMovementModal con auditoría obligatoria.
 */
export async function saveContractorGasMovementService({ gasData, user }) {
  if (!gasData?.material_id) throw new Error('Debes seleccionar un tipo de gas.')
  if (!String(gasData?.contractor_name || '').trim()) throw new Error('Debes seleccionar un contratista.')

  const actor = user?.email || 'Pañol Central'
  const payload = {
    ...gasData,
    performed_by: actor,
    cylinder_condition:
      gasData.operation_type === 'DEVOLUCION_FINAL'
        ? 'VACIO'
        : gasData.operation_type === 'PRIMERA_ENTREGA'
          ? 'LLENO'
          : null
  }

  const { data, error } = await supabase.from('gas_cylinder_movements').insert([payload]).select().single()
  if (error) throw error

  logRowAction({
    action: 'ROW_INSERT',
    entityType: 'gas_cylinders',
    entityId: data.id,
    entityName: `${data.operation_type} · ${data.quantity || 1}x (${data.contractor_name})`,
    rowData: data,
    sheetName: 'Pañol · Control de Gases (Trazabilidad)',
    moduleRoute: '/panol',
    changeOrigin: 'MODAL_GAS_CONTRACTOR',
    user: actor
  })

  return data
}

/**
 * Edición inline auditada de celdas en la Tabla de Trazabilidad de Gases.
 */
export async function updateGasMovementInlineService({ movementId, field, value, gasMovements = [], user }) {
  const row = gasMovements.find((g) => g.id === movementId)
  if (!row) throw new Error('Registro de trazabilidad de gas no encontrado.')

  const allowedFields = ['movement_date', 'remito_number', 'quantity', 'cylinder_condition', 'notes']
  if (!allowedFields.includes(field)) {
    throw new Error(`El campo "${field}" no admite edición directa.`)
  }

  let parsedValue = value
  if (field === 'quantity') {
    const intQty = Math.round(Number(value))
    if (!Number.isFinite(intQty) || intQty <= 0) {
      throw new Error('La cantidad de tubos debe ser un entero mayor a 0.')
    }
    parsedValue = intQty
  } else if (field === 'movement_date') {
    const cleanDate = String(value || '').trim().split('T')[0]
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
      throw new Error('Formato de fecha inválido.')
    }
    parsedValue = new Date(`${cleanDate}T12:00:00`).toISOString()
  } else if (field === 'remito_number') {
    parsedValue = String(value || '').trim().toUpperCase() || null
  } else if (field === 'cylinder_condition') {
    if (!['SALDO_INICIAL_PATIO', 'INGRESO_PROVEEDOR', 'DEVOLUCION_PROVEEDOR', 'AJUSTE_PATIO'].includes(row.operation_type)) {
      throw new Error('Solo los movimientos con Empresas Gaseras permiten cambiar entre LLENO y VACIO.')
    }
    const cleanCond = String(value || '').toUpperCase()
    if (!['LLENO', 'VACIO'].includes(cleanCond)) {
      throw new Error('El estado del tubo debe ser LLENO o VACIO.')
    }
    parsedValue = cleanCond
  } else if (field === 'notes') {
    parsedValue = String(value || '').trim()
  }

  const oldVal = row[field] ?? null
  if (String(oldVal ?? '') === String(parsedValue ?? '')) {
    return row
  }

  const { data, error } = await supabase
    .from('gas_cylinder_movements')
    .update({ [field]: parsedValue })
    .eq('id', movementId)
    .select()
    .single()
  if (error) throw error

  logCellChange({
    entityType: 'gas_cylinders',
    entityId: movementId,
    entityName: `${row.operation_type} · ${row.contractor_name || row.worker_name || 'Gasera'}`,
    field,
    oldValue: oldVal,
    newValue: parsedValue,
    sheetName: 'Pañol · Trazabilidad de Gases',
    moduleRoute: '/panol',
    changeOrigin: 'INLINE_CELL',
    user: user?.email
  })

  return data
}

/**
 * Elimina un movimiento independiente de Control de Gases protegiendo retiros vinculados a Pañol.
 */
export async function deleteGasMovementService({ movement, user }) {
  if (!movement?.id) throw new Error('Movimiento inválido.')
  if (movement.inventory_transaction_id) {
    throw new Error(
      'Este movimiento está vinculado a un retiro de "Movimientos y Retiros". Editá o anulá la fila desde esa planilla para no desfasar el stock ni el costo de obra.'
    )
  }

  const { error } = await supabase
    .from('gas_cylinder_movements')
    .delete()
    .eq('id', movement.id)
  if (error) throw error

  logRowAction({
    action: 'ROW_DELETE',
    entityType: 'gas_cylinders',
    entityId: movement.id,
    entityName: `${movement.operation_type} · ${movement.quantity || 1}x (${movement.contractor_name || movement.worker_name || 'Gasera'})`,
    rowData: movement,
    sheetName: 'Pañol · Trazabilidad de Gases',
    moduleRoute: '/panol',
    changeOrigin: 'GRID_ACTION',
    user: user?.email
  })

  return movement.id
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
  const reqId = await ensurePanolRequirementId('REQ_PANOL_APERTURA_OT')
  const { error } = await supabase.from('compliance_alerts').insert([{
    requirement_id: reqId,
    ship_id: requestOtModal.shipId || null,
    entity_type: 'work_orders',
    entity_id: requestOtModal.shipId || '00000000-0000-0000-0000-000000000000',
    responsible_role: 'admin',
    status: 'PENDIENTE',
    escalated_to_admin: true,
    alert_message: `Solicitud de Apertura de OT en buque ${shipName} para ${requestOtModal.targetWorkerOrContractor || 'Sin especificar'}. Motivo: ${requestOtModal.reason || 'Sin detalles'}`.trim()
  }])
  if (error) throw error
}

export async function submitWorkerPermissionService({ workerPermissionModal, workers, user }) {
  if (!workerPermissionModal?.workerId) {
    throw new Error('Debes seleccionar el operario o contratista a habilitar.')
  }
  const targetWorker = workers.find((w) => w.id === workerPermissionModal.workerId)
  if (!targetWorker) {
    throw new Error('Operario no encontrado en el padrón.')
  }
  const reqId = await ensurePanolRequirementId('REQ_PANOL_HABILITACION_OPERARIO')
  const { error } = await supabase.from('compliance_alerts').insert([{
    requirement_id: reqId,
    ship_id: null,
    entity_type: 'workers',
    entity_id: targetWorker.id,
    responsible_worker_id: targetWorker.id,
    responsible_role: 'admin',
    status: 'PENDIENTE',
    escalated_to_admin: true,
    alert_message: `Solicitud de Habilitación para retiro de Pañol (P): ${targetWorker.name} (${targetWorker.admin_center || 'Astillero'}). Motivo: ${workerPermissionModal.reason || 'Sin detalles'}`.trim()
  }])
  if (error) throw error

  const { error: reqErr } = await supabase.from('worker_permission_requests').insert([{
    worker_id: targetWorker.id,
    worker_name: targetWorker.name,
    work_group: targetWorker.work_group || null,
    requested_by: user?.id || null,
    requested_by_name: user?.email || 'Pañol Central',
    reason: workerPermissionModal.reason || 'Solicitud de habilitación para retiro en Pañol',
    status: 'PENDIENTE'
  }])
  if (reqErr) throw reqErr
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
