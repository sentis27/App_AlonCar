-- ==============================================================================
-- MIGRACIÓN 0038: REQUISITOS DE CUMPLIMIENTO PARA PAÑOL CENTRAL (ALERTAS ADMIN)
-- ==============================================================================
-- Propósito:
-- Garantizar que las alertas operativas de Pañol (habilitación de operario,
-- apertura de OT y retiro provisorio Sin OT) cuenten con un requirement_id válido
-- en public.data_requirements para cumplir la FK NOT NULL de compliance_alerts.
-- ==============================================================================

INSERT INTO public.data_requirements (
  code,
  module,
  field_key,
  name,
  description,
  trigger_event,
  trigger_condition,
  responsible_role,
  default_notice_time,
  default_notice_frequency,
  max_attempts,
  escalation_role,
  is_active
)
VALUES
  (
    'REQ_PANOL_HABILITACION_OPERARIO',
    'panol',
    'can_withdraw_materials',
    'Solicitud de Habilitación de Operario para Retiro en Pañol (P)',
    'Operario o contratista sin permiso de retiro de materiales requiere autorización de Jorge Sentis en Padrón de Personal.',
    'SOLICITUD_HABILITACION_PANOL',
    '{"permission_field": "can_withdraw_materials"}'::jsonb,
    'admin',
    '09:00:00',
    'DIARIO',
    5,
    'admin',
    true
  ),
  (
    'REQ_PANOL_APERTURA_OT',
    'panol',
    'work_order_id',
    'Solicitud de Apertura o Asignación de OT desde Pañol',
    'Operario o contratista sin OT habilitada en el buque requiere apertura o asignación de Orden de Trabajo.',
    'SOLICITUD_APERTURA_OT_PANOL',
    '{"requires_ot": true}'::jsonb,
    'admin',
    '09:00:00',
    'DIARIO',
    5,
    'admin',
    true
  ),
  (
    'REQ_PANOL_RETIRO_SIN_OT',
    'panol',
    'work_order_id',
    'Retiro de Pañol Registrado Sin OT (Provisorio)',
    'Movimiento de pañol registrado bajo excepción (⚠️ Sin OT) pendiente de imputación a Orden de Trabajo.',
    'RETIRO_PANOL_SIN_OT',
    '{"work_order_id": null}'::jsonb,
    'admin',
    '09:00:00',
    'DIARIO',
    5,
    'admin',
    true
  )
ON CONFLICT (code) DO UPDATE SET
  module = EXCLUDED.module,
  field_key = EXCLUDED.field_key,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  trigger_event = EXCLUDED.trigger_event,
  trigger_condition = EXCLUDED.trigger_condition,
  responsible_role = EXCLUDED.responsible_role,
  is_active = EXCLUDED.is_active,
  updated_at = now();
