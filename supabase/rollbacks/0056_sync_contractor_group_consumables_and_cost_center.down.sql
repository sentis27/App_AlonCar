-- ==============================================================================
-- ROLLBACK 0056: SANEAMIENTO GRUPAL DE CONSUMIBLES Y COST_CENTER
-- ==============================================================================
-- Nota: la migración 0056 ejecuta únicamente saneamiento idempotente de datos sin
-- cambios de DDL (sin tablas ni columnas nuevas). Este rollback limpia la entrada
-- de trazabilidad correspondiente en audit_logs.
-- ==============================================================================

BEGIN;

DELETE FROM public.audit_logs
 WHERE entity_id = '0056_consumables_sync'
   AND action = 'MIGRATION_0056_SYNC';

COMMIT;

NOTIFY pgrst, 'reload schema';
