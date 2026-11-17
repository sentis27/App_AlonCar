-- ==============================================================================
-- MIGRACIÓN 0045: NORMALIZACIÓN DE CLAVES FORÁNEAS RELACIONALES E ÍNDICES
-- ==============================================================================
-- Propósito:
-- 1. Corregir FK errónea labor_logs.worker_id -> public.profiles(id) hacia public.workers(id).
-- 2. Agregar third_party_services.contractor_id -> public.workers(id).
-- 3. Crear tabla puente work_item_contractors (work_item_id, worker_id) con FK, RLS y Realtime.
-- 4. Indexar todas las columnas FK y nombres normalizados para cruces rápidos sin seq-scans.
-- ==============================================================================

BEGIN;

-- 1. Corregir FK de labor_logs.worker_id (antes apuntaba a public.profiles(id))
ALTER TABLE public.labor_logs
  DROP CONSTRAINT IF EXISTS labor_logs_worker_id_fkey;

ALTER TABLE public.labor_logs
  ADD CONSTRAINT labor_logs_worker_id_fkey
  FOREIGN KEY (worker_id) REFERENCES public.workers(id) ON DELETE SET NULL;

-- 2. Agregar contractor_id en third_party_services apuntando a public.workers(id)
ALTER TABLE public.third_party_services
  ADD COLUMN IF NOT EXISTS contractor_id UUID;

ALTER TABLE public.third_party_services
  DROP CONSTRAINT IF EXISTS third_party_services_contractor_id_fkey;

ALTER TABLE public.third_party_services
  ADD CONSTRAINT third_party_services_contractor_id_fkey
  FOREIGN KEY (contractor_id) REFERENCES public.workers(id) ON DELETE SET NULL;

-- 3. Tabla relacional N:M para contratistas asignados a tareas (work_items <-> workers)
CREATE TABLE IF NOT EXISTS public.work_item_contractors (
  work_item_id UUID NOT NULL REFERENCES public.work_items(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (work_item_id, worker_id)
);

ALTER TABLE public.work_item_contractors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access work_item_contractors" ON public.work_item_contractors;
CREATE POLICY "Public access work_item_contractors"
  ON public.work_item_contractors
  FOR ALL
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.work_item_contractors TO anon, authenticated, service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'work_item_contractors'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.work_item_contractors;
  END IF;
END $$;

-- 4. Índices de Foreign Keys y búsquedas por nombre normalizado
CREATE INDEX IF NOT EXISTS idx_labor_logs_worker_id ON public.labor_logs(worker_id);
CREATE INDEX IF NOT EXISTS idx_labor_logs_work_item_id ON public.labor_logs(work_item_id);
CREATE INDEX IF NOT EXISTS idx_gas_mov_worker_id ON public.gas_cylinder_movements(worker_id);
CREATE INDEX IF NOT EXISTS idx_inv_tx_material_id ON public.inventory_transactions(material_id);
CREATE INDEX IF NOT EXISTS idx_inv_tx_work_item_id ON public.inventory_transactions(work_item_id);
CREATE INDEX IF NOT EXISTS idx_tps_contractor_id ON public.third_party_services(contractor_id);
CREATE INDEX IF NOT EXISTS idx_po_material_id ON public.purchase_orders(material_id);
CREATE INDEX IF NOT EXISTS idx_po_requested_by ON public.purchase_orders(requested_by);
CREATE INDEX IF NOT EXISTS idx_po_courier_worker_id ON public.purchase_orders(courier_worker_id);
CREATE INDEX IF NOT EXISTS idx_work_items_work_order_id ON public.work_items(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_item_contractors_worker_id ON public.work_item_contractors(worker_id);
CREATE INDEX IF NOT EXISTS idx_workers_name_lower ON public.workers (lower(trim(name)));
CREATE INDEX IF NOT EXISTS idx_materials_name_lower ON public.materials (lower(trim(name)));

COMMIT;
