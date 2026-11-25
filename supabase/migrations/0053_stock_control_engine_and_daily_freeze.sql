-- ==============================================================================
-- MIGRACIÓN 0053: MOTOR PURO DE CONTROL DE STOCK (`CONTROL DE STOCK` GS-007)
--                 + TABLAS `stock_adjustments` Y `stock_audits`
--                 + CONGELAMIENTO DIARIO DE STOCK EN PLANILLA A LAS 21:00 ART
-- ==============================================================================
-- Fórmula única en PostgreSQL (sin saldos ficticios ni DEC-023 gases):
--   Stock Físico(t) =
--       SUM(purchase_orders.quantity WHERE status='RECIBIDO' AND charge_type='VIA_PANOL' AND recibido <= t)
--     + SUM(stock_adjustments.quantity WHERE effective_at <= t)
--     - SUM(inventory_transactions.quantity_withdrawn WHERE COALESCE(transaction_date, created_at) <= t)
-- ==============================================================================

BEGIN;

-- 1. Tabla `stock_adjustments` (Entradas manuales, Salidas manuales, Inicialización y Ajustes de Control)
CREATE TABLE IF NOT EXISTS public.stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date),
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity <> 0),
  reason_type TEXT NOT NULL DEFAULT 'MANUAL_ENTRY'
    CHECK (reason_type IN ('MANUAL_ENTRY', 'MANUAL_EXIT', 'AUDIT_CORRECTION', 'INITIALIZATION', 'DAMAGE', 'RECOVERY', 'OTHER')),
  material_condition TEXT NOT NULL DEFAULT 'DISPONIBLE'
    CHECK (material_condition IN ('DISPONIBLE', 'EN_CUARENTENA', 'OBSOLETO', 'DANADO')),
  unit_cost_usd_snapshot NUMERIC(12,2),
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_material_eff
  ON public.stock_adjustments(material_id, effective_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_date
  ON public.stock_adjustments(date DESC, created_at DESC);

ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access stock_adjustments" ON public.stock_adjustments;
CREATE POLICY "Public access stock_adjustments"
  ON public.stock_adjustments FOR ALL
  USING (true) WITH CHECK (true);
GRANT ALL ON public.stock_adjustments TO anon, authenticated, service_role;

-- 2. Tabla `stock_audits` (Registro histórico de Controles Físicos de Stock)
CREATE TABLE IF NOT EXISTS public.stock_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date),
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  system_quantity NUMERIC(12,3) NOT NULL,
  counted_quantity NUMERIC(12,3) NOT NULL,
  calculated_delta NUMERIC(12,3) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'OK' CHECK (status IN ('OK', 'DISCREPANCY')),
  adjustment_id UUID REFERENCES public.stock_adjustments(id) ON DELETE SET NULL,
  material_condition TEXT NOT NULL DEFAULT 'DISPONIBLE'
    CHECK (material_condition IN ('DISPONIBLE', 'EN_CUARENTENA', 'OBSOLETO', 'DANADO')),
  notes TEXT,
  audited_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.trg_stock_audits_compute_delta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.calculated_delta := ROUND((COALESCE(NEW.counted_quantity, 0) - COALESCE(NEW.system_quantity, 0))::numeric, 3);
  NEW.status := CASE WHEN ABS(NEW.calculated_delta) <= 0.0005 THEN 'OK' ELSE 'DISCREPANCY' END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_audits_compute_delta ON public.stock_audits;
CREATE TRIGGER trg_stock_audits_compute_delta
  BEFORE INSERT OR UPDATE OF system_quantity, counted_quantity
  ON public.stock_audits
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_stock_audits_compute_delta();

