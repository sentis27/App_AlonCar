/**
 * workCostRules.js
 * Fuente única de verdad para:
 * 1. Imputación de Materiales, Consumibles y Elementos de Seguridad (safety_items).
 * 2. Fórmula del Resumen Gerencial (GS-004): Costo Directo de Obra vs Costo de Referencia EPP Astillero.
 * 3. Vigencia de contratos de Personal del Astillero (alerta 7 días antes) y días de vacaciones futuros.
 */

export const SAFETY_ITEMS_OPTIONS = [
  {
    value: 'CONTRATISTA',
    label: 'CONTRATISTA',
    shortDesc: 'Se descuenta al contratista (no suma al barco)'
  },
  {
    value: 'ASTILLERO',
    label: 'ASTILLERO',
    shortDesc: 'Personal propio o zona gris sin descuento (solo ref. interna)'
  }
]

export const SAFETY_ITEMS_HELP_TEXT =
  'Regla unificada de Elementos de Seguridad (EPP): por defecto es CONTRATISTA (el costo se descuenta al contratista y no va al barco). Marcar ASTILLERO únicamente para personal en nómina o contratistas en "zona gris" tratados como propios: en ese caso no se les descuenta ni suma al total cobrable de la obra, quedando visible solo como costo informativo de referencia.'

export const CONTRACT_TYPES = [
  { value: '1 MES', label: '1 MES (Temporal)', months: 1, vacationDays: 1 },
  { value: '3 MESES', label: '3 MESES (Temporal)', months: 3, vacationDays: 4 },
  { value: '6 MESES', label: '6 MESES (Temporal)', months: 6, vacationDays: 9 },
  { value: 'PERMANENTE', label: 'PERMANENTE (Planta)', months: null, vacationDays: null }
]

export const CONTRACT_ALERT_DAYS_BEFORE = 7

/**
 * Normaliza el código de centro de costo de seguridad efectivo para un trabajador/contratista.
 * - Si admin_center === 'ASTILLERO' -> siempre 'ASTILLERO' (nómina propia).
 * - Si admin_center es CONTRATISTA/TALLER -> respeta worker.safety_items ('ASTILLERO' zona gris o 'CONTRATISTA' default).
 */
export function resolveEffectiveSafetyCenter(worker) {
  if (!worker) return 'CONTRATISTA'
  const center = String(worker.admin_center || '').trim().toUpperCase()
  if (center === 'ASTILLERO') return 'ASTILLERO'
  return String(worker.safety_items || 'CONTRATISTA').trim().toUpperCase() === 'ASTILLERO'
    ? 'ASTILLERO'
    : 'CONTRATISTA'
}

/**
 * Resuelve el % de descuento de consumibles asignado a un trabajador/contratista (0 a 100).
 */
export function resolveConsumablesDiscountPct(worker) {
  if (!worker) return 0
  if (worker.consumables_discount_pct !== null && worker.consumables_discount_pct !== undefined && worker.consumables_discount_pct !== '') {
    const num = Number(worker.consumables_discount_pct)
    if (Number.isFinite(num)) return Math.max(0, Math.min(100, num))
  }
  const tag = String(worker.consumables || '').trim().toUpperCase()
  if (tag === 'CONTRATISTA') return 100
  if (tag === 'CLIENTE') return 0
  const m = tag.match(/(\d+)/)
  if (m) return Math.max(0, Math.min(100, Number(m[1])))
  return String(worker.admin_center || '').toUpperCase() === 'ASTILLERO' ? 0 : 100
}

/**
 * Determina el tratamiento contable de un retiro de Pañol (inventory_transactions + material + worker):
 * - MATERIALES -> Siempre computa al Barco/Obra (`shipDirectPct = 100`, `contractorDeductPct = 0`, `referenceOnly = false`).
 * - CONSUMIBLES -> Depende del contrato del contratista (`contractorDeductPct` vs resto a obra).
 * - ELEM.SEGURIDAD ->
 *     * Si safety efectivo === 'ASTILLERO' -> `referenceOnly = true` (NO suma al total de la obra, NO se descuenta al contratista; figura solo como Costo de Referencia en Resumen Gerencial).
 *     * Si safety efectivo === 'CONTRATISTA' -> `contractorDeductPct = 100`, `shipDirectPct = 0` (paga el contratista).
 */
