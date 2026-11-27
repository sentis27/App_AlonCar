-- ==============================================================================
-- MIGRACIÓN 0058: CUENTA CORRIENTE & PAGOS DE CONTRATISTAS + CIERRES QUINCENA
-- ==============================================================================
-- Propósito:
--   Reemplazar las hojas externas `IMPORT.CC.CONTRATADOS` y `REGISTRO.PAGOS` de
--   Graciela dentro de `/tesoreria?tab=movimientos` y proveer tabla de cierre
--   inmutable + observaciones editables por fila para `Resumen Horas`.
-- ==============================================================================

BEGIN;

-- 1. Trigger helper para actualizar updated_at
CREATE OR REPLACE FUNCTION public.trg_set_updated_at_contractor_cc()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- 2. Tabla `contractor_cc_movements` (Cuenta Corriente & Pagos de Contratistas)
CREATE TABLE IF NOT EXISTS public.contractor_cc_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_date DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE),
  period_key TEXT NOT NULL CHECK (period_key ~ '^\d{4}-\d{2}-(1Q|2Q)$'),
  contractor_worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
  contractor_group TEXT NOT NULL CHECK (length(trim(contractor_group)) > 0),
  ship_id UUID REFERENCES public.ships(id) ON DELETE SET NULL,
  work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
  prc_id UUID REFERENCES public.contractor_prc_registry(id) ON DELETE SET NULL,
  prc_number INTEGER CHECK (prc_number IS NULL OR prc_number >= 1),
  settlement_scope TEXT NOT NULL DEFAULT 'HORA'
    CHECK (settlement_scope IN ('HORA', 'PRESUPUESTO', 'GENERAL')),
  direction TEXT NOT NULL DEFAULT 'DEBE'
    CHECK (direction IN ('DEBE', 'HABER')),
  category TEXT NOT NULL
    CHECK (category IN (
      'ADELANTO',
      'PAGO_FINAL',
      'RTO_PANOL',
      'GASTO_A_CUENTA',
      'RETENCION',
      'BONIFICACION',
      'DEVENGADO_QUINCENA',
      'DEVENGADO_PRC',
      'AJUSTE'
    )),
  payment_method TEXT
    CHECK (payment_method IS NULL OR payment_method IN (
      'CHEQUE',
      'ECHEQ',
      'TRANSFERENCIA',
      'EFECTIVO_ARS',
      'EFECTIVO_USD',
      'COMPENSACION_PANOL',
      'OTRO'
    )),
  payment_reference TEXT,
  invoice_status TEXT NOT NULL DEFAULT 'NO_APLICA'
    CHECK (invoice_status IN ('CON_FACTURA', 'DEBE_FACTURA', 'SIN_FACTURA', 'NO_APLICA')),
  invoice_number TEXT,
  panol_remito_number TEXT,
  inventory_transaction_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  amount_ars NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (amount_ars >= 0),
  amount_usd NUMERIC(14,2) DEFAULT 0 CHECK (amount_usd IS NULL OR amount_usd >= 0),
  exchange_rate NUMERIC(12,4) CHECK (exchange_rate IS NULL OR exchange_rate > 0),
  observations TEXT,
  source_module TEXT NOT NULL DEFAULT 'TESORERIA'
    CHECK (source_module IN ('TESORERIA', 'PANOL_SYNC', 'LIQUIDACION_CIERRE')),
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contractor_cc_movements_period_date
  ON public.contractor_cc_movements (period_key, movement_date DESC);

CREATE INDEX IF NOT EXISTS idx_contractor_cc_movements_contractor_period
  ON public.contractor_cc_movements (contractor_group, period_key);

CREATE INDEX IF NOT EXISTS idx_contractor_cc_movements_debe_factura
  ON public.contractor_cc_movements (invoice_status)
  WHERE invoice_status = 'DEBE_FACTURA';

CREATE INDEX IF NOT EXISTS idx_contractor_cc_movements_prc
  ON public.contractor_cc_movements (prc_id)
  WHERE prc_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contractor_cc_movements_panol_tx_ids
  ON public.contractor_cc_movements USING GIN (inventory_transaction_ids);

DROP TRIGGER IF EXISTS trg_contractor_cc_movements_updated_at ON public.contractor_cc_movements;
CREATE TRIGGER trg_contractor_cc_movements_updated_at
  BEFORE UPDATE ON public.contractor_cc_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_set_updated_at_contractor_cc();

-- 3. Tabla `contractor_settlement_closures` (Cierre Quincenal + Observaciones por fila)
CREATE TABLE IF NOT EXISTS public.contractor_settlement_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_key TEXT NOT NULL CHECK (period_key ~ '^\d{4}-\d{2}-(1Q|2Q)$'),
  contractor_group TEXT NOT NULL CHECK (length(trim(contractor_group)) > 0),
  row_key TEXT NOT NULL CHECK (length(trim(row_key)) > 0),
  dollar_rate_materials NUMERIC(12,4) CHECK (dollar_rate_materials IS NULL OR dollar_rate_materials > 0),
  hours_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  gross_ars NUMERIC(16,2) NOT NULL DEFAULT 0,
  materials_ars NUMERIC(16,2) NOT NULL DEFAULT 0,
  advances_ars NUMERIC(16,2) NOT NULL DEFAULT 0,
  net_payable_ars NUMERIC(16,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'BORRADOR'
    CHECK (status IN ('BORRADOR', 'CERRADO', 'PAGADO')),
  observations TEXT,
  snapshot_json JSONB,
  closed_by TEXT,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_contractor_settlement_closures_period_row UNIQUE (period_key, row_key)
);

CREATE INDEX IF NOT EXISTS idx_contractor_settlement_closures_period_group
  ON public.contractor_settlement_closures (period_key, contractor_group);

DROP TRIGGER IF EXISTS trg_contractor_settlement_closures_updated_at ON public.contractor_settlement_closures;
CREATE TRIGGER trg_contractor_settlement_closures_updated_at
  BEFORE UPDATE ON public.contractor_settlement_closures
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_set_updated_at_contractor_cc();

-- 4. RLS y permisos
ALTER TABLE public.contractor_cc_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access contractor_cc_movements" ON public.contractor_cc_movements;
CREATE POLICY "Public access contractor_cc_movements"
  ON public.contractor_cc_movements FOR ALL
  USING (true) WITH CHECK (true);

ALTER TABLE public.contractor_settlement_closures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access contractor_settlement_closures" ON public.contractor_settlement_closures;
CREATE POLICY "Public access contractor_settlement_closures"
  ON public.contractor_settlement_closures FOR ALL
  USING (true) WITH CHECK (true);

GRANT ALL ON public.contractor_cc_movements TO anon, authenticated, service_role;
GRANT ALL ON public.contractor_settlement_closures TO anon, authenticated, service_role;

-- 5. Realtime publication idempotente
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'contractor_cc_movements'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.contractor_cc_movements;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'contractor_settlement_closures'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.contractor_settlement_closures;
    END IF;
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
