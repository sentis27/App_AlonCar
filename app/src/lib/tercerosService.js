/**
 * tercerosService.js
 * Capa de persistencia, sincronización y auditoría contable para
 * el módulo de Servicios de Terceros, Contratistas y Talleres Externos (M5).
 */

import { logCellChange, logRowAction } from './auditService.js'
import { evaluateFormulaInput, buildCellFormulasPatch, getStoredCellFormula } from './formulaEngine.js'
import { assignMonotonicFolios, stampNewRecordWithFolio } from './monotonicFolioEngine.js'
import { setAllocationWorkersCache } from './allocationEngine.js'
import { getDollarRateForDate } from './tercerosConstants.js'
import { resolveSingleWorkItemId } from './workOrderUnificationEngine.js'
import { resolveWorkerIdFromCatalog } from './workerIdentity.js'
import {
  thirdPartyServicesRepository,
  thirdPartyVoucherHistoryRepository,
} from '../repositories/thirdPartyServicesRepository.js'
import { shipsRepository } from '../repositories/shipsRepository.js'
import { workersRepository } from '../repositories/workersRepository.js'
import { macroVariablesRepository } from '../repositories/macroVariablesRepository.js'
import { workOrdersRepository } from '../repositories/workOrdersRepository.js'
import { workItemsRepository } from '../repositories/workItemsRepository.js'

export async function fetchTercerosData() {
  const [srvRes, shpRes, woRes, wiRes, wkrRes, mvRes, vhRes] = await Promise.all([
    thirdPartyServicesRepository.listServices(),
    shipsRepository.listShips({ select: 'id, name, vessel_type, current_location' }),
    workOrdersRepository.listCanonicalWorkOrders(),
    workItemsRepository.listCanonicalWorkItems(),
    workersRepository.listThirdPartyEnabled(),
    macroVariablesRepository.listMacroVariables(),
    thirdPartyVoucherHistoryRepository.listHistory(),
  ])

  if (srvRes.error) console.warn('Aviso third_party_services:', srvRes.error)
  if (shpRes.error) console.warn('Aviso ships:', shpRes.error)
  if (woRes.error) console.warn('Aviso work_orders:', woRes.error)
  if (wkrRes.error) console.warn('Aviso workers:', wkrRes.error)
  if (mvRes.error) console.warn('Aviso macro_variables:', mvRes.error)
  if (vhRes.error) console.warn('Aviso third_party_voucher_history:', vhRes.error)

  if (wkrRes.data) setAllocationWorkersCache(wkrRes.data)

  return {
    services: assignMonotonicFolios(srvRes.data || [], { dateField: 'service_date' }),
    ships: shpRes.data || [],
    workOrders: woRes.data || [],
    workItems: wiRes?.data || [],
    contractors: wkrRes.data || [],
    macroVariables: mvRes.data || [],
    voucherHistory: vhRes.data || [],
  }
}

