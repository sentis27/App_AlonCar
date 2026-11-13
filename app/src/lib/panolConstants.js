import {
  normalizeText,
  getEnabledWorkersAndContractors,
  getShipEnabledContractors
} from './allocationEngine.js'
import { matchesUniversalSearch } from './searchEngine.js'
import { formatWorkOrderTooltipCanonical } from './workOrdersConstants.js'

export { getEnabledWorkersAndContractors, getShipEnabledContractors }

/**
 * Tipos de operación de gases permitidos en una salida/consumo de Pañol (doble imputación).
 * Nota: DEVOLUCION_FINAL pertenece exclusivamente a la pestaña Control de Gases.
 */
export const PANOL_GAS_OPERATION_TYPES = [
  {
    value: 'PRIMERA_ENTREGA',
    label: '1. Primera Entrega (+1 deuda contratista, -1 lleno pañol)',
    requiresReturnedSupplier: false
  },
  {
    value: 'RECAMBIO_1X1',
    label: '2. Recambio 1x1 con Cruce (+1 vacío marca devuelta, -1 lleno marca entregada)',
    requiresReturnedSupplier: true
  }
]

export const GAS_CONTRACTOR_OPERATION_TYPES = [
  'PRIMERA_ENTREGA',
  'RECAMBIO_1X1',
  'DEVOLUCION_FINAL'
]

export const GAS_SUPPLIER_OPERATION_TYPES = [
  {
    value: 'DEVOLUCION_PROVEEDOR',
    label: 'Devolución a Empresa Gasera (Egreso de patio)',
    shortLabel: 'Dev. a Gasera',
    defaultCondition: 'VACIO'
  },
  {
    value: 'INGRESO_PROVEEDOR',
    label: 'Ingreso desde Empresa Gasera (Recepción / Remito)',
    shortLabel: 'Ingreso Gasera',
    defaultCondition: 'LLENO'
  },
  {
    value: 'SALDO_INICIAL_PATIO',
    label: 'Saldo Inicial en Patio (Inventario base de arranque)',
    shortLabel: 'Saldo Inicial',
    defaultCondition: 'LLENO'
  }
]

export const GAS_OPERATION_META = {
  SALDO_INICIAL_PATIO: {
    label: 'Saldo Inicial Patio',
    shortLabel: 'Saldo Inicial',
    scope: 'PROVEEDOR',
    defaultCondition: 'LLENO',
    badge: 'bg-cyan-950/90 text-cyan-300 border-cyan-500/50'
  },
  INGRESO_PROVEEDOR: {
    label: 'Ingreso desde Gasera',
    shortLabel: 'Ingreso Gasera',
    scope: 'PROVEEDOR',
    defaultCondition: 'LLENO',
    badge: 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50'
  },
  DEVOLUCION_PROVEEDOR: {
    label: 'Devolución a Gasera',
    shortLabel: 'Dev. a Gasera',
    scope: 'PROVEEDOR',
    defaultCondition: 'VACIO',
    badge: 'bg-rose-950/90 text-rose-300 border-rose-500/50'
  },
  AJUSTE_PATIO: {
    label: 'Ajuste de Patio',
    shortLabel: 'Ajuste Patio',
    scope: 'PROVEEDOR',
    defaultCondition: 'LLENO',
    badge: 'bg-slate-800 text-slate-300 border-slate-600'
  },
  PRIMERA_ENTREGA: {
    label: 'Primera Entrega Contratista',
    shortLabel: 'Primera Entrega',
    scope: 'CONTRATISTA',
    defaultCondition: 'LLENO',
    badge: 'bg-amber-950/90 text-amber-300 border-amber-500/50'
  },
  RECAMBIO_1X1: {
    label: 'Recambio 1x1 Contratista',
    shortLabel: 'Recambio 1x1',
    scope: 'CONTRATISTA',
    defaultCondition: 'MIXTO',
    badge: 'bg-sky-950/90 text-sky-300 border-sky-500/50'
  },
  DEVOLUCION_FINAL: {
    label: 'Devolución Final Contratista',
    shortLabel: 'Dev. Final Contr.',
    scope: 'CONTRATISTA',
    defaultCondition: 'VACIO',
    badge: 'bg-indigo-950/90 text-indigo-300 border-indigo-500/50'
  }
}

