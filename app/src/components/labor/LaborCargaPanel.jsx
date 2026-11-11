import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles,
  Layers,
  RotateCcw,
  RotateCw,
  Zap,
  ClipboardList,
  Ship,
  Briefcase,
  Calendar,
  Info,
  AlertTriangle,
  Users,
  Plus,
  Trash2,
  Save,
  Pencil,
  CopyPlus,
  AlertCircle,
  X
} from 'lucide-react'
import HighlightText from '../HighlightText'
import CrawlerSearchBar from '../CrawlerSearchBar'
import GridRibbon from '../GridRibbon'
import GridContextMenu from '../GridContextMenu'
import GridStatusBarBottom from '../GridStatusBarBottom'
import { supabase } from '../../lib/supabase'
import { useSpreadsheetGrid } from '../../hooks/useSpreadsheetGrid'
import { useGridContextMenu } from '../../hooks/useGridContextMenu'
import { buildPasteRowHandler } from '../../lib/gridRowActions'
import { matchesUniversalSearch } from '../../lib/searchEngine'
import { cleanShipName, NOMINA_ASTILLERO_BASE, TALLERES_FRECUENTES, calculateHoursStats, buildLocalRelationsForLog } from '../../lib/laborConstants'
import { normalizeText, parseWorkerTrades, tabulateCrewMessage } from '../../lib/aiLaborEngine'

const EXAMPLE_CREW_REPORT =
  'Luciano Tritón reguillas cuvierta protección de bacha y colocación de parrilla andres y diego soldadura parches trancalin don Antonio 9hr franco y enzo higinio subir portones y matafuego vuoso 2hr 2hr maniobra para prueba navegación  5 hr en don Antonio bodega sacar porurietano y comentando'

