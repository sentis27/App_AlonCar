-- ============================================================
-- ALON CAR ERP - MIGRACIÓN 0005: TABLA DE ROLES ORGANIZACIONALES
-- Permite desvincular puestos técnicos de nombres de personas
-- y mantener referencias centralizadas y dinámicas en todo el ERP.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.organization_roles (
  role_key TEXT PRIMARY KEY,
  role_title TEXT NOT NULL,
  holder_name TEXT NOT NULL,
  department TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Políticas RLS
ALTER TABLE public.organization_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access organization_roles" ON public.organization_roles;
CREATE POLICY "Public access organization_roles" ON public.organization_roles FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.organization_roles TO anon, authenticated, service_role;

-- Carga inicial de roles organizacionales
INSERT INTO public.organization_roles (role_key, role_title, holder_name, department, notes)
VALUES
  ('LIQUIDACION_SUELDOS', 'Responsable de Liquidación de Sueldos y RRHH', 'María José', 'Administración y RRHH', 'Carga operativa de tarifas salariales y liquidaciones'),
  ('DIRECCION_OPERACIONES', 'Dirección Operativa y Negociaciones', 'Hugo Obregozo', 'Dirección General', 'Fijación y negociación de tarifas de contratistas y obras'),
  ('OFICINA_TECNICA', 'Oficina Técnica & Subcontratos', 'Omar', 'Operaciones y Proyectos', 'Gestión técnica de talleres, remitos RPF/RMO y diseños'),
  ('SUPERVISION_OBRA', 'Supervisión de Obra & Pañol', 'Jorge', 'Operaciones', 'Supervisión operativa, control de consistencia de OTs y pañol'),
  ('TESORERIA', 'Tesorería & Pagos', 'Graciela', 'Administración y Finanzas', 'Aprobación de pagos, descuentos y liquidación neta')
ON CONFLICT (role_key) DO UPDATE SET
  role_title = EXCLUDED.role_title,
  holder_name = EXCLUDED.holder_name,
  department = EXCLUDED.department,
  updated_at = NOW();