export const GAS_TRACEABILITY_COLUMNS = [
  { key: 'movement_date', label: 'Fecha', readOnly: false },
  { key: 'operation_type', label: 'Operación', readOnly: true },
  { key: 'remito_number', label: 'N° Remito', readOnly: false },
  { key: 'gas_name', label: 'Tipo de Gas', readOnly: true },
  { key: 'actor_display', label: 'Empresa / Contratista', readOnly: true },
  { key: 'condition_display', label: 'Estado Tubo', readOnly: false },
  { key: 'patio_impact', label: 'Impacto Patio / Deuda', readOnly: true },
  { key: 'quantity', label: 'Cant.', isNumeric: true, readOnly: false },
  { key: 'notes', label: 'Observaciones / Responsable', readOnly: false }
]

/**
 * Fuente única de verdad para identificar si un material corresponde al rubro Gases.
 */
export function isGasMaterial(material) {
  if (!material) return false
  const rubro = normalizeText(material.rubro)
  const category = normalizeText(material.category)
  const linkedRubro = normalizeText(material.material_rubros?.name)
  const gasRubroRegex = /\b(GAS|GASES)\b/
  if (
    gasRubroRegex.test(rubro) ||
    gasRubroRegex.test(category) ||
    gasRubroRegex.test(linkedRubro)
  ) {
    return true
  }
  if (!rubro && !linkedRubro) {
    const name = normalizeText(material.name)
    return /\b(GAS|OXIGENO|ACETILENO|ARGON|ATAL|PROPANO|NITROGENO|CO2)\b/.test(name)
  }
  return false
}

const GAS_TAG_REGEX = /\[Gas:[^\]]*\]\s*/gi

/**
 * Remueve la etiqueta técnica autogenerada `[Gas: ...]` de las notas para no duplicarla al editar.
 */
export function stripGasTagFromNotes(notes = '') {
  return String(notes || '').replace(GAS_TAG_REGEX, '').trim()
}

/**
 * Extrae operación y marcas desde la etiqueta `[Gas: ...]` como fallback para registros sin vínculo directo.
 */
export function parseGasInfoFromNotes(notes = '', suppliers = []) {
  const raw = String(notes || '')
  const match = raw.match(/\[Gas:\s*([^\]]+)\]/i)
  if (!match) return null

  const body = match[1]
  const isRecambio = /Recambio\s*1x1/i.test(body)
  const opType = isRecambio ? 'RECAMBIO_1X1' : 'PRIMERA_ENTREGA'

  const matchSupId = (namePart) => {
    const cleanTarget = normalizeText(namePart)
    if (!cleanTarget) return ''
    const found = (suppliers || []).find((s) => normalizeText(s.name) === cleanTarget)
    return found?.id || ''
  }

  let supplierDeliveredId = ''
  let supplierReturnedId = ''

  const entMatch = body.match(/Ent:\s*([^/\]]+)/i)
  if (entMatch) {
    supplierDeliveredId = matchSupId(entMatch[1])
  }
  const devMatch = body.match(/Dev:\s*([^/\]]+)/i)
  if (devMatch) {
    supplierReturnedId = matchSupId(devMatch[1])
  }

  return {
    gasOperationType: opType,
    supplierDeliveredId,
    supplierReturnedId
  }
}

/**
 * Localiza el registro en `gas_cylinder_movements` vinculado a una transacción de `inventory_transactions`.
 */
