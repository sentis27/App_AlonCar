/**
 * pickersHelp.js
 * Registro de reglas de negocio y ayudas contextuales para los selectores rápidos
 * por doble clic en planillas (Buque / OT y Operario / Contratista) compartidos por
 * Pañol, Horas, Terceros y Compras.
 */

export const PICKER_SHIP_WO_STEP_HELP = {
  1: {
    id: 'picker_ship_wo_step_1',
    module: 'picker_ship_wo',
    step: 1,
    title: 'PASO 1 · BUQUE O DESTINO DE IMPUTACIÓN',
    uiBullets: [
      { label: 'Cambio de buque limpio', text: 'Al elegir otro buque se despliegan inmediatamente sus OTs activas en el Paso 2 y se limpia la OT anterior.' },
      { label: 'Stock de Pañol / Astillero', text: 'En Compras y Pañol podés imputar a ASTILLERO — STOCK GENERAL cuando el insumo no corresponde a una obra puntual.' }
    ],
    aiRuleContext:
      'Regla del Selector Rápido de Buque/OT (doble clic en planillas de Horas, Terceros, Compras y Pañol): Cambiar ship_id reinicia work_order_id y actualiza la lista de OTs activas del nuevo buque. En Compras/Pañol habilita el destino ASTILLERO_STOCK.'
  },
  2: {
    id: 'picker_ship_wo_step_2',
    module: 'picker_ship_wo',
    step: 2,
    title: 'PASO 2 · ORDEN DE TRABAJO (OT) Y SIN OT',
    uiBullets: [
      { label: 'Prioridad por contratista (★)', text: 'Las OTs donde ya participa el operario o contratista de la fila aparecen primero con estrella dorada.' },
      { label: 'Alcance flotante', text: 'Pasá el mouse sobre cualquier OT para ver todas sus subtareas, responsables y estado (❌ tachado si está cerrada).' },
      { label: 'Regla (⚠️ Sin OT)', text: 'Tildá "Dejar OT en blanco" si la obra aún no fue abierta; el registro suma +1 al KPI "Falta Cargar OT".' }
    ],
    aiRuleContext:
      'Regla de Selección de OT en Doble Clic: Muestra siempre las OTs activas del buque (ocultando finalizadas salvo toggle explícito), prioriza OTs vinculadas al contratista en work_items, usa tooltip canónico formatWorkOrderTooltipCanonical y permite work_order_id = null explícito.'
  }
}

export const PICKER_CONTRACTOR_STEP_HELP = {
  1: {
    id: 'picker_contractor_step_1',
    module: 'picker_contractor',
    step: 1,
    title: 'PASO 1 · BUSCAR Y FILTRAR PADRÓN',
    uiBullets: [
      { label: 'Búsqueda instantánea', text: 'Escribí nombre, gremio o taller y presioná Enter para asignar al primero de la lista sin usar el mouse.' },
      { label: 'Filtro rápido', text: 'Alterná entre Todos, Personal Propio de Astillero (⭐) o Contratistas Externos (🏗️).' }
    ],
    aiRuleContext:
      'Regla del Buscador de Operario/Contratista: Filtra en vivo astilleroWorkers (nombre/gremio), contractorGroups y extraOptions, con confirmación directa vía Enter y cierre vía Escape.'
  },
  2: {
    id: 'picker_contractor_step_2',
    module: 'picker_contractor',
    step: 2,
    title: 'PASO 2 · PADRÓN HABILITADO POR OBRA',
    uiBullets: [
      { label: 'Habilitación por OT', text: 'Si la fila tiene OT asignada muestra primero a los habilitados en esa obra; si no hay OT o está vacía abre el padrón completo para nunca bloquear la carga.' },
      { label: 'Solicitudes rápidas', text: 'Cuando falte permiso o apertura de OT podés solicitarla directo a Administración desde el pie del menú.' }
    ],
    aiRuleContext:
      'Regla de Seguridad FL-006 (ContractorPickerModal): Si isOtBlank es verdadero o no hay contratistas vinculados a la OT, aplica fallback automático al padrón completo (astilleroWorkers + contractorGroups) para no frenar la operación.'
  }
}
