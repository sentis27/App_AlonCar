/**
 * profiles.schema.js
 * Contrato Zod para la tabla `profiles` (autenticación y roles en Supabase).
 */
import { z } from 'zod'

export const PROFILE_ROLES = ['Gerencia', 'Supervisor', 'Operario', 'Panolero', 'Admin']

export const ProfileSchema = z
  .object({
    id: z.string().uuid('El id de perfil debe ser un UUID válido'),
    email: z.string().trim().min(1, 'El email de perfil es obligatorio'),
    full_name: z.string().nullable().optional(),
    role: z.enum(PROFILE_ROLES).default('Supervisor'),
    created_at: z.string().optional(),
  })
  .passthrough()