export function findLinkedGasMovement(tx, gasMovements = []) {
  if (!tx || !Array.isArray(gasMovements) || gasMovements.length === 0) return null

  const direct = gasMovements.find(
    (g) => g.inventory_transaction_id && String(g.inventory_transaction_id) === String(tx.id)
  )
  if (direct) return direct

  const txDay = String(tx.transaction_date || '').split('T')[0]
  const txContractor = normalizeText(tx.worker_name || tx.contractor_name)
  const txQty = Math.round(Number(tx.quantity_withdrawn) || 0)

  const candidates = gasMovements.filter((g) => {
    if (!['PRIMERA_ENTREGA', 'RECAMBIO_1X1'].includes(g.operation_type)) return false
    if (String(g.material_id || '') !== String(tx.material_id || '')) return false
    const gDay = String(g.movement_date || g.created_at || '').split('T')[0]
    if (txDay && gDay && txDay !== gDay) return false
    if (txQty > 0 && Number(g.quantity) !== txQty) return false
    if (txContractor && normalizeText(g.contractor_name) !== txContractor) return false
    return true
  })

  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]

  const cleanTxNotes = normalizeText(stripGasTagFromNotes(tx.notes))
  const exactNote = candidates.find((g) => normalizeText(g.notes) === normalizeText(tx.notes))
  if (exactNote) return exactNote
  const partialNote = candidates.find(
    (g) => cleanTxNotes && normalizeText(g.notes).includes(cleanTxNotes)
  )
  return partialNote || candidates[0]
}

/**
 * panolConstants.js
 * Centralización de constantes, definiciones de columnas y utilidades de cálculo
 * para el módulo de Pañol Central & Materiales (M4 - Logística Naval).
 */

// Insignias cromáticas para porcentaje de Seguridad Naval
export function getSecurityFactorBadge(factor) {
  const f = Number(factor) || 1.06
  if (f <= 1.02) {
    return { label: '2% (1.02)', style: 'bg-slate-800 text-slate-300 border-slate-700' }
  }
  if (Math.abs(f - 1.06) < 0.005) {
    return { label: '6% (1.06 Estándar)', style: 'bg-emerald-950 text-emerald-300 border-emerald-500/60 font-bold' }
  }
  if (Math.abs(f - 1.10) < 0.005) {
    return { label: '10% (1.10)', style: 'bg-amber-950 text-amber-300 border-amber-600' }
  }
  if (Math.abs(f - 1.15) < 0.005) {
    return { label: '15% (1.15)', style: 'bg-orange-950 text-orange-300 border-orange-600' }
  }
  return { label: `${Math.round((f - 1) * 100)}% (${f})`, style: 'bg-rose-950 text-rose-300 border-rose-600 font-bold' }
}

// Columnas para la grilla de retiros (useSpreadsheetGrid)
export const SPREADSHEET_COLUMNS_PANOL = [
  { key: 'transaction_date', label: 'Fecha', readOnly: false },
  { key: 'ship_id', label: 'Barco / Destino', readOnly: false },
  { key: 'work_order_id', label: 'Orden de Trabajo (OT)', readOnly: false },
  { key: 'material_id', label: 'Material Insumo', readOnly: false },
  { key: 'quantity_withdrawn', label: 'Cant.', isNumeric: true, readOnly: false },
  { key: 'weight_total', label: 'Peso (kg)', isNumeric: true, readOnly: false },
  { key: 'contractor_name', label: 'Operario / Contratista', readOnly: false },
  { key: 'cost_center', label: 'Centro de Costo', readOnly: false },
  { key: 'notes', label: 'Observaciones', readOnly: false }
]

// Columnas para la grilla de materiales (materialsGrid)
export const getMaterialsColumns = (isAdmin) => [
  { key: 'name', label: 'Material / Insumo', readOnly: false },
  { key: 'rubro', label: 'Rubro Técnico', readOnly: true },
  { key: 'category', label: 'Categoría', readOnly: true },
  { key: 'weight_kg', label: 'Peso Unit. (kg)', isNumeric: true, readOnly: false },
  { key: 'current_stock', label: 'Stock Actual', isNumeric: true, readOnly: true },
  { key: 'minimum_stock', label: 'Stock Mínimo', isNumeric: true, readOnly: false },
  { key: 'requires_stock_control', label: 'Lleva Stock Físico', readOnly: false },
  { key: 'security_factor', label: '% Seg. Naval', readOnly: !isAdmin }
]

// Campos permitidos para pegado y clonación de filas
export const PANOL_PASTE_FIELDS = [
  'ship_id',
  'work_order_id',
  'material_id',
  'quantity_withdrawn',
  'weight_total',
  'contractor_name',
  'worker_name',
  'worker_id',
  'cost_center',
  'notes'
]

export const MATERIALS_CLONE_FIELDS = [
  'name',
  'category',
  'rubro',
  'unit_measure',
  'weight_kg',
  'minimum_stock',
  'requires_stock_control',
  'security_factor',
  'location_bin',
  'description',
  'notes'
]

