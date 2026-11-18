/**
 * index.js — Punto único de validación de contratos Zod para AlonCar ERP.
 */
import { WorkerSchema, WorkerUpdateSchema } from './workers.schema.js'
import { RateCardSchema } from './rateCards.schema.js'
import { WorkOrderSchema } from './workOrders.schema.js'
import { LaborLogSchema } from './laborLogs.schema.js'

export {
  WorkerSchema,
  WorkerUpdateSchema,
  RateCardSchema,
  WorkOrderSchema,
  LaborLogSchema,
}

/**
 * Valida un payload contra un esquema Zod y devuelve un contrato uniforme
 * `{ success, data, error, issues }` compatible con `_baseRepository.js`.
 */
export function validatePayload(schema, payload) {
  const result = schema.safeParse(payload)
  if (result.success) {
    return {
      success: true,
      data: result.data,
      error: null,
      issues: [],
    }
  }
  const issues = result.error.issues.map((i) => ({
    field: i.path.join('.') || 'root',
    message: i.message,
  }))
  const summary = issues.map((i) => `${i.field}: ${i.message}`).join('; ')
  return {
    success: false,
    data: null,
    error: summary || 'Error de validación de esquema',
    issues,
  }
}
