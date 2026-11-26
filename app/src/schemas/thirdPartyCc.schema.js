/**
 * thirdPartyCc.schema.js
 * Contratos Zod para las 4 tablas de Cuentas Corrientes de Talleres:
 * `third_party_cc_accounts`, `third_party_cc_rate_history`,
 * `third_party_cc_entries` y `third_party_cc_payments`.
 */
import { z } from 'zod'

export const CC_PRICING_MODES = ['PER_KG', 'BY_VOUCHER']
export const CC_CANCELLATION_MODES = ['FIFO', 'MANUAL']
export const CC_ENTRY_SOURCES = ['PANOL_REMITO', 'TERCEROS_SERVICE', 'MANUAL']
export const CC_PAYMENT_TYPES = [
  'EFECTIVO_USD',
  'TRANSFERENCIA_ARS',
  'ECHEQ_ARS',
  'COMPENSACION_PANOL',
  'COMPENSACION_TRABAJO',
]
export const CC_SOURCE_MODULES = ['MANUAL', 'TESORERIA']

export const ThirdPartyCcAccountSchema = z
  .object({
    id: z.string().uuid().optional(),
    worker_id: z.string().uuid('worker_id debe ser un UUID válido'),
    operational_name: z.string().trim().min(1, 'El nombre operativo es obligatorio'),
    legal_name: z.string().nullable().optional(),
    pricing_mode: z.enum(CC_PRICING_MODES).default('PER_KG'),
    current_rate_usd: z.coerce.number().min(0, 'La tarifa US$/kg no puede ser negativa').default(0),
    opening_balance_usd: z.coerce.number().default(0),
    opening_balance_date: z.string().nullable().optional(),
    material_categories: z.array(z.string()).default(['MATERIALES']),
    cancellation_mode: z.enum(CC_CANCELLATION_MODES).default('FIFO'),
    is_active: z.boolean().default(true),
    notes: z.string().nullable().optional(),
    created_by: z.string().nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough()

export const ThirdPartyCcRateHistorySchema = z
  .object({
    id: z.string().uuid().optional(),
    account_id: z.string().uuid('account_id debe ser un UUID válido'),
    effective_from: z.string().trim().min(1, 'La fecha de vigencia es obligatoria'),
    rate_usd_per_kg: z.coerce.number().min(0, 'La tarifa US$/kg no puede ser negativa'),
    notes: z.string().nullable().optional(),
    created_by: z.string().nullable().optional(),
    created_at: z.string().optional(),
  })
  .passthrough()

export const ThirdPartyCcEntrySchema = z
  .object({
    id: z.string().uuid().optional(),
    account_id: z.string().uuid('account_id debe ser un UUID válido'),
    entry_source: z.enum(CC_ENTRY_SOURCES).default('PANOL_REMITO'),
    source_key: z.string().nullable().optional(),
    remito_number: z.string().nullable().optional(),
    entry_date: z.string().trim().min(1, 'La fecha del movimiento es obligatoria'),
    quincena_label: z.string().nullable().optional(),
    weight_kg: z.coerce.number().min(0, 'Los kilos no pueden ser negativos').default(0),
    rate_usd_applied: z.coerce.number().min(0, 'La tarifa aplicada no puede ser negativa').default(0),
    is_special_rate: z.boolean().default(false),
    special_rate_reason: z.string().nullable().optional(),
    amount_usd: z.coerce.number().min(0, 'El monto US$ no puede ser negativo').default(0),
    is_cancelled: z.boolean().default(false),
    cancelled_at: z.string().nullable().optional(),
    is_excluded: z.boolean().default(false),
    third_party_service_id: z.string().uuid().nullable().optional(),
    ship_id: z.string().uuid().nullable().optional(),
    work_order_id: z.string().uuid().nullable().optional(),
    description: z.string().nullable().optional(),
    created_by: z.string().nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough()

export const ThirdPartyCcPaymentSchema = z
  .object({
    id: z.string().uuid().optional(),
    account_id: z.string().uuid('account_id debe ser un UUID válido'),
    payment_date: z.string().trim().min(1, 'La fecha de pago es obligatoria'),
    payment_type: z.enum(CC_PAYMENT_TYPES),
    amount_usd: z.coerce.number().min(0, 'El importe US$ neto no puede ser negativo'),
    amount_ars: z.coerce.number().min(0).nullable().optional(),
    exchange_rate: z.coerce.number().positive('El tipo de cambio debe ser mayor a 0').nullable().optional(),
    has_iva: z.boolean().default(false),
    iva_pct: z.coerce.number().min(0).max(100).default(21),
    gross_usd_with_iva: z.coerce.number().min(0).nullable().optional(),
    has_invoice: z.boolean().default(false),
    invoice_number: z.string().nullable().optional(),
    panol_remito_number: z.string().nullable().optional(),
    source_module: z.enum(CC_SOURCE_MODULES).default('MANUAL'),
    observations: z.string().nullable().optional(),
    created_by: z.string().nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough()
