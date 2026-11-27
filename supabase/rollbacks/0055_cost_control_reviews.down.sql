-- ==============================================================================
-- ROLLBACK 0055: REVERTIR CONTROL DE GASTOS (`cost_control_reviews` Y SEED)
-- ==============================================================================

BEGIN;

DROP TABLE IF EXISTS public.cost_control_reviews CASCADE;

DELETE FROM public.system_settings
 WHERE key = 'cost_control_excluded_ots';

COMMIT;

NOTIFY pgrst, 'reload schema';
