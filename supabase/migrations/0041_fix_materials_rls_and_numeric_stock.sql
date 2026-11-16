-- ==============================================================================
-- MIGRACIÓN 0041: ALINEACIÓN RLS DE MATERIALES Y SOPORTE DE STOCK DECIMAL
-- ==============================================================================
-- Propósito:
-- 1. Alinear las políticas RLS de public.materials con el resto de tablas operativas
--    del ERP (material_rubros, suppliers, workers, ships, gas_cylinder_movements)
--    para permitir lectura y alta/edición tanto con sesión Supabase Auth como con
--    sesión operativa local (Ingreso Directo).
-- 2. Convertir current_stock y minimum_stock de INTEGER a NUMERIC(12,3) para admitir
--    cantidades con decimales (kg, metros, m2, litros) congruentes con step="any".
-- ==============================================================================

-- 1. POLÍTICAS DE ACCESO UNIFICADAS EN PUBLIC.MATERIALS
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read materials" ON public.materials;
DROP POLICY IF EXISTS "Allow authenticated write materials" ON public.materials;
DROP POLICY IF EXISTS "Public access materials" ON public.materials;

CREATE POLICY "Public access materials"
  ON public.materials
  FOR ALL
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.materials TO anon, authenticated, service_role;

-- 2. SOPORTE DE STOCK CON DECIMALES (KG, METROS, LITROS, M2)
ALTER TABLE public.materials
  ALTER COLUMN current_stock TYPE NUMERIC(12,3) USING COALESCE(current_stock, 0)::NUMERIC(12,3),
  ALTER COLUMN current_stock SET DEFAULT 0,
  ALTER COLUMN minimum_stock TYPE NUMERIC(12,3) USING COALESCE(minimum_stock, 0)::NUMERIC(12,3),
  ALTER COLUMN minimum_stock SET DEFAULT 0;