export function classifyWithdrawalCost({ material, transaction, worker }) {
  const category = String(material?.category || '').trim().toUpperCase()
  const movementType = String(transaction?.movement_type || '').trim().toUpperCase()
  const qty = Number(transaction?.quantity_withdrawn || 0)
  const unitArs = Number(transaction?.unit_cost_ars_snapshot || material?.cost_ars || 0)
  const unitUsd = Number(transaction?.unit_cost_usd_snapshot || material?.cost_usd || 0)
  const totalArs = Number((qty * unitArs).toFixed(2))
  const totalUsd = Number((qty * unitUsd).toFixed(2))

  const isSafety = category === 'ELEM.SEGURIDAD' || movementType === 'ENTREGA_EPP'
  if (isSafety) {
    const safetyCenter = resolveEffectiveSafetyCenter(worker)
    if (safetyCenter === 'ASTILLERO') {
      return {
        bucket: 'SAFETY_REFERENCE_ASTILLERO',
        safetyCenter,
        isGrayZoneException: Boolean(worker && String(worker.admin_center || '').toUpperCase() !== 'ASTILLERO'),
        deductibleToContractor: false,
        contractorDeductPct: 0,
        shipDirectPct: 0,
        referenceOnly: true,
        deductArs: 0,
        deductUsd: 0,
        shipDirectArs: 0,
        shipDirectUsd: 0,
        referenceArs: totalArs,
        referenceUsd: totalUsd,
        totalArs,
        totalUsd
      }
    }
    return {
      bucket: 'SAFETY_CONTRACTOR_DEDUCTION',
      safetyCenter: 'CONTRATISTA',
      isGrayZoneException: false,
      deductibleToContractor: true,
      contractorDeductPct: 100,
      shipDirectPct: 0,
      referenceOnly: false,
      deductArs: totalArs,
      deductUsd: totalUsd,
      shipDirectArs: 0,
      shipDirectUsd: 0,
      referenceArs: 0,
      referenceUsd: 0,
      totalArs,
      totalUsd
    }
  }

  if (category === 'CONSUMIBLES') {
    const explicitCostCenter = String(transaction?.cost_center || '').trim().toUpperCase()
    let pct = resolveConsumablesDiscountPct(worker)
    if (pct === 0 && explicitCostCenter === 'CONTRATISTA') {
      pct = 100
    }
    const deductRatio = pct / 100
    const shipRatio = 1 - deductRatio
    return {
      bucket: pct > 0 ? 'CONSUMABLE_CONTRACTOR_SPLIT' : 'CONSUMABLE_SHIP_DIRECT',
      safetyCenter: null,
      isGrayZoneException: false,
      deductibleToContractor: pct > 0,
      contractorDeductPct: pct,
      shipDirectPct: 100 - pct,
      referenceOnly: false,
      deductArs: Number((totalArs * deductRatio).toFixed(2)),
      deductUsd: Number((totalUsd * deductRatio).toFixed(2)),
      shipDirectArs: Number((totalArs * shipRatio).toFixed(2)),
      shipDirectUsd: Number((totalUsd * shipRatio).toFixed(2)),
      referenceArs: 0,
      referenceUsd: 0,
      totalArs,
      totalUsd
    }
  }

  // MATERIALES (u otros insumos transformados en la obra) -> siempre 100% Barco
  return {
    bucket: 'MATERIAL_SHIP_DIRECT',
    safetyCenter: null,
    isGrayZoneException: false,
    deductibleToContractor: false,
    contractorDeductPct: 0,
    shipDirectPct: 100,
    referenceOnly: false,
    deductArs: 0,
    deductUsd: 0,
    shipDirectArs: totalArs,
    shipDirectUsd: totalUsd,
    referenceArs: 0,
    referenceUsd: 0,
    totalArs,
    totalUsd
  }
}

