-- ==============================================================================
-- MIGRACIÓN 0033: MÓDULO PAÑOL, MATERIALES, RUBROS OFICIALES Y CONTROL DE GASES NAVALES
-- ==============================================================================
-- Propósito:
-- 1. Tabla maestra de rubros técnicos oficiales (material_rubros).
-- 2. Extensión de inventory_transactions para trazabilidad de operarios y costos snapshot.
-- 3. Tabla dedicada para trazabilidad de tubos/cilindros retornables (gas_cylinder_movements).
-- 4. Alta de proveedor interno para tubos propios de Alon Car.
-- 5. Índices de aceleración y políticas de seguridad RLS.
-- ==============================================================================

-- 1. TABLA MAESTRA DE RUBROS TÉCNICOS (material_rubros)
CREATE TABLE IF NOT EXISTS public.material_rubros (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL CHECK (category IN ('MATERIALES', 'CONSUMIBLES', 'ELEM.SEGURIDAD')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.material_rubros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access material_rubros" ON public.material_rubros;
CREATE POLICY "Public access material_rubros" ON public.material_rubros FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON public.material_rubros TO anon, authenticated, service_role;

-- Precargar los 24 rubros técnicos navales oficiales
INSERT INTO public.material_rubros (name, category) VALUES
  ('ACEROS Y CHAPAS', 'MATERIALES'),
  ('PERFILES Y TUBOS', 'MATERIALES'),
  ('TORNERIA Y EJES', 'MATERIALES'),
  ('CAÑERIA Y ACCESORIOS', 'MATERIALES'),
  ('VALVULAS Y BRIDAS', 'MATERIALES'),
  ('BULONERIA Y FIJACIONES', 'MATERIALES'),
  ('MADERAS Y FENOLICOS', 'MATERIALES'),
  ('SOLDADURA Y ELECTRODOS', 'CONSUMIBLES'),
  ('GASES INDUSTRIALES', 'CONSUMIBLES'),
  ('DISCOS Y ABRASIVOS', 'CONSUMIBLES'),
  ('PINTURAS Y FONDOS', 'CONSUMIBLES'),
  ('DILUYENTES Y SOLVENTES', 'CONSUMIBLES'),
  ('ARENA Y GRANALLADO', 'CONSUMIBLES'),
  ('ELECTRICIDAD Y CABLES', 'MATERIALES'),
  ('LUBRICANTES Y ACEITES', 'CONSUMIBLES'),
  ('ELEMENTOS DE SEGURIDAD (EPP)', 'ELEM.SEGURIDAD'),
  ('PROTECCION OCULAR Y FACIAL', 'ELEM.SEGURIDAD'),
  ('PROTECCION AUDITIVA', 'ELEM.SEGURIDAD'),
  ('CALZADO DE SEGURIDAD', 'ELEM.SEGURIDAD'),
  ('HERRAMIENTAS MENORES', 'CONSUMIBLES'),
  ('CABOS Y AMARRAS', 'MATERIALES'),
  ('HIDRAULICA Y MANGUERAS', 'MATERIALES'),
  ('FLETES Y LOGISTICA', 'CONSUMIBLES'),
  ('VARIOS Y GENERAL', 'CONSUMIBLES')
ON CONFLICT (name) DO UPDATE SET is_active = true;

-- 2. EXTENSIÓN DE INVENTORY_TRANSACTIONS (Retiros y Kárdex Operativo de Insumos)
ALTER TABLE public.inventory_transactions
  ADD COLUMN IF NOT EXISTS voucher_number TEXT,
  ADD COLUMN IF NOT EXISTS worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS worker_name TEXT,
  ADD COLUMN IF NOT EXISTS movement_type TEXT DEFAULT 'CONSUMO_OBRA',
  ADD COLUMN IF NOT EXISTS unit_cost_ars_snapshot NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_cost_usd_snapshot NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_inv_tx_worker ON public.inventory_transactions(worker_id);
CREATE INDEX IF NOT EXISTS idx_inv_tx_type ON public.inventory_transactions(movement_type);
CREATE INDEX IF NOT EXISTS idx_inv_tx_date ON public.inventory_transactions(transaction_date);

-- 3. TABLA DE CONTROL DE GASES Y CILINDROS RETORNABLES (gas_cylinder_movements)
CREATE TABLE IF NOT EXISTS public.gas_cylinder_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    movement_date TIMESTAMPTZ DEFAULT now(),
    operation_type TEXT NOT NULL CHECK (operation_type IN ('PRIMERA_ENTREGA', 'RECAMBIO_1X1', 'DEVOLUCION_FINAL', 'AJUSTE_PATIO')),
    material_id UUID REFERENCES public.materials(id) ON DELETE RESTRICT,
    ship_id UUID REFERENCES public.ships(id) ON DELETE SET NULL,
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
    contractor_name TEXT NOT NULL,
    worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
    worker_name TEXT,
    supplier_delivered_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    supplier_returned_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    quantity INTEGER DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.gas_cylinder_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access gas_cylinder_movements" ON public.gas_cylinder_movements;
CREATE POLICY "Public access gas_cylinder_movements" ON public.gas_cylinder_movements FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON public.gas_cylinder_movements TO anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_gas_contractor ON public.gas_cylinder_movements(contractor_name);
CREATE INDEX IF NOT EXISTS idx_gas_material ON public.gas_cylinder_movements(material_id);
CREATE INDEX IF NOT EXISTS idx_gas_date ON public.gas_cylinder_movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_gas_op_type ON public.gas_cylinder_movements(operation_type);

-- 4. PROVEEDOR INTERNO DE ENVASES PROPIOS ALON CAR
INSERT INTO public.suppliers (
  name, trade, payment_method, billing_timing, billing_medium,
  is_gas_supplier, is_active, observations
)
VALUES (
  'PROPIOS ASTILLERO ALON CAR', 'GASES', 'CONTADO', 'ALEATORIO', 'EN_MANO',
  true, true, 'Envases, garrafas y baterias de cilindros propiedad del astillero Alon Car.'
)
ON CONFLICT DO NOTHING;

-- 5. SEMILLA INICIAL DE DATOS PARA TESTING OPERATIVO EN GASES (Si no existen registros)
DO $$
DECLARE
  v_mat_oxigeno UUID;
  v_mat_acetileno UUID;
  v_mat_gas45 UUID;
  v_prov_airliquide UUID;
  v_prov_linde UUID;
  v_ship_id UUID;
  v_wo_id UUID;
  v_count INTEGER;
BEGIN
  SELECT count(*) INTO v_count FROM public.gas_cylinder_movements;
  IF v_count = 0 THEN
    SELECT id INTO v_mat_oxigeno FROM public.materials WHERE name ILIKE '%OXIGENO%' LIMIT 1;
    SELECT id INTO v_mat_acetileno FROM public.materials WHERE name ILIKE '%ACETILENO%' LIMIT 1;
    SELECT id INTO v_mat_gas45 FROM public.materials WHERE name ILIKE '%PROPANO%' OR name ILIKE '%GAS%45%' LIMIT 1;
    SELECT id INTO v_prov_airliquide FROM public.suppliers WHERE name ILIKE '%AIR LIQUIDE%' LIMIT 1;
    SELECT id INTO v_prov_linde FROM public.suppliers WHERE name ILIKE '%LINDE%' OR name ILIKE '%PRAXAIR%' LIMIT 1;
    SELECT id INTO v_ship_id FROM public.ships LIMIT 1;
    SELECT id INTO v_wo_id FROM public.work_orders LIMIT 1;

    IF v_mat_oxigeno IS NOT NULL AND v_prov_airliquide IS NOT NULL THEN
      -- Movimiento 1: Primera entrega hace 18 días (dispara alerta P-01 >15 días)
      INSERT INTO public.gas_cylinder_movements (
        movement_date, operation_type, material_id, ship_id, work_order_id,
        contractor_name, supplier_delivered_id, quantity, notes
      ) VALUES (
        now() - INTERVAL '18 days', 'PRIMERA_ENTREGA', v_mat_oxigeno, v_ship_id, v_wo_id,
        'TECO TALLER NAVAL', v_prov_airliquide, 2, 'Entrega para oxicorte en sala de maquinas.'
      );

      -- Movimiento 2: Recambio 1x1 hace 3 días
      INSERT INTO public.gas_cylinder_movements (
        movement_date, operation_type, material_id, ship_id, work_order_id,
        contractor_name, supplier_delivered_id, supplier_returned_id, quantity, notes
      ) VALUES (
        now() - INTERVAL '3 days', 'RECAMBIO_1X1', v_mat_oxigeno, v_ship_id, v_wo_id,
        'TECO TALLER NAVAL', v_prov_airliquide, v_prov_airliquide, 1, 'Recambio de tubo vacio por lleno.'
      );
    END IF;

    IF v_mat_acetileno IS NOT NULL AND v_prov_linde IS NOT NULL THEN
      -- Movimiento 3: Primera entrega hace 5 días
      INSERT INTO public.gas_cylinder_movements (
        movement_date, operation_type, material_id, ship_id, work_order_id,
        contractor_name, supplier_delivered_id, quantity, notes
      ) VALUES (
        now() - INTERVAL '5 days', 'PRIMERA_ENTREGA', v_mat_acetileno, v_ship_id, v_wo_id,
        'ASTILLERO.MECANICA', v_prov_linde, 1, 'Uso interno en banco de pruebas.'
      );
    END IF;
  END IF;
END $$;
