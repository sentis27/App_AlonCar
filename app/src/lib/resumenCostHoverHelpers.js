/**
 * resumenCostHoverHelpers.js
 * Funciones puras (sin dependencias de React ni Supabase) para generar los resúmenes
 * emergentes al hover en Resumen Gerencial (GS-004):
 * - Horas físicas reales agrupadas por contratista / ASTILLERO.<RUBRO> y modalidad (PRC, HH, CTRL).
 * - Materiales y Consumibles agrupados por material + unidad, ordenados A-Z y con agrupación colapsable por Rubro.
 * - Terceros agrupados por taller, ordenados de mayor a menor costo y con los sin valor ($0) al final.
 */

function normKey(v) {
  return String(v || '').trim().toUpperCase()
}

function round2(n) {
  return Number((Number(n) || 0).toFixed(2))
}

const COMPACT_UNIT_MAP = {
  M2: 'm2',
  'M²': 'm2',
  ML: 'ml',
  KG: 'kg',
  KGS: 'kg',
  KILO: 'kg',
  KILOS: 'kg',
  LT: 'lt',
  LTS: 'lt',
  LITRO: 'lt',
  LITROS: 'lt',
  MT: 'm',
  MTS: 'm',
  METRO: 'm',
  METROS: 'm',
  M: 'm',
  UN: 'un',
  'UN.': 'un',
  UNIDAD: 'un',
  UNIDADES: 'un'
}

export function formatCompactUnit(unitMeasure = 'un') {
  const raw = String(unitMeasure || '').trim()
  if (!raw) return 'un'
  const mapped = COMPACT_UNIT_MAP[raw.toUpperCase()]
  return mapped || raw.toLowerCase()
}

export function formatQtyWithUnit(qty, unitMeasure) {
  const num = Number(qty) || 0
  const qtyStr = num.toLocaleString('es-AR', {
    minimumFractionDigits: Number.isInteger(num) ? 0 : 1,
    maximumFractionDigits: 2
  })
  const unit = formatCompactUnit(unitMeasure)
  const attachTight = ['m2', 'ml', 'kg', 'lt', 'm'].includes(unit)
  return attachTight ? `${qtyStr}${unit}` : `${qtyStr} ${unit}`
}

export function mapWorkTypeToHoverCode(workTypeRaw) {
  const upper = normKey(workTypeRaw)
  if (upper === 'PRESUPUESTO' || upper === 'PRC') return 'PRC'
  if (upper === 'CONTROL' || upper === 'CTRL') return 'CTRL'
  return 'HH'
}

/**
 * Resume horas físicas reales para tooltip emergente de Horas Aprobadas, Pendientes ("R") u OT.
 * Regla: agrupa por contratista (o ASTILLERO.<RUBRO> si es propio) + tipo (PRC / HH / CTRL),
 * ordena alfabéticamente por actor/contratista. Incluye horas PRC aunque su importe sea $0 (DEC-013).
 */
export function buildHoursHoverSummary(laborRows = [], { filterMode = 'ALL' } = {}) {
  const map = new Map()
  let totalHours = 0
  let totalCostUsd = 0

  for (const row of laborRows) {
    if (!row) continue
    if (filterMode === 'APPROVED' && row.isPendingR) continue
    if (filterMode === 'PENDING_R' && !row.isPendingR) continue

    const hrs = Number(row.hoursPhysical) || 0
    if (hrs <= 0) continue

    const isAstillero = row.workerType === 'Astillero'
    const rubroClean = normKey(row.rubro || 'GENERAL')
    const actorLabel = isAstillero
      ? `ASTILLERO.${rubroClean}`
      : normKey(row.contractorGroup || row.workerName || 'CONTRATISTA')

    const workTypeCode = row.workTypeCode || mapWorkTypeToHoverCode(row.workType)
    const key = `${actorLabel}__${workTypeCode}`
    const rowCost =
      filterMode === 'APPROVED'
        ? Number(row.approvedUsd) || 0
        : filterMode === 'PENDING_R'
          ? Number(row.pendingRUsd) || 0
          : Number(row.costUsd) || 0

    if (!map.has(key)) {
      map.set(key, {
        key,
        actorLabel,
        workTypeCode,
        isAstillero,
        hours: 0,
        costUsd: 0
      })
    }

    const bucket = map.get(key)
    bucket.hours = round2(bucket.hours + hrs)
    bucket.costUsd = round2(bucket.costUsd + rowCost)
    totalHours = round2(totalHours + hrs)
    totalCostUsd = round2(totalCostUsd + rowCost)
  }

  const items = Array.from(map.values()).sort((a, b) => {
    const cmpActor = a.actorLabel.localeCompare(b.actorLabel, 'es')
    if (cmpActor !== 0) return cmpActor
    return a.workTypeCode.localeCompare(b.workTypeCode, 'es')
  })

  return {
    items,
    totalHours,
    totalCostUsd
  }
}

/**
 * Resume Materiales o Consumibles para tooltip emergente:
 * - Agrupado por material + unidad, sumando cantidad y costo total USD.
 * - Ordenado A-Z por nombre de material.
 * - Genera además vista alternativa colapsable por Rubro (con ítems A-Z adentro).
 */
