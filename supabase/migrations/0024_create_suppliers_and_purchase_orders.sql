-- ==============================================================================
-- MIGRACIÓN 0024: MÓDULO DE COMPRAS (M4b) - PROVEEDORES DINÁMICOS, PEDIDOS,
-- HISTORIAL DE PRECIOS Y CONCILIACIÓN "LÍNEA MORADA"
-- ==============================================================================

-- 1. EXTENSIÓN DE TABLA MATERIALS (Para precios del sistema, rubro y factor de seguridad)
ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS cost_ars NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rubro TEXT,
  ADD COLUMN IF NOT EXISTS security_factor NUMERIC(5,2) DEFAULT 1.06,
  ADD COLUMN IF NOT EXISTS unit_measure TEXT DEFAULT 'Unidad',
  ADD COLUMN IF NOT EXISTS last_price_update TIMESTAMPTZ DEFAULT now();

-- Actualizar materiales existentes con valores de muestra
UPDATE public.materials SET
  cost_ars = 45000,
  cost_usd = 30,
  rubro = 'SOLDADURA',
  unit_measure = 'Kilos'
WHERE name ILIKE '%Electrodo%';

UPDATE public.materials SET
  cost_ars = 6500,
  cost_usd = 4.33,
  rubro = 'HERRAMIENTAS',
  unit_measure = 'Unidad'
WHERE name ILIKE '%Disco%';

UPDATE public.materials SET
  cost_ars = 78000,
  cost_usd = 52,
  rubro = 'PINTURA',
  unit_measure = 'Litros'
WHERE name ILIKE '%Pintura%';

-- Insertar materiales clave adicionales de GS-006
INSERT INTO public.materials (name, category, rubro, current_stock, minimum_stock, cost_ars, cost_usd, unit_measure)
VALUES
  ('GAS OXIGENO INDUSTRIAL TUBO', 'Gases', 'GASES', 15, 5, 81400, 54.26, 'Tubo'),
  ('GAS ACETILENO TUBO', 'Gases', 'GASES', 8, 3, 120000, 80.00, 'Tubo'),
  ('GAS TUBO PROPANO X 45KG', 'Gases', 'GASES', 4, 2, 114510, 76.34, 'Tubo'),
  ('ARENA X MT BOLSON', 'Consumibles', 'MATERIALES', 0, 0, 39644, 26.42, 'Bolsón'),
  ('BUJE BRONCE POLIURETANO', 'Repuestos', 'TORNERIA', 0, 0, 3373715, 2249.14, 'Pieza'),
  ('BULON ZINCADO 1/2" x 2"', 'Fijaciones', 'BULONES', 250, 50, 1850, 1.23, 'Unidad'),
  ('TUERCA AUTOFR 1/2"', 'Fijaciones', 'BULONES', 300, 50, 950, 0.63, 'Unidad'),
  ('CHAPA NAVAL 1/4" (6.35mm)', 'Metales', 'CHAPAS', 12, 4, 450000, 300.00, 'Chapa')
ON CONFLICT DO NOTHING;


-- 2. TABLA PUBLIC.SUPPLIERS (Catálogo Dinámico Unificado de Proveedores)
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  cuit_cuil TEXT,
  trade TEXT, -- Rubro: Ferretería, Tornería, Gases, Pintura, Maderas, Calderería, etc.
  payment_method TEXT DEFAULT 'CUENTA_CORRIENTE' CHECK (payment_method IN ('CONTADO', 'CUENTA_CORRIENTE')),
  billing_timing TEXT DEFAULT 'INICIO_DE_MES' CHECK (billing_timing IN ('DIA', 'INICIO_DE_MES', 'ALEATORIO')),
  billing_medium TEXT DEFAULT 'EMAIL' CHECK (billing_medium IN ('EMAIL', 'WHATSAPP', 'EN_MANO')),
  late_billing_alert BOOLEAN DEFAULT false,
  
  -- Canales y datos de contacto directo
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  observations TEXT,

  -- Parámetros específicos para proveedores de Gases (Regla P-02)
  is_gas_supplier BOOLEAN DEFAULT false,
  client_number TEXT,    -- Ej: '2234867' (Air Liquide)
  order_cutoff_day TEXT, -- Ej: 'Martes antes de las 12:00'
  delivery_day TEXT,     -- Ej: 'Miércoles'
  order_channel TEXT,    -- Ej: '0810-222-5272 / WhatsApp'

  -- Habilitaciones operativas por módulo
  enabled_purchases BOOLEAN DEFAULT true,
  enabled_third_party BOOLEAN DEFAULT false,
  enabled_materials BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_name ON public.suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_is_gas ON public.suppliers(is_gas_supplier) WHERE is_gas_supplier = true;
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON public.suppliers(is_active);


