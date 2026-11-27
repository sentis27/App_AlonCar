-- ==============================================================================
-- ROLLBACK 0059: REVERTIR PERMISO PRIVADO DE "4. RESUMEN HORAS"
-- ==============================================================================

BEGIN;

UPDATE public.organization_roles
   SET allowed_sections = array_remove(allowed_sections, 'horas.resumen_horas')
 WHERE 'horas.resumen_horas' = ANY(coalesce(allowed_sections, ARRAY[]::TEXT[]));

COMMIT;

NOTIFY pgrst, 'reload schema';
