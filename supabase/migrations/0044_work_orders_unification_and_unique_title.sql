-- ==============================================================================
-- MIGRACIÓN 0044: UNIFICACIÓN DE ÓRDENES DE TRABAJO Y UNICIDAD DE TÍTULO POR BUQUE
-- ==============================================================================
-- Propósito:
-- 1. Ampliar work_orders.status CHECK para soportar 'Facturada', 'Cancelada' y 'Unificada'.
-- 2. Agregar columna merged_into_wo_id (FK -> work_orders.id) para trazabilidad
--    inmutable de OTs absorbidas sin perder consecutivos históricos.
-- 3. Consolidar históricamente OT-4 -> OT-3 ("CAMBIO CHAPA") en NONO PASCUAL.
-- 4. Crear índice único parcial (ship_id, UPPER(TRIM(title))) para impedir OTs
--    duplicadas con el mismo nombre dentro de un mismo buque.
-- ==============================================================================

BEGIN;

-- 1. Columna de trazabilidad de unificación
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS merged_into_wo_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_work_orders_merged_into
  ON public.work_orders (merged_into_wo_id)
  WHERE merged_into_wo_id IS NOT NULL;

-- 2. Ampliar CHECK de estados permitidos en work_orders (compatible con cierre, baja y unificación)
ALTER TABLE public.work_orders
  DROP CONSTRAINT IF EXISTS work_orders_status_check;

ALTER TABLE public.work_orders
  ADD CONSTRAINT work_orders_status_check
  CHECK (status = ANY (ARRAY[
    'Pendiente'::text,
    'En Progreso'::text,
    'Pausada'::text,
    'Completada'::text,
    'Facturada'::text,
    'Cancelada'::text,
    'Unificada'::text
  ]));

-- 3. Consolidar duplicado histórico en NONO PASCUAL: OT-4 (CAMBIO CHAPA) -> OT-3 (CAMBIO CHAPA)
DO $$
DECLARE
  v_source_id UUID := 'db6218ca-1d93-4e21-8aa4-00945ae92784';
  v_target_id UUID := '73a77c86-fe81-46a8-9433-83567703fca1';
  v_has_active_item BOOLEAN := false;
BEGIN
  IF EXISTS (SELECT 1 FROM public.work_orders WHERE id = v_source_id AND merged_into_wo_id IS NULL)
     AND EXISTS (SELECT 1 FROM public.work_orders WHERE id = v_target_id) THEN

    UPDATE public.work_items SET work_order_id = v_target_id, updated_at = NOW() WHERE work_order_id = v_source_id;
    UPDATE public.labor_logs SET work_order_id = v_target_id WHERE work_order_id = v_source_id;
    UPDATE public.inventory_transactions SET work_order_id = v_target_id WHERE work_order_id = v_source_id;
    UPDATE public.purchase_orders SET work_order_id = v_target_id WHERE work_order_id = v_source_id;
    UPDATE public.third_party_services SET work_order_id = v_target_id, updated_at = NOW() WHERE work_order_id = v_source_id;
    UPDATE public.gas_cylinder_movements SET work_order_id = v_target_id WHERE work_order_id = v_source_id;
    UPDATE public.purchase_documents SET work_order_id = v_target_id WHERE work_order_id = v_source_id;

    UPDATE public.work_orders
       SET status = 'Unificada',
           merged_into_wo_id = v_target_id,
           notes = TRIM(BOTH E'\n' FROM COALESCE(notes, '') || E'\n[UNIFICADA EN OT-3] Consolidación automática de duplicado CAMBIO CHAPA (NONO PASCUAL).')
     WHERE id = v_source_id;

    SELECT EXISTS (
      SELECT 1 FROM public.work_items WHERE work_order_id = v_target_id AND status = 'En ejecución'
    ) INTO v_has_active_item;

    IF v_has_active_item THEN
      UPDATE public.work_orders
         SET status = 'En Progreso',
             closed_at = NULL
       WHERE id = v_target_id;
    END IF;
  END IF;
END $$;

-- 4. Regla física anti-duplicado: un mismo buque no puede tener dos OTs no unificadas con el mismo nombre
CREATE UNIQUE INDEX IF NOT EXISTS work_orders_unique_active_title_per_ship
  ON public.work_orders (ship_id, UPPER(TRIM(title)))
  WHERE merged_into_wo_id IS NULL AND status <> 'Unificada';

COMMIT;
