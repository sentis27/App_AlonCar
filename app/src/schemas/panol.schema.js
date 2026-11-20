/**
 * panol.schema.js
 * Contratos Zod para `materials`, `inventory_transactions`, `gas_cylinder_movements` y `material_rubros`.
 */
import { z } from 'zod'

export const MaterialSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1, 'El nombre técnico del material es obligatorio'),
    category: z.string().nullable().optional(),
    current_stock: z.coerce.number().optional(),
    minimum_stock: z.coerce.number().min(0).optional(),
    cost_ars: z.coerce.number().min(0).nullable().optional(),
    cost_usd: z.coerce.number().min(0).nullable().optional(),
    rubro: z.string().nullable().optional(),
    rubro_status: z.string().nullable().optional(),
    suggested_rubro: z.string().nullable().optional(),
    security_factor: z.coerce.number().min(0).optional(),
    unit_measure: z.string().nullable().optional(),
    weight_kg: z.coerce.number().min(0).optional(),
    requires_stock_control: z.boolean().optional(),
    image_url: z.string().nullable().optional(),
    last_price_update: z.string().nullable().optional(),
    created_at: z.string().optional(),
  })
  .passthrough()

export const InventoryTransactionSchema = z
  .object({
    id: z.string().uuid().optional(),
    material_id: z.string().uuid().nullable().optional(),
    work_order_id: z.string().uuid().nullable().optional(),
    work_item_id: z.string().uuid().nullable().optional(),
    ship_id: z.string().uuid().nullable().optional(),
    worker_id: z.string().uuid().nullable().optional(),
    user_id: z.string().uuid().nullable().optional(),
    worker_name: z.string().nullable().optional(),
    contractor_name: z.string().nullable().optional(),
    movement_type: z.string().nullable().optional(),
    quantity_withdrawn: z.coerce.number().min(0).nullable().optional(),
    unit_cost_ars_snapshot: z.coerce.number().min(0).nullable().optional(),
    unit_cost_usd_snapshot: z.coerce.number().min(0).nullable().optional(),
    weight_total: z.coerce.number().min(0).nullable().optional(),
    cost_center: z.string().nullable().optional(),
    voucher_number: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    transaction_date: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
    cell_formulas: z.record(z.string(), z.string()).nullable().optional(),
    is_deletion_requested: z.boolean().optional(),
    deletion_requested_at: z.string().nullable().optional(),
    deletion_requested_by: z.string().nullable().optional(),
    deletion_reason: z.string().nullable().optional(),
  })
  .passthrough()

export const GasCylinderMovementSchema = z
  .object({
    id: z.string().uuid().optional(),
    movement_date: z.string().min(1),
    operation_type: z.string().trim().min(1),
    material_id: z.string().uuid('material_id debe ser un UUID válido'),
    ship_id: z.string().uuid().nullable().optional(),
    work_order_id: z.string().uuid().nullable().optional(),
    inventory_transaction_id: z.string().uuid().nullable().optional(),
    worker_id: z.string().uuid().nullable().optional(),
    worker_name: z.string().nullable().optional(),
    contractor_name: z.string().nullable().optional(),
    supplier_delivered_id: z.string().uuid().nullable().optional(),
    supplier_returned_id: z.string().uuid().nullable().optional(),
    quantity: z.coerce.number().int().positive('La cantidad de tubos debe ser mayor a 0'),
    remito_number: z.string().nullable().optional(),
    cylinder_condition: z.string().nullable().optional(),
    performed_by: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    created_at: z.string().optional(),
  })
  .passthrough()

export const MaterialRubroSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1),
    category: z.string().nullable().optional(),
    is_active: z.boolean().optional(),
    created_at: z.string().optional(),
  })
  .passthrough()
