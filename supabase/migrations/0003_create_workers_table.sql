-- ============================================================
-- ALON CAR ERP - MIGRACIÓN 0003: TABLA DE PERSONAL Y GRUPOS
-- Correspondiente a GS-008: B.D.NewSystemm
-- ============================================================

CREATE TABLE IF NOT EXISTS public.workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  work_group TEXT NOT NULL,
  trade TEXT,
  admin_center TEXT NOT NULL DEFAULT 'ASTILLERO',
  consumables TEXT DEFAULT 'CLIENTE',
  safety_items TEXT DEFAULT 'CONTRATISTA',
  status TEXT DEFAULT 'ACTIVO',
  hourly_rate_ars NUMERIC(12,2) DEFAULT 0,
  hourly_rate_usd NUMERIC(10,2) DEFAULT 0,
  category TEXT,
  can_withdraw_materials BOOLEAN DEFAULT TRUE,
  can_impute_hours BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Políticas RLS
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access workers" ON public.workers;
CREATE POLICY "Public access workers" ON public.workers FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.workers TO anon, authenticated, service_role;
