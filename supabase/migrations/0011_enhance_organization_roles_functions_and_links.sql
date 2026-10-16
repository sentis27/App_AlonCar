-- ============================================================
-- ALON CAR ERP - MIGRACIÓN 0011: PERFILES DE PUESTOS Y VINCULACIONES INTER-DEPARTAMENTALES
-- Agrega columnas a organization_roles para documentar la misión, responsabilidades
-- operativas y el mapa de flujos/vinculaciones entre departamentos del astillero.
-- ============================================================

ALTER TABLE public.organization_roles 
ADD COLUMN IF NOT EXISTS job_mission TEXT;

ALTER TABLE public.organization_roles 
ADD COLUMN IF NOT EXISTS key_responsibilities TEXT[];

ALTER TABLE public.organization_roles 
ADD COLUMN IF NOT EXISTS departmental_links JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.organization_roles 
ADD COLUMN IF NOT EXISTS reports_to TEXT;
