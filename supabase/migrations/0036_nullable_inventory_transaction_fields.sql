-- ==============================================================================
-- MIGRACIÓN 0036: PERMITIR FILAS VACÍAS EN PLANILLA DE PAÑOL (ESTILO EXCEL)
-- ==============================================================================
-- Propósito:
-- Permite insertar filas completamente en blanco en inventory_transactions
-- donde solo se precarga la fecha de hoy, dejando material_id y quantity_withdrawn
-- como NULL hasta que el usuario cargue los datos mediante doble clic in-situ.
-- ==============================================================================

ALTER TABLE public.inventory_transactions
  ALTER COLUMN material_id DROP NOT NULL,
  ALTER COLUMN quantity_withdrawn DROP NOT NULL;

ALTER TABLE public.inventory_transactions
  ALTER COLUMN quantity_withdrawn SET DEFAULT NULL;
