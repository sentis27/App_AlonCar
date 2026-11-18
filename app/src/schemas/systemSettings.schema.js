/**
 * systemSettings.schema.js
 * Contrato Zod para la tabla `system_settings` (GEMINI.md §3: PK `key`, prohibir trampa `id`).
 */
import { z } from 'zod'

const FORBIDDEN_TRAP_KEYS = ['id']

export const SystemSettingSchema = z
  .object({
    key: z.string().trim().min(1, 'La clave (key) de configuración es obligatoria'),
    value: z.any(),
    updated_at: z.string().optional(),
    updated_by: z.string().nullable().optional(),
  })
  .passthrough()
  .superRefine((val, ctx) => {
    for (const trapKey of FORBIDDEN_TRAP_KEYS) {
      if (trapKey in val) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [trapKey],
          message: `Columna trampa prohibida en system_settings: "${trapKey}". Usar PK "key" (GEMINI.md §3).`,
        })
      }
    }
  })
