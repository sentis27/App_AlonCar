-- ==============================================================================
-- MIGRACIÓN 0047: TRIGGERS DEFENSIVOS DE RESOLUCIÓN AUTOMÁTICA DE FKs (CAPA DB)
-- ==============================================================================
-- Requiere: Migraciones 0045 y 0046 aplicadas previamente.
-- Propósito:
-- Garantizar que cualquier inserción o actualización externa (n8n, IA, SQL directo)
-- selle automáticamente worker_id, contractor_id, requested_by, courier_worker_id,
-- material_id y work_item_contractors cuando exista coincidencia exacta y única,
-- respetando siempre los IDs explícitos (incluyendo homónimos desambiguados).
-- ==============================================================================

BEGIN;

-- 1. Funciones puras de resolución única (no adivinan homónimos)
CREATE OR REPLACE FUNCTION public.resolve_unique_worker_id(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean TEXT := lower(trim(COALESCE(p_name, '')));
  v_count INT;
  v_id UUID;
BEGIN
  IF v_clean = '' THEN
    RETURN NULL;
  END IF;

  SELECT count(*), (array_agg(id))[1]
    INTO v_count, v_id
    FROM public.workers
   WHERE lower(trim(name)) = v_clean;

  IF v_count = 1 THEN
    RETURN v_id;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_unique_material_id(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean TEXT := lower(trim(COALESCE(p_name, '')));
  v_count INT;
  v_id UUID;
BEGIN
  IF v_clean = '' THEN
    RETURN NULL;
  END IF;

  SELECT count(*), (array_agg(id))[1]
    INTO v_count, v_id
    FROM public.materials
   WHERE lower(trim(name)) = v_clean;

  IF v_count = 1 THEN
    RETURN v_id;
  END IF;

  RETURN NULL;
END;
$$;

-- 2. Trigger para labor_logs (worker_name -> worker_id)
CREATE OR REPLACE FUNCTION public.trg_autofill_labor_worker_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.worker_id IS NULL AND NULLIF(trim(COALESCE(NEW.worker_name, '')), '') IS NOT NULL THEN
      NEW.worker_id := public.resolve_unique_worker_id(NEW.worker_name);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.worker_id IS DISTINCT FROM OLD.worker_id AND NEW.worker_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
    IF NEW.worker_name IS DISTINCT FROM OLD.worker_name
       OR (NEW.worker_id IS NULL AND NULLIF(trim(COALESCE(NEW.worker_name, '')), '') IS NOT NULL) THEN
      NEW.worker_id := public.resolve_unique_worker_id(NEW.worker_name);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_labor_logs_autofill_worker_id ON public.labor_logs;
CREATE TRIGGER trg_labor_logs_autofill_worker_id
  BEFORE INSERT OR UPDATE OF worker_name, worker_id
  ON public.labor_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_autofill_labor_worker_id();

-- 3. Trigger para inventory_transactions y gas_cylinder_movements (worker_name/contractor_name -> worker_id)
CREATE OR REPLACE FUNCTION public.trg_autofill_movement_worker_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_name TEXT := COALESCE(NULLIF(trim(COALESCE(NEW.worker_name, '')), ''), NULLIF(trim(COALESCE(NEW.contractor_name, '')), ''), '');
  v_old_name TEXT := '';
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.worker_id IS NULL AND v_new_name <> '' THEN
      NEW.worker_id := public.resolve_unique_worker_id(v_new_name);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_name := COALESCE(NULLIF(trim(COALESCE(OLD.worker_name, '')), ''), NULLIF(trim(COALESCE(OLD.contractor_name, '')), ''), '');
    IF NEW.worker_id IS DISTINCT FROM OLD.worker_id AND NEW.worker_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
    IF v_new_name IS DISTINCT FROM v_old_name
       OR (NEW.worker_id IS NULL AND v_new_name <> '') THEN
      NEW.worker_id := public.resolve_unique_worker_id(v_new_name);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inv_tx_autofill_worker_id ON public.inventory_transactions;
CREATE TRIGGER trg_inv_tx_autofill_worker_id
  BEFORE INSERT OR UPDATE OF worker_name, contractor_name, worker_id
  ON public.inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_autofill_movement_worker_id();

DROP TRIGGER IF EXISTS trg_gas_mov_autofill_worker_id ON public.gas_cylinder_movements;
CREATE TRIGGER trg_gas_mov_autofill_worker_id
  BEFORE INSERT OR UPDATE OF worker_name, contractor_name, worker_id
  ON public.gas_cylinder_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_autofill_movement_worker_id();

-- 4. Trigger para third_party_services (contractor_name -> contractor_id)
CREATE OR REPLACE FUNCTION public.trg_autofill_tps_contractor_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.contractor_id IS NULL AND NULLIF(trim(COALESCE(NEW.contractor_name, '')), '') IS NOT NULL THEN
      NEW.contractor_id := public.resolve_unique_worker_id(NEW.contractor_name);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.contractor_id IS DISTINCT FROM OLD.contractor_id AND NEW.contractor_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
    IF NEW.contractor_name IS DISTINCT FROM OLD.contractor_name
       OR (NEW.contractor_id IS NULL AND NULLIF(trim(COALESCE(NEW.contractor_name, '')), '') IS NOT NULL) THEN
      NEW.contractor_id := public.resolve_unique_worker_id(NEW.contractor_name);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tps_autofill_contractor_id ON public.third_party_services;
CREATE TRIGGER trg_tps_autofill_contractor_id
  BEFORE INSERT OR UPDATE OF contractor_name, contractor_id
  ON public.third_party_services
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_autofill_tps_contractor_id();

-- 5. Trigger para purchase_orders (requested_by_name, courier_worker_name, material_name_raw)
CREATE OR REPLACE FUNCTION public.trg_autofill_po_refs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mat_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.requested_by IS NULL AND NULLIF(trim(COALESCE(NEW.requested_by_name, '')), '') IS NOT NULL THEN
      NEW.requested_by := public.resolve_unique_worker_id(NEW.requested_by_name);
    END IF;
    IF NEW.courier_worker_id IS NULL AND NULLIF(trim(COALESCE(NEW.courier_worker_name, '')), '') IS NOT NULL THEN
      NEW.courier_worker_id := public.resolve_unique_worker_id(NEW.courier_worker_name);
    END IF;
    IF NEW.material_id IS NULL AND NULLIF(trim(COALESCE(NEW.material_name_raw, '')), '') IS NOT NULL THEN
      v_mat_id := public.resolve_unique_material_id(NEW.material_name_raw);
      IF v_mat_id IS NOT NULL THEN
        NEW.material_id := v_mat_id;
        NEW.is_new_material := false;
      END IF;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NOT (NEW.requested_by IS DISTINCT FROM OLD.requested_by AND NEW.requested_by IS NOT NULL) THEN
      IF NEW.requested_by_name IS DISTINCT FROM OLD.requested_by_name
         OR (NEW.requested_by IS NULL AND NULLIF(trim(COALESCE(NEW.requested_by_name, '')), '') IS NOT NULL) THEN
        NEW.requested_by := public.resolve_unique_worker_id(NEW.requested_by_name);
      END IF;
    END IF;

    IF NOT (NEW.courier_worker_id IS DISTINCT FROM OLD.courier_worker_id AND NEW.courier_worker_id IS NOT NULL) THEN
      IF NEW.courier_worker_name IS DISTINCT FROM OLD.courier_worker_name
         OR (NEW.courier_worker_id IS NULL AND NULLIF(trim(COALESCE(NEW.courier_worker_name, '')), '') IS NOT NULL) THEN
        NEW.courier_worker_id := public.resolve_unique_worker_id(NEW.courier_worker_name);
      END IF;
    END IF;

    IF NOT (NEW.material_id IS DISTINCT FROM OLD.material_id AND NEW.material_id IS NOT NULL) THEN
      IF NEW.material_name_raw IS DISTINCT FROM OLD.material_name_raw THEN
        v_mat_id := public.resolve_unique_material_id(NEW.material_name_raw);
        NEW.material_id := v_mat_id;
        IF v_mat_id IS NOT NULL THEN
          NEW.is_new_material := false;
        END IF;
      ELSIF NEW.material_id IS NULL AND NULLIF(trim(COALESCE(NEW.material_name_raw, '')), '') IS NOT NULL THEN
        v_mat_id := public.resolve_unique_material_id(NEW.material_name_raw);
        IF v_mat_id IS NOT NULL THEN
          NEW.material_id := v_mat_id;
          NEW.is_new_material := false;
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_po_autofill_refs ON public.purchase_orders;
CREATE TRIGGER trg_po_autofill_refs
  BEFORE INSERT OR UPDATE OF requested_by_name, requested_by, courier_worker_name, courier_worker_id, material_name_raw, material_id
  ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_autofill_po_refs();

-- 6. Trigger AFTER para sincronizar work_item_contractors desde work_items
CREATE OR REPLACE FUNCTION public.trg_sync_work_item_contractors()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tokens TEXT[];
  v_norm_tokens TEXT[];
BEGIN
  IF COALESCE(array_length(NEW.contractors, 1), 0) > 0 THEN
    SELECT COALESCE(array_agg(DISTINCT trim(t)), ARRAY[]::TEXT[])
      INTO v_tokens
      FROM unnest(NEW.contractors) AS t
     WHERE NULLIF(trim(t), '') IS NOT NULL;
  ELSIF NULLIF(trim(COALESCE(NEW.contractor_name, '')), '') IS NOT NULL THEN
    SELECT COALESCE(array_agg(DISTINCT trim(t)), ARRAY[]::TEXT[])
      INTO v_tokens
      FROM unnest(string_to_array(NEW.contractor_name, ',')) AS t
     WHERE NULLIF(trim(t), '') IS NOT NULL;
  ELSE
    v_tokens := ARRAY[]::TEXT[];
  END IF;

  SELECT COALESCE(array_agg(lower(t)), ARRAY[]::TEXT[])
    INTO v_norm_tokens
    FROM unnest(v_tokens) AS t;

  DELETE FROM public.work_item_contractors wic
   WHERE wic.work_item_id = NEW.id
     AND NOT EXISTS (
       SELECT 1
         FROM public.workers w
        WHERE w.id = wic.worker_id
          AND lower(trim(w.name)) = ANY (v_norm_tokens)
     );

  INSERT INTO public.work_item_contractors (work_item_id, worker_id)
  SELECT DISTINCT NEW.id, public.resolve_unique_worker_id(t)
    FROM unnest(v_tokens) AS t
   WHERE public.resolve_unique_worker_id(t) IS NOT NULL
  ON CONFLICT (work_item_id, worker_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_work_items_sync_contractors ON public.work_items;
CREATE TRIGGER trg_work_items_sync_contractors
  AFTER INSERT OR UPDATE OF contractors, contractor_name
  ON public.work_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_work_item_contractors();

COMMIT;
