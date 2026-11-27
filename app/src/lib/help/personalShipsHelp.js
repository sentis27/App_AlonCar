/**
 * personalShipsHelp.js
 * Registro de reglas de negocio y ayudas contextuales para Personal (M2) y Flota Naval / Barcos (M1).
 */

export const PERSONAL_WORKER_STEP_HELP = {
  1: {
    id: 'personal_worker_step_1',
    module: 'personal_nomina',
    step: 1,
    title: 'PASO 1 · CENTRO ADMINISTRATIVO, GRUPO Y CONTRATO / EPP',
    uiBullets: [
      { label: 'Grupo de Trabajo', text: 'Unifica operarios bajo una misma cuadrilla para imputar en Horas y Pañol (Astillero usa grupo fijo ASTILLERO).' },
      { label: 'Contrato Laboral (Astillero)', text: 'Los contratos a plazo emiten alerta preventiva a María José 7 días antes del vencimiento.' },
      { label: 'EPP Contratistas (DEC-009)', text: 'Por defecto CONTRATISTA (se descuenta en Tesorería). Elegí ASTILLERO solo si el astillero absorbe el EPP (zona gris).' }
    ],
    aiRuleContext:
      'Regla de Centro Administrativo en Personal (M2): Define admin_center (ASTILLERO/CONTRATISTA/TALLER), work_group, contract_type/contract_start_date para Astillero y safety_items (CONTRATISTA vs ASTILLERO) para liquidación en Tesorería.'
  },
  2: {
    id: 'personal_worker_step_2',
    module: 'personal_nomina',
    step: 2,
    title: 'PASO 2 · IDENTIFICACIÓN DEL OPERARIO',
    uiBullets: [
      { label: 'Nombre Oficial (MAYÚSCULAS)', text: 'Se guarda en la columna name de workers (nunca first_name/last_name) y sirve de clave en Horas y Pañol.' },
      { label: 'Estado Operativo', text: 'Pasar a INACTIVO oculta al operario de nuevas cargas sin perder su historial contable.' }
    ],
    aiRuleContext:
      'Regla de Identidad en workers: Nombre en MAYÚSCULAS en workers.name, teléfono WhatsApp y status ACTIVO/INACTIVO.'
  },
  3: {
    id: 'personal_worker_step_3',
    module: 'personal_nomina',
    step: 3,
    title: 'PASO 3 · ESPECIALIDAD, CATEGORÍA, TARIFA Y CONSUMIBLES',
    uiBullets: [
      { label: 'Rubro y Categoría', text: 'Define el oficio por defecto al cargar partes de horas y la categoría base en el Tarifario Quincenal.' },
      { label: 'Conversión US$', text: 'Se calcula en vivo contra el dólar de referencia vigente para análisis salarial.' },
      { label: 'Consumibles de Pañol (DEC-009)', text: 'Astillero propio imputa siempre 100% a la Obra (0% descuento). En Contratista/Taller definís el % de descuento al contratista y el resto imputa a Obra.' }
    ],
    aiRuleContext:
      'Regla Salarial y Consumibles en Personal: trade, category, hourly_rate_ars y hourly_rate_usd alimentan el Tarifario Quincenal. Consumibles: ASTILLERO siempre 100% Obra (consumables_discount_pct=0, CLIENTE); CONTRATISTA/TALLER configurable 0..100% sincronizado entre consumables_discount_pct y consumables (DEC-009).'
  },
  4: {
    id: 'personal_worker_step_4',
    module: 'personal_nomina',
    step: 4,
    title: 'PASO 4 · PERMISOS OPERATIVOS (P / H / 3ros / JO)',
    uiBullets: [
      { label: 'P (Pañol) · H (Horas)', text: 'Habilitan al operario/contratista a retirar materiales en Pañol e imputar horas en obra.' },
      { label: '3ros (Terceros) · JO (Jefe de Obra)', text: '3ros habilita facturación en Terceros y PRC $0 en OTs; JO lo suma al selector de Jefes de Obra.' }
    ],
    aiRuleContext:
      'Regla de Permisos Operativos en workers: can_withdraw_materials (P), can_impute_hours (H), can_charge_third_party (3ros) e is_foreman (JO) gobiernan los filtros de Pañol, Horas, OTs y Terceros.'
  }
}

