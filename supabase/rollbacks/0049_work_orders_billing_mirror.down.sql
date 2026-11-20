-- ==============================================================================
-- ROLLBACK 0049: REVERTIR ESPEJO COMERCIAL EN WORK_ORDERS, MESA EN SHIPS Y OT.ABC
-- ==============================================================================

BEGIN;

DROP INDEX IF EXISTS public.idx_ships_billing_workspace_active;
ALTER TABLE public.ships
  DROP CONSTRAINT IF EXISTS ships_billing_workspace_status_check,
  DROP COLUMN IF EXISTS billing_layout_meta,
  DROP COLUMN IF EXISTS billing_total_snapshot_usd,
  DROP COLUMN IF EXISTS billing_budget_number,
  DROP COLUMN IF EXISTS billing_sent_by,
  DROP COLUMN IF EXISTS billing_sent_at,
  DROP COLUMN IF EXISTS billing_opened_at,
  DROP COLUMN IF EXISTS billing_workspace_status;

DROP INDEX IF EXISTS public.idx_work_orders_foreman_review;
DROP INDEX IF EXISTS public.idx_work_orders_in_billing;
ALTER TABLE public.work_orders
  DROP CONSTRAINT IF EXISTS work_orders_foreman_review_status_check,
  DROP CONSTRAINT IF EXISTS work_orders_billing_mat_tax_check,
  DROP CONSTRAINT IF EXISTS work_orders_billing_mo_tax_check,
  DROP CONSTRAINT IF EXISTS work_orders_billing_pricing_mode_check,
  DROP COLUMN IF EXISTS foreman_review_resolved_by,
  DROP COLUMN IF EXISTS foreman_review_resolved_at,
  DROP COLUMN IF EXISTS foreman_review_requested_by,
  DROP COLUMN IF EXISTS foreman_review_requested_at,
  DROP COLUMN IF EXISTS foreman_review_note,
  DROP COLUMN IF EXISTS foreman_review_status,
  DROP COLUMN IF EXISTS billing_mat_tax,
  DROP COLUMN IF EXISTS billing_mo_tax,
  DROP COLUMN IF EXISTS billing_qty_override,
  DROP COLUMN IF EXISTS billing_unit_price_usd,
  DROP COLUMN IF EXISTS billing_mat_usd,
  DROP COLUMN IF EXISTS billing_mo_usd,
  DROP COLUMN IF EXISTS billing_pricing_mode,
  DROP COLUMN IF EXISTS billing_rubro_group,
  DROP COLUMN IF EXISTS billing_sort_order,
  DROP COLUMN IF EXISTS is_in_billing,
  DROP COLUMN IF EXISTS billing_notes,
  DROP COLUMN IF EXISTS billing_description;

UPDATE public.ot_templates
   SET default_data_source = 'JEFE_DE_OBRA'
 WHERE default_data_source = 'PLANILLA_HORAS';

ALTER TABLE public.ot_templates
  DROP CONSTRAINT IF EXISTS ot_templates_default_data_source_check;

ALTER TABLE public.ot_templates
  ADD CONSTRAINT ot_templates_default_data_source_check
  CHECK (
    default_data_source IN (
      'JEFE_DE_OBRA',
      'MOVIMIENTOS_BUQUE',
      'PADRON_BUQUES',
      'TERCEROS_MANUAL',
      'CARGA_MANUAL'
    )
  );

COMMIT;
