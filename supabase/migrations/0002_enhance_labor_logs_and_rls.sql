-- ============================================================
-- ALON CAR ERP - SCRIPT MAESTRO Y DEFINITIVO (AUTO-CORRECTIVO)
-- Este script crea todas las tablas faltantes, agrega columnas
-- necesarias y activa los permisos RLS sin ningún error.
-- ============================================================

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLA ROLES Y PERFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'Supervisor' CHECK (role IN ('Gerencia', 'Supervisor', 'Operario', 'Panolero', 'Admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. TABLA BARCOS (Activos)
CREATE TABLE IF NOT EXISTS public.ships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    client_name TEXT,
    status TEXT DEFAULT 'Activo' CHECK (status IN ('Activo', 'En Mantenimiento', 'Terminado')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.ships ENABLE ROW LEVEL SECURITY;

-- 4. ORDENES DE TRABAJO (OTs)
CREATE TABLE IF NOT EXISTS public.work_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ship_id UUID REFERENCES public.ships(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'Pendiente' CHECK (status IN ('Pendiente', 'En Progreso', 'Pausada', 'Completada')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

-- 5. REGISTRO DE HORAS (Labor Logs)
CREATE TABLE IF NOT EXISTS public.labor_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE CASCADE NOT NULL,
    worker_id UUID,
    hours_worked NUMERIC(5,2) NOT NULL,
    date_logged DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.labor_logs ENABLE ROW LEVEL SECURITY;

-- Agregar columnas necesarias para la Carga Múltiple de Horas
ALTER TABLE public.labor_logs 
  ADD COLUMN IF NOT EXISTS worker_name TEXT,
  ADD COLUMN IF NOT EXISTS rubro TEXT,
  ADD COLUMN IF NOT EXISTS work_type TEXT DEFAULT 'HORA',
  ADD COLUMN IF NOT EXISTS cost_center TEXT DEFAULT 'CLIENTE',
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'Aprobado';

-- 6. TABLA MATERIALES (Pañol / Inventario)
CREATE TABLE IF NOT EXISTS public.materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT,
    current_stock INTEGER DEFAULT 0,
    minimum_stock INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

-- 7. MOVIMIENTOS DE INVENTARIO (Retiros de Pañol)
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID REFERENCES public.materials(id) ON DELETE CASCADE NOT NULL,
    work_order_id UUID REFERENCES public.work_orders(id),
    user_id UUID,
    quantity_withdrawn INTEGER NOT NULL,
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

-- 8. COMPRAS Y GESTOR DOCUMENTAL
CREATE TABLE IF NOT EXISTS public.purchase_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    work_order_id UUID REFERENCES public.work_orders(id),
    material_id UUID REFERENCES public.materials(id),
    uploaded_by UUID,
    original_filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    category TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.purchase_documents ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 9. PERMISOS DE SEGURIDAD (RLS POLICIES)
-- ============================================================

-- PROFILES
DROP POLICY IF EXISTS "Allow authenticated read profiles" ON public.profiles;
CREATE POLICY "Allow authenticated read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated upsert profiles" ON public.profiles;
CREATE POLICY "Allow authenticated upsert profiles" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- SHIPS
DROP POLICY IF EXISTS "Allow authenticated read ships" ON public.ships;
CREATE POLICY "Allow authenticated read ships" ON public.ships FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated insert ships" ON public.ships;
CREATE POLICY "Allow authenticated insert ships" ON public.ships FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated update ships" ON public.ships;
CREATE POLICY "Allow authenticated update ships" ON public.ships FOR UPDATE TO authenticated USING (true);

-- WORK ORDERS
DROP POLICY IF EXISTS "Allow authenticated read work_orders" ON public.work_orders;
CREATE POLICY "Allow authenticated read work_orders" ON public.work_orders FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated insert work_orders" ON public.work_orders;
CREATE POLICY "Allow authenticated insert work_orders" ON public.work_orders FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated update work_orders" ON public.work_orders;
CREATE POLICY "Allow authenticated update work_orders" ON public.work_orders FOR UPDATE TO authenticated USING (true);

-- LABOR LOGS
DROP POLICY IF EXISTS "Allow authenticated read labor_logs" ON public.labor_logs;
CREATE POLICY "Allow authenticated read labor_logs" ON public.labor_logs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated insert labor_logs" ON public.labor_logs;
CREATE POLICY "Allow authenticated insert labor_logs" ON public.labor_logs FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated update labor_logs" ON public.labor_logs;
CREATE POLICY "Allow authenticated update labor_logs" ON public.labor_logs FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated delete labor_logs" ON public.labor_logs;
CREATE POLICY "Allow authenticated delete labor_logs" ON public.labor_logs FOR DELETE TO authenticated USING (true);

-- MATERIALS
DROP POLICY IF EXISTS "Allow authenticated read materials" ON public.materials;
CREATE POLICY "Allow authenticated read materials" ON public.materials FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated write materials" ON public.materials;
CREATE POLICY "Allow authenticated write materials" ON public.materials FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- INVENTORY TRANSACTIONS
DROP POLICY IF EXISTS "Allow authenticated read inventory_transactions" ON public.inventory_transactions;
CREATE POLICY "Allow authenticated read inventory_transactions" ON public.inventory_transactions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated insert inventory_transactions" ON public.inventory_transactions;
CREATE POLICY "Allow authenticated insert inventory_transactions" ON public.inventory_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 10. CARGA DE DATOS REALES DE ALON CAR (BARCOS Y OTs)
-- ============================================================

INSERT INTO public.ships (name, client_name, status)
SELECT 'VIRGEN DE ITATI', 'Astillero Alon Car', 'Activo'
WHERE NOT EXISTS (SELECT 1 FROM public.ships WHERE name = 'VIRGEN DE ITATI');

INSERT INTO public.ships (name, client_name, status)
SELECT 'NONO PASCUAL', 'Astillero Alon Car', 'Activo'
WHERE NOT EXISTS (SELECT 1 FROM public.ships WHERE name = 'NONO PASCUAL');

INSERT INTO public.ships (name, client_name, status)
SELECT 'SIEMPRE DON VICENTE', 'Astillero Alon Car', 'Activo'
WHERE NOT EXISTS (SELECT 1 FROM public.ships WHERE name = 'SIEMPRE DON VICENTE');

INSERT INTO public.ships (name, client_name, status)
SELECT 'MIS SUEÑOS', 'Astillero Alon Car', 'Activo'
WHERE NOT EXISTS (SELECT 1 FROM public.ships WHERE name = 'MIS SUEÑOS');

-- OTs para VIRGEN DE ITATI
INSERT INTO public.work_orders (ship_id, title, description, status)
SELECT id, 'OT-101: Válvulas de Fondo', 'Recorrido, rectificación y prueba hidráulica de válvulas de casco y tomas de mar', 'En Progreso'
FROM public.ships WHERE name = 'VIRGEN DE ITATI'
AND NOT EXISTS (SELECT 1 FROM public.work_orders WHERE title LIKE 'OT-101%');

INSERT INTO public.work_orders (ship_id, title, description, status)
SELECT id, 'OT-102: Calderería de Obra Viva', 'Renovación de tramos de chapa 3/8" y fondos de pique proa según informe de espesores', 'En Progreso'
FROM public.ships WHERE name = 'VIRGEN DE ITATI'
AND NOT EXISTS (SELECT 1 FROM public.work_orders WHERE title LIKE 'OT-102%');

-- OTs para NONO PASCUAL
INSERT INTO public.work_orders (ship_id, title, description, status)
SELECT id, 'OT-103: Pintura General', 'Lavado a alta presión, arenado comercial y esquema de pintura antiincrustante', 'En Progreso'
FROM public.ships WHERE name = 'NONO PASCUAL'
AND NOT EXISTS (SELECT 1 FROM public.work_orders WHERE title LIKE 'OT-103%');

INSERT INTO public.work_orders (ship_id, title, description, status)
SELECT id, 'OT-104: Línea de Eje y Timón', 'Desmontaje de hélice, verificación de alineación de eje portahélice y cambio de bujes', 'En Progreso'
FROM public.ships WHERE name = 'NONO PASCUAL'
AND NOT EXISTS (SELECT 1 FROM public.work_orders WHERE title LIKE 'OT-104%');

-- Materiales iniciales de Pañol
INSERT INTO public.materials (name, category, current_stock, minimum_stock)
SELECT 'Electrodo Conarco 7018 3.25mm (kg)', 'Soldadura', 120, 25
WHERE NOT EXISTS (SELECT 1 FROM public.materials WHERE name LIKE 'Electrodo Conarco%');

INSERT INTO public.materials (name, category, current_stock, minimum_stock)
SELECT 'Disco de Corte Tyrolit 7" x 1.6mm', 'Consumibles', 85, 20
WHERE NOT EXISTS (SELECT 1 FROM public.materials WHERE name LIKE 'Disco de Corte%');

INSERT INTO public.materials (name, category, current_stock, minimum_stock)
SELECT 'Pintura Epoxi Anticorrosiva Gris (Litros)', 'Pintura', 60, 15
WHERE NOT EXISTS (SELECT 1 FROM public.materials WHERE name LIKE 'Pintura Epoxi%');
