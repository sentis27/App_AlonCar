-- ============================================================
-- ALON CAR ERP - MIGRACIÓN 0008: MATRIZ DE PERMISOS Y BLOQUEO QUINCENAL
-- Agrega columnas de permisos por sección y nivel de seguridad en organization_roles,
-- y soporte para congelar / bloquear quincenas en rate_cards.
-- ============================================================

ALTER TABLE public.organization_roles ADD COLUMN IF NOT EXISTS allowed_sections TEXT[] DEFAULT ARRAY['barcos', 'horas', 'personal'];
ALTER TABLE public.organization_roles ADD COLUMN IF NOT EXISTS security_level TEXT DEFAULT 'OPERATIVO';
ALTER TABLE public.organization_roles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVO';
ALTER TABLE public.rate_cards ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;

-- Rol de Administrador General
INSERT INTO public.organization_roles (role_key, role_title, holder_name, department, security_level, allowed_sections, status, notes)
VALUES 
  ('ADMIN_GENERAL', 'Dirección General & Administración Central', 'Administrador', 'Directorio', 'ADMINISTRADOR', ARRAY['barcos', 'ots', 'horas', 'panol', 'personal', 'tarifario', 'analisis', 'admin'], 'ACTIVO', 'Acceso irrestricto y control maestro de parámetros')
ON CONFLICT (role_key) DO UPDATE SET
  security_level = 'ADMINISTRADOR',
  allowed_sections = ARRAY['barcos', 'ots', 'horas', 'panol', 'personal', 'tarifario', 'analisis', 'admin'],
  updated_at = NOW();
