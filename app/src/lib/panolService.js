/**
 * panolService.js
 * Capa de servicio y persistencia para Pañol Central & Materiales (M4).
 * Cumple Candado Mecánico #3 (Cero SQL en Vista) y #4 (Trazabilidad en audit_logs).
 */

import { logCellChange, logRowAction } from './auditService.js'
import { evaluateFormulaInput, buildCellFormulasPatch, getStoredCellFormula } from './formulaEngine.js'
import { assignMonotonicFolios, stampNewRecordWithFolio } from './monotonicFolioEngine.js'
import { normalizeText, setAllocationWorkersCache } from './allocationEngine.js'
import { isGasMaterial, stripGasTagFromNotes, findLinkedGasMovement } from './panolConstants.js'
import { buildTransactionTimestampIso, formatLocalTimeHHMM } from './panolBasketsEngine.js'
import { buildArTimestampIso, getTodayArIso, toArIsoDate } from './dateTimeCanonical.js'
import { normalizeUnitMeasure } from './comprasConstants.js'
import { computeFortnightFromDate } from './comprasPedidosHelpers.js'
import { resolveSingleWorkItemId } from './workOrderUnificationEngine.js'
import { getWorkersLookupCached, resolveWorkerIdFromCatalog } from './workerIdentity.js'
import { computeFortnightUnitSnapshot, getFortnightPeriodKey, compareFortnightKeys } from './materialPricingPolicy.js'
import { fetchMaterialPricingPolicyService } from '../services/materialPricingService.js'
import { materialsRepository, materialRubrosRepository } from '../repositories/materialsRepository.js'
import { inventoryTransactionsRepository } from '../repositories/inventoryTransactionsRepository.js'
import { gasMovementsRepository } from '../repositories/gasMovementsRepository.js'
import { suppliersRepository } from '../repositories/suppliersRepository.js'
import { shipsRepository } from '../repositories/shipsRepository.js'
import { workOrdersRepository } from '../repositories/workOrdersRepository.js'
import { workersRepository } from '../repositories/workersRepository.js'
import { workItemsRepository } from '../repositories/workItemsRepository.js'
import { macroVariablesRepository } from '../repositories/macroVariablesRepository.js'
import { dataRequirementsRepository, complianceAlertsRepository, workerPermissionRequestsRepository } from '../repositories/complianceAlertsRepository.js'
import { purchaseOrdersRepository } from '../repositories/purchaseOrdersRepository.js'
import { stockAdjustmentsRepository } from '../repositories/stockAdjustmentsRepository.js'
import { stockAuditsRepository } from '../repositories/stockAuditsRepository.js'
import { buildDateRangeOption, DEFAULT_HISTORY_RANGE } from './gridPerformanceHelpers.js'
import {
  freezePendingPanolStockDaysService,
  fetchStockFreezeConfigService,
  createStockAdjustmentService,
  createStockRecountAdjustmentService
} from './stockControlService.js'

let _hasGasTxLinkCache = null

export async function supportsGasTxLink() {
  if (_hasGasTxLinkCache !== null) return _hasGasTxLinkCache
  try {
    _hasGasTxLinkCache = await gasMovementsRepository.hasTxLinkColumn()
  } catch {
    _hasGasTxLinkCache = false
  }
  return _hasGasTxLinkCache
}

/**
 * Valida y construye la carga útil canónica de gases (compartida entre alta y edición).
 */
