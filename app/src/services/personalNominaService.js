/**
 * personalNominaService.js
 * Capa de persistencia y auditoría desacoplada para la Nómina de Personal (M2).
 * Cumple Candado #3 (Cero SQL en vistas/hooks) y Candado #4 (Trazabilidad en audit_logs).
 */

import { auditService } from '../lib/auditService.js'
import { assignMonotonicFolios } from '../lib/monotonicFolioEngine.js'
import { workersRepository } from '../repositories/workersRepository.js'
import { rateCardsRepository } from '../repositories/rateCardsRepository.js'
import { systemSettingsRepository } from '../repositories/systemSettingsRepository.js'
import { organizationRolesRepository } from '../repositories/organizationRolesRepository.js'

const SHEET_NAME = 'Personal · Nómina de Operarios'
const MODULE_ROUTE = '/personal'

/**
 * Carga nómina de operarios y último período/dólar de tarifario desde Supabase.
 */
export async function fetchPersonalBaseDataService() {
  const [workersRes, rateRes] = await Promise.all([
    workersRepository.listWorkers(),
    rateCardsRepository.getLatestPeriodRate(),
  ])
  if (workersRes.error) throw new Error(workersRes.error)
  const latestRate = rateRes.data || null
  return {
    workers: workersRes.data?.length ? assignMonotonicFolios(workersRes.data, { dateField: 'created_at' }) : [],
    periodKey: latestRate?.period || null,
    dollarRate: latestRate?.dollar_rate ? (parseFloat(latestRate.dollar_rate) || 1500) : null,
  }
}

const PERM_FIELD_MAP = {
  P: 'can_withdraw_materials',
  H: 'can_impute_hours',
  '3ros': 'can_charge_third_party',
  JO: 'is_foreman',
}

/**
 * Carga rubros maestros (system_settings) y roles organizacionales (organization_roles).
 */
export async function fetchNominaAuxDataService() {
  let customTrades = []
  let orgRolesMap = {}

  const [tradesRes, rolesRes] = await Promise.all([
    systemSettingsRepository.getByKey('master_trades', { select: 'value' }),
    organizationRolesRepository.listRoles({ orderBy: [] }),
  ])

  if (!tradesRes.error && Array.isArray(tradesRes.data?.value)) {
    customTrades = tradesRes.data.value
  }
  if (!rolesRes.error && Array.isArray(rolesRes.data) && rolesRes.data.length > 0) {
    rolesRes.data.forEach((r) => {
      orgRolesMap[r.role_key] = { title: r.role_title, holder: r.holder_name, dept: r.department }
    })
  }

  return { customTrades, orgRolesMap }
}

/**
 * Persiste un registro en `workers` (insert/update) con degradación defensiva si la
 * migración 0037 (`contract_type`, `contract_start_date`) aún no fue aplicada en Supabase.
 */
export async function persistWorkerWithSchemaFallbackService({
  mode = 'insert',
  targetId = null,
  payload,
  syncGroup = null,
}) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload de operario requerido.')
  }

  const execQuery = async (body) => {
    if (mode === 'update') {
      return workersRepository.updateById(targetId, body, { select: '*' })
    }
    return workersRepository.insertOne(body, { select: '*' })
  }

  let res = await execQuery(payload)
  let missingContractCols = false
  if (res.error && String(res.error).includes('contract_')) {
    missingContractCols = true
    const { contract_type: _ct, contract_start_date: _cs, ...safePayload } = payload
    res = await execQuery(safePayload)
  }
  if (res.error) throw new Error(res.error)

  if (mode === 'update' && syncGroup && syncGroup !== 'ASTILLERO') {
    const { error: groupErr } = await workersRepository.updateWorkersByWorkGroup(syncGroup, {
      can_charge_third_party: payload.can_charge_third_party,
      trade: payload.trade,
    })
    if (groupErr) throw new Error(groupErr)
  }

  return { data: res.data ? [res.data] : [], missingContractCols }
}

/**
 * Registra en audit_logs el guardado desde modal de alta/edición de operario.
 */
export async function logWorkerModalSaveAuditService({ isEdit, workerId, payload, rowData }) {
  await auditService.logRowAction({
    action: isEdit ? 'MODAL_SAVE' : 'ROW_INSERT',
    entityType: 'workers',
    entityId: workerId,
    entityName: payload.name,
    ...(isEdit ? { changes: payload } : { rowData }),
    sheetName: SHEET_NAME,
    moduleRoute: MODULE_ROUTE,
  })
}

/**
 * Alterna el estado ACTIVO/INACTIVO de un operario y registra auditoría.
 */
export async function toggleWorkerStatusNominaService({ worker }) {
  const newStatus = worker.status === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO'
  const { error } = await workersRepository.updateById(worker.id, { status: newStatus }, { select: null })
  if (error) throw new Error(error)

  await auditService.logCellChange({
    entityType: 'workers',
    entityId: worker.id,
    entityName: worker.name,
    field: 'status',
    fieldLabel: 'Estado Operativo',
    oldValue: worker.status,
    newValue: newStatus,
    sheetName: SHEET_NAME,
    moduleRoute: MODULE_ROUTE,
  })

  return { newStatus }
}

