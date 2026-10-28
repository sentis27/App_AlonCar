-- ==============================================================================
-- MIGRACIÓN 0026: AJUSTES COMPRAS, PEDIDO INCOMPLETO Y ALERTAS SE COMPRA?
-- ==============================================================================

-- 1. Permitir 'SOLICITUD' y flexibilizar estados en purchase_orders
ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;

ALTER TABLE public.purchase_orders 
  ADD CONSTRAINT purchase_orders_status_check CHECK (status IN (
    'PEDIR',
    'SOLICITUD',
    'PEDIDO',
    'COTIZACION',
    'COTIZAR',
    'COTIZA.SOLICITUD',
    'COTIZA.APROBADA',
    'COTIZA.RECHAZADA',
    'RECIBIDO',
    'RECIB.COMP.DIRECT',
    'RECIBIDO 2',
    'PEDIDO INCOMPLETO',
    'CANCELADOS',
    'SE COMPRA?',
    'NO VENDEN'
  ));

-- 2. Columnas para trazabilidad de Pedido Incompleto y Remito
ALTER TABLE public.purchase_orders 
  ADD COLUMN IF NOT EXISTS remito_number TEXT,
  ADD COLUMN IF NOT EXISTS parent_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS received_quantity NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS missing_quantity NUMERIC(10,2);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_parent ON public.purchase_orders(parent_order_id);

-- 3. Flexibilizar doc_type en purchase_documents para admitir FACTURA, REMITO, etc.
ALTER TABLE public.purchase_documents DROP CONSTRAINT IF EXISTS purchase_documents_doc_type_check;

ALTER TABLE public.purchase_documents 
  ADD CONSTRAINT purchase_documents_doc_type_check CHECK (doc_type IN (
    'COTIZACION_MATERIAL',
    'COTIZACION_MANO_OBRA',
    'FICHA_TECNICA',
    'IMAGEN_MUESTRA',
    'REMITO_FACTURA',
    'FACTURA',
    'REMITO'
  ));

-- 4. Preconfigurar configuración inicial para la alerta "SE COMPRA?" en system_settings
INSERT INTO public.system_settings (key, value, updated_by)
VALUES (
  'se_compra_alertas',
  '{
    "hugo": { "name": "Hugo Sentis", "role": "Gerente General", "phone": "5492235000001", "email": "hugo@aloncar.com", "enabled": true },
    "martin": { "name": "Martín Sentis", "role": "Gerente de Operaciones", "phone": "5492235000002", "email": "martin@aloncar.com", "enabled": true },
    "foreman": { "name": "Jefe de Obra OT", "role": "Jefe de Obra Asignado", "auto_from_ot": true, "enabled": true },
    "auto_notify": true
  }'::jsonb,
  'Sistema'
)
ON CONFLICT (key) DO NOTHING;
