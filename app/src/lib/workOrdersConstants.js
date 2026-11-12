/**
 * workOrdersConstants.js
 * Constantes canónicas, definiciones de columnas y utilidades de cálculo
 * para el módulo de Órdenes de Trabajo y Catálogo (M6 / GS-003).
 */

import { matchesUniversalSearch } from './searchEngine.js'
import { assignMonotonicFolios } from './monotonicFolioEngine.js'

// Grupos del Catálogo de Trabajos (OT.ABC)
export const GRUPOS_CATALOGO = ['Renovación', 'Intermediaria']

// 8 Estados Oficiales del Ciclo de Vida de un Trabajo (GS-003 UNIFICADO)
export const ESTADOS_TRABAJO = [
  {
    value: 'Pendiente de inicio',
    label: 'Pendiente de inicio',
    color: 'text-amber-300 bg-amber-950/80 border-amber-600/80',
    dot: 'bg-amber-400'
  },
  {
    value: 'En ejecución',
    label: 'En ejecución (Habilitado p/ Costos)',
    color: 'text-emerald-300 bg-emerald-950/80 border-emerald-500/80',
    dot: 'bg-emerald-400'
  },
  {
    value: 'Finalizado',
    label: 'Finalizado',
    color: 'text-cyan-300 bg-cyan-950/80 border-cyan-600/80',
    dot: 'bg-cyan-400'
  },
  {
    value: 'Pendiente remito',
    label: 'Pendiente remito',
    color: 'text-blue-300 bg-blue-950/80 border-blue-600/80',
    dot: 'bg-blue-400'
  },
  {
    value: 'Remito realizado/Pdte firma',
    label: 'Remito realizado/Pdte firma',
    color: 'text-indigo-300 bg-indigo-950/80 border-indigo-500/80',
    dot: 'bg-indigo-400'
  },
  {
    value: 'Finalizado costo final de obra',
    label: 'Finalizado costo final de obra',
    color: 'text-teal-300 bg-teal-950/80 border-teal-600/80',
    dot: 'bg-teal-400'
  },
  {
    value: 'Facturado',
    label: 'Facturado - CERRADO',
    color: 'text-purple-300 bg-purple-950/80 border-purple-500/80',
    dot: 'bg-purple-400'
  },
  {
    value: 'Desestimado',
    label: 'Desestimado',
    color: 'text-rose-300 bg-rose-950/80 border-rose-700/80',
    dot: 'bg-rose-400'
  }
]

// Tipos de Trabajo (Columna W de GS-003)
export const TIPOS_DE_TRABAJO = [
  { value: 'HORA', label: 'Hora (Mano de Obra Directa)' },
  { value: 'PRESUPUESTO', label: 'Presupuesto (Ajuste Alzado / PRC)' },
  { value: 'CONTROL', label: 'Control (Inspección / Seguimiento)' }
]

// Campos clonables al duplicar un trabajo
export const WORK_ITEM_CLONE_FIELDS = [
  'work_order_id',
  'description',
  'status',
  'foreman_name',
  'work_type',
  'assignment_type',
  'contractors'
]

// Columnas de la Planilla Unificada de OTs (Modo Hoja de Cálculo)
export const WO_GRID_COLUMNS = [
  { key: 'ship_id', label: 'Barco' },
  { key: 'ot_number', label: 'Orden de Trabajo' },
  { key: 'description', label: 'Descripción del Trabajo' },
  { key: 'contractors', label: 'Contratistas' },
  { key: 'foreman_name', label: 'Jefe de Obra' },
  { key: 'work_type', label: 'Tipo de Trabajo' },
  { key: 'status', label: 'Estado del Trabajo' }
]

// Formatear fecha YYYY-MM-DD a DD/MM/AA o DD/MM/AAAA
export function formatShortDate(isoStr, fullYear = false) {
  if (!isoStr) return '—'
  const clean = String(isoStr).split('T')[0]
  const parts = clean.split('-')
  if (parts.length !== 3) return clean
  const [y, m, d] = parts
  return fullYear ? `${d}/${m}/${y}` : `${d}/${m}/${y.slice(-2)}`
}

