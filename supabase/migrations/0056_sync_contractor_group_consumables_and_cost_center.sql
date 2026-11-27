-- ==============================================================================
-- MIGRACIÓN 0056: SANEAMIENTO GRUPAL DE CONSUMIBLES EN WORKERS Y COST_CENTER EN PAÑOL
-- ==============================================================================
-- Propósito:
-- 1. Garantizar consistencia en `public.workers`:
--    - ASTILLERO propio siempre en `CLIENTE` / `0%` / `safety_items = 'ASTILLERO'`.
--    - Todo `work_group` externo (CONTRATISTA / TALLER) sincroniza la regla de
--      consumibles y EPP entre cabecera e integrantes (activos e inactivos).
--    - Eliminar contradicciones heredadas de migraciones 0003/0006 (`CLIENTE` + `100`).
-- 2. Backfill de `inventory_transactions.cost_center` según regla documentada
--    GS-002 / DEC-009 (Consumibles/EPP a cargo de contratista => 'CONTRATISTA').
-- 3. Registrar trazabilidad en `public.audit_logs`.
-- ==============================================================================

BEGIN;

DO $$
DECLARE
  v_astillero_fixed INT := 0;
  v_active_group_synced INT := 0;
  v_legacy_group_synced INT := 0;
  v_contradictions_fixed INT := 0;
  v_tx_cost_center_fixed INT := 0;
