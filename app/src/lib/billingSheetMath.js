/**
 * billingSheetMath.js — Cálculos puros de facturación, alertas por OT y balance acumulativo por hoja.
 */
import {
  A4_SHEET_METRICS,
  PAIRED_GRID_CLASS,
  SHEET_COLS_CLASS,
  estimateBillingBlockHeightPx,
  paginateBillingBlocks,
  computeA4RemainingSpacerPx,
  computeA4AutoFitPlan,
  buildAutoFitLayoutMetaPatch
} from './billingA4Layout.js'

export { A4_SHEET_METRICS, PAIRED_GRID_CLASS, SHEET_COLS_CLASS, estimateBillingBlockHeightPx, paginateBillingBlocks, computeA4RemainingSpacerPx, computeA4AutoFitPlan, buildAutoFitLayoutMetaPatch }

function round2(n) { return Number((Number(n) || 0).toFixed(2)) }

export function formatMoneyClean(val) {
  const n = Number(val) || 0
  return `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function resolveBlockBillingQty(block = {}, { isCaldereria = false, weightKg = 0 } = {}) {
  const mode = block?.billing_pricing_mode || 'MO_MAT'
  if (mode === 'UNITARIO') {
    const parsed = Number(block.billing_qty_override ?? block.quantity ?? 1)
    return Number.isFinite(parsed) ? parsed : 1
  }
  if (block.billing_qty_override != null) {
    const parsed = Number(block.billing_qty_override)
    return Number.isFinite(parsed) ? parsed : null
  }
  return isCaldereria && Number(weightKg) > 0 ? Number(weightKg) : null
}

/**
 * Extrae campos comerciales y estado de ampliación de una OT para `otRows`.
 */
export function extractWoBillingMeta(wo = {}, woItems = []) {
  return {
    foremanName: wo.foreman_name || woItems[0]?.foreman_name || '',
    isInBilling: Boolean(wo.is_in_billing),
    billingDescription: wo.billing_description ?? null,
    billingNotes: wo.billing_notes ?? null,
    billingSortOrder: wo.billing_sort_order ?? null,
    billingRubroGroup: wo.billing_rubro_group ?? null,
    billingPricingMode: wo.billing_pricing_mode || 'MO_MAT',
    billingMoUsd: Number(wo.billing_mo_usd) || 0,
    billingMatUsd: Number(wo.billing_mat_usd) || 0,
    billingUnitPriceUsd: Number(wo.billing_unit_price_usd) || 0,
    billingQtyOverride: wo.billing_qty_override ?? null,
    billingMoTax: wo.billing_mo_tax || 'EXENTO',
    billingMatTax: wo.billing_mat_tax || 'EXENTO',
    foremanReviewStatus: wo.foreman_review_status || 'NONE',
    foremanReviewNote: wo.foreman_review_note || ''
  }
}

/**
 * Desglose en vivo de Ítems Sin Valorizar ($0 / Pendientes "R") por OT en los 4 módulos:
 * - Hs: Horas (no presupuesto) sin tarifa ($0) o estado pendiente 'R'/'RR'
 * - 3ros: Servicios de Terceros activos con importe $0
 * - Comp: Compras Directas recibidas con precio $0
 * - Mat: Retiros de Pañol (excl. EPP y bajas) con precio $0
 */
export function computeOtUnvaluedBreakdown({
  otId,
  laborRows = [],
  materialRows = [],
  thirdPartyRows = []
}) {
  const details = []
  let hsCount = 0
  let tercerosCount = 0
  let comprasCount = 0
  let matCount = 0

  const matchOt = (row) => (otId === 'SIN_OT' ? !row.workOrderId : row.workOrderId === otId)

  for (const l of laborRows) {
    if (!matchOt(l) || l.isPresupuesto) continue
    const missingRate = Number(l.hourlyRateUsd) <= 0
    if (missingRate || l.isPendingR) {
      hsCount += 1
      details.push({
        id: `hs_${l.id}`,
        kind: 'HS',
        badge: 'Hs',
        label: l.workerName || 'Operario',
        date: l.date || '',
        detail: missingRate
          ? `${l.hoursPhysical} hs sin tarifa horaria ($0)`
          : `${l.hoursPhysical} hs pendientes de aprobar ("R")`
      })
    }
  }

  for (const tp of thirdPartyRows) {
    if (!matchOt(tp) || !tp.hasZeroCost) continue
    tercerosCount += 1
    details.push({
      id: `tp_${tp.id}`,
      kind: 'TERCEROS',
      badge: '3ros',
      label: tp.contractorName || 'Contratista',
      date: tp.date || '',
      detail: `${tp.voucherType || 'PRC'} sin valor (US$ 0)${tp.observations ? ` · ${tp.observations}` : ''}`
    })
  }

  for (const m of materialRows) {
    if (!matchOt(m) || !m.hasZeroPrice || m.isDeletionRequested) continue
    if (m.sourceType === 'COMPRA_DIRECTA') {
      comprasCount += 1
      details.push({
        id: `comp_${m.id}`,
        kind: 'COMPRAS',
        badge: 'Comp',
        label: m.materialName || 'Compra Directa',
        date: m.date || '',
        detail: `Compra Directa (${m.qty} ${m.unitMeasure}) sin precio unitario ($0)`
      })
    } else {
      matCount += 1
      details.push({
        id: `mat_${m.id}`,
        kind: 'MAT',
        badge: 'Mat',
        label: m.materialName || 'Material Pañol',
        date: m.date || '',
        detail: `Pañol (${m.qty} ${m.unitMeasure}) sin precio unitario ($0)`
      })
    }
  }

  return {
    hsCount,
    tercerosCount,
    comprasCount,
    matCount,
    totalCount: hsCount + tercerosCount + comprasCount + matCount,
    details
  }
}

/**
 * Calcula Exento, Gravado, IVA 21% y Total de un bloque comercial.
 */
export function computeBlockBillingBreakdown(block = {}) {
  const mode = block.billing_pricing_mode || 'MO_MAT'
  if (mode === 'SIN_CARGO') {
    return { exentoUsd: 0, gravadoUsd: 0, ivaUsd: 0, totalUsd: 0 }
  }

  let exentoUsd = 0
  let gravadoUsd = 0

  if (mode === 'UNITARIO') {
    const qty = Number(resolveBlockBillingQty(block)) || 0
    const unitPrice = Number(block.billing_unit_price_usd) || 0
    const net = round2(qty * unitPrice)
    if (block.billing_mo_tax === 'GRAVADO_21') gravadoUsd += net
    else exentoUsd += net
  } else {
    const moUsd = Number(block.billing_mo_usd) || 0
    const matUsd = Number(block.billing_mat_usd) || 0
    if (block.billing_mo_tax === 'GRAVADO_21') gravadoUsd += moUsd
    else exentoUsd += moUsd

    if (block.billing_mat_tax === 'GRAVADO_21') gravadoUsd += matUsd
    else exentoUsd += matUsd
  }

  exentoUsd = round2(exentoUsd)
  gravadoUsd = round2(gravadoUsd)
  const ivaUsd = round2(gravadoUsd * 0.21)
  return {
    exentoUsd,
    gravadoUsd,
    ivaUsd,
    totalUsd: round2(exentoUsd + gravadoUsd + ivaUsd)
  }
}

export function annotateBillingPages(pages = [[]]) {
  let idxCounter = 0
  let currentRubro = ''
  return (pages || [[]]).map((pageBlocks) =>
    (pageBlocks || []).map((block) => {
      if (block.blockType === 'RUBRO_DELIMITER') {
        currentRubro = block.label || ''
        return { block, isDelimiter: true, itemIndex: null, activeRubroLabel: currentRubro }
      }
      idxCounter += 1
      return { block, isDelimiter: false, itemIndex: idxCounter, activeRubroLabel: currentRubro }
    })
  )
}

export function computePaginatedCumulativeBalances(pages = [], operationalCostUsd = 0) {
  let accExento = 0
  let accGravado = 0

  const pageSummaries = (pages || []).map((pageBlocks, index) => {
    for (const block of pageBlocks || []) {
      if (block?.blockType === 'RUBRO_DELIMITER') continue
      const b = computeBlockBillingBreakdown(block)
      accExento = round2(accExento + b.exentoUsd)
      accGravado = round2(accGravado + b.gravadoUsd)
    }
    const accIva = round2(accGravado * 0.21)
    const accNeto = round2(accExento + accGravado)
    return {
      pageNumber: index + 1,
      totalPages: Math.max(1, pages.length),
      exentoUsd: accExento,
      gravadoUsd: accGravado,
      ivaUsd: accIva,
      netoUsd: accNeto,
      totalUsd: round2(accNeto + accIva)
    }
  })

  const last = pageSummaries[pageSummaries.length - 1] || {
    exentoUsd: 0,
    gravadoUsd: 0,
    ivaUsd: 0,
    netoUsd: 0,
    totalUsd: 0
  }
  const margenRealUsd = round2(last.netoUsd - (Number(operationalCostUsd) || 0))
  const margenPct = last.netoUsd > 0 ? Number(((margenRealUsd / last.netoUsd) * 100).toFixed(1)) : 0

  return {
    pageSummaries,
    grandTotal: {
      ...last,
      operationalCostUsd: round2(operationalCostUsd),
      margenRealUsd,
      margenPct
    }
  }
}