export const MATERIALS_PASTE_FIELDS = [
  'name',
  'category',
  'rubro',
  'unit_measure',
  'weight_kg',
  'minimum_stock',
  'requires_stock_control',
  'security_factor',
  'location_bin',
  'description',
  'notes'
]

// Comprobar si una fecha cae en el periodo de filtro seleccionado
export function isDateInFilterPeriod(dateStr, filterPeriod) {
  if (filterPeriod === 'TODOS') return true
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  if (filterPeriod === 'HOY') {
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    )
  }
  if (filterPeriod === 'QUINCENA') {
    if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false
    const day = d.getDate()
    const nowDay = now.getDate()
    const isQ1 = nowDay <= 15
    return isQ1 ? day <= 15 : day > 15
  }
  if (filterPeriod === 'MES') {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }
  return true
}

// Cálculo de estadísticas y balances de gases (P-01/P-02)
export function calculateGasStats(suppliers = [], gasMovements = [], materials = []) {
  const gasSuppliers = suppliers.filter((s) => s.is_gas_supplier)
  const patioStock = {}
  const supplierById = new Map((suppliers || []).map((s) => [s.id, s]))
  const materialById = new Map((materials || []).map((m) => [m.id, m]))

  const ensurePatioEntry = (supplierId) => {
    if (!supplierId) return null
    if (!patioStock[supplierId]) {
      const supObj = supplierById.get(supplierId)
      if (!supObj) return null
      patioStock[supplierId] = {
        full: 0,
        empty: 0,
        withContractors: 0,
        totalCompanyCylinders: 0,
        byGas: [],
        _gasMap: {},
        supplier: supObj
      }
    }
    return patioStock[supplierId]
  }

  const ensurePatioGasBucket = (supplierId, materialId) => {
    const entry = ensurePatioEntry(supplierId)
    if (!entry) return null
    const matKey = materialId || 'sin-mat'
    if (!entry._gasMap[matKey]) {
      const matObj = materialById.get(materialId)
      entry._gasMap[matKey] = {
        materialId: materialId || null,
        materialName: matObj?.name || 'Cilindro de Gas',
        full: 0,
        empty: 0,
        totalPatio: 0,
        withContractors: 0,
        totalCompanyCylinders: 0
      }
    }
    return { entry, bucket: entry._gasMap[matKey] }
  }

  gasSuppliers.forEach((s) => {
    ensurePatioEntry(s.id)
  })

  // Ordenar cronológicamente para calcular tenencia exacta por gas/marca sin desfasajes
  const chronological = [...(gasMovements || [])].sort((a, b) => {
    const da = new Date(a.movement_date || a.created_at || 0).getTime()
    const db = new Date(b.movement_date || b.created_at || 0).getTime()
    if (da !== db) return da - db
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
  })

  chronological.forEach((m) => {
    const supDelivered = m.supplier_delivered_id
    const supReturned = m.supplier_returned_id
    const q = Number(m.quantity) || 1
    const cond = String(m.cylinder_condition || '').toUpperCase()

    if (m.operation_type === 'PRIMERA_ENTREGA') {
      const target = ensurePatioGasBucket(supDelivered, m.material_id)
      if (target) {
        target.entry.full -= q
        target.bucket.full -= q
      }
    } else if (m.operation_type === 'RECAMBIO_1X1') {
      const delTarget = ensurePatioGasBucket(supDelivered, m.material_id)
      if (delTarget) {
        delTarget.entry.full -= q
        delTarget.bucket.full -= q
      }
      const retTarget = ensurePatioGasBucket(supReturned, m.material_id)
      if (retTarget) {
        retTarget.entry.empty += q
        retTarget.bucket.empty += q
      }
    } else if (m.operation_type === 'DEVOLUCION_FINAL') {
      const retTarget = ensurePatioGasBucket(supReturned, m.material_id)
      if (retTarget) {
        retTarget.entry.empty += q
        retTarget.bucket.empty += q
      }
    } else if (['AJUSTE_PATIO', 'SALDO_INICIAL_PATIO', 'INGRESO_PROVEEDOR'].includes(m.operation_type)) {
      const targetSupId = supDelivered || supReturned
      const target = ensurePatioGasBucket(targetSupId, m.material_id)
      if (target) {
        if (cond === 'VACIO') {
          target.entry.empty += q
          target.bucket.empty += q
        } else {
          target.entry.full += q
          target.bucket.full += q
        }
      }
    } else if (m.operation_type === 'DEVOLUCION_PROVEEDOR') {
      const targetSupId = supReturned || supDelivered
      const target = ensurePatioGasBucket(targetSupId, m.material_id)
      if (target) {
        if (cond === 'LLENO') {
          target.entry.full -= q
          target.bucket.full -= q
        } else {
          target.entry.empty -= q
          target.bucket.empty -= q
        }
      }
    }
  })

  // Calcular matriz de deuda, recambios por marca y tenencia exacta por contratista
  const now = new Date()
  const contractorDebts = {}
  const bucketsByContractor = {}
  const exchangesMapByContractor = {}

  const deductFromBuckets = (buckets, materialId, supplierId, qtyToDeduct) => {
    let remaining = qtyToDeduct
    const exactKey = `${materialId || 'sin-mat'}::${supplierId || 'sin-prov'}`
    if (buckets[exactKey]?.qty > 0) {
      const take = Math.min(remaining, buckets[exactKey].qty)
      buckets[exactKey].qty -= take
      remaining -= take
    }
    if (remaining > 0) {
      for (const b of Object.values(buckets)) {
        if (remaining <= 0) break
        if (b.qty > 0 && String(b.materialId || '') === String(materialId || '')) {
          const take = Math.min(remaining, b.qty)
          b.qty -= take
          remaining -= take
        }
      }
    }
    if (remaining > 0) {
      for (const b of Object.values(buckets)) {
        if (remaining <= 0) break
        if (b.qty > 0) {
          const take = Math.min(remaining, b.qty)
          b.qty -= take
          remaining -= take
        }
      }
    }
  }

  const addToBucket = (buckets, materialId, supplierId, qtyToAdd, mov) => {
    const key = `${materialId || 'sin-mat'}::${supplierId || 'sin-prov'}`
    const matObj = materialById.get(materialId)
    const supObj = supplierById.get(supplierId)
    const movTs = mov.movement_date || mov.created_at
    if (!buckets[key]) {
      buckets[key] = {
        key,
        materialId: materialId || null,
        materialName: matObj?.name || 'Cilindro de Gas',
        supplierId: supplierId || null,
        supplierName: supObj?.name || 'Marca sin especificar',
        qty: 0,
        oldestDate: movTs,
        lastDate: movTs,
        movements: []
      }
    }
    buckets[key].qty += qtyToAdd
    if (movTs && (!buckets[key].oldestDate || new Date(movTs) < new Date(buckets[key].oldestDate))) {
      buckets[key].oldestDate = movTs
    }
    if (movTs && (!buckets[key].lastDate || new Date(movTs) > new Date(buckets[key].lastDate))) {
      buckets[key].lastDate = movTs
    }
    buckets[key].movements.push(mov)
  }

  chronological.forEach((m) => {
    // Excluir movimientos directos con empresas gaseras para no contaminar la tabla de contratistas
    if (!GAS_CONTRACTOR_OPERATION_TYPES.includes(m.operation_type)) return

    const c = m.contractor_name || 'ALON CAR'
    if (!contractorDebts[c]) {
      contractorDebts[c] = {
        totalHeld: 0,
        exchangesCount: 0,
        exchangesByBrand: [],
        activeHoldings: [],
        movements: []
      }
      bucketsByContractor[c] = {}
      exchangesMapByContractor[c] = {}
    }

    const q = Number(m.quantity) || 1
    contractorDebts[c].movements.push(m)

    if (m.operation_type === 'PRIMERA_ENTREGA') {
      contractorDebts[c].totalHeld += q
      addToBucket(bucketsByContractor[c], m.material_id, m.supplier_delivered_id, q, m)
    } else if (m.operation_type === 'RECAMBIO_1X1') {
      // Regla inviolable: RECAMBIO_1X1 mantiene deuda neta en +0 (trajo 1 vacío, retiró 1 lleno)
      contractorDebts[c].exchangesCount += q

      const matObj = materialById.get(m.material_id)
      const supDel = supplierById.get(m.supplier_delivered_id)
      const supRet = supplierById.get(m.supplier_returned_id)
      const exKey = `${m.material_id || ''}::${m.supplier_delivered_id || ''}::${m.supplier_returned_id || ''}`
      if (!exchangesMapByContractor[c][exKey]) {
        exchangesMapByContractor[c][exKey] = {
          key: exKey,
          materialId: m.material_id || null,
          materialName: matObj?.name || 'Cilindro de Gas',
          deliveredSupplierId: m.supplier_delivered_id || null,
          deliveredSupplierName: supDel?.name || 'Marca entregada',
          returnedSupplierId: m.supplier_returned_id || null,
          returnedSupplierName: supRet?.name || 'Marca devuelta',
          qty: 0,
          lastDate: m.movement_date || m.created_at
        }
      }
      exchangesMapByContractor[c][exKey].qty += q
      exchangesMapByContractor[c][exKey].lastDate = m.movement_date || m.created_at

      // Si el contratista ya posee cilindros en poder, actualizar cruce de marcas conservando deuda neta exacta
      if (contractorDebts[c].totalHeld > 0) {
        const shiftQty = Math.min(q, contractorDebts[c].totalHeld)
        deductFromBuckets(bucketsByContractor[c], m.material_id, m.supplier_returned_id, shiftQty)
        addToBucket(bucketsByContractor[c], m.material_id, m.supplier_delivered_id, shiftQty, m)
      }
    } else if (m.operation_type === 'DEVOLUCION_FINAL') {
      contractorDebts[c].totalHeld = Math.max(0, contractorDebts[c].totalHeld - q)
      deductFromBuckets(bucketsByContractor[c], m.material_id, m.supplier_returned_id, q)
    }
  })

  // Alertas de retención mayor a 15 días (Regla P-01) y materialización de tenencia activa
  const longHeldContractors = []

  Object.entries(contractorDebts).forEach(([cName, data]) => {
    const holdings = Object.values(bucketsByContractor[cName] || {})
      .filter((b) => b.qty > 0)
      .map((b) => {
        const daysHeld = b.oldestDate
          ? Math.max(0, Math.floor((now - new Date(b.oldestDate)) / (1000 * 60 * 60 * 24)))
          : 0
        return { ...b, daysHeld }
      })

    data.activeHoldings = holdings
    data.exchangesByBrand = Object.values(exchangesMapByContractor[cName] || {})

    holdings.forEach((h) => {
      if (h.supplierId) {
        const target = ensurePatioGasBucket(h.supplierId, h.materialId)
        if (target) {
          target.entry.withContractors += h.qty
          target.bucket.withContractors += h.qty
        }
      }
    })

    if (data.totalHeld > 0) {
      data.movements
        .filter((mov) => mov.operation_type === 'PRIMERA_ENTREGA')
        .forEach((mov) => {
          const movDate = new Date(mov.movement_date || mov.created_at)
          const diffDays = Math.floor((now - movDate) / (1000 * 60 * 60 * 24))
          if (diffDays > 15) {
            longHeldContractors.push({
              contractor: cName,
              days: diffDays,
              movement: mov
            })
          }
        })
    }
  })

  let totalEmptyInPatio = 0
  Object.values(patioStock).forEach((p) => {
    if (p.empty > 0) totalEmptyInPatio += p.empty
    p.totalCompanyCylinders = p.full + p.empty + p.withContractors
    p.byGas = Object.values(p._gasMap || {})
      .map((g) => ({
        ...g,
        totalPatio: g.full + g.empty,
        totalCompanyCylinders: g.full + g.empty + g.withContractors
      }))
      .sort((a, b) => a.materialName.localeCompare(b.materialName))
    delete p._gasMap
  })

  return {
    patioStock,
    contractorDebts,
    longHeldContractors,
    totalEmptyInPatio
  }
}

