-- ============================================================
-- ALON CAR ERP - MIGRACIÓN 0007: VARIABLES MACROECONÓMICAS MENSUALES
-- Permite al Administrador reportar el valor del Dólar y la Inflación Mensual (%).
-- La inflación aplica para ambas quincenas (1Q y 2Q) de ese mes.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.macro_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  dollar_rate NUMERIC(10,2) NOT NULL DEFAULT 1500,
  monthly_inflation_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
  notes TEXT,
  updated_by TEXT DEFAULT 'Administrador',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_macro_year_month UNIQUE (year, month)
);

ALTER TABLE public.macro_variables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access macro_variables" ON public.macro_variables;
CREATE POLICY "Public access macro_variables" ON public.macro_variables FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON public.macro_variables TO anon, authenticated, service_role;

ALTER TABLE public.rate_cards ADD COLUMN IF NOT EXISTS monthly_inflation_pct NUMERIC(6,2) DEFAULT 0;
