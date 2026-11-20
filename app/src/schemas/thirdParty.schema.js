/**
 * thirdParty.schema.js
 * Contratos Zod para `third_party_services` y `third_party_voucher_history`.
 */
import { z } from 'zod'

export const ThirdPartyServiceSchema = z
  .object({
    id: z.string().uuid().optional(),
    work_item_id: z.string().uuid().nullable().optional(),
    work_order_id: z.string().uuid().nullable().optional(),
    ship_id: z.string().uuid().nullable().optional(),
    contractor_id: z.string().uuid().nullable().optional(),
    contractor_name: z.string().trim().min(1, 'El nombre del contratista/taller es obligatorio'),
    status: z.string().nullable().optional(),
    voucher_type: z.string().nullable().optional(),
    voucher_number: z.string().nullable().optional(),
    budget_number: z.string().nullable().optional(),
    invoice_number: z.string().nullable().optional(),
    supplier_remito_number: z.string().nullable().optional(),
    internal_remito_number: z.string().nullable().optional(),
    amount_ars: z.coerce.number().min(0, 'amount_ars no puede ser negativo').default(0),
    usd_rate: z.coerce.number().min(0).nullable().optional(),
    amount_usd: z.coerce.number().min(0).nullable().optional(),
    direct_observations: z.string().nullable().optional(),
    specific_observations: z.string().nullable().optional(),
    service_date: z.string().nullable().optional(),
    entry_date: z.string().nullable().optional(),
    voucher_date: z.string().nullable().optional(),
    service_location: z.string().nullable().optional(),
    trade: z.string().nullable().optional(),
    audit_status: z.string().nullable().optional(),
    audit_notes: z.string().nullable().optional(),
    audited_by: z.string().nullable().optional(),
    audited_at: z.string().nullable().optional(),
    created_by: z.string().nullable().optional(),
    is_active: z.boolean().optional(),
    closed_at: z.string().nullable().optional(),
    cell_formulas: z.record(z.string(), z.string()).nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough()

export const ThirdPartyVoucherHistorySchema = z
  .object({
    id: z.string().uuid().optional(),
    third_party_service_id: z.string().uuid('third_party_service_id debe ser un UUID válido'),
    from_voucher_type: z.string().nullable().optional(),
    to_voucher_type: z.string().trim().min(1),
    from_amount_ars: z.coerce.number().min(0).nullable().optional(),
    to_amount_ars: z.coerce.number().min(0).nullable().optional(),
    voucher_number: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    changed_by: z.string().nullable().optional(),
    created_at: z.string().optional(),
  })
  .passthrough()
