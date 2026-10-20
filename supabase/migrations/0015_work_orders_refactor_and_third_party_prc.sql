-- ============================================================================
-- Migración 0015: Refactor de Órdenes de Trabajo (GS-003), Permiso "3ros" y
-- Jefes de Obra en Padrón (workers), y Tabla de Terceros con Doble Observación
-- ============================================================================

-- 1. Limpiar las 4 OTs de prueba (OT-101 a OT-104)
ALTER TABLE public.labor_logs ALTER COLUMN work_order_id DROP NOT NULL;

UPDATE public.labor_logs
SET work_order_id = NULL
WHERE work_order_id IN (
  SELECT id FROM public.work_orders WHERE ot_number IN ('OT-101', 'OT-102', 'OT-103', 'OT-104')
);

UPDATE public.inventory_transactions
SET work_order_id = NULL
WHERE work_order_id IN (
  SELECT id FROM public.work_orders WHERE ot_number IN ('OT-101', 'OT-102', 'OT-103', 'OT-104')
);

UPDATE public.purchase_documents
SET work_order_id = NULL
WHERE work_order_id IN (
  SELECT id FROM public.work_orders WHERE ot_number IN ('OT-101', 'OT-102', 'OT-103', 'OT-104')
);

DELETE FROM public.work_orders
WHERE ot_number IN ('OT-101', 'OT-102', 'OT-103', 'OT-104');

-- Ajustar numeración por barco de OTs remanentes
UPDATE public.work_orders
SET ot_number = 'OT-1'
WHERE ot_number = 'OT-105';

-- 2. Agregar permiso "3ros" (can_charge_third_party) y marca "Jefe de Obra" (is_foreman) en workers
ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS can_charge_third_party BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_foreman BOOLEAN DEFAULT false;

-- Habilitar "3ros" por defecto para Contratistas y Talleres externos (Astillero propio queda en false)
UPDATE public.workers
SET can_charge_third_party = true
WHERE admin_center IN ('CONTRATISTA', 'TALLER');

-- Marcar Jefes de Obra existentes en el Padrón (Ale, Pablo, Martín) y asegurar a Hugo Obregozo
UPDATE public.workers
SET is_foreman = true
WHERE name IN ('ALE CAMADELLI', 'PABLO N.', 'MARTIN OBREGOZO');

INSERT INTO public.workers (
  name, work_group, trade, admin_center, consumables, consumables_discount_pct,
  safety_items, status, hourly_rate_ars, hourly_rate_usd, category,
  can_withdraw_materials, can_impute_hours, can_charge_third_party, is_foreman
)
SELECT
  'HUGO OBREGOZO', 'ASTILLERO', 'TECNICOS', 'ASTILLERO', 'CLIENTE', 0,
  'ASTILLERO', 'ACTIVO', 0, 0, '',
  true, true, false, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.workers WHERE UPPER(name) LIKE '%HUGO OBREGOZO%' OR (UPPER(name) = 'HUGO' AND admin_center = 'ASTILLERO')
);

-- 3. Extender work_orders y work_items según GS-003 (UNIFICADO)
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS is_tabulated BOOLEAN DEFAULT false;

ALTER TABLE public.work_items
  ADD COLUMN IF NOT EXISTS contractors TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS foreman_name TEXT,
  ADD COLUMN IF NOT EXISTS work_type TEXT DEFAULT 'HORA',
  ADD COLUMN IF NOT EXISTS assignment_type TEXT DEFAULT 'Presupuesto General',
  ADD COLUMN IF NOT EXISTS specific_budget_id TEXT,
  ADD COLUMN IF NOT EXISTS comments TEXT,
  ADD COLUMN IF NOT EXISTS voucher_type TEXT,
  ADD COLUMN IF NOT EXISTS voucher_number TEXT,
  ADD COLUMN IF NOT EXISTS send_to_third_party_prc BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Si existe alguna OT sin work_items aún, migrar su descripción inicial a su primer work_item
INSERT INTO public.work_items (
  work_order_id, description, status, contractors, foreman_name, work_type, assignment_type, specific_budget_id
)
SELECT
  wo.id,
  COALESCE(wo.description, ''),
  'En ejecución',
  CASE WHEN wo.contractor_name IS NOT NULL AND wo.contractor_name <> '' THEN ARRAY[wo.contractor_name] ELSE '{}'::TEXT[] END,
  COALESCE(wo.foreman_name, 'ALE CAMADELLI'),
  COALESCE(wo.work_type, 'HORA'),
  COALESCE(wo.assignment_type, 'Presupuesto General'),
  wo.budget_code
FROM public.work_orders wo
WHERE NOT EXISTS (
  SELECT 1 FROM public.work_items wi WHERE wi.work_order_id = wo.id
);

-- 4. Crear tabla third_party_services (Módulo de Terceros con Doble Observación: Directas y Específicas)
CREATE TABLE IF NOT EXISTS public.third_party_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_item_id UUID UNIQUE REFERENCES public.work_items(id) ON DELETE CASCADE,
  work_order_id UUID REFERENCES public.work_orders(id) ON DELETE CASCADE,
  ship_id UUID REFERENCES public.ships(id) ON DELETE CASCADE,
  contractor_name TEXT NOT NULL,
  status TEXT DEFAULT 'PRC',
  voucher_type TEXT DEFAULT 'PRC',
  voucher_number TEXT,
  amount_ars NUMERIC DEFAULT 0,
  direct_observations TEXT,
  specific_observations TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.third_party_services ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'third_party_services' AND policyname = 'Allow full access to third_party_services'
  ) THEN
    CREATE POLICY "Allow full access to third_party_services"
      ON public.third_party_services
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
