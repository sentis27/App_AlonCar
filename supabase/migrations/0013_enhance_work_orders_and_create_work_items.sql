-- =========================================================================
-- Migración 0013: Ampliación de Órdenes de Trabajo (M3) y Creación de Tareas
-- =========================================================================

-- 1. Agregar columnas extendidas a work_orders
ALTER TABLE public.work_orders 
ADD COLUMN IF NOT EXISTS ot_number TEXT,
ADD COLUMN IF NOT EXISTS work_type TEXT DEFAULT 'HORA',
ADD COLUMN IF NOT EXISTS assignment_type TEXT DEFAULT 'Presupuesto General',
ADD COLUMN IF NOT EXISTS budget_code TEXT,
ADD COLUMN IF NOT EXISTS foreman_name TEXT,
ADD COLUMN IF NOT EXISTS contractor_name TEXT,
ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS estimated_end_date DATE,
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS allow_post_billing_costs BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Asegurar que existe el Barco especial "ASTILLERO" para trabajos e infraestructura propia (Regla 1.1)
INSERT INTO public.ships (id, name, client_name, status)
SELECT uuid_generate_v4(), 'ASTILLERO', 'Alon Car (Uso Interno)', 'Activo'
WHERE NOT EXISTS (SELECT 1 FROM public.ships WHERE UPPER(name) = 'ASTILLERO');

-- 3. Crear tabla de trabajos específicos / tareas (work_items)
CREATE TABLE IF NOT EXISTS public.work_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL,
    contractor_name TEXT,
    trade TEXT,
    status TEXT DEFAULT 'En Progreso',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.work_items ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de seguridad RLS
DROP POLICY IF EXISTS "Allow authenticated read work_items" ON public.work_items;
CREATE POLICY "Allow authenticated read work_items" ON public.work_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert work_items" ON public.work_items;
CREATE POLICY "Allow authenticated insert work_items" ON public.work_items FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update work_items" ON public.work_items;
CREATE POLICY "Allow authenticated update work_items" ON public.work_items FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow authenticated delete work_items" ON public.work_items;
CREATE POLICY "Allow authenticated delete work_items" ON public.work_items FOR DELETE USING (true);

-- Permitir también lectura a anon para evitar bloqueos en frontend
DROP POLICY IF EXISTS "Allow anon read ships" ON public.ships;
CREATE POLICY "Allow anon read ships" ON public.ships FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow anon read work_orders" ON public.work_orders;
CREATE POLICY "Allow anon read work_orders" ON public.work_orders FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow anon read work_items" ON public.work_items;
CREATE POLICY "Allow anon read work_items" ON public.work_items FOR SELECT TO anon USING (true);