// Determina si un trabajo u OT fue desestimado por eliminación (sin borrar el registro físico para no alterar el consecutivo)
export function isWorkItemEliminada(item, wo) {
  if (item?.status !== 'Desestimado' && wo?.status !== 'Cancelada') return false
  const commentText = String(item?.comments || '').toUpperCase()
  const notesText = String(wo?.notes || '').toUpperCase()
  return commentText.includes('ELIMINADA') || notesText.includes('[ELIMINADA]')
}

// Limpia la etiqueta interna [ELIMINADA] del comentario visible para mostrarla como leyenda dedicada
export function cleanWorkItemComment(comment) {
  if (!comment) return ''
  return String(comment)
    .replace(/\[ELIMINADA\]\s*Desestimada por eliminación\s*\|?\s*/gi, '')
    .replace(/\|\s*\[ELIMINADA\]\s*Desestimada por eliminación/gi, '')
    .replace(/\[ELIMINADA\]/gi, '')
    .trim()
}

// Cálculo automático del estado de la OT (Contenedor) a partir de sus trabajos hijos (work_items)
export function computeOtState(wo, items = []) {
  const isDeletedWo =
    (wo?.notes || '').toUpperCase().includes('[ELIMINADA]') ||
    (items.length > 0 && items.every(i => i.status === 'Desestimado' && isWorkItemEliminada(i, wo)))

  if (!items || items.length === 0) {
    if (isDeletedWo || wo?.status === 'Cancelada') {
      return {
        label: 'Desestimado (Eliminada)',
        color: 'text-rose-300 bg-rose-950/80 border-rose-700',
        canClose: true,
        activeCount: 0,
        totalCount: 0,
        isEliminada: true
      }
    }
    return {
      label: 'Sin trabajos cargados',
      color: 'text-slate-400 bg-slate-900 border-slate-700',
      canClose: true,
      activeCount: 0,
      totalCount: 0,
      isEliminada: false
    }
  }

  const validItems = items.filter(i => i.status !== 'Desestimado')
  if (validItems.length === 0) {
    return {
      label: isDeletedWo ? 'Desestimado (Eliminada)' : 'Desestimada',
      color: 'text-rose-300 bg-rose-950/80 border-rose-700',
      canClose: true,
      activeCount: 0,
      totalCount: items.length,
      isEliminada: isDeletedWo
    }
  }

  const inExecutionCount = validItems.filter(i => i.status === 'En ejecución').length
  const pendingStartCount = validItems.filter(i => i.status === 'Pendiente de inicio').length
  const billedCount = validItems.filter(i => i.status === 'Facturado').length

  if (inExecutionCount > 0) {
    return {
      label: `En ejecución (${inExecutionCount}/${validItems.length} act.)`,
      color: 'text-emerald-300 bg-emerald-950/80 border-emerald-500/80',
      canClose: false,
      activeCount: inExecutionCount,
      totalCount: items.length,
      isEliminada: false
    }
  }

  if (billedCount === validItems.length) {
    return {
      label: wo?.allow_post_billing_costs ? 'Facturada (Abierta Arrastre)' : 'Facturada - CERRADA',
      color: 'text-purple-300 bg-purple-950/80 border-purple-500/80',
      canClose: true,
      activeCount: 0,
      totalCount: items.length,
      isEliminada: false
    }
  }

  if (pendingStartCount === validItems.length) {
    return {
      label: 'Pendiente de inicio',
      color: 'text-amber-300 bg-amber-950/80 border-amber-600/80',
      canClose: false,
      activeCount: 0,
      totalCount: items.length,
      isEliminada: false
    }
  }

  return {
    label: 'Trabajos Finalizados (Lista p/ Cierre)',
    color: 'text-cyan-300 bg-cyan-950/80 border-cyan-500/80',
    canClose: true,
    activeCount: 0,
    totalCount: items.length,
    isEliminada: false
  }
}

