/**
 * rateCards.schema.js
 * Contrato Zod para la tabla `rate_cards` (Tarifario Quincenal — GEMINI.md §3).
 */
import { z } from 'zod'

export const RateCardSchema = z
  .object({
    id: z.string().uuid().optional(),
    period: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-[12]Q$/, 'El período debe respetar el formato YYYY-MM-1Q o YYYY-MM-2Q'),
    year: z.coerce.number().int().min(2020).max(2100),
    month: z.coerce.number().int().min(1).max(12),
    quincena: z.coerce.number().int().refine((v) => v === 1 || v === 2, {
      message: 'La quincena debe ser 1 o 2',
    }),
    admin_center: z.string().trim().min(1, 'admin_center es obligatorio'),
    entity_name: z.string().trim().min(1, 'entity_name es obligatorio'),
    rate_oficial_ars: z.coerce.number().min(0, 'rate_oficial_ars no puede ser negativo'),
    rate_oficial_usd: z.coerce.number().min(0, 'rate_oficial_usd no puede ser negativo'),
    has_ayudante: z.boolean().default(false),
    rate_ayudante_ars: z.coerce.number().min(0).nullable().optional(),
    rate_ayudante_usd: z.coerce.number().min(0).nullable().optional(),
    dollar_rate: z.coerce.number().positive('dollar_rate debe ser mayor a 0'),
    monthly_inflation_pct: z.coerce.number().default(0),
    is_locked: z.boolean().default(false),
    notes: z.string().nullable().optional(),
    updated_by: z.string().nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough()