export default function LaborCargaPanel({
  ships = [],
  workOrders = [],
  workItems = [],
  dbWorkers = [],
  recentLogs = [],
  setRecentLogs,
  fetchData,
  selectedLogIds = new Set(),
  setSelectedLogIds,
  toggleSelectLog,
  toggleSelectAllLogs,
  activeKpiFilter,
  setActiveKpiFilter,
  handleEditFromDaily,
  handleDuplicateLog,
  handleDeleteLog,
  handleUpdateApprovalStatus,
  setReviewReasonModal,
  setShipPickerModal,
  setActiveTab,
  setDailyFilterType,
  setStatusMessage,
  user
}) {
  // Modos y tabulador
  const [isTabulatorOpen, setIsTabulatorOpen] = useState(false)
  const [isMultiOtMode, setIsMultiOtMode] = useState(false)
  const [rawReportText, setRawReportText] = useState('')
  const [isTabulating, setIsTabulating] = useState(false)
  const [tabulatorSummary, setTabulatorSummary] = useState(null)

  // Cascada de carga
  const [selectedShipId, setSelectedShipId] = useState('')
  const [selectedContractorGroup, setSelectedContractorGroup] = useState('ASTILLERO')
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState('')
  const [selectedWorkItemId, setSelectedWorkItemId] = useState('')
  const [dateLogged, setDateLogged] = useState(new Date().toISOString().split('T')[0])
  const [workType, setWorkType] = useState('MONTAJE')
  const [submitting, setSubmitting] = useState(false)
  const [openRubroEmergencyIds, setOpenRubroEmergencyIds] = useState(new Set())
  const [operariosRows, setOperariosRows] = useState([
    { id: 1, worker_name: '', worker_type: 'Astillero', default_rubro: '', rubro: '', hours_normal: 9, hours_extra_50: 0, hours_extra_100: 0, notes: '' }
  ])

  // Planilla interactiva de horas (Zona 3 & 4)
  const [filterWorker, setFilterWorker] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [filterShip, setFilterShip] = useState('')
  const [inlineLogEdit, setInlineLogEdit] = useState({ id: null, field: null, value: '' })
  const logSearchInputRef = useRef(null)
  const horasPasteRef = useRef(null)
  const { menuTarget, openMenu, closeMenu } = useGridContextMenu()

  // Mapa rápido de OTs por ID
  const woByIdMap = useMemo(() => {
    const m = {}
    workOrders.forEach(w => { m[w.id] = w })
    return m
  }, [workOrders])

  const shipWorkItemsAll = useMemo(() => {
    if (!selectedShipId) return []
    return workItems.filter(item => {
      const wo = woByIdMap[item.work_order_id]
      return wo && wo.ship_id === selectedShipId
    })
  }, [workItems, woByIdMap, selectedShipId])

  const activeWorkItemsForShip = useMemo(() => {
    return shipWorkItemsAll.filter(item => item.status === 'En ejecución')
  }, [shipWorkItemsAll])

  const blockedWorkItemsForShip = useMemo(() => {
    return shipWorkItemsAll.filter(item => item.status !== 'En ejecución')
  }, [shipWorkItemsAll])

  const enabledContractorsForShip = useMemo(() => {
    if (!selectedShipId) return []
    const set = new Set()
    activeWorkItemsForShip.forEach(item => {
      const list = item.contractors || []
      if (list.length === 0) {
        set.add('ASTILLERO.GENERAL')
      } else {
        list.forEach(c => { if (c) set.add(c) })
      }
    })
    if (set.size === 0) {
      set.add('ASTILLERO.GENERAL')
      dbWorkers
        .filter(w => (w.admin_center === 'CONTRATISTA' || w.admin_center === 'TALLER') && w.status !== 'INACTIVO' && w.can_impute_hours !== false)
        .forEach(w => { if (w.work_group) set.add(w.work_group) })
    }
    return Array.from(set).sort()
  }, [selectedShipId, activeWorkItemsForShip, dbWorkers])

  const syncCrewWithContractor = (newContractor) => {
    if (!newContractor) return
    const upper = newContractor.toUpperCase()
    if (upper.startsWith('ASTILLERO')) {
      setOperariosRows(prev => {
        const onlyAstillero = prev.filter(r => r.worker_type === 'Astillero')
        if (onlyAstillero.length === 0) {
          return [{ id: Date.now(), worker_name: '', worker_type: 'Astillero', default_rubro: '', rubro: '', hours_normal: 9, hours_extra_50: 0, hours_extra_100: 0, notes: '' }]
        }
        return onlyAstillero.map(row => ({ ...row, worker_type: 'Astillero' }))
      })
    } else {
      const isTaller = TALLERES_FRECUENTES.includes(newContractor) || dbWorkers.some(w => w.work_group === newContractor && w.admin_center === 'TALLER')
      const targetType = isTaller ? 'Taller' : 'Contratista'
      const matchedContractor = dbWorkers.find(w => w.work_group === newContractor || w.name === newContractor)
      const tradesInfo = parseWorkerTrades(matchedContractor?.trade || (isTaller ? 'Tornería' : 'Servicio Contratista'))
      setOperariosRows([{
        id: Date.now(),
        worker_name: newContractor,
        worker_type: targetType,
        default_rubro: tradesInfo.primaryLabel,
        allowed_trades: tradesInfo.labelList,
        rubro: tradesInfo.primaryLabel,
        hours_normal: 8,
        hours_extra_50: 0,
        hours_extra_100: 0,
        notes: ''
      }])
    }
  }

  useEffect(() => {
    if (enabledContractorsForShip.length > 0) {
      if (!enabledContractorsForShip.includes(selectedContractorGroup)) {
        const nextContractor = enabledContractorsForShip[0]
        setSelectedContractorGroup(nextContractor)
        syncCrewWithContractor(nextContractor)
      }
    } else {
      setSelectedContractorGroup('')
    }
  }, [selectedShipId, enabledContractorsForShip])

  const availableWorkOrders = useMemo(() => {
    if (!selectedShipId || !selectedContractorGroup) return []
    const matchingWoIds = new Set()
    const isSelectAst = selectedContractorGroup.toUpperCase().startsWith('ASTILLERO')
    activeWorkItemsForShip.forEach(item => {
      const list = item.contractors || []
      const isMatch = list.includes(selectedContractorGroup) || (isSelectAst && (list.length === 0 || list.some(c => String(c).toUpperCase().startsWith('ASTILLERO'))))
      if (isMatch) matchingWoIds.add(item.work_order_id)
    })
    return workOrders.filter(wo => wo.ship_id === selectedShipId && matchingWoIds.has(wo.id))
  }, [selectedShipId, selectedContractorGroup, activeWorkItemsForShip, workOrders])

  useEffect(() => {
    if (availableWorkOrders.length > 0) {
      if (!availableWorkOrders.some(w => w.id === selectedWorkOrderId)) {
        setSelectedWorkOrderId(availableWorkOrders[0].id)
      }
    } else {
      setSelectedWorkOrderId('')
    }
  }, [selectedShipId, selectedContractorGroup, availableWorkOrders])

  const activeItemsForSelectedWo = useMemo(() => {
    if (!selectedWorkOrderId || !selectedContractorGroup) return []
    const isSelectAst = selectedContractorGroup.toUpperCase().startsWith('ASTILLERO')
    return activeWorkItemsForShip.filter(item => {
      if (item.work_order_id !== selectedWorkOrderId) return false
      const list = item.contractors || []
      return list.includes(selectedContractorGroup) || (isSelectAst && (list.length === 0 || list.some(c => String(c).toUpperCase().startsWith('ASTILLERO'))))
    })
  }, [activeWorkItemsForShip, selectedWorkOrderId, selectedContractorGroup])

  useEffect(() => {
    if (activeItemsForSelectedWo.length > 0) {
      if (!activeItemsForSelectedWo.some(i => i.id === selectedWorkItemId)) {
        setSelectedWorkItemId(activeItemsForSelectedWo[0].id)
      }
      const firstItem = activeItemsForSelectedWo[0]
      if (firstItem?.work_type) setWorkType(firstItem.work_type)
    } else {
      setSelectedWorkItemId('')
    }
  }, [activeItemsForSelectedWo])

  const handleContractorGroupChange = (newContractor) => {
    setSelectedContractorGroup(newContractor)
    syncCrewWithContractor(newContractor)
  }

  const currentWorkOrder = workOrders.find(wo => wo.id === selectedWorkOrderId)
  const currentWorkItem = activeItemsForSelectedWo.find(i => i.id === selectedWorkItemId) || activeItemsForSelectedWo[0] || null
  const isSelectedGroupAstillero = !selectedContractorGroup || selectedContractorGroup.toUpperCase().startsWith('ASTILLERO')

  const addOperarioRow = (preset = {}) => {
    const isAstillero = isSelectedGroupAstillero
    const isFeriado = (preset.rubro || '').toLowerCase().includes('feriado')
    const defaultNorm = isAstillero ? (isFeriado ? 8 : 9) : 8
    const isTaller = !isAstillero && (TALLERES_FRECUENTES.includes(selectedContractorGroup) || dbWorkers.some(w => w.work_group === selectedContractorGroup && w.admin_center === 'TALLER'))
    const forcedType = isAstillero ? 'Astillero' : (isTaller ? 'Taller' : 'Contratista')
    let defaultRubro = preset.rubro || ''
    let allowedTrades = ['General']
    if (!isAstillero) {
      const matchedContractor = dbWorkers.find(w => w.work_group === selectedContractorGroup || w.name === selectedContractorGroup)
      const tradesInfo = parseWorkerTrades(matchedContractor?.trade || (isTaller ? 'Tornería' : 'Servicio Contratista'))
      if (!defaultRubro) defaultRubro = tradesInfo.primaryLabel
      allowedTrades = tradesInfo.labelList
    }
    setOperariosRows(prev => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        worker_name: preset.worker_name || (isAstillero ? '' : selectedContractorGroup),
        worker_type: forcedType,
        default_rubro: defaultRubro,
        allowed_trades: allowedTrades,
        rubro: defaultRubro,
        ship_id: preset.ship_id || selectedShipId || '',
        work_order_id: preset.work_order_id || selectedWorkOrderId || '',
        work_item_id: preset.work_item_id || selectedWorkItemId || '',
        hours_normal: preset.hours_normal ?? defaultNorm,
        hours_extra_50: preset.hours_extra_50 ?? 0,
        hours_extra_100: preset.hours_extra_100 ?? 0,
        notes: preset.notes || ''
      }
    ])
  }

  const removeOperarioRow = (rowId) => {
    if (operariosRows.length === 1) return
    setOperariosRows(prev => prev.filter(r => r.id !== rowId))
  }

  const updateOperarioRow = (rowId, field, value) => {
    setOperariosRows(prev => prev.map(r => {
      if (r.id === rowId) {
        const updated = { ...r, [field]: value }
        if (field === 'rubro' && updated.worker_type === 'Astillero') {
          if (value.toLowerCase().includes('feriado')) {
            updated.hours_normal = 8
          } else if ((r.rubro || '').toLowerCase().includes('feriado') && updated.hours_normal === 8) {
            updated.hours_normal = 9
          }
          updated.is_loaned_rubro = Boolean(
            updated.default_rubro &&
            updated.default_rubro !== 'General' &&
            normalizeText(value) !== normalizeText(updated.default_rubro)
          )
        }
        if (field === 'worker_type') {
          if (value === 'Astillero') {
            updated.hours_normal = (updated.rubro || '').toLowerCase().includes('feriado') ? 8 : 9
          }
        }
        return updated
      }
      return r
    }))
  }

  const toggleRubroEmergency = (rowId) => {
    setOpenRubroEmergencyIds(prev => {
      const next = new Set(prev)
      next.has(rowId) ? next.delete(rowId) : next.add(rowId)
      return next
    })
  }

  const handleTabulateMessage = async () => {
    if (!rawReportText.trim()) {
      setStatusMessage?.({ type: 'error', text: 'Pegá o escribí el parte de trabajo de la cuadrilla para poder tabularlo.' })
      return
    }
    setIsTabulating(true)
    setStatusMessage?.(null)
    try {
      const effectiveWorkers = dbWorkers.length > 0
        ? dbWorkers
        : NOMINA_ASTILLERO_BASE.map(w => ({ name: w.name, trade: w.defaultRubro, work_group: 'ASTILLERO', admin_center: 'ASTILLERO', status: 'ACTIVO' }))
      const result = await tabulateCrewMessage(rawReportText, {
        workers: effectiveWorkers,
        ships,
        workOrders,
        workItems,
        dateLogged,
        userEmail: user?.email || 'Operador'
      })
      if (result.rows && result.rows.length > 0) {
        setOperariosRows(result.rows)
        setIsMultiOtMode(true)
        setTabulatorSummary({
          summary: result.summary,
          engineUsed: result.engineUsed,
          promptVersion: result.promptVersion,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
          llmError: result.llmError
        })
        setStatusMessage?.({ type: 'success', text: `⚡ Parte tabulado con éxito (${result.rows.length} filas en Cuadrilla).` })
      } else {
        setStatusMessage?.({ type: 'info', text: 'No se detectaron filas de operarios en el mensaje.' })
      }
    } catch (err) {
      console.error('Error tabulador:', err)
      setStatusMessage?.({ type: 'error', text: `Error al tabular: ${err.message}` })
    } finally {
      setIsTabulating(false)
    }
  }

  const handleConsolidateSameOtRows = () => {
    setOperariosRows(prev => {
      const map = new Map()
      prev.forEach(r => {
        const effShip = r.ship_id || r.ship_name_raw || selectedShipId
        const effWo = r.work_order_id || selectedWorkOrderId
        const key = `${r.worker_name}__${effShip}__${effWo}__${r.rubro}`
        if (r.worker_name && effWo && map.has(key)) {
          const existing = map.get(key)
          existing.hours_normal = (parseFloat(existing.hours_normal) || 0) + (parseFloat(r.hours_normal) || 0)
          existing.hours_extra_50 = (parseFloat(existing.hours_extra_50) || 0) + (parseFloat(r.hours_extra_50) || 0)
          existing.hours_extra_100 = (parseFloat(existing.hours_extra_100) || 0) + (parseFloat(r.hours_extra_100) || 0)
          if (r.notes && !existing.notes.includes(r.notes)) {
            existing.notes = existing.notes ? `${existing.notes} + ${r.notes}` : r.notes
          }
        } else {
          map.set(key, { ...r })
        }
      })
      return Array.from(map.values())
    })
    setStatusMessage?.({ type: 'info', text: 'Se consolidaron las subtareas que compartían exactamente el mismo Operario, Barco, OT y Rubro.' })
  }

  const replicateYesterday = () => {
    const saved = localStorage.getItem('aloncar_last_labor_batch_v2')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setOperariosRows(parsed.map(p => ({ ...p, id: Math.random() })))
        setStatusMessage?.({ type: 'info', text: 'Se replicó la cuadrilla cargada anteriormente.' })
      } catch (e) {
        console.error(e)
      }
    } else {
      setOperariosRows([
        { id: 1, worker_name: 'Toledo, Luciano', worker_type: 'Astillero', default_rubro: 'Calderería', rubro: 'Calderería', hours_normal: 9, hours_extra_50: 0, hours_extra_100: 0, notes: 'Rejillas cubierta y colocación de parrilla' },
        { id: 2, worker_name: 'Gari, Mario Andres', worker_type: 'Astillero', default_rubro: 'Calderería', rubro: 'Soldadura', hours_normal: 9, hours_extra_50: 0, hours_extra_100: 0, notes: 'Soldadura parches trancalín' },
        { id: 3, worker_name: 'Rodriguez, Diego', worker_type: 'Astillero', default_rubro: 'Calderería', rubro: 'Soldadura', hours_normal: 9, hours_extra_50: 0, hours_extra_100: 0, notes: 'Soldadura parches trancalín' }
      ])
      setStatusMessage?.({ type: 'info', text: 'Se cargó una cuadrilla de ejemplo.' })
    }
  }

  const handleQuickCreateShipAndWoForRow = async (row) => {
    const shipNameClean = (row.ship_name_raw || '').trim().toUpperCase()
    if (!shipNameClean) return
    try {
      setSubmitting(true)
      let targetShip = ships.find(s => normalizeText(s.name) === normalizeText(shipNameClean))
      if (!targetShip) {
        const { data: shipData, error: shipErr } = await supabase.from('ships').insert([{ name: shipNameClean, client_name: shipNameClean, status: 'Activo' }]).select().single()
        if (shipErr) throw shipErr
        targetShip = shipData
      }
      const otNumber = `OT-${Date.now().toString().slice(-4)}`
      const { data: woData, error: woErr } = await supabase.from('work_orders').insert([{
        ship_id: targetShip.id,
        ot_number: otNumber,
        title: `${otNumber}: Apertura Urgente (${shipNameClean})`,
        description: `Creada automáticamente desde parte diario para imputación de ${row.worker_name || 'cuadrilla'}.`,
        status: 'En ejecución'
      }]).select().single()
      if (woErr) throw woErr
      fetchData?.()
      setOperariosRows(prev => prev.map(r => r.id === row.id ? { ...r, ship_id: targetShip.id, work_order_id: woData.id, needs_review: false, review_warnings: [] } : r))
      setStatusMessage?.({ type: 'success', text: `¡Barco "${shipNameClean}" y ${otNumber} creados y asignados!` })
    } catch (err) {
      console.error(err)
      setStatusMessage?.({ type: 'error', text: `No se pudo crear barco/OT: ${err.message}` })
    } finally {
      setSubmitting(false)
    }
  }

  const draftWorkerSummary = useMemo(() => {
    const map = new Map()
    operariosRows.forEach(r => {
      const name = (r.worker_name || '').trim()
      if (!name) return
      if (!map.has(name)) map.set(name, { name, type: r.worker_type || 'Astillero', parts: [], total: 0 })
      const entry = map.get(name)
      const h = (parseFloat(r.hours_normal) || 0) + (parseFloat(r.hours_extra_50) || 0) + (parseFloat(r.hours_extra_100) || 0)
      entry.parts.push(h)
      entry.total += h
    })
    return Array.from(map.values())
  }, [operariosRows])

  const totalHorasNormales = operariosRows.reduce((acc, r) => acc + (parseFloat(r.hours_normal) || 0), 0)
  const totalHoras50 = operariosRows.reduce((acc, r) => acc + (parseFloat(r.hours_extra_50) || 0), 0)
  const totalHoras100 = operariosRows.reduce((acc, r) => acc + (parseFloat(r.hours_extra_100) || 0), 0)
  const totalHorasGenerales = totalHorasNormales + totalHoras50 + totalHoras100

  const handleSubmitBatch = async (e) => {
    e.preventDefault()
    setStatusMessage?.(null)
    const rowsMissingShip = operariosRows.filter(r => !(r.ship_id || selectedShipId || (r.work_order_id && woByIdMap[r.work_order_id]?.ship_id)))
    if (rowsMissingShip.length > 0) {
      setStatusMessage?.({ type: 'error', text: `Hay ${rowsMissingShip.length} fila(s) sin Buque de destino asignado.` })
      return
    }
    const rowsWithErrors = operariosRows.filter(r => !r.worker_name.trim() || !r.rubro.trim())
    if (rowsWithErrors.length > 0) {
      setStatusMessage?.({ type: 'error', text: 'Complete Operario y Rubro para todas las filas.' })
      return
    }
    setSubmitting(true)
    try {
      localStorage.setItem('aloncar_last_labor_batch_v2', JSON.stringify(operariosRows))
      const payload = operariosRows.map(row => {
        const hNorm = parseFloat(row.hours_normal) || 0
        const h50 = parseFloat(row.hours_extra_50) || 0
        const h100 = parseFloat(row.hours_extra_100) || 0
        const hTotal = hNorm + h50 + h100
        const targetWoId = row.work_order_id || selectedWorkOrderId || null
        const targetShipId = row.ship_id || selectedShipId || (targetWoId ? woByIdMap[targetWoId]?.ship_id : null) || null
        const targetItemId = row.work_item_id || currentWorkItem?.id || null
        const isMissingWo = !targetWoId
        const hasUnresolvedAlert = Boolean(row.needs_review) || isMissingWo
        return {
          ship_id: targetShipId,
          work_order_id: targetWoId,
          work_item_id: targetItemId,
          hours_worked: hTotal,
          hours_normal: hNorm,
          hours_extra_50: h50,
          hours_extra_100: h100,
          date_logged: dateLogged,
          worker_name: row.worker_name,
          worker_type: row.worker_type,
          rubro: row.rubro,
          work_type: workType,
          cost_center: 'CLIENTE',
          notes: row.notes || null,
          approval_status: isMissingWo ? 'R' : (hasUnresolvedAlert ? 'R' : 'Aprobado'),
          review_reason: isMissingWo ? 'Falta Cargar OT (Pendiente de apertura)' : (hasUnresolvedAlert ? (row.review_warnings || []).join(' | ') : null)
        }
      })
      const { error } = await supabase.from('labor_logs').insert(payload)
      if (error) throw error
      setStatusMessage?.({ type: 'success', text: `¡Lote guardado! Se registraron ${operariosRows.length} imputaciones (${totalHorasGenerales} hs).` })
      setOperariosRows([{ id: Date.now(), worker_name: '', worker_type: 'Astillero', default_rubro: '', rubro: '', hours_normal: 9, hours_extra_50: 0, hours_extra_100: 0, notes: '' }])
      setTabulatorSummary(null)
      fetchData?.()
    } catch (err) {
      console.error('Error al guardar horas:', err)
      setStatusMessage?.({ type: 'error', text: `Error al guardar en Supabase: ${err.message || 'Verifique conexión'}` })
    } finally {
      setSubmitting(false)
    }
  }

  // Planilla interactiva de horas (Zona 3 & 4)
  const incompleteWorkerDateKeys = useMemo(() => {
    const grouped = new Map()
    recentLogs.forEach(l => {
      if ((l.worker_type || 'Astillero') !== 'Astillero' || !l.worker_name || !l.date_logged) return
      const key = `${l.worker_name}__${l.date_logged}`
      if (!grouped.has(key)) grouped.set(key, { sumNormal: 0, isFeriado: false })
      const entry = grouped.get(key)
      entry.sumNormal += parseFloat(l.hours_normal ?? l.hours_worked) || 0
      if ((l.rubro || '').toLowerCase().includes('feriado')) entry.isFeriado = true
    })
    const incompleteKeys = new Set()
    grouped.forEach((data, key) => {
      const requiredHours = data.isFeriado ? 8 : 9
      if (data.sumNormal < requiredHours) incompleteKeys.add(key)
    })
    return incompleteKeys
  }, [recentLogs])

  const filteredLogs = useMemo(() => {
    return recentLogs.filter(log => {
      const shipName = log.ships?.name || log.work_orders?.ships?.name || ''
      const matchWorker = !filterWorker || matchesUniversalSearch(log, filterWorker, ['worker_name', 'rubro', 'notes', 'work_orders.ot_number', 'ships.name'])
      const matchDate = !filterDate || log.date_logged === filterDate
      const matchShip = !filterShip || shipName.toLowerCase().includes(filterShip.toLowerCase())
      if (!matchWorker || !matchDate || !matchShip) return false
      if (activeKpiFilter === 'sin_ot') return !log.work_order_id
      if (activeKpiFilter === 'revision_R') return log.approval_status === 'R'
      if (activeKpiFilter === 'corregidas_RR') return log.approval_status === 'RR'
      if (activeKpiFilter === 'incompleta') return incompleteWorkerDateKeys.has(`${log.worker_name}__${log.date_logged}`)
      if (activeKpiFilter === 'sin_prc') return (log.cost_center === 'PRESUPUESTO' || log.work_type === 'PRESUPUESTO') && !log.prc_number
      return true
    })
  }, [recentLogs, filterWorker, filterDate, filterShip, activeKpiFilter, incompleteWorkerDateKeys])

  const horasSpreadsheetColumns = useMemo(() => [
    { key: 'date_logged', label: 'Fecha', readOnly: false },
    {
      key: 'ship_wo',
      label: 'Barco / OT',
      readOnly: false,
      getValue: (row) => ({ ship_id: row.ship_id || row.work_orders?.ship_id || null, work_order_id: row.work_order_id || null }),
      formatDisplay: (val, row) => {
        const sName = cleanShipName(row?.ships?.name || row?.work_orders?.ships?.name || '') || 'Sin Buque'
        const otLabel = row?.work_orders?.ot_number || row?.work_orders?.title || 'Sin OT'
        return `${sName} / ${otLabel}`
      }
    },
    { key: 'worker_name', label: 'Operario', readOnly: false },
    { key: 'rubro', label: 'Rubro', readOnly: false },
    { key: 'hours_normal', label: 'Norm', readOnly: false },
    { key: 'hours_extra_50', label: '50%', readOnly: false },
    { key: 'hours_extra_100', label: '100%', readOnly: false },
    { key: 'approval_status', label: 'Estado', readOnly: false }
  ], [])

  const showGridFeedback = useCallback((type, text) => {
    setStatusMessage?.({ type: type === 'error' ? 'error' : 'success', text })
  }, [setStatusMessage])

  const handleHorasBatchUpdate = useCallback(async ({ colKey, newValue, targetIds, revertMap, isRevert }) => {
    if (isRevert && revertMap) {
      setRecentLogs(prev => prev.map(l => {
        if (revertMap[l.id] === undefined) return l
        const oldVal = revertMap[l.id]
        if (colKey === 'ship_wo' && oldVal && typeof oldVal === 'object') {
          return { ...l, ...buildLocalRelationsForLog(oldVal.ship_id, oldVal.work_order_id, ships, workOrders) }
        }
        if (['hours_normal', 'hours_extra_50', 'hours_extra_100'].includes(colKey)) {
          const nextLog = { ...l, [colKey]: parseFloat(oldVal) || 0 }
          const total = (parseFloat(nextLog.hours_normal) || 0) + (parseFloat(nextLog.hours_extra_50) || 0) + (parseFloat(nextLog.hours_extra_100) || 0)
          return { ...nextLog, hours_worked: total }
        }
        return { ...l, [colKey]: oldVal }
      }))
      return
    }
    if (!targetIds || targetIds.length === 0) return
    const targetSet = new Set(targetIds)
    setRecentLogs(prev => prev.map(l => {
      if (!targetSet.has(l.id)) return l
      if (colKey === 'ship_wo' && newValue && typeof newValue === 'object') {
        return {
          ...l,
          ...buildLocalRelationsForLog(newValue.ship_id, newValue.work_order_id, ships, workOrders),
          ...(!newValue.work_order_id ? { approval_status: 'R', review_reason: 'Falta Cargar OT (Pendiente de apertura)' } : {})
        }
      }
      if (['hours_normal', 'hours_extra_50', 'hours_extra_100'].includes(colKey)) {
        const num = parseFloat(newValue) || 0
        const nextLog = { ...l, [colKey]: num }
        const total = (parseFloat(nextLog.hours_normal) || 0) + (parseFloat(nextLog.hours_extra_50) || 0) + (parseFloat(nextLog.hours_extra_100) || 0)
        return { ...nextLog, hours_worked: total }
      }
      return { ...l, [colKey]: newValue }
    }))
    try {
      if (['hours_normal', 'hours_extra_50', 'hours_extra_100', 'rubro'].includes(colKey)) {
        await Promise.all(targetIds.map(id => {
          const targetLog = recentLogs.find(x => x.id === id)
          const num = parseFloat(newValue) || 0
          const n = colKey === 'hours_normal' ? num : (parseFloat(targetLog?.hours_normal) || 0)
          const h50 = colKey === 'hours_extra_50' ? num : (parseFloat(targetLog?.hours_extra_50) || 0)
          const h100 = colKey === 'hours_extra_100' ? num : (parseFloat(targetLog?.hours_extra_100) || 0)
          return supabase.from('labor_logs').update({ [colKey]: num, hours_worked: n + h50 + h100 }).eq('id', id)
        }))
      } else {
        const payload = {}
        if (colKey === 'ship_wo' && newValue && typeof newValue === 'object') {
          payload.ship_id = newValue.ship_id ?? null
          payload.work_order_id = newValue.work_order_id ?? null
        } else {
          payload[colKey] = newValue
        }
        await supabase.from('labor_logs').update(payload).in('id', targetIds)
      }
      showGridFeedback('success', `Se actualizaron ${targetIds.length} imputación(es).`)
    } catch (err) {
      console.error(err)
      showGridFeedback('error', 'Error al actualizar: ' + err.message)
      fetchData?.()
    }
  }, [recentLogs, ships, workOrders, showGridFeedback, fetchData, setRecentLogs])

  const activateHorasCell = useCallback((log, colKey) => {
    if (!log) return
    if (colKey === 'ship_wo') {
      setShipPickerModal({
        isOpen: true,
        logId: log.id,
        rowIndex: null,
        currentShipId: log.ship_id || log.work_orders?.ship_id || '',
        currentWorkOrderId: log.work_order_id || '',
        workerName: log.worker_name || ''
      })
      return
    }
    setInlineLogEdit({ id: log.id, field: colKey, value: log[colKey] ?? '' })
  }, [setShipPickerModal])

  const horasGrid = useSpreadsheetGrid({
    rows: filteredLogs,
    columns: horasSpreadsheetColumns,
    getRowId: (row) => row.id,
    storageKey: 'aloncar_grid_horas',
    onBatchUpdate: handleHorasBatchUpdate,
    onPasteRow: (args) => horasPasteRef.current?.(args),
    onCellActivate: (row, colDef) => activateHorasCell(row, colDef.key),
    onFocusSearch: () => {
      logSearchInputRef.current?.focus()
      logSearchInputRef.current?.select()
    },
    showFeedback: showGridFeedback
  })

  useEffect(() => {
    const LOG_PASTE_FIELDS = ['ship_id', 'work_order_id', 'work_item_id', 'rubro', 'hours_worked', 'hours_normal', 'hours_extra_50', 'hours_extra_100', 'work_type', 'notes']
    horasPasteRef.current = buildPasteRowHandler({
      table: 'labor_logs',
      entityType: 'daily_labor_logs',
      fields: LOG_PASTE_FIELDS,
      grid: horasGrid,
      setList: setRecentLogs,
      mergeLocal: (row, patch) => ({
        ...row,
        ...patch,
        ...('work_order_id' in patch || 'ship_id' in patch
          ? buildLocalRelationsForLog(patch.ship_id ?? row.ship_id, patch.work_order_id ?? row.work_order_id, ships, workOrders)
          : {})
      }),
      nameOf: (r) => `${r.worker_name || ''} ${r.date_logged || ''}`.trim() || r.id,
      showFeedback: showGridFeedback,
      user: user?.email
    })
  })

  function getHorasCellProps(rowIndex, colKey) {
    const colIdx = horasSpreadsheetColumns.findIndex(c => c.key === colKey)
    if (colIdx === -1) return { className: '', renderHandle: false, domProps: {} }
    const isActive = horasGrid.isCellActive(rowIndex, colIdx)
    const isSelected = horasGrid.isCellSelected(rowIndex, colIdx)
    const isFillPreview = horasGrid.isCellInFillPreview(rowIndex, colIdx)
    const renderHandle = horasGrid.shouldRenderFillHandle(rowIndex, colIdx)
    return {
      renderHandle,
      domProps: {
        onClick: (e) => horasGrid.handleCellClick(rowIndex, colIdx, e),
        onMouseDown: (e) => horasGrid.handleCellMouseDown(rowIndex, colIdx, e),
        onMouseEnter: () => horasGrid.handleCellMouseEnter(rowIndex, colIdx)
      },
      className: `relative select-none transition-colors ${
        isActive
          ? 'ring-2 ring-cyan-400 bg-cyan-950/40 z-20 outline-none'
          : isFillPreview
          ? 'bg-cyan-900/40 border-y border-dashed border-cyan-400'
          : isSelected
          ? 'bg-cyan-900/30'
          : ''
      }`
    }
  }

  async function saveInlineLogEdit(logId, field, newValue) {
    setInlineLogEdit({ id: null, field: null, value: '' })
    const targetLog = recentLogs.find(l => l.id === logId)
    if (!targetLog) return
    let cleanedVal = newValue
    if (['hours_normal', 'hours_extra_50', 'hours_extra_100'].includes(field)) {
      cleanedVal = Math.max(0, parseFloat(newValue) || 0)
    } else if (typeof newValue === 'string') {
      cleanedVal = newValue.trim()
      if (!cleanedVal && ['worker_name', 'rubro', 'date_logged'].includes(field)) return
    }
    if (targetLog[field] === cleanedVal) return

    const extraPayload = {}
    if (['hours_normal', 'hours_extra_50', 'hours_extra_100'].includes(field)) {
      const n = field === 'hours_normal' ? cleanedVal : (parseFloat(targetLog.hours_normal ?? targetLog.hours_worked) || 0)
      const h50 = field === 'hours_extra_50' ? cleanedVal : (parseFloat(targetLog.hours_extra_50) || 0)
      const h100 = field === 'hours_extra_100' ? cleanedVal : (parseFloat(targetLog.hours_extra_100) || 0)
      extraPayload.hours_worked = n + h50 + h100
    }
    setRecentLogs(prev => prev.map(l => (l.id === logId ? { ...l, [field]: cleanedVal, ...extraPayload } : l)))
    try {
      const { error } = await supabase.from('labor_logs').update({ [field]: cleanedVal, ...extraPayload }).eq('id', logId)
      if (error) throw error
      showGridFeedback('success', 'Imputación actualizada.')
    } catch (err) {
      console.error(err)
      showGridFeedback('error', 'Error al guardar: ' + err.message)
      setRecentLogs(prev => prev.map(l => (l.id === logId ? targetLog : l)))
    }
  }

  const handleInsertRow = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const newPayload = {
        date_logged: today,
        ship_id: null,
        work_order_id: null,
        worker_name: '',
        worker_type: '',
        rubro: '',
        hours_worked: 0,
        hours_normal: 0,
        hours_extra_50: 0,
        hours_extra_100: 0,
        approval_status: 'R',
        review_reason: 'Fila en blanco (Pendiente de carga)'
      }
      const { data, error } = await supabase.from('labor_logs').insert([newPayload]).select('*, ships(id, name), work_orders(id, ot_number, title, ship_id)').single()
      if (error) throw error
      setRecentLogs(prev => [data, ...prev])
      showGridFeedback('success', 'Fila en blanco insertada al inicio.')
    } catch (err) {
      console.error(err)
      showGridFeedback('error', 'Error al insertar fila: ' + err.message)
    }
  }

  const hoursStats = useMemo(() => calculateHoursStats(filteredLogs, selectedLogIds), [filteredLogs, selectedLogIds])
  return (
    <div className="space-y-6">
      {/* Botones de acción superiores */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-slate-400 text-xs">
          Imputá múltiples operarios por cuadrilla o tabulá un parte grupal con desglose de <strong className="text-white">Horas Normales</strong>, <strong className="text-cyan-300">Extras (50% / 100%)</strong> y <strong className="text-amber-300">Puerta de Emergencia de Rubro</strong>.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsTabulatorOpen(prev => !prev)}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-2 cursor-pointer shadow-sm ${
              isTabulatorOpen
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isTabulatorOpen ? 'Ocultar Tabulador de Mensajes' : '⚡ Tabular Parte por Grupo'}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsMultiOtMode(prev => !prev)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
              isMultiOtMode
                ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
            }`}
            title="Permite que cada fila de la cuadrilla apunte a un Barco y OT diferente en el mismo lote"
          >
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>{isMultiOtMode ? 'Modo Multi-Barco / Multi-OT: ACTIVO' : 'Activar Multi-Barco por Fila'}</span>
          </button>
          <button
            type="button"
            onClick={replicateYesterday}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Replicar Cuadrilla Anterior</span>
          </button>
        </div>
      </div>

      {/* PANEL: TABULADOR INTELIGENTE DE PARTES POR GRUPO */}
      {isTabulatorOpen && (
        <div className="bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-cyan-950/30 border border-cyan-500/30 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs uppercase tracking-wider font-extrabold text-cyan-300 flex items-center gap-2">
                  <span>⚡ Tabulador Inteligente de Partes por Grupo (WhatsApp / Audio Transcrito)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700/50 font-mono">
                    Prioridad División E5/E6
                  </span>
                </h2>
                <p className="text-[11px] text-slate-400">
                  Pegá el reporte corrido del jefe de obra o capataz. El motor separa operarios en paralelo, infiere el rubro de la tarea real, cruza contra OTs en ejecución y pre-carga la Cuadrilla para que solo ajustes lo mínimo.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setRawReportText(EXAMPLE_CREW_REPORT)}
                className="px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-[11px] font-semibold cursor-pointer transition-all"
              >
                📋 Cargar Ejemplo Real
              </button>
              {rawReportText && (
                <button
                  type="button"
                  onClick={() => {
                    setRawReportText('')
                    setTabulatorSummary(null)
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 text-[11px] cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <textarea
              rows={3}
              value={rawReportText}
              onChange={(e) => setRawReportText(e.target.value)}
              placeholder="Ej: Luciano Tritón reguillas cuvierta protección de bacha y colocación de parrilla andres y diego soldadura parches trancalin don Antonio 9hr franco y enzo higinio subir portones y matafuego vuoso 2hr 2hr maniobra para prueba navegación 5 hr en don Antonio bodega sacar porurietano..."
              className="w-full bg-slate-950/90 border border-slate-700/90 focus:border-cyan-400 rounded-xl p-3.5 text-xs text-white placeholder-slate-500 focus:outline-none font-mono leading-relaxed"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-slate-300">
                  ✔ Desglosa <strong>&ldquo;Andrés y Diego 9h&rdquo;</strong> &rarr; 9h c/u (RN-03)
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-slate-300">
                  ✔ Corrige jerga naval (<em>trancalín, poliuretano, cubierta</em>)
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-slate-300">
                  ✔ Prioriza dividir subtareas salvo que la OT cubra ambas
                </span>
              </div>

              <div className="flex items-center gap-2">
                {operariosRows.length > 1 && (
                  <button
                    type="button"
                    onClick={handleConsolidateSameOtRows}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
                    title="Unifica filas que tengan exactamente el mismo Operario, Barco, OT y Rubro sumando sus horas"
                  >
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Consolidar Misma OT</span>
                  </button>
                )}
                <button
                  type="button"
                  disabled={isTabulating || !rawReportText.trim()}
                  onClick={handleTabulateMessage}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold text-xs shadow-[0_0_20px_rgba(0,242,254,0.25)] flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
                >
                  <Zap className="w-4 h-4" />
                  <span>{isTabulating ? 'Analizando y Tabulando...' : '⚡ Tabular a Cuadrilla'}</span>
                </button>
              </div>
            </div>
          </div>

          {tabulatorSummary && (
            <div className="p-3.5 rounded-xl bg-slate-950/90 border border-cyan-500/30 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 font-bold font-mono text-[11px]">
                  Motor: {tabulatorSummary.engineUsed === 'openai' ? 'OpenAI GPT-4o-mini' : 'Parser Naval Determinístico Local'}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                  Filas generadas: <strong className="text-white">{tabulatorSummary.summary?.totalRows || operariosRows.length}</strong>
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-700/40 text-emerald-300">
                  OK automáticas: <strong>{tabulatorSummary.summary?.readyRows || 0}</strong>
                </span>
                {(tabulatorSummary.summary?.reviewRows || 0) > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-amber-950/70 border border-amber-600/50 text-amber-300 font-semibold">
                    ⚠️ Requieren pulido mínimo: {tabulatorSummary.summary.reviewRows}
                  </span>
                )}
                {(tabulatorSummary.summary?.loanedRubroCount || 0) > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-purple-950/70 border border-purple-600/50 text-purple-300 font-semibold">
                    🔄 Préstamos de rubro detectados: {tabulatorSummary.summary.loanedRubroCount}
                  </span>
                )}
              </div>
              {tabulatorSummary.llmError && (
                <span className="text-[11px] text-amber-300 font-mono">
                  Fallback local activo ({tabulatorSummary.llmError})
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* FORMULARIO DE CARGA DE CUADRILLA */}
      <form onSubmit={handleSubmitBatch} className="space-y-6">
        {/* CABECERA OT CON FILTRO EN CASCADA */}
        <div className="alon-zone-entry p-5 md:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <h2 className="text-xs uppercase tracking-wider font-bold text-primary flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                Orden de Trabajo & Destino Por Defecto (Filtro de Habilitación en Cascada)
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-700/50 font-bold">
                Solo OTs &ldquo;En ejecución&rdquo;
              </span>
            </div>
            <div className="flex items-center gap-2">
              {blockedWorkItemsForShip.length > 0 && (
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/70 text-amber-300 border border-amber-800/50 font-semibold"
                  title="Trabajos bloqueados para recibir costos."
                >
                  🔒 {blockedWorkItemsForShip.length} trabajo(s) bloqueado(s) en este barco
                </span>
              )}
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-cyan-950/70 text-cyan-400 border border-cyan-800/40 font-semibold font-mono">
                Centro de Costo: CLIENTE (Fijo)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* PASO 1: Barco */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold flex items-center justify-center">
                  1
                </span>
                <Ship className="w-3.5 h-3.5 text-cyan-400" />
                Barco / Embarcación
              </label>
              <select
                value={selectedShipId}
                onChange={(e) => setSelectedShipId(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
              >
                {ships.map(ship => (
                  <option key={ship.id} value={ship.id} className="bg-slate-900">
                    {cleanShipName(ship.name)}
                  </option>
                ))}
              </select>
            </div>

            {/* PASO 2: Contratista / Grupo Habilitado */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center justify-center">
                  2
                </span>
                <Briefcase className="w-3.5 h-3.5 text-amber-400" />
                Contratista / Grupo Habilitado
              </label>
              <select
                value={selectedContractorGroup}
                onChange={(e) => handleContractorGroupChange(e.target.value)}
                className="w-full bg-slate-950/80 border border-amber-500/40 rounded-lg px-3 py-2 text-xs text-amber-200 font-semibold focus:outline-none focus:border-amber-400"
              >
                {enabledContractorsForShip.length === 0 ? (
                  <option value="">🔒 Sin contratistas habilitados (En ejecución)</option>
                ) : (
                  enabledContractorsForShip.map(contractor => (
                    <option key={contractor} value={contractor} className="bg-slate-900 text-white">
                      {contractor}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* PASO 3: Orden de Trabajo (OT) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold flex items-center justify-center">
                  3
                </span>
                <ClipboardList className="w-3.5 h-3.5 text-emerald-400" />
                OT ({availableWorkOrders.length} hab. / Opcional)
              </label>
              <select
                value={selectedWorkOrderId}
                onChange={(e) => setSelectedWorkOrderId(e.target.value)}
                className={`w-full bg-slate-950/80 border rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-400 ${
                  !selectedWorkOrderId ? 'border-amber-500/60 text-amber-300' : 'border-emerald-500/40 text-white'
                }`}
              >
                <option value="" className="bg-slate-900 text-amber-300 font-bold">
                  -- ⚠️ Dejar OT en blanco (Pendiente de apertura) --
                </option>
                {availableWorkOrders.map(wo => (
                  <option key={wo.id} value={wo.id} className="bg-slate-900 text-white">
                    {wo.ot_number ? `${wo.ot_number} — ` : ''}{wo.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Fecha y Modalidad */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                  Fecha Trabajo
                </label>
                <input
                  type="date"
                  value={dateLogged}
                  onChange={(e) => setDateLogged(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Modalidad
                </label>
                <select
                  value={workType}
                  onChange={(e) => setWorkType(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
                >
                  <option value="HORA">Por Hora</option>
                  <option value="PRESUPUESTO">Presupuesto</option>
                  <option value="CONTROL">Control</option>
                </select>
              </div>
            </div>
          </div>

          {activeItemsForSelectedWo.length > 1 && (
            <div className="pt-1">
              <label className="block text-[11px] font-semibold text-cyan-300 mb-1">
                Trabajo específico dentro de {currentWorkOrder?.ot_number || currentWorkOrder?.title} ({activeItemsForSelectedWo.length} habilitados para {selectedContractorGroup}):
              </label>
              <select
                value={selectedWorkItemId}
                onChange={(e) => setSelectedWorkItemId(e.target.value)}
                className="w-full bg-slate-950 border border-cyan-500/40 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
              >
                {activeItemsForSelectedWo.map((item, idx) => (
                  <option key={item.id} value={item.id} className="bg-slate-900">
                    Trabajo #{idx + 1}: {item.description}
                  </option>
                ))}
              </select>
            </div>
          )}

          {currentWorkOrder ? (
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-2.5">
                <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div>
                    <span className="font-mono font-bold text-emerald-300 mr-1.5">
                      [{currentWorkOrder.ot_number || 'OT'}]
                    </span>
                    <strong className="text-white">{currentWorkOrder.title}: </strong>
                    <span className="text-slate-200 font-medium">
                      {currentWorkItem?.description || currentWorkOrder.description || 'Sin descripción detallada registrada.'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    <span>
                      Jefe de Obra: <strong className="text-cyan-300">{currentWorkItem?.foreman_name || currentWorkOrder.foreman_name || 'S/D'}</strong>
                    </span>
                    <span>&bull;</span>
                    <span>
                      Contratistas habilitados:{' '}
                      <strong className="text-amber-300">
                        {(currentWorkItem?.contractors || []).join(' / ') || selectedContractorGroup || 'Astillero'}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
              <Link
                to="/ots"
                className="shrink-0 text-[11px] text-cyan-400 hover:text-cyan-300 underline font-semibold"
              >
                Ver en Órdenes de Trabajo &rarr;
              </Link>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 flex items-center justify-between gap-3 text-xs text-amber-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  No hay Órdenes de Trabajo en estado <strong>&ldquo;En ejecución&rdquo;</strong> habilitadas para este barco/contratista. Podés elegir otro barco en cada fila (Modo Multi-Barco) o habilitar la OT en Órdenes de Trabajo.
                </span>
              </div>
              <Link
                to="/ots"
                className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold"
              >
                Ir a OTs
              </Link>
            </div>
          )}
        </div>

        {/* GRILLA DE CUADRILLA */}
        <div className="alon-zone-entry p-5 md:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-xs uppercase tracking-wider font-bold text-primary flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>
                  Cuadrilla de Trabajo — {isMultiOtMode ? 'Modo Multi-Barco / Multi-OT Activo' : (selectedContractorGroup || 'Sin contratista habilitado')}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                {isSelectedGroupAstillero || isMultiOtMode
                  ? 'Habilitación abierta de Astillero: podés elegir cualquier operario del padrón y ajustar su rubro con la Puerta de Emergencia (🔓 Ajustar) cuando haga préstamos operativos.'
                  : `Imputación para ${selectedContractorGroup}. Podés alternar entre sus rubros habilitados del Padrón o abrir la Puerta de Emergencia.`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isSelectedGroupAstillero || isMultiOtMode ? (
                <button
                  type="button"
                  onClick={() => addOperarioRow({ worker_type: 'Astillero' })}
                  className="px-3 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Operario Astillero (9h)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => addOperarioRow({ worker_name: selectedContractorGroup, hours_normal: 8 })}
                  className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>+ Fila {selectedContractorGroup}</span>
                </button>
              )}
            </div>
          </div>

          {draftWorkerSummary.length > 0 && (
            <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800/90 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                Control Jornada en Cuadrilla:
              </span>
              {draftWorkerSummary.map(item => {
                const isAstillero = item.type === 'Astillero'
                const isExact9 = item.total === 9
                const isUnder9 = isAstillero && item.total < 9
                const isOver9 = isAstillero && item.total > 9
                return (
                  <span
                    key={item.name}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border font-mono flex items-center gap-1.5 ${
                      !isAstillero
                        ? 'bg-amber-950/40 border-amber-700/40 text-amber-200'
                        : isExact9
                        ? 'bg-emerald-950/50 border-emerald-700/50 text-emerald-300'
                        : isUnder9
                        ? 'bg-rose-950/60 border-rose-700/60 text-rose-300'
                        : 'bg-cyan-950/60 border-cyan-700/60 text-cyan-300'
                    }`}
                  >
                    <strong className="font-sans">{item.name}:</strong>
                    <span>
                      {item.parts.length > 1 ? `${item.parts.join('h + ')}h = ` : ''}
                      <strong>{item.total}h</strong>
                    </span>
                    {isAstillero && (
                      <span>
                        {isExact9 ? '✅' : isUnder9 ? '⚠️ (<9h)' : isOver9 ? '⚡ (>9h)' : ''}
                      </span>
                    )}
                  </span>
                )
              })}
            </div>
          )}

          {/* FILAS DE LA CUADRILLA */}
          <div className="overflow-x-auto pb-1">
            <div className={isMultiOtMode ? 'min-w-[1220px] space-y-2.5' : 'min-w-[980px] space-y-2.5'}>
              <div
                className={`grid ${
                  isMultiOtMode
                    ? 'grid-cols-[105px_minmax(190px,1.4fr)_minmax(180px,1.3fr)_minmax(210px,1.6fr)_68px_68px_68px_60px_minmax(150px,1.2fr)_36px]'
                    : 'grid-cols-[115px_minmax(200px,1.5fr)_minmax(190px,1.4fr)_72px_72px_72px_65px_minmax(150px,1.1fr)_38px]'
                } gap-2.5 px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400`}
              >
                <div>Tipo</div>
                <div>Operario / Prestador</div>
                <div>Rubro (Titular / 🔓 Emergencia)</div>
                {isMultiOtMode && <div>Barco & OT Habilitada (Por Fila)</div>}
                <div className="text-center">Normales</div>
                <div className="text-center text-cyan-400">Ext. 50%</div>
                <div className="text-center text-amber-400">Ext. 100%</div>
                <div className="text-center text-primary">Total</div>
                <div>Tarea / Observaciones</div>
                <div className="text-center"></div>
              </div>

              {operariosRows.map((row, index) => {
                const hNorm = parseFloat(row.hours_normal) || 0
                const h50 = parseFloat(row.hours_extra_50) || 0
                const h100 = parseFloat(row.hours_extra_100) || 0
                const totalRow = hNorm + h50 + h100

                const isRowEmergencyOpen = openRubroEmergencyIds.has(row.id) || Boolean(row.is_loaned_rubro)
                const hasLoanedRubro = Boolean(
                  row.worker_type === 'Astillero' &&
                    row.default_rubro &&
                    row.default_rubro !== 'General' &&
                    row.rubro &&
                    normalizeText(row.rubro) !== normalizeText(row.default_rubro)
                )

                const effectiveRowShipId = row.ship_id || selectedShipId
                const rowEnabledWorkOrders = workOrders.filter(wo => {
                  if (String(wo.ship_id) !== String(effectiveRowShipId)) return false
                  const itemsForWo = workItems.filter(
                    i => String(i.work_order_id) === String(wo.id) && i.status === 'En ejecución'
                  )
                  return itemsForWo.length > 0
                })

                return (
                  <div
                    key={row.id}
                    className={`p-3 rounded-xl border transition-colors ${
                      row.needs_review
                        ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-400/60'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div
                      className={`grid ${
                        isMultiOtMode
                          ? 'grid-cols-[105px_minmax(190px,1.4fr)_minmax(180px,1.3fr)_minmax(210px,1.6fr)_68px_68px_68px_60px_minmax(150px,1.2fr)_36px]'
                          : 'grid-cols-[115px_minmax(200px,1.5fr)_minmax(190px,1.4fr)_72px_72px_72px_65px_minmax(150px,1.1fr)_38px]'
                      } gap-2.5 items-center`}
                    >
                      {/* Nº y Tipo */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="w-5 h-5 shrink-0 rounded bg-slate-800 text-slate-300 font-mono text-[11px] font-bold flex items-center justify-center">
                          {index + 1}
                        </span>
                        <span
                          className={`w-[78px] text-[10px] font-bold px-1.5 py-1.5 rounded border text-center truncate ${
                            row.worker_type === 'Astillero'
                              ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                              : row.worker_type === 'Taller'
                              ? 'bg-purple-950 text-purple-300 border-purple-800'
                              : 'bg-amber-950 text-amber-300 border-amber-800'
                          }`}
                        >
                          {row.worker_type}
                        </span>
                      </div>

                      {/* Operario */}
                      <div className="space-y-1">
                        {row.homonym_candidates && row.homonym_candidates.length > 1 && (
                          <div className="p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-[10px] text-amber-200 space-y-1">
                            <div className="font-bold flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                              <span>Homónimo &ldquo;{row.worker_raw}&rdquo;: elegí operario</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {row.homonym_candidates.map(cand => (
                                <button
                                  key={cand.name}
                                  type="button"
                                  onClick={() => {
                                    const tInfo = parseWorkerTrades(cand.trade || 'General')
                                    setOperariosRows(prev =>
                                      prev.map(r =>
                                        r.id === row.id
                                          ? {
                                              ...r,
                                              worker_name: cand.name,
                                              default_rubro: tInfo.primaryLabel,
                                              allowed_trades: tInfo.labelList,
                                              rubro: r.rubro || tInfo.primaryLabel,
                                              homonym_candidates: [],
                                              worker_match_status: 'exact',
                                              needs_review: false
                                            }
                                          : r
                                      )
                                    )
                                  }}
                                  className="px-2 py-0.5 rounded bg-amber-500/30 hover:bg-amber-500/50 text-amber-100 border border-amber-400/40 text-[10px] font-semibold cursor-pointer"
                                >
                                  {cand.name} ({cand.trade})
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <input
                          type="text"
                          required
                          list="all-workers-datalist"
                          placeholder="Nombre del operario..."
                          value={row.worker_name}
                          onChange={(e) => updateOperarioRow(row.id, 'worker_name', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary font-medium"
                        />
                      </div>

                      {/* Rubro (Titular / Emergencia) */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            required
                            list="rubros-list-carga"
                            value={row.rubro}
                            onChange={(e) => updateOperarioRow(row.id, 'rubro', e.target.value)}
                            className={`w-full bg-slate-900 border rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary font-medium ${
                              hasLoanedRubro ? 'border-purple-500 text-purple-200' : 'border-slate-700'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => toggleRubroEmergency(row.id)}
                            className={`p-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors shrink-0 ${
                              isRowEmergencyOpen
                                ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                            }`}
                            title="Puerta de Emergencia: desbloquear lista completa de rubros para préstamos operativos"
                          >
                            🔓
                          </button>
                        </div>
                      </div>

                      {/* Modo Multi-Barco / Multi-OT por Fila */}
                      {isMultiOtMode && (
                        <div className="space-y-1">
                          <select
                            value={row.ship_id || selectedShipId}
                            onChange={(e) => updateOperarioRow(row.id, 'ship_id', e.target.value)}
                            className="w-full bg-slate-900 border border-purple-500/40 rounded-lg px-2 py-1 text-[11px] text-purple-200 focus:outline-none"
                          >
                            {ships.map(s => (
                              <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                                {cleanShipName(s.name)}
                              </option>
                            ))}
                          </select>
                          <select
                            value={row.work_order_id || selectedWorkOrderId}
                            onChange={(e) => updateOperarioRow(row.id, 'work_order_id', e.target.value)}
                            className="w-full bg-slate-900 border border-purple-500/40 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none"
                          >
                            <option value="" className="text-amber-300">-- ⚠️ OT en blanco --</option>
                            {rowEnabledWorkOrders.map(wo => (
                              <option key={wo.id} value={wo.id} className="bg-slate-900 text-white">
                                {wo.ot_number ? `${wo.ot_number} — ` : ''}{wo.title}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Horas Normales */}
                      <div>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="24"
                          value={row.hours_normal}
                          onChange={(e) => updateOperarioRow(row.id, 'hours_normal', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-1.5 py-1.5 text-xs text-white text-center font-bold focus:outline-none focus:border-primary font-mono"
                        />
                      </div>

                      {/* Extras 50% */}
                      <div>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="24"
                          value={row.hours_extra_50}
                          onChange={(e) => updateOperarioRow(row.id, 'hours_extra_50', e.target.value)}
                          className="w-full bg-slate-900 border border-cyan-800/60 rounded-lg px-1.5 py-1.5 text-xs text-cyan-300 text-center font-bold focus:outline-none focus:border-primary font-mono"
                        />
                      </div>

                      {/* Extras 100% */}
                      <div>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="24"
                          value={row.hours_extra_100}
                          onChange={(e) => updateOperarioRow(row.id, 'hours_extra_100', e.target.value)}
                          className="w-full bg-slate-900 border border-amber-800/60 rounded-lg px-1.5 py-1.5 text-xs text-amber-300 text-center font-bold focus:outline-none focus:border-primary font-mono"
                        />
                      </div>

                      {/* Total Hs Calculado */}
                      <div className="text-center font-mono font-extrabold text-primary text-xs bg-slate-900/80 py-1.5 rounded-lg border border-slate-800">
                        {totalRow} hs
                      </div>

                      {/* Observaciones / Tarea */}
                      <div>
                        <input
                          type="text"
                          placeholder="Tarea / Nota..."
                          value={row.notes}
                          onChange={(e) => updateOperarioRow(row.id, 'notes', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-primary"
                        />
                      </div>

                      {/* Eliminar Fila */}
                      <div className="flex justify-center">
                        <button
                          type="button"
                          disabled={operariosRows.length === 1}
                          onClick={() => removeOperarioRow(row.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded hover:bg-rose-500/10 cursor-pointer"
                          title="Eliminar fila"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* BARRA DE RESUMEN Y GUARDAR */}
          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                <span className="text-slate-400">Cuadrilla: </span>
                <strong className="text-white font-mono">{operariosRows.length} filas</strong>
              </div>
              <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                <span className="text-slate-400">Normales: </span>
                <strong className="text-slate-200 font-mono">{totalHorasNormales} hs</strong>
              </div>
              <div className="bg-cyan-950/60 border border-cyan-800/40 px-3 py-1.5 rounded-lg text-cyan-300">
                <span>Ext. 50%: </span>
                <strong className="font-mono">{totalHoras50} hs</strong>
              </div>
              <div className="bg-amber-950/60 border border-amber-800/40 px-3 py-1.5 rounded-lg text-amber-300">
                <span>Ext. 100%: </span>
                <strong className="font-mono">{totalHoras100} hs</strong>
              </div>
              <div className="bg-cyan-500/20 border border-cyan-500/40 px-3 py-1.5 rounded-lg text-primary">
                <span className="font-bold">Total General: </span>
                <strong className="font-mono text-sm">{totalHorasGenerales} hs</strong>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-gradient-to-r from-primary to-blue-500 text-slate-950 font-bold rounded-lg text-sm shadow-[0_0_20px_rgba(0,242,254,0.3)] hover:shadow-[0_0_30px_rgba(0,242,254,0.5)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{submitting ? 'Guardando en Supabase...' : 'Confirmar Registro Grupal'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* PLANILLA INTERACTIVA DE HORAS REGISTRADAS */}
      <div className="alon-workspace-block">
        {/* ZONA 3: BARRA DE BÚSQUEDA Y FILTROS */}
        <div className="alon-zone-toolbar p-3 rounded-2xl shadow-lg space-y-2.5">
          <CrawlerSearchBar
            value={filterWorker}
            onChange={setFilterWorker}
            onClear={() => {
              setFilterWorker('')
              setFilterDate('')
              setFilterShip('')
              setActiveKpiFilter('todos')
            }}
            inputRef={logSearchInputRef}
            placeholder="Buscar operario, buque, OT, rubro... (Ctrl+F | Esc limpia todo)"
          />

          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              />

              {(filterWorker || filterDate || filterShip || activeKpiFilter !== 'todos') && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterWorker('')
                    setFilterDate('')
                    setFilterShip('')
                    setActiveKpiFilter('todos')
                  }}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-slate-700"
                  title="Limpiar todos los filtros (Esc)"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Limpiar filtros</span>
                </button>
              )}

              <span className="text-[11px] text-slate-400 whitespace-nowrap hidden sm:inline">
                Mostrando {filteredLogs.length} de {recentLogs.length} registros
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {horasGrid.canUndo && (
                <button
                  type="button"
                  onClick={horasGrid.undo}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold shadow flex items-center gap-1 cursor-pointer border border-slate-700"
                  title="Deshacer último cambio (Ctrl+Z)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              {horasGrid.canRedo && (
                <button
                  type="button"
                  onClick={horasGrid.redo}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold shadow flex items-center gap-1 cursor-pointer border border-slate-700"
                  title="Rehacer cambio (Ctrl+Y)"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ZONA 4: HOJA DE CÁLCULO DE HORAS */}
        {filteredLogs.length === 0 ? (
          <div className="alon-zone-grid text-center py-10 text-slate-400 text-xs space-y-2">
            <p>No hay imputaciones que coincidan con los filtros seleccionados.</p>
            {activeKpiFilter === 'incompleta' && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('control_diario')
                  setDailyFilterType('incompleta')
                }}
                className="px-3 py-1.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/50 text-orange-300 font-bold cursor-pointer"
              >
                Ir a Control Diario de Nómina (Operarios con jornada incompleta hoy) &rarr;
              </button>
            )}
          </div>
        ) : (
          <div className="alon-zone-grid">
            <GridRibbon
              activeCellBadge={horasGrid.activeCellBadge}
              onInsertRow={handleInsertRow}
              insertRowLabel="Nueva Fila en Blanco"
              undoCount={horasGrid.undoStack?.length || 0}
              totalRows={filteredLogs.length}
              entityName="imputaciones"
              exportRows={filteredLogs}
              exportFilename={`horas_imputaciones_${new Date().toISOString().split('T')[0]}`}
            />

            <div
              tabIndex={0}
              onKeyDown={horasGrid.handleKeyDown}
              ref={horasGrid.gridContainerRef}
              className="alon-grid-scroll"
            >
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead className="sticky top-0 z-20 alon-grid-thead backdrop-blur-md">
                  <tr>
                    <th className="py-2.5 px-2 text-center w-8">
                      <input
                        type="checkbox"
                        checked={filteredLogs.length > 0 && filteredLogs.every(l => selectedLogIds.has(l.id))}
                        onChange={() => toggleSelectAllLogs(filteredLogs.map(l => l.id))}
                        className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-primary cursor-pointer accent-primary"
                        title="Seleccionar todas las imputaciones visibles"
                      />
                    </th>
                    <th className="py-2.5 px-3">Fecha ✎</th>
                    <th className="py-2.5 px-3">Barco / OT ✎</th>
                    <th className="py-2.5 px-3">Operario / Tipo ✎</th>
                    <th className="py-2.5 px-3">Rubro ✎</th>
                    <th className="py-2.5 px-2 text-center">Norm ✎</th>
                    <th className="py-2.5 px-2 text-center text-cyan-400">50% ✎</th>
                    <th className="py-2.5 px-2 text-center text-amber-400">100% ✎</th>
                    <th className="py-2.5 px-3 text-center text-primary font-bold">Total</th>
                    <th className="py-2.5 px-2 text-center">Estado ✎</th>
                    <th className="py-2.5 px-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredLogs.map((log, rowIndex) => {
                    const isSelected = selectedLogIds.has(log.id)
                    const shipDisplayName = cleanShipName(log.ships?.name || log.work_orders?.ships?.name || '') || 'Sin Buque'
                    const otNumber = log.work_orders?.ot_number
                    const otTitle = log.work_orders?.title

                    return (
                      <tr
                        key={log.id}
                        onContextMenu={(e) => openMenu(e, log, rowIndex, { entityType: 'daily_labor_logs', recordId: log.id, recordLabel: log.worker_name }, horasGrid)}
                        className={`transition-colors select-none ${
                          isSelected ? 'bg-cyan-950/50 hover:bg-cyan-950/70 border-l-2 border-l-cyan-400' : 'hover:bg-slate-800/30'
                        }`}
                      >
                        <td className="py-1 px-1 text-center whitespace-nowrap w-9">
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectLog(log.id)}
                              className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-primary cursor-pointer accent-primary"
                            />
                            <span
                              className="font-mono text-[9px] text-slate-500 font-bold leading-none select-none"
                              title={`Fila #${log._rowSeq || rowIndex + 1} (DNI Inviolable)`}
                            >
                              {log._rowSeq || rowIndex + 1}
                            </span>
                          </div>
                        </td>

                        {/* Fecha */}
                        {(() => {
                          const cp = getHorasCellProps(rowIndex, 'date_logged')
                          return (
                            <td
                              {...cp.domProps}
                              onDoubleClick={() => activateHorasCell(log, 'date_logged')}
                              className={`py-2 px-3 font-mono text-slate-300 cursor-pointer whitespace-nowrap ${cp.className}`}
                              title="Doble clic para editar Fecha"
                            >
                              {inlineLogEdit.id === log.id && inlineLogEdit.field === 'date_logged' ? (
                                <input
                                  type="date"
                                  autoFocus
                                  value={inlineLogEdit.value}
                                  onChange={(e) => setInlineLogEdit({ ...inlineLogEdit, value: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveInlineLogEdit(log.id, 'date_logged', inlineLogEdit.value)
                                    if (e.key === 'Escape') setInlineLogEdit({ id: null, field: null, value: '' })
                                  }}
                                  onBlur={() => saveInlineLogEdit(log.id, 'date_logged', inlineLogEdit.value)}
                                  className="bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                                />
                              ) : (
                                <span><HighlightText text={log.date_logged} query={filterWorker} /></span>
                              )}
                              {cp.renderHandle && (
                                <div
                                  onMouseDown={horasGrid.handleFillHandleMouseDown}
                                  onDoubleClick={horasGrid.handleFillHandleDoubleClick}
                                  className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md"
                                />
                              )}
                            </td>
                          )
                        })()}

                        {/* Barco / OT */}
                        {(() => {
                          const cp = getHorasCellProps(rowIndex, 'ship_wo')
                          return (
                            <td
                              {...cp.domProps}
                              onDoubleClick={() => activateHorasCell(log, 'ship_wo')}
                              className={`py-2 px-3 cursor-pointer ${cp.className}`}
                              title="Doble clic para cambiar Buque u Orden de Trabajo"
                            >
                              <span className="font-semibold text-white block truncate max-w-[160px]">
                                <HighlightText text={shipDisplayName} query={filterWorker} />
                              </span>
                              {log.work_order_id ? (
                                <span className="text-[11px] text-slate-400 block truncate max-w-[160px]">
                                  {otNumber ? <strong className="text-cyan-300 font-mono mr-1"><HighlightText text={otNumber} query={filterWorker} /></strong> : null}
                                  <HighlightText text={otTitle || 'OT'} query={filterWorker} />
                                </span>
                              ) : (
                                <span className="text-[10px] text-amber-400 font-bold">⚠️ Sin OT (Doble clic)</span>
                              )}
                              {cp.renderHandle && (
                                <div
                                  onMouseDown={horasGrid.handleFillHandleMouseDown}
                                  onDoubleClick={horasGrid.handleFillHandleDoubleClick}
                                  className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md"
                                />
                              )}
                            </td>
                          )
                        })()}

                        {/* Operario / Tipo */}
                        {(() => {
                          const cp = getHorasCellProps(rowIndex, 'worker_name')
                          return (
                            <td
                              {...cp.domProps}
                              onDoubleClick={() => activateHorasCell(log, 'worker_name')}
                              className={`py-2 px-3 cursor-pointer ${cp.className}`}
                              title="Doble clic para cambiar Operario"
                            >
                              {inlineLogEdit.id === log.id && inlineLogEdit.field === 'worker_name' ? (
                                <input
                                  type="text"
                                  list="all-workers-datalist"
                                  autoFocus
                                  value={inlineLogEdit.value}
                                  onChange={(e) => setInlineLogEdit({ ...inlineLogEdit, value: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveInlineLogEdit(log.id, 'worker_name', inlineLogEdit.value)
                                    if (e.key === 'Escape') setInlineLogEdit({ id: null, field: null, value: '' })
                                  }}
                                  onBlur={() => saveInlineLogEdit(log.id, 'worker_name', inlineLogEdit.value)}
                                  className="w-full min-w-[140px] bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                                />
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium text-slate-200">
                                    <HighlightText text={log.worker_name} query={filterWorker} />
                                  </span>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
                                    log.worker_type === 'Astillero'
                                      ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60'
                                      : log.worker_type === 'Taller'
                                      ? 'bg-purple-950/80 text-purple-300 border-purple-800/60'
                                      : 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                                  }`}>
                                    <HighlightText text={log.worker_type || 'Astillero'} query={filterWorker} />
                                  </span>
                                </div>
                              )}
                              {cp.renderHandle && (
                                <div
                                  onMouseDown={horasGrid.handleFillHandleMouseDown}
                                  onDoubleClick={horasGrid.handleFillHandleDoubleClick}
                                  className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md"
                                />
                              )}
                            </td>
                          )
                        })()}

                        {/* Rubro */}
                        {(() => {
                          const cp = getHorasCellProps(rowIndex, 'rubro')
                          return (
                            <td
                              {...cp.domProps}
                              onDoubleClick={() => activateHorasCell(log, 'rubro')}
                              className={`py-2 px-3 cursor-pointer ${cp.className}`}
                              title="Doble clic para editar Rubro"
                            >
                              {inlineLogEdit.id === log.id && inlineLogEdit.field === 'rubro' ? (
                                <input
                                  type="text"
                                  list="rubros-list-carga"
                                  autoFocus
                                  value={inlineLogEdit.value}
                                  onChange={(e) => setInlineLogEdit({ ...inlineLogEdit, value: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveInlineLogEdit(log.id, 'rubro', inlineLogEdit.value)
                                    if (e.key === 'Escape') setInlineLogEdit({ id: null, field: null, value: '' })
                                  }}
                                  onBlur={() => saveInlineLogEdit(log.id, 'rubro', inlineLogEdit.value)}
                                  className="w-32 bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                                />
                              ) : (
                                <span className={`px-2 py-0.5 rounded text-[11px] ${
                                  (log.rubro || '').toLowerCase().includes('feriado')
                                    ? 'bg-amber-950 text-amber-300 border border-amber-700/80 font-bold'
                                    : 'bg-slate-800 text-slate-300'
                                }`}>
                                  <HighlightText text={log.rubro || 'General'} query={filterWorker} />
                                </span>
                              )}
                              {cp.renderHandle && (
                                <div
                                  onMouseDown={horasGrid.handleFillHandleMouseDown}
                                  onDoubleClick={horasGrid.handleFillHandleDoubleClick}
                                  className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md"
                                />
                              )}
                            </td>
                          )
                        })()}

                        {/* Norm */}
                        {(() => {
                          const cp = getHorasCellProps(rowIndex, 'hours_normal')
                          return (
                            <td
                              {...cp.domProps}
                              onDoubleClick={() => activateHorasCell(log, 'hours_normal')}
                              className={`py-2 px-2 text-center font-mono cursor-pointer ${cp.className}`}
                              title="Doble clic para editar Horas Normales"
                            >
                              {inlineLogEdit.id === log.id && inlineLogEdit.field === 'hours_normal' ? (
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  max="24"
                                  autoFocus
                                  value={inlineLogEdit.value}
                                  onChange={(e) => setInlineLogEdit({ ...inlineLogEdit, value: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveInlineLogEdit(log.id, 'hours_normal', inlineLogEdit.value)
                                    if (e.key === 'Escape') setInlineLogEdit({ id: null, field: null, value: '' })
                                  }}
                                  onBlur={() => saveInlineLogEdit(log.id, 'hours_normal', inlineLogEdit.value)}
                                  className="w-14 bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-center text-xs text-white focus:outline-none font-mono"
                                />
                              ) : (
                                <span><HighlightText text={log.hours_normal ?? log.hours_worked ?? 0} query={filterWorker} /></span>
                              )}
                              {cp.renderHandle && (
                                <div
                                  onMouseDown={horasGrid.handleFillHandleMouseDown}
                                  onDoubleClick={horasGrid.handleFillHandleDoubleClick}
                                  className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md"
                                />
                              )}
                            </td>
                          )
                        })()}

                        {/* 50% */}
                        {(() => {
                          const cp = getHorasCellProps(rowIndex, 'hours_extra_50')
                          return (
                            <td
                              {...cp.domProps}
                              onDoubleClick={() => activateHorasCell(log, 'hours_extra_50')}
                              className={`py-2 px-2 text-center font-mono text-cyan-400 cursor-pointer ${cp.className}`}
                              title="Doble clic para editar Horas 50%"
                            >
                              {inlineLogEdit.id === log.id && inlineLogEdit.field === 'hours_extra_50' ? (
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  max="24"
                                  autoFocus
                                  value={inlineLogEdit.value}
                                  onChange={(e) => setInlineLogEdit({ ...inlineLogEdit, value: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveInlineLogEdit(log.id, 'hours_extra_50', inlineLogEdit.value)
                                    if (e.key === 'Escape') setInlineLogEdit({ id: null, field: null, value: '' })
                                  }}
                                  onBlur={() => saveInlineLogEdit(log.id, 'hours_extra_50', inlineLogEdit.value)}
                                  className="w-14 bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-center text-xs text-white focus:outline-none font-mono"
                                />
                              ) : (
                                <span><HighlightText text={log.hours_extra_50 || 0} query={filterWorker} /></span>
                              )}
                              {cp.renderHandle && (
                                <div
                                  onMouseDown={horasGrid.handleFillHandleMouseDown}
                                  onDoubleClick={horasGrid.handleFillHandleDoubleClick}
                                  className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md"
                                />
                              )}
                            </td>
                          )
                        })()}

                        {/* 100% */}
                        {(() => {
                          const cp = getHorasCellProps(rowIndex, 'hours_extra_100')
                          return (
                            <td
                              {...cp.domProps}
                              onDoubleClick={() => activateHorasCell(log, 'hours_extra_100')}
                              className={`py-2 px-2 text-center font-mono text-amber-400 cursor-pointer ${cp.className}`}
                              title="Doble clic para editar Horas 100%"
                            >
                              {inlineLogEdit.id === log.id && inlineLogEdit.field === 'hours_extra_100' ? (
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  max="24"
                                  autoFocus
                                  value={inlineLogEdit.value}
                                  onChange={(e) => setInlineLogEdit({ ...inlineLogEdit, value: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveInlineLogEdit(log.id, 'hours_extra_100', inlineLogEdit.value)
                                    if (e.key === 'Escape') setInlineLogEdit({ id: null, field: null, value: '' })
                                  }}
                                  onBlur={() => saveInlineLogEdit(log.id, 'hours_extra_100', inlineLogEdit.value)}
                                  className="w-14 bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-center text-xs text-white focus:outline-none font-mono"
                                />
                              ) : (
                                <span><HighlightText text={log.hours_extra_100 || 0} query={filterWorker} /></span>
                              )}
                              {cp.renderHandle && (
                                <div
                                  onMouseDown={horasGrid.handleFillHandleMouseDown}
                                  onDoubleClick={horasGrid.handleFillHandleDoubleClick}
                                  className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md"
                                />
                              )}
                            </td>
                          )
                        })()}

                        {/* Total */}
                        <td className="py-2 px-3 text-center font-mono font-bold text-primary whitespace-nowrap">
                          <HighlightText text={`${log.hours_worked} hs`} query={filterWorker} />
                        </td>

                        {/* Estado */}
                        {(() => {
                          const cp = getHorasCellProps(rowIndex, 'approval_status')
                          return (
                            <td {...cp.domProps} className={`py-2 px-2 text-center ${cp.className}`}>
                              <div className="flex items-center justify-center gap-1">
                                <select
                                  value={log.approval_status || ''}
                                  onChange={(e) => handleUpdateApprovalStatus(log.id, e.target.value)}
                                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border transition-colors cursor-pointer focus:outline-none bg-slate-950 ${
                                    log.approval_status === 'S' || log.approval_status === 'Aprobado'
                                      ? 'text-emerald-400 border-emerald-700/60'
                                      : log.approval_status === 'R'
                                      ? 'text-rose-400 border-rose-500/70'
                                      : log.approval_status === 'RR'
                                      ? 'text-amber-400 border-amber-500/70'
                                      : log.approval_status === 'RRR'
                                      ? 'text-cyan-400 border-cyan-500/70'
                                      : 'text-slate-400 border-slate-700'
                                  }`}
                                  title={`Estado de revisión de ${log.worker_name}`}
                                >
                                  <option value="">-</option>
                                  <option value="S">S (Aprobado)</option>
                                  <option value="R">R (Revisión)</option>
                                  <option value="RR">RR (Corregido)</option>
                                  <option value="RRR">RRR (Aprobado Fin)</option>
                                </select>
                                {log.review_reason && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReviewReasonModal({
                                        isOpen: true,
                                        logId: log.id,
                                        workerName: log.worker_name,
                                        dateLogged: log.date_logged,
                                        shipWo: `${shipDisplayName} - ${otTitle || 'Sin OT'}`,
                                        targetStatus: log.approval_status || 'R',
                                        reason: log.review_reason || '',
                                        response: log.worker_response || ''
                                      })
                                    }}
                                    className="p-1 text-rose-400 hover:text-rose-300 rounded hover:bg-rose-900/40 transition-colors"
                                    title={`Motivo de observación (R): ${log.review_reason}`}
                                  >
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                  </button>
                                )}
                              </div>
                              {cp.renderHandle && (
                                <div
                                  onMouseDown={horasGrid.handleFillHandleMouseDown}
                                  onDoubleClick={horasGrid.handleFillHandleDoubleClick}
                                  className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md"
                                />
                              )}
                            </td>
                          )
                        })()}

                        {/* Acciones */}
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditFromDaily(log)}
                              className="p-1 text-slate-400 hover:text-primary rounded hover:bg-slate-800"
                              title="Editar en ventana"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateLog(log)}
                              className="p-1 text-amber-400 hover:text-amber-300 rounded hover:bg-amber-500/10"
                              title="Duplicar fila"
                            >
                              <CopyPlus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLog(log.id, log.worker_name)}
                              className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-500/10"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Menú Contextual canónico */}
            {menuTarget && (
              <GridContextMenu
                target={menuTarget}
                onClose={closeMenu}
                onCopyCell={horasGrid.copyActiveCell}
                onCopyRow={horasGrid.copyRow}
                onPaste={horasGrid.pasteToActiveOrRange}
                onDeleteCell={horasGrid.deleteActiveCellOrRange}
                onDuplicateRow={(row) => handleDuplicateLog(row)}
                onDeleteRow={(row) => handleDeleteLog(row.id, row.worker_name)}
                entityType={menuTarget.entityType}
                recordId={menuTarget.recordId}
                recordLabel={menuTarget.recordLabel}
              />
            )}

            {/* Barra flotante inferior de estado */}
            <GridStatusBarBottom
              filteredCount={filteredLogs.length}
              totalCount={recentLogs.length}
              entityName="imputaciones"
              hasActiveFilter={Boolean(filterWorker || filterDate || filterShip || (activeKpiFilter && activeKpiFilter !== 'todos'))}
              onClearFilters={() => {
                setFilterWorker('')
                setFilterDate('')
                setFilterShip('')
                setActiveKpiFilter('todos')
              }}
              selectionStats={horasGrid.selectionStats}
              onClearSelection={() => horasGrid.setSelectionRange(null)}
              customSelection={selectedLogIds.size > 0 ? {
                count: selectedLogIds.size,
                label: 'filas tildadas',
                onClear: () => setSelectedLogIds(new Set())
              } : null}
              globalAggregates={[
                { label: 'Σ Horas', value: hoursStats.sumTotalHours.toFixed(1), highlight: true },
                { label: 'Norm', value: hoursStats.sumNorm.toFixed(1) },
                { label: '50%', value: hoursStats.sum50.toFixed(1) },
                { label: '100%', value: hoursStats.sum100.toFixed(1) },
                { label: 'Ø Horas', value: hoursStats.avgHours.toFixed(1) }
              ]}
            />
          </div>
        )}
      </div>
    </div>
  )
}
