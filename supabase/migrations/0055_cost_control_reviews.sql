-- ==============================================================================
-- MIGRACIÓN 0055: CONTROL DE GASTOS — REVISIONES, EXCEPCIONES Y APROBACIONES
--                 (MÓDULO CONTROL DE GASTOS / GS-010 / DEC-025)
-- ==============================================================================

BEGIN;

-- 1. Tabla de revisiones de Control de Gastos (`cost_control_reviews`)
--    Persiste excepciones justificadas de Materiales (`MATERIAL_EXCEPTION`) y
--    aprobaciones rápidas de Horas sin Materiales (`LABOR_ONLY_APPROVED`).
CREATE TABLE IF NOT EXISTS public.cost_control_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_type TEXT NOT NULL
    CHECK (review_type IN ('MATERIAL_EXCEPTION', 'LABOR_ONLY_APPROVED')),
  period_key TEXT NOT NULL
    CHECK (period_key ~ '^\d{4}-\d{2}-(1Q|2Q)$'),
  inventory_transaction_id UUID REFERENCES public.inventory_transactions(id) ON DELETE CASCADE,
  ship_id UUID REFERENCES public.ships(id) ON DELETE SET NULL,
  work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
  contractor_entity TEXT NOT NULL,
  review_key TEXT NOT NULL,
  reason TEXT,
  reviewed_by TEXT NOT NULL DEFAULT 'Administrador',
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_cost_control_reviews_key UNIQUE (review_key),
  CONSTRAINT chk_cost_control_material_tx
    CHECK (review_type <> 'MATERIAL_EXCEPTION' OR inventory_transaction_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_cost_control_reviews_period
  ON public.cost_control_reviews (period_key, review_type);

CREATE INDEX IF NOT EXISTS idx_cost_control_reviews_tx
  ON public.cost_control_reviews (inventory_transaction_id)
  WHERE inventory_transaction_id IS NOT NULL;

ALTER TABLE public.cost_control_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access cost_control_reviews" ON public.cost_control_reviews;
CREATE POLICY "Public access cost_control_reviews"
  ON public.cost_control_reviews FOR ALL
  USING (true) WITH CHECK (true);
GRANT ALL ON public.cost_control_reviews TO anon, authenticated, service_role;

-- 2. Semilla idempotente de OTs internas/administrativas excluidas por defecto del cruce
INSERT INTO public.system_settings (key, value, updated_by)
VALUES (
  'cost_control_excluded_ots',
  '["PROV.CONSUMIBLES","CAMION-AUTO","OFICINA","TALLER CARPINT","AGUA","MULITA","DONACION","PROVISION CARLOS MAYO","DESPERDICIO HORAS"]'::jsonb,
  'Migración 0055'
)
ON CONFLICT (key) DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';
