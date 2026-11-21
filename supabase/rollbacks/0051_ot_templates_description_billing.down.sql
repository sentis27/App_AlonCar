-- ==============================================================================
-- ROLLBACK 0051: REVERTIR `ot_templates.description_billing` Y `work_orders.ot_template_id`
-- ==============================================================================

BEGIN;

DROP INDEX IF EXISTS public.idx_work_orders_ot_template_id;

ALTER TABLE public.work_orders
  DROP COLUMN IF EXISTS ot_template_id;

-- Restaurar descripción completa desde `description_billing` antes de eliminar la columna
UPDATE public.ot_templates
   SET description = COALESCE(NULLIF(trim(description_billing), ''), description),
       updated_at = NOW()
 WHERE upper(trim(name)) IN ('CARENADO DE CASCO', 'VALVULAS DE CASCO E INTERMEDIARIAS')
   AND NULLIF(trim(COALESCE(description_billing, '')), '') IS NOT NULL;

ALTER TABLE public.ot_templates
  DROP COLUMN IF EXISTS description_billing;

COMMIT;