export async function saveServiceService({ formData, editingService, canEditAmounts, contractors = [], macroVariables = [], workItems = [], actor = 'MARIA JOSE' }) {
  if (!formData.ship_id) throw new Error('Debe seleccionar un buque/embarcación.')
  if (!formData.contractor_name) throw new Error('Debe seleccionar un contratista o taller autorizado.')
  if (formData.is_manual_trade && !formData.trade) {
    throw new Error('Este contratista es polirrubro (MANUAL). Debe seleccionar el rubro aplicable de la lista oficial.')
  }
  if (formData.voucher_type === 'PRC' && !formData.budget_number?.trim() && !formData.voucher_number?.trim()) {
    throw new Error('La opción PRC requiere cargar un número de presupuesto sí o sí.')
  }

  let parsedArs = 0
  let amountFormula = editingService ? getStoredCellFormula(editingService, 'amount_ars') : null
  if (editingService && !canEditAmounts) {
    parsedArs = editingService.amount_ars || 0
  } else {
    const evalRes = evaluateFormulaInput(formData.amount_ars, { allowNegative: false, maxDecimals: 2, emptyValue: 0 })
    if (!evalRes.ok) throw new Error(`Importe o fórmula inválida: ${evalRes.error}`)
    parsedArs = evalRes.value ?? 0
    amountFormula = evalRes.formula
  }

  const rate = getDollarRateForDate(formData.entry_date, macroVariables) || 1500
  const parsedUsd = rate > 0 ? Number((parsedArs / rate).toFixed(2)) : 0

  const foundContractor = contractors.find((c) => c.name.toUpperCase().trim() === formData.contractor_name.toUpperCase().trim())
  const isManual = foundContractor?.trade?.toUpperCase().trim() === 'MANUAL'
  const resolvedTrade = formData.trade?.trim().toUpperCase() || (!isManual ? (foundContractor?.trade || '').trim().toUpperCase() : null)

  let primaryVoucherNumber = formData.voucher_number?.trim() || null
  if (formData.voucher_type === 'PRC') {
    primaryVoucherNumber = formData.budget_number?.trim() || primaryVoucherNumber
  } else if (['FCR', 'FCA', 'FAC', 'REC', 'FCB', 'FCC'].includes(formData.voucher_type)) {
    primaryVoucherNumber = formData.invoice_number?.trim() || primaryVoucherNumber
  } else if (['RMO', 'RPF'].includes(formData.voucher_type)) {
    primaryVoucherNumber = formData.supplier_remito_number?.trim() || primaryVoucherNumber
  }

  const payload = {
    ship_id: formData.ship_id,
    work_order_id: formData.work_order_id || null,
    work_item_id: formData.work_order_id ? (formData.work_item_id || resolveSingleWorkItemId(formData.work_order_id, workItems)) : null,
    contractor_id: resolveWorkerIdFromCatalog(formData.contractor_name, contractors, foundContractor?.id),
    contractor_name: formData.contractor_name.trim().toUpperCase(),
    trade: resolvedTrade || 'VARIOS',
    voucher_type: formData.voucher_type,
    voucher_number: primaryVoucherNumber,
    budget_number: formData.budget_number?.trim() || (formData.voucher_type === 'PRC' ? primaryVoucherNumber : null),
    invoice_number: formData.invoice_number?.trim() || (['FCR', 'FCA', 'FAC', 'REC', 'FCB', 'FCC'].includes(formData.voucher_type) ? primaryVoucherNumber : null),
    internal_remito_number: formData.internal_remito_number ? formData.internal_remito_number.trim() : null,
    supplier_remito_number: formData.supplier_remito_number?.trim() || (['RMO', 'RPF'].includes(formData.voucher_type) ? primaryVoucherNumber : null),
    voucher_date: formData.voucher_date || formData.entry_date,
    entry_date: formData.entry_date,
    service_date: formData.service_date || formData.entry_date,
    amount_ars: parsedArs,
    usd_rate: rate,
    amount_usd: parsedUsd,
    cell_formulas: buildCellFormulasPatch(editingService?.cell_formulas, 'amount_ars', amountFormula),
    direct_observations: formData.direct_observations ? formData.direct_observations.trim() : null,
    specific_observations: formData.specific_observations ? formData.specific_observations.trim() : null,
    status: formData.voucher_type,
    audit_status: formData.audit_status || 'PENDIENTE',
    updated_at: new Date().toISOString(),
  }

  if (editingService) {
    const { error: updErr } = await thirdPartyServicesRepository.updateById(editingService.id, payload, { select: null })
    if (updErr) throw new Error(updErr)

    await logRowAction({
      action: 'MODAL_SAVE',
      entityType: 'third_party_services',
      entityId: editingService.id,
      entityName: formData.contractor_name,
      changes: { ...payload, previous_amount_ars: editingService.amount_ars, new_amount_ars: parsedArs },
      sheetName: 'Terceros · Servicios y Facturación',
      moduleRoute: '/terceros',
      changeOrigin: 'MODAL_FORM',
      user: actor,
    })
    return { isNew: false, id: editingService.id }
  }

  payload.created_by = actor
  const { data: insData, error: insErr } = await thirdPartyServicesRepository.insertOne(payload)
  if (insErr) throw new Error(insErr)

  await logRowAction({
    action: 'ROW_INSERT',
    entityType: 'third_party_services',
    entityId: insData?.id || 'new',
    entityName: formData.contractor_name,
    rowData: payload,
    sheetName: 'Terceros · Servicios y Facturación',
    moduleRoute: '/terceros',
    changeOrigin: 'MODAL_FORM',
    user: actor,
  })
  return { isNew: true, id: insData?.id }
}

