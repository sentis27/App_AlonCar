-- ============================================================================
-- MIGRACIÓN 0018: MÓDULO M1 - BARCOS, PROPIETARIOS, CONTACTOS Y ESTADÍAS
-- ============================================================================
-- 1. Tabla `public.owners` (Propietarios, Armadores y Empresas Clientes)
-- 2. Ampliación de `public.ships` (Ficha técnica core + JSONB, locación, solicitudes de info)
-- 3. Tabla `public.contacts` (Contactos vinculados a buques / armadores)
-- 4. Tabla `public.ship_stays` (Calendario de Movimientos & Estadías)
-- ============================================================================

-- 1. TABLA OWNERS (Propietarios / Armadores)
CREATE TABLE IF NOT EXISTS public.owners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    cuit TEXT,
    armador_name TEXT,
    armador_phone TEXT,
    email_principal TEXT,
    email_secundario TEXT,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura publica owners" ON public.owners;
CREATE POLICY "Lectura publica owners" ON public.owners FOR SELECT USING (true);

DROP POLICY IF EXISTS "Escritura total owners" ON public.owners;
CREATE POLICY "Escritura total owners" ON public.owners FOR ALL USING (true) WITH CHECK (true);

-- 2. AMPLIAR TABLA SHIPS
ALTER TABLE public.ships ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.owners(id) ON DELETE SET NULL;
ALTER TABLE public.ships ADD COLUMN IF NOT EXISTS imo_number TEXT;
ALTER TABLE public.ships ADD COLUMN IF NOT EXISTS matricula TEXT;
ALTER TABLE public.ships ADD COLUMN IF NOT EXISTS vessel_type TEXT DEFAULT 'Pesquero';
ALTER TABLE public.ships ADD COLUMN IF NOT EXISTS eslora_mts NUMERIC(6,2);
ALTER TABLE public.ships ADD COLUMN IF NOT EXISTS manga_mts NUMERIC(6,2);
ALTER TABLE public.ships ADD COLUMN IF NOT EXISTS puntal_mts NUMERIC(6,2);
ALTER TABLE public.ships ADD COLUMN IF NOT EXISTS superficie_casco_m2 NUMERIC(8,2);
ALTER TABLE public.ships ADD COLUMN IF NOT EXISTS technical_specs JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.ships ADD COLUMN IF NOT EXISTS current_location TEXT DEFAULT 'VARADERO ALON CAR';
ALTER TABLE public.ships ADD COLUMN IF NOT EXISTS info_request_status TEXT DEFAULT 'completo';
ALTER TABLE public.ships ADD COLUMN IF NOT EXISTS info_requested_at TIMESTAMPTZ;
ALTER TABLE public.ships ADD COLUMN IF NOT EXISTS info_requested_by TEXT;
ALTER TABLE public.ships ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.ships ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Asegurar RLS en ships para todas las operaciones
DROP POLICY IF EXISTS "Lectura total ships" ON public.ships;
CREATE POLICY "Lectura total ships" ON public.ships FOR SELECT USING (true);

DROP POLICY IF EXISTS "Escritura total ships" ON public.ships;
CREATE POLICY "Escritura total ships" ON public.ships FOR ALL USING (true) WITH CHECK (true);

-- 3. TABLA CONTACTS (Contactos asociados a Empresas / Barcos)
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES public.owners(id) ON DELETE CASCADE,
    ship_id UUID REFERENCES public.ships(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'Encargado',
    phone TEXT,
    email TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura total contacts" ON public.contacts;
CREATE POLICY "Lectura total contacts" ON public.contacts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Escritura total contacts" ON public.contacts;
CREATE POLICY "Escritura total contacts" ON public.contacts FOR ALL USING (true) WITH CHECK (true);

-- 4. TABLA SHIP_STAYS (Calendario de Movimientos & Estadías)
-- Refleja exactamente la planilla 'CALENDARIO DE ESTADIA BARCOS' (DEC-019)
CREATE TABLE IF NOT EXISTS public.ship_stays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ship_id UUID REFERENCES public.ships(id) ON DELETE CASCADE NOT NULL,
    location TEXT NOT NULL DEFAULT 'VARADERO ALON CAR',
    start_date DATE NOT NULL,
    end_date DATE,
    notes TEXT,
    registered_by TEXT DEFAULT 'Administración',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ship_stays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura total ship_stays" ON public.ship_stays;
CREATE POLICY "Lectura total ship_stays" ON public.ship_stays FOR SELECT USING (true);

DROP POLICY IF EXISTS "Escritura total ship_stays" ON public.ship_stays;
CREATE POLICY "Escritura total ship_stays" ON public.ship_stays FOR ALL USING (true) WITH CHECK (true);

-- 5. SEMBRAR OWNERS BASE DESDE SHIPS EXISTENTES
INSERT INTO public.owners (name, armador_name, email_principal, is_active)
SELECT DISTINCT client_name, client_name, 'administracion@aloncar.com', true
FROM public.ships
WHERE client_name IS NOT NULL AND client_name <> ''
ON CONFLICT DO NOTHING;

-- Vincular barcos existentes a su owner respectivo
UPDATE public.ships s
SET owner_id = o.id
FROM public.owners o
WHERE s.client_name = o.name AND s.owner_id IS NULL;