/**
 * Motor compartido de totales gerenciales (para uso en futuro Resumen Gerencial GS-004):
 * - Suma al Total Directo: Materiales + Consumibles (parte obra) + Terceros + Horas (+ Pend. Aprobar).
 * - Excluye del Total Directo el costo de Seguridad Astillero/Zona Gris, entregándolo en `seguridadReferencia`.
 */
export function computeManagerialCostSummary({
  materialesUsd = 0,
  consumiblesObraUsd = 0,
  tercerosUsd = 0,
  horasUsd = 0,
  horasPendAprobarUsd = 0,
  seguridadReferenciaUsd = 0
} = {}) {
  const directTotalUsd = Number(
    (
      Number(materialesUsd || 0) +
      Number(consumiblesObraUsd || 0) +
      Number(tercerosUsd || 0) +
      Number(horasUsd || 0) +
      Number(horasPendAprobarUsd || 0)
    ).toFixed(2)
  )
  return {
    materialesUsd: Number(Number(materialesUsd || 0).toFixed(2)),
    consumiblesObraUsd: Number(Number(consumiblesObraUsd || 0).toFixed(2)),
    tercerosUsd: Number(Number(tercerosUsd || 0).toFixed(2)),
    horasUsd: Number(Number(horasUsd || 0).toFixed(2)),
    horasPendAprobarUsd: Number(Number(horasPendAprobarUsd || 0).toFixed(2)),
    seguridadReferenciaUsd: Number(Number(seguridadReferenciaUsd || 0).toFixed(2)),
    directTotalUsd
  }
}

/**
 * Calcula la fecha de vencimiento de un contrato temporal de Astillero y los días restantes.
 */
export function computeContractExpiration(contractType, startDateStr, referenceDate = new Date()) {
  const normalizedType = String(contractType || '').trim().toUpperCase()
  const meta = CONTRACT_TYPES.find((c) => c.value === normalizedType) || null

  if (!meta) {
    return {
      hasContract: false,
      contractType: normalizedType || null,
      isPermanent: false,
      expiresIso: null,
      daysRemaining: null,
      isExpired: false,
      isExpiringSoon: false,
      vacationDays: null
    }
  }

  if (meta.months === null) {
    return {
      hasContract: true,
      contractType: meta.value,
      isPermanent: true,
      expiresIso: null,
      daysRemaining: null,
      isExpired: false,
      isExpiringSoon: false,
      vacationDays: null
    }
  }

  if (!startDateStr) {
    return {
      hasContract: true,
      contractType: meta.value,
      isPermanent: false,
      expiresIso: null,
      daysRemaining: null,
      isExpired: false,
      isExpiringSoon: false,
      vacationDays: meta.vacationDays
    }
  }

  const parsedStart = new Date(`${String(startDateStr).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(parsedStart.getTime())) {
    return {
      hasContract: false,
      contractType: meta.value,
      isPermanent: false,
      expiresIso: null,
      daysRemaining: null,
      isExpired: false,
      isExpiringSoon: false,
      vacationDays: meta.vacationDays
    }
  }

  const expiresDate = new Date(parsedStart)
  expiresDate.setMonth(expiresDate.getMonth() + meta.months)
  const refDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate())
  const expDay = new Date(expiresDate.getFullYear(), expiresDate.getMonth(), expiresDate.getDate())
  const diffMs = expDay.getTime() - refDay.getTime()
  const daysRemaining = Math.round(diffMs / 86400000)

  const yyyy = expDay.getFullYear()
  const mm = String(expDay.getMonth() + 1).padStart(2, '0')
  const dd = String(expDay.getDate()).padStart(2, '0')

  return {
    hasContract: true,
    contractType: meta.value,
    isPermanent: false,
    expiresIso: `${yyyy}-${mm}-${dd}`,
    daysRemaining,
    isExpired: daysRemaining < 0,
    isExpiringSoon: daysRemaining >= 0 && daysRemaining <= CONTRACT_ALERT_DAYS_BEFORE,
    needsAttention: daysRemaining <= CONTRACT_ALERT_DAYS_BEFORE,
    vacationDays: meta.vacationDays
  }
}