export async function deleteServiceService({ service, actor = 'MARIA JOSE' }) {
  const { error: delErr } = await thirdPartyServicesRepository.deleteById(service.id)
  if (delErr) throw new Error(delErr)

  await logRowAction({
    action: 'ROW_DELETE',
    entityType: 'third_party_services',
    entityId: service.id,
    entityName: service.contractor_name,
    rowData: {
      voucher_type: service.voucher_type,
      voucher_number: service.voucher_number,
      amount_ars: service.amount_ars,
      amount_usd: service.amount_usd,
    },
    sheetName: 'Terceros · Servicios y Facturación',
    moduleRoute: '/terceros',
    changeOrigin: 'GRID_ACTION',
    user: actor,
  })
}

export async function insertBlankRowService({ services = [], macroVariables = [], actor = 'MARIA JOSE' }) {
  const todayStr = new Date().toISOString().split('T')[0]
  const rate = getDollarRateForDate(todayStr, macroVariables) || 1500
  const newService = {
    service_date: todayStr,
    entry_date: todayStr,
    voucher_date: todayStr,
    ship_id: null,
    work_order_id: null,
    work_item_id: null,
    contractor_name: '',
    trade: 'VARIOS',
    voucher_type: 'RMO',
    voucher_number: null,
    amount_ars: 0,
    usd_rate: rate,
    amount_usd: 0,
    direct_observations: null,
    specific_observations: null,
    status: 'RMO',
    audit_status: 'PENDIENTE',
    created_by: actor,
    is_active: true,
  }

  const stampedService = stampNewRecordWithFolio(newService, services)
  const { data, error } = await thirdPartyServicesRepository.insertBlankRow(newService)
  if (error) throw new Error(error)

  await logRowAction({
    action: 'ROW_INSERT',
    entityType: 'third_party_services',
    entityId: data.id,
    entityName: `Fila en blanco #${stampedService._rowSeq}`,
    rowData: data,
    sheetName: 'Terceros · Servicios y Facturación',
    moduleRoute: '/terceros',
    changeOrigin: 'RIBBON_INSERT',
    user: actor,
  })

  return { ...data, _rowSeq: stampedService._rowSeq }
}

