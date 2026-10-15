-- ============================================================
-- ALON CAR ERP - MIGRACIÓN 0004: TARIFARIO QUINCENAL (HISTÓRICO)
-- Soporta carga unificada de Astillero (5 categorías sindicales)
-- y Contratistas (Oficial y Ayudante si aplica, bloqueado si no).
-- Responsables: Carga María José / Negociación Hugo Obregozo.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rate_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period TEXT NOT NULL,                  -- ej: '2026-10-1Q', '2026-10-2Q'
  year INTEGER NOT NULL,                 -- ej: 2026
  month INTEGER NOT NULL,                -- 1..12
  quincena INTEGER NOT NULL,             -- 1 o 2
  admin_center TEXT NOT NULL,            -- 'ASTILLERO' | 'CONTRATISTA'
  entity_name TEXT NOT NULL,             -- Para Astillero: 'OFICIAL', '1/2 OFICIAL', 'AYUDANTE', 'APRENDIZ', 'MANDADOS'. Para Contratistas: nombre del contratista
  rate_oficial_ars NUMERIC(12,2) DEFAULT 0,
  rate_oficial_usd NUMERIC(10,2) DEFAULT 0,
  rate_ayudante_ars NUMERIC(12,2),       -- NULL si no aplica
  rate_ayudante_usd NUMERIC(10,2),       -- NULL si no aplica
  has_ayudante BOOLEAN DEFAULT FALSE,    -- true si permite ayudante
  dollar_rate NUMERIC(10,2) DEFAULT 1500,
  notes TEXT,
  updated_by TEXT DEFAULT 'María José',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_rate_card_period_entity UNIQUE (period, admin_center, entity_name)
);

-- Políticas RLS
ALTER TABLE public.rate_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access rate_cards" ON public.rate_cards;
CREATE POLICY "Public access rate_cards" ON public.rate_cards FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.rate_cards TO anon, authenticated, service_role;
