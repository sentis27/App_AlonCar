-- ==============================================================================
-- MIGRACIÓN 0035: SOLICITUDES DE ELIMINACIÓN DE RETIROS EN PAÑOL (ALERTA ADMIN)
-- ==============================================================================
-- Propósito:
-- Permite a los usuarios marcar una fila de pañol para eliminación.
-- Al marcarse, la fila se pinta de rojo y queda a la espera de confirmación
-- o descarte definitivo exclusivamente por parte del Administrador (Jorge Sentis).
-- ==============================================================================

ALTER TABLE public.inventory_transactions
  ADD COLUMN IF NOT EXISTS is_deletion_requested BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_requested_by TEXT,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_inv_tx_deletion_req ON public.inventory_transactions(is_deletion_requested);
