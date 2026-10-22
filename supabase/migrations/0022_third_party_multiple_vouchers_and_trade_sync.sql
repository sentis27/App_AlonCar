-- ==============================================================================
-- MIGRACIÓN 0022: MÚLTIPLES COMPROBANTES POR TRABAJO Y SINCRONIZACIÓN DE RUBRO
-- ==============================================================================

-- 1. Campos dedicados para coexistencia de múltiples comprobantes:
--    - Presupuesto Interno (PRC)
--    - Factura Comercial / Comprobante Fiscal (FCR / FCA / FAC / REC)
--    - Remito de Salida / Cruce Pañol (internal_remito_number ya existe)
--    - Remito de Proveedor / Taller (RPF / RMO)
ALTER TABLE public.third_party_services
  ADD COLUMN IF NOT EXISTS budget_number TEXT,
  ADD COLUMN IF NOT EXISTS invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS supplier_remito_number TEXT;

-- 2. Migrar datos existentes en voucher_number según voucher_type
UPDATE public.third_party_services
SET budget_number = voucher_number
WHERE (budget_number IS NULL OR budget_number = '')
  AND voucher_type = 'PRC'
  AND voucher_number IS NOT NULL
  AND voucher_number != '';

UPDATE public.third_party_services
SET invoice_number = voucher_number
WHERE (invoice_number IS NULL OR invoice_number = '')
  AND voucher_type IN ('FCR', 'FCA', 'FAC', 'REC', 'FCB', 'FCC')
  AND voucher_number IS NOT NULL
  AND voucher_number != '';

UPDATE public.third_party_services
SET supplier_remito_number = voucher_number
WHERE (supplier_remito_number IS NULL OR supplier_remito_number = '')
  AND voucher_type IN ('RMO', 'RPF')
  AND voucher_number IS NOT NULL
  AND voucher_number != '';

-- 3. Sincronizar automáticamente el rubro (trade) para registros existentes
--    cargados desde OTs o sin rubro guardado, tomándolo de workers
UPDATE public.third_party_services tps
SET trade = w.trade
FROM public.workers w
WHERE (tps.trade IS NULL OR tps.trade = '' OR tps.trade = 'Sin Rubro')
  AND UPPER(TRIM(w.name)) = UPPER(TRIM(tps.contractor_name))
  AND w.trade IS NOT NULL
  AND UPPER(TRIM(w.trade)) NOT IN ('MANUAL', 'POLIRRUBRO', '');
