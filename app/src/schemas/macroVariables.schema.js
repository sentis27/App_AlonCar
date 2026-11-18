/**
 * macroVariables.schema.js
 * Contrato Zod para la tabla `macro_variables` (Variables Macroeconómicas Mensuales).
 */
import { z } from 'zod'

export const MacroVariableSchema = z
  .object({
    id: z.string().uuid().optional(),
    year: z.coerce.number().int().min(2020, 'Año inválido').max(2100),
    month: z.coerce.number().int().min(1, 'Mes debe ser 1..12').max(12, 'Mes debe ser 1..12'),
    dollar_rate: z.coerce.number().positive('dollar_rate debe ser mayor a 0'),
    dollar_rate_1q: z.coerce.number().positive('dollar_rate_1q debe ser mayor a 0').nullable().optional(),
    dollar_rate_2q: z.coerce.number().positive('dollar_rate_2q debe ser mayor a 0').nullable().optional(),
    monthly_inflation_pct: z.coerce.number().default(0),
    is_locked_1q: z.boolean().optional(),
    is_locked_2q: z.boolean().optional(),
    notes: z.string().nullable().optional(),
    updated_by: z.string().nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough()