BEGIN
  -- 1a. Normalizar ASTILLERO propio (siempre CLIENTE / 0% / ASTILLERO)
  WITH upd_ast AS (
    UPDATE public.workers
       SET consumables = 'CLIENTE',
           consumables_discount_pct = 0,
           safety_items = 'ASTILLERO',
           updated_at = NOW()
     WHERE UPPER(TRIM(COALESCE(admin_center, ''))) = 'ASTILLERO'
       AND (
         UPPER(TRIM(COALESCE(consumables, ''))) <> 'CLIENTE'
         OR COALESCE(consumables_discount_pct, -1) <> 0
         OR UPPER(TRIM(COALESCE(safety_items, ''))) <> 'ASTILLERO'
       )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_astillero_fixed FROM upd_ast;

  -- 1b.1 Propagar regla activa por work_group a todas las filas del grupo externo
  WITH active_group_rules AS (
    SELECT DISTINCT ON (UPPER(TRIM(work_group)))
      UPPER(TRIM(work_group)) AS grp_key,
      consumables,
      consumables_discount_pct,
      COALESCE(NULLIF(UPPER(TRIM(safety_items)), ''), 'CONTRATISTA') AS eff_safety
    FROM public.workers
    WHERE UPPER(TRIM(COALESCE(admin_center, ''))) <> 'ASTILLERO'
      AND NULLIF(TRIM(work_group), '') IS NOT NULL
      AND UPPER(TRIM(COALESCE(status, ''))) = 'ACTIVO'
      AND UPPER(TRIM(COALESCE(consumables, 'CLIENTE'))) <> 'CLIENTE'
    ORDER BY
      UPPER(TRIM(work_group)),
      (UPPER(TRIM(name)) = UPPER(TRIM(work_group))) DESC,
      updated_at DESC NULLS LAST,
      created_at DESC NULLS LAST,
      id ASC
  ),
  upd_active_grp AS (
    UPDATE public.workers w
       SET consumables = r.consumables,
           consumables_discount_pct = r.consumables_discount_pct,
           safety_items = r.eff_safety,
           updated_at = NOW()
      FROM active_group_rules r
     WHERE UPPER(TRIM(COALESCE(w.admin_center, ''))) <> 'ASTILLERO'
       AND UPPER(TRIM(COALESCE(w.work_group, ''))) = r.grp_key
       AND (
         COALESCE(w.consumables, '') IS DISTINCT FROM r.consumables
         OR COALESCE(w.consumables_discount_pct, -1) IS DISTINCT FROM r.consumables_discount_pct
         OR UPPER(TRIM(COALESCE(w.safety_items, 'CONTRATISTA'))) IS DISTINCT FROM r.eff_safety
       )
    RETURNING w.id
  )
  SELECT COUNT(*) INTO v_active_group_synced FROM upd_active_grp;

  -- 1b.2 Propagar CONTRATISTA/100% en grupos sin regla activa <> CLIENTE pero con integrantes CONTRATISTA
  --      y sin ninguna fila ACTIVO configurada explícitamente en CLIENTE + 0%
  WITH legacy_contractor_groups AS (
    SELECT UPPER(TRIM(work_group)) AS grp_key
    FROM public.workers
    WHERE UPPER(TRIM(COALESCE(admin_center, ''))) <> 'ASTILLERO'
      AND NULLIF(TRIM(work_group), '') IS NOT NULL
    GROUP BY UPPER(TRIM(work_group))
    HAVING
      BOOL_OR(UPPER(TRIM(COALESCE(consumables, ''))) = 'CONTRATISTA')
      AND NOT BOOL_OR(
        UPPER(TRIM(COALESCE(status, ''))) = 'ACTIVO'
        AND UPPER(TRIM(COALESCE(consumables, 'CLIENTE'))) <> 'CLIENTE'
      )
      AND NOT BOOL_OR(
        UPPER(TRIM(COALESCE(status, ''))) = 'ACTIVO'
        AND UPPER(TRIM(COALESCE(consumables, 'CLIENTE'))) = 'CLIENTE'
        AND COALESCE(consumables_discount_pct, 0) = 0
      )
  ),
  upd_legacy_grp AS (
    UPDATE public.workers w
       SET consumables = 'CONTRATISTA',
           consumables_discount_pct = 100,
           updated_at = NOW()
      FROM legacy_contractor_groups l
     WHERE UPPER(TRIM(COALESCE(w.admin_center, ''))) <> 'ASTILLERO'
       AND UPPER(TRIM(COALESCE(w.work_group, ''))) = l.grp_key
       AND (
         UPPER(TRIM(COALESCE(w.consumables, ''))) <> 'CONTRATISTA'
         OR COALESCE(w.consumables_discount_pct, -1) <> 100
       )
    RETURNING w.id
  )
  SELECT COUNT(*) INTO v_legacy_group_synced FROM upd_legacy_grp;

  -- 1b.3 Limpiar cualquier contradicción residual (CLIENTE con % > 0 o etiqueta <> CLIENTE con % = 0)
  WITH upd_contra AS (
    UPDATE public.workers
       SET consumables = 'CLIENTE',
           consumables_discount_pct = 0,
           updated_at = NOW()
     WHERE UPPER(TRIM(COALESCE(admin_center, ''))) <> 'ASTILLERO'
       AND (
         (UPPER(TRIM(COALESCE(consumables, 'CLIENTE'))) = 'CLIENTE' AND COALESCE(consumables_discount_pct, 0) > 0)
         OR (UPPER(TRIM(COALESCE(consumables, 'CLIENTE'))) <> 'CLIENTE' AND COALESCE(consumables_discount_pct, 0) <= 0)
       )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_contradictions_fixed FROM upd_contra;

  -- 1c. Backfill de inventory_transactions.cost_center según GS-002 / DEC-009
  WITH resolved_tx AS (
    SELECT
      tx.id AS tx_id,
      COALESCE(
        w_id.id,
        (
          SELECT w2.id
          FROM public.workers w2
          WHERE UPPER(TRIM(w2.name)) = UPPER(TRIM(COALESCE(tx.contractor_name, tx.worker_name, '')))
             OR UPPER(TRIM(w2.work_group)) = UPPER(TRIM(COALESCE(tx.contractor_name, tx.worker_name, '')))
          ORDER BY
            (UPPER(TRIM(COALESCE(w2.status, ''))) = 'ACTIVO') DESC,
            (UPPER(TRIM(w2.name)) = UPPER(TRIM(COALESCE(tx.contractor_name, tx.worker_name, '')))) DESC,
            w2.updated_at DESC NULLS LAST,
            w2.id ASC
          LIMIT 1
        )
      ) AS resolved_worker_id,
      UPPER(TRIM(COALESCE(m.category, ''))) AS mat_category,
      UPPER(TRIM(COALESCE(tx.movement_type, ''))) AS mov_type
    FROM public.inventory_transactions tx
    LEFT JOIN public.materials m ON m.id = tx.material_id
    LEFT JOIN public.workers w_id ON w_id.id = tx.worker_id
    WHERE UPPER(TRIM(COALESCE(tx.cost_center, ''))) IN ('', 'CLIENTE')
      AND (
        UPPER(TRIM(COALESCE(m.category, ''))) IN ('CONSUMIBLES', 'ELEM.SEGURIDAD')
        OR UPPER(TRIM(COALESCE(tx.movement_type, ''))) = 'ENTREGA_EPP'
      )
  ),
  upd_tx AS (
    UPDATE public.inventory_transactions tx
       SET cost_center = 'CONTRATISTA'
      FROM resolved_tx r
      JOIN public.workers w ON w.id = r.resolved_worker_id
     WHERE tx.id = r.tx_id
       AND UPPER(TRIM(COALESCE(w.admin_center, ''))) <> 'ASTILLERO'
       AND (
         (
           r.mat_category = 'CONSUMIBLES'
           AND UPPER(TRIM(COALESCE(w.consumables, 'CLIENTE'))) <> 'CLIENTE'
           AND COALESCE(w.consumables_discount_pct, 0) > 0
         )
         OR (
           (r.mat_category = 'ELEM.SEGURIDAD' OR r.mov_type = 'ENTREGA_EPP')
           AND UPPER(TRIM(COALESCE(w.safety_items, 'CONTRATISTA'))) = 'CONTRATISTA'
         )
       )
    RETURNING tx.id
  )
  SELECT COUNT(*) INTO v_tx_cost_center_fixed FROM upd_tx;

  -- 1d. Registrar trazabilidad en audit_logs
  INSERT INTO public.audit_logs (action, entity_type, entity_id, entity_name, details, performed_by)
  VALUES (
    'MIGRATION_0056_SYNC',
    'workers',
    '0056_consumables_sync',
    'Saneamiento grupal de consumibles y cost_center en Pañol',
    jsonb_build_object(
      'astillero_fixed', v_astillero_fixed,
      'active_group_synced', v_active_group_synced,
      'legacy_group_synced', v_legacy_group_synced,
      'contradictions_fixed', v_contradictions_fixed,
      'tx_cost_center_fixed', v_tx_cost_center_fixed
    ),
    'Migración 0056'
  );
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
