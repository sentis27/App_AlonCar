/**
 * costControl.schema.js
 * Contrato Zod para `cost_control_reviews` y claves de configuración de Control de Gastos (GS-010 / DEC-025).
 */
import { z } from 'zod'

export const COST_CONTROL_REVIEW_TYPES = ['MATERIAL_EXCEPTION', 'LABOR_ONLY_APPROVED']

export const COST_CONTROL_EXCLUDED_OTS_KEY = 'cost_control_excluded_ots'

export const DEFAULT_EXCLUDED_COST_CONTROL_OTS = [
  'PROV.CONSUMIBLES',
  'CAMION-AUTO',
  'OFICINA',
  'TALLER CARPINT',
  'AGUA',
  'MULITA',
  'DONACION',
  'PROVISION CARLOS MAYO',
  'DESPERDICIO HORAS',
]

const FORBIDDEN_COST_CONTROL_TRAP_KEYS = ['notes', 'entity_id']

/**
 * Genera la clave única determinística para excepciones sobre una línea de material.
 */
export function buildMaterialExceptionReviewKey(inventoryTransactionId) {
  const cleanId = String(inventoryTransactionId || '').trim()
  return cleanId ? `MAT:${cleanId}` : ''
}

/**
 * Genera la clave única determinística para aprobar horas sin materiales en una quincena.
 */
export function buildLaborOnlyApprovalReviewKey({ periodKey, shipId, workOrderId, contractorEntity } = {}) {
  const cleanPeriod = String(periodKey || '').trim().toUpperCase()
  const cleanShip = String(shipId || '').trim() || 'NONE'
  const cleanWo = String(workOrderId || '').trim() || 'NONE'
  const cleanContractor = String(contractorEntity || '').trim().toUpperCase()
  return `LAB:${cleanPeriod}|${cleanShip}|${cleanWo}|${cleanContractor}`
}

export const CostControlReviewSchema = z
  .object({
    id: z.string().uuid().optional(),
    review_type: z.enum(COST_CONTROL_REVIEW_TYPES),
    period_key: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-(1Q|2Q)$/, 'period_key debe tener formato YYYY-MM-1Q o YYYY-MM-2Q'),
    inventory_transaction_id: z
      .string()
      .uuid('inventory_transaction_id debe ser un UUID válido')
      .nullable()
      .optional(),
    ship_id: z.string().uuid('ship_id debe ser un UUID válido').nullable().optional(),
    work_order_id: z.string().uuid('work_order_id debe ser un UUID válido').nullable().optional(),
    contractor_entity: z.string().trim().min(1, 'contractor_entity es obligatorio'),
    review_key: z.string().trim().min(1, 'review_key es obligatorio'),
    reason: z.string().trim().nullable().optional(),
    reviewed_by: z.string().trim().min(1, 'reviewed_by es obligatorio').default('Administrador'),
    reviewed_at: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough()
  .superRefine((val, ctx) => {
    for (const trapKey of FORBIDDEN_COST_CONTROL_TRAP_KEYS) {
      if (trapKey in val) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [trapKey],
          message: `Columna trampa prohibida en cost_control_reviews: "${trapKey}". Usar "reason" e "inventory_transaction_id"/"review_key".`,
        })
      }
    }
    if (val.review_type === 'MATERIAL_EXCEPTION' && !val.inventory_transaction_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['inventory_transaction_id'],
        message: 'MATERIAL_EXCEPTION requiere inventory_transaction_id válido.',
      })
    }
  })
