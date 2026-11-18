/**
 * complianceAlerts.schema.js
 * Contratos Zod para `data_requirements`, `compliance_alerts` y `worker_permission_requests`.
 */
import { z } from 'zod'

export const DataRequirementSchema = z
  .object({
    id: z.string().uuid().optional(),
    code: z.string().trim().min(1),
    module: z.string().trim().min(1),
    field_key: z.string().trim().min(1),
    name: z.string().trim().min(1),
    description: z.string().nullable().optional(),
    trigger_event: z.string().trim().min(1),
    trigger_condition: z.any().optional(),
    responsible_role: z.string().trim().min(1),
    default_worker_id: z.string().uuid().nullable().optional(),
    default_phone: z.string().nullable().optional(),
    default_notice_time: z.string().optional(),
    default_notice_frequency: z.string().optional(),
    max_attempts: z.coerce.number().int().min(1).optional(),
    escalation_role: z.string().nullable().optional(),
    is_active: z.boolean().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough()

export const ComplianceAlertSchema = z
  .object({
    id: z.string().uuid().optional(),
    requirement_id: z.string().uuid('requirement_id debe ser un UUID válido'),
    ship_id: z.string().uuid().nullable().optional(),
    entity_type: z.string().trim().min(1),
    entity_id: z.string().trim().min(1),
    responsible_worker_id: z.string().uuid().nullable().optional(),
    responsible_role: z.string().trim().min(1),
    recipient_phone: z.string().nullable().optional(),
    notice_time: z.string().optional(),
    notice_frequency: z.string().optional(),
    notices_sent_count: z.coerce.number().int().min(0).optional(),
    max_attempts: z.coerce.number().int().min(1).optional(),
    last_notice_sent_at: z.string().nullable().optional(),
    next_notice_scheduled_at: z.string().nullable().optional(),
    status: z.string().trim().min(1).default('PENDIENTE'),
    alert_message: z.string().nullable().optional(),
    completed_at: z.string().nullable().optional(),
    completed_by: z.string().nullable().optional(),
    escalated_to_admin: z.boolean().optional(),
    escalated_at: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough()

export const WorkerPermissionRequestSchema = z
  .object({
    id: z.string().uuid().optional(),
    worker_id: z.string().uuid(),
    worker_name: z.string().trim().min(1),
    work_group: z.string().nullable().optional(),
    requested_by: z.string().uuid().nullable().optional(),
    requested_by_name: z.string().nullable().optional(),
    ship_id: z.string().uuid().nullable().optional(),
    reason: z.string().nullable().optional(),
    status: z.string().trim().min(1).default('PENDIENTE'),
    resolved_at: z.string().nullable().optional(),
    resolved_by: z.string().uuid().nullable().optional(),
    created_at: z.string().optional(),
  })
  .passthrough()