export const SHIPS_FORM_STEP_HELP = {
  1: {
    id: 'ships_form_step_1',
    module: 'ships_buques',
    step: 1,
    title: 'PASO 1 · IDENTIFICACIÓN NAVAL Y ARMADOR',
    uiBullets: [
      { label: 'Nombre y Armador', text: 'Vinculá el buque a su empresa propietaria (owners) para facturación y evitar alertas de buque huérfano.' },
      { label: 'Locación Actual', text: 'VARADERO / MUELLE / PUERTO organiza el Radar de Flota y la pantalla del Reloj Facial.' }
    ],
    aiRuleContext:
      'Regla de Alta de Buques (M1): Registra name, owner_id, vessel_type, matricula y current_location en ships con auditoría.'
  },
  2: {
    id: 'ships_form_step_2',
    module: 'ships_buques',
    step: 2,
    title: 'PASO 2 · MEDIDAS NAVALES PRINCIPALES',
    uiBullets: [
      { label: 'Eslora, Manga, Puntal y Casco (m²)', text: 'La superficie de casco (m²) alimenta el Comparador de Obras y ratios de costo por m² en Resumen Gerencial.' }
    ],
    aiRuleContext:
      'Regla de Geometría Naval: eslora_mts, manga_mts, puntal_mts y superficie_casco_m2 permiten benchmarking por m² en ResumenGerencial.'
  },
  3: {
    id: 'ships_form_step_3',
    module: 'ships_buques',
    step: 3,
    title: 'PASO 3 · INVENTARIO TÉCNICO A BORDO',
    uiBullets: [
      { label: 'Relevamiento Técnico', text: 'Cargá cantidades y notas de válvulas, tanques, pocetes y equipos; queda disponible en la Ficha 360° del buque.' }
    ],
    aiRuleContext:
      'Regla de Relevamiento Técnico: Persiste technical_specs (jsonb) en ships por componente estándar de astillero.'
  }
}

export const SHIPS_STAY_STEP_HELP = {
  1: {
    id: 'ships_stay_step_1',
    module: 'ships_estadias',
    step: 1,
    title: 'PASO 1 · BUQUE, LOCACIÓN Y FECHAS',
    uiBullets: [
      { label: 'Estadía Abierta', text: 'Dejá Fecha Fin vacía si el buque sigue actualmente en esa ubicación (computa días hasta HOY).' }
    ],
    aiRuleContext:
      'Regla de Estadías (ship_stays): Registra cambios de amarre/varadero/muelle, actualiza ubicación y calcula días de puesta en seco.'
  },
  2: {
    id: 'ships_stay_step_2',
    module: 'ships_estadias',
    step: 2,
    title: 'PASO 2 · OBSERVACIONES DEL MOVIMIENTO',
    uiBullets: [
      { label: 'Detalle de Maniobra', text: 'Anotá horario de subida a grada, cambio de muelle o aclaraciones para el Remito Comercial Alfa.' }
    ],
    aiRuleContext:
      'Regla de Notas en Estadías: Las notas acompañan el movimiento en ship_stays y la línea histórica de la Ficha 360°.'
  }
}

export const SHIPS_OWNER_STEP_HELP = {
  1: {
    id: 'ships_owner_step_1',
    module: 'ships_armadores',
    step: 1,
    title: 'PASO 1 · EMPRESA ARMADORA Y CUIT',
    uiBullets: [
      { label: 'Razón Social', text: 'Se vincula a uno o múltiples buques de la flota y aparece en Remitos y Resumen Gerencial.' }
    ],
    aiRuleContext:
      'Regla de Armadores (owners): Registra razón social, nombre del contacto armador y CUIT fiscal.'
  },
  2: {
    id: 'ships_owner_step_2',
    module: 'ships_armadores',
    step: 2,
    title: 'PASO 2 · CONTACTO OPERATIVO Y FACTURACIÓN',
    uiBullets: [
      { label: 'Dos Canales de Email', text: 'Email Principal para partes técnicos/operaciones y Email Secundario para administración/facturación.' }
    ],
    aiRuleContext:
      'Regla de Contactos de Armador: Almacena armador_phone, email_principal y email_secundario en owners.'
  }
}
