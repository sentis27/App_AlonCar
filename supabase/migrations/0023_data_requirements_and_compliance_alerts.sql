-- ==============================================================================
-- MIGRACIÓN 0023: CATÁLOGO DE REQUISITOS DE DATOS, ALERTAS DE CUMPLIMIENTO Y LOGS
-- ==============================================================================

-- 1. Asegurar campo de teléfono / WhatsApp en workers
ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS notification_enabled BOOLEAN DEFAULT true;

-- 2. Catálogo Maestro de Requisitos de Datos (Plantilla de Reglas de Negocio)
CREATE TABLE IF NOT EXISTS public.data_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,                       -- Ej: REQ_BARCO_ANGUILERA_VARADERO
  module TEXT NOT NULL,                           -- 'barcos', 'terceros', 'ots', 'horas', 'estadias', 'panol'
  field_key TEXT NOT NULL,                        -- Campo o documento exigido: 'plan_anguilera_url', 'owner_id', etc.
  name TEXT NOT NULL,                             -- Nombre legible del requisito
  description TEXT,                               -- Explicación operativa
  trigger_event TEXT NOT NULL,                    -- Evento gatillo: 'ENTRADA_A_VARADERO', 'ALTA_BUQUE', etc.
  trigger_condition JSONB DEFAULT '{}'::jsonb,    -- Parámetros adicionales de evaluación
  responsible_role TEXT NOT NULL,                 -- 'jefe_obra', 'maria_jose', 'admin', 'panol'
  default_worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
  default_phone TEXT,                             -- Teléfono predeterminado para WhatsApp
  default_notice_time TIME DEFAULT '09:00:00',    -- Horario de aviso diario
  default_notice_frequency TEXT DEFAULT 'DIARIO', -- 'DIARIO', 'CADA_48HS', 'LUNES_Y_JUEVES', 'SEMANAL'
  max_attempts INT DEFAULT 5,                     -- Cantidad máxima de avisos antes de escalar
  escalation_role TEXT DEFAULT 'admin',           -- Rol a quien escala si se supera max_attempts
  is_active BOOLEAN DEFAULT true,                 -- Habilitado/Deshabilitado
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_data_req_module ON public.data_requirements(module);
CREATE INDEX IF NOT EXISTS idx_data_req_role ON public.data_requirements(responsible_role);
CREATE INDEX IF NOT EXISTS idx_data_req_active ON public.data_requirements(is_active);

-- 3. Tabla de Alertas de Cumplimiento (Instancias vivas por Buque y Entidad)
CREATE TABLE IF NOT EXISTS public.compliance_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id UUID NOT NULL REFERENCES public.data_requirements(id) ON DELETE CASCADE,
  ship_id UUID REFERENCES public.ships(id) ON DELETE CASCADE, -- Cada alerta vive referenciada a un barco
  entity_type TEXT NOT NULL,                                   -- 'ships', 'ship_stays', 'third_party_services', 'work_orders'
  entity_id UUID NOT NULL,                                     -- ID del registro afectado
  responsible_worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
  responsible_role TEXT NOT NULL,                              -- 'jefe_obra', 'maria_jose', 'admin'
  recipient_phone TEXT,                                        -- Teléfono de destino (WhatsApp)
  notice_time TIME DEFAULT '09:00:00',                         -- Horario programado de aviso
  notice_frequency TEXT DEFAULT 'DIARIO',                      -- Frecuencia
  notices_sent_count INT DEFAULT 0,                            -- Contador de cantidad de avisos enviados hasta resolver
  max_attempts INT DEFAULT 5,                                  -- Límite de avisos
  last_notice_sent_at TIMESTAMPTZ,                             -- Fecha/hora del último aviso enviado
  next_notice_scheduled_at TIMESTAMPTZ,                        -- Fecha/hora programada para el próximo aviso
  status TEXT DEFAULT 'PENDIENTE',                             -- 'PENDIENTE', 'COMPLETADO', 'VENCIDO', 'ESCALADO', 'CANCELADO'
  alert_message TEXT,                                          -- Texto dinámico generado para WhatsApp/In-App
  completed_at TIMESTAMPTZ,                                    -- Momento exacto de carga del dato
  completed_by TEXT,                                           -- Usuario que completó el dato
  escalated_to_admin BOOLEAN DEFAULT false,                    -- Flag de escalamiento a Jorge Sentis
  escalated_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_alerts_ship ON public.compliance_alerts(ship_id);
