/**
 * drydockCatalogConstants.js
 * Constantes canónicas, Tarifario Base Nivel Alfa (GS-012 / docs/03_negocio/tarifario_puesta_en_seco_alfa.md),
 * definiciones de pestañas de Zona 1, botones rápidos GS-004 y columnas del Remito Comercial Gallo.
 */

export const ALFA_RATES_SETTINGS_KEY = 'drydock_rate_card_alfa'
export const REMITO_SETTINGS_KEY = 'remito_comercial_por_buque'
export const OP_INPUTS_SETTINGS_KEY = 'resumen_gerencial_operational_inputs'
export const COMPARATOR_VIEWS_SETTINGS_KEY = 'comparador_obras_saved_views'
export const ADHOC_METRICS_SETTINGS_KEY = 'resumen_gerencial_adhoc_metrics'

export const RESUMEN_GERENCIAL_TABS = [
  {
    id: 'resumen',
    label: '1. Resumen de Obra & Costos',
    shortLabel: 'Resumen GS-004',
    archetype: 'METRICAS_ANALISIS',
    badge: 'Gallina · Solo Análisis',
    colorTheme: 'cyan'
  },
  {
    id: 'comparador',
    label: '2. Comparador de Obras',
    shortLabel: 'Comparador',
    archetype: 'METRICAS_ANALISIS',
    badge: 'Gallina · Benchmarking',
    colorTheme: 'violet'
  },
  {
    id: 'remito',
    label: '3. Remito Comercial & Tarifario',
    shortLabel: 'Remito Gallo',
    archetype: 'CARGA_EDICION',
    badge: 'Gallo · Editable',
    colorTheme: 'emerald'
  }
]

/**
 * Grilla 3x2 de botones rápidos de navegación (idéntica a cabecera GS-004 RESUMEN)
 */
export const COST_SHEET_QUICK_LINKS = [
  {
    id: 'materiales_general',
    sheet: 'materiales',
    scope: 'GENERAL',
    row: 1,
    label: 'MATERIALES GENERAL',
    hint: 'Hoja MATERIALES'
  },
  {
    id: 'horas_general',
    sheet: 'horas',
    scope: 'GENERAL',
    row: 1,
    label: 'HORAS GENERALES',
    hint: 'Hoja HORAS'
  },
  {
    id: 'terceros_general',
    sheet: 'terceros',
    scope: 'GENERAL',
    row: 1,
    label: 'TERCEROS GENERAL',
    hint: 'Hoja TERCEROS'
  },
  {
    id: 'materiales_ot',
    sheet: 'materiales',
    scope: 'OT',
    row: 2,
    label: 'MATERIALES POR O.T',
    hint: 'Pre-filtrado a OT'
  },
  {
    id: 'horas_ot',
    sheet: 'horas',
    scope: 'OT',
    row: 2,
    label: 'HORAS POR O.T',
    hint: 'Pre-filtrado a OT'
  },
  {
    id: 'terceros_ot',
    sheet: 'terceros',
    scope: 'OT',
    row: 2,
    label: 'TERCEROS POR O.T',
    hint: 'Pre-filtrado a OT'
  }
]

export const BILLING_TEMPLATES = [
  {
    id: 'PUESTA_SECO_30M',
    label: 'Plantilla Puesta en Seco (Hasta 30m)',
    description: 'Tarifario base Nivel Alfa (halaje, varadero, grúas, sondajes, ánodos, válvulas y OTs).'
  },
  {
    id: 'REPARACION_AFLOTE',
    label: 'Plantilla Reparación a Flote / Muelle',
    description: 'Enfocada en estadía en muelle, grúa menor y trabajos navales por OT.'
  },
  {
    id: 'REMITO_VACIO',
    label: 'Remito Manual desde Costos Internos',
    description: 'Pre-carga únicamente los trabajos navales derivados de las OTs del Resumen.'
  }
]

/**
 * Tarifario Maestro Inicial Nivel Alfa (GS-012)
 * Respaldado en Supabase (`system_settings.drydock_rate_card_alfa`) para edición por Gerencia.
 */
