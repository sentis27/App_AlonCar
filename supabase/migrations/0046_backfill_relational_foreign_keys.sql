-- ==============================================================================
-- MIGRACIÓN 0046: SECTORES BASE, LIMPIEZA DE PRUEBAS Y BACKFILL HISTÓRICO DE FKs
-- ==============================================================================
-- Requiere: Migración 0045 aplicada previamente.
-- Propósito:
-- 1. Eliminar registros de prueba confirmados por usuario:
--    - labor_logs: 'Carlos Peralta' (3), 'Lucas Benítez' (1)
--    - purchase_orders: 'Andrés Vanoli' (5)
-- 2. Incorporar en public.workers filas de soporte/sector (status='ADMINISTRATIVO',
--    category='SECTOR') para ASTILLERO.*, PAÑOL y ADMINISTRACION.
-- 3. Rellenar worker_id / contractor_id / requested_by / material_id / work_item_contractors
--    por coincidencia exacta única (excluyendo homónimos) y alias confirmados.
-- 4. Registrar trazabilidad en public.audit_logs.
-- ==============================================================================

BEGIN;

DO $$
DECLARE
  v_deleted_labor_ids UUID[];
  v_deleted_po_ids UUID[];
  v_labor_updated INT := 0;
  v_inv_updated INT := 0;
  v_gas_updated INT := 0;
  v_tps_updated INT := 0;
  v_wic_inserted INT := 0;
  v_po_req_updated INT := 0;
  v_po_mat_updated INT := 0;
