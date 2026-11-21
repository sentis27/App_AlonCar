/**
 * otTemplates.schema.js
 * Contrato Zod para la tabla `ot_templates` (Catálogo OT.ABC).
 */
import { z } from 'zod'

export const OtTemplateSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1, 'El nombre de la plantilla OT.ABC es obligatorio'),
    description: z.string().nullable().optional(),
    description_billing: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    sort_order: z.coerce.number().int().min(0).optional(),
    fixed_notes: z.string().nullable().optional(),
    default_tax_type: z.string().nullable().optional(),
    default_data_source: z.string().nullable().optional(),
    line_items: z.any().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough()