export const DEFAULT_DRYDOCK_RATE_CARD_ALFA = [
  {
    code: 'VAR-001',
    rubro: 'VARADERO Y MANIOBRA',
    concept: 'Maniobra de halaje y botadura con anguilera',
    surchargeNote: 'Día/horario normal. Recargos: Nocturna +25%, Inhábil +35%, Sin máquina +12%',
    unit: 'Maniobra',
    unit_price_usd: 7300,
    tax_type: 'EXENTO',
    source_module: 'Barcos · Estadías (ship_stays)',
    open_field_label: 'Maniobras ejecutadas (1 / 0)',
    template_scopes: ['PUESTA_SECO_30M']
  },
  {
    code: 'VAR-002',
    rubro: 'VARADERO Y MANIOBRA',
    concept: 'Servicio de lancha para maniobra de halaje',
    surchargeNote: '',
    unit: 'Maniobra',
    unit_price_usd: 165,
    tax_type: 'GRAVADO_21',
    source_module: 'Barcos · Estadías (ship_stays)',
    open_field_label: 'Cantidad de maniobras',
    template_scopes: ['PUESTA_SECO_30M']
  },
  {
    code: 'VAR-003',
    rubro: 'VARADERO Y MANIOBRA',
    concept: 'Estadía en varadero (Por día)',
    surchargeNote: '',
    unit: 'Día',
    unit_price_usd: 290,
    tax_type: 'GRAVADO_21',
    source_module: 'Barcos · Estadías (ship_stays)',
    open_field_label: 'Cantidad de días',
    template_scopes: ['PUESTA_SECO_30M']
  },
  {
    code: 'VAR-004',
    rubro: 'VARADERO Y MANIOBRA',
    concept: 'Estadía en muelle (Por día)',
    surchargeNote: 'Incluye energía, agua potable y vigilancia en ingreso ($35 base / $70 con servicios)',
    unit: 'Día',
    unit_price_usd: 70,
    tax_type: 'GRAVADO_21',
    source_module: 'Barcos · Estadías (ship_stays)',
    open_field_label: 'Cantidad de días',
    template_scopes: ['PUESTA_SECO_30M', 'REPARACION_AFLOTE']
  },
  {
    code: 'VAR-005',
    rubro: 'VARADERO Y MANIOBRA',
    concept: 'Servicio de amarre en muelle con amarradores',
    surchargeNote: 'Por maniobra',
    unit: 'Maniobra',
    unit_price_usd: 150,
    tax_type: 'GRAVADO_21',
    source_module: 'Barcos · Estadías (ship_stays)',
    open_field_label: 'Cantidad de maniobras',
    template_scopes: ['PUESTA_SECO_30M', 'REPARACION_AFLOTE']
  },
  {
    code: 'GRU-001',
    rubro: 'GRÚAS Y EQUIPOS',
    concept: 'Servicio de grúa terrestre hasta 8 ton (Por hora)',
    surchargeNote: 'Grúa chica / hidrogrúa',
    unit: 'Hora',
    unit_price_usd: 130,
    tax_type: 'GRAVADO_21',
    source_module: 'Resumen GS-004 · Grúa Chica',
    open_field_label: 'Horas de uso',
    template_scopes: ['PUESTA_SECO_30M', 'REPARACION_AFLOTE']
  },
  {
    code: 'GRU-002',
    rubro: 'GRÚAS Y EQUIPOS',
    concept: 'Servicio de grúa terrestre hasta 60 ton (Por hora, mínimo 2 hs)',
    surchargeNote: 'Grúa grande',
    unit: 'Hora',
    unit_price_usd: 240,
    tax_type: 'GRAVADO_21',
    source_module: 'Resumen GS-004 · Grúa Grande',
    open_field_label: 'Horas de uso',
    template_scopes: ['PUESTA_SECO_30M']
  },
  {
    code: 'RES-001',
    rubro: 'RESIDUOS Y SERVICIOS',
    concept: 'Retiro de residuos no contaminantes (Contenedor de 6 m³)',
    surchargeNote: '',
    unit: 'Contenedor',
    unit_price_usd: 105,
    tax_type: 'GRAVADO_21',
    source_module: 'Terceros / Input Operativo',
    open_field_label: 'Cantidad de contenedores',
    template_scopes: ['PUESTA_SECO_30M', 'REPARACION_AFLOTE']
  },
  {
    code: 'SON-001',
    rubro: 'SONDAJES ULTRASÓNICOS',
    concept: 'Sondaje ultrasónico en casco con entrega de planilla',
    surchargeNote: 'Hasta 50 puntos en 3 anillos. Zonas de renovación sin cargo',
    unit: 'Servicio',
    unit_price_usd: 350,
    tax_type: 'EXENTO',
    source_module: 'Órdenes de Trabajo (work_items)',
    open_field_label: 'Ejecutado (1 / 0)',
    template_scopes: ['PUESTA_SECO_30M']
  },
  {
    code: 'SON-002',
    rubro: 'SONDAJES ULTRASÓNICOS',
    concept: 'Sondajes adicionales (Por unidad)',
    surchargeNote: '',
    unit: 'Punto',
    unit_price_usd: 5,
    tax_type: 'GRAVADO_21',
    source_module: 'Órdenes de Trabajo (work_items)',
    open_field_label: 'Puntos adicionales',
    template_scopes: ['PUESTA_SECO_30M']
  },
  {
    code: 'GAL-001',
    rubro: 'PROTECCIÓN GALVÁNICA',
    concept: 'Recambio de ánodos de zinc soldados hasta 5 kg (Por c/u)',
    surchargeNote: 'Provisión del armador',
    unit: 'Unidad',
    unit_price_usd: 39,
    tax_type: 'EXENTO',
    source_module: 'Pañol · Movimientos Ánodos',
    open_field_label: 'Cantidad instalada',
    template_scopes: ['PUESTA_SECO_30M']
  },
  {
    code: 'TMAR-001',
    rubro: 'PROTECCIÓN GALVÁNICA Y CASCO',
    concept: 'Tomas de mar (Desmontar rejillas, rasqueteado, lavado, pintado, montar y seguro)',
    surchargeNote: '',
    unit: 'Unidad',
    unit_price_usd: 380,
    tax_type: 'GRAVADO_21',
    source_module: 'Órdenes de Trabajo (work_items)',
    open_field_label: 'Cantidad de tomas de mar',
    template_scopes: ['PUESTA_SECO_30M']
  },
  {
    code: 'VAL-001',
    rubro: 'MECÁNICA NAVAL Y VÁLVULAS',
    concept: 'Recorrido de Válvulas de Casco e Intermediarias',
    surchargeNote: 'Valor base referencial A Cotizar (ajustable según diámetro y cantidad)',
    unit: 'Unidad',
    unit_price_usd: 145,
    tax_type: 'GRAVADO_21',
    source_module: 'Órdenes de Trabajo (work_orders)',
    open_field_label: 'Cantidad de válvulas',
    template_scopes: ['PUESTA_SECO_30M', 'REPARACION_AFLOTE']
  },
  {
    code: 'OBR-OT',
    rubro: 'TRABAJOS NAVALES POR O.T.',
    concept: 'Ejecución Integral de OTs (Calderería, Mano de Obra, Materiales y Terceros)',
    surchargeNote: 'Consolidado comercial sobre Costo Directo Interno de Pestaña 1',
    unit: 'Global',
    unit_price_usd: 0,
    tax_type: 'GRAVADO_21',
    source_module: 'Resumen GS-004 · Costo Directo Total',
    open_field_label: 'Factor / Precio Comercial',
    template_scopes: ['PUESTA_SECO_30M', 'REPARACION_AFLOTE', 'REMITO_VACIO']
  }
]