// Evaluación de Alertas automáticas por trabajo (Columnas N, O, P de GS-003)
export function evaluateWorkItemAlerts(item, wo) {
  const alerts = []
  if (!wo?.title?.trim() && item.description?.trim() && item.status === 'En ejecución') {
    alerts.push({ code: 'S/OT', label: 'Falta nombre de OT', color: 'bg-rose-950 text-rose-300 border-rose-700' })
  }
  if (wo?.title?.trim() && item.status !== 'Desestimado' && !item.description?.trim()) {
    alerts.push({ code: 'S/DESCRPCN', label: 'Falta descripción del trabajo', color: 'bg-amber-950 text-amber-300 border-amber-700' })
  }
  const hasContractors = Array.isArray(item.contractors) && item.contractors.length > 0
  if (wo?.title?.trim() && item.status !== 'Desestimado' && item.description?.trim() && !hasContractors) {
    alerts.push({ code: 'S/CONTRATISTA', label: 'Falta asignar contratista', color: 'bg-orange-950 text-orange-300 border-orange-700' })
  }
  return alerts
}

// Cálculo de métricas y las 3 fechas de cada OT (Creación, Inicio y Fin)
export function computeOtMetricsAndDates(workOrders = [], laborLogs = [], inventoryTx = [], thirdPartyServices = []) {
  const map = {}

  workOrders.forEach(wo => {
    const createdIso = wo.created_at
      ? String(wo.created_at).split('T')[0]
      : (wo.start_date || new Date().toISOString().split('T')[0])

    map[wo.id] = {
      totalHours: 0,
      normalHours: 0,
      extra50: 0,
      extra100: 0,
      workerSet: new Set(),
      createdDate: createdIso,
      events: []
    }
  })

  // 1. Eventos desde Horas (labor_logs)
  laborLogs.forEach(log => {
    const woId = log.work_order_id
    if (!woId || !map[woId]) return
    map[woId].totalHours += parseFloat(log.hours_worked) || 0
    map[woId].normalHours += parseFloat(log.hours_normal) || 0
    map[woId].extra50 += parseFloat(log.hours_extra_50) || 0
    map[woId].extra100 += parseFloat(log.hours_extra_100) || 0
    if (log.worker_name) map[woId].workerSet.add(log.worker_name)
    if (log.date_logged) {
      map[woId].events.push({
        date: String(log.date_logged).split('T')[0],
        source: 'Horas'
      })
    }
  })

  // 2. Eventos desde Materiales / Pañol (inventory_transactions)
  inventoryTx.forEach(tx => {
    const woId = tx.work_order_id
    if (!woId || !map[woId]) return
    if (tx.transaction_date) {
      map[woId].events.push({
        date: String(tx.transaction_date).split('T')[0],
        source: 'Materiales'
      })
    }
  })

  // 3. Eventos desde Terceros (third_party_services)
  thirdPartyServices.forEach(tp => {
    const woId = tp.work_order_id
    if (!woId || !map[woId]) return
    const tpDate = tp.service_date || (tp.created_at ? String(tp.created_at).split('T')[0] : null)
    if (tpDate) {
      map[woId].events.push({
        date: tpDate,
        source: 'Terceros'
      })
    }
  })

  // Calcular Fecha de Inicio (MIN) y Fecha Final (MAX) para cada OT
  Object.values(map).forEach(entry => {
    if (entry.events.length === 0) {
      entry.startDate = null
      entry.startSource = null
      entry.endDate = null
      entry.endSource = null
    } else {
      const sorted = [...entry.events].sort((a, b) => a.date.localeCompare(b.date))
      entry.startDate = sorted[0].date
      entry.startSource = sorted[0].source
      entry.endDate = sorted[sorted.length - 1].date
      entry.endSource = sorted[sorted.length - 1].source
    }
  })

  return map
}