-- 3. PRECARGA INICIAL DE PROVEEDORES HABITUALES (GS-006 y Talleres)
INSERT INTO public.suppliers (
  name, trade, cuit_cuil, phone, email, contact_name, payment_method, billing_timing, billing_medium,
  is_gas_supplier, client_number, order_cutoff_day, delivery_day, order_channel,
  enabled_purchases, enabled_third_party, observations
)
VALUES
  (
    'AIR LIQUIDE', 'GASES', '30-50014764-9', '08102225272', 'pedidos@airliquide.com.ar', 'Atención Comercial',
    'CUENTA_CORRIENTE', 'INICIO_DE_MES', 'EMAIL',
    true, '2234867', 'Martes antes de las 12:00', 'Miércoles', '0810-222-5272 / WhatsApp',
    true, false, 'Proveedor oficial de oxígeno y acetileno en batería/tubos semanales.'
  ),
  (
    'PRAXAIR LINDE', 'GASES', '30-50029871-0', '+5492235550192', 'ventas.mdp@linde.com', 'Representante Comercial',
    'CUENTA_CORRIENTE', 'INICIO_DE_MES', 'EMAIL',
    true, 'AR-88391', 'Lunes (cada 15 días)', 'Martes', 'Portal Web / Teléfono',
    true, false, 'Proveedor de gases especiales y mezcla de soldadura cada 15 días.'
  ),
  (
    'FERREMAT', 'FERRETERIA', '30-68912345-4', '+5492234810922', 'ventas@ferremat.com.ar', 'Mostrador',
    'CUENTA_CORRIENTE', 'DIA', 'WHATSAPP',
    true, null, 'Inmediato', 'Inmediato', 'WhatsApp / Mostrador',
    true, false, 'Ferretería industrial y proveedor de emergencia de gases de recambio rápido.'
  ),
  (
    'ATLANTICA GAS', 'GASES', '30-71123456-8', '+5492234720911', 'atlantica@gas.com.ar', 'Despacho',
    'CONTADO', 'DIA', 'EN_MANO',
    true, 'AG-104', 'Lunes a Viernes', '24hs', 'Teléfono',
    true, false, 'Garrafas propano 45kg y gas envasado.'
  ),
  (
    'CASA CARLITOS', 'MATERIALES', '30-65432109-1', '+5492234991200', 'contacto@casacarlitos.com.ar', 'Carlos',
    'CUENTA_CORRIENTE', 'INICIO_DE_MES', 'WHATSAPP',
    false, null, null, null, null,
    true, false, 'Áridos, arena por metro bolsón, cemento y materiales pesados.'
  ),
  (
    'CIARDI', 'ELECTRICIDAD', '30-54321678-2', '+5492234778899', 'marplata@ciardi.com.ar', 'Ventas Industriales',
    'CUENTA_CORRIENTE', 'INICIO_DE_MES', 'EMAIL',
    false, null, null, null, null,
    true, false, 'Materiales eléctricos, cables navales, llaves térmicas y luminarias.'
  ),
  (
    'LOTTERI HNOS', 'TORNERIA', '30-61234567-3', '+5492234801122', 'lotterihnos@speedy.com.ar', 'Ing. Lotteri',
    'CUENTA_CORRIENTE', 'DIA', 'WHATSAPP',
    false, null, null, null, null,
    true, true, 'Tornería pesada, bujes de timón y línea de eje en bronce y poliuretano.'
  ),
  (
    'ALFAMETAL de Hector Orlando Jano', 'METALES', '20-14235890-4', '+5492234703344', 'alfametaljano@gmail.com', 'Héctor Jano',
    'CONTADO', 'DIA', 'WHATSAPP',
    false, null, null, null, null,
    true, false, 'Chapas de acero naval, perfiles UPN, planchuelas y tubos sin costura.'
  ),
  (
    'CERREMAQ', 'HERRAMIENTAS', '30-70891234-5', '+5492234956677', 'ventas@cerremaq.com.ar', 'Mostrador',
    'CUENTA_CORRIENTE', 'INICIO_DE_MES', 'EMAIL',
    false, null, null, null, null,
    true, false, 'Maquinarias, discos de corte, electrodos y consumibles de soldadura.'
  ),
  (
    'FERRETERIA FLORIDA', 'BULONERIA', '30-62345678-6', '+5492234751133', 'floridaferreteria@gmail.com', 'Roberto',
    'CUENTA_CORRIENTE', 'DIA', 'WHATSAPP',
    false, null, null, null, null,
    true, false, 'Bulonería estándar, inoxidable y grado 8, tuercas y arandelas.'
  ),
  (
    'PEX-MAR S.R.L (MATAFUEGOS)', 'SERVICIOS', '30-70123456-7', '+5492234821100', 'pexmar@pexmar.com.ar', 'Oficina Técnica',
    'CUENTA_CORRIENTE', 'INICIO_DE_MES', 'EMAIL',
    false, null, null, null, null,
    true, true, 'Recarga de matafuegos, balsas salvavidas y certificación naval de seguridad.'
  ),
  (
    'CORMETAL S.A.', 'CORTE/PLEGADO', '30-58923412-8', '+5492234789012', 'cormetal@cormetal.com.ar', 'Producción',
    'CUENTA_CORRIENTE', 'DIA', 'WHATSAPP',
    false, null, null, null, null,
    true, true, 'Corte por pantógrafo CNC, plegado y rolado de chapas de gran espesor.'
  ),
  (
    'TECNICA OLEOHIDRAULICA LESIN S.A', 'HIDRAULICA', '30-63456789-9', '+5492234815566', 'lesin@oleohidraulica.com.ar', 'Ingeniería',
    'CUENTA_CORRIENTE', 'INICIO_DE_MES', 'EMAIL',
    false, null, null, null, null,
    true, true, 'Bombas hidráulicas, mangueras de alta presión y mandos de viradores.'
  )
