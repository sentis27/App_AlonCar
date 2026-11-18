/**
 * auditLogs.schema.js
 * Contrato Zod para `audit_logs` (GEMINI.md §3: bloquea columnas trampa `entity` y `table_name`).
 */
import { z } from 'zod'

const FORBIDDEN_AUDIT_TRAP_KEYS = ['entity', 'table_name']

export const AuditLogSchema = z
  .object({
    id: z.string().uuid().optional(),
    action: z.string().trim().min(1, 'action es obligatorio'),
    entity_type: z.string().trim().min(1, 'entity_type es obligatorio'),
    entity_id: z.string().trim().min(1, 'entity_id es obligatorio'),
    entity_name: z.string().nullable().optional(),
    details: z.any().optional(),
    performed_by: z.string().nullable().optional(),
    created_at: z.string().optional(),
  })
  .passthrough()
  .superRefine((val, ctx) => {
    for (const trapKey of FORBIDDEN_AUDIT_TRAP_KEYS) {
      if (trapKey in val) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [trapKey],
          message: `Columna trampa prohibida en audit_logs: "${trapKey}". Usar "entity_type" (GEMINI.md §3).`,
        })
      }
    }
  })