// Calcular el siguiente número consecutivo de OT para un barco específico
export function getNextOtNumberForShip(workOrders = [], shipId, offset = 0) {
  const shipWos = workOrders.filter(w => w.ship_id === shipId)
  let maxNum = 0
  shipWos.forEach(w => {
    const m = String(w.ot_number || '').match(/(\d+)/)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > maxNum && n < 100) maxNum = n
      else if (n >= 100 && shipWos.length === 1) maxNum = 1
    }
  })
  return `OT-${maxNum + 1 + offset}`
}

// Validación de bloqueo de fila según regla Dec-011 (OT facturada o bloqueada)
export const isRowLockedDec011 = (row) => Boolean(row?.wo?.is_locked || (row?.wo?.status === 'Facturada' && !row?.wo?.allow_post_billing_costs))

// Verificación de permiso de cobro de terceros para un contratista
export const hasThirdPartyPermission = (workers = [], contractorName = '') => {
  if (!contractorName) return false
  const key = contractorName.trim().toUpperCase()
  return workers.some(w => ((w.work_group || '').trim().toUpperCase() === key || (w.name || '').trim().toUpperCase() === key) && Boolean(w.can_charge_third_party))
}

// Filtro unificado de filas
export function filterUnifiedRows(rows = [], {
  selectedShipFilter = 'todos',
  selectedOtFilter = 'todas',
  selectedStatusFilter = 'todos',
  selectedForemanFilter = 'todos',
  selectedContractorFilter = 'todos',
  searchQuery = ''
}) {
  return rows.filter(row => {
    if (selectedShipFilter !== 'todos' && row.wo?.ship_id !== selectedShipFilter) return false
    if (selectedOtFilter !== 'todas' && row.work_order_id !== selectedOtFilter) return false
    if (selectedStatusFilter !== 'todos' && row.status !== selectedStatusFilter) return false
    if (selectedForemanFilter !== 'todos' && row.foreman_name !== selectedForemanFilter) return false
    if (selectedContractorFilter !== 'todos') {
      const list = row.contractors || []
      if (!list.includes(selectedContractorFilter)) return false
    }
    if (searchQuery.trim()) {
      const matchSearch = matchesUniversalSearch(
        {
          ...row,
          shipName: row.wo?.ships?.name,
          otTitle: row.wo?.title,
          otNumber: row.wo?.ot_number,
          contractorsList: (row.contractors || []).join(' ')
        },
        searchQuery
      )
      if (!matchSearch) return false
    }
    return true
  })
}

// Cálculo de estadísticas globales y radar de imputaciones sin OT
export function calculateWorkOrderStats(unifiedRows = [], laborLogs = [], thirdPartyServices = [], purchaseOrders = [], selectedShipFilter = 'todos') {
  const enEjecucion = unifiedRows.filter(r => r.status === 'En ejecución').length
  const pendientes = unifiedRows.filter(r => r.status === 'Pendiente de inicio').length
  const pdteRemito = unifiedRows.filter(r => r.status === 'Pendiente remito' || r.status === 'Remito realizado/Pdte firma' || r.status === 'Finalizado').length
  const facturados = unifiedRows.filter(r => r.status === 'Facturado').length
  const barcosActivos = new Set(unifiedRows.filter(r => r.status === 'En ejecución').map(r => r.wo?.ship_id)).size

  const matchShip = (shipId) => selectedShipFilter === 'todos' || shipId === selectedShipFilter
  const horasSinOt = laborLogs.filter(l => !l.work_order_id && matchShip(l.ship_id)).length
  const tercerosSinOt = thirdPartyServices.filter(t => !t.work_order_id && matchShip(t.ship_id)).length
  const comprasSinOt = purchaseOrders.filter(p => !p.work_order_id && matchShip(p.ship_id)).length
  const totalSinOt = horasSinOt + tercerosSinOt + comprasSinOt

  return {
    enEjecucion,
    pendientes,
    pdteRemito,
    facturados,
    barcosActivos,
    horasSinOt,
    tercerosSinOt,
    comprasSinOt,
    totalSinOt
  }
}

