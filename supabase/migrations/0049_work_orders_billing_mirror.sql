-- ==============================================================================
-- MIGRACIÓN 0049: ESPEJO COMERCIAL EN WORK_ORDERS, MESA MULTI-BARCO EN SHIPS
--                 Y CORRECCIÓN DE ORÍGENES OT.ABC (GRÚAS -> HORAS, ÁNODOS -> JEFE)
-- ==============================================================================
-- Propósito:
-- 1. Ampliar `ot_templates` para incluir 'PLANILLA_HORAS' en el CHECK de orígenes
--    y corregir los renglones de Grúas -> 'PLANILLA_HORAS' y Ánodos -> 'JEFE_DE_OBRA'.
-- 2. Ampliar columnas comerciales directamente sobre cada fila de `work_orders`
--    (Patrón de Expansión Relacional sobre Entidad Madre, evitando colisiones JSON).
-- 3. Ampliar `ships` con estado de Mesa Independiente Multi-Barco de Pre-Facturación
--    (`NONE` | `EN_PREPARACION` | `ENVIADO_A_FACTURACION`) y metadata de hoja por buque.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. OT.ABC: habilitar 'PLANILLA_HORAS' y corregir orígenes de Grúas y Ánodos
-- ------------------------------------------------------------------------------
ALTER TABLE public.ot_templates
  DROP CONSTRAINT IF EXISTS ot_templates_default_data_source_check;

ALTER TABLE public.ot_templates
  ADD CONSTRAINT ot_templates_default_data_source_check
  CHECK (
    default_data_source IN (
      'JEFE_DE_OBRA',
      'MOVIMIENTOS_BUQUE',
      'PADRON_BUQUES',
      'PLANILLA_HORAS',
      'TERCEROS_MANUAL',
      'CARGA_MANUAL'
    )
  );

-- SERVICIO DE GRUA -> origen Planilla de Horas (labor_logs)
UPDATE public.ot_templates
   SET default_data_source = 'PLANILLA_HORAS',
       line_items = COALESCE(
         (
           SELECT jsonb_agg(
             CASE
               WHEN upper(COALESCE(elem->>'concept', '')) LIKE '%GRUA%'
                 OR upper(COALESCE(elem->>'concept', '')) LIKE '%GRÚA%'
               THEN jsonb_set(elem, '{data_source}', '"PLANILLA_HORAS"'::jsonb, true)
               ELSE elem
             END
           )
           FROM jsonb_array_elements(COALESCE(line_items, '[]'::jsonb)) AS elem
         ),
         '[]'::jsonb
       ),
       updated_at = NOW()
 WHERE upper(trim(name)) LIKE '%GRUA%'
    OR upper(trim(name)) LIKE '%GRÚA%';

-- También actualizar renglones de Grúa embebidos en VARADERO si existen
UPDATE public.ot_templates
   SET line_items = COALESCE(
         (
           SELECT jsonb_agg(
             CASE
               WHEN upper(COALESCE(elem->>'concept', '')) LIKE '%GRUA%'
                 OR upper(COALESCE(elem->>'concept', '')) LIKE '%GRÚA%'
               THEN jsonb_set(elem, '{data_source}', '"PLANILLA_HORAS"'::jsonb, true)
               ELSE elem
             END
           )
           FROM jsonb_array_elements(COALESCE(line_items, '[]'::jsonb)) AS elem
         ),
         '[]'::jsonb
       ),
       updated_at = NOW()
 WHERE upper(trim(name)) = 'VARADERO';

-- Asegurar PROTECCION GALVANICA (ánodos) en JEFE_DE_OBRA
UPDATE public.ot_templates
   SET default_data_source = 'JEFE_DE_OBRA',
       updated_at = NOW()
 WHERE upper(trim(name)) = 'PROTECCION GALVANICA';

