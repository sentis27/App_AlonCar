-- ==============================================================================
-- ROLLBACK 0054: REVERTIR CUENTAS CORRIENTES DE TALLERES Y SEED DE PRUEBA
-- ==============================================================================

BEGIN;

DROP TABLE IF EXISTS public.third_party_cc_payments CASCADE;
DROP TABLE IF EXISTS public.third_party_cc_entries CASCADE;
DROP TABLE IF EXISTS public.third_party_cc_rate_history CASCADE;
DROP TABLE IF EXISTS public.third_party_cc_accounts CASCADE;

DELETE FROM public.inventory_transactions
 WHERE notes LIKE '%[PRUEBA_CC_PAMPA]%';

UPDATE public.workers
   SET can_withdraw_materials = false,
       updated_at = now()
 WHERE id = '9e19f876-9f0c-4083-b719-472fecd19cd0';

COMMIT;

NOTIFY pgrst, 'reload schema';