// Construcción del catálogo de contratistas a partir del personal activo
export function buildContractorCatalog(workers = []) {
  const map = new Map()
  const astilleroTrades = new Set(['CALDERERIA', 'RASCHINAJE', 'CARPINTERIA', 'MECANICA', 'PINTURA', 'ELECTRICIDAD', 'TORNERIA'])
  workers.forEach(w => {
    if (w.admin_center === 'ASTILLERO' && w.trade) astilleroTrades.add(w.trade.trim().toUpperCase())
  })
  Array.from(astilleroTrades).sort().forEach(trade => {
    const label = `ASTILLERO.${trade}`
    const has3ros = workers.some(w => w.admin_center === 'ASTILLERO' && (w.trade || '').toUpperCase() === trade && w.can_charge_third_party)
    map.set(label, { name: label, admin_center: 'ASTILLERO', trade, can_charge_third_party: has3ros })
  })
  workers.forEach(w => {
    if (w.status === 'INACTIVO') return
    const grp = (w.work_group || '').trim()
    if (!grp || grp === 'ASTILLERO') return
    const clean = grp.replace(/\s+AYUDANTE$/, '').trim()
    if (!map.has(clean)) {
      map.set(clean, { name: clean, admin_center: w.admin_center || 'CONTRATISTA', trade: w.trade || 'General', can_charge_third_party: Boolean(w.can_charge_third_party) })
    } else if (w.can_charge_third_party) {
      map.get(clean).can_charge_third_party = true
    }
  })
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
}

// Construcción del conjunto unificado de filas (OTs + Ítems)
export function buildUnifiedRows(workOrders = [], itemsByWoMap = {}, thirdPartyByItemMap = {}, defaultForeman = 'ALE CAMADELLI', otMetricsAndDatesMap = {}) {
  const rows = []
  workOrders.forEach(wo => {
    const items = itemsByWoMap[wo.id] || []
    const computedOt = computeOtState(wo, items)
    const otDates = otMetricsAndDatesMap[wo.id] || { totalHours: 0, createdDate: wo.created_at ? String(wo.created_at).split('T')[0] : null }
    if (items.length === 0) {
      rows.push({
        isPlaceholder: true,
        id: `placeholder-${wo.id}`,
        work_order_id: wo.id,
        wo,
        computedOt,
        otDates,
        description: wo.description || '',
        status: 'Pendiente de inicio',
        foreman_name: wo.foreman_name || defaultForeman,
        work_type: wo.work_type || 'HORA',
        assignment_type: wo.assignment_type || 'Presupuesto General',
        contractors: wo.contractor_name ? [wo.contractor_name] : []
      })
    } else {
      items.forEach(item => {
        rows.push({
          ...item,
          isPlaceholder: false,
          wo,
          computedOt,
          otDates,
          thirdPartyRecord: thirdPartyByItemMap[item.id] || null
        })
      })
    }
  })
  return assignMonotonicFolios(rows, { dateField: 'created_at', idField: 'id' })
}

/**
 * Obtiene el alcance consolidado de una OT reuniendo todas sus líneas/tareas (work_items).
 * Resuelve la discrepancia de múltiples líneas bajo una misma OT (ej: desmonte, colocación de chapa, limpieza).
 * Si hay múltiples registros work_orders que comparten (ship_id, ot_number), también consolida sus ítems
 * para blindaje contra duplicados históricos.
 */
