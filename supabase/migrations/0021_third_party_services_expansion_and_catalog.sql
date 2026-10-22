-- ==============================================================================
-- MIGRACIÓN 0021: MÓDULO DE TERCEROS (GS-005) - CICLO DE COMPROBANTES, AUDITORÍA
-- Y CATÁLOGO DE CONTRATISTAS / TALLERES (SIN CARGA DE MATERIALES NI HORAS)
-- ==============================================================================

-- 1. Asegurar que work_item_id sea nullable pero tenga constraint UNIQUE para soportar upsert desde OTs
ALTER TABLE public.third_party_services
  ALTER COLUMN work_item_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'third_party_services_work_item_id_key'
  ) THEN
    ALTER TABLE public.third_party_services ADD CONSTRAINT third_party_services_work_item_id_key UNIQUE (work_item_id);
  END IF;
END $$;

-- 2. Ampliar campos de comprobantes, fechas, dólares congelados, locación y auditoría
ALTER TABLE public.third_party_services
  ADD COLUMN IF NOT EXISTS entry_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS voucher_date DATE,
  ADD COLUMN IF NOT EXISTS service_location TEXT DEFAULT 'PLANTA',
  ADD COLUMN IF NOT EXISTS internal_remito_number TEXT,
  ADD COLUMN IF NOT EXISTS trade TEXT,
  ADD COLUMN IF NOT EXISTS usd_rate NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_usd NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS audit_status TEXT DEFAULT 'PENDIENTE',
  ADD COLUMN IF NOT EXISTS audit_notes TEXT,
  ADD COLUMN IF NOT EXISTS audited_by TEXT,
  ADD COLUMN IF NOT EXISTS audited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- 3. Tabla de trazabilidad e historial de evolución de comprobantes (RMO->FCR, RPF->FCR, etc.)
CREATE TABLE IF NOT EXISTS public.third_party_voucher_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  third_party_service_id UUID REFERENCES public.third_party_services(id) ON DELETE CASCADE,
  from_voucher_type TEXT,
  to_voucher_type TEXT,
  from_amount_ars NUMERIC,
  to_amount_ars NUMERIC,
  voucher_number TEXT,
  notes TEXT,
  changed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.third_party_voucher_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'third_party_voucher_history' AND policyname = 'Permitir acceso total a historial comprobantes'
  ) THEN
    CREATE POLICY "Permitir acceso total a historial comprobantes" 
      ON public.third_party_voucher_history FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
