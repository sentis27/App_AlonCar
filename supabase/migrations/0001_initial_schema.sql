-- ==========================================
-- ALON CAR ERP - SCRIPT MAESTRO INICIAL
-- FASE 1 y 2: Tablas Core (M1, M2, M3, M4)
-- ==========================================

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLA ROLES Y PERFILES (Autorización)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL CHECK (role IN ('Gerencia', 'Supervisor', 'Operario', 'Panolero', 'Admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. TABLA BARCOS (Activos)
CREATE TABLE public.ships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    client_name TEXT,
    status TEXT DEFAULT 'Activo' CHECK (status IN ('Activo', 'En Mantenimiento', 'Terminado')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.ships ENABLE ROW LEVEL SECURITY;

-- 4. ORDENES DE TRABAJO (OTs)
CREATE TABLE public.work_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ship_id UUID REFERENCES public.ships(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'Pendiente' CHECK (status IN ('Pendiente', 'En Progreso', 'Pausada', 'Completada')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

-- 5. REGISTRO DE HORAS (Labor Logs)
CREATE TABLE public.labor_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE CASCADE NOT NULL,
    worker_id UUID REFERENCES public.profiles(id),
    hours_worked NUMERIC(5,2) NOT NULL,
    date_logged DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.labor_logs ENABLE ROW LEVEL SECURITY;

-- 6. MATERIALES (Inventario)
CREATE TABLE public.materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT,
    current_stock INTEGER DEFAULT 0,
    minimum_stock INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

-- 7. MOVIMIENTOS DE INVENTARIO (Retiros de Pañol)
CREATE TABLE public.inventory_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID REFERENCES public.materials(id) ON DELETE CASCADE NOT NULL,
    work_order_id UUID REFERENCES public.work_orders(id),
    user_id UUID REFERENCES public.profiles(id),
    quantity_withdrawn INTEGER NOT NULL,
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

-- 8. COMPRAS (Gestor Documental 1-Clic)
CREATE TABLE public.purchase_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    work_order_id UUID REFERENCES public.work_orders(id),
    material_id UUID REFERENCES public.materials(id),
    uploaded_by UUID REFERENCES public.profiles(id),
    original_filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    category TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.purchase_documents ENABLE ROW LEVEL SECURITY;

-- 9. BUCKET DE STORAGE (Para Cotizaciones PDF)
INSERT INTO storage.buckets (id, name, public) VALUES ('compras', 'compras', false) ON CONFLICT DO NOTHING;

-- NOTA: Las reglas específicas de RLS (quién puede leer/escribir qué tabla) se configurarán en la siguiente migración para mantener este script limpio.