/**
 * Construye filas normalizadas para la Tabla Cronológica de Trazabilidad de Tubos (Control de Gases).
 */
export function buildGasTraceabilityRows(
  gasMovements = [],
  { suppliers = [], materials = [], ships = [], workOrders = [] } = {}
) {
  const supplierById = new Map((suppliers || []).map((s) => [s.id, s]))
  const materialById = new Map((materials || []).map((m) => [m.id, m]))
  const shipById = new Map((ships || []).map((s) => [s.id, s]))
  const woById = new Map((workOrders || []).map((w) => [w.id, w]))

  return [...(gasMovements || [])]
    .sort((a, b) => {
      const da = new Date(b.movement_date || b.created_at || 0).getTime()
      const db = new Date(a.movement_date || a.created_at || 0).getTime()
      if (da !== db) return da - db
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    })
    .map((m) => {
      const meta = GAS_OPERATION_META[m.operation_type] || {
        label: m.operation_type || 'Movimiento',
        shortLabel: m.operation_type || 'Movimiento',
        scope: 'CONTRATISTA',
        defaultCondition: 'LLENO',
        badge: 'bg-slate-800 text-slate-300 border-slate-600'
      }
      const mat = materialById.get(m.material_id)
      const supDel = supplierById.get(m.supplier_delivered_id)
      const supRet = supplierById.get(m.supplier_returned_id)
      const ship = shipById.get(m.ship_id)
      const wo = woById.get(m.work_order_id)
      const q = Number(m.quantity) || 1
      const cond = String(m.cylinder_condition || meta.defaultCondition || 'LLENO').toUpperCase()
      const isSupplierOp = meta.scope === 'PROVEEDOR'

      const primarySupplier = supDel || supRet
      let supplierDisplay = primarySupplier?.name || 'Sin marca'
      if (m.operation_type === 'RECAMBIO_1X1') {
        const dName = supDel?.name || '—'
        const rName = supRet?.name || '—'
        supplierDisplay = dName === rName ? dName : `Ent: ${dName} / Dev: ${rName}`
      }

      const actorDisplay = isSupplierOp
        ? supplierDisplay
        : `${m.contractor_name || 'ALON CAR'} (${supplierDisplay})`

      let conditionDisplay = cond
      if (m.operation_type === 'RECAMBIO_1X1') conditionDisplay = 'VACÍO ⇄ LLENO'
      else if (m.operation_type === 'PRIMERA_ENTREGA') conditionDisplay = 'LLENO'
      else if (m.operation_type === 'DEVOLUCION_FINAL') conditionDisplay = 'VACIO'

      let patioImpact = ''
      if (m.operation_type === 'SALDO_INICIAL_PATIO' || m.operation_type === 'INGRESO_PROVEEDOR' || m.operation_type === 'AJUSTE_PATIO') {
        patioImpact = `+${q} ${cond === 'VACIO' ? 'Vacío(s)' : 'Lleno(s)'} en patio`
      } else if (m.operation_type === 'DEVOLUCION_PROVEEDOR') {
        patioImpact = `-${q} ${cond === 'LLENO' ? 'Lleno(s)' : 'Vacío(s)'} devuelto(s) a gasera`
      } else if (m.operation_type === 'PRIMERA_ENTREGA') {
        patioImpact = `-${q} Lleno(s) patio (+${q} en contratista)`
      } else if (m.operation_type === 'RECAMBIO_1X1') {
        patioImpact = `-${q} Lleno(s) / +${q} Vacío(s) (Deuda +0)`
      } else if (m.operation_type === 'DEVOLUCION_FINAL') {
        patioImpact = `+${q} Vacío(s) patio (-${q} en contratista)`
      }

      const shipLabel = ship?.name || ''
      const otLabel = wo?.ot_number ? `OT #${wo.ot_number}` : ''

      return {
        ...m,
        opMeta: meta,
        isSupplierOp,
        gas_name: mat?.name || 'Cilindro de Gas',
        primary_supplier_id: primarySupplier?.id || null,
        delivered_supplier_name: supDel?.name || '',
        returned_supplier_name: supRet?.name || '',
        supplier_display: supplierDisplay,
        actor_display: actorDisplay,
        ship_name: shipLabel,
        ot_label: otLabel,
        condition_code: cond,
        condition_display: conditionDisplay,
        patio_impact: patioImpact,
        date_only: String(m.movement_date || m.created_at || '').split('T')[0],
        is_linked_to_panol_tx: Boolean(m.inventory_transaction_id)
      }
    })
}

