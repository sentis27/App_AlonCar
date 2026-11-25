-- ==============================================================================
-- ROLLBACK 0053: REVERTIR MOTOR DE CONTROL DE STOCK, TABLAS NUEVAS Y
--                CONGELAMIENTO DIARIO 21:00 ART
-- ==============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.unschedule('panol_freeze_daily_stock_21art')
     WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'panol_freeze_daily_stock_21art');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$$;

BEGIN;

DROP TRIGGER IF EXISTS trg_inv_tx_sync_stock ON public.inventory_transactions;
DROP TRIGGER IF EXISTS trg_stock_adj_sync_stock ON public.stock_adjustments;
DROP TRIGGER IF EXISTS trg_po_sync_stock ON public.purchase_orders;
DROP TRIGGER IF EXISTS trg_purchase_orders_stamp_received_at ON public.purchase_orders;
DROP TRIGGER IF EXISTS trg_stock_audits_compute_delta ON public.stock_audits;

DROP FUNCTION IF EXISTS public.freeze_pending_panol_stock_days(TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.trg_sync_material_stock();
DROP FUNCTION IF EXISTS public.recalculate_all_materials_stock();
DROP FUNCTION IF EXISTS public.recalculate_material_stock(UUID);
DROP FUNCTION IF EXISTS public.compute_material_stock_at(UUID, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.trg_purchase_orders_stamp_received_at();
DROP FUNCTION IF EXISTS public.trg_stock_audits_compute_delta();

DROP INDEX IF EXISTS public.idx_po_stock_via_panol;
DROP INDEX IF EXISTS public.idx_inv_tx_unfrozen_material;
DROP INDEX IF EXISTS public.idx_stock_audits_material_date;
DROP INDEX IF EXISTS public.idx_stock_audits_date;
DROP INDEX IF EXISTS public.idx_stock_adjustments_date;
DROP INDEX IF EXISTS public.idx_stock_adjustments_material_eff;

ALTER TABLE public.purchase_orders
  DROP COLUMN IF EXISTS received_at;

ALTER TABLE public.inventory_transactions
  DROP COLUMN IF EXISTS stock_frozen_at,
  DROP COLUMN IF EXISTS stock_snapshot;

DROP TABLE IF EXISTS public.stock_audits;
DROP TABLE IF EXISTS public.stock_adjustments;

DELETE FROM public.system_settings
 WHERE key = 'panol_stock_freeze_config';

COMMIT;
