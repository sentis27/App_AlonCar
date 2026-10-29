-- ==============================================================================
-- MIGRACIÓN 0029: AJUSTES GENERALES EN COMPRAS (FECHA ENTREGA, FLETE Y ESTADOS)
-- ==============================================================================

-- 1. Unificar registros históricos en estado 'SOLICITUD' hacia 'PEDIR'
UPDATE public.purchase_orders
SET status = 'PEDIR'
WHERE status = 'SOLICITUD';

-- 2. Agregar columna de Fecha de Entrega (tabla general, independiente del flete)
--    y columnas de Datos de Flete (Transporte, Fecha Solicitud, Fecha Estimada)
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS delivery_date DATE,
  ADD COLUMN IF NOT EXISTS freight_transport_name TEXT,
  ADD COLUMN IF NOT EXISTS freight_request_date DATE,
  ADD COLUMN IF NOT EXISTS freight_estimated_date DATE;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_delivery_date ON public.purchase_orders(delivery_date);
