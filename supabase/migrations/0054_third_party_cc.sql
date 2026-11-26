-- ==============================================================================
-- MIGRACIÓN 0054: CUENTAS CORRIENTES DE TALLERES (CONTROL C.C. PAMPA NAVAL +
--                 PIEZA REPLICABLE MULTI-TALLER POR KILO O POR COMPROBANTE)
-- ==============================================================================

BEGIN;

-- 1. Cuentas Corrientes de Talleres (`third_party_cc_accounts`)
CREATE TABLE IF NOT EXISTS public.third_party_cc_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE RESTRICT,
  operational_name TEXT NOT NULL,
  legal_name TEXT,
  pricing_mode TEXT NOT NULL DEFAULT 'PER_KG'
    CHECK (pricing_mode IN ('PER_KG', 'BY_VOUCHER')),
  current_rate_usd NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (current_rate_usd >= 0),
  opening_balance_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  opening_balance_date DATE,
  material_categories TEXT[] NOT NULL DEFAULT ARRAY['MATERIALES']::TEXT[],
  cancellation_mode TEXT NOT NULL DEFAULT 'FIFO'
    CHECK (cancellation_mode IN ('FIFO', 'MANUAL')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_third_party_cc_accounts_active_worker
  ON public.third_party_cc_accounts (worker_id)
  WHERE is_active = true;

ALTER TABLE public.third_party_cc_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access third_party_cc_accounts" ON public.third_party_cc_accounts;
CREATE POLICY "Public access third_party_cc_accounts"
  ON public.third_party_cc_accounts FOR ALL
  USING (true) WITH CHECK (true);
GRANT ALL ON public.third_party_cc_accounts TO anon, authenticated, service_role;

-- 2. Historial Inmutable de Tarifas US$/kg (`third_party_cc_rate_history`)
CREATE TABLE IF NOT EXISTS public.third_party_cc_rate_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.third_party_cc_accounts(id) ON DELETE CASCADE,
  effective_from DATE NOT NULL,
  rate_usd_per_kg NUMERIC(12,4) NOT NULL CHECK (rate_usd_per_kg >= 0),
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_third_party_cc_rate_history_lookup
  ON public.third_party_cc_rate_history (account_id, effective_from DESC, created_at DESC);

ALTER TABLE public.third_party_cc_rate_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access third_party_cc_rate_history" ON public.third_party_cc_rate_history;
CREATE POLICY "Public access third_party_cc_rate_history"
  ON public.third_party_cc_rate_history FOR ALL
  USING (true) WITH CHECK (true);
GRANT ALL ON public.third_party_cc_rate_history TO anon, authenticated, service_role;

-- 3. Asientos / Overrides del DEBE (`third_party_cc_entries`)
CREATE TABLE IF NOT EXISTS public.third_party_cc_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.third_party_cc_accounts(id) ON DELETE CASCADE,
  entry_source TEXT NOT NULL DEFAULT 'PANOL_REMITO'
    CHECK (entry_source IN ('PANOL_REMITO', 'TERCEROS_SERVICE', 'MANUAL')),
  source_key TEXT,
  remito_number TEXT,
  entry_date DATE NOT NULL,
  quincena_label TEXT,
  weight_kg NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (weight_kg >= 0),
  rate_usd_applied NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (rate_usd_applied >= 0),
  is_special_rate BOOLEAN NOT NULL DEFAULT false,
  special_rate_reason TEXT,
  amount_usd NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount_usd >= 0),
  is_cancelled BOOLEAN NOT NULL DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  is_excluded BOOLEAN NOT NULL DEFAULT false,
  third_party_service_id UUID REFERENCES public.third_party_services(id) ON DELETE SET NULL,
  ship_id UUID REFERENCES public.ships(id) ON DELETE SET NULL,
  work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
  description TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_third_party_cc_entries_source UNIQUE (account_id, source_key)
);

CREATE INDEX IF NOT EXISTS idx_third_party_cc_entries_account_date
  ON public.third_party_cc_entries (account_id, entry_date ASC, created_at ASC);

ALTER TABLE public.third_party_cc_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access third_party_cc_entries" ON public.third_party_cc_entries;
CREATE POLICY "Public access third_party_cc_entries"
  ON public.third_party_cc_entries FOR ALL
  USING (true) WITH CHECK (true);
GRANT ALL ON public.third_party_cc_entries TO anon, authenticated, service_role;

