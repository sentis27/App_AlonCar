/**
 * workItems.schema.js
 * Contrato Zod para la tabla `work_items` (subtareas de Órdenes de Trabajo).
 */
import { z } from 'zod'

export const WorkItemSchema = z
  .object({
    id: z.string().uuid().optional(),
    work_order_id: z.string().uuid('work_order_id debe ser un UUID válido'),
    description: z.string().nullable().optional(),
    contractor_name: z.string().nullable().optional(),
    trade: z.string().nullable().optional(),
    status: z.string().trim().min(1).default('Pendiente de inicio'),
    contractors: z.array(z.string()).nullable().optional(),
    foreman_name: z.string().nullable().optional(),
    work_type: z.string().nullable().optional(),
    assignment_type: z.string().nullable().optional(),
    specific_budget_id: z.string().nullable().optional(),
    comments: z.string().nullable().optional(),
    voucher_type: z.string().nullable().optional(),
    voucher_number: z.string().nullable().optional(),
    send_to_third_party_prc: z.boolean().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough()
