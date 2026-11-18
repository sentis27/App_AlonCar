/**
 * aiGovernance.schema.js
 * Contratos Zod para `system_prompts` (PK `slug`) y `ai_processing_logs`.
 */
import { z } from 'zod'

export const SystemPromptSchema = z
  .object({
    slug: z.string().trim().min(1, 'El slug del prompt es obligatorio'),
    title: z.string().trim().min(1, 'El título del prompt es obligatorio'),
    category: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    prompt_template: z.string().min(1, 'prompt_template es obligatorio'),
    version: z.string().optional(),
    model: z.string().optional(),
    temperature: z.coerce.number().min(0).max(2).optional(),
    is_active: z.boolean().optional(),
    updated_by: z.string().nullable().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough()

export const AiProcessingLogSchema = z
  .object({
    id: z.string().uuid().optional(),
    mensaje_id: z.string().trim().min(1, 'mensaje_id es obligatorio'),
    fecha_procesamiento: z.string().optional(),
    fecha_reportada: z.string().nullable().optional(),
    usuario_emisor: z.string().nullable().optional(),
    mensaje_literal: z.string().optional(),
    canal_detectado: z.string().optional(),
    engine_used: z.string().optional(),
    prompt_version: z.string().optional(),
    total_filas: z.coerce.number().int().min(0).optional(),
    filas_review: z.coerce.number().int().min(0).optional(),
    tokens_in: z.coerce.number().int().min(0).optional(),
    tokens_out: z.coerce.number().int().min(0).optional(),
    resumen_agente: z.string().nullable().optional(),
    raw_output: z.any().optional(),
    created_at: z.string().optional(),
  })
  .passthrough()
