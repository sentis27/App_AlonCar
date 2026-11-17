-- ==============================================================================
-- MIGRACIÓN 0048: CATÁLOGO OT.ABC TABULADO (TEXTOS FIJOS, SUB-TRABAJOS, TARIFAS E IVA)
-- ==============================================================================
-- Propósito:
-- 1. Corregir la restricción de agrupación en `ot_templates` a ('Renovación', 'Intermedia', 'Ambas')
--    (normalizando cualquier valor histórico 'Intermediaria' -> 'Intermedia').
-- 2. Incorporar soporte estructural para notas fijas, origen del dato, condición IVA
--    predeterminada y renglones tabulados (`line_items` JSONB, incluyendo los 4 sub-trabajos
--    amarillos de CARENADO DE CASCO y precios unitarios US$).
-- 3. Cargar la base oficial del PDF adjunto preservando intactas las 16 plantillas existentes
--    y agregando CAJA DE BARRO y SUMINISTROS.
-- ==============================================================================

BEGIN;

-- 1. Normalizar valores previos y ampliar CHECK constraint de category
ALTER TABLE public.ot_templates
  DROP CONSTRAINT IF EXISTS ot_templates_category_check;

UPDATE public.ot_templates
   SET category = 'Intermedia'
 WHERE category = 'Intermediaria';

ALTER TABLE public.ot_templates
  ADD CONSTRAINT ot_templates_category_check
  CHECK (category IS NULL OR category IN ('Renovación', 'Intermedia', 'Ambas'));

-- 2. Ampliar columnas del catálogo OT.ABC
ALTER TABLE public.ot_templates
  ADD COLUMN IF NOT EXISTS fixed_notes TEXT,
  ADD COLUMN IF NOT EXISTS default_tax_type TEXT NOT NULL DEFAULT 'EXENTO',
  ADD COLUMN IF NOT EXISTS default_data_source TEXT NOT NULL DEFAULT 'JEFE_DE_OBRA',
  ADD COLUMN IF NOT EXISTS line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.ot_templates
  DROP CONSTRAINT IF EXISTS ot_templates_default_tax_type_check;
ALTER TABLE public.ot_templates
  ADD CONSTRAINT ot_templates_default_tax_type_check
  CHECK (default_tax_type IN ('EXENTO', 'GRAVADO_21', 'MIXTO'));

ALTER TABLE public.ot_templates
  DROP CONSTRAINT IF EXISTS ot_templates_default_data_source_check;
ALTER TABLE public.ot_templates
  ADD CONSTRAINT ot_templates_default_data_source_check
  CHECK (default_data_source IN ('JEFE_DE_OBRA', 'MOVIMIENTOS_BUQUE', 'PADRON_BUQUES', 'TERCEROS_MANUAL', 'CARGA_MANUAL'));

-- 3. Asegurar políticas RLS y grants consistentes con 0043
ALTER TABLE public.ot_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ot_templates read" ON public.ot_templates;
DROP POLICY IF EXISTS "ot_templates insert" ON public.ot_templates;
DROP POLICY IF EXISTS "ot_templates update" ON public.ot_templates;
DROP POLICY IF EXISTS "ot_templates delete" ON public.ot_templates;
DROP POLICY IF EXISTS "Public access ot_templates" ON public.ot_templates;
CREATE POLICY "Public access ot_templates"
  ON public.ot_templates
  FOR ALL
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.ot_templates TO anon, authenticated, service_role;

-- 4. Asegurar existencia de CAJA DE BARRO y SUMINISTROS (presentes en PDF tarifario)
INSERT INTO public.ot_templates (name, sort_order)
SELECT v.name, v.sort_order
FROM (VALUES
  ('CAJA DE BARRO', 17),
  ('SUMINISTROS', 18)
) AS v(name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ot_templates t WHERE upper(trim(t.name)) = upper(trim(v.name))
);

