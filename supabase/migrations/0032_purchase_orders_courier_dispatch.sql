-- 0032_purchase_orders_courier_dispatch.sql
-- Trazabilidad de retiro por mandados en órdenes de compra

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS courier_dispatched BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS courier_dispatched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS courier_worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS courier_worker_name TEXT;