export async function confirmEvolutionService({ evolvingService, evolutionForm, actor = 'MARIA JOSE' }) {
  if (!evolvingService) throw new Error('No hay comprobante seleccionado para evolucionar.')
  if (evolutionForm.target_voucher_type === 'FCR' && !evolutionForm.new_voucher_number) {
    throw new Error('Debe especificar el número de Factura oficial definitiva.')
  }

  const evalEvo = evaluateFormulaInput(evolutionForm.final_amount_ars, { allowNegative: false, maxDecimals: 2, emptyValue: null })
  if (!evalEvo.ok) throw new Error(`Monto final o fórmula inválida: ${evalEvo.error}`)
  const parsedArs = evalEvo.value !== null ? evalEvo.value : (evolvingService.amount_ars || 0)
  const rate = evolvingService.usd_rate > 0 ? evolvingService.usd_rate : 1500
  const parsedUsd = Number((parsedArs / rate).toFixed(2))
  const evoFormulas = buildCellFormulasPatch(evolvingService.cell_formulas, 'amount_ars', evalEvo.value !== null ? evalEvo.formula : getStoredCellFormula(evolvingService, 'amount_ars'))

  const { error: updErr } = await thirdPartyServicesRepository.updateById(
    evolvingService.id,
    {
      voucher_type: evolutionForm.target_voucher_type,
      status: evolutionForm.target_voucher_type,
      voucher_number: evolutionForm.new_voucher_number.trim(),
      voucher_date: evolutionForm.voucher_date,
      amount_ars: parsedArs,
      amount_usd: parsedUsd,
      cell_formulas: evoFormulas,
      updated_at: new Date().toISOString(),
    },
    { select: null }
  )
  if (updErr) throw new Error(updErr)

  const { error: histErr } = await thirdPartyVoucherHistoryRepository.insertOne({
    third_party_service_id: evolvingService.id,
    from_voucher_type: evolvingService.voucher_type,
    to_voucher_type: evolutionForm.target_voucher_type,
    from_amount_ars: evolvingService.amount_ars,
    to_amount_ars: parsedArs,
    voucher_number: evolutionForm.new_voucher_number.trim(),
    notes: evolutionForm.evolution_notes,
    changed_by: actor,
  })
  if (histErr) console.warn('[tercerosService] Aviso historial:', histErr)

  await logRowAction({
    action: 'STATUS_CHANGE',
    entityType: 'third_party_services',
    entityId: evolvingService.id,
    entityName: evolvingService.contractor_name,
    changes: {
      from_voucher_type: evolvingService.voucher_type,
      to_voucher_type: evolutionForm.target_voucher_type,
      invoice_number: evolutionForm.new_voucher_number,
      notes: evolutionForm.evolution_notes,
    },
    sheetName: 'Terceros · Servicios y Facturación',
    moduleRoute: '/terceros',
    changeOrigin: 'MODAL_EVOLUTION',
    user: actor,
  })
}

export async function saveAuditService({ auditingService, auditForm, auditorName = 'JEFE DE OBRA' }) {
  if (!auditingService) throw new Error('No hay comprobante para auditar.')

  const { error: updErr } = await thirdPartyServicesRepository.updateById(
    auditingService.id,
    {
      audit_status: auditForm.audit_status,
      audit_notes: auditForm.audit_notes.trim(),
      audited_by: auditorName,
      audited_at: new Date().toISOString(),
    },
    { select: null }
  )
  if (updErr) throw new Error(updErr)

  await logRowAction({
    action: 'STATUS_CHANGE',
    entityType: 'third_party_services',
    entityId: auditingService.id,
    entityName: auditingService.contractor_name,
    changes: {
      audit_status: auditForm.audit_status,
      audit_notes: auditForm.audit_notes.trim(),
    },
    sheetName: 'Terceros · Servicios y Facturación',
    moduleRoute: '/terceros',
    changeOrigin: 'MODAL_TECHNICAL_AUDIT',
    user: auditorName,
  })
}