ON CONFLICT (name) DO NOTHING;


-- 4. ASEGURAR ORDEN DE TRABAJO "STOCK" PARA EL ASTILLERO
DO $$
DECLARE
  v_astillero_id UUID;
  v_stock_wo_id UUID;
BEGIN
  SELECT id INTO v_astillero_id FROM public.ships WHERE name = 'ASTILLERO' LIMIT 1;
  
  IF v_astillero_id IS NOT NULL THEN
    SELECT id INTO v_stock_wo_id FROM public.work_orders WHERE ship_id = v_astillero_id AND title = 'STOCK' LIMIT 1;
    
    IF v_stock_wo_id IS NULL THEN
      INSERT INTO public.work_orders (ship_id, title, description, status)
      VALUES (v_astillero_id, 'STOCK', 'Reposición de Insumos y Materiales de Pañol Central', 'En Progreso');
    END IF;
  END IF;
END $$;


-- 5. TABLA PUBLIC.PURCHASE_ORDERS (Registro de Compras y Pedidos)
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Destino e Imputación
  charge_type TEXT NOT NULL DEFAULT 'DIRECT' CHECK (charge_type IN ('DIRECT', 'STANDBY', 'VIA_PANOL')),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ship_id UUID REFERENCES public.ships(id) ON DELETE RESTRICT,
  work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
  requested_by UUID REFERENCES public.workers(id) ON DELETE SET NULL,
  requested_by_name TEXT,
  work_type TEXT DEFAULT 'MATERIALES',
  
  -- Material y Cantidad
  material_id UUID REFERENCES public.materials(id) ON DELETE SET NULL,
  material_name_raw TEXT NOT NULL,
  is_new_material BOOLEAN DEFAULT false,
  quantity NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
  unit_measure TEXT DEFAULT 'Unidad',
  
  -- Evaluación Económica y Proveedor
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  supplier_quoted_price NUMERIC(12,2),
  system_unit_price NUMERIC(12,2),
  currency TEXT DEFAULT 'ARS' CHECK (currency IN ('ARS', 'USD')),
  
  -- Logística y Estado del Pedido
  estimated_delivery DATE,
  status TEXT NOT NULL DEFAULT 'PEDIR' CHECK (status IN (
    'PEDIR',             -- Solicitud lista para emitir orden
    'PEDIDO',            -- Orden emitida al proveedor
    'COTIZACION',        -- Se solicitó cotización de precios
    'COTIZAR',           -- Pendiente de enviar a cotizar
    'COTIZA.SOLICITUD',  -- Cotización enviada al proveedor, esperando respuesta
    'COTIZA.APROBADA',   -- Cotización aceptada por supervisor
    'COTIZA.RECHAZADA',  -- Cotización desestimada
    'RECIBIDO',          -- Llegó al astillero -> Suma a Stock Pañol
    'RECIB.COMP.DIRECT', -- Llegó al astillero -> Imputa a Costo de Buque
    'RECIBIDO 2',        -- Material aportado por cliente
    'PEDIDO INCOMPLETO', -- Llegada parcial
    'CANCELADOS',        -- Pedido anulado
    'SE COMPRA?',        -- En evaluación de necesidad
    'NO VENDEN'          -- Proveedor no comercializa el ítem
  )),
  stock_condition TEXT DEFAULT 'STOCK' CHECK (stock_condition IN ('STOCK', 'VIRTUAL', 'FALTA_INFO')),
  
  -- Conciliación de Facturas ("Línea Morada")
  is_reconciled BOOLEAN DEFAULT false,
  reconciled_at TIMESTAMPTZ,
  reconciled_by TEXT,
  invoice_number TEXT,
  
  -- Control Quincenal y Automatizaciones
  fortnight_period TEXT NOT NULL, -- Formato: 'YYYY-MM-Q1' o 'YYYY-MM-Q2'
  created_by_automation BOOLEAN DEFAULT false,
  observations TEXT,
  
  -- Auditoría
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_fortnight ON public.purchase_orders(fortnight_period);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_ship_ot ON public.purchase_orders(ship_id, work_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_reconciled ON public.purchase_orders(supplier_id, is_reconciled);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_new_mat ON public.purchase_orders(is_new_material) WHERE is_new_material = true;


-- 6. TABLA PUBLIC.MATERIAL_PRICE_LOG (Historial de Precios de Materiales)
CREATE TABLE IF NOT EXISTS public.material_price_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID REFERENCES public.materials(id) ON DELETE CASCADE NOT NULL,
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  previous_price_ars NUMERIC(12,2),
  new_price_ars NUMERIC(12,2) NOT NULL,
  previous_price_usd NUMERIC(12,2),
  new_price_usd NUMERIC(12,2),
  exchange_rate NUMERIC(10,2),
  fortnight_period TEXT NOT NULL,
  changed_by TEXT,
  changed_at TIMESTAMPTZ DEFAULT now(),
  reason TEXT DEFAULT 'ACTUALIZACION_POR_COMPRA'
);

