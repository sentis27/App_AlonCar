/**
 * tercerosCcHelp.js
 * Ayudas contextuales (FL-020 · StepHelpBadge) para Cuentas Corrientes de Talleres.
 */

export const TERCEROS_CC_ACCOUNT_STEP_HELP = {
  1: {
    id: 'terceros_cc_account_step_1',
    module: 'terceros_cc_cuenta',
    step: 1,
    title: 'PASO 1 · TALLER Y RAZÓN SOCIAL',
    uiBullets: [
      { label: 'Nombre Operativo vs. Razón Social', text: 'Elegí el taller del padrón (ej. INA PANTOGRAFO) y asigná su razón social comercial (ej. PAMPA NAVAL).' },
      { label: 'Modalidad de Liquidación', text: 'POR_KILO absorbe kilos de MATERIALES enviados desde Pañol con Nº Remito; POR_COMPROBANTE absorbe facturas/remitos cargados en Terceros.' },
    ],
    aiRuleContext: 'Alta de Cuenta Corriente de Taller (SKL-019): vincula worker_id del padrón de terceros con legal_name y pricing_mode (PER_KG o BY_VOUCHER).',
  },
  2: {
    id: 'terceros_cc_account_step_2',
    module: 'terceros_cc_cuenta',
    step: 2,
    title: 'PASO 2 · TARIFA INICIAL, SALDO Y CANCELACIÓN',
    uiBullets: [
      { label: 'Tarifa Base US$/kg', text: 'En cuentas por kilo define la tarifa inicial en dólares/kg desde la fecha de arranque.' },
      { label: 'Saldo Inicial y Cancelados', text: 'Podés arrancar en US$ 0 o fijar un saldo inicial a fecha de corte, y elegir FIFO automático o marca manual.' },
    ],
    aiRuleContext: 'Configuración contable de C.C.: current_rate_usd inicializa third_party_cc_rate_history y opening_balance_usd ajusta el saldo base.',
  },
}

export const TERCEROS_CC_PAYMENT_STEP_HELP = {
  1: {
    id: 'terceros_cc_payment_step_1',
    module: 'terceros_cc_pago',
    step: 1,
    title: 'PASO 1 · FECHA Y MODALIDAD DE PAGO / CANJE',
    uiBullets: [
      { label: '4 Modalidades Reales', text: 'Efectivo USD, Transferencia AR$, E-Cheq AR$ (con o sin IVA 21%) y Compensaciones por Remito de Pañol o Trabajos propios.' },
    ],
    aiRuleContext: 'HABER de Cuenta Corriente: soporta EFECTIVO_USD, TRANSFERENCIA_ARS, ECHEQ_ARS, COMPENSACION_PANOL y COMPENSACION_TRABAJO.',
  },
  2: {
    id: 'terceros_cc_payment_step_2',
    module: 'terceros_cc_pago',
    step: 2,
    title: 'PASO 2 · IMPORTES, TIPO DE CAMBIO Y NETO US$',
    uiBullets: [
      { label: 'Descuento Automático de IVA', text: 'Si pagás en pesos con Factura + IVA 21%, el sistema muestra el bruto fiscal e imputa a la C.C. únicamente el neto en US$.' },
      { label: 'Remito o Factura', text: 'Registrá el Nº de Remito Pañol (canje) o Nº de Factura/Cheques para conciliación rápida.' },
    ],
    aiRuleContext: 'Cálculo de pago neto USD: computePaymentNetUsd divide AR$ / TC y, si has_iva=true, divide por (1 + iva_pct/100) para obtener amount_usd neto.',
  },
}

export const TERCEROS_CC_RATE_STEP_HELP = {
  1: {
    id: 'terceros_cc_rate_step_1',
    module: 'terceros_cc_tarifa',
    step: 1,
    title: 'PASO 1 · NUEVA VIGENCIA DE TARIFA US$/KG',
    uiBullets: [
      { label: 'Congelado Histórico Automático', text: 'La nueva tarifa rige únicamente desde su fecha de vigencia hacia adelante sin recalcular remitos anteriores.' },
    ],
    aiRuleContext: 'Historial de tarifas por kg: third_party_cc_rate_history resuelve resolveRateForDate sin alterar los períodos pasados.',
  },
}

export const TERCEROS_CC_MANUAL_ENTRY_STEP_HELP = {
  1: {
    id: 'terceros_cc_manual_step_1',
    module: 'terceros_cc_ajuste',
    step: 1,
    title: 'PASO 1 · ASIENTO MANUAL EN EL DEBE',
    uiBullets: [
      { label: 'Ajustes o Trabajos Especiales', text: 'Agregá trabajos puntuales no originados en un retiro de Pañol o diferencias acordadas con el taller.' },
    ],
    aiRuleContext: 'Asiento manual en DEBE de Cuenta Corriente (entry_source = MANUAL) auditado en audit_logs.',
  },
}
