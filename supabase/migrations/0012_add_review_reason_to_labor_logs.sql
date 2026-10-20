-- ============================================================
-- ALON CAR ERP - MIGRACIÓN 0012: MOTIVO DE REVISIÓN Y RESPUESTA PARA ESTADO R
-- Agrega soporte para el ciclo de auditoría de horas discrepantes (S -> R -> RR -> RRR)
-- ============================================================

ALTER TABLE public.labor_logs 
ADD COLUMN IF NOT EXISTS review_reason TEXT,
ADD COLUMN IF NOT EXISTS worker_response TEXT;
