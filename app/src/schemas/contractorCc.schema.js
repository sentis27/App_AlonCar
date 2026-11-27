/**
 * contractorCc.schema.js
 * Contratos Zod para `contractor_cc_movements` (Cuenta Corriente y Pagos de Contratistas)
 * y `contractor_settlement_closures` (Cierres quincenales + observaciones por fila).
 */
import { z } from 'zod'

export const CONTRACTOR_CC_SCOPES = ['HORA', 'PRESUPUESTO', 'GENERAL']
export const CONTRACTOR_CC_DIRECTIONS = ['DEBE', 'HABER']
export const CONTRACTOR_CC_CATEGORIES = [
  'ADELANTO',
  'PAGO_FINAL',
  'RTO_PANOL',
  'GASTO_A_CUENTA',
  'RETENCION',
  'BONIFICACION',
  'DEVENGADO_QUINCENA',
  'DEVENGADO_PRC',
  'AJUSTE',
]
export const CONTRACTOR_CC_PAYMENT_METHODS = [
  'CHEQUE',
  'ECHEQ',
  'TRANSFERENCIA',
  'EFECTIVO_ARS',
  'EFECTIVO_USD',
  'COMPENSACION_PANOL',
  'OTRO',
]
export const CONTRACTOR_CC_INVOICE_STATUSES = [
  'CON_FACTURA',
  'DEBE_FACTURA',
  'SIN_FACTURA',
  'NO_APLICA',
]
export const CONTRACTOR_CC_SOURCES = ['TESORERIA', 'PANOL_SYNC', 'LIQUIDACION_CIERRE']
export const CONTRACTOR_CLOSURE_STATUSES = ['BORRADOR', 'CERRADO', 'PAGADO']

export const ContractorCcMovementSchema = z
  .object({
    id: z.string().uuid().optional(),
    movement_date: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}/, 'movement_date debe iniciar con YYYY-MM-DD'),
    period_key: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-(1Q|2Q)$/, 'period_key debe tener formato YYYY-MM-1Q o 2Q'),
    contractor_worker_id: z.string().uuid('contractor_worker_id debe ser UUID válido').nullable().optional(),
    contractor_group: z.string().trim().min(1, 'El contratista es obligatorio'),
    ship_id: z.string().uuid().nullable().optional(),
    work_order_id: z.string().uuid().nullable().optional(),
    prc_id: z.string().uuid().nullable().optional(),
    prc_number: z.coerce.number().int().min(1).nullable().optional(),
    settlement_scope: z.enum(CONTRACTOR_CC_SCOPES).default('HORA'),
    direction: z.enum(CONTRACTOR_CC_DIRECTIONS).default('DEBE'),
    category: z.enum(CONTRACTOR_CC_CATEGORIES),
    payment_method: z.enum(CONTRACTOR_CC_PAYMENT_METHODS).nullable().optional(),
    payment_reference: z.string().nullable().optional(),
    invoice_status: z.enum(CONTRACTOR_CC_INVOICE_STATUSES).default('NO_APLICA'),
    invoice_number: z.string().nullable().optional(),
    panol_remito_number: z.string().nullable().optional(),
    inventory_transaction_ids: z.array(z.string().uuid()).default([]),
    amount_ars: z.coerce.number().min(0, 'amount_ars no puede ser negativo').default(0),
    amount_usd: z.coerce.number().min(0, 'amount_usd no puede ser negativo').nullable().optional(),
    exchange_rate: z.coerce.number().positive('exchange_rate debe ser mayor a 0').nullable().optional(),
    observations: z.string().nullable().optional(),
    source_module: z.enum(CONTRACTOR_CC_SOURCES).default('TESORERIA'),
    created_by: z.string().nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough()

export const ContractorSettlementClosureSchema = z
  .object({
    id: z.string().uuid().optional(),
    period_key: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-(1Q|2Q)$/, 'period_key debe tener formato YYYY-MM-1Q o 2Q'),
    contractor_group: z.string().trim().min(1, 'El contratista es obligatorio'),
    row_key: z.string().trim().min(1, 'row_key es obligatorio'),
    dollar_rate_materials: z.coerce.number().positive().nullable().optional(),
    hours_total: z.coerce.number().default(0),
    gross_ars: z.coerce.number().default(0),
    materials_ars: z.coerce.number().default(0),
    advances_ars: z.coerce.number().default(0),
    net_payable_ars: z.coerce.number().default(0),
    status: z.enum(CONTRACTOR_CLOSURE_STATUSES).default('BORRADOR'),
    observations: z.string().nullable().optional(),
    snapshot_json: z.any().nullable().optional(),
    closed_by: z.string().nullable().optional(),
    closed_at: z.string().nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough()