CREATE INDEX IF NOT EXISTS idx_price_log_material ON public.material_price_log(material_id);
CREATE INDEX IF NOT EXISTS idx_price_log_supplier ON public.material_price_log(supplier_id);


-- 7. EXTENSIÓN DE TABLA PUBLIC.PURCHASE_DOCUMENTS (Gestor Documental 1-Clic)
ALTER TABLE public.purchase_documents
  ADD COLUMN IF NOT EXISTS purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS normalized_filename TEXT,
  ADD COLUMN IF NOT EXISTS year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  ADD COLUMN IF NOT EXISTS file_size_bytes INTEGER;

CREATE INDEX IF NOT EXISTS idx_purchase_docs_po ON public.purchase_documents(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_docs_supplier ON public.purchase_documents(supplier_id);


-- 8. PRECARGA DE COMPRAS DE EJEMPLO REALES (Basadas en GS-006)
DO $$
DECLARE
  v_astillero_id UUID;
  v_ship_vicente_id UUID;
  v_ship_suenos_id UUID;
  v_stock_wo_id UUID;
  v_vicente_wo_id UUID;
  v_suenos_wo_id UUID;
  v_prov_airliquide UUID;
  v_prov_atlantica UUID;
  v_prov_ferremat UUID;
  v_prov_carlitos UUID;
  v_prov_lotteri UUID;
  v_prov_ciardi UUID;
  v_mat_oxigeno UUID;
  v_mat_gas45 UUID;
  v_mat_arena UUID;
  v_mat_buje UUID;
  v_mat_tuerca UUID;
BEGIN
  -- Obtener Buques
  SELECT id INTO v_astillero_id FROM public.ships WHERE name = 'ASTILLERO' LIMIT 1;
  SELECT id INTO v_ship_vicente_id FROM public.ships WHERE name ILIKE '%VICENTE%' LIMIT 1;
  SELECT id INTO v_ship_suenos_id FROM public.ships WHERE name ILIKE '%SUEÑOS%' LIMIT 1;
  
  -- Obtener OTs
  SELECT id INTO v_stock_wo_id FROM public.work_orders WHERE ship_id = v_astillero_id AND title = 'STOCK' LIMIT 1;
  SELECT id INTO v_vicente_wo_id FROM public.work_orders WHERE ship_id = v_ship_vicente_id LIMIT 1;
  SELECT id INTO v_suenos_wo_id FROM public.work_orders WHERE ship_id = v_ship_suenos_id LIMIT 1;
  
  -- Fallback de buque si alguno es nulo
  IF v_ship_vicente_id IS NULL THEN v_ship_vicente_id := v_astillero_id; END IF;
  IF v_ship_suenos_id IS NULL THEN v_ship_suenos_id := v_astillero_id; END IF;
  IF v_vicente_wo_id IS NULL THEN v_vicente_wo_id := v_stock_wo_id; END IF;
  IF v_suenos_wo_id IS NULL THEN v_suenos_wo_id := v_stock_wo_id; END IF;

  -- Obtener Proveedores
  SELECT id INTO v_prov_airliquide FROM public.suppliers WHERE name = 'AIR LIQUIDE' LIMIT 1;
  SELECT id INTO v_prov_atlantica FROM public.suppliers WHERE name = 'ATLANTICA GAS' LIMIT 1;
  SELECT id INTO v_prov_ferremat FROM public.suppliers WHERE name = 'FERREMAT' LIMIT 1;
  SELECT id INTO v_prov_carlitos FROM public.suppliers WHERE name = 'CASA CARLITOS' LIMIT 1;
  SELECT id INTO v_prov_lotteri FROM public.suppliers WHERE name = 'LOTTERI HNOS' LIMIT 1;
  SELECT id INTO v_prov_ciardi FROM public.suppliers WHERE name = 'CIARDI' LIMIT 1;

  -- Obtener Materiales
  SELECT id INTO v_mat_oxigeno FROM public.materials WHERE name ILIKE '%OXIGENO%' LIMIT 1;
  SELECT id INTO v_mat_gas45 FROM public.materials WHERE name ILIKE '%PROPANO%' LIMIT 1;
  SELECT id INTO v_mat_arena FROM public.materials WHERE name ILIKE '%ARENA%' LIMIT 1;
  SELECT id INTO v_mat_buje FROM public.materials WHERE name ILIKE '%BUJE%' LIMIT 1;
  SELECT id INTO v_mat_tuerca FROM public.materials WHERE name ILIKE '%TUERCA%' LIMIT 1;

  -- Compras de muestra
  INSERT INTO public.purchase_orders (
    charge_type, order_date, ship_id, work_order_id, requested_by_name,
    material_id, material_name_raw, is_new_material, quantity, unit_measure,
    supplier_id, supplier_quoted_price, system_unit_price, estimated_delivery,
    status, stock_condition, is_reconciled, reconciled_at, reconciled_by, invoice_number,
    fortnight_period, observations
  )
  VALUES
    (
      'VIA_PANOL', CURRENT_DATE - 12, v_astillero_id, v_stock_wo_id, 'PAÑOL',
      v_mat_gas45, 'GAS TUBO X 45KG', false, 2, 'Tubo',
      v_prov_atlantica, 114510, 114510, CURRENT_DATE - 11,
      'RECIBIDO', 'STOCK', true, now() - INTERVAL '10 days', 'Supervisor Alon Car', 'FC-A-0001-00049211',
      '2026-10-Q1', 'Línea conciliada con factura física anterior.'
    ),
    (
      'DIRECT', CURRENT_DATE - 9, v_ship_suenos_id, v_suenos_wo_id, 'HUGO',
      v_mat_tuerca, 'TUERCA AUTOFR 1/2"', false, 2, 'Unidad',
      v_prov_ferremat, 950, 950, CURRENT_DATE - 8,
      'RECIB.COMP.DIRECT', 'STOCK', true, now() - INTERVAL '8 days', 'Supervisor Alon Car', 'FC-B-0002-00012890',
      '2026-10-Q1', 'Compra directa imputada a obra Sala de Máquinas.'
    ),
    (
      'DIRECT', CURRENT_DATE - 7, v_ship_suenos_id, v_suenos_wo_id, 'MANUEL',
      v_mat_arena, 'ARENA X MT BOLSON', false, 1, 'Bolsón',
      v_prov_carlitos, 39644, 39644, CURRENT_DATE - 6,
      'RECIB.COMP.DIRECT', 'STOCK', false, null, null, null,
      '2026-10-Q2', 'Arena para granallado de cubierta exterior.'
    ),
    (
      'VIA_PANOL', CURRENT_DATE - 6, v_astillero_id, v_stock_wo_id, 'PAÑOL',
      v_mat_oxigeno, 'BATERIA DE OXIGENO INDUSTRIAL', false, 3, 'Tubo',
      v_prov_airliquide, 81400, 81400, CURRENT_DATE - 5,
      'RECIBIDO', 'STOCK', false, null, null, null,
      '2026-10-Q2', 'Canje semanal de vacíos según protocolo P-02.'
    ),
    (
      'DIRECT', CURRENT_DATE - 3, v_ship_vicente_id, v_vicente_wo_id, 'LUIS M',
      v_mat_buje, 'BUJE BRONCE POLIURETANO', false, 0.46, 'Pieza',
      v_prov_lotteri, 3373715, 3200000, CURRENT_DATE + 2,
      'PEDIDO', 'VIRTUAL', false, null, null, null,
      '2026-10-Q2', 'Línea de eje Don Vicente. Cotización aprobada.'
    ),
    (
      'DIRECT', CURRENT_DATE - 1, v_ship_vicente_id, v_vicente_wo_id, 'ALE CAMADELLI',
      null, 'BANDA MODULAR PLASTICA C/VARILLAS INOX', true, 6, 'Metros',
      v_prov_ferremat, 84000, 0, CURRENT_DATE + 3,
      'COTIZACION', 'VIRTUAL', false, null, null, null,
      '2026-10-Q2', 'Material nuevo sin registro en base maestra. Requiere alta de supervisor.'
    ),
    (
      'VIA_PANOL', CURRENT_DATE, v_astillero_id, v_stock_wo_id, 'PAÑOL',
      v_mat_oxigeno, 'TUBOS OXIGENO REPOSICION SEMANAL', false, 10, 'Tubo',
      v_prov_airliquide, 81400, 81400, CURRENT_DATE + 1,
      'PEDIR', 'VIRTUAL', false, null, null, null,
      '2026-10-Q2', 'Alerta de reposición Air Liquide para emitir los martes antes de las 12hs.'
    )
  ON CONFLICT DO NOTHING;
END $$;


-- 9. PERMISOS Y ROW LEVEL SECURITY (RLS)
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_price_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados y anon en suppliers" ON public.suppliers;
CREATE POLICY "Permitir todo a usuarios autenticados y anon en suppliers"
  ON public.suppliers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados y anon en purchase_orders" ON public.purchase_orders;
CREATE POLICY "Permitir todo a usuarios autenticados y anon en purchase_orders"
  ON public.purchase_orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados y anon en material_price_log" ON public.material_price_log;
CREATE POLICY "Permitir todo a usuarios autenticados y anon en material_price_log"
  ON public.material_price_log FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo en purchase_documents" ON public.purchase_documents;
CREATE POLICY "Permitir todo en purchase_documents"
  ON public.purchase_documents FOR ALL USING (true) WITH CHECK (true);