-- 5. Semilla oficial de textos fijos, sub-trabajos, precios unitarios US$, IVA y orígenes
WITH seed(name, sort_order, description, fixed_notes, default_tax_type, default_data_source, line_items) AS (
  VALUES
  (
    'SERVICIOS',
    1,
    'Servicios generales de asistencia en varadero y muelle.',
    NULL,
    'GRAVADO_21',
    'CARGA_MANUAL',
    '[]'::jsonb
  ),
  (
    'VARADERO',
    2,
    E'• Maniobra de halaje y botadura con anguilera\n• Servicio de lancha para maniobra de alaje\n• Estadía en varadero. Por día.\n• Estadía por día en muelle (incluido energía y agua potable)\n• Servicio de amarre en muelle con amarradores por maniobra\n• Servicio de grúa terrestre hasta 8 ton. Por hora.\n• Servicio de grúa terrestre hasta 60 ton. Por hora. (Mínimo 2 horas)',
    'En día y horario normal. Por maniobra: *Nocturna +25% · **Día inhábil +35% · ***Sin máquina y gobierno +12%.',
    'GRAVADO_21',
    'MOVIMIENTOS_BUQUE',
    '[
      {"id":"var_1","row_type":"ITEM","subwork_title":"","concept":"Maniobra de halaje y botadura con anguilera","unit":"Maniobra","unit_price_usd":5850,"tax_type":"GRAVADO_21","data_source":"CARGA_MANUAL","sort_order":1},
      {"id":"var_2","row_type":"NOTE","subwork_title":"","concept":"En día y horario normal. Por maniobra: *Nocturna recargo 25% · **Día inhábil recargo 35% · ***Sin máquina y gobierno recargo 12%.","unit":"","unit_price_usd":0,"tax_type":"GRAVADO_21","data_source":"CARGA_MANUAL","sort_order":2},
      {"id":"var_3","row_type":"ITEM","subwork_title":"","concept":"Servicio de lancha para maniobra de alaje","unit":"Maniobra","unit_price_usd":230,"tax_type":"GRAVADO_21","data_source":"CARGA_MANUAL","sort_order":3},
      {"id":"var_4","row_type":"ITEM","subwork_title":"","concept":"Estadía en varadero. Por día.","unit":"Día","unit_price_usd":265,"tax_type":"GRAVADO_21","data_source":"MOVIMIENTOS_BUQUE","sort_order":4},
      {"id":"var_5","row_type":"ITEM","subwork_title":"","concept":"Estadía por día en muelle (incluido energía y agua potable)","unit":"Día","unit_price_usd":70,"tax_type":"GRAVADO_21","data_source":"MOVIMIENTOS_BUQUE","sort_order":5},
      {"id":"var_6","row_type":"ITEM","subwork_title":"","concept":"Servicio de amarre en muelle con amarradores por maniobra","unit":"Maniobra","unit_price_usd":150,"tax_type":"GRAVADO_21","data_source":"CARGA_MANUAL","sort_order":6},
      {"id":"var_7","row_type":"ITEM","subwork_title":"","concept":"Servicio de grúa terrestre hasta 8 ton. Por hora.","unit":"Hora","unit_price_usd":130,"tax_type":"GRAVADO_21","data_source":"CARGA_MANUAL","sort_order":7},
      {"id":"var_8","row_type":"ITEM","subwork_title":"","concept":"Servicio de grúa terrestre hasta 60 ton. Por hora. (Mínimo 2 horas)","unit":"Hora","unit_price_usd":240,"tax_type":"GRAVADO_21","data_source":"CARGA_MANUAL","sort_order":8}
    ]'::jsonb
  ),
  (
    'RET. SERV. NO CONTAMINANTES',
    3,
    '• Por contenedor de 6 m3.',
    NULL,
    'GRAVADO_21',
    'TERCEROS_MANUAL',
    '[
      {"id":"ret_1","row_type":"ITEM","subwork_title":"","concept":"Por contenedor de 6 m3.","unit":"Contenedor","unit_price_usd":130,"tax_type":"GRAVADO_21","data_source":"TERCEROS_MANUAL","sort_order":1}
    ]'::jsonb
  ),
  (
    'SONDAJES ULTRASONICOS',
    4,
    E'• Sondaje ultrasónico en casco y presentar planilla con valores. Máx. 50 puntos en tres anillos\n• Sondajes adicionales. Por unidad.',
    'Nota: Los sondajes de espesores tomados sobre zonas de renovación de acero -sin cargo-',
    'EXENTO',
    'JEFE_DE_OBRA',
    '[
      {"id":"son_1","row_type":"ITEM","subwork_title":"","concept":"Sondaje ultrasónico en casco y presentar planilla con valores. Max 50 puntos en tres anillos","unit":"Servicio","unit_price_usd":350,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":1},
      {"id":"son_2","row_type":"ITEM","subwork_title":"","concept":"Sondajes adicionales. Por unidad.","unit":"Unidad","unit_price_usd":5,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":2},
      {"id":"son_3","row_type":"NOTE","subwork_title":"","concept":"Nota: Los sondajes de espesores tomados sobre zonas de renovación de acero -sin cargo-","unit":"","unit_price_usd":0,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":3}
    ]'::jsonb
  ),
  (
    'PROTECCION GALVANICA',
    5,
    E'• Recambio de ánodos de zinc soldados hasta 5kg. Por c/u.\n• Recambio de ánodos de zinc soldados hasta 10kg. Por c/u.',
    'Nota: Provisión del armador',
    'EXENTO',
    'JEFE_DE_OBRA',
    '[
      {"id":"gal_1","row_type":"ITEM","subwork_title":"","concept":"Recambio de ánodos de zinc soldados hasta 5kg. Por c/u.","unit":"Unidad","unit_price_usd":39,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":1},
      {"id":"gal_2","row_type":"ITEM","subwork_title":"","concept":"Recambio de ánodos de zinc soldados hasta 10kg. Por c/u.","unit":"Unidad","unit_price_usd":0,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":2},
      {"id":"gal_3","row_type":"NOTE","subwork_title":"","concept":"Nota: Provisión del armador","unit":"","unit_price_usd":0,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":3}
    ]'::jsonb
  ),
  (
    'TOMAS DE MAR',
    6,
    E'• Desmontar rejillas, rasqueteado, lavado y pintado, montar rejilla, renovar seguro.\n• Verificar venteos.',
    'Nota: No incluye el desmonte de caja de barro en caso de ser requerido',
    'EXENTO',
    'JEFE_DE_OBRA',
    '[
      {"id":"tmar_1","row_type":"ITEM","subwork_title":"","concept":"Desmontar rejillas, rasqueteado, lavado y pintado, montar rejilla, renovar seguro. Verificar venteos.","unit":"Unidad","unit_price_usd":380,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":1},
      {"id":"tmar_2","row_type":"NOTE","subwork_title":"","concept":"Nota: No incluye el desmonte de caja de barro en caso de ser requerido","unit":"","unit_price_usd":0,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":2}
    ]'::jsonb
  ),
  (
    'VALVULAS DE CASCO E INTERMEDIARIAS',
    7,
    E'• Des/Armar, limpiar, arenar y pintar válvulas de toma de mar\n• Verificar asiento, probar con azul de prusia, realizar prueba hidráulica y presentar para PNA\n• Revisión de válvulas de salida a casco de 1" a 2"\n• Revisión de Válvulas de tomas de mar de 3" a 6"\n• Revisión de Válvulas intermediarias de 3" a 6"',
    NULL,
    'EXENTO',
    'JEFE_DE_OBRA',
    '[
      {"id":"val_1","row_type":"ITEM","subwork_title":"","concept":"Des/Armar, limpiar, arenar y pintar válvulas de toma de mar","unit":"Unidad","unit_price_usd":0,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":1},
      {"id":"val_2","row_type":"ITEM","subwork_title":"","concept":"Verificar asiento, probar con azul de prusia, realizar prueba hidráulica y presentar para PNA","unit":"Unidad","unit_price_usd":0,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":2},
      {"id":"val_3","row_type":"ITEM","subwork_title":"","concept":"Revisión de válvulas de salida a casco de 1\" a 2\"","unit":"Unidad","unit_price_usd":165,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":3},
      {"id":"val_4","row_type":"ITEM","subwork_title":"","concept":"Revisión de Válvulas de tomas de mar de 3\" a 6\"","unit":"Unidad","unit_price_usd":245,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":4},
      {"id":"val_5","row_type":"ITEM","subwork_title":"","concept":"Revisión de Válvulas intermediarias de 3\" a 6\"","unit":"Unidad","unit_price_usd":245,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":5}
    ]'::jsonb
  ),
  (
    'CAJA DE BARRO',
    8,
    E'• Desmontar caja de barro y llevar a taller, recorrerla y pintarla.\n• Limpieza y pintura de caja de barro in situ sin desmontar.',
    'NO incluye provisión de asientos de goma, recorrido de actuadores, otros repuestos',
    'EXENTO',
    'JEFE_DE_OBRA',
    '[
      {"id":"cjb_1","row_type":"ITEM","subwork_title":"","concept":"Desmontar caja de barro y llevar a taller, recorrerla y pintarla.","unit":"Unidad","unit_price_usd":630,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":1},
      {"id":"cjb_2","row_type":"ITEM","subwork_title":"","concept":"Limpieza y pintura de caja de barro in situ sin desmontar","unit":"Unidad","unit_price_usd":150,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":2},
      {"id":"cjb_3","row_type":"NOTE","subwork_title":"","concept":"NO incluye provisión de asientos de goma, recorrido de actuadores, otros repuestos","unit":"","unit_price_usd":0,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":3}
    ]'::jsonb
  ),
  (
    'POCETES DE ACHIQUE',
    9,
    E'• Realizar achique, limpieza y tratamiento manual mecánico de pocete y pintado. Presentar a PNA\n• Desmonte de chupones de achique.\n• Revisión de válvulas.',
    NULL,
    'EXENTO',
    'JEFE_DE_OBRA',
    '[
      {"id":"poc_1","row_type":"ITEM","subwork_title":"","concept":"Realizar achique, limpieza y tratamiento manual mecánico de pocete y pintado. Presentar a PNA","unit":"Unidad","unit_price_usd":650,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":1},
      {"id":"poc_2","row_type":"ITEM","subwork_title":"","concept":"Desmonte de chupones de achique.","unit":"Unidad","unit_price_usd":0,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":2},
      {"id":"poc_3","row_type":"ITEM","subwork_title":"","concept":"Revisión de válvulas.","unit":"Unidad","unit_price_usd":0,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":3}
    ]'::jsonb
  ),
  (
    'DESMONTE LINEA EJE Y TIMON',
    10,
    E'• Desarmar / armar guardacabos\n• Romper / reponer cemento de platina.\n• Tomar huelgos de timón y mecha. Tomar caída de eje.\n• Desmontar y montar pala de timón. Depositar en grada.\n• Desmontar y montar mecha de timón. Depositar en grada (contempla sist. Con yugo)\n• Desmontar / montar hélice paso fijo.\n• Desmontar / montar línea de eje portahélice. Depositar en grada.\n• Reponer empaquetadura\n• Bocina limpieza y calibrado\n• Calibrado de mecha y bulonería de anclaje',
    'No incluye: desarme / recorrido de máquina de timón.',
    'EXENTO',
    'JEFE_DE_OBRA',
    '[
      {"id":"dlet_1","row_type":"ITEM","subwork_title":"","concept":"Desarmar / armar guardacabos","unit":"Global","unit_price_usd":250,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":1},
      {"id":"dlet_2","row_type":"ITEM","subwork_title":"","concept":"Romper / reponer cemento de platina.","unit":"Global","unit_price_usd":75,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":2},
      {"id":"dlet_3","row_type":"ITEM","subwork_title":"","concept":"Tomar huelgos de timón y mecha. Tomar caída de eje.","unit":"Global","unit_price_usd":0,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":3},
      {"id":"dlet_4","row_type":"ITEM","subwork_title":"","concept":"Desmontar y montar pala de timón. Depositar en grada.","unit":"Unidad","unit_price_usd":1900,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":4},
      {"id":"dlet_5","row_type":"NOTE","subwork_title":"","concept":"No incluye: desarme / recorrido de máquina de timón.","unit":"","unit_price_usd":0,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":5},
      {"id":"dlet_6","row_type":"ITEM","subwork_title":"","concept":"Desmontar y montar mecha de timón. Depositar en grada (contempla sist. Con yugo)","unit":"Unidad","unit_price_usd":1800,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":6},
      {"id":"dlet_7","row_type":"ITEM","subwork_title":"","concept":"Desmontar / montar hélice paso fijo.","unit":"Unidad","unit_price_usd":2200,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":7},
      {"id":"dlet_8","row_type":"ITEM","subwork_title":"","concept":"Desmontar / montar línea de eje portahélice. Depositar en grada","unit":"Unidad","unit_price_usd":3800,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":8},
      {"id":"dlet_9","row_type":"ITEM","subwork_title":"","concept":"Reponer empaquetadura","unit":"Global","unit_price_usd":400,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":9},
      {"id":"dlet_10","row_type":"ITEM","subwork_title":"","concept":"Bocina limpieza y calibrado","unit":"Unidad","unit_price_usd":360,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":10},
      {"id":"dlet_11","row_type":"ITEM","subwork_title":"","concept":"Calibrado de mecha y bulonería de anclaje","unit":"Unidad","unit_price_usd":250,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":11}
    ]'::jsonb
  ),
  (
    'LINEA DE EJE',
    11,
    'Trabajos sobre línea de eje, bujes y alineación.',
    NULL,
    'EXENTO',
    'JEFE_DE_OBRA',
    '[]'::jsonb
  ),
  (
    'LINEA DE TIMON',
    12,
    'Trabajos sobre línea de timón, mecha y guardacabos.',
    NULL,
    'EXENTO',
    'JEFE_DE_OBRA',
    '[]'::jsonb
  ),
  (
    'CARENADO DE CASCO',
    13,
    E'1) LAVADO DE CASCO: Lavado y rasqueteado de casco con agua dulce a alta presión obra viva y obra muerta.\n2) CARENADO DE CASCO: Hidro arenado de casco obra viva y obra muerta, barrido Grado SA1 con un 20% de profundización Grado SA 2,5. Pintado de casco según esquema provisto por el armador acorde proveedor de pintura.\n3) PROFUNDIZADO: Profundización parcial a grado SA 2,5 en sectores de popa en ambas bandas en un 30%. Por pedido del armador e inspector de pinturas se profundiza al 100%.\n4) CARTELERIA LINEA DE FLOTACION Y MARCAS DE CALADO: Pintado de líneas de flotación babor, estribor y espejo. Pintado de nombre, matrícula, calados, puerto de asiento, francobordo marcos (OM Nº1/1997 de PNA).',
    'Pinturas y diluyente provistas por el armador.',
    'EXENTO',
    'JEFE_DE_OBRA',
    '[
      {"id":"car_1","row_type":"SUBWORK","subwork_title":"1) LAVADO DE CASCO","concept":"Lavado y rasqueteado de casco con agua dulce a alta presión obra viva y obra muerta.","unit":"Global","unit_price_usd":1750,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":1},
      {"id":"car_2","row_type":"SUBWORK","subwork_title":"2) CARENADO DE CASCO","concept":"Hidro arenado de casco obra viva y obra muerta, barrido Grado SA1 con un 20% de profundización Grado SA 2,5. Pintado de casco según esquema provisto por el armador acorde proveedor de pintura. Pinturas y diluyente provistas por el armador.","unit":"Global","unit_price_usd":18600,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":2},
      {"id":"car_3","row_type":"SUBWORK","subwork_title":"3) PROFUNDIZADO","concept":"Profundización parcial a grado SA 2,5 en sectores de popa en ambas bandas en un 30%. Por pedido del armador e inspector de pinturas se profundiza al 100%.","unit":"Global","unit_price_usd":2800,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":3},
      {"id":"car_4","row_type":"SUBWORK","subwork_title":"4) CARTELERIA LINEA DE FLOTACION Y MARCAS DE CALADO","concept":"Pintado de líneas de flotación babor, estribor y espejo. Pintado de nombre, matrícula, calados, puerto de asiento, francobordo marcos (OM Nº1/1997 de PNA). Pinturas y diluyente provistas por el armador.","unit":"Global","unit_price_usd":750,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":4}
    ]'::jsonb
  ),
  (
    'SUMINISTROS',
    14,
    E'• Conexión energía eléctrica 3x380 (Suministro de energía eléctrica 3x380 x día)\n• Servicio de escala\n• Suministro agua potable',
    NULL,
    'GRAVADO_21',
    'CARGA_MANUAL',
    '[
      {"id":"sum_1","row_type":"ITEM","subwork_title":"","concept":"Conexión energía eléctrica 3x380 (Suministro de energía eléctrica 3x380 x día)","unit":"Día","unit_price_usd":130,"tax_type":"GRAVADO_21","data_source":"CARGA_MANUAL","sort_order":1},
      {"id":"sum_2","row_type":"ITEM","subwork_title":"","concept":"Servicio de escala","unit":"Servicio","unit_price_usd":0,"tax_type":"GRAVADO_21","data_source":"CARGA_MANUAL","sort_order":2},
      {"id":"sum_3","row_type":"ITEM","subwork_title":"","concept":"Suministro agua potable","unit":"Servicio","unit_price_usd":0,"tax_type":"GRAVADO_21","data_source":"CARGA_MANUAL","sort_order":3}
    ]'::jsonb
  ),
  (
    'SUPER ESTRUCTURA Y CUBIERTA',
    15,
    E'• Lavado con agua dulce y desengrasado de superestructura, interior de borda, cubierta, pórtico y palo de luces.\n• Lijado, picareteado y tratamiento manual mecánico ST3 en superestructura, tambuchos, mamparo de pañol de interior de borda y pintado con anticorrosivo y terminación a color acorde norma PNA.\n• Se incluye cubierta de castillo, pórtico, palo de luces, y barandilla.',
    'PINTURAS Y DILUYENTE PROVISTAS POR EL ARMADOR',
    'EXENTO',
    'CARGA_MANUAL',
    '[
      {"id":"sup_1","row_type":"ITEM","subwork_title":"","concept":"Tratamiento de superestructura: lavado con agua dulce y desengrasado, lijado, picareteado y tratamiento manual mecánico ST3 en superestructura, tambuchos, mamparo de pañol de interior de borda y pintado con anticorrosivo y terminación acorde norma PNA (incluye cubierta de castillo, pórtico, palo de luces y barandilla).","unit":"Global","unit_price_usd":18700,"tax_type":"EXENTO","data_source":"CARGA_MANUAL","sort_order":1},
      {"id":"sup_2","row_type":"NOTE","subwork_title":"","concept":"PINTURAS Y DILUYENTE PROVISTAS POR EL ARMADOR","unit":"","unit_price_usd":0,"tax_type":"EXENTO","data_source":"CARGA_MANUAL","sort_order":2}
    ]'::jsonb
  ),
  (
    'Anclas y Cadenas',
    16,
    'Inspección, recorrido y calibrado de anclas, cadenas y pozo de cadenas.',
    NULL,
    'EXENTO',
    'JEFE_DE_OBRA',
    '[]'::jsonb
  ),
  (
    'TANQUES',
    17,
    E'• Desmontar/Montar tapa de registro, renovando juntas. Por c/u.\n• Limpieza de tanques de gas oil. Por m3. Mínimo 10m3\n• Retiro de hidrocarburos\n• Limpieza de tanques de agua dulce. Por m3. Mínimo 10m3\n• Achique o trasvase de tanque de agua dulce. Por m3.',
    'Nota: Se consideró 1 tapa por tanque. Se ajustará cantidad según necesidad de obra. Mínimo 10m3. NO incluye disposición final de residuos oleosos.',
    'EXENTO',
    'JEFE_DE_OBRA',
    '[
      {"id":"tan_1","row_type":"ITEM","subwork_title":"","concept":"Desmontar/Montar tapa de registro, renovando juntas. Por c/u.","unit":"Unidad","unit_price_usd":210,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":1},
      {"id":"tan_2","row_type":"ITEM","subwork_title":"","concept":"Limpieza de tanques de gas oil. Por m3. Mínimo 10m3","unit":"m3","unit_price_usd":48,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":2},
      {"id":"tan_3","row_type":"ITEM","subwork_title":"","concept":"Retiro de hidrocarburos","unit":"m3","unit_price_usd":10,"tax_type":"EXENTO","data_source":"PADRON_BUQUES","sort_order":3},
      {"id":"tan_4","row_type":"ITEM","subwork_title":"","concept":"Limpieza de tanques de agua dulce. Por m3. Mínimo 10m3","unit":"m3","unit_price_usd":40,"tax_type":"EXENTO","data_source":"PADRON_BUQUES","sort_order":4},
      {"id":"tan_5","row_type":"ITEM","subwork_title":"","concept":"Achique o trasvase de tanque de agua dulce. Por m3.","unit":"m3","unit_price_usd":10,"tax_type":"EXENTO","data_source":"PADRON_BUQUES","sort_order":5},
      {"id":"tan_6","row_type":"NOTE","subwork_title":"","concept":"Nota: Se consideró 1 tapa por tanque. Se ajustará cantidad según necesidad de obra. Mínimo 10m3. NO incluye disposición final de residuos oleosos.","unit":"","unit_price_usd":0,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":6}
    ]'::jsonb
  ),
  (
    'SENTINA',
    18,
    E'• Limpieza de sentina de sala máquina.\n• Pintado de interior de tanques según esquema provisto por armador. Por m2.',
    'Nota: No incluye picareteado y pintura. NO incluye disposición final de residuos oleosos.',
    'EXENTO',
    'JEFE_DE_OBRA',
    '[
      {"id":"sen_1","row_type":"ITEM","subwork_title":"","concept":"Limpieza de sentina de sala máquina.","unit":"Global","unit_price_usd":480,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":1},
      {"id":"sen_2","row_type":"ITEM","subwork_title":"","concept":"Pintado de interior de tanques según esquema provisto por armador. Por m2","unit":"m2","unit_price_usd":6,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":2},
      {"id":"sen_3","row_type":"NOTE","subwork_title":"","concept":"Nota: No incluye picareteado y pintura. NO incluye disposición final de residuos oleosos.","unit":"","unit_price_usd":0,"tax_type":"EXENTO","data_source":"JEFE_DE_OBRA","sort_order":3}
    ]'::jsonb
  )
)
UPDATE public.ot_templates AS t
   SET sort_order          = s.sort_order,
       description         = COALESCE(NULLIF(trim(t.description), ''), s.description),
       fixed_notes         = COALESCE(NULLIF(trim(t.fixed_notes), ''), s.fixed_notes),
       default_tax_type    = s.default_tax_type,
       default_data_source = s.default_data_source,
       line_items          = CASE
                               WHEN jsonb_array_length(COALESCE(t.line_items, '[]'::jsonb)) = 0 THEN s.line_items
                               ELSE t.line_items
                             END,
       updated_at          = NOW()
  FROM seed AS s
 WHERE upper(trim(t.name)) = upper(trim(s.name));

COMMIT;
