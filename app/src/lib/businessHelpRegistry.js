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
import { PANOL_STOCK_ADJUST_STEP_HELP, PANOL_STOCK_AUDIT_STEP_HELP } from './help/panolStockHelp.js'
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
import {
  COMPRAS_ORDER_STEP_HELP,
  COMPRAS_SUPPLIER_STEP_HELP
} from './help/comprasHelp.js'
import {
  TERCEROS_SERVICE_STEP_HELP,
  TERCEROS_EVOLUTION_STEP_HELP,
  TERCEROS_AUDIT_STEP_HELP
} from './help/tercerosHelp.js'
import {
  PERSONAL_WORKER_STEP_HELP,
  SHIPS_FORM_STEP_HELP,
  SHIPS_STAY_STEP_HELP,
  SHIPS_OWNER_STEP_HELP
} from './help/personalShipsHelp.js'
import {
  PICKER_SHIP_WO_STEP_HELP,
  PICKER_CONTRACTOR_STEP_HELP
} from './help/pickersHelp.js'

export {
  HIGH_VALUE_MATERIAL_USD_THRESHOLD,
  DEFAULT_SECURITY_FACTOR,
  HIGH_VALUE_SECURITY_FACTOR,
  PANOL_MATERIAL_STEP_HELP,
  PANOL_WITHDRAWAL_STEP_HELP,
  PANOL_GAS_SUPPLIER_STEP_HELP,
  PANOL_GAS_CONTRACTOR_STEP_HELP,
  PANOL_QUICK_PURCHASE_STEP_HELP,
  PANOL_STOCK_ADJUST_STEP_HELP,
  PANOL_STOCK_AUDIT_STEP_HELP,
  LABOR_TEXT_STEP_HELP,
  LABOR_CREW_STEP_HELP,
  LABOR_CLOCK_BOARD_STEP_HELP,
  LABOR_CLOCK_ASSIGN_STEP_HELP,
  LABOR_EDIT_STEP_HELP,
  WORK_ORDER_STEP_HELP,
  OT_CATALOG_STEP_HELP,
  COMPRAS_ORDER_STEP_HELP,
  COMPRAS_SUPPLIER_STEP_HELP,
  TERCEROS_SERVICE_STEP_HELP,
  TERCEROS_EVOLUTION_STEP_HELP,
  TERCEROS_AUDIT_STEP_HELP,
  PERSONAL_WORKER_STEP_HELP,
  SHIPS_FORM_STEP_HELP,
  SHIPS_STAY_STEP_HELP,
  SHIPS_OWNER_STEP_HELP,
  PICKER_SHIP_WO_STEP_HELP,
  PICKER_CONTRACTOR_STEP_HELP
}

export const BUSINESS_HELP_REGISTRY = {
  panol_catalogo: PANOL_MATERIAL_STEP_HELP,
  panol_retiros: PANOL_WITHDRAWAL_STEP_HELP,
  panol_gases: PANOL_GAS_SUPPLIER_STEP_HELP,
  panol_gases_contratista: PANOL_GAS_CONTRACTOR_STEP_HELP,
  panol_pedido_compras: PANOL_QUICK_PURCHASE_STEP_HELP,
  panol_stock_adjust: PANOL_STOCK_ADJUST_STEP_HELP,
  panol_stock_audit: PANOL_STOCK_AUDIT_STEP_HELP,
  labor_texto: LABOR_TEXT_STEP_HELP,
  labor_cuadrilla: LABOR_CREW_STEP_HELP,
  labor_reloj: LABOR_CLOCK_BOARD_STEP_HELP,
  labor_reloj_asignacion: LABOR_CLOCK_ASSIGN_STEP_HELP,
  labor_edicion: LABOR_EDIT_STEP_HELP,
  work_orders: WORK_ORDER_STEP_HELP,
  ot_catalog: OT_CATALOG_STEP_HELP,
  compras_pedidos: COMPRAS_ORDER_STEP_HELP,
  compras_proveedores: COMPRAS_SUPPLIER_STEP_HELP,
  terceros_gastos: TERCEROS_SERVICE_STEP_HELP,
  terceros_evolucion: TERCEROS_EVOLUTION_STEP_HELP,
  terceros_auditoria: TERCEROS_AUDIT_STEP_HELP,
  personal_nomina: PERSONAL_WORKER_STEP_HELP,
  ships_buques: SHIPS_FORM_STEP_HELP,
  ships_estadias: SHIPS_STAY_STEP_HELP,
  ships_armadores: SHIPS_OWNER_STEP_HELP,
  picker_ship_wo: PICKER_SHIP_WO_STEP_HELP,
  picker_contractor: PICKER_CONTRACTOR_STEP_HELP
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
