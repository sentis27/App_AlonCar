-- ==============================================================================
-- MIGRACIÓN 0052: ORDEN CANÓNICO PDF EN `ot_templates` (1..20) + ALTA
--                 `INFORMES TÉCNICOS` + MODO `ITEMS` / `billing_line_items`
-- ==============================================================================
-- Propósito:
-- 1. Incorporar `work_orders.billing_line_items JSONB` y ampliar el CHECK de
--    `billing_pricing_mode` a ('MO_MAT', 'UNITARIO', 'ITEMS', 'SIN_CARGO') para
--    cobro por ítem individual dentro de un mismo bloque de OT.
-- 2. Dar de alta `INFORMES TÉCNICOS` en `ot_templates` y alinear `sort_order`
--    1..20 al orden exacto del modelo PDF oficial (subiendo SERVICIO DE GRUA
--    debajo de VARADERO y ubicando SUPER ESTRUCTURA Y CUBIERTA entre
--    CARENADO DE CASCO y SUMINISTROS).
-- 3. Completar `line_items` / `description_billing` faltantes en LINEA DE EJE,
--    LINEA DE TIMON, Anclas y Cadenas y precios base de SERVICIO DE GRUA.
-- ==============================================================================

BEGIN;

-- 1. Expansión relacional en `work_orders` para cobro por ítem individual
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS billing_line_items JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.work_orders
  DROP CONSTRAINT IF EXISTS work_orders_billing_pricing_mode_check;

ALTER TABLE public.work_orders
  ADD CONSTRAINT work_orders_billing_pricing_mode_check
  CHECK (billing_pricing_mode IN ('MO_MAT', 'UNITARIO', 'ITEMS', 'SIN_CARGO'));

-- 2. Alta idempotente de `INFORMES TÉCNICOS` en Catálogo OT.ABC
INSERT INTO public.ot_templates (
  name,
  sort_order,
  description,
  description_billing,
  fixed_notes,
  default_tax_type,
  default_data_source,
  line_items,
  updated_at
)
SELECT
  'INFORMES TÉCNICOS',
  20,
  'Realización de informe técnico para presentar en P.N.A.',
  '• Realización de informe técnico para presentar en P.N.A.',
  NULL,
  'EXENTO',
  'CARGA_MANUAL',
  '[{"id":"inf_1","row_type":"ITEM","subwork_title":"","concept":"Realización de informe técnico para presentar en P.N.A.","unit":"Global","unit_price_usd":850,"tax_type":"EXENTO","data_source":"CARGA_MANUAL","sort_order":1}]'::jsonb,
  NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM public.ot_templates t
  WHERE upper(trim(t.name)) IN ('INFORMES TÉCNICOS', 'INFORMES TECNICOS')
);

-- 3. Alinear `sort_order` 1..20 exactamente al orden oficial del PDF
WITH pdf_order(name_key, next_sort) AS (
  VALUES
    ('SERVICIOS', 1),
    ('VARADERO', 2),
    ('SERVICIO DE GRUA', 3),
    ('SERVICIO DE GRÚA', 3),
    ('RET. SERV. NO CONTAMINANTES', 4),
    ('SONDAJES ULTRASONICOS', 5),
    ('PROTECCION GALVANICA', 6),
    ('TOMAS DE MAR', 7),
    ('VALVULAS DE CASCO E INTERMEDIARIAS', 8),
    ('CAJA DE BARRO', 9),
    ('POCETES DE ACHIQUE', 10),
    ('DESMONTE LINEA EJE Y TIMON', 11),
    ('LINEA DE EJE', 12),
    ('LINEA DE TIMON', 13),
    ('CARENADO DE CASCO', 14),
    ('SUPER ESTRUCTURA Y CUBIERTA', 15),
    ('SUMINISTROS', 16),
    ('ANCLAS Y CADENAS', 17),
    ('TANQUES', 18),
    ('SENTINA', 19),
    ('INFORMES TÉCNICOS', 20),
    ('INFORMES TECNICOS', 20)
)
UPDATE public.ot_templates AS t
   SET sort_order = o.next_sort,
       updated_at = NOW()
  FROM pdf_order AS o
 WHERE upper(trim(t.name)) = o.name_key;

