/**
 * laborLogs.schema.js
 * Contrato Zod para la tabla `labor_logs` (GEMINI.md §3: `worker_id` FK a `workers(id)`).
 */
import { z } from 'zod'

const FORBIDDEN_LABOR_TRAP_KEYS = ['profile_id']

export const LaborLogSchema = z
  .object({
    id: z.string().uuid().optional(),
    worker_id: z.string().uuid('worker_id debe ser un UUID válido de workers(id)'),
    worker_name: z.string().trim().min(1, 'worker_name es obligatorio'),
    ship_id: z.string().uuid().nullable().optional(),
    work_order_id: z.string().uuid().nullable().optional(),
    work_item_id: z.string().uuid().nullable().optional(),
    hours_worked: z.coerce.number().min(0, 'hours_worked no puede ser negativo'),
    date_logged: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}/, 'date_logged debe iniciar con YYYY-MM-DD'),
    rubro: z.string().trim().optional(),
    work_type: z.string().trim().default('HORA'),
    cost_center: z.string().trim().default('CLIENTE'),
    approval_status: z.string().trim().default('Aprobado'),
    hours_normal: z.coerce.number().min(0).default(0),
    hours_extra_50: z.coerce.number().min(0).default(0),
    hours_extra_100: z.coerce.number().min(0).default(0),
    worker_type: z.string().optional(),
    notes: z.string().nullable().optional(),
    review_reason: z.string().nullable().optional(),
    worker_response: z.string().nullable().optional(),
    created_at: z.string().optional(),
  })
  .passthrough()
  .superRefine((val, ctx) => {
    for (const trapKey of FORBIDDEN_LABOR_TRAP_KEYS) {
      if (trapKey in val) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [trapKey],
          message: `Columna trampa prohibida en labor_logs: "${trapKey}". Usar "worker_id" apuntando a workers(id).`,
        })
      }
    }
  })
