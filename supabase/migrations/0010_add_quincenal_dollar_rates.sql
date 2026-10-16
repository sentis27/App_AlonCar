-- ============================================================
-- ALON CAR ERP - MIGRACIÓN 0010: AJUSTE MANUAL DE DÓLAR POR QUINCENA
-- Permite fijar y ajustar manualmente el tipo de cambio oficial
-- para la 1ª y 2ª quincena de manera independiente, manteniendo
-- la inflación a nivel mensual.
-- ============================================================

ALTER TABLE public.macro_variables 
ADD COLUMN IF NOT EXISTS dollar_rate_1q NUMERIC(10,2);

ALTER TABLE public.macro_variables 
ADD COLUMN IF NOT EXISTS dollar_rate_2q NUMERIC(10,2);

UPDATE public.macro_variables 
SET dollar_rate_1q = dollar_rate 
WHERE dollar_rate_1q IS NULL;

UPDATE public.macro_variables 
SET dollar_rate_2q = dollar_rate 
WHERE dollar_rate_2q IS NULL;
