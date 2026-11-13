-- ==============================================================================
-- MIGRACIÓN 0037: CONTRATOS ASTILLERO, SANEAMIENTO SAFETY_ITEMS & ALERTA VENCIMIENTO
-- ==============================================================================

-- 1. Campos de contrato para personal del Astillero en public.workers
ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS contract_type TEXT,
  ADD COLUMN IF NOT EXISTS contract_start_date DATE;

-- 2. Unificación conceptual de Elementos de Seguridad (safety_items)
--    - Personal propio ASTILLERO -> 'ASTILLERO' (computa solo como ref. interna, sin cobro a obra ni descuento)
--    - Contratistas / Talleres -> 'CONTRATISTA' por defecto (se descuenta al contratista salvo excepción explícita "zona gris" = 'ASTILLERO')
UPDATE public.workers
SET safety_items = 'ASTILLERO'
WHERE UPPER(COALESCE(admin_center, '')) = 'ASTILLERO';

UPDATE public.workers
SET safety_items = 'CONTRATISTA'
WHERE UPPER(COALESCE(admin_center, '')) <> 'ASTILLERO';

-- 3. Registrar requisito automático para María José (7 días antes del vencimiento)
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
VALUES (
  'REQ_PERSONAL_CONTRATO_POR_VENCER',
  'personal',
  'contract_start_date',
  'Vencimiento Próximo de Contrato (Personal Astillero)',
  'Alerta generada 7 días antes del vencimiento de contratos temporales (1 MES, 3 MESES, 6 MESES) para renovación o pase a planta permanente.',
  'CONTRATO_POR_VENCER_7D',
  '{"days_before": 7, "admin_center": "ASTILLERO"}'::jsonb,
  'maria_jose',
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
