/**
 * workOrdersHelp.js
 * Registro de reglas de negocio y ayudas contextuales para Órdenes de Trabajo y Catálogo OT.ABC (M3).
 */

export const WORK_ORDER_STEP_HELP = {
  1: {
    id: 'work_order_step_1',
    module: 'work_orders',
    step: 1,
    title: 'PASO 1 · BARCO Y CONTENEDOR DE OT',
    uiBullets: [
      { label: 'Crear Nueva OT vs. Usar Existente', text: 'Podés abrir una OT correlativa automática o sumar una nueva subtarea dentro de una OT ya abierta del buque.' },
      { label: 'Tabulada (OT.ABC) vs. Libre', text: 'Tabulada permite elegir una o varias plantillas estándar del astillero; Libre permite redactar un título a medida.' },
      { label: 'Control anti-duplicados', text: 'Si el barco ya tiene una OT con el mismo nombre, el sistema frena el duplicado y ofrece vincularla.' }
    ],
    aiRuleContext:
      'Regla de Contenedor de OT (M3): Toda subtarea nace bajo una OT del buque (nueva correlativa o existente). Soporta selección múltiple de plantillas OT.ABC con generación automática de sub-trabajos y detección anti-duplicados.'
  },
  2: {
    id: 'work_order_step_2',
    module: 'work_orders',
    step: 2,
    title: 'PASO 2 · DETALLE TÉCNICO Y ESTADO',
    uiBullets: [
      { label: 'Descripción Operativa', text: 'Describí claramente el trabajo; este texto alimenta los tooltips flotantes de Pañol, Horas, Compras y Resumen Gerencial.' },
      { label: 'Estado del Trabajo', text: 'Solo las tareas en "En ejecución" habilitan imputación normal en Pañol y Horas; los 4 estados cerrados muestran ❌ y tachado.' }
    ],
    aiRuleContext:
      'Regla de Detalle Técnico de OT: La descripción de work_items es consumida por CanonicalOtBadge en todos los módulos del ERP y el estado controla la habilitación de imputación.'
  },
  3: {
    id: 'work_order_step_3',
    module: 'work_orders',
    step: 3,
    title: 'PASO 3 · RESPONSABLES, FACTURACIÓN Y TERCEROS',
    uiBullets: [
      { label: 'Presupuesto General vs. Adicional/Específico', text: 'General agrupa el trabajo dentro del contrato base del buque; Adicional/Específico requiere Nº de presupuesto (o Pendiente con alerta a María José).' },
      { label: 'Contratistas Habilitados', text: 'Los grupos asignados aquí quedan automáticamente habilitados en Pañol y Horas para este barco y OT.' },
      { label: 'PRC $0 en Terceros', text: 'Si elegís un único contratista con permiso "3ros", podés generar automáticamente su comprobante PRC $0 en Terceros.' }
    ],
    aiRuleContext:
      'Regla de Responsables y Facturación de OT: Asigna Jefe de Obra (foreman_name), centro de facturación (Presupuesto General o Adicional con specific_budget_id) y contratistas (sincronizados vía trigger trg_work_items_sync_contractors). Habilita PRC $0 en third_party_services si el contratista único tiene can_charge_third_party.'
  }
}

export const OT_CATALOG_STEP_HELP = {
  1: {
    id: 'ot_catalog_step_1',
    module: 'ot_catalog',
    step: 1,
    title: 'PASO 1 · IDENTIDAD Y PARÁMETROS FISCALES',
    uiBullets: [
      { label: 'Clasificación Naval', text: 'Agrupá la plantilla en Renovación, Intermedia o Ambas para filtrar rápido al abrir obras.' },
      { label: 'IVA y Origen Base', text: 'Quedan reservados para cotización comercial y Remito Nivel Alfa; no se exponen en la carga operativa de /ots.' }
    ],
    aiRuleContext:
      'Regla de Catálogo OT.ABC: Define plantillas estándar en ot_templates con nombre en MAYÚSCULAS, categoría (Renovación/Intermedia/Ambas), IVA por defecto y origen de datos.'
  },
  2: {
    id: 'ot_catalog_step_2',
    module: 'ot_catalog',
    step: 2,
    title: 'PASO 2 · DESCRIPCIÓN OPERATIVA VS FACTURACIÓN',
    uiBullets: [
      { label: 'Operativa (Taller / /ots)', text: 'Texto corto y directo que recibe el equipo al abrir la OT para ejecutar y cargar costos sin confusión.' },
      { label: 'Facturación (description_billing)', text: 'Prosa comercial completa que Facturación importa automáticamente para toda OT del catálogo ABC (ignorando la descripción operativa).' },
      { label: 'Generar desde renglones', text: 'Reconstruye automáticamente description_billing a partir de la tabla del Paso 3 y las notas fijas.' }
    ],
    aiRuleContext:
      'Regla Dual OT.ABC: ot_templates.description es la consigna operativa corta para /ots; ot_templates.description_billing es la prosa comercial oficial importada automáticamente por Facturación (ignorando la descripción operativa de la OT).'
  },
  3: {
    id: 'ot_catalog_step_3',
    module: 'ot_catalog',
    step: 3,
    title: 'PASO 3 · RENGLONES TABULADOS DEL TARIFARIO',
    uiBullets: [
      { label: 'Ítems y Sub-trabajos', text: 'Cargá los renglones tarifados, unidades y condición de IVA que alimentan presupuestos y el Remito Comercial Alfa.' }
    ],
    aiRuleContext:
      'Regla de Renglones OT.ABC: Cada line_item define estructura de presupuesto y sub-trabajos reutilizables en /ots y /resumen-gerencial.'
  }
}