export function buildGasMovementPayload({
  item, mat, date, rawNotes, suppliers = [], shipId, workOrderId, workerName, workerId, txId = null, includeTxLink = false
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
    movement_date: buildTransactionTimestampIso(date),
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
  const def = PANOL_REQUIREMENT_DEFS[code]
  const { data, error } = await dataRequirementsRepository.ensureByCode(code, def)
  if (error || !data?.id) {
    throw new Error(error || `No se pudo resolver requirement_id para ${code}`)
  }
  _requirementIdCache.set(code, data.id)
  return data.id
}

export async function fetchPanolData({ historyRange = DEFAULT_HISTORY_RANGE } = {}) {
  await freezePendingPanolStockDaysService()
  const txDateRange = buildDateRangeOption('transaction_date', historyRange, { asTimestamp: true })
  const [matRes, invRes, gasRes, rubrosRes, supRes, shipsRes, woRes, workersRes, workItemsRes, alertsRes, macroRes, policyRes, freezeCfg, adjRes, auditsRes, viaPanolPoRes] =
    await Promise.all([
      materialsRepository.listMaterials(),
      inventoryTransactionsRepository.listTransactions({ dateRange: txDateRange }),
      gasMovementsRepository.listGasMovements(),
      materialRubrosRepository.listRubros(),
      suppliersRepository.listSuppliers(),
      shipsRepository.listShips(),
      workOrdersRepository.listCanonicalWorkOrders(),
      workersRepository.listWorkers({ orderBy: [{ column: 'name', ascending: true }] }),
      workItemsRepository.listCanonicalWorkItems(),
      complianceAlertsRepository.listPending(),
      macroVariablesRepository.listMacroVariables(),
      fetchMaterialPricingPolicyService(),
      fetchStockFreezeConfigService(),
      stockAdjustmentsRepository.listAdjustments(),
      stockAuditsRepository.listAudits(),
      purchaseOrdersRepository.listOrders({
        filters: { charge_type: 'VIA_PANOL' },
        select: 'id, material_id, charge_type, status, quantity, order_date, urgency, remito_number, invoice_number'
      })
    ])
  if (workersRes.data) setAllocationWorkersCache(workersRes.data)
  return {
    materials: matRes.data || [], inventoryTx: invRes.data ? assignMonotonicFolios(invRes.data, { dateField: 'transaction_date' }) : [],
    gasMovements: gasRes.data || [], rubros: rubrosRes.data || [], suppliers: supRes.data || [], ships: shipsRes.data || [],
    workOrders: woRes.data || [], workers: workersRes.data || [], workItems: workItemsRes.data || [], pendingAlerts: alertsRes.data || [],
    macroVariables: macroRes.data || [], pricingPolicy: policyRes?.policy || null, stockFreezeConfig: freezeCfg,
    stockAdjustments: adjRes.data || [], stockAudits: auditsRes.data || [], viaPanolOrders: viaPanolPoRes.data || []
  }
}

export async function saveShipAndWorkOrderService({
  txId, newShipId, newWorkOrderId, workItemId = null, workItems = [], tx, ships, user, getEnabledWorkersAndContractors
}) {
  const cleanShipId = (newShipId === '__ASTILLERO_STOCK__' || !newShipId) ? null : newShipId
  const cleanWoId = (!cleanShipId || !newWorkOrderId) ? null : newWorkOrderId
  const resolvedWiId = cleanWoId ? (workItemId ?? resolveSingleWorkItemId(cleanWoId, workItems)) : null
  const updates = { ship_id: cleanShipId, work_order_id: cleanWoId, work_item_id: resolvedWiId }
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
    const { error: alertErr } = await complianceAlertsRepository.insertOne({
      requirement_id: reqId,
      entity_type: 'inventory_transactions',
      entity_id: txId,
      ship_id: cleanShipId,
      responsible_role: 'admin',
      escalated_to_admin: true,
      alert_message: `Retiro registrado (⚠️ Sin OT) en buque ${ships.find(s => s.id === cleanShipId)?.name || cleanShipId} por ${currentWorkerOrContractor || 'Personal'}.`,
      status: 'PENDIENTE'
    })
    if (alertErr) throw new Error(alertErr)
  }

  const { error } = await inventoryTransactionsRepository.updateById(txId, updates, { select: null })
  if (error) throw new Error(error)

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

export async function saveInlineTxService({ txId, field, value, tx, materials, user, isAdmin = true, macroVariables = [], pricingPolicy = null }) {
  if (field === 'weight_total' && !isAdmin) {
    throw new Error('El peso es solo de referencia para el Pañolero (editable solo por Administrador).')
  }
  let normalizedVal = field === 'transaction_date' && value
    ? buildTransactionTimestampIso(value, formatLocalTimeHHMM(tx?.transaction_date) || null)
    : field === 'voucher_number'
    ? (String(value ?? '').trim() || null)
    : value
  const updates = { [field]: normalizedVal, ...(field === 'contractor_name' ? { worker_name: normalizedVal } : {}) }
  let auditNewValue = field === 'voucher_number' ? normalizedVal : value

  if (field === 'quantity_withdrawn') {
    const parsed = evaluateFormulaInput(value, { allowNegative: false, maxDecimals: 4, emptyValue: 0 })
    if (!parsed.ok) throw new Error(parsed.error || 'Cantidad o fórmula inválida.')
    normalizedVal = parsed.value ?? 0
    updates.quantity_withdrawn = normalizedVal
    updates.cell_formulas = buildCellFormulasPatch(tx?.cell_formulas, 'quantity_withdrawn', parsed.formula)
    auditNewValue = parsed.formula ? `${normalizedVal} (${parsed.formula})` : normalizedVal
  }

  if (field === 'quantity_withdrawn' || field === 'material_id') {
    const targetMat = materials.find((m) => m.id === (field === 'material_id' ? value : tx?.material_id))
    if (targetMat) {
      updates.weight_total = (Number(targetMat.weight_kg) || 0) * (field === 'quantity_withdrawn' ? Number(normalizedVal) : Number(tx?.quantity_withdrawn) || 1)
      if (field === 'material_id') {
        const snap = computeFortnightUnitSnapshot({ material: targetMat, transactionDate: tx?.transaction_date, macroVariables, policy: pricingPolicy })
        updates.unit_cost_ars_snapshot = snap.unit_cost_ars_snapshot
        updates.unit_cost_usd_snapshot = snap.unit_cost_usd_snapshot
      }
    }
  }

  const { error } = await inventoryTransactionsRepository.updateById(txId, updates, { select: null })
  if (error) throw new Error(error)

  let _matUpdates = []
  if (field === 'quantity_withdrawn' || field === 'material_id') {
    const affectedIds = Array.from(new Set([tx?.material_id, field === 'material_id' ? value : null].filter(Boolean)))
    if (affectedIds.length > 0) {
      const { data: stockRows } = await materialsRepository.findStocksByIds(affectedIds)
      _matUpdates = (stockRows || []).map((r) => ({ id: r.id, newStock: Number(r.current_stock) || 0 }))
    }
  }

  const oldFormula = field === 'quantity_withdrawn' ? getStoredCellFormula(tx, 'quantity_withdrawn') : null
  const auditOldValue = tx
    ? (oldFormula ? `${tx[field]} (${oldFormula})` : tx[field])
    : ''

  logCellChange({
    entityType: 'inventory_transactions',
    entityId: txId,
    entityName: tx?.material_id || txId,
    field,
    fieldLabel: field,
    oldValue: auditOldValue,
    newValue: auditNewValue,
    sheetName: 'Pañol · Stock y Movimientos',
    moduleRoute: '/panol',
    changeOrigin: 'INLINE_CELL',
    user: user?.email
  })

  return { ...updates, _matUpdates }
}

export async function saveInlineMaterialService({ matId, field, value, materials, user }) {
  const mat = materials.find((m) => m.id === matId)
  if (field === 'current_stock') {
    const targetVal = Number(value)
    if (!Number.isFinite(targetVal)) throw new Error('Ingresá un valor numérico válido para recuento físico.')
    const res = await createStockRecountAdjustmentService({
      material: mat || { id: matId, current_stock: 0 },
      targetStock: targetVal,
      notes: 'Ajuste físico desde Catálogo',
      user
    })
    return { current_stock: res.newStock }
  }

  const parsedValue = ['weight_kg', 'minimum_stock', 'security_factor'].includes(field)
    ? Number(value) || 0
    : field === 'requires_stock_control'
    ? Boolean(value)
    : value

  const updates = { [field]: parsedValue }
  const { error } = await materialsRepository.updateById(matId, updates, { select: null })
  if (error) throw new Error(error)

  logCellChange({
    entityType: 'materials', entityId: matId, entityName: mat?.name || matId,
    field, fieldLabel: field, oldValue: mat ? mat[field] : null, newValue: parsedValue,
    sheetName: 'Pañol · Catálogo Maestro', moduleRoute: '/panol', changeOrigin: 'INLINE_CELL', user: user?.email
  })

  return updates
}

export async function saveMultiWithdrawalService({
  shipId, workOrderId, workItemId = null, workItems = [], contractorGroup, voucherNumber = '', notes, date, time = null, items, editId,
  originalTx = null, linkedGasMovement = null, gasMovements = [], materials, suppliers = [], ships = [], astilleroWorkers, user,
  macroVariables = [], pricingPolicy = null, changeOrigin = 'MODAL_WITHDRAWAL'
}) {
  const matchedAst = astilleroWorkers.find((w) => w.name.toUpperCase() === String(contractorGroup || '').toUpperCase())
  const workerName = matchedAst ? matchedAst.name : contractorGroup || 'Sin asignar'
  const workerId = matchedAst && matchedAst.id !== matchedAst.name ? matchedAst.id : null
  const resolvedWiId = workOrderId ? (workItemId ?? resolveSingleWorkItemId(workOrderId, workItems)) : null
  const cleanVoucherNumber = voucherNumber ? String(voucherNumber).trim() || null : null
  const includeTxLink = await supportsGasTxLink()

  if (editId) {
    const item = items[0]
    const mat = materials.find((m) => m.id === item.material_id)
    if (!mat) throw new Error('Debes seleccionar un material válido.')
    const parsedQty = evaluateFormulaInput(item.quantity, { allowNegative: false, maxDecimals: 4, emptyValue: 0 })
    if (!parsedQty.ok) {
      throw new Error(`Cantidad o fórmula inválida para "${mat.name}": ${parsedQty.error}`)
    }
    const rowIsGas = isGasMaterial(mat)
    const qty = rowIsGas ? Math.round(parsedQty.value || 0) : (parsedQty.value || 0)
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error(`La cantidad para "${mat.name}" debe ser mayor a 0.`)
    }

    const baseUserNotes = stripGasTagFromNotes(item.notes ? `${notes} - ${item.notes}`.trim() : notes)
    const existingGasMov = linkedGasMovement || (originalTx ? findLinkedGasMovement(originalTx, gasMovements) : null)

    let gasPayload = null
    if (rowIsGas) {
      gasPayload = buildGasMovementPayload({
        item: { ...item, quantity: qty },
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

    const finalNotes = rowIsGas ? gasPayload.itemNotes : baseUserNotes
    const txIso = buildTransactionTimestampIso(date, time)
    const shouldRefreshSnap =
      !originalTx || originalTx.material_id !== mat.id || Number(originalTx.unit_cost_usd_snapshot || 0) <= 0 ||
      compareFortnightKeys(getFortnightPeriodKey(txIso), getFortnightPeriodKey(getTodayArIso())) >= 0
    const editSnap = shouldRefreshSnap
      ? computeFortnightUnitSnapshot({ material: mat, transactionDate: txIso, macroVariables, policy: pricingPolicy })
      : null
    const updates = {
      material_id: item.material_id || null,
      quantity_withdrawn: qty,
      cell_formulas: buildCellFormulasPatch(originalTx?.cell_formulas, 'quantity_withdrawn', rowIsGas ? null : parsedQty.formula),
      ship_id: shipId || null,
      work_order_id: workOrderId || null,
      work_item_id: resolvedWiId,
      contractor_name: workerName,
      worker_name: workerName,
      worker_id: workerId,
      cost_center: item.customCostCenter || 'CLIENTE',
      weight_total: (Number(mat?.weight_kg) || 0) * qty,
      movement_type: mat?.category === 'ELEM.SEGURIDAD' ? 'ENTREGA_EPP' : 'CONSUMO_OBRA',
      voucher_number: cleanVoucherNumber,
      notes: finalNotes,
      transaction_date: txIso,
      ...(editSnap ? { unit_cost_ars_snapshot: editSnap.unit_cost_ars_snapshot, unit_cost_usd_snapshot: editSnap.unit_cost_usd_snapshot } : {})
    }

    const { error: updErr } = await inventoryTransactionsRepository.updateById(editId, updates, { select: null })
    if (updErr) throw new Error(updErr)

    const affectedMatIds = Array.from(new Set([originalTx?.material_id, mat.id].filter(Boolean)))
    const { data: stockRows } = await materialsRepository.findStocksByIds(affectedMatIds)
    const matUpdates = (stockRows || []).map((r) => ({ id: r.id, newStock: Number(r.current_stock) || 0 }))

    let createdGasMovements = []
    let updatedGasMovement = null
    let deletedGasMovementId = null

    if (rowIsGas) {
      if (existingGasMov?.id) {
        const { data: gUpd, error: gUpdErr } = await gasMovementsRepository.updateById(
          existingGasMov.id,
          gasPayload.gasRecord,
          { select: '*' }
        )
        if (gUpdErr) throw new Error(gUpdErr)
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
        const { data: gIns, error: gInsErr } = await gasMovementsRepository.insertOne(gasPayload.gasRecord)
        if (gInsErr) throw new Error(gInsErr)
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
      const { error: gDelErr } = await gasMovementsRepository.deleteById(existingGasMov.id)
      if (gDelErr) throw new Error(gDelErr)
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
      changeOrigin,
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
  const gasItemsToCreate = []

  for (const item of items) {
    const mat = materials.find((m) => m.id === item.material_id)
    if (!mat) continue
    const parsedQty = evaluateFormulaInput(item.quantity, { allowNegative: false, maxDecimals: 4, emptyValue: 0 })
    if (!parsedQty.ok) {
      throw new Error(`Cantidad o fórmula inválida para "${mat.name}": ${parsedQty.error}`)
    }
    const isGas = isGasMaterial(mat)
    const qty = isGas ? Math.round(parsedQty.value || 0) : (parsedQty.value || 0)
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error(`La cantidad para "${mat.name}" debe ser mayor a 0.`)
    }

    const rawUserNotes = stripGasTagFromNotes(item.notes ? `${notes} - ${item.notes}`.trim() : notes)
    let itemNotes = rawUserNotes

    if (isGas) {
      const built = buildGasMovementPayload({
        item: { ...item, quantity: qty },
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

    const rowTxIso = buildTransactionTimestampIso(date, time)
    const rowSnap = computeFortnightUnitSnapshot({ material: mat, transactionDate: rowTxIso, macroVariables, policy: pricingPolicy })
    txInserts.push({
      material_id: mat.id,
      quantity_withdrawn: qty,
      cell_formulas: buildCellFormulasPatch(null, 'quantity_withdrawn', isGas ? null : parsedQty.formula),
      ship_id: shipId || null,
      work_order_id: workOrderId || null,
      work_item_id: resolvedWiId,
      contractor_name: workerName,
      worker_name: workerName,
      worker_id: workerId,
      cost_center: item.customCostCenter || 'CLIENTE',
      weight_total: (Number(mat.weight_kg) || 0) * qty,
      unit_cost_ars_snapshot: rowSnap.unit_cost_ars_snapshot,
      unit_cost_usd_snapshot: rowSnap.unit_cost_usd_snapshot,
      movement_type: mat.category === 'ELEM.SEGURIDAD' ? 'ENTREGA_EPP' : 'CONSUMO_OBRA',
      voucher_number: cleanVoucherNumber,
      notes: itemNotes,
      transaction_date: rowTxIso
    })
  }

  if (txInserts.length === 0) {
    throw new Error('No hay materiales válidos para registrar.')
  }

  const { data: createdTxs, error: txErr } = await inventoryTransactionsRepository.insertMany(txInserts)
  if (txErr) throw new Error(txErr)

  const rollbackCreatedTxs = async () => {
    const ids = (createdTxs || []).map((t) => t.id).filter(Boolean)
    if (ids.length > 0) {
      await inventoryTransactionsRepository.deleteByIds(ids)
    }
  }

  try {
    const { data: stockRows } = await materialsRepository.findStocksByIds(txInserts.map((t) => t.material_id))
    const matUpdates = (stockRows || []).map((r) => ({ id: r.id, newStock: Number(r.current_stock) || 0 }))

    let createdGasMovements = []
    if (gasItemsToCreate.length > 0) {
      const gasPayloadRows = gasItemsToCreate.map(({ txIndex, gasRecord }) => {
        if (includeTxLink && createdTxs?.[txIndex]?.id) {
          return { ...gasRecord, inventory_transaction_id: createdTxs[txIndex].id }
        }
        return gasRecord
      })

      const { data: gasData, error: gasErr } = await gasMovementsRepository.insertMany(gasPayloadRows)
      if (gasErr) throw new Error(gasErr)
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

    const batchCategories = [...new Set(items.map((it) => materials.find((m) => m.id === it.material_id)?.category).filter(Boolean))]
    logRowAction({
      action: 'ROW_INSERT',
      entityType: 'inventory_transactions',
      entityId: createdTxs?.[0]?.id || 'batch',
      entityName: `Retiro múltiple (${txInserts.length} items)`,
      rowData: {
        count: txInserts.length,
        tx_ids: (createdTxs || []).map((t) => t.id).filter(Boolean),
        categories: batchCategories,
        contractor: workerName,
        ship_id: shipId || null,
        work_order_id: workOrderId || null,
        has_gas: gasItemsToCreate.length > 0
      },
      sheetName: 'Pañol · Stock y Movimientos',
      moduleRoute: '/panol',
      changeOrigin,
      user: user?.email
    })

    if (shipId && !workOrderId && createdTxs?.length > 0) {
      const reqId = await ensurePanolRequirementId('REQ_PANOL_RETIRO_SIN_OT')
      const shipName = ships.find((s) => s.id === shipId)?.name || shipId
      const { error: sinOtErr } = await complianceAlertsRepository.insertOne({
        requirement_id: reqId,
        ship_id: shipId,
        entity_type: 'inventory_transactions',
        entity_id: createdTxs[0].id,
        responsible_role: 'admin',
        escalated_to_admin: true,
        status: 'PENDIENTE',
        alert_message: `Retiro registrado (⚠️ Sin OT) en buque ${shipName} por ${workerName} (${createdTxs.length} renglón/es).`
      })
      if (sinOtErr) throw new Error(sinOtErr)
    }

    return { isEdit: false, createdTxs: createdTxs || [], matUpdates, createdGasMovements }
  } catch (err) {
    await rollbackCreatedTxs()
    throw err
  }
}

export async function insertBlankRowService({ inventoryTx, user = null }) {
  const newTx = { material_id: null, quantity_withdrawn: null, ship_id: null, work_order_id: null, contractor_name: '', cost_center: null, weight_total: null, notes: '', transaction_date: new Date().toISOString() }
  const stampedTx = stampNewRecordWithFolio(newTx, inventoryTx)
  const { data, error } = await inventoryTransactionsRepository.insertBlankRow(newTx)
  if (error) throw new Error(error)
  logRowAction({
    action: 'ROW_INSERT', entityType: 'inventory_transactions', entityId: data?.id || 'blank-row',
    entityName: `Fila en blanco #${data?.id || ''}`.trim(), rowData: { count: 1, tx_ids: data?.id ? [data.id] : [], is_blank_row: true },
    sheetName: 'Pañol · Stock y Movimientos', moduleRoute: '/panol', changeOrigin: 'GRID_BLANK_ROW', user: user?.email
  })
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
  delete cloned.stock_snapshot
  delete cloned.stock_frozen_at

  const { data, error } = await inventoryTransactionsRepository.insertOne(cloned)
  if (error) throw new Error(error)

  let _matUpdates = []
  if (data?.material_id) {
    const { data: stockRows } = await materialsRepository.findStocksByIds([data.material_id])
    _matUpdates = (stockRows || []).map((r) => ({ id: r.id, newStock: Number(r.current_stock) || 0 }))
  }

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

  return { ...data, _matUpdates }
}

export async function requestDeletionTxService({ tx, userIdentifier }) {
  const { error } = await inventoryTransactionsRepository.updateById(
    tx.id,
    {
      is_deletion_requested: true,
      deletion_requested_at: new Date().toISOString(),
      deletion_requested_by: userIdentifier
    },
    { select: null }
  )
  if (error) throw new Error(error)

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

export async function permanentDeleteTxService({ tx, gasMovements = [], user }) {
  const linkedGas = findLinkedGasMovement(tx, gasMovements)
  if (linkedGas?.id) {
    const { error: gDelErr } = await gasMovementsRepository.deleteById(linkedGas.id)
    if (gDelErr) throw new Error(gDelErr)
  }

  const { error } = await inventoryTransactionsRepository.deleteById(tx.id)
  if (error) throw new Error(error)

  let updatedMaterial = null
  if (tx?.material_id) {
    const { data: stockRows } = await materialsRepository.findStocksByIds([tx.material_id])
    if (stockRows?.[0]) {
      updatedMaterial = { id: stockRows[0].id, current_stock: Number(stockRows[0].current_stock) || 0 }
    }
  }

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

  return { deletedGasMovementId: linkedGas?.id || null, updatedMaterial }
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

  const workersCatalog = await getWorkersLookupCached()
  const resolvedWorkerId = resolveWorkerIdFromCatalog(cleanContractor, workersCatalog)

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
      movement_date: movementDate ? buildArTimestampIso(movementDate) : new Date().toISOString(),
      operation_type: 'DEVOLUCION_FINAL',
      material_id: r.materialId,
      ship_id: shipId || null,
      work_order_id: workOrderId || null,
      contractor_name: cleanContractor,
      worker_id: resolvedWorkerId,
      worker_name: cleanContractor,
      supplier_delivered_id: null,
      supplier_returned_id: r.supplierReturnedId,
      quantity: intQty,
      cylinder_condition: 'VACIO',
      performed_by: user?.email || 'Pañol Central',
      notes: notes ? `Devolución final vacío: ${notes}` : 'Devolución final de tubo vacío'
    }
  })

  const { data, error } = await gasMovementsRepository.insertMany(inserts)
  if (error) throw new Error(error)

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
 * Da de alta un nuevo material en el Catálogo Maestro B.D de Pañol con validación defensiva y auditoría.
 */
export async function createMaterialService({ formData, existingMaterials = [], user }) {
  const cleanName = String(formData?.name || '').trim().toUpperCase()
  if (!cleanName) {
    throw new Error('El nombre técnico del material es obligatorio.')
  }

  const localDup = (existingMaterials || []).find(
    (m) => normalizeText(m.name) === normalizeText(cleanName)
  )
  if (localDup) {
    throw new Error(`Ya existe el material "${localDup.name}" en el Catálogo B.D.`)
  }

  const { data: remoteDup } = await materialsRepository.findByNameIlike(cleanName, { select: 'id, name' })
  if (remoteDup && remoteDup.length > 0) {
    throw new Error(`Ya existe el material "${remoteDup[0].name}" en la base de datos.`)
  }

  const currentStockNum = formData?.current_stock === '' || formData?.current_stock == null ? 0 : Number(formData.current_stock)
  const minimumStockNum = formData?.minimum_stock === '' || formData?.minimum_stock == null ? 0 : Number(formData.minimum_stock)
  const weightKgNum = formData?.weight_kg === '' || formData?.weight_kg == null ? 0 : Number(formData.weight_kg)
  const costArsNum = Math.max(0, Number(formData?.cost_ars) || 0)
  const secFactorNum = Number(formData?.security_factor) || 1.06
  const fxRate = Number(formData?.dollar_rate) > 0 ? Number(formData.dollar_rate) : 1500
  const costUsdNum = formData?.cost_usd != null ? Math.max(0, Number(formData.cost_usd) || 0) : Math.round(((costArsNum * secFactorNum) / fxRate) * 100) / 100

  if (!Number.isFinite(currentStockNum) || currentStockNum < 0) throw new Error('El stock inicial actual debe ser un número mayor o igual a 0.')
  if (!Number.isFinite(minimumStockNum) || minimumStockNum < 0) throw new Error('El stock mínimo debe ser un número mayor o igual a 0.')
  if (!Number.isFinite(weightKgNum) || weightKgNum < 0) throw new Error('El peso unitario debe ser un número mayor o igual a 0.')

  const payload = {
    name: cleanName,
    rubro: String(formData?.rubro || '').trim().toUpperCase() || 'VARIOS Y GENERAL',
    rubro_status: 'APROBADO',
    category: ['MATERIALES', 'CONSUMIBLES', 'ELEM.SEGURIDAD'].includes(formData?.category) ? formData.category : 'CONSUMIBLES',
    unit_measure: normalizeUnitMeasure(formData?.unit_measure, cleanName),
    weight_kg: weightKgNum,
    cost_ars: costArsNum,
    cost_usd: costUsdNum,
    last_price_update: new Date().toISOString(),
    requires_stock_control: Boolean(formData?.requires_stock_control ?? true),
    current_stock: 0,
    minimum_stock: minimumStockNum,
    security_factor: secFactorNum,
    ...(formData?.image_url ? { image_url: formData.image_url } : {})
  }

  const { data, error, code } = await materialsRepository.insertOne(payload)
  if (error) {
    if (code === '42501' || /row-level security/i.test(error)) {
      throw new Error(
        'Permiso bloqueado por RLS en tabla "materials". Iniciá sesión con cuenta de Supabase Auth o ejecutá la migración 0041 en el SQL Editor de Supabase.'
      )
    }
    if (code === '22P02' || /invalid input syntax for type integer/i.test(error)) {
      throw new Error(
        'La base de datos actual solo admite números enteros en Stock Inicial y Stock Mínimo (ejecutá la migración 0041 en Supabase para habilitar decimales).'
      )
    }
    throw new Error(error)
  }

  let finalMaterial = data
  if (currentStockNum > 0 && data?.id) {
    const adjRes = await createStockAdjustmentService({
      materialId: data.id,
      quantity: currentStockNum,
      reasonType: 'INITIALIZATION',
      notes: 'Stock inicial al crear material en Catálogo',
      material: data,
      user
    })
    finalMaterial = { ...data, current_stock: adjRes.newStock }
  }

  await logRowAction({
    action: 'ROW_INSERT',
    entityType: 'materials',
    entityId: finalMaterial.id,
    entityName: finalMaterial.name,
    rowData: finalMaterial,
    sheetName: 'Pañol · Catálogo Maestro de Materiales',
    moduleRoute: '/panol',
    changeOrigin: 'MODAL_NEW_MATERIAL',
    user: user?.email
  })

  return finalMaterial
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

  const { data: existing } = await materialsRepository.findByNameIlike(normalizedName, { select: '*' })
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

  const { data, error } = await materialsRepository.insertOne(payload)
  if (error) throw new Error(error)

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
      movement_date: movementDate ? buildArTimestampIso(movementDate) : new Date().toISOString(),
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

  const { data, error } = await gasMovementsRepository.insertMany(inserts)
  if (error) throw new Error(error)

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
  const workersCatalog = gasData.worker_id ? [] : await getWorkersLookupCached()
  const resolvedWorkerId = resolveWorkerIdFromCatalog(
    gasData.worker_name || gasData.contractor_name,
    workersCatalog,
    gasData.worker_id || null
  )
  const payload = {
    ...gasData,
    worker_id: resolvedWorkerId,
    performed_by: actor,
    cylinder_condition:
      gasData.operation_type === 'DEVOLUCION_FINAL'
        ? 'VACIO'
        : gasData.operation_type === 'PRIMERA_ENTREGA'
          ? 'LLENO'
          : null
  }

  const { data, error } = await gasMovementsRepository.insertOne(payload)
  if (error) throw new Error(error)

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
    const cleanDate = toArIsoDate(value)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
      throw new Error('Formato de fecha inválido.')
    }
    parsedValue = buildArTimestampIso(cleanDate)
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

  const { data, error } = await gasMovementsRepository.updateById(
    movementId,
    { [field]: parsedValue },
    { select: '*' }
  )
  if (error) throw new Error(error)

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

  const { error } = await gasMovementsRepository.deleteById(movement.id)
  if (error) throw new Error(error)

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
  const { error } = await inventoryTransactionsRepository.updateById(
    tx.id,
    { is_deletion_requested: false, deletion_requested_at: null, deletion_requested_by: null },
    { select: null }
  )
  if (error) throw new Error(error)
}

export async function submitRequestOtService({ requestOtModal, ships }) {
  const targetShip = ships.find((s) => s.id === requestOtModal.shipId)
  const shipName = targetShip?.name || 'Astillero General'
  const reqId = await ensurePanolRequirementId('REQ_PANOL_APERTURA_OT')
  const { error } = await complianceAlertsRepository.insertOne({
    requirement_id: reqId,
    ship_id: requestOtModal.shipId || null,
    entity_type: 'work_orders',
    entity_id: requestOtModal.shipId || '00000000-0000-0000-0000-000000000000',
    responsible_role: 'admin',
    status: 'PENDIENTE',
    escalated_to_admin: true,
    alert_message: `Solicitud de Apertura de OT en buque ${shipName} para ${requestOtModal.targetWorkerOrContractor || 'Sin especificar'}. Motivo: ${requestOtModal.reason || 'Sin detalles'}`.trim()
  })
  if (error) throw new Error(error)
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
  const { error } = await complianceAlertsRepository.insertOne({
    requirement_id: reqId,
    ship_id: null,
    entity_type: 'workers',
    entity_id: targetWorker.id,
    responsible_worker_id: targetWorker.id,
    responsible_role: 'admin',
    status: 'PENDIENTE',
    escalated_to_admin: true,
    alert_message: `Solicitud de Habilitación para retiro de Pañol (P): ${targetWorker.name} (${targetWorker.admin_center || 'Astillero'}). Motivo: ${workerPermissionModal.reason || 'Sin detalles'}`.trim()
  })
  if (error) throw new Error(error)

  const { error: reqErr } = await workerPermissionRequestsRepository.insertOne({
    worker_id: targetWorker.id,
    worker_name: targetWorker.name,
    work_group: targetWorker.work_group || null,
    requested_by: user?.id || null,
    requested_by_name: user?.email || 'Pañol Central',
    reason: workerPermissionModal.reason || 'Solicitud de habilitación para retiro en Pañol',
    status: 'PENDIENTE'
  })
  if (reqErr) throw new Error(reqErr)
}

export async function fetchPendingPanolAlertsService() {
  const { data, error } = await complianceAlertsRepository.listPending()
  if (error) throw new Error(error)
  return data || []
}

export async function createDirectPurchaseOrderService({ material, quantity, urgency, ships = [], user = null }) {
  const VALID_URGENCIES = ['SIN_APURO', 'URGENTE', 'PROXIMA_SALIDA']
  const safeUrgency = VALID_URGENCIES.includes(urgency) ? urgency : 'SIN_APURO'
  const orderDate = getTodayArIso()
  const fortnightPeriod = computeFortnightFromDate(orderDate)
  const safeQty = Number(quantity) > 0 ? Number(quantity) : 1
  const astilleroShip = (ships || []).find((s) => (s.name || '').toUpperCase().includes('ASTILLERO')) || ships?.[0] || null
  const workersCatalog = await getWorkersLookupCached()
  const panolWorkerId = resolveWorkerIdFromCatalog('PAÑOL', workersCatalog)
  const payload = {
    material_id: material?.id || null,
    material_name_raw: material?.name || 'Insumo',
    quantity: safeQty,
    unit_measure: normalizeUnitMeasure(material?.unit_measure, material?.name),
    charge_type: 'VIA_PANOL',
    ship_id: astilleroShip?.id || null,
    requested_by: panolWorkerId,
    requested_by_name: 'PAÑOL',
    order_date: orderDate,
    fortnight_period: fortnightPeriod,
    status: 'PEDIR',
    urgency: safeUrgency,
    observations: 'Solicitud directa generada desde Pañol'
  }
  const { data, error } = await purchaseOrdersRepository.insertOne(payload, { select: '*' })
  if (error) throw new Error(error)

  logRowAction({
    action: 'ROW_INSERT',
    entityType: 'purchase_orders',
    entityId: data?.id || 'direct-po',
    entityName: payload.material_name_raw,
    rowData: payload,
    sheetName: 'Pañol · Pedido Directo a Compras',
    moduleRoute: '/panol',
    changeOrigin: 'MODAL_QUICK_PURCHASE',
    user: user?.email || 'Pañol Central'
  })
  return data
}
