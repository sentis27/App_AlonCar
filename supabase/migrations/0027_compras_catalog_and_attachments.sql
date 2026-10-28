-- ==============================================================================
-- MIGRACIÓN 0027: CATÁLOGO DE MATERIALES (3 CATEGORÍAS, IMAGEN, RUBRO PENDIENTE,
-- % SEGURIDAD), DESCARTE DE ALTA EN ÓRDENES Y PERMISOS DE STORAGE
-- ==============================================================================

-- 1. Columna en purchase_orders para descartar alerta de "Alta en Catálogo"
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS no_catalog_required BOOLEAN DEFAULT false;

-- 2. Extensión de tabla materials para alta formal con imagen, rubro sugerido y % seguridad
ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS rubro_status TEXT DEFAULT 'APROBADO',
  ADD COLUMN IF NOT EXISTS suggested_rubro TEXT,
  ADD COLUMN IF NOT EXISTS security_factor NUMERIC(5,2) DEFAULT 1.06;

-- Normalizar categorías existentes hacia las 3 únicas categorías oficiales:
-- MATERIALES, CONSUMIBLES, ELEM.SEGURIDAD
UPDATE public.materials
SET category = 'CONSUMIBLES'
WHERE category ILIKE '%consum%' OR category ILIKE '%gases%' OR category ILIKE '%pintura%';

UPDATE public.materials
SET category = 'ELEM.SEGURIDAD'
WHERE category ILIKE '%seguridad%';

UPDATE public.materials
SET category = 'MATERIALES'
WHERE category NOT IN ('MATERIALES', 'CONSUMIBLES', 'ELEM.SEGURIDAD') OR category IS NULL;

-- 3. Asegurar que el bucket 'compras' sea público y permita subidas/lecturas
INSERT INTO storage.buckets (id, name, public)
VALUES ('compras', 'compras', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Allow public read compras" ON storage.objects;
CREATE POLICY "Allow public read compras" ON storage.objects
  FOR SELECT USING (bucket_id = 'compras');

DROP POLICY IF EXISTS "Allow all insert compras" ON storage.objects;
CREATE POLICY "Allow all insert compras" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'compras');

DROP POLICY IF EXISTS "Allow all update compras" ON storage.objects;
CREATE POLICY "Allow all update compras" ON storage.objects
  FOR UPDATE USING (bucket_id = 'compras');

DROP POLICY IF EXISTS "Allow all delete compras" ON storage.objects;
CREATE POLICY "Allow all delete compras" ON storage.objects
  FOR DELETE USING (bucket_id = 'compras');
