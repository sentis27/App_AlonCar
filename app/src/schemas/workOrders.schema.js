/**
 * workOrders.schema.js
 * Contrato Zod para la tabla `work_orders` (GEMINI.md §3).
 */
import { z } from 'zod'

export const WorkOrderSchema = z
  .object({
    id: z.string().uuid().optional(),
    ship_id: z.string().uuid('ship_id debe ser un UUID válido'),
    ot_number: z.string().trim().nullable().optional(),
    title: z.string().trim().min(1, 'El título de la OT es obligatorio'),
    description: z.string().nullable().optional(),
    contractors: z.any().optional(),
    contractor_name: z.string().nullable().optional(),
    foreman_name: z.string().nullable().optional(),
    work_type: z.string().trim().min(1, 'work_type es obligatorio').default('HORA'),
    status: z.string().trim().min(1, 'status es obligatorio').default('En Progreso'),
    assignment_type: z.string().optional(),
    budget_code: z.string().nullable().optional(),
    start_date: z.string().nullable().optional(),
    estimated_end_date: z.string().nullable().optional(),
    closed_at: z.string().nullable().optional(),
    allow_post_billing_costs: z.boolean().default(false),
    is_tabulated: z.boolean().default(false),
    merged_into_wo_id: z.string().uuid().nullable().optional(),
    notes: z.string().nullable().optional(),
    created_at: z.string().optional(),
  })
  .passthrough()
