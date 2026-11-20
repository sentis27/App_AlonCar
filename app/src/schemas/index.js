/**
 * index.js — Punto único de validación de contratos Zod para AlonCar ERP.
 */
import { z } from 'zod'
import { WorkerSchema, WorkerUpdateSchema } from './workers.schema.js'
import { RateCardSchema } from './rateCards.schema.js'
import { WorkOrderSchema } from './workOrders.schema.js'
import { LaborLogSchema } from './laborLogs.schema.js'
import { SystemSettingSchema } from './systemSettings.schema.js'
import { OrganizationRoleSchema } from './organizationRoles.schema.js'
import { MacroVariableSchema } from './macroVariables.schema.js'
import { OtTemplateSchema } from './otTemplates.schema.js'
import { SystemPromptSchema, AiProcessingLogSchema } from './aiGovernance.schema.js'
import { ShipSchema, ShipStaySchema, OwnerSchema, ShipDocumentSchema, ContactSchema } from './ships.schema.js'
import { PurchaseOrderSchema, SupplierSchema, PurchaseDocumentSchema } from './purchases.schema.js'
import { ThirdPartyServiceSchema, ThirdPartyVoucherHistorySchema } from './thirdParty.schema.js'
import { WorkItemSchema } from './workItems.schema.js'
import { MaterialSchema, InventoryTransactionSchema, GasCylinderMovementSchema, MaterialRubroSchema } from './panol.schema.js'
import { DataRequirementSchema, ComplianceAlertSchema, WorkerPermissionRequestSchema } from './complianceAlerts.schema.js'
import { AuditLogSchema } from './auditLogs.schema.js'
import { ProfileSchema, PROFILE_ROLES } from './profiles.schema.js'

const TRAP_KEYS_REGISTRY = new WeakMap()

/**
 * Registra columnas trampa prohibidas en un esquema Zod para que tanto
 * `validatePayload` como `validatePartialPayload` las rechacen de inmediato.
 */
export function registerTrapKeys(schema, keys = [], hint = '') {
  if (schema && Array.isArray(keys) && keys.length > 0) {
    TRAP_KEYS_REGISTRY.set(schema, { keys, hint })
  }
  return schema
}

// Registrar esquemas existentes que ya usan .superRefine
registerTrapKeys(WorkerSchema, ['first_name', 'last_name'], 'Usar "name" (GEMINI.md §3).')
registerTrapKeys(LaborLogSchema, ['profile_id'], 'Usar "worker_id" apuntando a workers(id).')
registerTrapKeys(SystemSettingSchema, ['id'], 'Usar PK "key" (GEMINI.md §3).')
registerTrapKeys(OrganizationRoleSchema, ['id'], 'Usar PK "role_key" (GEMINI.md §3).')
registerTrapKeys(AuditLogSchema, ['entity', 'table_name'], 'Usar "entity_type" (GEMINI.md §3).')
registerTrapKeys(PurchaseOrderSchema, ['notes'], 'Usar "observations" en purchase_orders (GEMINI.md §3).')

/**
 * Detecta instancias de eventos React/DOM o cadenas `[object Object]` antes de persistir (SKL-015).
 */
export function isDomEventOrSerializedObject(val) {
  if (val === null || val === undefined) return false
  if (typeof val === 'string') {
    const upper = val.trim().toUpperCase()
    return upper === '[OBJECT OBJECT]' || /\[OBJECT\s+[A-Z]+\]/i.test(val)
  }
  if (typeof val === 'object') {
    if ('nativeEvent' in val || 'preventDefault' in val || ('target' in val && 'currentTarget' in val)) {
      return true
    }
  }
  return false
}

/**
 * Verifica que ningún campo de primer nivel de un payload contenga un evento DOM o `[object Object]`.
 */
export function findInvalidEventField(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  for (const [key, val] of Object.entries(payload)) {
    if (isDomEventOrSerializedObject(val)) return key
  }
  return null
}

function formatZodIssues(zodError) {
  const issues = zodError.issues.map((i) => ({
    field: i.path.join('.') || 'root',
    message: i.message,
  }))
  const summary = issues.map((i) => `${i.field}: ${i.message}`).join('; ')
  return { issues, summary }
}