// Cálculo del Radar de KPIs de Pañol
export function calculatePanolKpis(materials = [], inventoryTx = [], gasStats = {}) {
  const todayStr = new Date().toISOString().split('T')[0]
  let criticalCount = 0
  materials.forEach((m) => {
    const c = Number(m.current_stock) || 0
    const min = Number(m.minimum_stock) || 0
    if (c <= min) criticalCount++
  })

  let todayTxCount = 0
  let sinOtCount = 0
  let deletionRequestsCount = 0

  inventoryTx.forEach((t) => {
    const d = String(t.transaction_date).split('T')[0]
    if (d === todayStr) todayTxCount++
    if (!t.work_order_id) sinOtCount++
    if (t.is_deletion_requested) deletionRequestsCount++
  })

  return {
    criticalCount,
    todayTxCount,
    sinOtCount,
    deletionRequestsCount,
    emptyCylinders: gasStats.totalEmptyInPatio || 0,
    longHeldGases: (gasStats.longHeldContractors || []).length
  }
}

// Agregaciones globales para la barra de estado
export function calculatePanolTotals(filteredTransactions = []) {
  let totalQty = 0
  let totalKg = 0
  filteredTransactions.forEach((tx) => {
    totalQty += Number(tx.quantity_withdrawn) || 0
    totalKg += Number(tx.weight_total) || 0
  })
  return { totalQty, totalKg }
}

