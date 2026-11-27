-- ==============================================================================
-- ROLLBACK 0058: REVERTIR CUENTA CORRIENTE CONTRATISTAS & CIERRES QUINCENALES
-- ==============================================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'contractor_settlement_closures'
    ) THEN
      ALTER PUBLICATION supabase_realtime DROP TABLE public.contractor_settlement_closures;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'contractor_cc_movements'
    ) THEN
      ALTER PUBLICATION supabase_realtime DROP TABLE public.contractor_cc_movements;
    END IF;
  END IF;
END $$;

DROP TABLE IF EXISTS public.contractor_settlement_closures CASCADE;
DROP TABLE IF EXISTS public.contractor_cc_movements CASCADE;
DROP FUNCTION IF EXISTS public.trg_set_updated_at_contractor_cc();

COMMIT;

NOTIFY pgrst, 'reload schema';
