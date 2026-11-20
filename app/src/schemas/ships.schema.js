/**
 * ships.schema.js
 * Contratos Zod para `ships`, `ship_stays`, `owners`, `ship_documents` y `contacts`.
 */
import { z } from 'zod'

export const ShipSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1, 'El nombre del buque es obligatorio'),
    client_name: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    owner_id: z.string().uuid().nullable().optional(),
    imo_number: z.string().nullable().optional(),
    matricula: z.string().nullable().optional(),
    vessel_type: z.string().nullable().optional(),
    eslora_mts: z.coerce.number().min(0).nullable().optional(),
    manga_mts: z.coerce.number().min(0).nullable().optional(),
    puntal_mts: z.coerce.number().min(0).nullable().optional(),
    superficie_casco_m2: z.coerce.number().min(0).nullable().optional(),
    technical_specs: z.any().optional(),
    current_location: z.string().nullable().optional(),
    info_request_status: z.string().nullable().optional(),
    info_requested_at: z.string().nullable().optional(),
    info_requested_by: z.string().nullable().optional(),
    info_request_notes: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    is_active: z.boolean().optional(),
    orphan_owner_alert: z.boolean().optional(),
    orphan_owner_previous_name: z.string().nullable().optional(),
    plan_anguilera_url: z.string().nullable().optional(),
    plan_anguilera_name: z.string().nullable().optional(),
    plan_anguilera_uploaded_at: z.string().nullable().optional(),
    informe_pintado_url: z.string().nullable().optional(),
    informe_pintado_name: z.string().nullable().optional(),
    informe_pintado_uploaded_at: z.string().nullable().optional(),
    billing_workspace_status: z.enum(['NONE', 'EN_PREPARACION', 'ENVIADO_A_FACTURACION']).optional(),
    billing_opened_at: z.string().nullable().optional(),
    billing_sent_at: z.string().nullable().optional(),
    billing_sent_by: z.string().nullable().optional(),
    billing_budget_number: z.string().nullable().optional(),
    billing_total_snapshot_usd: z.coerce.number().nullable().optional(),
    billing_layout_meta: z.any().optional(),
    created_at: z.string().optional(),
  })
  .passthrough()

export const ShipStaySchema = z
  .object({
    id: z.string().uuid().optional(),
    ship_id: z.string().uuid('ship_id debe ser un UUID válido'),
    location: z.string().trim().min(1, 'La ubicación de estadía es obligatoria'),
    start_date: z.string().trim().min(1, 'La fecha de inicio es obligatoria'),
    end_date: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    registered_by: z.string().nullable().optional(),
    created_at: z.string().optional(),
  })
  .passthrough()

export const OwnerSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1, 'La Razón Social / Armador es obligatoria'),
    cuit: z.string().nullable().optional(),
    armador_name: z.string().nullable().optional(),
    armador_phone: z.string().nullable().optional(),
    email_principal: z.string().nullable().optional(),
    email_secundario: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    is_active: z.boolean().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough()

export const ShipDocumentSchema = z
  .object({
    id: z.string().uuid().optional(),
    ship_id: z.string().uuid('ship_id debe ser un UUID válido'),
    doc_type: z.string().trim().min(1),
    title: z.string().trim().min(1),
    file_name: z.string().trim().min(1),
    file_url: z.string().trim().min(1),
    file_size_bytes: z.coerce.number().min(0).optional(),
    uploaded_by: z.string().nullable().optional(),
    created_at: z.string().optional(),
  })
  .passthrough()

export const ContactSchema = z
  .object({
    id: z.string().uuid().optional(),
    owner_id: z.string().uuid().nullable().optional(),
    ship_id: z.string().uuid().nullable().optional(),
    name: z.string().trim().min(1, 'El nombre del contacto es obligatorio'),
    role: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    created_at: z.string().optional(),
  })
  .passthrough()
