/**
 * workers.schema.js
 * Contrato Zod para la tabla `workers` (GEMINI.md §3).
 * Bloquea explícitamente las columnas trampa inexistentes (`first_name`, `last_name`).
 */
import { z } from 'zod'

const FORBIDDEN_WORKER_TRAP_KEYS = ['first_name', 'last_name']

export const WorkerSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1, 'El nombre del operario/contratista es obligatorio'),
    category: z.string().nullable().optional(),
    trade: z.string().trim().min(1, 'El rubro/oficio (trade) es obligatorio'),
    hourly_rate_ars: z.coerce.number().min(0, 'La tarifa ARS no puede ser negativa').default(0),
    hourly_rate_usd: z.coerce.number().min(0, 'La tarifa USD no puede ser negativa').default(0),
    work_group: z.string().trim().min(1, 'El grupo de trabajo es obligatorio').default('ASTILLERO'),
    admin_center: z.string().trim().min(1, 'El centro administrativo es obligatorio').default('ASTILLERO'),
    status: z.string().trim().min(1).default('ACTIVO'),
    phone: z.string().nullable().optional(),
    dni: z.string().nullable().optional(),
    consumables: z.string().default('CLIENTE'),
    consumables_discount_pct: z.coerce.number().min(0).max(100).default(0),
    safety_items: z.string().optional(),
    safety_elements: z.string().nullable().optional(),
    can_withdraw_materials: z.boolean().default(true),
    can_impute_hours: z.boolean().default(true),
    can_charge_third_party: z.boolean().default(false),
    is_foreman: z.boolean().default(false),
    notification_enabled: z.boolean().optional(),
    contract_type: z.string().nullable().optional(),
    contract_start_date: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough()
  .superRefine((val, ctx) => {
    for (const trapKey of FORBIDDEN_WORKER_TRAP_KEYS) {
      if (trapKey in val) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [trapKey],
          message: `Columna trampa prohibida en workers: "${trapKey}". Usar "name" (GEMINI.md §3).`,
        })
      }
    }
  })

export const WorkerUpdateSchema = WorkerSchema