export function buildMaterialsHoverSummary(materialRows = [], { category = 'MATERIALES' } = {}) {
  const itemMap = new Map()
  let totalUsd = 0

  for (const row of materialRows) {
    if (!row || row.isDeletionRequested) continue
    if (category && row.category !== category) continue

    const rawName = String(row.materialName || 'Insumo sin nombre').trim()
    const compactUnit = formatCompactUnit(row.unitMeasure || 'un')
    const key = `${normKey(rawName)}__${normKey(compactUnit)}`
    const qty = Number(row.qty) || 0
    const costUsd = Number(row.shipDirectUsd) || 0
    const weightKg = Number(row.weightKg) || 0
    const rubro = normKey(row.rubro || 'GENERAL')

    if (!itemMap.has(key)) {
      itemMap.set(key, {
        key,
        materialName: rawName.toUpperCase(),
        unitMeasure: compactUnit,
        rubro,
        qty: 0,
        costUsd: 0,
        weightKg: 0,
        cuts: []
      })
    }

    const bucket = itemMap.get(key)
    bucket.qty = round2(bucket.qty + qty)
    bucket.costUsd = round2(bucket.costUsd + costUsd)
    bucket.weightKg = round2(bucket.weightKg + weightKg)
    if (row.cutDimensionsLabel || row.qtyFormula) {
      bucket.cuts.push({
        dimensionsLabel: row.cutDimensionsLabel || row.qtyFormula,
        qty,
        date: row.date || '',
        notes: row.notes || ''
      })
    }
    totalUsd = round2(totalUsd + costUsd)
  }

  const items = Array.from(itemMap.values())
    .map((item) => ({
      ...item,
      qtyUnitLabel: formatQtyWithUnit(item.qty, item.unitMeasure)
    }))
    .sort((a, b) => a.materialName.localeCompare(b.materialName, 'es'))

  const rubroMap = new Map()
  for (const item of items) {
    if (!rubroMap.has(item.rubro)) {
      rubroMap.set(item.rubro, {
        rubro: item.rubro,
        totalUsd: 0,
        itemsCount: 0,
        items: []
      })
    }
    const rGroup = rubroMap.get(item.rubro)
    rGroup.items.push(item)
    rGroup.itemsCount += 1
    rGroup.totalUsd = round2(rGroup.totalUsd + item.costUsd)
  }

  const byRubro = Array.from(rubroMap.values()).sort((a, b) =>
    a.rubro.localeCompare(b.rubro, 'es')
  )

  return {
    items,
    byRubro,
    totalUsd,
    totalItems: items.length
  }
}

/**
 * Resume Servicios de Terceros por taller/contratista:
 * - Ordena de mayor a menor según el costo total USD.
 * - Ubica los talleres sin valor ($0) siempre al final.
 */
export function buildThirdPartyHoverSummary(thirdPartyRows = []) {
  const map = new Map()
  let totalUsd = 0

  for (const row of thirdPartyRows) {
    if (!row) continue
    const contractorName = normKey(row.contractorName || 'CONTRATISTA')
    const usd = Number(row.amountUsd) || 0

    if (!map.has(contractorName)) {
      map.set(contractorName, {
        contractorName,
        totalUsd: 0,
        count: 0,
        zeroLinesCount: 0
      })
    }

    const bucket = map.get(contractorName)
    bucket.totalUsd = round2(bucket.totalUsd + usd)
    bucket.count += 1
    if (row.hasZeroCost || usd <= 0) {
      bucket.zeroLinesCount += 1
    }
    totalUsd = round2(totalUsd + usd)
  }

  const items = Array.from(map.values())
    .map((entry) => ({
      ...entry,
      isZeroCost: entry.totalUsd <= 0
    }))
    .sort((a, b) => {
      if (a.isZeroCost !== b.isZeroCost) {
        return a.isZeroCost ? 1 : -1
      }
      if (!a.isZeroCost && b.totalUsd !== a.totalUsd) {
        return b.totalUsd - a.totalUsd
      }
      return a.contractorName.localeCompare(b.contractorName, 'es')
    })

  const zeroCount = items.filter((i) => i.isZeroCost).length

  return {
    items,
    totalUsd,
    zeroCount
  }
}

/**
 * Resume cada línea cargada de Grúa Grande o Grúa Chica (`[cantidad hs] [comentario / observaciones]`).
 */
export function buildEquipmentHoverSummary(laborRows = [], equipmentType = 'GRUA_GRANDE') {
  const rows = (laborRows || [])
    .filter((row) => row && row.equipmentType === equipmentType && Number(row.hoursPhysical) > 0)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))

  let totalHours = 0
  const items = rows.map((row) => {
    const hours = round2(Number(row.hoursPhysical) || 0)
    totalHours = round2(totalHours + hours)
    return {
      id: row.id,
      date: row.date || '',
      otLabel: row.otLabel || row.otNumber || 'Sin OT',
      hours,
      comment: String(row.notes || '').trim() || row.workerName || row.rubro || 'Sin observaciones'
    }
  })

  return {
    items,
    totalHours,
    totalCount: items.length
  }
}