CREATE INDEX IF NOT EXISTS idx_stock_audits_date
  ON public.stock_audits(date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_audits_material_date
  ON public.stock_audits(material_id, date DESC);

ALTER TABLE public.stock_audits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access stock_audits" ON public.stock_audits;
CREATE POLICY "Public access stock_audits"
  ON public.stock_audits FOR ALL
  USING (true) WITH CHECK (true);
GRANT ALL ON public.stock_audits TO anon, authenticated, service_role;

-- 3. Expansión relacional en entidades madre: snapshot congelado diario y fecha real de recepción en Compras
ALTER TABLE public.inventory_transactions
  ADD COLUMN IF NOT EXISTS stock_snapshot NUMERIC(12,3),
  ADD COLUMN IF NOT EXISTS stock_frozen_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_inv_tx_unfrozen_material
  ON public.inventory_transactions(transaction_date)
  WHERE stock_frozen_at IS NULL AND material_id IS NOT NULL;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;

UPDATE public.purchase_orders
   SET received_at = COALESCE(updated_at, created_at, now())
 WHERE status = 'RECIBIDO'
   AND received_at IS NULL;

CREATE OR REPLACE FUNCTION public.trg_purchase_orders_stamp_received_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'RECIBIDO' THEN
    IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'RECIBIDO' THEN
      IF NEW.received_at IS NULL THEN
        NEW.received_at := now();
      END IF;
    END IF;
  ELSE
    NEW.received_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purchase_orders_stamp_received_at ON public.purchase_orders;
CREATE TRIGGER trg_purchase_orders_stamp_received_at
  BEFORE INSERT OR UPDATE OF status
  ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_purchase_orders_stamp_received_at();

CREATE INDEX IF NOT EXISTS idx_po_stock_via_panol
  ON public.purchase_orders(material_id, status, charge_type)
  WHERE material_id IS NOT NULL AND charge_type = 'VIA_PANOL';

-- 4. Motor Puro de Cálculo de Stock Físico (instantáneo o histórico a cualquier corte TIMESTAMPTZ)
CREATE OR REPLACE FUNCTION public.compute_material_stock_at(
  p_material_id UUID,
  p_as_of TIMESTAMPTZ DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_po_in NUMERIC := 0;
  v_adj_net NUMERIC := 0;
  v_tx_out NUMERIC := 0;
BEGIN
  IF p_material_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(SUM(COALESCE(quantity, 0)), 0)
    INTO v_po_in
    FROM public.purchase_orders
   WHERE material_id = p_material_id
     AND status = 'RECIBIDO'
     AND charge_type = 'VIA_PANOL'
     AND (
       p_as_of IS NULL
       OR COALESCE(
            received_at,
            updated_at,
            (order_date::timestamp + INTERVAL '12 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires',
            created_at
          ) <= p_as_of
     );

  SELECT COALESCE(SUM(COALESCE(quantity, 0)), 0)
    INTO v_adj_net
    FROM public.stock_adjustments
   WHERE material_id = p_material_id
     AND (p_as_of IS NULL OR effective_at <= p_as_of);

  SELECT COALESCE(SUM(COALESCE(quantity_withdrawn, 0)), 0)
    INTO v_tx_out
    FROM public.inventory_transactions
   WHERE material_id = p_material_id
     AND (p_as_of IS NULL OR COALESCE(transaction_date, created_at) <= p_as_of);

  RETURN ROUND((v_po_in + v_adj_net - v_tx_out)::numeric, 3);
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_material_stock(p_material_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_stock NUMERIC := 0;
BEGIN
  IF p_material_id IS NULL THEN
    RETURN 0;
  END IF;
  v_stock := public.compute_material_stock_at(p_material_id, NULL);
  UPDATE public.materials
     SET current_stock = v_stock
   WHERE id = p_material_id;
  RETURN v_stock;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_all_materials_stock()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated INT := 0;
BEGIN
  WITH po_in AS (
    SELECT material_id, SUM(COALESCE(quantity, 0)) AS qty
      FROM public.purchase_orders
     WHERE material_id IS NOT NULL
       AND status = 'RECIBIDO'
       AND charge_type = 'VIA_PANOL'
     GROUP BY material_id
  ),
  adj_net AS (
    SELECT material_id, SUM(COALESCE(quantity, 0)) AS qty
      FROM public.stock_adjustments
     GROUP BY material_id
  ),
  tx_out AS (
    SELECT material_id, SUM(COALESCE(quantity_withdrawn, 0)) AS qty
      FROM public.inventory_transactions
     WHERE material_id IS NOT NULL
     GROUP BY material_id
  )
  UPDATE public.materials AS m
     SET current_stock = ROUND((
       COALESCE(p.qty, 0) + COALESCE(a.qty, 0) - COALESCE(t.qty, 0)
     )::numeric, 3)
    FROM (SELECT id FROM public.materials) AS base
    LEFT JOIN po_in p ON p.material_id = base.id
    LEFT JOIN adj_net a ON a.material_id = base.id
    LEFT JOIN tx_out t ON t.material_id = base.id
   WHERE m.id = base.id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

-- 5. Triggers reactivos en las 3 tablas fuente (solo columnas que alteran inventario)
CREATE OR REPLACE FUNCTION public.trg_sync_material_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_mat UUID := NULL;
  v_new_mat UUID := NULL;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_old_mat := OLD.material_id;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_new_mat := NEW.material_id;
  END IF;

  IF v_old_mat IS NOT NULL AND v_old_mat IS DISTINCT FROM v_new_mat THEN
    PERFORM public.recalculate_material_stock(v_old_mat);
  END IF;
  IF v_new_mat IS NOT NULL THEN
    PERFORM public.recalculate_material_stock(v_new_mat);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_inv_tx_sync_stock ON public.inventory_transactions;
CREATE TRIGGER trg_inv_tx_sync_stock
  AFTER INSERT OR DELETE OR UPDATE OF material_id, quantity_withdrawn
  ON public.inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_material_stock();

DROP TRIGGER IF EXISTS trg_stock_adj_sync_stock ON public.stock_adjustments;
CREATE TRIGGER trg_stock_adj_sync_stock
  AFTER INSERT OR DELETE OR UPDATE OF material_id, quantity
  ON public.stock_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_material_stock();

DROP TRIGGER IF EXISTS trg_po_sync_stock ON public.purchase_orders;
CREATE TRIGGER trg_po_sync_stock
  AFTER INSERT OR DELETE OR UPDATE OF material_id, quantity, status, charge_type
  ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_material_stock();

-- 6. Configuración de congelamiento diario (21:00 ART = 00:00 UTC) + RPC idempotente
INSERT INTO public.system_settings (key, value, updated_at, updated_by)
VALUES (
  'panol_stock_freeze_config',
  jsonb_build_object(
    'activated_at', now(),
    'activated_date_ar', to_char((now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date, 'YYYY-MM-DD'),
    'freeze_hour_ar', 21
  ),
  now(),
  'Migración 0053'
)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.freeze_pending_panol_stock_days(p_now TIMESTAMPTZ DEFAULT now())
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cfg JSONB;
  v_activated_date DATE;
  v_freeze_hour INT := 21;
  v_frozen_rows INT := 0;
  v_step_rows INT := 0;
  rec RECORD;
  v_snap NUMERIC;
BEGIN
  SELECT value INTO v_cfg
    FROM public.system_settings
   WHERE key = 'panol_stock_freeze_config';

  v_activated_date := COALESCE(
    NULLIF(v_cfg->>'activated_date_ar', '')::date,
    (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
  );
  v_freeze_hour := COALESCE(NULLIF(v_cfg->>'freeze_hour_ar', '')::int, 21);

  FOR rec IN
    WITH candidates AS (
      SELECT
        t.id,
        t.material_id,
        COALESCE(t.transaction_date, t.created_at) AS eff_dt,
        t.created_at,
        (COALESCE(t.transaction_date, t.created_at) AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS op_date
      FROM public.inventory_transactions t
      WHERE t.stock_frozen_at IS NULL
        AND t.material_id IS NOT NULL
    ),
    with_cutoff AS (
      SELECT
        c.id,
        c.material_id,
        CASE
          WHEN c.created_at >= ((c.op_date::timestamp + make_interval(hours => v_freeze_hour)) AT TIME ZONE 'America/Argentina/Buenos_Aires')
           AND (c.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date = c.op_date
          THEN ((c.op_date + 1)::timestamp + make_interval(hours => v_freeze_hour)) AT TIME ZONE 'America/Argentina/Buenos_Aires'
          ELSE (c.op_date::timestamp + make_interval(hours => v_freeze_hour)) AT TIME ZONE 'America/Argentina/Buenos_Aires'
        END AS freeze_cutoff
      FROM candidates c
      WHERE c.op_date >= v_activated_date
    )
    SELECT
      wc.material_id,
      wc.freeze_cutoff,
      array_agg(wc.id) AS tx_ids
    FROM with_cutoff wc
    WHERE p_now >= wc.freeze_cutoff
    GROUP BY wc.material_id, wc.freeze_cutoff
    ORDER BY wc.freeze_cutoff ASC, wc.material_id ASC
  LOOP
    v_snap := public.compute_material_stock_at(rec.material_id, rec.freeze_cutoff);

    UPDATE public.inventory_transactions
       SET stock_snapshot = v_snap,
           stock_frozen_at = rec.freeze_cutoff
     WHERE id = ANY(rec.tx_ids)
       AND stock_frozen_at IS NULL;

    GET DIAGNOSTICS v_step_rows = ROW_COUNT;
    v_frozen_rows := v_frozen_rows + v_step_rows;
  END LOOP;

  RETURN jsonb_build_object(
    'frozen_rows', v_frozen_rows,
    'checked_at', p_now,
    'activated_date_ar', to_char(v_activated_date, 'YYYY-MM-DD'),
    'freeze_hour_ar', v_freeze_hour
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_material_stock_at(UUID, TIMESTAMPTZ) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_material_stock(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_all_materials_stock() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.freeze_pending_panol_stock_days(TIMESTAMPTZ) TO anon, authenticated, service_role;

-- 7. Recálculo inicial limpio según fórmula pura (sin filas ficticias de saldo inicial)
SELECT public.recalculate_all_materials_stock();

COMMIT;

-- 8. Registro opcional en pg_cron (21:01 ART = 00:01 UTC). Si pg_cron no está habilitado, el RPC corre idempotente al abrir Pañol.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
      PERFORM cron.unschedule('panol_freeze_daily_stock_21art')
       WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'panol_freeze_daily_stock_21art');
      PERFORM cron.schedule('panol_freeze_daily_stock_21art', '1 0 * * *', $job$SELECT public.freeze_pending_panol_stock_days();$job$);
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron no disponible o sin permisos en este entorno (%): se usará ejecución idempotente por RPC al cargar Pañol.', SQLERRM;
END;
$$;
