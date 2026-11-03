-- ==============================================================================
-- MIGRACIÓN 0034: PESO DE MATERIALES, CONTROL DE STOCK FÍSICO Y CENTRO DE COSTO
-- ==============================================================================
-- Propósito:
-- 1. Agregar peso unitario (weight_kg) y flag de control de stock (requires_stock_control) en public.materials.
-- 2. Agregar centro de costo (cost_center: CLIENTE vs CONTRATISTA) y peso total en public.inventory_transactions.
-- 3. Tabla para solicitudes de habilitación de operarios a Jorge Sentis.
-- ==============================================================================

-- 1. EXTENSIÓN DE TABLA MATERIALS
ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(10,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requires_stock_control BOOLEAN DEFAULT true;

-- Actualizar peso referencial para algunos materiales comunes
UPDATE public.materials
SET weight_kg = 5.0
WHERE name ILIKE '%ELECTRODO%' AND weight_kg = 0;

UPDATE public.materials
SET weight_kg = 0.3
WHERE name ILIKE '%DISCO%' AND weight_kg = 0;

UPDATE public.materials
SET weight_kg = 45.0
WHERE name ILIKE '%PROPANO%' OR name ILIKE '%GAS%45%' AND weight_kg = 0;

UPDATE public.materials
SET weight_kg = 60.0
WHERE (name ILIKE '%OXIGENO%' OR name ILIKE '%ACETILENO%') AND weight_kg = 0;

-- 2. EXTENSIÓN DE TABLA INVENTORY_TRANSACTIONS
ALTER TABLE public.inventory_transactions
  ADD COLUMN IF NOT EXISTS cost_center TEXT DEFAULT 'CLIENTE' CHECK (cost_center IN ('CLIENTE', 'CONTRATISTA')),
  ADD COLUMN IF NOT EXISTS weight_total NUMERIC(10,3) DEFAULT 0;

-- 3. TABLA DE SOLICITUDES DE HABILITACIÓN DE OPERARIOS (ALERTA A JORGE SENTIS)
CREATE TABLE IF NOT EXISTS public.worker_permission_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id UUID REFERENCES public.workers(id) ON DELETE CASCADE,
    worker_name TEXT NOT NULL,
    work_group TEXT,
    requested_by UUID REFERENCES public.profiles(id),
    requested_by_name TEXT,
    ship_id UUID REFERENCES public.ships(id),
    reason TEXT,
    status TEXT DEFAULT 'PENDIENTE' CHECK (status IN ('PENDIENTE', 'APROBADA', 'RECHAZADA')),
    created_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.profiles(id)
);

ALTER TABLE public.worker_permission_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access worker_permission_requests" ON public.worker_permission_requests;
CREATE POLICY "Public access worker_permission_requests" ON public.worker_permission_requests FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON public.worker_permission_requests TO anon, authenticated, service_role;