// getEnabledWorkersAndContractors y getShipEnabledContractors re-exportados desde allocationEngine.js (Fuente Única)

// Tooltip enriquecido para celdas de Orden de Trabajo (Delega al formateador canónico multi-línea)
export function formatWorkOrderTooltip(wo, ship, workItems = [], allWorkOrders = []) {
  return formatWorkOrderTooltipCanonical(wo, ship, workItems, allWorkOrders)
}

export function filterPanolTransactions(inventoryTx = [], {
  activeKpiFilter,
  filterPeriod,
  filterShip,
  filterCategory,
  searchQuery,
  materials = [],
  ships = [],
  workOrders = []
}) {
  return inventoryTx.filter((t) => {
    if (activeKpiFilter === 'sin_ot' && t.work_order_id) return false
    if (activeKpiFilter === 'hoy' && String(t.transaction_date).split('T')[0] !== new Date().toISOString().split('T')[0]) return false
    if (activeKpiFilter === 'bajas_pendientes' && !t.is_deletion_requested) return false
    if (!isDateInFilterPeriod(t.transaction_date, filterPeriod)) return false
    if (filterShip !== 'TODOS' && t.ship_id !== filterShip) return false
    const mat = materials.find((m) => m.id === t.material_id)
    if (filterCategory !== 'TODAS') {
      if (!mat) return false
      if (filterCategory === 'GASES') {
        if (mat.rubro !== 'GASES' && mat.category !== 'GASES') return false
      } else if (mat.category !== filterCategory) return false
    }
    if (searchQuery && searchQuery.trim()) {
      const ship = ships.find((s) => s.id === t.ship_id)
      const wo = workOrders.find((w) => w.id === t.work_order_id)
      return matchesUniversalSearch(t, searchQuery, {
        ship_name: ship?.name || '', work_order_title: wo?.title || '', work_order_description: wo?.description || '',
        ot_number: wo?.ot_number || '', material_name: mat?.name || '', worker_name: t.worker_name || '', contractor_name: t.contractor_name || ''
      })
    }
    return true
  })
}

export function filterPanolMaterials(materials = [], {
  activeKpiFilter,
  filterStockOnly,
  filterCategory,
  searchQuery
}) {
  return materials.filter((m) => {
    if (activeKpiFilter === 'critico' && (Number(m.current_stock) || 0) > (Number(m.minimum_stock) || 0)) return false
    if (filterStockOnly && !m.requires_stock_control) return false
    if (filterCategory !== 'TODAS') {
      if (filterCategory === 'GASES') {
        if (m.rubro !== 'GASES' && m.category !== 'GASES') return false
      } else if (m.category !== filterCategory) return false
    }
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      return (m.name || '').toLowerCase().includes(q) || (m.rubro || '').toLowerCase().includes(q) || (m.category || '').toLowerCase().includes(q)
    }
    return true
  })
}