-- ------------------------------------------------------------------------------
-- 2. EXPANSIÓN RELACIONAL EN `work_orders` (Espejo Comercial + Circuito Ampliar)
-- ------------------------------------------------------------------------------
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS billing_description TEXT,
  ADD COLUMN IF NOT EXISTS billing_notes TEXT,
  ADD COLUMN IF NOT EXISTS is_in_billing BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS billing_sort_order INTEGER,
  ADD COLUMN IF NOT EXISTS billing_rubro_group TEXT,
  ADD COLUMN IF NOT EXISTS billing_pricing_mode TEXT NOT NULL DEFAULT 'MO_MAT',
  ADD COLUMN IF NOT EXISTS billing_mo_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_mat_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_unit_price_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_qty_override NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS billing_mo_tax TEXT NOT NULL DEFAULT 'EXENTO',
  ADD COLUMN IF NOT EXISTS billing_mat_tax TEXT NOT NULL DEFAULT 'EXENTO',
  ADD COLUMN IF NOT EXISTS foreman_review_status TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS foreman_review_note TEXT,
  ADD COLUMN IF NOT EXISTS foreman_review_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS foreman_review_requested_by TEXT,
  ADD COLUMN IF NOT EXISTS foreman_review_resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS foreman_review_resolved_by TEXT;

ALTER TABLE public.work_orders
  DROP CONSTRAINT IF EXISTS work_orders_billing_pricing_mode_check;
ALTER TABLE public.work_orders
  ADD CONSTRAINT work_orders_billing_pricing_mode_check
  CHECK (billing_pricing_mode IN ('MO_MAT', 'UNITARIO', 'SIN_CARGO'));

ALTER TABLE public.work_orders
  DROP CONSTRAINT IF EXISTS work_orders_billing_mo_tax_check;
ALTER TABLE public.work_orders
  ADD CONSTRAINT work_orders_billing_mo_tax_check
  CHECK (billing_mo_tax IN ('EXENTO', 'GRAVADO_21'));

ALTER TABLE public.work_orders
  DROP CONSTRAINT IF EXISTS work_orders_billing_mat_tax_check;
ALTER TABLE public.work_orders
  ADD CONSTRAINT work_orders_billing_mat_tax_check
  CHECK (billing_mat_tax IN ('EXENTO', 'GRAVADO_21'));

ALTER TABLE public.work_orders
  DROP CONSTRAINT IF EXISTS work_orders_foreman_review_status_check;
ALTER TABLE public.work_orders
  ADD CONSTRAINT work_orders_foreman_review_status_check
  CHECK (foreman_review_status IN ('NONE', 'REQUESTED', 'RESOLVED'));

CREATE INDEX IF NOT EXISTS idx_work_orders_in_billing
  ON public.work_orders (ship_id, billing_sort_order)
  WHERE is_in_billing = TRUE;

CREATE INDEX IF NOT EXISTS idx_work_orders_foreman_review
  ON public.work_orders (foreman_review_status, ship_id)
  WHERE foreman_review_status <> 'NONE';

-- ------------------------------------------------------------------------------
-- 3. EXPANSIÓN RELACIONAL EN `ships` (Mesa Multi-Barco Independiente)
-- ------------------------------------------------------------------------------
ALTER TABLE public.ships
  ADD COLUMN IF NOT EXISTS billing_workspace_status TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS billing_opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_sent_by TEXT,
  ADD COLUMN IF NOT EXISTS billing_budget_number TEXT,
  ADD COLUMN IF NOT EXISTS billing_total_snapshot_usd NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS billing_layout_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.ships
  DROP CONSTRAINT IF EXISTS ships_billing_workspace_status_check;
ALTER TABLE public.ships
  ADD CONSTRAINT ships_billing_workspace_status_check
  CHECK (billing_workspace_status IN ('NONE', 'EN_PREPARACION', 'ENVIADO_A_FACTURACION'));

CREATE INDEX IF NOT EXISTS idx_ships_billing_workspace_active
  ON public.ships (billing_workspace_status)
  WHERE billing_workspace_status <> 'NONE';

COMMIT;
