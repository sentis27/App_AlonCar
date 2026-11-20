/**
 * laborHelp.js
 * Registro de reglas de negocio y ayudas contextuales para las 4 opciones de carga de Horas (M3).
 */

export const LABOR_TEXT_STEP_HELP = {
  1: {
    id: 'labor_text_step_1',
    module: 'labor_texto',
    step: 1,
    title: 'PASO 1 · FECHA, MODALIDAD Y PARTE WHATSAPP',
    uiBullets: [
      { label: 'Desglose automático (RN-03)', text: 'Interpreta partes corridos como "Andrés y Diego 9h" generando 9h para cada operario.' },
      { label: 'Jerga naval y subtareas', text: 'Normaliza términos de astillero (trancalín, poliuretano, cubierta) y separa subtareas si pertenecen a OTs distintas.' },
      { label: 'Fecha y Modalidad base', text: 'Todas las filas generadas heredan esta fecha y modalidad (Por Hora / Presupuesto / Control).' }
    ],
    aiRuleContext:
      'Regla de Carga de Horas por Texto/WhatsApp (M3): El tabulador extrae operarios en paralelo, deduce rubro y cruza contra OTs activas del barco. Aplica RN-03 (horas compartidas se asignan completas a cada operario mencionado).'
  },
  2: {
    id: 'labor_text_step_2',
    module: 'labor_texto',
    step: 2,
    title: 'PASO 2 · VISTA PREVIA TABULADA (EDITABLE)',
    uiBullets: [
      { label: 'Pulido antes de guardar', text: 'Podés ajustar Barco, OT (con vista flotante al pasar el mouse), Operario, Rubro y Horas antes de insertar.' },
      { label: 'Sin OT / Consolidar', text: 'Si la OT aún no está abierta podés dejarla en blanco; usá "Consolidar Misma OT" para sumar renglones repetidos.' }
    ],
    aiRuleContext:
      'Regla de Previsualización Editable de Horas: Ninguna fila tabulada persiste sin confirmación explícita; cada renglón respeta el vínculo Operario -> Barco -> OT y registra auditoría en audit_logs.'
  }
}

export const LABOR_CREW_STEP_HELP = {
  1: {
    id: 'labor_crew_step_1',
    module: 'labor_cuadrilla',
    step: 1,
    title: 'PASO 1 · CASCADA DE DESTINO Y FECHA',
    uiBullets: [
      { label: 'Cascada Naval', text: 'Elegí Barco ➔ Contratista/Grupo Habilitado ➔ OT "En ejecución" (el alcance completo aparece en tooltip flotante).' },
      { label: 'Expandir Padrón', text: 'Si el grupo aún no figura asignado al barco, elegí "🔓 Expandir" o dejá la OT en blanco provisoriamente.' },
      { label: 'Centro de Costo Fijo', text: 'Las imputaciones de horas se cargan con Centro de Costo CLIENTE y se cruzan con el Tarifario Quincenal.' }
    ],
    aiRuleContext:
      'Regla de Carga en Cuadrilla (M3): Sigue la cascada Barco -> Grupo/Contratista -> OT en ejecución (WorkOrderSelectorWithHover). Soporta modo Multi-Barco por fila y replicado de la última cuadrilla.'
  },
  2: {
    id: 'labor_crew_step_2',
    module: 'labor_cuadrilla',
    step: 2,
    title: 'PASO 2 · PLANILLA GRUPAL DE OPERARIOS',
    uiBullets: [
      { label: 'Control de Jornada (9h)', text: 'Para personal propio de Astillero se controla la jornada completa de 9 hs normales (8 hs feriado).' },
      { label: 'Préstamo de Rubro', text: 'Si un operario cubre otro oficio ese día, abrí la puerta de emergencia de rubro en su fila.' },
      { label: 'Multi-Barco', text: 'Activá "Multi-Barco por Fila" arriba si cada integrante trabajó en barcos u OTs distintas.' }
    ],
    aiRuleContext:
      'Regla de Grilla de Cuadrilla: Valida suma diaria de horas normales, extras 50% y extras 100% por operario y guarda en lote auditado en labor_logs.'
  }
}

export const LABOR_CLOCK_BOARD_STEP_HELP = {
  1: {
    id: 'labor_clock_step_1',
    module: 'labor_reloj',
    step: 1,
    title: 'PASO 1 · IMPORTACIÓN DE FICHAJE (CSV / CARPETA)',
    uiBullets: [
      { label: 'CSV Entrada y Cierre', text: 'Cargá el ingreso matutino para ver presentes y sus horas estimadas (9h/8h), y al final del día el CSV Cierre para detectar diferencias.' },
      { label: 'Simulador desde Padrón', text: 'Podés usar "Simular Ingreso/Cierre" para operar mientras se homologa el formato final del reloj facial.' }
    ],
    aiRuleContext:
      'Regla de Reloj Facial (M3): Importa fichajes CSV de entrada y cierre, estima horas de jornada y concilia contra horas ya imputadas en labor_logs para la fecha.'
  },
  2: {
    id: 'labor_clock_step_2',
    module: 'labor_reloj',
    step: 2,
    title: 'PASO 2 · DISTRIBUCIÓN A BARCOS Y OTs',
    uiBullets: [
      { label: 'Estadías Activas', text: 'Los buques se agrupan por ubicación actual (Astillero/Muelle/Puerto) para imputar rápido sin buscar.' },
      { label: 'Asignación Directa', text: 'Hacé clic en un grupo u operario presente para abrir la hoja rápida de horas con dictado por voz.' }
    ],
    aiRuleContext:
      'Regla de Distribución desde Reloj Facial: Vincula operarios presentes con buques clasificados por ship_stays y genera imputaciones auditadas con origen FACIAL_CLOCK_BOARD.'
  }
}

