-- ==============================================================================
-- MIGRACIÓN 0039: VÍNCULO DIRECTO RETIRO PAÑOL <-> MOVIMIENTO DE GASES
-- ==============================================================================
-- Propósito:
-- Permitir editar, auditar o eliminar retiros de gases desde Pañol manteniendo
-- sincronizado de forma determinista el movimiento asociado en `gas_cylinder_movements`.
-- ==============================================================================

ALTER TABLE public.gas_cylinder_movements
  ADD COLUMN IF NOT EXISTS inventory_transaction_id UUID
  REFERENCES public.inventory_transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_gas_inv_tx_id
  ON public.gas_cylinder_movements(inventory_transaction_id);
