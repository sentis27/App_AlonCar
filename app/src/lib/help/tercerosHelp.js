/**
 * tercerosHelp.js
 * Registro de reglas de negocio y ayudas contextuales para Servicios de Terceros (M5 / DEC-017).
 */

export const TERCEROS_SERVICE_STEP_HELP = {
  1: {
    id: 'terceros_service_step_1',
    module: 'terceros_gastos',
    step: 1,
    title: 'PASO 1 · CASCADA DE IMPUTACIÓN DE OBRA',
    uiBullets: [
      { label: 'Cascada Naval', text: 'Elegí Buque ➔ Contratista autorizado [3ros] ➔ Orden de Trabajo (con vista flotante al pasar el mouse).' },
      { label: 'Proveedor Polirrubro', text: 'Si el taller está configurado como MANUAL, se despliega el selector oficial de rubro para clasificar el gasto.' }
    ],
    aiRuleContext:
      'Regla de Imputación de Terceros (M5 / GS-005): Sigue la cascada Buque -> Contratista con permiso can_charge_third_party -> OT (WorkOrderSelectorWithHover). Permite OT en blanco si aún no fue abierta.'
  },
  2: {
    id: 'terceros_service_step_2',
    module: 'terceros_gastos',
    step: 2,
    title: 'PASO 2 · TIPO DE COMPROBANTE Y NÚMEROS (DEC-017)',
    uiBullets: [
      { label: 'Ciclo de Comprobantes', text: 'PRC (Presupuesto interno) · RMO / RPF (Remitos provisorios) · FCR / FCA (Factura fiscal definitiva) · SDT (Sin documentación fiscal).' },
      { label: 'Cruce Multi-Comprobante', text: 'Podés cargar en paralelo Nº de PRC, Factura, Remito AlonCar y Remito Proveedor para trazabilidad total.' }
    ],
    aiRuleContext:
      'Regla DEC-017 de Comprobantes de Terceros: Un mismo servicio puede vincular budget_number (PRC), invoice_number (FCR/FCA), internal_remito_number y supplier_remito_number y evolucionar luego a FCR.'
  },
  3: {
    id: 'terceros_service_step_3',
    module: 'terceros_gastos',
    step: 3,
    title: 'PASO 3 · FECHA, IMPORTE AR$ Y DÓLAR QUINCENAL',
    uiBullets: [
      { label: 'Cotización Intocable', text: 'La Fecha de Carga fija automáticamente la cotización del dólar oficial de la quincena para convertir a US$.' },
      { label: 'Fórmulas Rápidas', text: 'El campo Importe AR$ acepta cálculos directos como =42000+18500.' }
    ],
    aiRuleContext:
      'Regla de Valuación de Terceros: amount_usd se calcula con la tasa usd_rate vigente en macro_variables para entry_date; soporta fórmulas vía FormulaNumericInput.'
  },
  4: {
    id: 'terceros_service_step_4',
    module: 'terceros_gastos',
    step: 4,
    title: 'PASO 4 · OBSERVACIONES TÉCNICAS Y ADMINISTRATIVAS',
    uiBullets: [
      { label: 'Directas vs. Específicas', text: 'Directas detallan la tarea técnica ejecutada a bordo; Específicas registran reclamos de facturas o condiciones comerciales.' }
    ],
    aiRuleContext:
      'Regla de Observaciones en Terceros: Separa direct_observations (visibles al Jefe de Obra y Resumen Gerencial) de specific_observations (administración/tesorería).'
  }
}

export const TERCEROS_EVOLUTION_STEP_HELP = {
  1: {
    id: 'terceros_evolution_step_1',
    module: 'terceros_evolucion',
    step: 1,
    title: 'PASO 1 · COMPROBANTE DESTINO Y NÚMERO',
    uiBullets: [
      { label: 'Pase a Factura Oficial (FCR)', text: 'Conserva en third_party_voucher_history el remito/presupuesto anterior y actualiza el comprobante vigente.' }
    ],
    aiRuleContext:
      'Regla de Evolución DEC-017: Transiciona RMO/RPF/PRC hacia FCR o SDT guardando trazabilidad histórica del comprobante previo.'
  },
  2: {
    id: 'terceros_evolution_step_2',
    module: 'terceros_evolucion',
    step: 2,
    title: 'PASO 2 · FECHA, MONTO FINAL Y CONSTANCIA',
    uiBullets: [
      { label: 'Ajuste Final', text: 'Confirmá la fecha oficial y el importe final facturado en AR$ (acepta fórmulas).' }
    ],
    aiRuleContext:
      'Regla de Cierre Fiscal en Evolución: Actualiza monto final y registra constancia del pase en historial auditado.'
  }
}

export const TERCEROS_AUDIT_STEP_HELP = {
  1: {
    id: 'terceros_audit_step_1',
    module: 'terceros_auditoria',
    step: 1,
    title: 'PASO 1 · CONFORMIDAD TÉCNICA DE OBRA',
    uiBullets: [
      { label: 'CONFORME vs. OBSERVADO', text: 'El Jefe de Obra valida que el trabajo facturado se ejecutó correctamente en el buque y OT indicados.' }
    ],
    aiRuleContext:
      'Regla de Auditoría Técnica de Terceros: Asienta audit_status (CONFORME/OBSERVADO) y audit_notes en third_party_services con auditoría.'
  }
}
