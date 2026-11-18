/**
 * organizationRoles.schema.js
 * Contrato Zod para la tabla `organization_roles` (GEMINI.md §3: PK `role_key`, prohibir trampa `id`).
 */
import { z } from 'zod'

const FORBIDDEN_TRAP_KEYS = ['id']

export const OrganizationRoleSchema = z
  .object({
    role_key: z.string().trim().min(1, 'role_key es obligatorio'),
    role_title: z.string().trim().min(1, 'role_title es obligatorio'),
    holder_name: z.string().nullable().optional(),
    department: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    allowed_sections: z.array(z.string()).nullable().optional(),
    security_level: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    job_mission: z.string().nullable().optional(),
    key_responsibilities: z.any().optional(),
    departmental_links: z.any().optional(),
    reports_to: z.string().nullable().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough()
  .superRefine((val, ctx) => {
    for (const trapKey of FORBIDDEN_TRAP_KEYS) {
      if (trapKey in val) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [trapKey],
          message: `Columna trampa prohibida en organization_roles: "${trapKey}". Usar PK "role_key" (GEMINI.md §3).`,
        })
      }
    }
  })
