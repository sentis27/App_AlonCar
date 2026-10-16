-- ============================================================
-- ALON CAR ERP - MIGRACIÓN 0009: CONTROL DE BLOQUEO QUINCENAL EN MACRO VARIABLES
-- Agrega columnas is_locked_1q e is_locked_2q para permitir bloquear e inmutabilizar
-- quincenas a nivel macroeconómico incluso antes de asignar planillas de mano de obra.
-- ============================================================

ALTER TABLE public.macro_variables 
ADD COLUMN IF NOT EXISTS is_locked_1q BOOLEAN DEFAULT false;

ALTER TABLE public.macro_variables 
ADD COLUMN IF NOT EXISTS is_locked_2q BOOLEAN DEFAULT false;
