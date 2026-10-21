-- ============================================================================
-- Migración 0016: Cronología de 3 Fechas en OT (Creación, Inicio Real, Fin Real),
-- Separación/Independización de Trabajos de Contenedor OT, y Filtrado en Cascada
-- ============================================================================

-- 1. Asegurar columna service_date en third_party_services para el cálculo de Fecha Inicio y Fecha Fin
ALTER TABLE public.third_party_services
  ADD COLUMN IF NOT EXISTS service_date DATE DEFAULT CURRENT_DATE;

UPDATE public.third_party_services
SET service_date = (created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE
WHERE service_date IS NULL;

-- 2. Vincular opcionalmente labor_logs e inventory_transactions a work_items para arrastrar costos al separar un trabajo de una OT
ALTER TABLE public.labor_logs
  ADD COLUMN IF NOT EXISTS work_item_id UUID REFERENCES public.work_items(id) ON DELETE SET NULL;

ALTER TABLE public.inventory_transactions
  ADD COLUMN IF NOT EXISTS work_item_id UUID REFERENCES public.work_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contractor_name TEXT;

-- 3. Asegurar políticas RLS de lectura/escritura en inventory_transactions para cálculo de fechas en OTs
DROP POLICY IF EXISTS "Allow full access inventory_transactions" ON public.inventory_transactions;
CREATE POLICY "Allow full access inventory_transactions"
  ON public.inventory_transactions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. Sincronizar Jefes de Obra iniciales en organization_roles (Gobierno / Operaciones)
INSERT INTO public.organization_roles (
  role_key, role_title, holder_name, department, security_level, allowed_sections, status, notes
)
VALUES
  ('JEFE_OBRA_ALE_CAMADELLI', 'Jefe de Obra Naval', 'ALE CAMADELLI', 'Operaciones', 'SUPERVISOR', ARRAY['barcos', 'ots', 'horas', 'panol'], 'ACTIVO', 'Jefe de Obra sincronizado desde Padrón y OTs'),
  ('JEFE_OBRA_PABLO_N', 'Jefe de Obra Naval', 'PABLO N.', 'Operaciones', 'SUPERVISOR', ARRAY['barcos', 'ots', 'horas', 'panol'], 'ACTIVO', 'Jefe de Obra sincronizado desde Padrón y OTs'),
  ('JEFE_OBRA_MARTIN_OBREGOZO', 'Jefe de Obra Naval', 'MARTIN OBREGOZO', 'Operaciones', 'SUPERVISOR', ARRAY['barcos', 'ots', 'horas', 'panol'], 'ACTIVO', 'Jefe de Obra sincronizado desde Padrón y OTs')
ON CONFLICT (role_key) DO NOTHING;
