-- ==============================================================================
-- MIGRACIÓN 0057: BASE DE DATOS ÚNICA DE PRC DE CONTRATISTAS (#2000+)
-- ==============================================================================
-- Propósito:
--   Reemplazar la libreta física de papel por una fuente única de verdad inmutable
--   en Terceros (`/terceros?tab=base-prc`), arrancando desde el Nº 2000.
-- Reglas:
--   - Solo aplica a contratistas externos trabajando dentro del astillero
--     (talleres externos fuera del astillero usan RMO; personal ASTILLERO excluido).
--   - El número `prc_number` es único, automático e inmutable.
--   - Prohibido borrar registros; para cancelar se usa Anular (tachado).
--   - Los aumentos o cambios generan un nuevo PRC vinculado como Adicional.
--   - Visibilidad inicial: ADMIN_GENERAL, LIQUIDACION_SUELDOS (María José) y TESORERIA (Graciela).

BEGIN;

-- 1. Secuencia correlativa iniciando en 2000
CREATE SEQUENCE IF NOT EXISTS public.contractor_prc_number_seq
  AS INTEGER
  START WITH 2000
  INCREMENT BY 1
  MINVALUE 2000
  NO CYCLE;

-- 2. Tabla maestra `contractor_prc_registry`
CREATE TABLE IF NOT EXISTS public.contractor_prc_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prc_number INTEGER NOT NULL UNIQUE DEFAULT nextval('public.contractor_prc_number_seq'),
  issue_date DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE),
  contractor_worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
  contractor_name TEXT NOT NULL CHECK (length(trim(contractor_name)) > 0),
  ship_id UUID REFERENCES public.ships(id) ON DELETE SET NULL,
  work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
  work_item_id UUID REFERENCES public.work_items(id) ON DELETE SET NULL,
  third_party_service_id UUID REFERENCES public.third_party_services(id) ON DELETE SET NULL,
  description TEXT NOT NULL DEFAULT '',
  amount_ars NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (amount_ars >= 0),
  amount_usd NUMERIC(14,2) DEFAULT 0 CHECK (amount_usd IS NULL OR amount_usd >= 0),
  exchange_rate NUMERIC(12,4) CHECK (exchange_rate IS NULL OR exchange_rate > 0),
  status TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (status IN ('ACTIVO', 'TERMINADO', 'ANULADO')),
  parent_prc_id UUID REFERENCES public.contractor_prc_registry(id) ON DELETE RESTRICT,
  parent_prc_number INTEGER,
  annulled_reason TEXT,
  annulled_by TEXT,
  annulled_at TIMESTAMPTZ,
  source_module TEXT NOT NULL DEFAULT 'TERCEROS_PRC'
    CHECK (source_module IN ('TERCEROS_PRC', 'TERCEROS_FILAS', 'OT_UNIFICADO', 'MANUAL')),
  observations TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_contractor_prc_not_self_parent CHECK (parent_prc_id IS NULL OR parent_prc_id <> id),
  CONSTRAINT chk_contractor_prc_annulled_reason CHECK (status <> 'ANULADO' OR length(trim(coalesce(annulled_reason, ''))) > 0)
);

CREATE INDEX IF NOT EXISTS idx_contractor_prc_registry_number
  ON public.contractor_prc_registry (prc_number DESC);

CREATE INDEX IF NOT EXISTS idx_contractor_prc_registry_status_date
  ON public.contractor_prc_registry (status, issue_date DESC);

CREATE INDEX IF NOT EXISTS idx_contractor_prc_registry_parent
  ON public.contractor_prc_registry (parent_prc_id)
  WHERE parent_prc_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contractor_prc_registry_work_item
  ON public.contractor_prc_registry (work_item_id)
  WHERE work_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contractor_prc_registry_tp_service
  ON public.contractor_prc_registry (third_party_service_id)
  WHERE third_party_service_id IS NOT NULL;

-- 3. Trigger de inmutabilidad: prohíbe borrar filas, editar prc_number o reactivar ANULADO
CREATE OR REPLACE FUNCTION public.trg_contractor_prc_immutable_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_parent_num INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Prohibido borrar PRC #% de la Base de Datos de PRC. Utilizar la acción Anular (tachado).', OLD.prc_number;
  END IF;

  IF NEW.prc_number IS DISTINCT FROM OLD.prc_number THEN
    RAISE EXCEPTION 'El número de PRC (#%) es inmutable y no puede modificarse.', OLD.prc_number;
  END IF;

  IF OLD.status = 'ANULADO' AND NEW.status <> 'ANULADO' THEN
    RAISE EXCEPTION 'Un PRC anulado (#%) no puede reactivarse; emita un nuevo PRC correlativo.', OLD.prc_number;
  END IF;

  IF NEW.parent_prc_id IS NOT NULL AND NEW.parent_prc_number IS NULL THEN
    SELECT prc_number INTO v_parent_num
      FROM public.contractor_prc_registry
     WHERE id = NEW.parent_prc_id;
    NEW.parent_prc_number := v_parent_num;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contractor_prc_immutable_guard ON public.contractor_prc_registry;
CREATE TRIGGER trg_contractor_prc_immutable_guard
  BEFORE UPDATE OR DELETE ON public.contractor_prc_registry
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_contractor_prc_immutable_guard();

-- 4. RPC de previsualización SIN consumir número de secuencia
CREATE OR REPLACE FUNCTION public.peek_next_contractor_prc_number()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last INTEGER;
  v_is_called BOOLEAN;
  v_seq_next INTEGER;
  v_max_used INTEGER;