-- 4. Completar renglones y prosa comercial del PDF solo en plantillas que aún estaban vacías
UPDATE public.ot_templates
   SET line_items = '[
         {"id":"lej_1","row_type":"ITEM","subwork_title":"","concept":"Traslado de eje a taller y montaje en torno. Centrado y control de linealidad. Limpieza de chaveteros y control de fisuras. Prueba de contacto de cono de manchón y hélice.","unit":"Global","unit_price_usd":980,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":1},
         {"id":"lej_2","row_type":"NOTE","subwork_title":"","concept":"Nota: los clavados se consideran estándar.","unit":"","unit_price_usd":0,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":2}
       ]'::jsonb,
       description_billing = CASE
         WHEN COALESCE(trim(description_billing), '') IN ('', 'Trabajos sobre línea de eje, bujes y alineación.')
         THEN E'• Traslado de eje a taller y montaje en torno. Centrado y control de linealidad. Limpieza de chaveteros y control de fisuras. Prueba de contacto de cono de manchón y hélice.\nNota: los clavados se consideran estándar.'
         ELSE description_billing
       END,
       fixed_notes = COALESCE(NULLIF(trim(fixed_notes), ''), 'Nota: los clavados se consideran estándar.'),
       updated_at = NOW()
 WHERE upper(trim(name)) = 'LINEA DE EJE'
   AND jsonb_array_length(COALESCE(line_items, '[]'::jsonb)) = 0;

UPDATE public.ot_templates
   SET line_items = '[
         {"id":"lti_1","row_type":"ITEM","subwork_title":"","concept":"Traslado de eje a taller, subir al torno. Control de linealidad. Limpieza de chavetero y control de fisuras. Prueba de contacto de yugo de timón.","unit":"Global","unit_price_usd":670,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":1},
         {"id":"lti_2","row_type":"NOTE","subwork_title":"","concept":"Nota: los clavados se consideran estándar.","unit":"","unit_price_usd":0,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":2}
       ]'::jsonb,
       description_billing = CASE
         WHEN COALESCE(trim(description_billing), '') IN ('', 'Trabajos sobre línea de timón, mecha y guardacabos.')
         THEN E'• Traslado de eje a taller, subir al torno. Control de linealidad. Limpieza de chavetero y control de fisuras. Prueba de contacto de yugo de timón.\nNota: los clavados se consideran estándar.'
         ELSE description_billing
       END,
       fixed_notes = COALESCE(NULLIF(trim(fixed_notes), ''), 'Nota: los clavados se consideran estándar.'),
       updated_at = NOW()
 WHERE upper(trim(name)) = 'LINEA DE TIMON'
   AND jsonb_array_length(COALESCE(line_items, '[]'::jsonb)) = 0;

UPDATE public.ot_templates
   SET line_items = '[
         {"id":"anc_1","row_type":"ITEM","subwork_title":"","concept":"Desengrilletar / engrilletar fondeos. Por línea.","unit":"Línea","unit_price_usd":0,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":1},
         {"id":"anc_2","row_type":"ITEM","subwork_title":"","concept":"Extender cadenas en varadero y efectuar lavado con agua a alta presión. Por c/u.","unit":"Unidad","unit_price_usd":400,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":2},
         {"id":"anc_3","row_type":"ITEM","subwork_title":"","concept":"Calibrado de cadenas. Confección de planilla para presentación ante P.N.A. o Soc. Calificadora.","unit":"Unidad","unit_price_usd":200,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":3},
         {"id":"anc_4","row_type":"NOTE","subwork_title":"","concept":"Nota: Todas las pinturas y solventes son provistos por el armador.","unit":"","unit_price_usd":0,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":4}
       ]'::jsonb,
       description_billing = CASE
         WHEN COALESCE(trim(description_billing), '') IN ('', 'Inspección, recorrido y calibrado de anclas, cadenas y pozo de cadenas.')
         THEN E'• Desengrilletar / engrilletar fondeos. Por línea.\n• Extender cadenas en varadero y efectuar lavado con agua a alta presión. Por c/u.\n• Calibrado de cadenas. Confección de planilla para presentación ante P.N.A. o Soc. Calificadora.\nNota: Todas las pinturas y solventes son provistos por el armador.'
         ELSE description_billing
       END,
       fixed_notes = COALESCE(NULLIF(trim(fixed_notes), ''), 'Nota: Todas las pinturas y solventes son provistos por el armador.'),
       updated_at = NOW()
 WHERE upper(trim(name)) = 'ANCLAS Y CADENAS'
   AND jsonb_array_length(COALESCE(line_items, '[]'::jsonb)) = 0;

-- Completar tarifa unitaria base de SERVICIO DE GRUA (8 ton = 130, 60 ton = 240) solo si está en 0
UPDATE public.ot_templates
   SET line_items = COALESCE(
         (
           SELECT jsonb_agg(
             CASE
               WHEN COALESCE((elem->>'unit_price_usd')::numeric, 0) = 0 AND (elem->>'concept') ILIKE '%8 ton%'
               THEN elem || '{"unit":"Hora","unit_price_usd":130,"sort_order":1}'::jsonb
               WHEN COALESCE((elem->>'unit_price_usd')::numeric, 0) = 0 AND (elem->>'concept') ILIKE '%60 ton%'
               THEN elem || '{"unit":"Hora","unit_price_usd":240,"sort_order":2}'::jsonb
               ELSE elem
             END
             ORDER BY
               CASE
                 WHEN (elem->>'concept') ILIKE '%8 ton%' THEN 1
                 WHEN (elem->>'concept') ILIKE '%60 ton%' THEN 2
                 ELSE COALESCE((elem->>'sort_order')::int, 99)
               END
           )
           FROM jsonb_array_elements(COALESCE(line_items, '[]'::jsonb)) AS elem
         ),
         '[]'::jsonb
       ),
       updated_at = NOW()
 WHERE upper(trim(name)) IN ('SERVICIO DE GRUA', 'SERVICIO DE GRÚA');

COMMIT;
