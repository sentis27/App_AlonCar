-- ==============================================================================
-- MIGRACIÓN 0040: TRAZABILIDAD DE INGRESOS/EGRESOS CON EMPRESAS GASERAS
-- ==============================================================================
-- Propósito:
-- 1. Habilitar operaciones de Control de Gases entre Astillero y Empresas Gaseras:
--    - SALDO_INICIAL_PATIO (carga inicial de envases en patio por empresa/gas)
--    - INGRESO_PROVEEDOR (recepción de cilindros desde empresa gasera)
--    - DEVOLUCION_PROVEEDOR (egreso/devolución de envases vacíos o llenos a empresa gasera)
-- 2. Incorporar número de remito, condición física del cilindro (LLENO/VACIO) y responsable.
-- 3. Hacer `contractor_name` nullable para movimientos exclusivos Patio <-> Empresa Gasera.
-- ==============================================================================

ALTER TABLE public.gas_cylinder_movements
  ALTER COLUMN contractor_name DROP NOT NULL;

ALTER TABLE public.gas_cylinder_movements
  ADD COLUMN IF NOT EXISTS remito_number TEXT,
  ADD COLUMN IF NOT EXISTS cylinder_condition TEXT,
  ADD COLUMN IF NOT EXISTS performed_by TEXT;

ALTER TABLE public.gas_cylinder_movements
  DROP CONSTRAINT IF EXISTS gas_cylinder_movements_cylinder_condition_check;

ALTER TABLE public.gas_cylinder_movements
  ADD CONSTRAINT gas_cylinder_movements_cylinder_condition_check
  CHECK (cylinder_condition IS NULL OR cylinder_condition IN ('LLENO', 'VACIO'));

ALTER TABLE public.gas_cylinder_movements
  DROP CONSTRAINT IF EXISTS gas_cylinder_movements_operation_type_check;

ALTER TABLE public.gas_cylinder_movements
  ADD CONSTRAINT gas_cylinder_movements_operation_type_check
  CHECK (operation_type IN (
    'PRIMERA_ENTREGA',
    'RECAMBIO_1X1',
    'DEVOLUCION_FINAL',
    'AJUSTE_PATIO',
    'SALDO_INICIAL_PATIO',
    'INGRESO_PROVEEDOR',
    'DEVOLUCION_PROVEEDOR'
  ));

CREATE INDEX IF NOT EXISTS idx_gas_mov_date_desc
  ON public.gas_cylinder_movements(movement_date DESC);

CREATE INDEX IF NOT EXISTS idx_gas_remito_number
  ON public.gas_cylinder_movements(remito_number)
  WHERE remito_number IS NOT NULL;