export function getWorkOrderConsolidatedScope(wo, workItems = [], allWorkOrders = [], options = {}) {
  if (!wo) {
    return {
      tasks: [],
      taskCount: 0,
      tasksSummary: '',
      scopeLabel: '(⚠️ Sin OT)',
      fullDescription: '',
      otNum: 'OT',
      otTitle: ''
    }
  }

  const { contractorFilter = '', maxSummaryTasks = 4 } = options

  // Identificar todos los IDs de work_order pertenecientes a este mismo barco y número de OT
  const relatedWoIds = new Set([wo.id])
  if (Array.isArray(allWorkOrders) && allWorkOrders.length > 0 && wo.ship_id && wo.ot_number) {
    allWorkOrders.forEach((w) => {
      if (
        w.ship_id === wo.ship_id &&
        String(w.ot_number || '').trim().toUpperCase() === String(wo.ot_number || '').trim().toUpperCase()
      ) {
        relatedWoIds.add(w.id)
      }
    })
  }

  // Filtrar ítems de trabajo asociados a esta OT (excluyendo desestimados) y ordenar cronológicamente
  const validItems = (Array.isArray(workItems) ? workItems : []).filter(
    (wi) => relatedWoIds.has(wi.work_order_id) && wi.status !== 'Desestimado'
  )

  const sortedItems = [...validItems].sort((a, b) => {
    const da = a.created_at ? new Date(a.created_at).getTime() : 0
    const db = b.created_at ? new Date(b.created_at).getTime() : 0
    if (da !== db) return da - db
    return String(a.id || '').localeCompare(String(b.id || ''))
  })

  const tasks = sortedItems.map((wi, idx) => {
    const rawContractors = Array.isArray(wi.contractors)
      ? wi.contractors
      : wi.contractor_name
      ? [wi.contractor_name]
      : []
    const contractorsStr = rawContractors.join(', ') || 'Sin asignar'
    const foremanStr = wi.foreman_name || 'Sin asignar'
    const desc = wi.description || 'Sin descripción'

    let isContractorMatch = false
    if (contractorFilter) {
      const normFilter = String(contractorFilter).trim().toUpperCase()
      isContractorMatch = rawContractors.some((c) => String(c).trim().toUpperCase() === normFilter)
    }

    return {
      index: idx + 1,
      id: wi.id,
      work_order_id: wi.work_order_id,
      description: desc,
      contractors: rawContractors,
      contractorsStr,
      foreman_name: foremanStr,
      status: wi.status || 'En ejecución',
      work_type: wi.work_type || 'HORA',
      isContractorMatch
    }
  })

  // Resumen de tareas para etiquetas y dropdowns
  const taskDescriptions = tasks.map((t) => {
    if (t.contractorsStr && t.contractorsStr !== 'Sin asignar') {
      return `${t.description} (${t.contractorsStr})`
    }
    return t.description
  })

  const tasksSummary = taskDescriptions.length > 0
    ? (taskDescriptions.length > maxSummaryTasks
        ? `${taskDescriptions.slice(0, maxSummaryTasks).join(' • ')} (+${taskDescriptions.length - maxSummaryTasks} más)`
        : taskDescriptions.join(' • '))
    : (wo.description || wo.title || 'Sin tareas registradas')

  const otNum = wo.ot_number || wo.order_number || (wo.id ? String(wo.id).slice(0, 4) : 'OT')
  const otTitle = wo.title || wo.description || 'Sin título'
  const scopeLabel = `OT #${otNum} — ${otTitle} [${tasksSummary}]`

  const fullDescription = tasks.length > 0
    ? tasks.map((t) => `#${t.index}: ${t.description} | Resp: ${t.contractorsStr} (Jefe: ${t.foreman_name}) [${t.status}]`).join('\n')
    : (wo.description || 'Sin tareas cargadas')

  return {
    tasks,
    taskCount: tasks.length,
    tasksSummary,
    scopeLabel,
    fullDescription,
    otNum,
    otTitle
  }
}

/**
 * Genera texto con tachado horizontal Unicode (utilizando \u0336)
 */
export function toUnicodeStrikethrough(text = '') {
  return String(text)
    .split('')
    .map((c) => c + '\u0336')
    .join('')
}

/**
 * Formateador Canónico de Tooltip para celdas de Orden de Trabajo en todas las planillas.
 * Despliega la sábana técnica completa para facturación, imputación y control de obra.
 * Aplica tachado Unicode en tareas finalizadas/facturadas preservando la etiqueta de estado sin tachar.
 */
