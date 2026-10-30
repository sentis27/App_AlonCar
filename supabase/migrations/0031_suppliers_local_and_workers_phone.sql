-- 0031_suppliers_local_and_workers_phone.sql
-- Habilitación de proveedores locales para mandados y teléfono en padrón de trabajadores

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS is_local_supplier BOOLEAN DEFAULT true;

ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS phone TEXT;
