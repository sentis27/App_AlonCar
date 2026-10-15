-- ============================================================
-- ALON CAR ERP - MIGRACIÓN 0006: PORCENTAJE DE CONSUMIBLES EN WORKERS
-- Permite parametrizar el % de descuento de consumibles a cargo
-- del contratista vs % imputado a cliente/obra.
-- ============================================================

ALTER TABLE public.workers 
ADD COLUMN IF NOT EXISTS consumables_discount_pct NUMERIC(5,2) DEFAULT 100;

-- Actualizar registros existentes según su valor de consumibles
UPDATE public.workers 
SET consumables_discount_pct = CASE 
  WHEN consumables = 'CLIENTE' THEN 0 
  ELSE 100 
END
WHERE consumables_discount_pct IS NULL;
