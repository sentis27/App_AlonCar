-- 0042_enable_supabase_realtime_publication.sql
-- Habilita eventos Postgres Changes (Supabase Realtime) para todas las tablas operativas
-- consumidas en vivo por los módulos del AlonCar ERP (soporte multiusuario concurrente).

DO $$
DECLARE
  tbl text;
  realtime_tables text[] := ARRAY[
    'audit_logs',
    'compliance_alerts',
    'contacts',
    'gas_cylinder_movements',
    'inventory_transactions',
    'labor_logs',
    'macro_variables',
    'material_rubros',
    'materials',
    'organization_roles',
    'ot_templates',
    'owners',
    'purchase_documents',
    'purchase_orders',
    'rate_cards',
    'ship_stays',
    'ships',
    'suppliers',
    'system_settings',
    'third_party_services',
    'third_party_voucher_history',
    'work_items',
    'work_orders',
    'worker_permission_requests',
    'workers'
  ];
BEGIN
  FOREACH tbl IN ARRAY realtime_tables LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = tbl
        AND table_type = 'BASE TABLE'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END $$;
