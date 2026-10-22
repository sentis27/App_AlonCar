-- ==============================================================================
-- MIGRATION 0019: Agregar campo info_request_notes en ships
-- Permite a Jorge Sentis (Admin) escribir instrucciones claras y detalladas
-- al solicitar carga de información a María José y a Jefes de Obra.
-- ==============================================================================

ALTER TABLE public.ships ADD COLUMN IF NOT EXISTS info_request_notes TEXT;

COMMENT ON COLUMN public.ships.info_request_notes IS 'Detalle o instrucciones personalizadas de la solicitud de carga (Admin a María José o Jefes de Obra)';
