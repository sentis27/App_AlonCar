-- ==============================================================================
-- MIGRACIÓN 0043: ALINEACIÓN RLS DE LABOR_LOGS Y WORK_ORDERS
-- ==============================================================================
-- Propósito:
-- 1. Alinear las políticas RLS de public.labor_logs y public.work_orders con el
--    resto de tablas operativas del ERP (materials, material_rubros, suppliers,
--    workers, ships, etc.) para permitir lectura, inserción y edición tanto con
--    sesión Supabase Auth como con sesión operativa local (Ingreso Directo / anon).
-- ==============================================================================

-- 1. LABOR_LOGS RLS ALIGNMENT
ALTER TABLE public.labor_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read labor_logs" ON public.labor_logs;
DROP POLICY IF EXISTS "Allow authenticated insert labor_logs" ON public.labor_logs;
DROP POLICY IF EXISTS "Allow authenticated update labor_logs" ON public.labor_logs;
DROP POLICY IF EXISTS "Allow authenticated delete labor_logs" ON public.labor_logs;
DROP POLICY IF EXISTS "Public access labor_logs" ON public.labor_logs;

CREATE POLICY "Public access labor_logs"
  ON public.labor_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.labor_logs TO anon, authenticated, service_role;

-- 2. WORK_ORDERS RLS ALIGNMENT
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon read work_orders" ON public.work_orders;
DROP POLICY IF EXISTS "Allow authenticated read work_orders" ON public.work_orders;
DROP POLICY IF EXISTS "Allow authenticated insert work_orders" ON public.work_orders;
DROP POLICY IF EXISTS "Allow authenticated update work_orders" ON public.work_orders;
DROP POLICY IF EXISTS "Public access work_orders" ON public.work_orders;

CREATE POLICY "Public access work_orders"
  ON public.work_orders
  FOR ALL
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.work_orders TO anon, authenticated, service_role;
