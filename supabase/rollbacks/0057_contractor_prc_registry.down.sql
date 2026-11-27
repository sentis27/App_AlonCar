-- ==============================================================================
-- ROLLBACK 0057: REVERTIR BASE DE DATOS ÚNICA DE PRC DE CONTRATISTAS
-- ==============================================================================

BEGIN;

UPDATE public.organization_roles
   SET allowed_sections = array_remove(allowed_sections, 'terceros.base_prc')
 WHERE 'terceros.base_prc' = ANY(coalesce(allowed_sections, ARRAY[]::TEXT[]));

DROP FUNCTION IF EXISTS public.issue_contractor_prc(
  TEXT, UUID, UUID, UUID, UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, DATE, UUID, TEXT, TEXT, TEXT
);
DROP FUNCTION IF EXISTS public.peek_next_contractor_prc_number();

DROP TABLE IF EXISTS public.contractor_prc_registry CASCADE;
DROP FUNCTION IF EXISTS public.trg_contractor_prc_immutable_guard();
DROP SEQUENCE IF EXISTS public.contractor_prc_number_seq;

COMMIT;

NOTIFY pgrst, 'reload schema';