export async function saveInlineEditService({ serviceId, field, newValue, services = [], macroVariables = [], contractors = [], actor = 'MARIA JOSE' }) {
  const targetService = services.find((s) => s.id === serviceId)
  if (!targetService) return null

  const extraFields = {}
  let cleanedValue = newValue
  if (field === 'service_date') {
    const rate = getDollarRateForDate(newValue, macroVariables) || 1500
    const num = parseFloat(targetService.amount_ars) || 0
    extraFields.entry_date = newValue
    extraFields.usd_rate = rate
    extraFields.amount_usd = rate > 0 ? Number((num / rate).toFixed(2)) : 0
  } else if (field === 'amount_ars') {
    const evalRes = evaluateFormulaInput(newValue, { allowNegative: false, maxDecimals: 2, emptyValue: 0 })
    if (!evalRes.ok) throw new Error(evalRes.error || 'Importe o fórmula inválida.')
    const num = evalRes.value ?? 0
    const rate = Number(targetService.usd_rate) || 1500
    cleanedValue = num
    extraFields.amount_usd = rate > 0 ? Number((num / rate).toFixed(2)) : 0
    extraFields.cell_formulas = buildCellFormulasPatch(targetService.cell_formulas, 'amount_ars', evalRes.formula)
  } else if (field === 'contractor_name') {
    cleanedValue = String(newValue || '').trim().toUpperCase()
    const foundC = contractors.find((c) => c.name?.toUpperCase().trim() === cleanedValue)
    extraFields.contractor_id = resolveWorkerIdFromCatalog(cleanedValue, contractors, foundC?.id)
    if (foundC && foundC.trade && foundC.trade.toUpperCase() !== 'MANUAL') {
      extraFields.trade = foundC.trade.toUpperCase()
    }
  }

  const updateData = { [field]: cleanedValue, ...extraFields, updated_at: new Date().toISOString() }
  const { error } = await thirdPartyServicesRepository.updateById(serviceId, updateData, { select: null })
  if (error) throw new Error(error)

  const prevFormula = field === 'amount_ars' ? getStoredCellFormula(targetService, 'amount_ars') : null
  const nextFormula = field === 'amount_ars' ? extraFields.cell_formulas?.amount_ars || null : null
  await logCellChange({
    entityType: 'third_party_services',
    entityId: serviceId,
    entityName: targetService.contractor_name || String(serviceId),
    field,
    fieldLabel: field,
    oldValue: prevFormula ? `${targetService[field]} (${prevFormula})` : targetService[field],
    newValue: nextFormula ? `${cleanedValue} (${nextFormula})` : cleanedValue,
    sheetName: 'Terceros · Servicios y Facturación',
    moduleRoute: '/terceros',
    changeOrigin: 'INLINE_CELL',
    user: actor,
  })

  return { cleanedValue, extraFields }
}

export async function saveShipWoPickerService({ serviceId, shipId, workOrderId, workItemId = null, workItems = [], services = [], actor = 'MARIA JOSE' }) {
  const target = services.find((s) => s.id === serviceId)
  if (!target) return
  const resolvedWiId = workOrderId ? (workItemId ?? resolveSingleWorkItemId(workOrderId, workItems)) : null

  const { error } = await thirdPartyServicesRepository.updateById(
    serviceId,
    { ship_id: shipId, work_order_id: workOrderId, work_item_id: resolvedWiId, updated_at: new Date().toISOString() },
    { select: null }
  )
  if (error) throw new Error(error)

  await logCellChange({
    entityType: 'third_party_services',
    entityId: serviceId,
    entityName: target.contractor_name || String(serviceId),
    field: 'ship_wo',
    fieldLabel: 'Buque y OT',
    oldValue: `${target.ship_id || 'Sin buque'} / ${target.work_order_id || 'Sin OT'}`,
    newValue: `${shipId || 'Sin buque'} / ${workOrderId || 'Sin OT'}`,
    sheetName: 'Terceros · Servicios y Facturación',
    moduleRoute: '/terceros',
    changeOrigin: 'MODAL_PICKER',
    user: actor,
  })
}