CREATE INDEX IF NOT EXISTS idx_compliance_alerts_status ON public.compliance_alerts(status);
CREATE INDEX IF NOT EXISTS idx_compliance_alerts_worker ON public.compliance_alerts(responsible_worker_id);
CREATE INDEX IF NOT EXISTS idx_compliance_alerts_next_sched ON public.compliance_alerts(next_notice_scheduled_at) WHERE status = 'PENDIENTE';

-- 4. Registro Histórico de Mensajes WhatsApp Enviados (Auditoría Evolution API)
CREATE TABLE IF NOT EXISTS public.compliance_notice_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES public.compliance_alerts(id) ON DELETE CASCADE,
  ship_id UUID REFERENCES public.ships(id) ON DELETE SET NULL,
  recipient_phone TEXT NOT NULL,
  message_body TEXT NOT NULL,
  attempt_number INT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'ENVIADO',                               -- 'ENVIADO', 'FALLIDO', 'ENTREGADO', 'LEIDO'
  evolution_api_response JSONB,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_notice_logs_alert ON public.compliance_notice_logs(alert_id);

-- 5. Carga de Reglas Iniciales en el Catálogo de Requisitos
INSERT INTO public.data_requirements (
  code,
  module,
  field_key,
  name,
  description,
  trigger_event,
  trigger_condition,
  responsible_role,
  default_notice_time,
  default_notice_frequency,
  max_attempts
)
VALUES
  (
    'REQ_BARCO_ANGUILERA_VARADERO',
    'barcos',
    'plan_anguilera_url',
    'Plano de Diseño de Anguilera en Varadero',
    'Obligatorio subir el archivo CAD (.dwg) o PDF con el plano de diseño de anguilera apenas el barco ingresa a VARADERO.',
    'ENTRADA_A_VARADERO',
    '{"target_location": "VARADERO"}'::jsonb,
    'jefe_obra',
    '09:00:00',
    'DIARIO',
    4
  ),
  (
    'REQ_BARCO_INFORME_PINTURA',
    'barcos',
    'informe_pintado_url',
    'Informe Técnico de Pintado de Casco',
    'Subir informe de pintado y medición de espesores en formato PDF antes de la botadura o cierre de estadía.',
    'FIN_DE_VARADA',
    '{"event": "SALIDA_VARADERO"}'::jsonb,
    'jefe_obra',
    '09:00:00',
    'DIARIO',
    3
  ),
  (
    'REQ_BARCO_CONTACTO_ARMADOR',
    'barcos',
    'owner_id',
    'Datos de Contacto de Empresa Armadora',
    'Cargar armador, teléfono y dos opciones de correo electrónico para el nuevo buque ingresado al sistema.',
    'ALTA_BUQUE',
    '{"requires": ["owner_name", "phone", "email_1"]}'::jsonb,
    'maria_jose',
    '10:00:00',
    'CADA_48HS',
    5
  ),
  (
    'REQ_TERCEROS_FACTURA_RMO',
    'terceros',
    'invoice_number',
    'Factura Fiscal (FCR) para Remito de Taller Externo',
    'Reclamar factura fiscal al proveedor y evolucionar el comprobante RMO/RPF a Factura oficial (FCR).',
    'REMITO_TERCERO_PENDIENTE',
    '{"voucher_types": ["RMO", "RPF"], "days_elapsed_threshold": 10}'::jsonb,
    'maria_jose',
    '11:00:00',
    'LUNES_Y_JUEVES',
    6
  ),
  (
    'REQ_TERCEROS_ASIGNACION_OT',
    'terceros',
    'work_order_id',
    'Asignación de Centro de Costos / OT a Trabajo de Terceros',
    'Vincular el gasto de contratista externo a una Orden de Trabajo activa para que compute en el costo del buque.',
    'GASTO_TERCERO_SIN_OT',
    '{"work_order_id": null}'::jsonb,
    'admin',
    '09:30:00',
    'DIARIO',
    3
  )
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  field_key = EXCLUDED.field_key,
  trigger_event = EXCLUDED.trigger_event,
  trigger_condition = EXCLUDED.trigger_condition,
  responsible_role = EXCLUDED.responsible_role,
  updated_at = now();
