-- ==============================================================================
-- MIGRACIÓN 0059: PERMISO PRIVADO PARA SUBMÓDULO "4. RESUMEN HORAS"
-- ==============================================================================
-- Propósito:
--   Conceder acceso explícito (`horas.resumen_horas`) únicamente a
--   ADMIN_GENERAL y LIQUIDACION_SUELDOS (María José), manteniendo oculto
--   el submódulo de liquidación confidencial al resto de los puestos.
-- ==============================================================================

BEGIN;

UPDATE public.organization_roles
   SET allowed_sections = array_append(coalesce(allowed_sections, ARRAY[]::TEXT[]), 'horas.resumen_horas')
 WHERE role_key IN ('ADMIN_GENERAL', 'LIQUIDACION_SUELDOS')
   AND NOT ('horas.resumen_horas' = ANY(coalesce(allowed_sections, ARRAY[]::TEXT[])));

COMMIT;

NOTIFY pgrst, 'reload schema';