export function formatWorkOrderTooltipCanonical(wo, ship, workItems = [], allWorkOrders = []) {
  if (!wo) return '(⚠️ Sin OT)'
  const scope = getWorkOrderConsolidatedScope(wo, workItems, allWorkOrders)
  const shipName = ship?.name || 'Astillero'
  const otNum = scope.otNum
  const otTitle = scope.otTitle

  let lines = [
    `OT #${otNum}: ${otTitle}`,
    `Buque / Destino: ${shipName}`
  ]

  if (scope.tasks.length === 0) {
    lines.push(`Descripción: ${wo.description || 'Sin tareas cargadas'}`)
    lines.push(`Jefe de Obra: ${wo.foreman_name || 'Sin asignar'}`)
  } else {
    lines.push(`Alcance de Obra (${scope.tasks.length} línea${scope.tasks.length > 1 ? 's' : ''}):`)
    scope.tasks.forEach((t) => {
      const isClosed = t.status === 'Finalizado' || t.status === 'Facturado' || t.status === 'Desestimado'
      if (isClosed) {
        const lineBody = `L${t.index}: ${t.description} — ${t.contractorsStr} (Jefe: ${t.foreman_name})`
        lines.push(`❌ ${toUnicodeStrikethrough(lineBody)} [${t.status}]`)
      } else {
        lines.push(`• L${t.index}: ${t.description} — ${t.contractorsStr} (Jefe: ${t.foreman_name}) [${t.status}]`)
      }
    })
  }

  return lines.join('\n')
}

/**
 * Determina si una Orden de Trabajo está activa y disponible para carga/imputación
 * de nuevos datos (Pañol, Horas, Compras, Terceros).
 * Una OT cerrada o con todas sus subtareas finalizadas/facturadas NO está disponible para imputar.
 */
export function isWorkOrderActiveForImputation(wo, workItems = [], allWorkOrders = []) {
  if (!wo) return false

  // 1. Si la cabecera de la OT está completada, facturada o tiene fecha de cierre
  if (wo.status === 'Completada' || wo.status === 'Facturada' || Boolean(wo.closed_at)) {
    return false
  }

  // 2. Si la cabecera está cancelada
  if (wo.status === 'Cancelada') return false

  // 3. Inspeccionar las subtareas consolidadas
  const scope = getWorkOrderConsolidatedScope(wo, workItems, allWorkOrders)
  if (scope.tasks.length === 0) {
    return true
  }

  const activeTasks = scope.tasks.filter((t) => t.status !== 'Desestimado')
  if (activeTasks.length === 0) return false

  const allClosed = activeTasks.every(
    (t) => t.status === 'Finalizado' || t.status === 'Facturado' || t.status === 'Finalizado costo final de obra'
  )
  if (allClosed) return false

  return true
}

/**
 * Deduplica en memoria una lista de Órdenes de Trabajo por (ship_id, ot_number),
 * unificando bajo la primera cabecera todas las referencias de ítems y agregando su scope.
 */
export function deduplicateWorkOrdersWithScope(workOrders = [], workItems = []) {
  if (!Array.isArray(workOrders) || workOrders.length === 0) return []
  const grouped = new Map()

  workOrders.forEach((wo) => {
    const key = `${wo.ship_id || 'no_ship'}::${String(wo.ot_number || wo.id).trim().toUpperCase()}`
    if (!grouped.has(key)) {
      grouped.set(key, {
        master: { ...wo },
        allWoIds: new Set([wo.id])
      })
    } else {
      grouped.get(key).allWoIds.add(wo.id)
    }
  })

  const results = []
  grouped.forEach(({ master, allWoIds }) => {
    const matchedItems = (Array.isArray(workItems) ? workItems : []).filter(
      (wi) => allWoIds.has(wi.work_order_id) && wi.status !== 'Desestimado'
    )
    const scope = getWorkOrderConsolidatedScope(master, matchedItems, workOrders)
    const isActiveForImputation = isWorkOrderActiveForImputation(master, matchedItems, workOrders)
    results.push({
      ...master,
      _allWoIds: Array.from(allWoIds),
      _allWorkItems: matchedItems,
      scopeSummary: scope.tasksSummary,
      scopeLabel: scope.scopeLabel,
      consolidatedTasks: scope.tasks,
      isActiveForImputation
    })
  })

  return results
}

