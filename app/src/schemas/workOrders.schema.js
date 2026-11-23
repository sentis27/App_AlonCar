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
    ot_template_id: z.string().uuid().nullable().optional(),
    merged_into_wo_id: z.string().uuid().nullable().optional(),
    notes: z.string().nullable().optional(),
    billing_description: z.string().nullable().optional(),
    billing_notes: z.string().nullable().optional(),
    is_in_billing: z.boolean().optional(),
    billing_sort_order: z.coerce.number().int().nullable().optional(),
    billing_rubro_group: z.string().nullable().optional(),
    billing_pricing_mode: z.enum(['MO_MAT', 'UNITARIO', 'ITEMS', 'SIN_CARGO']).optional(),
    billing_mo_usd: z.coerce.number().optional(),
    billing_mat_usd: z.coerce.number().optional(),
    billing_unit_price_usd: z.coerce.number().optional(),
    billing_qty_override: z.coerce.number().nullable().optional(),
    billing_mo_tax: z.enum(['EXENTO', 'GRAVADO_21']).optional(),
    billing_mat_tax: z.enum(['EXENTO', 'GRAVADO_21']).optional(),
    billing_line_items: z.array(z.any()).optional(),
    foreman_review_status: z.enum(['NONE', 'REQUESTED', 'RESOLVED']).optional(),
    foreman_review_note: z.string().nullable().optional(),
    foreman_review_requested_at: z.string().nullable().optional(),
    foreman_review_requested_by: z.string().nullable().optional(),
    foreman_review_resolved_at: z.string().nullable().optional(),
    foreman_review_resolved_by: z.string().nullable().optional(),
    created_at: z.string().optional(),
  })
  .passthrough()