export const LABOR_CLOCK_ASSIGN_STEP_HELP = {
  1: {
    id: 'labor_clock_assign_step_1',
    module: 'labor_reloj_asignacion',
    step: 1,
    title: 'PASO 1 · HORAS A IMPUTAR',
    uiBullets: [
      { label: 'Atajos de Jornada', text: 'Tocá 2h, 4h, 4.5h, 8h o 9h (o escribí decimales). En grupos podés activar "Usar hs faltantes c/u".' }
    ],
    aiRuleContext:
      'Regla de Horas Rápidas de Reloj Facial: Permite asignar horas fijas o completar exactamente el saldo pendiente (pendingHours) de cada operario.'
  },
  2: {
    id: 'labor_clock_assign_step_2',
    module: 'labor_reloj_asignacion',
    step: 2,
    title: 'PASO 2 · OT, RUBRO Y MODALIDAD',
    uiBullets: [
      { label: 'OT con Vista Flotante', text: 'Pasá el mouse por cualquier OT para leer sus subtareas; al elegirla hereda su modalidad automáticamente.' },
      { label: 'Sin OT Permitido', text: 'Si dejás la OT en blanco, completá la descripción en el Paso 3 para poder reclasificar luego.' }
    ],
    aiRuleContext:
      'Regla de Imputación Rápida: Usa WorkOrderSelectorWithHover, hereda work_type de la OT y exige descripción cuando work_order_id es nulo.'
  },
  3: {
    id: 'labor_clock_assign_step_3',
    module: 'labor_reloj_asignacion',
    step: 3,
    title: 'PASO 3 · DESCRIPCIÓN Y DICTADO POR VOZ',
    uiBullets: [
      { label: 'Dictado Directo', text: 'Presioná "Dictar por Voz" para transcribir la tarea en español (es-AR) sin tipear en campo.' }
    ],
    aiRuleContext:
      'Regla de Descripción de Reloj Facial: Las notas quedan asociadas a cada registro insertado en labor_logs y son obligatorias si no se seleccionó OT.'
  }
}

export const LABOR_EDIT_STEP_HELP = {
  1: {
    id: 'labor_edit_step_1',
    module: 'labor_edicion',
    step: 1,
    title: 'PASO 1 · BARCO, OT Y OPERARIO',
    uiBullets: [
      { label: 'Imputación de Obra', text: 'Elegí Barco ➔ OT (tooltip flotante con alcance) ➔ Operario y Rubro del trabajo realizado.' },
      { label: 'Centro de Costo', text: 'Todas las horas registradas se imputan a CLIENTE y se auditan en audit_logs.' }
    ],
    aiRuleContext:
      'Regla de Edición / Carga Individual de Horas: Actualiza o inserta en labor_logs respetando barco, OT, operario y rubro con auditoría completa.'
  },
  2: {
    id: 'labor_edit_step_2',
    module: 'labor_edicion',
    step: 2,
    title: 'PASO 2 · HORAS Y MODALIDAD',
    uiBullets: [
      { label: 'Desglose Horario', text: 'Cargá Hs Normales, Extras al 50% y Extras al 100% en pasos de 0.5h (hasta 24h).' },
      { label: 'Modalidad (Col. F)', text: 'HORA (administración), PRESUPUESTO (obra cerrada) o CONTROL (seguimiento interno).' }
    ],
    aiRuleContext:
      'Regla de Horas y Modalidad: Discrimina hours_normal, hours_extra_50 y hours_extra_100 junto a work_type (HORA/PRESUPUESTO/CONTROL).'
  },
  3: {
    id: 'labor_edit_step_3',
    module: 'labor_edicion',
    step: 3,
    title: 'PASO 3 · FECHA, APROBACIÓN Y NOTAS',
    uiBullets: [
      { label: 'Flujo S / R / RR / RRR', text: 'S = Aprobado · R = Observado (exige motivo) · RR = Corregido por operario · RRR = Aprobación final.' },
      { label: 'Trazabilidad', text: 'Cualquier cambio de estado o nota queda guardado en el historial de auditoría del parte.' }
    ],
    aiRuleContext:
      'Regla de Aprobación de Horas: Controla los estados S, R, RR y RRR con campos review_reason y worker_response.'
  }
}