BEGIN
  -- 1. Limpieza de registros de prueba confirmados
  WITH del_labor AS (
    DELETE FROM public.labor_logs
    WHERE worker_name IN ('Carlos Peralta', 'Lucas Benítez')
    RETURNING id
  )
  SELECT COALESCE(array_agg(id), ARRAY[]::UUID[]) INTO v_deleted_labor_ids FROM del_labor;

  WITH del_po AS (
    DELETE FROM public.purchase_orders
    WHERE requested_by_name = 'Andrés Vanoli'
    RETURNING id
  )
  SELECT COALESCE(array_agg(id), ARRAY[]::UUID[]) INTO v_deleted_po_ids FROM del_po;

  IF COALESCE(array_length(v_deleted_labor_ids, 1), 0) > 0
     OR COALESCE(array_length(v_deleted_po_ids, 1), 0) > 0 THEN
    INSERT INTO public.audit_logs (action, entity_type, entity_id, entity_name, details, performed_by)
    VALUES (
      'CLEANUP_TEST_ROWS',
      'data_normalization',
      '0046_cleanup',
      'Limpieza de registros de prueba (Carlos Peralta, Lucas Benítez, Andrés Vanoli)',
      jsonb_build_object(
        'deleted_labor_logs_count', COALESCE(array_length(v_deleted_labor_ids, 1), 0),
        'deleted_labor_logs_ids', to_jsonb(v_deleted_labor_ids),
        'deleted_purchase_orders_count', COALESCE(array_length(v_deleted_po_ids, 1), 0),
        'deleted_purchase_orders_ids', to_jsonb(v_deleted_po_ids)
      ),
      'Migración 0046 (Normalización FK)'
    );
  END IF;

  -- 2. Alta idempotente de sectores de soporte de Astillero y solicitantes internos
  INSERT INTO public.workers (
    name, work_group, trade, admin_center, category, status,
    safety_items, consumables, consumables_discount_pct,
    can_withdraw_materials, can_impute_hours, can_charge_third_party, is_foreman, notes
  )
  SELECT v.name, 'ASTILLERO', v.trade, 'ASTILLERO', 'SECTOR', 'ADMINISTRATIVO',
         'ASTILLERO', 'CLIENTE', 0,
         v.can_withdraw, false, false, false, v.notes
  FROM (VALUES
    ('ASTILLERO.CALDERERIA',  'CALDERERIA',     true,  'Sector operativo propio de Astillero (Calderería)'),
    ('ASTILLERO.CARPINTERIA', 'CARPINTERIA',    true,  'Sector operativo propio de Astillero (Carpintería)'),
    ('ASTILLERO.MECANICA',    'MECANICA',       true,  'Sector operativo propio de Astillero (Mecánica)'),
    ('ASTILLERO.RASCHINAJE',  'RASCHINAJE',     true,  'Sector operativo propio de Astillero (Raschinaje)'),
    ('ASTILLERO.GENERAL',     'GENERAL',        true,  'Sector operativo general propio de Astillero'),
    ('PAÑOL',                 'PAÑOL',          true,  'Sector Pañol Central (solicitante y control de insumos)'),
    ('ADMINISTRACION',        'ADMINISTRACION', false, 'Sector Administración Central (solicitante de compras)')
  ) AS v(name, trade, can_withdraw, notes)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.workers w WHERE lower(trim(w.name)) = lower(trim(v.name))
  );

  UPDATE public.workers
     SET notes = 'Armador esporádico de la empresa (alias histórico en compras: LUIS M)',
         updated_at = NOW()
   WHERE id = 'c9f28b91-c586-4590-a941-e5daffce125a'
     AND NULLIF(trim(notes), '') IS NULL;

  -- 3. Backfill relacional por coincidencia exacta única (y alias confirmados)
  WITH unique_workers AS (
    SELECT lower(trim(name)) AS norm_name, (array_agg(id))[1] AS worker_id
    FROM public.workers
    GROUP BY lower(trim(name))
    HAVING count(*) = 1
  ),
  worker_aliases(alias_norm, target_norm) AS (
    VALUES
      ('aldo',            'aldo (carpintero)'),
      ('alon car',        'alon car sa'),
      ('teco taller naval','teco taller'),
      ('hugo',            'hugo obregozo'),
      ('luis m',          'luis maria errecaborde')
  ),
  resolved_names AS (
    SELECT norm_name AS key_norm, worker_id FROM unique_workers
    UNION ALL
    SELECT wa.alias_norm AS key_norm, uw.worker_id
    FROM worker_aliases wa
    JOIN unique_workers uw ON uw.norm_name = wa.target_norm
    WHERE NOT EXISTS (SELECT 1 FROM unique_workers u2 WHERE u2.norm_name = wa.alias_norm)
  ),
  upd_labor AS (
    UPDATE public.labor_logs l
       SET worker_id = rn.worker_id
      FROM resolved_names rn
     WHERE l.worker_id IS NULL
       AND lower(trim(l.worker_name)) = rn.key_norm
    RETURNING l.id
  ),
  upd_inv AS (
    UPDATE public.inventory_transactions i
       SET worker_id = rn.worker_id
      FROM resolved_names rn
     WHERE i.worker_id IS NULL
       AND lower(trim(COALESCE(NULLIF(trim(i.worker_name), ''), NULLIF(trim(i.contractor_name), ''), ''))) = rn.key_norm
    RETURNING i.id
  ),
  upd_gas AS (
    UPDATE public.gas_cylinder_movements g
       SET worker_id = rn.worker_id
      FROM resolved_names rn
     WHERE g.worker_id IS NULL
       AND lower(trim(COALESCE(NULLIF(trim(g.worker_name), ''), NULLIF(trim(g.contractor_name), ''), ''))) = rn.key_norm
    RETURNING g.id
  ),
  upd_tps AS (
    UPDATE public.third_party_services t
       SET contractor_id = rn.worker_id
      FROM resolved_names rn
     WHERE t.contractor_id IS NULL
       AND lower(trim(t.contractor_name)) = rn.key_norm
    RETURNING t.id
  ),
  wi_tokens AS (
    SELECT wi.id AS work_item_id, trim(tok) AS raw_tok
    FROM public.work_items wi,
         LATERAL unnest(
           CASE
             WHEN COALESCE(array_length(wi.contractors, 1), 0) > 0 THEN wi.contractors
             WHEN NULLIF(trim(wi.contractor_name), '') IS NOT NULL THEN string_to_array(wi.contractor_name, ',')
             ELSE ARRAY[]::TEXT[]
           END
         ) AS tok
    WHERE NULLIF(trim(tok), '') IS NOT NULL
  ),
  ins_wic AS (
    INSERT INTO public.work_item_contractors (work_item_id, worker_id)
    SELECT DISTINCT wt.work_item_id, rn.worker_id
    FROM wi_tokens wt
    JOIN resolved_names rn ON lower(wt.raw_tok) = rn.key_norm
    ON CONFLICT (work_item_id, worker_id) DO NOTHING
    RETURNING work_item_id
  ),
  upd_po_req AS (
    UPDATE public.purchase_orders po
       SET requested_by = rn.worker_id
      FROM resolved_names rn
     WHERE po.requested_by IS NULL
       AND lower(trim(po.requested_by_name)) = rn.key_norm
    RETURNING po.id
  ),
  unique_materials AS (
    SELECT lower(trim(name)) AS norm_name, (array_agg(id))[1] AS material_id
    FROM public.materials
    GROUP BY lower(trim(name))
    HAVING count(*) = 1
  ),
  upd_po_mat AS (
    UPDATE public.purchase_orders po
       SET material_id = um.material_id,
           is_new_material = false
      FROM unique_materials um
     WHERE po.material_id IS NULL
       AND lower(trim(po.material_name_raw)) = um.norm_name
    RETURNING po.id
  )
  SELECT
    (SELECT count(*) FROM upd_labor),
    (SELECT count(*) FROM upd_inv),
    (SELECT count(*) FROM upd_gas),
    (SELECT count(*) FROM upd_tps),
    (SELECT count(*) FROM ins_wic),
    (SELECT count(*) FROM upd_po_req),
    (SELECT count(*) FROM upd_po_mat)
  INTO v_labor_updated, v_inv_updated, v_gas_updated, v_tps_updated, v_wic_inserted, v_po_req_updated, v_po_mat_updated;

  -- 4. Auditoría consolidada del backfill
  INSERT INTO public.audit_logs (action, entity_type, entity_id, entity_name, details, performed_by)
  VALUES (
    'BACKFILL_FK',
    'data_normalization',
    '0046_backfill',
    'Backfill histórico de Claves Foráneas Relacionales',
    jsonb_build_object(
      'labor_logs_worker_id', v_labor_updated,
      'inventory_transactions_worker_id', v_inv_updated,
      'gas_cylinder_movements_worker_id', v_gas_updated,
      'third_party_services_contractor_id', v_tps_updated,
      'work_item_contractors_links', v_wic_inserted,
      'purchase_orders_requested_by', v_po_req_updated,
      'purchase_orders_material_id', v_po_mat_updated
    ),
    'Migración 0046 (Normalización FK)'
  );
END $$;

COMMIT;