BEGIN
  SELECT last_value, is_called
    INTO v_last, v_is_called
    FROM public.contractor_prc_number_seq;

  v_seq_next := CASE WHEN coalesce(v_is_called, false) THEN v_last + 1 ELSE v_last END;
  SELECT coalesce(max(prc_number) + 1, 2000)
    INTO v_max_used
    FROM public.contractor_prc_registry;

  RETURN GREATEST(2000, v_seq_next, v_max_used);
END;
$$;

-- 5. RPC de emisión atómica de PRC (nuevo o adicional)
CREATE OR REPLACE FUNCTION public.issue_contractor_prc(
  p_contractor_name TEXT,
  p_contractor_worker_id UUID DEFAULT NULL,
  p_ship_id UUID DEFAULT NULL,
  p_work_order_id UUID DEFAULT NULL,
  p_work_item_id UUID DEFAULT NULL,
  p_third_party_service_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT '',
  p_amount_ars NUMERIC DEFAULT 0,
  p_amount_usd NUMERIC DEFAULT 0,
  p_exchange_rate NUMERIC DEFAULT NULL,
  p_issue_date DATE DEFAULT NULL,
  p_parent_prc_id UUID DEFAULT NULL,
  p_source_module TEXT DEFAULT 'TERCEROS_PRC',
  p_observations TEXT DEFAULT NULL,
  p_created_by TEXT DEFAULT NULL
)
RETURNS public.contractor_prc_registry
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_name TEXT := trim(coalesce(p_contractor_name, ''));
  v_admin_center TEXT;
  v_parent_num INTEGER := NULL;
  v_seq_last INTEGER;
  v_seq_called BOOLEAN;
  v_max_used INTEGER;
  v_issue_date DATE;
  v_row public.contractor_prc_registry;
BEGIN
  IF length(v_clean_name) = 0 THEN
    RAISE EXCEPTION 'El nombre del contratista es obligatorio para emitir un PRC.';
  END IF;

  IF p_contractor_worker_id IS NOT NULL THEN
    SELECT upper(coalesce(admin_center, ''))
      INTO v_admin_center
      FROM public.workers
     WHERE id = p_contractor_worker_id;

    IF v_admin_center = 'ASTILLERO' THEN
      RAISE EXCEPTION 'Los presupuestos (PRC) aplican únicamente a contratistas trabajando dentro del astillero, no a personal propio de ASTILLERO.';
    END IF;
  END IF;

  IF p_parent_prc_id IS NOT NULL THEN
    SELECT prc_number
      INTO v_parent_num
      FROM public.contractor_prc_registry
     WHERE id = p_parent_prc_id;

    IF v_parent_num IS NULL THEN
      RAISE EXCEPTION 'No se encontró el PRC padre (%) para vincular el adicional.', p_parent_prc_id;
    END IF;
  END IF;

  -- Sincronizar secuencia si existe un máximo mayor o igual al contador actual
  SELECT last_value, is_called
    INTO v_seq_last, v_seq_called
    FROM public.contractor_prc_number_seq;

  SELECT max(prc_number)
    INTO v_max_used
    FROM public.contractor_prc_registry;

  IF v_max_used IS NOT NULL AND (v_max_used >= v_seq_last OR NOT coalesce(v_seq_called, false)) THEN
    PERFORM setval('public.contractor_prc_number_seq', GREATEST(1999, v_max_used), true);
  END IF;

  v_issue_date := coalesce(p_issue_date, (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE);

  INSERT INTO public.contractor_prc_registry (
    issue_date,
    contractor_worker_id,
    contractor_name,
    ship_id,
    work_order_id,
    work_item_id,
    third_party_service_id,
    description,
    amount_ars,
    amount_usd,
    exchange_rate,
    status,
    parent_prc_id,
    parent_prc_number,
    source_module,
    observations,
    created_by
  )
  VALUES (
    v_issue_date,
    p_contractor_worker_id,
    v_clean_name,
    p_ship_id,
    p_work_order_id,
    p_work_item_id,
    p_third_party_service_id,
    coalesce(trim(p_description), ''),
    coalesce(p_amount_ars, 0),
    p_amount_usd,
    p_exchange_rate,
    'ACTIVO',
    p_parent_prc_id,
    v_parent_num,
    coalesce(nullif(trim(p_source_module), ''), 'TERCEROS_PRC'),
    nullif(trim(coalesce(p_observations, '')), ''),
    nullif(trim(coalesce(p_created_by, '')), '')
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- 6. RLS y permisos de ejecución
ALTER TABLE public.contractor_prc_registry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access contractor_prc_registry" ON public.contractor_prc_registry;
CREATE POLICY "Public access contractor_prc_registry"
  ON public.contractor_prc_registry FOR ALL
  USING (true) WITH CHECK (true);

GRANT ALL ON public.contractor_prc_registry TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.contractor_prc_number_seq TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.peek_next_contractor_prc_number() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.issue_contractor_prc(
  TEXT, UUID, UUID, UUID, UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, DATE, UUID, TEXT, TEXT, TEXT
) TO anon, authenticated, service_role;

-- 7. Realtime publication idempotente
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'contractor_prc_registry'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.contractor_prc_registry;
    END IF;
  END IF;
END $$;

-- 8. Permiso privado inicial: solo ADMIN_GENERAL, LIQUIDACION_SUELDOS (María José) y TESORERIA (Graciela)
UPDATE public.organization_roles
   SET allowed_sections = array_append(coalesce(allowed_sections, ARRAY[]::TEXT[]), 'terceros.base_prc')
 WHERE role_key IN ('ADMIN_GENERAL', 'LIQUIDACION_SUELDOS', 'TESORERIA')
   AND NOT ('terceros.base_prc' = ANY(coalesce(allowed_sections, ARRAY[]::TEXT[])));

COMMIT;

NOTIFY pgrst, 'reload schema';
