-- ==============================================================================
-- ROLLBACK 0050: REVERTIR `cell_formulas` EN 4 TABLAS Y `created_at` EN PAÑOL
-- Nota: `quantity_withdrawn` se mantiene en `numeric` para evitar pérdida de
-- decimales ya cargados en producción.
-- ==============================================================================

BEGIN;

ALTER TABLE public.labor_logs
  DROP CONSTRAINT IF EXISTS labor_logs_cell_formulas_is_object_check,
  DROP COLUMN IF EXISTS cell_formulas;

ALTER TABLE public.purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_cell_formulas_is_object_check,
  DROP COLUMN IF EXISTS cell_formulas;

ALTER TABLE public.third_party_services
  DROP CONSTRAINT IF EXISTS third_party_services_cell_formulas_is_object_check,
  DROP COLUMN IF EXISTS cell_formulas;

ALTER TABLE public.inventory_transactions
  DROP CONSTRAINT IF EXISTS inventory_transactions_cell_formulas_is_object_check,
  DROP COLUMN IF EXISTS cell_formulas,
  DROP COLUMN IF EXISTS created_at;

COMMIT;
