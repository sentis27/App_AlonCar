-- ==============================================================================
-- MIGRACIÓN 0050: FÓRMULAS ESTILO EXCEL EN CELDAS (`cell_formulas jsonb`)
--                 Y CANTIDAD DECIMAL + FECHA DE CARGA EN `inventory_transactions`
-- ==============================================================================
-- Propósito:
-- 1. Permitir almacenar fórmulas aritméticas originales (`=42+45`, `=1*0.5`, etc.)
--    en `cell_formulas` (jsonb) sin alterar las columnas numéricas calculadas.
-- 2. Ampliar `inventory_transactions.quantity_withdrawn` de `integer` a `numeric`
--    (100% lossless) para soportar áreas decimales de chapas (ej. 1 * 0.5 = 0.5 m²).
-- 3. Agregar `inventory_transactions.created_at` (fecha real de carga en sistema)
--    diferenciada de `transaction_date` (fecha de reporte/movimiento).
-- ==============================================================================

BEGIN;

-- 1. Pañol: quantity_withdrawn numeric + created_at + cell_formulas
ALTER TABLE public.inventory_transactions
  ALTER COLUMN quantity_withdrawn TYPE numeric USING quantity_withdrawn::numeric;

ALTER TABLE public.inventory_transactions
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

UPDATE public.inventory_transactions
   SET created_at = COALESCE(transaction_date, now())
 WHERE created_at IS NULL;

ALTER TABLE public.inventory_transactions
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE public.inventory_transactions
  ADD COLUMN IF NOT EXISTS cell_formulas jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.inventory_transactions
  DROP CONSTRAINT IF EXISTS inventory_transactions_cell_formulas_is_object_check;

ALTER TABLE public.inventory_transactions
  ADD CONSTRAINT inventory_transactions_cell_formulas_is_object_check
  CHECK (jsonb_typeof(cell_formulas) = 'object');

-- 2. Terceros: cell_formulas
ALTER TABLE public.third_party_services
  ADD COLUMN IF NOT EXISTS cell_formulas jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.third_party_services
  DROP CONSTRAINT IF EXISTS third_party_services_cell_formulas_is_object_check;

ALTER TABLE public.third_party_services
  ADD CONSTRAINT third_party_services_cell_formulas_is_object_check
  CHECK (jsonb_typeof(cell_formulas) = 'object');

-- 3. Compras: cell_formulas
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS cell_formulas jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_cell_formulas_is_object_check;

ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_cell_formulas_is_object_check
  CHECK (jsonb_typeof(cell_formulas) = 'object');

-- 4. Horas: cell_formulas
ALTER TABLE public.labor_logs
  ADD COLUMN IF NOT EXISTS cell_formulas jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.labor_logs
  DROP CONSTRAINT IF EXISTS labor_logs_cell_formulas_is_object_check;

ALTER TABLE public.labor_logs
  ADD CONSTRAINT labor_logs_cell_formulas_is_object_check
  CHECK (jsonb_typeof(cell_formulas) = 'object');

COMMIT;
