-- ============================================================================
-- MIGRACIÓN 0028: DESACOPLAMIENTO DE BUQUE Y OT + SOPORTE DE OT EN BLANCO
-- ============================================================================
-- Propósito:
-- 1. Agregar columna directa `ship_id` en `labor_logs` e `inventory_transactions`
--    para que registros operativos puedan imputarse a un buque con OT en blanco (NULL).
-- 2. Asegurar que `work_order_id` sea NULLABLE en todas las tablas receptoras de costos.
-- 3. Backfill retroactivo de `ship_id` para todos los registros históricos.
-- 4. Índices para acelerar conteo y filtrado en los KPIs de "⚠️ Falta Cargar OT".
-- ============================================================================

-- 1. LABOR_LOGS (Horas)
ALTER TABLE public.labor_logs 
  ADD COLUMN IF NOT EXISTS ship_id UUID REFERENCES public.ships(id) ON DELETE SET NULL;

ALTER TABLE public.labor_logs 
  ALTER COLUMN work_order_id DROP NOT NULL;

-- Backfill de ship_id a partir de work_orders
UPDATE public.labor_logs ll
SET ship_id = wo.ship_id
FROM public.work_orders wo
WHERE ll.work_order_id = wo.id 
  AND ll.ship_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_labor_logs_ship_ot 
  ON public.labor_logs(ship_id, work_order_id);

CREATE INDEX IF NOT EXISTS idx_labor_logs_missing_ot 
  ON public.labor_logs(ship_id) 
  WHERE work_order_id IS NULL;

-- 2. THIRD_PARTY_SERVICES (Terceros)
ALTER TABLE public.third_party_services 
  ALTER COLUMN work_order_id DROP NOT NULL;

UPDATE public.third_party_services tps
SET ship_id = wo.ship_id
FROM public.work_orders wo
WHERE tps.work_order_id = wo.id 
  AND tps.ship_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_tps_ship_ot 
  ON public.third_party_services(ship_id, work_order_id);

CREATE INDEX IF NOT EXISTS idx_tps_missing_ot 
  ON public.third_party_services(ship_id) 
  WHERE work_order_id IS NULL;

-- 3. PURCHASE_ORDERS (Compras)
ALTER TABLE public.purchase_orders 
  ALTER COLUMN work_order_id DROP NOT NULL;

UPDATE public.purchase_orders po
SET ship_id = wo.ship_id
FROM public.work_orders wo
WHERE po.work_order_id = wo.id 
  AND po.ship_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_po_missing_ot 
  ON public.purchase_orders(charge_type, ship_id) 
  WHERE work_order_id IS NULL;

-- 4. INVENTORY_TRANSACTIONS (Pañol / Materiales)
ALTER TABLE public.inventory_transactions 
  ADD COLUMN IF NOT EXISTS ship_id UUID REFERENCES public.ships(id) ON DELETE SET NULL;

ALTER TABLE public.inventory_transactions 
  ALTER COLUMN work_order_id DROP NOT NULL;

UPDATE public.inventory_transactions it
SET ship_id = wo.ship_id
FROM public.work_orders wo
WHERE it.work_order_id = wo.id 
  AND it.ship_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_ship_ot 
  ON public.inventory_transactions(ship_id, work_order_id);
