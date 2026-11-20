/**
 * billingSheetMath.js
 * Cálculos puros de facturación y alertas por OT:
 * 1. Desglose en vivo de Ítems Sin Valorizar ($0 / Pendientes "R"): [Hs | 3ros | Comp | Mat].
 * 2. Proyección de campos comerciales de `work_orders` hacia `otRows` (sin inflar servicios padres).
 * 3. Balance por bloque (MO+MAT, Unitario con bonificaciones negativas, Sin Cargo)
 *    y Transporte Acumulado al pie de cada Hoja 1/N (Exento / Gravado / IVA 21% / Total).
 */

function round2(n) {
  return Number((Number(n) || 0).toFixed(2))
}

export const PAIRED_GRID_CLASS = 'grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_5px_315px] xl:gap-x-2 items-stretch'
export const SHEET_COLS_CLASS = 'grid grid-cols-[20px_28px_46px_minmax(0,1fr)_72px_82px_40px]'

export function formatMoneyClean(val) {
  const n = Number(val) || 0
  return `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
    const qty = Number(block.billing_qty_override ?? block.quantity ?? 0) || 0
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

/**
 * Paginación lógica por peso visual de líneas para armar Hojas A4 (HOJA 1/N ... HOJA N/N)
 * y calcular el balance acumulativo (Transporte) al cierre de cada hoja.
 */
export function paginateBillingBlocks(blocks = [], maxUnitsPerPage = 24) {
  if (!Array.isArray(blocks) || blocks.length === 0) return [[]]
  const pages = []
  let current = []
  let currentWeight = 0

  for (const block of blocks) {
    const plain = String(block.billing_description || block.label || '').replace(/<[^>]+>/g, '\n')
    const lineCount = Math.max(2, plain.split(/\n+/).filter(Boolean).length)
    const blockWeight = block.blockType === 'RUBRO_DELIMITER' ? 2 : Math.min(18, Math.max(4, lineCount + 2))

    if (current.length > 0 && currentWeight + blockWeight > maxUnitsPerPage) {
      pages.push(current)
      current = [block]
      currentWeight = blockWeight
    } else {
      current.push(block)
      currentWeight += blockWeight
    }
  }
  if (current.length > 0) pages.push(current)
  return pages
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
