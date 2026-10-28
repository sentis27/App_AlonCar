-- ==============================================================================
-- MIGRACIÓN 0025: MEJORAS EN COMPRAS (M4b)
-- 1. URGENCIA EN PEDIDOS DE COMPRA
-- 2. MULTI-RUBRO EN PROVEEDORES
-- 3. CLASIFICACIÓN DE DOCUMENTOS (MATERIAL VS MANO DE OBRA / FICHAS / FOTOS)
-- 4. CONFIGURACIÓN CENTRALIZADA DE COMPRADORES Y WHATSAPP (PANEL ADMIN)
-- ==============================================================================

-- 1. SOPORTE DE URGENCIA EN PURCHASE_ORDERS
ALTER TABLE public.purchase_orders 
  ADD COLUMN IF NOT EXISTS urgency TEXT DEFAULT 'SIN_APURO' CHECK (urgency IN ('URGENTE', 'SIN_APURO', 'PROXIMA_SALIDA'));

CREATE INDEX IF NOT EXISTS idx_purchase_orders_urgency ON public.purchase_orders(urgency);


-- 2. SOPORTE MULTI-RUBRO EN PROVEEDORES (Array de Trades)
ALTER TABLE public.suppliers 
  ADD COLUMN IF NOT EXISTS trades TEXT[] DEFAULT '{}';

-- Migrar los rubros existentes a la columna trades
UPDATE public.suppliers 
SET trades = ARRAY[trade]
WHERE (trades IS NULL OR trades = '{}') AND trade IS NOT NULL AND trade <> '';


-- 3. SOPORTE DE TIPO DE DOCUMENTO Y CONFIDENCIALIDAD EN PURCHASE_DOCUMENTS
ALTER TABLE public.purchase_documents 
  ADD COLUMN IF NOT EXISTS doc_type TEXT DEFAULT 'COTIZACION_MATERIAL' 
    CHECK (doc_type IN ('COTIZACION_MATERIAL', 'COTIZACION_MANO_OBRA', 'FICHA_TECNICA', 'IMAGEN_MUESTRA', 'REMITO_FACTURA')),
  ADD COLUMN IF NOT EXISTS is_confidential_labor BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_purchase_docs_type ON public.purchase_documents(doc_type);


-- 4. TABLA DE CONFIGURACIONES DEL SISTEMA (Para Panel de Administrador)
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by TEXT
);

-- RLS para system_settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir todo a autenticados y anon en system_settings" ON public.system_settings;
CREATE POLICY "Permitir todo a autenticados y anon en system_settings"
  ON public.system_settings FOR ALL USING (true) WITH CHECK (true);

-- Configuración inicial para los 2 compradores oficiales de Compras
INSERT INTO public.system_settings (key, value)
VALUES (
  'compras_whatsapp',
  '{
    "buyer_1": {
      "name": "Jorge Sentis",
      "phone": "+5492235000001",
      "role": "Administración / Compras",
      "is_active": true
    },
    "buyer_2": {
      "name": "Andrés",
      "phone": "+5492235000002",
      "role": "Pañol / Compras",
      "is_active": true
    },
    "message_greeting": "Estimados,\nDesde Alon Car S.A. les enviamos el siguiente pedido de compra:",
    "auto_format_phone": true
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;
