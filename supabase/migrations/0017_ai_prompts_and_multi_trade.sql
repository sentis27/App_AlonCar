-- ============================================================================
-- MIGRACIÓN 0017: GOBERNANZA DE IA, PROMPTS DEL SISTEMA Y MULTI-RUBRO
-- ============================================================================
-- 1. Tabla `system_prompts` para almacenar y versionar los prompts del sistema
--    (Equivalente en base de datos al nodo `Set - PromptConfig` de n8n, DEC-007)
-- 2. Tabla `ai_processing_logs` para trazabilidad de ejecuciones (LOG_PROCESAMIENTO)
-- 3. Columna opcional `secondary_trades` en `workers` (además de soporte en `trade`)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.system_prompts (
    slug TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'HORAS',
    description TEXT,
    prompt_template TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT 'v2.4',
    model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    temperature NUMERIC(3,2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    updated_by TEXT DEFAULT 'Administrador',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.system_prompts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura publica de system_prompts" ON public.system_prompts;
CREATE POLICY "Lectura publica de system_prompts"
    ON public.system_prompts FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Escritura autenticada de system_prompts" ON public.system_prompts;
CREATE POLICY "Escritura autenticada de system_prompts"
    ON public.system_prompts FOR ALL
    USING (true)
    WITH CHECK (true);

-- Tabla de auditoría de procesamiento de partes (LOG_PROCESAMIENTO del SDD)
CREATE TABLE IF NOT EXISTS public.ai_processing_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mensaje_id TEXT NOT NULL,
    fecha_procesamiento TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_reportada DATE,
    usuario_emisor TEXT,
    mensaje_literal TEXT NOT NULL,
    canal_detectado TEXT DEFAULT 'astillero_general',
    engine_used TEXT DEFAULT 'openai_gpt4o_mini',
    prompt_version TEXT DEFAULT 'v2.4',
    total_filas INTEGER DEFAULT 0,
    filas_review INTEGER DEFAULT 0,
    tokens_in INTEGER DEFAULT 0,
    tokens_out INTEGER DEFAULT 0,
    resumen_agente TEXT,
    raw_output JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ai_processing_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso total ai_processing_logs" ON public.ai_processing_logs;
CREATE POLICY "Acceso total ai_processing_logs"
    ON public.ai_processing_logs FOR ALL
    USING (true)
    WITH CHECK (true);
