/**
 * businessHelpRegistry.js
 * Registro Centralizado de Reglas de Negocio y Ayudas Contextuales (UI + IA de Fondo).
 * Fuente Única de Verdad para:
 * 1) Tarjetas emergentes de StepHelpBadge en todos los menús de carga del ERP.
 * 2) Contexto estructurado consumible por el Asistente / Copiloto IA de AlonCar ERP.
 * Referencias canónicas transversales: CanonicalOtBadge / formatWorkOrderTooltipCanonical.
 */
import {
  HIGH_VALUE_MATERIAL_USD_THRESHOLD,
  DEFAULT_SECURITY_FACTOR,
  HIGH_VALUE_SECURITY_FACTOR,
  PANOL_MATERIAL_STEP_HELP,
  PANOL_WITHDRAWAL_STEP_HELP,
  PANOL_GAS_SUPPLIER_STEP_HELP,
  PANOL_GAS_CONTRACTOR_STEP_HELP,
  PANOL_QUICK_PURCHASE_STEP_HELP
} from './help/panolHelp.js'
import {
  LABOR_TEXT_STEP_HELP,
  LABOR_CREW_STEP_HELP,
  LABOR_CLOCK_BOARD_STEP_HELP,
  LABOR_CLOCK_ASSIGN_STEP_HELP,
  LABOR_EDIT_STEP_HELP
} from './help/laborHelp.js'
import {
  WORK_ORDER_STEP_HELP,
  OT_CATALOG_STEP_HELP
} from './help/workOrdersHelp.js'

export {
  HIGH_VALUE_MATERIAL_USD_THRESHOLD,
  DEFAULT_SECURITY_FACTOR,
  HIGH_VALUE_SECURITY_FACTOR,
  PANOL_MATERIAL_STEP_HELP,
  PANOL_WITHDRAWAL_STEP_HELP,
  PANOL_GAS_SUPPLIER_STEP_HELP,
  PANOL_GAS_CONTRACTOR_STEP_HELP,
  PANOL_QUICK_PURCHASE_STEP_HELP,
  LABOR_TEXT_STEP_HELP,
  LABOR_CREW_STEP_HELP,
  LABOR_CLOCK_BOARD_STEP_HELP,
  LABOR_CLOCK_ASSIGN_STEP_HELP,
  LABOR_EDIT_STEP_HELP,
  WORK_ORDER_STEP_HELP,
  OT_CATALOG_STEP_HELP
}

export const BUSINESS_HELP_REGISTRY = {
  panol_catalogo: PANOL_MATERIAL_STEP_HELP,
  panol_retiros: PANOL_WITHDRAWAL_STEP_HELP,
  panol_gases: PANOL_GAS_SUPPLIER_STEP_HELP,
  panol_gases_contratista: PANOL_GAS_CONTRACTOR_STEP_HELP,
  panol_pedido_compras: PANOL_QUICK_PURCHASE_STEP_HELP,
  labor_texto: LABOR_TEXT_STEP_HELP,
  labor_cuadrilla: LABOR_CREW_STEP_HELP,
  labor_reloj: LABOR_CLOCK_BOARD_STEP_HELP,
  labor_reloj_asignacion: LABOR_CLOCK_ASSIGN_STEP_HELP,
  labor_edicion: LABOR_EDIT_STEP_HELP,
  work_orders: WORK_ORDER_STEP_HELP,
  ot_catalog: OT_CATALOG_STEP_HELP
}

/**
 * Serializa las reglas de negocio ordenadas para inyección en el Asistente / Copiloto IA.
 */
export function exportBusinessHelpForAI(moduleKey = null) {
  const modules = moduleKey ? { [moduleKey]: BUSINESS_HELP_REGISTRY[moduleKey] || {} } : BUSINESS_HELP_REGISTRY
  const entries = []
  for (const [mod, steps] of Object.entries(modules)) {
    for (const item of Object.values(steps)) {
      entries.push({
        id: item.id,
        module: mod,
        step: item.step,
        title: item.title,
        rule: item.aiRuleContext
      })
    }
  }
  return entries
}
