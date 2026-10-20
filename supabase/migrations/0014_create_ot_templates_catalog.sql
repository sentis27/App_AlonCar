-- =========================================================================
-- Migración 0014: Catálogo de Trabajos (OT.ABC) editable
-- Solo guía de texto (nombre + descripción), agrupada por Renovación / Intermediaria.
-- Tipo de trabajo, jefe de obra, contratistas, fechas, etc. se definen en la OT.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.ot_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT CHECK (category IN ('Renovación', 'Intermediaria')),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.ot_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ot_templates read" ON public.ot_templates;
CREATE POLICY "ot_templates read" ON public.ot_templates FOR SELECT USING (true);
DROP POLICY IF EXISTS "ot_templates insert" ON public.ot_templates;
CREATE POLICY "ot_templates insert" ON public.ot_templates FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "ot_templates update" ON public.ot_templates;
CREATE POLICY "ot_templates update" ON public.ot_templates FOR UPDATE USING (true);
DROP POLICY IF EXISTS "ot_templates delete" ON public.ot_templates;
CREATE POLICY "ot_templates delete" ON public.ot_templates FOR DELETE USING (true);

-- Nombres originales de la hoja OT. ABC (GS-003). Descripción y grupo se completan desde la app.
INSERT INTO public.ot_templates (name, sort_order)
SELECT n, row_number() OVER ()
FROM unnest(ARRAY[
  'SERVICIOS',
  'VARADERO',
  'RET. SERV. NO CONTAMINANTES',
  'SONDAJES ULTRASONICOS',
  'PROTECCION GALVANICA',
  'TOMAS DE MAR',
  'VALVULAS DE CASCO E INTERMEDIARIAS',
  'POCETES DE ACHIQUE',
  'DESMONTE LINEA EJE Y TIMON',
  'LINEA DE EJE',
  'LINEA DE TIMON',
  'CARENADO DE CASCO',
  'SUPER ESTRUCTURA Y CUBIERTA',
  'Anclas y Cadenas',
  'TANQUES',
  'SENTINA'
]) AS n
WHERE NOT EXISTS (SELECT 1 FROM public.ot_templates);