/**
 * Columnas canónicas para useSpreadsheetGrid en Submódulo 3 (Remito Comercial Gallo)
 */
export const REMITO_SPREADSHEET_COLUMNS = [
  { key: 'line_code', label: 'Código', readOnly: false },
  { key: 'concept', label: 'Concepto / Ítem del Remito', readOnly: false },
  { key: 'source_module', label: 'Origen Autoalimentado', readOnly: true },
  { key: 'unit', label: 'Unid.', readOnly: false },
  { key: 'quantity', label: 'Cantidad', isNumeric: true, readOnly: false },
  { key: 'unit_price_usd', label: 'P.Unit US$', isNumeric: true, readOnly: false },
  { key: 'tax_type', label: 'IVA 21%', readOnly: false },
  {
    key: 'net_usd',
    label: 'Neto US$',
    isNumeric: true,
    readOnly: true,
    getValue: (r) => Number(((Number(r?.quantity) || 0) * (Number(r?.unit_price_usd) || 0)).toFixed(2))
  },
  {
    key: 'total_usd',
    label: 'Total c/IVA US$',
    isNumeric: true,
    readOnly: true,
    getValue: (r) => {
      const net = (Number(r?.quantity) || 0) * (Number(r?.unit_price_usd) || 0)
      const iva = r?.tax_type === 'GRAVADO_21' ? net * 0.21 : 0
      return Number((net + iva).toFixed(2))
    }
  },
  { key: 'observations', label: 'Notas / Criterio', readOnly: false }
]

export const DONUT_PALETTE = [
  '#22d3ee', // cyan
  '#a78bfa', // violet
  '#34d399', // emerald
  '#f59e0b', // amber
  '#f43f5e', // rose
  '#38bdf8', // sky
  '#e879f9', // fuchsia
  '#fb923c'  // orange
]

export function formatUsd(value, decimals = 2) {
  const num = Number(value) || 0
  return `US$ ${num.toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}`
}

export function formatArs(value, decimals = 0) {
  const num = Number(value) || 0
  return `$${num.toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}`
}

export function formatKg(value, decimals = 1) {
  const num = Number(value) || 0
  return `${num.toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })} kg`
}

export function getQuincenaPeriodFromDate(dateStr) {
  if (!dateStr) return null
  const clean = String(dateStr).slice(0, 10)
  const m = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const year = m[1]
  const month = m[2]
  const day = Number(m[3])
  const q = day <= 15 ? '1Q' : '2Q'
  return `${year}-${month}-${q}`
}
