-- ==============================================================================
-- ROLLBACK 0052: REVERTIR `work_orders.billing_line_items`, MODO `ITEMS` Y
--                CAMBIOS DE `ot_templates` DE LA MIGRACIÓN 0052
-- ==============================================================================

BEGIN;

-- 1. Reclasificar cualquier OT en modo ITEMS hacia UNITARIO antes de restaurar el CHECK
UPDATE public.work_orders
   SET billing_pricing_mode = 'UNITARIO'
 WHERE billing_pricing_mode = 'ITEMS';

ALTER TABLE public.work_orders
  DROP CONSTRAINT IF EXISTS work_orders_billing_pricing_mode_check;

ALTER TABLE public.work_orders
  ADD CONSTRAINT work_orders_billing_pricing_mode_check
  CHECK (billing_pricing_mode IN ('MO_MAT', 'UNITARIO', 'SIN_CARGO'));

ALTER TABLE public.work_orders
  DROP COLUMN IF EXISTS billing_line_items;

-- 2. Eliminar plantilla `INFORMES TÉCNICOS` solo si no tiene OTs vinculadas
DELETE FROM public.ot_templates t
 WHERE upper(trim(t.name)) IN ('INFORMES TÉCNICOS', 'INFORMES TECNICOS')
   AND NOT EXISTS (SELECT 1 FROM public.work_orders w WHERE w.ot_template_id = t.id);

COMMIT;
