-- ==============================================================================
-- MIGRACIÓN 0051: SEPARACIÓN OPERATIVA VS COMERCIAL (`description_billing`) EN
--                 `ot_templates` + VÍNCULO RELACIONAL `ot_template_id` EN `work_orders`
-- ==============================================================================
-- Propósito:
-- 1. Incorporar `description_billing TEXT` en `public.ot_templates` para almacenar
--    la prosa comercial completa predeterminada que Facturación importa automáticamente
--    cuando una OT pertenece al Catálogo OT.ABC (ignorando la descripción operativa corta).
-- 2. Migrar sin pérdida el texto comercial actual (`description` + `fixed_notes`) de
--    las plantillas existentes hacia `description_billing`.
-- 3. Dejar `ot_templates.description` como descripción operativa corta para `/ots`
--    (aplicando los ejemplos operativos acordados para CARENADO DE CASCO y VALVULAS).
-- 4. Incorporar `ot_template_id UUID` (FK nullable + índice parcial) en `work_orders`
--    y realizar backfill por coincidencia exacta de nombre con `ot_templates`.
-- ==============================================================================

BEGIN;

-- 1. Columna comercial dedicada en Catálogo OT.ABC
ALTER TABLE public.ot_templates
  ADD COLUMN IF NOT EXISTS description_billing TEXT;

-- 2. Backfill seguro: copiar texto comercial completo actual (+ notas fijas) sin pérdida
UPDATE public.ot_templates
   SET description_billing = CASE
         WHEN NULLIF(trim(COALESCE(fixed_notes, '')), '') IS NOT NULL
          AND position(lower(trim(fixed_notes)) in lower(COALESCE(description, ''))) = 0
         THEN trim(both E'\n ' FROM concat_ws(E'\n', NULLIF(trim(COALESCE(description, '')), ''), trim(fixed_notes)))
         ELSE NULLIF(trim(COALESCE(description, '')), '')
       END,
       updated_at = NOW()
 WHERE NULLIF(trim(COALESCE(description_billing, '')), '') IS NULL;

-- 3. Separar descripción operativa corta en las plantillas base acordadas (sin tocar description_billing)
UPDATE public.ot_templates
   SET description = 'Lavado de casco, pintura de casco, pintar cartelería de flotación.',
       updated_at = NOW()
 WHERE upper(trim(name)) = 'CARENADO DE CASCO'
   AND NULLIF(trim(COALESCE(description_billing, '')), '') IS NOT NULL;

UPDATE public.ot_templates
   SET description = 'Desmontar, volver a montar las válvulas y llevarlas al taller para su recorrido.',
       updated_at = NOW()
 WHERE upper(trim(name)) = 'VALVULAS DE CASCO E INTERMEDIARIAS'
   AND NULLIF(trim(COALESCE(description_billing, '')), '') IS NOT NULL;

-- 4. Vínculo relacional opcional `work_orders.ot_template_id` -> `ot_templates(id)`
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS ot_template_id UUID REFERENCES public.ot_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_work_orders_ot_template_id
  ON public.work_orders (ot_template_id)
  WHERE ot_template_id IS NOT NULL;

-- 5. Backfill por coincidencia exacta de título normalizado para OTs históricas del catálogo
UPDATE public.work_orders AS w
   SET ot_template_id = t.id
  FROM public.ot_templates AS t
 WHERE w.ot_template_id IS NULL
   AND upper(trim(COALESCE(w.title, ''))) = upper(trim(t.name));

COMMIT;
