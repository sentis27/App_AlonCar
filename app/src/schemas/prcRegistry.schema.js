/**
 * prcRegistry.schema.js
 * Contrato Zod para `contractor_prc_registry` (Base de datos única de PRC #2000+).
 */
import { z } from 'zod'

export const PRC_STATUSES = ['ACTIVO', 'TERMINADO', 'ANULADO']
export const PRC_SOURCE_MODULES = ['TERCEROS_PRC', 'TERCEROS_FILAS', 'OT_UNIFICADO', 'MANUAL']
export const PRC_MIN_NUMBER = 2000

export const PRC_BUSINESS_RULE_NOTICE =
  'Los presupuestos (PRC) se emiten únicamente para contratistas que trabajan dentro del astillero. Si el trabajo se realiza fuera del astillero en taller externo, usar RMO.'

export const ContractorPrcRegistrySchema = z
  .object({
    id: z.string().uuid().optional(),
    prc_number: z.coerce
      .number()
      .int('El número de PRC debe ser entero')
      .min(PRC_MIN_NUMBER, `El número de PRC no puede ser menor a ${PRC_MIN_NUMBER}`)
      .optional(),
    issue_date: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}/, 'issue_date debe iniciar con YYYY-MM-DD')
      .optional(),
    contractor_worker_id: z.string().uuid('contractor_worker_id debe ser un UUID válido').nullable().optional(),
    contractor_name: z.string().trim().min(1, 'El nombre del contratista es obligatorio'),
    ship_id: z.string().uuid().nullable().optional(),
    work_order_id: z.string().uuid().nullable().optional(),
    work_item_id: z.string().uuid().nullable().optional(),
    third_party_service_id: z.string().uuid().nullable().optional(),
    description: z.string().default(''),
    amount_ars: z.coerce.number().min(0, 'amount_ars no puede ser negativo').default(0),
    amount_usd: z.coerce.number().min(0, 'amount_usd no puede ser negativo').nullable().optional(),
    exchange_rate: z.coerce.number().positive('exchange_rate debe ser mayor a 0').nullable().optional(),
    status: z.enum(PRC_STATUSES).default('ACTIVO'),
    parent_prc_id: z.string().uuid().nullable().optional(),
    parent_prc_number: z.coerce.number().int().min(PRC_MIN_NUMBER).nullable().optional(),
    annulled_reason: z.string().nullable().optional(),
    annulled_by: z.string().nullable().optional(),
    annulled_at: z.string().nullable().optional(),
    source_module: z.enum(PRC_SOURCE_MODULES).default('TERCEROS_PRC'),
    observations: z.string().nullable().optional(),
    created_by: z.string().nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough()
  .superRefine((val, ctx) => {
    if (val.status === 'ANULADO' && !String(val.annulled_reason || '').trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['annulled_reason'],
        message: 'Todo PRC anulado requiere un motivo de anulación.',
      })
    }
  })