-- 4. Pagos y Compensaciones del HABER (`third_party_cc_payments`)
CREATE TABLE IF NOT EXISTS public.third_party_cc_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.third_party_cc_accounts(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  payment_type TEXT NOT NULL
    CHECK (payment_type IN ('EFECTIVO_USD', 'TRANSFERENCIA_ARS', 'ECHEQ_ARS', 'COMPENSACION_PANOL', 'COMPENSACION_TRABAJO')),
  amount_usd NUMERIC(14,2) NOT NULL CHECK (amount_usd >= 0),
  amount_ars NUMERIC(16,2) DEFAULT 0 CHECK (amount_ars IS NULL OR amount_ars >= 0),
  exchange_rate NUMERIC(12,4) CHECK (exchange_rate IS NULL OR exchange_rate > 0),
  has_iva BOOLEAN NOT NULL DEFAULT false,
  iva_pct NUMERIC(5,2) NOT NULL DEFAULT 21 CHECK (iva_pct >= 0 AND iva_pct <= 100),
  gross_usd_with_iva NUMERIC(14,2),
  has_invoice BOOLEAN NOT NULL DEFAULT false,
  invoice_number TEXT,
  panol_remito_number TEXT,
  source_module TEXT NOT NULL DEFAULT 'MANUAL'
    CHECK (source_module IN ('MANUAL', 'TESORERIA')),
  observations TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_third_party_cc_payments_account_date
  ON public.third_party_cc_payments (account_id, payment_date DESC, created_at DESC);

ALTER TABLE public.third_party_cc_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access third_party_cc_payments" ON public.third_party_cc_payments;
CREATE POLICY "Public access third_party_cc_payments"
  ON public.third_party_cc_payments FOR ALL
  USING (true) WITH CHECK (true);
GRANT ALL ON public.third_party_cc_payments TO anon, authenticated, service_role;

-- 5. Habilitar Realtime en las 4 tablas nuevas
DO $$
DECLARE
  tbl text;
  cc_tables text[] := ARRAY[
    'third_party_cc_accounts',
    'third_party_cc_rate_history',
    'third_party_cc_entries',
    'third_party_cc_payments'
  ];
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH tbl IN ARRAY cc_tables LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = tbl
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
      END IF;
    END LOOP;
  END IF;
END $$;

-- 6. Habilitar a INA PANTOGRAFO (= PAMPA NAVAL) en Pañol + sembrar cuenta inicial en cero y set [PRUEBA]
UPDATE public.workers
   SET can_withdraw_materials = true,
       updated_at = now()
 WHERE id = '9e19f876-9f0c-4083-b719-472fecd19cd0';

DO $$
DECLARE
  v_worker_id UUID := '9e19f876-9f0c-4083-b719-472fecd19cd0';
  v_mat_id UUID := '25c1e962-91e8-4eb1-bdb0-ca9ed1589e65';
  v_ship_id UUID := '1de75167-e6f3-49c3-b1bb-8b81d84a8e8c';
  v_ot3_id UUID := '73a77c86-fe81-46a8-9433-83567703fca1';
  v_ot2_id UUID := 'bf4e63a6-c95a-4539-a2cb-4491a45fc31b';
  v_account_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.workers WHERE id = v_worker_id) THEN
    RAISE NOTICE 'Worker INA PANTOGRAFO (%) no encontrado; omitiendo seed inicial.', v_worker_id;
    RETURN;
  END IF;

  SELECT id
    INTO v_account_id
    FROM public.third_party_cc_accounts
   WHERE worker_id = v_worker_id
     AND is_active = true
   LIMIT 1;

  IF v_account_id IS NULL THEN
    INSERT INTO public.third_party_cc_accounts (
      worker_id,
      operational_name,
      legal_name,
      pricing_mode,
      current_rate_usd,
      opening_balance_usd,
      opening_balance_date,
      material_categories,
      cancellation_mode,
      is_active,
      notes,
      created_by
    ) VALUES (
      v_worker_id,
      'INA PANTOGRAFO',
      'PAMPA NAVAL',
      'PER_KG',
      1.2500,
      0.00,
      '2026-09-01',
      ARRAY['MATERIALES']::TEXT[],
      'FIFO',
      true,
      '[SEED_INICIAL] Cuenta corriente principal de corte pantógrafo',
      'SISTEMA_0054'
    )
    RETURNING id INTO v_account_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.third_party_cc_rate_history WHERE account_id = v_account_id) THEN
    INSERT INTO public.third_party_cc_rate_history (account_id, effective_from, rate_usd_per_kg, notes, created_by)
    VALUES
      (v_account_id, '2026-01-01', 1.0500, '[PRUEBA] Tarifa histórica inicial US$ 1,05/kg', 'SISTEMA_0054'),
      (v_account_id, '2026-10-01', 1.2500, '[PRUEBA] Tarifa vigente US$ 1,25/kg', 'SISTEMA_0054');
  END IF;

  IF EXISTS (SELECT 1 FROM public.materials WHERE id = v_mat_id)
     AND EXISTS (SELECT 1 FROM public.ships WHERE id = v_ship_id)
     AND NOT EXISTS (SELECT 1 FROM public.inventory_transactions WHERE notes LIKE '%[PRUEBA_CC_PAMPA]%') THEN
    INSERT INTO public.inventory_transactions (
      material_id,
      work_order_id,
      ship_id,
      worker_id,
      worker_name,
      contractor_name,
      movement_type,
      quantity_withdrawn,
      weight_total,
      cost_center,
      voucher_number,
      transaction_date,
      notes
    ) VALUES
      (v_mat_id, v_ot3_id, v_ship_id, v_worker_id, 'INA PANTOGRAFO', 'INA PANTOGRAFO', 'RETIRO', 10, 520, 'CLIENTE', '9001', '2026-09-10T15:00:00Z', '[PRUEBA_CC_PAMPA] Chapa quilla proa — tarifa histórica 1,05'),
      (v_mat_id, v_ot3_id, v_ship_id, v_worker_id, 'INA PANTOGRAFO', 'INA PANTOGRAFO', 'RETIRO', 18, 936, 'CLIENTE', '9002', '2026-10-08T15:00:00Z', '[PRUEBA_CC_PAMPA] Chapa varengas babor'),
      (v_mat_id, v_ot3_id, v_ship_id, v_worker_id, 'INA PANTOGRAFO', 'INA PANTOGRAFO', 'RETIRO', 12, 624, 'CLIENTE', '9003', '2026-10-20T15:00:00Z', '[PRUEBA_CC_PAMPA] Corte chapa casco parte A'),
      (v_mat_id, v_ot2_id, v_ship_id, v_worker_id, 'INA PANTOGRAFO', 'INA PANTOGRAFO', 'RETIRO', 8, 416, 'CLIENTE', '9003', '2026-10-20T15:00:00Z', '[PRUEBA_CC_PAMPA] Corte chapa casco parte B'),
      (v_mat_id, v_ot3_id, v_ship_id, v_worker_id, 'INA PANTOGRAFO', 'INA PANTOGRAFO', 'RETIRO', 4, 208, 'CLIENTE', '9004', '2026-11-05T15:00:00Z', '[PRUEBA_CC_PAMPA] Chapa especial — tarifa ajustada'),
      (v_mat_id, v_ot3_id, v_ship_id, v_worker_id, 'INA PANTOGRAFO', 'INA PANTOGRAFO', 'RETIRO', 25, 1300, 'CLIENTE', '9005', '2026-11-18T15:00:00Z', '[PRUEBA_CC_PAMPA] Corte estructura cubierta — pendiente');
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.third_party_cc_entries
     WHERE account_id = v_account_id
       AND source_key = 'REMITO:9004'
  ) THEN
    INSERT INTO public.third_party_cc_entries (
      account_id,
      entry_source,
      source_key,
      remito_number,
      entry_date,
      quincena_label,
      weight_kg,
      rate_usd_applied,
      is_special_rate,
      special_rate_reason,
      amount_usd,
      is_cancelled,
      ship_id,
      work_order_id,
      description,
      created_by
    ) VALUES (
      v_account_id,
      'PANOL_REMITO',
      'REMITO:9004',
      '9004',
      '2026-11-05',
      '1RA NOV 2026',
      208.0000,
      1.6250,
      true,
      '[PRUEBA] Ajuste especial tarifa corte inoxidable/espesor',
      338.00,
      false,
      v_ship_id,
      v_ot3_id,
      '[PRUEBA] Chapa especial — tarifa ajustada',
      'SISTEMA_0054'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.third_party_cc_payments WHERE account_id = v_account_id) THEN
    INSERT INTO public.third_party_cc_payments (
      account_id,
      payment_date,
      payment_type,
      amount_usd,
      amount_ars,
      exchange_rate,
      has_iva,
      iva_pct,
      gross_usd_with_iva,
      has_invoice,
      invoice_number,
      panol_remito_number,
      source_module,
      observations,
      created_by
    ) VALUES
      (v_account_id, '2026-10-15', 'EFECTIVO_USD', 1000.00, 0.00, NULL, false, 21.00, NULL, false, NULL, NULL, 'MANUAL', '[PRUEBA] Entrega dólares billete sin factura', 'SISTEMA_0054'),
      (v_account_id, '2026-10-28', 'TRANSFERENCIA_ARS', 1200.00, 1800000.00, 1500.0000, false, 21.00, NULL, false, NULL, NULL, 'MANUAL', '[PRUEBA] Transferencia AR$ 1.800.000 (TC 1.500)', 'SISTEMA_0054'),
      (v_account_id, '2026-11-10', 'ECHEQ_ARS', 1000.00, 1815000.00, 1500.0000, true, 21.00, 1210.00, true, 'FC-0001-00000001', NULL, 'MANUAL', '[PRUEBA] E-Cheq FC Nº 1 con IVA 21% (bruto US$ 1.210 -> neto US$ 1.000)', 'SISTEMA_0054'),
      (v_account_id, '2026-11-15', 'COMPENSACION_PANOL', 85.00, 127500.00, 1500.0000, false, 21.00, NULL, false, NULL, '1950', 'MANUAL', '[PRUEBA] Remito Pañol 1950 (compensación manual de prueba)', 'SISTEMA_0054');
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
