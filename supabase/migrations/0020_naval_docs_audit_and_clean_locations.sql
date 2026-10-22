-- ==============================================================================
-- MIGRACIÓN 0020: DOCS NAVALES, AUDITORÍA DE ELIMINACIONES Y LIMPIEZA DE LOCACIONES
-- ==============================================================================
-- 1. Limpieza de locaciones: Eliminar "ALON CAR" (quedar solo VARADERO y MUELLE)
-- 2. Alertas de Barcos Huérfanos tras eliminación de armador
-- 3. Documentación técnica de Jefe de Obra (Plano de Anguilera .dwg/.pdf e Informe de Pintado .pdf)
-- 4. Tabla de Auditoría General (public.audit_logs)
-- ==============================================================================

-- 1. LIMPIAR LOCACIONES EN BASE DE DATOS
UPDATE public.ships 
SET current_location = 'VARADERO' 
WHERE current_location ILIKE '%VARADERO%';

UPDATE public.ships 
SET current_location = 'MUELLE' 
WHERE current_location ILIKE '%MUELLE%';

UPDATE public.ship_stays 
SET location = 'VARADERO' 
WHERE location ILIKE '%VARADERO%';

UPDATE public.ship_stays 
SET location = 'MUELLE' 
WHERE location ILIKE '%MUELLE%';

-- Actualizar defaults en ships y stays
ALTER TABLE public.ships ALTER COLUMN current_location SET DEFAULT 'VARADERO';
ALTER TABLE public.ship_stays ALTER COLUMN location SET DEFAULT 'VARADERO';

-- 2. ALERTAS DE BARCOS HUÉRFANOS (Tras eliminar una empresa armadora)
ALTER TABLE public.ships ADD COLUMN IF NOT EXISTS orphan_owner_alert BOOLEAN DEFAULT false;
ALTER TABLE public.ships ADD COLUMN IF NOT EXISTS orphan_owner_previous_name TEXT;

-- 3. CAMPOS DIRECTOS PARA DOCUMENTACIÓN TÉCNICA DEL JEFE DE OBRA
ALTER TABLE public.ships ADD COLUMN IF NOT EXISTS plan_anguilera_url TEXT;
ALTER TABLE public.ships ADD COLUMN IF NOT EXISTS plan_anguilera_name TEXT;
ALTER TABLE public.ships ADD COLUMN IF NOT EXISTS plan_anguilera_uploaded_at TIMESTAMPTZ;

ALTER TABLE public.ships ADD COLUMN IF NOT EXISTS informe_pintado_url TEXT;
ALTER TABLE public.ships ADD COLUMN IF NOT EXISTS informe_pintado_name TEXT;
ALTER TABLE public.ships ADD COLUMN IF NOT EXISTS informe_pintado_uploaded_at TIMESTAMPTZ;

-- 4. TABLA GENERAL DE AUDITORÍA (Hoja de Auditorías)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    entity_name TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    performed_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura total audit_logs" ON public.audit_logs;
CREATE POLICY "Lectura total audit_logs" ON public.audit_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Escritura total audit_logs" ON public.audit_logs;
CREATE POLICY "Escritura total audit_logs" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);

-- 5. TABLA DE DOCUMENTOS NAVALES (Historial y adjuntos)
CREATE TABLE IF NOT EXISTS public.ship_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ship_id UUID REFERENCES public.ships(id) ON DELETE CASCADE NOT NULL,
    doc_type TEXT NOT NULL, -- 'plano_anguilera' | 'informe_pintado' | 'otro'
    title TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size_bytes BIGINT,
    uploaded_by TEXT DEFAULT 'Jefe de Obra',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ship_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura total ship_documents" ON public.ship_documents;
CREATE POLICY "Lectura total ship_documents" ON public.ship_documents FOR SELECT USING (true);

DROP POLICY IF EXISTS "Escritura total ship_documents" ON public.ship_documents;
CREATE POLICY "Escritura total ship_documents" ON public.ship_documents FOR ALL USING (true) WITH CHECK (true);