export async function saveSpreadsheetBatchService({ colKey, newValue, targetIds, revertMap, isRevert, services = [], workItems = [], contractors = [], macroVariables = [] }) {
  if (isRevert && revertMap) {
    await Promise.all(
      Object.entries(revertMap).map(([id, oldVal]) => {
        const targetSrv = services.find((x) => x.id === id)
        const payload = { updated_at: new Date().toISOString() }
        if (colKey === 'ship_wo' && oldVal && typeof oldVal === 'object') {
          payload.ship_id = oldVal.ship_id ?? null
          payload.work_order_id = oldVal.work_order_id ?? null
        } else if (colKey === 'amount_ars') {
          const num = parseFloat(oldVal) || 0
          const rate = Number(targetSrv?.usd_rate) || 1500
          payload.amount_ars = num
          payload.amount_usd = rate > 0 ? Number((num / rate).toFixed(2)) : 0
        } else if (colKey === 'service_date') {
          const rate = getDollarRateForDate(oldVal, macroVariables) || 1500
          const num = parseFloat(targetSrv?.amount_ars) || 0
          payload.service_date = oldVal
          payload.entry_date = oldVal
          payload.usd_rate = rate
          payload.amount_usd = rate > 0 ? Number((num / rate).toFixed(2)) : 0
        } else {
          payload[colKey] = oldVal
        }
        return thirdPartyServicesRepository.updateById(id, payload, { select: null })
      })
    )
    return
  }

  if (!targetIds || targetIds.length === 0) return

  let autoTradeForContractor = null
  let autoContractorId = null
  if (colKey === 'contractor_name' && typeof newValue === 'string') {
    const upperName = newValue.trim().toUpperCase()
    const foundC = contractors.find((c) => c.name?.toUpperCase().trim() === upperName)
    autoContractorId = resolveWorkerIdFromCatalog(upperName, contractors, foundC?.id)
    if (foundC && foundC.trade && foundC.trade.toUpperCase() !== 'MANUAL') {
      autoTradeForContractor = foundC.trade.toUpperCase()
    }
  }

  if (colKey === 'amount_ars' || colKey === 'service_date') {
    await Promise.all(
      targetIds.map((id) => {
        const targetSrv = services.find((x) => x.id === id)
        const rowPayload = { updated_at: new Date().toISOString() }
        if (colKey === 'amount_ars') {
          const evalRes = evaluateFormulaInput(newValue, { allowNegative: false, maxDecimals: 2, emptyValue: 0 })
          const num = evalRes.ok ? (evalRes.value ?? 0) : (parseFloat(newValue) || 0)
          const rate = Number(targetSrv?.usd_rate) || 1500
          rowPayload.amount_ars = num
          rowPayload.amount_usd = rate > 0 ? Number((num / rate).toFixed(2)) : 0
          rowPayload.cell_formulas = buildCellFormulasPatch(targetSrv?.cell_formulas, 'amount_ars', evalRes.ok ? evalRes.formula : null)
        } else {
          const rate = getDollarRateForDate(newValue, macroVariables) || 1500
          const num = parseFloat(targetSrv?.amount_ars) || 0
          rowPayload.service_date = newValue
          rowPayload.entry_date = newValue
          rowPayload.usd_rate = rate
          rowPayload.amount_usd = rate > 0 ? Number((num / rate).toFixed(2)) : 0
        }
        return thirdPartyServicesRepository.updateById(id, rowPayload, { select: null })
      })
    )
  } else {
    const updatePayload = { updated_at: new Date().toISOString() }
    if (colKey === 'ship_wo' && newValue && typeof newValue === 'object') {
      updatePayload.ship_id = newValue.ship_id ?? null
      updatePayload.work_order_id = newValue.work_order_id ?? null
      updatePayload.work_item_id = updatePayload.work_order_id
        ? (newValue.work_item_id ?? resolveSingleWorkItemId(updatePayload.work_order_id, workItems))
        : null
    } else if (colKey === 'contractor_name') {
      updatePayload.contractor_name = String(newValue || '').trim().toUpperCase()
      updatePayload.contractor_id = autoContractorId
      if (autoTradeForContractor) updatePayload.trade = autoTradeForContractor
    } else {
      updatePayload[colKey] = newValue
    }
    const { error } = await thirdPartyServicesRepository.updateByIds(targetIds, updatePayload, { select: null })
    if (error) throw new Error(error)
  }
}
