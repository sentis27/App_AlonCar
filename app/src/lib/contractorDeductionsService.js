/**
 * contractorDeductionsService.js
 * Servicio de datos para Tesorería (Graciela) y Alertas Contractuales (María José).
 * Cumple Candado Mecánico #3 (Cero SQL en Vista) y usa workCostRules.js como fuente única de verdad.
 */

import { supabase } from './supabase.js'
import { classifyWithdrawalCost, computeContractExpiration } from './workCostRules.js'
import { logRowAction } from './auditService.js'

/**
 * Convierte una clave de quincena ("YYYY-MM-1Q" | "YYYY-MM-2Q") en rango ISO [startIso, endIso].
 */
export function getQuincenaDateRange(periodKey) {
  const m = String(periodKey || '').match(/^(\d{4})-(\d{2})-(1Q|2Q)$/i)
  if (!m) {
    const now = new Date()
    const y = now.getFullYear()
    const mo = String(now.getMonth() + 1).padStart(2, '0')
    const q = now.getDate() <= 15 ? '1Q' : '2Q'
    return getQuincenaDateRange(`${y}-${mo}-${q}`)
  }

  const year = Number(m[1])
  const month = Number(m[2])
  const q = m[3].toUpperCase()
  const mm = String(month).padStart(2, '0')

  if (q === '1Q') {
    return {
      periodKey: `${year}-${mm}-1Q`,
      year,
      month,
      quincena: 1,
      startIso: `${year}-${mm}-01T00:00:00.000Z`,
      endIso: `${year}-${mm}-15T23:59:59.999Z`,
      startDate: `${year}-${mm}-01`,
      endDate: `${year}-${mm}-15`
    }
  }

  const lastDay = new Date(year, month, 0).getDate()
  return {
    periodKey: `${year}-${mm}-2Q`,
    year,
    month,
    quincena: 2,
    startIso: `${year}-${mm}-16T00:00:00.000Z`,
    endIso: `${year}-${mm}-${String(lastDay).padStart(2, '0')}T23:59:59.999Z`,
    startDate: `${year}-${mm}-16`,
    endDate: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`
  }
}

export function getCurrentQuincenaKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const q = date.getDate() <= 15 ? '1Q' : '2Q'
  return `${y}-${m}-${q}`
}

function normalizeKey(str) {
  return String(str || '').trim().toUpperCase()
}

/**
 * Busca el worker correspondiente a una transacción de Pañol (por worker_id o nombre/grupo).
 */
export function matchTransactionWorker(tx, workers = []) {
  if (tx?.worker_id) {
    const byId = workers.find((w) => w.id === tx.worker_id)
    if (byId) return byId
  }
  const targetName = normalizeKey(tx?.worker_name || tx?.contractor_name)
  if (!targetName || targetName === 'SIN ASIGNAR') return null

  return (
    workers.find((w) => normalizeKey(w.name) === targetName) ||
    workers.find((w) => normalizeKey(w.work_group) === targetName) ||
    null
  )
}

/**
 * Motor puro: agrupa extracciones de Pañol en:
 * - deductibleRows: Consumibles y Elementos de Seguridad descontables a contratistas.
 * - exemptedGrayZoneRows: Retiros de EPP excluidos automáticamente por zona gris (safety_items = 'ASTILLERO') o nómina propia.
 * - summaryByContractor: Consolidado listo para Graciela (Tesorería).
 */
export function evaluateContractorDeductions({
  transactions = [],
  materials = [],
  workers = [],
  ships = [],
  workOrders = []
}) {
  const matMap = new Map(materials.map((m) => [m.id, m]))
  const shipMap = new Map(ships.map((s) => [s.id, s]))
  const woMap = new Map(workOrders.map((o) => [o.id, o]))

  const deductibleRows = []
  const exemptedGrayZoneRows = []
  const summaryMap = new Map()

  for (const tx of transactions) {
    const mat = matMap.get(tx.material_id) || null
    const worker = matchTransactionWorker(tx, workers)
    const classification = classifyWithdrawalCost({ material: mat, transaction: tx, worker })

    const ship = shipMap.get(tx.ship_id)
    const wo = woMap.get(tx.work_order_id)
    const contractorLabel = worker
      ? (worker.admin_center === 'ASTILLERO' ? worker.name : (worker.work_group || worker.name))
      : (tx.contractor_name || tx.worker_name || 'Sin asignar')

    const baseRow = {
      id: tx.id,
      date: tx.transaction_date ? String(tx.transaction_date).slice(0, 10) : '',
      contractorLabel,
      workerName: worker?.name || tx.worker_name || tx.contractor_name || 'Sin asignar',
      adminCenter: worker?.admin_center || 'CONTRATISTA',
      safetyCenter: worker?.safety_items || 'CONTRATISTA',
      materialName: mat?.name || 'Insumo sin asignar',
      category: mat?.category || (tx.movement_type === 'ENTREGA_EPP' ? 'ELEM.SEGURIDAD' : 'SIN CATEGORÍA'),
      quantity: Number(tx.quantity_withdrawn || 0),
      unitMeasure: mat?.unit_measure || 'un.',
      shipName: ship?.name || (tx.ship_id ? 'Buque' : 'ASTILLERO / PAÑOL'),
      otLabel: wo ? `${wo.ot_number} · ${wo.title}` : 'Sin OT',
      classification,
      notes: tx.notes || ''
    }

    if (classification.referenceOnly) {
      exemptedGrayZoneRows.push(baseRow)
      continue
    }

    if (!classification.deductibleToContractor) {
      continue
    }

    deductibleRows.push(baseRow)

    const aggKey = normalizeKey(contractorLabel)
    if (!summaryMap.has(aggKey)) {
      summaryMap.set(aggKey, {
        contractorLabel,
        adminCenter: baseRow.adminCenter,
        safetyCenter: baseRow.safetyCenter,
        consumablesCount: 0,
        safetyCount: 0,
        consumablesArs: 0,
        consumablesUsd: 0,
        safetyArs: 0,
        safetyUsd: 0,
        totalDeductArs: 0,
        totalDeductUsd: 0,
        items: []
      })
    }

    const agg = summaryMap.get(aggKey)
    if (classification.bucket === 'SAFETY_CONTRACTOR_DEDUCTION') {
      agg.safetyCount += 1
      agg.safetyArs = Number((agg.safetyArs + classification.deductArs).toFixed(2))
      agg.safetyUsd = Number((agg.safetyUsd + classification.deductUsd).toFixed(2))
    } else {
      agg.consumablesCount += 1
      agg.consumablesArs = Number((agg.consumablesArs + classification.deductArs).toFixed(2))
      agg.consumablesUsd = Number((agg.consumablesUsd + classification.deductUsd).toFixed(2))
    }
    agg.totalDeductArs = Number((agg.totalDeductArs + classification.deductArs).toFixed(2))
    agg.totalDeductUsd = Number((agg.totalDeductUsd + classification.deductUsd).toFixed(2))
    agg.items.push(baseRow)
  }

  const summaryByContractor = Array.from(summaryMap.values()).sort((a, b) =>
    a.contractorLabel.localeCompare(b.contractorLabel)
  )

  return {
    deductibleRows,
    exemptedGrayZoneRows,
    summaryByContractor,
    totals: {
      contractorsCount: summaryByContractor.length,
      deductibleItemsCount: deductibleRows.length,
      exemptedGrayZoneCount: exemptedGrayZoneRows.length,
      totalDeductArs: Number(summaryByContractor.reduce((s, r) => s + r.totalDeductArs, 0).toFixed(2)),
      totalDeductUsd: Number(summaryByContractor.reduce((s, r) => s + r.totalDeductUsd, 0).toFixed(2)),
      totalReferenceExemptUsd: Number(exemptedGrayZoneRows.reduce((s, r) => s + r.classification.referenceUsd, 0).toFixed(2))
    }
  }
}

/**
 * Carga todos los retiros de la quincena elegida y los períodos disponibles para Tesorería (Graciela).
 */
export async function fetchContractorDeductionsForPeriod(periodKey) {
  const range = getQuincenaDateRange(periodKey)

  const [txRes, matRes, workersRes, shipsRes, woRes, periodsRes] = await Promise.all([
    supabase
      .from('inventory_transactions')
      .select('*')
      .gte('transaction_date', range.startIso)
      .lte('transaction_date', range.endIso)
      .order('transaction_date', { ascending: false }),
    supabase.from('materials').select('id, name, category, rubro, unit_measure, cost_ars, cost_usd'),
    supabase.from('workers').select('id, name, admin_center, work_group, safety_items, consumables, consumables_discount_pct, status'),
    supabase.from('ships').select('id, name'),
    supabase.from('work_orders').select('id, ot_number, title'),
    supabase.from('rate_cards').select('period, year, month, quincena').order('year', { ascending: false }).order('month', { ascending: false }).order('quincena', { ascending: false }).limit(200)
  ])

  if (txRes.error) throw txRes.error

  const uniquePeriods = Array.from(new Set([
    getCurrentQuincenaKey(),
    range.periodKey,
    ...(periodsRes.data || []).map((r) => r.period).filter(Boolean)
  ])).sort((a, b) => b.localeCompare(a))

  const evaluated = evaluateContractorDeductions({
    transactions: txRes.data || [],
    materials: matRes.data || [],
    workers: workersRes.data || [],
    ships: shipsRes.data || [],
    workOrders: woRes.data || []
  })

  return {
    range,
    availablePeriods: uniquePeriods,
    ...evaluated
  }
}

/**
 * Sincroniza automáticamente alertas de contratos próximos a vencer (<= 7 días) para María José.
 */
export async function syncContractExpiryAlertsService(workers = []) {
  try {
    const { data: reqRow, error: reqErr } = await supabase
      .from('data_requirements')
      .select('id, default_notice_time, default_notice_frequency, max_attempts')
      .eq('code', 'REQ_PERSONAL_CONTRATO_POR_VENCER')
      .maybeSingle()

    if (reqErr || !reqRow?.id) return { created: 0, resolved: 0 }

    const { data: pendingAlerts } = await supabase
      .from('compliance_alerts')
      .select('*')
      .eq('requirement_id', reqRow.id)
      .eq('status', 'PENDIENTE')

    const pendingByWorkerId = new Map((pendingAlerts || []).map((a) => [a.entity_id, a]))
    const activeWarningWorkerIds = new Set()
    let created = 0
    let resolved = 0

    for (const w of workers) {
      if (w.status !== 'ACTIVO' || w.admin_center !== 'ASTILLERO') continue
      const exp = computeContractExpiration(w.contract_type, w.contract_start_date)
      if (!exp.needsAttention || !exp.expiresIso) continue

      activeWarningWorkerIds.add(w.id)
      if (!pendingByWorkerId.has(w.id)) {
        const msg = exp.daysRemaining < 0
          ? `Contrato VENCIDO (${exp.contractType}) de ${w.name} — venció el ${exp.expiresIso}. Definir renovación o pase a planta.`
          : `Contrato por vencer en ${exp.daysRemaining} día(s) (${exp.contractType}) de ${w.name} — vence el ${exp.expiresIso}.`

        const { error: insErr } = await supabase.from('compliance_alerts').insert([{
          requirement_id: reqRow.id,
          ship_id: null,
          entity_type: 'workers',
          entity_id: w.id,
          responsible_worker_id: w.id,
          responsible_role: 'maria_jose',
          notice_time: reqRow.default_notice_time || '09:00:00',
          notice_frequency: reqRow.default_notice_frequency || 'DIARIO',
          max_attempts: reqRow.max_attempts || 5,
          status: 'PENDIENTE',
          alert_message: msg
        }])
        if (!insErr) created += 1
      }
    }

    for (const alert of pendingAlerts || []) {
      if (!activeWarningWorkerIds.has(alert.entity_id)) {
        const { error: updErr } = await supabase
          .from('compliance_alerts')
          .update({
            status: 'COMPLETADO',
            completed_at: new Date().toISOString(),
            completed_by: 'Sistema (Contrato actualizado / inactivo)'
          })
          .eq('id', alert.id)
        if (!updErr) resolved += 1
      }
    }

    return { created, resolved }
  } catch (err) {
    console.warn('No se pudo sincronizar alertas de vencimiento de contrato:', err?.message)
    return { created: 0, resolved: 0 }
  }
}

/**
 * Resuelve la alerta contractual desde el Dashboard de María José al renovar o pasar a PERMANENTE.
 */
export async function resolveContractAlertService({ alertItem, nextContractType, nextStartDate, user, userName }) {
  const normalizedType = String(nextContractType || '').toUpperCase()
  const patch = {
    contract_type: normalizedType,
    contract_start_date: nextStartDate || new Date().toISOString().slice(0, 10)
  }

  const { error: wErr } = await supabase
    .from('workers')
    .update(patch)
    .eq('id', alertItem.entity_id)
  if (wErr) throw wErr

  const { error: alErr } = await supabase
    .from('compliance_alerts')
    .update({
      status: 'COMPLETADO',
      completed_at: new Date().toISOString(),
      completed_by: userName || user?.email || 'María José'
    })
    .eq('id', alertItem.id)
  if (alErr) throw alErr

  logRowAction({
    action: 'CONTRACT_RENEWED',
    entityType: 'workers',
    entityId: alertItem.entity_id,
    entityName: alertItem.workers?.name || 'Operario Astillero',
    rowData: patch,
    sheetName: 'Personal · Contratos Astillero',
    moduleRoute: '/',
    changeOrigin: 'MARIA_JOSE_DASHBOARD',
    user: user?.email || userName
  })

  return patch
}

/**
 * Sincroniza (opcional) y obtiene las alertas contractuales pendientes (<= 7 días) para María José.
 */
export async function fetchPendingContractAlertsForMariaService({ syncFirst = true } = {}) {
  if (syncFirst) {
    try {
      const { data: astWorkers } = await supabase
        .from('workers')
        .select('id, name, admin_center, status, contract_type, contract_start_date')
        .eq('admin_center', 'ASTILLERO')
        .eq('status', 'ACTIVO')
      if (astWorkers && astWorkers.length > 0) {
        await syncContractExpiryAlertsService(astWorkers)
      }
    } catch {
      // Si la migración 0037 aún no se corrió, contract_type no existe todavía; degradar sin romper.
    }
  }

  let { data, error } = await supabase
    .from('compliance_alerts')
    .select('*, workers(id, name, contract_type, contract_start_date)')
    .eq('entity_type', 'workers')
    .eq('responsible_role', 'maria_jose')
    .eq('status', 'PENDIENTE')
    .order('created_at', { ascending: false })

  if (error && (error.code === '42703' || String(error.message || '').includes('contract_'))) {
    const fallback = await supabase
      .from('compliance_alerts')
      .select('*, workers(id, name)')
      .eq('entity_type', 'workers')
      .eq('responsible_role', 'maria_jose')
      .eq('status', 'PENDIENTE')
      .order('created_at', { ascending: false })
    data = fallback.data
    error = fallback.error
  }

  if (error) throw error
  return data || []
}