function checkRegisteredTrapKeys(schema, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const trapMeta = TRAP_KEYS_REGISTRY.get(schema)
  if (!trapMeta) return null
  const badTraps = trapMeta.keys.filter((k) => k in payload)
  if (badTraps.length === 0) return null
  const issues = badTraps.map((k) => ({
    field: k,
    message: `Columna trampa prohibida: "${k}". ${trapMeta.hint}`.trim(),
  }))
  return {
    success: false,
    data: null,
    error: issues.map((i) => `${i.field}: ${i.message}`).join('; '),
    issues,
  }
}

/**
 * Valida un payload completo contra un esquema Zod y devuelve un contrato uniforme
 * `{ success, data, error, issues }` compatible con `_baseRepository.js`.
 */
export function validatePayload(schema, payload) {
  const invalidKey = findInvalidEventField(payload)
  if (invalidKey) {
    const msg = `${invalidKey}: Valor inválido bloqueado (Event / [object Object])`
    return {
      success: false,
      data: null,
      error: msg,
      issues: [{ field: invalidKey, message: msg }],
    }
  }

  const trapFailure = checkRegisteredTrapKeys(schema, payload)
  if (trapFailure) return trapFailure

  const result = schema.safeParse(payload)
  if (result.success) {
    return {
      success: true,
      data: result.data,
      error: null,
      issues: [],
    }
  }
  const { issues, summary } = formatZodIssues(result.error)
  return {
    success: false,
    data: null,
    error: summary || 'Error de validación de esquema',
    issues,
  }
}

/**
 * Valida un PATCH parcial contra las reglas de campo de `schema` sin exigir
 * campos omitidos ni inyectar valores `.default()` sobre columnas no modificadas.
 */
export function validatePartialPayload(schema, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return { success: false, data: null, error: 'Payload parcial requerido', issues: [] }
  }

  const invalidKey = findInvalidEventField(patch)
  if (invalidKey) {
    const msg = `${invalidKey}: Valor inválido bloqueado (Event / [object Object])`
    return {
      success: false,
      data: null,
      error: msg,
      issues: [{ field: invalidKey, message: msg }],
    }
  }

  const trapFailure = checkRegisteredTrapKeys(schema, patch)
  if (trapFailure) return trapFailure

  const cleanPatch = {}
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) cleanPatch[k] = v
  }

  const keys = Object.keys(cleanPatch)
  if (keys.length === 0) {
    return { success: false, data: null, error: 'El patch de actualización está vacío', issues: [] }
  }

  if (!schema?.shape) {
    return { success: true, data: cleanPatch, error: null, issues: [] }
  }

  const pickMask = {}
  for (const k of keys) {
    if (k in schema.shape) pickMask[k] = true
  }

  if (Object.keys(pickMask).length === 0) {
    return { success: true, data: cleanPatch, error: null, issues: [] }
  }

  const pickedSchema = z.object(schema.shape).passthrough().pick(pickMask)
  const result = pickedSchema.safeParse(cleanPatch)
  if (result.success) {
    return { success: true, data: result.data, error: null, issues: [] }
  }

  const { issues, summary } = formatZodIssues(result.error)
  return {
    success: false,
    data: null,
    error: summary || 'Error de validación parcial de esquema',
    issues,
  }
}

export {
  WorkerSchema,
  WorkerUpdateSchema,
  RateCardSchema,
  WorkOrderSchema,
  LaborLogSchema,
  SystemSettingSchema,
  OrganizationRoleSchema,
  MacroVariableSchema,
  OtTemplateSchema,
  SystemPromptSchema,
  AiProcessingLogSchema,
  ShipSchema,
  ShipStaySchema,
  OwnerSchema,
  ShipDocumentSchema,
  ContactSchema,
  PurchaseOrderSchema,
  SupplierSchema,
  PurchaseDocumentSchema,
  ThirdPartyServiceSchema,
  ThirdPartyVoucherHistorySchema,
  WorkItemSchema,
  MaterialSchema,
  InventoryTransactionSchema,
  GasCylinderMovementSchema,
  MaterialRubroSchema,
  DataRequirementSchema,
  ComplianceAlertSchema,
  WorkerPermissionRequestSchema,
  AuditLogSchema,
  ProfileSchema,
  PROFILE_ROLES,
}