/**
 * Alterna un permiso operativo (P, H, 3ros, JO) en workers con propagación grupal para 3ros.
 */
export async function toggleWorkerPermissionNominaService({ worker, permType }) {
  const field = PERM_FIELD_MAP[permType]
  if (!field) return null

  const defaultVal = permType === 'P' || permType === 'H'
  const currentVal = Boolean(worker[field] ?? defaultVal)
  const newVal = !currentVal
  const isGroup3ros = permType === '3ros' && worker.work_group && worker.work_group !== 'ASTILLERO'

  const { error } = isGroup3ros
    ? await workersRepository.updateWorkersByWorkGroup(worker.work_group, { [field]: newVal })
    : await workersRepository.updateById(worker.id, { [field]: newVal }, { select: null })

  if (error) throw new Error(error)

  await auditService.logCellChange({
    entityType: 'workers',
    entityId: worker.id,
    entityName: worker.name,
    field,
    fieldLabel: `Permiso (${permType})`,
    oldValue: currentVal ? 'HABILITADO' : 'BLOQUEADO',
    newValue: newVal ? 'HABILITADO' : 'BLOQUEADO',
    sheetName: SHEET_NAME,
    moduleRoute: MODULE_ROUTE,
  })

  return { field, newVal, isGroup3ros }
}

/**
 * Elimina un operario individual de workers con registro en audit_logs.
 */
export async function deleteWorkerNominaService({ worker }) {
  const { error } = await workersRepository.deleteById(worker.id)
  if (error) throw new Error(error)

  await auditService.logRowAction({
    action: 'ROW_DELETE',
    entityType: 'workers',
    entityId: worker.id,
    entityName: worker.name,
    rowData: worker,
    sheetName: SHEET_NAME,
    moduleRoute: MODULE_ROUTE,
  })
}

/**
 * Actualiza en lote el estado ACTIVO/INACTIVO de operarios seleccionados con auditoría.
 */
export async function batchUpdateWorkersStatusNominaService({ selectedIds = [], targetStatus, workers = [] }) {
  if (selectedIds.length === 0) return
  const { error } = await workersRepository.updateWorkersByIds(selectedIds, { status: targetStatus })
  if (error) throw new Error(error)

  await Promise.all(
    selectedIds.map((id) => {
      const w = workers.find((item) => item.id === id)
      return auditService.logCellChange({
        entityType: 'workers',
        entityId: id,
        entityName: w?.name || `Operario #${id}`,
        field: 'status',
        fieldLabel: 'Estado Operativo',
        oldValue: w?.status || '',
        newValue: targetStatus,
        changeOrigin: 'BATCH_ACTION',
        sheetName: SHEET_NAME,
        moduleRoute: MODULE_ROUTE,
      })
    })
  )
}

/**
 * Elimina en lote operarios seleccionados de workers con auditoría.
 */
export async function batchDeleteWorkersNominaService({ selectedIds = [], workers = [] }) {
  if (selectedIds.length === 0) return
  const { error } = await workersRepository.deleteWorkersByIds(selectedIds)
  if (error) throw new Error(error)

  await Promise.all(
    selectedIds.map((id) => {
      const w = workers.find((item) => item.id === id)
      return auditService.logRowAction({
        action: 'ROW_DELETE',
        entityType: 'workers',
        entityId: id,
        entityName: w?.name || `Operario #${id}`,
        rowData: w || { id },
        changeOrigin: 'BATCH_ACTION',
        sheetName: SHEET_NAME,
        moduleRoute: MODULE_ROUTE,
      })
    })
  )
}

/**
 * Persiste una edición de celda individual en workers y registra audit_logs.
 */
export async function updateWorkerCellNominaService({ rowId, colKey, colLabel, oldValue, dbPatch, entityName }) {
  const { error } = await workersRepository.updateById(rowId, dbPatch, { select: null })
  if (error) throw new Error(error)

  await auditService.logCellChange({
    entityType: 'workers',
    entityId: rowId,
    entityName: entityName || rowId,
    field: colKey,
    fieldLabel: colLabel || colKey,
    oldValue,
    newValue: dbPatch[colKey],
    sheetName: SHEET_NAME,
    moduleRoute: MODULE_ROUTE,
  })
}

/**
 * Actualiza titulares y nombres técnicos de puestos organizacionales en organization_roles.
 */
export async function saveOrganizationRolesService({ rolesFormData }) {
  for (const [key, val] of Object.entries(rolesFormData || {})) {
    const { error } = await organizationRolesRepository.updateRoleByKey(
      key,
      { holder_name: val.holder, role_title: val.title },
      { select: null }
    )
    if (error) throw new Error(error)
  }

  const { data, error } = await organizationRolesRepository.listRoles({ orderBy: [] })
  if (error) throw new Error(error)

  const map = {}
  ;(data || []).forEach((r) => {
    map[r.role_key] = { title: r.role_title, holder: r.holder_name, dept: r.department }
  })
  return map
}
