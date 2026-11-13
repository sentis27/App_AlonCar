import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  FileSpreadsheet,
  Building2,
  HardHat,
  Plus,
  Search,
  Lock,
  Unlock,
  History,
  X,
  Check,
  CheckCheck,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  Save,
  Pencil,
  Undo2,
  Redo2,
  Square,
  CheckSquare,
  ArrowRight,
  ChevronDown,
  Calendar,
  HelpCircle
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { fetchMacroVariables } from '../../lib/macroVariablesService'
import { useSpreadsheetGrid } from '../../hooks/useSpreadsheetGrid'
import CrawlerSearchBar from '../CrawlerSearchBar'
import GridRibbon from '../GridRibbon'
import GridStatusBarBottom from '../GridStatusBarBottom'
import GridContextMenu from '../GridContextMenu'
import HighlightText from '../HighlightText'
import { duplicateRecord, buildPasteRowHandler } from '../../lib/gridRowActions'
import { matchesUniversalSearch } from '../../lib/searchEngine'
import { auditService } from '../../lib/auditService'
import { assignMonotonicFolios } from '../../lib/monotonicFolioEngine'

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

const ASTILLERO_BASE_CATEGORIES = [
  'AYUDANTE',
  'OFICIAL',
  '1/2 OFICIAL',
  'APRENDIZ',
  'OFICIAL BLACK'
]

export const getCategoryBadgeStyle = (category = '') => {
  const c = (category || '').toUpperCase().trim()
  if (c === 'AYUDANTE') return 'bg-[#00E5FF] text-slate-950 border-[#00B8D4] font-black'
  if (c === 'OFICIAL') return 'bg-[#00E676] text-slate-950 border-[#00C853] font-black'
  if (c === '1/2 OFICIAL') return 'bg-[#FF00D4] text-white border-[#D500F9] font-black'
  if (c === 'APRENDIZ') return 'bg-[#FFEA00] text-slate-950 border-[#FFD600] font-black'
  if (c.includes('BLACK') || c === 'OFICIAL BLACK') return 'bg-black text-white border-slate-700 font-black'
  return 'bg-slate-900 text-slate-300 border-slate-800 font-medium'
}

export default function PersonalTarifarioPanel({ currentPeriodKey: initialPeriodKey, onPeriodChange, workers = [] }) {
  const [rateYear, setRateYear] = useState(2026)
  const [rateMonth, setRateMonth] = useState(10)
  const [rateQuincena, setRateQuincena] = useState(1)
  const [dollarRate, setDollarRate] = useState(1500)
  const [rateCards, setRateCards] = useState([])
  const [allRecordedPeriods, setAllRecordedPeriods] = useState([])
  const [allRateCardRecords, setAllRateCardRecords] = useState([])
  const [loadingRateCards, setLoadingRateCards] = useState(false)
  const [savingRateCard, setSavingRateCard] = useState(false)
  const [filterTableCenter, setFilterTableCenter] = useState('todos')
  const [rateTableSearch, setRateTableSearch] = useState('')
  const [rateTableScope, setRateTableScope] = useState('current') // 'current' | 'all'
  const [contextMenuTarget, setContextMenuTarget] = useState(null)
  const [statusMessage, setStatusMessage] = useState(null)
  const [inlineRateEdit, setInlineRateEdit] = useState(null)

  const [rateAdminCenter, setRateAdminCenter] = useState('ASTILLERO')
  const [astilleroForm, setAstilleroForm] = useState({
    'AYUDANTE': { ars: 14595.84, usd: 9.73 },
    'OFICIAL': { ars: 16365.76, usd: 10.91 },
    '1/2 OFICIAL': { ars: 15069.14, usd: 10.05 },
    'APRENDIZ': { ars: 13656.80, usd: 9.10 },
    'OFICIAL BLACK': { ars: 18500.00, usd: 12.33 }
  })

  const [selectedContractor, setSelectedContractor] = useState('RAMON ARANDA')
  const [contractorHasAyudante, setContractorHasAyudante] = useState(true)
  const [contractorOficialArs, setContractorOficialArs] = useState(17500)
  const [contractorOficialUsd, setContractorOficialUsd] = useState(11.67)
  const [contractorAyudanteArs, setContractorAyudanteArs] = useState(13500)
  const [contractorAyudanteUsd, setContractorAyudanteUsd] = useState(9.00)

  const [periodSearchInput, setPeriodSearchInput] = useState('')
  const [isPeriodSelectOpen, setIsPeriodSelectOpen] = useState(false)
  const [isNewPeriodModalOpen, setIsNewPeriodModalOpen] = useState(false)
  const [newPeriodYear, setNewPeriodYear] = useState(2026)
  const [newPeriodMonth, setNewPeriodMonth] = useState(11)
  const [newPeriodQuincena, setNewPeriodQuincena] = useState(2)
  const [macroVarsList, setMacroVarsList] = useState([])
  const [newPeriodCopyLast, setNewPeriodCopyLast] = useState(true)
  const [creatingNewPeriod, setCreatingNewPeriod] = useState(false)

  const periodDropdownRef = useRef(null)
  const tarifarioFormRef = useRef(null)
  const rateSearchInputRef = useRef(null)
  const ratesPasteRef = useRef(null)
  const [isTargetFocusGlow, setIsTargetFocusGlow] = useState(false)

  const [orgRoles, setOrgRoles] = useState({
    'LIQUIDACION_SUELDOS': { title: 'Responsable de Liquidación de Sueldos y RRHH', holder: 'María José' },
    'DIRECCION_OPERACIONES': { title: 'Dirección Operativa y Negociaciones', holder: 'Hugo Obregozo' },
    'OFICINA_TECNICA': { title: 'Oficina Técnica & Subcontratos', holder: 'Omar' },
    'SUPERVISION_OBRA': { title: 'Supervisión de Obra & Pañol', holder: 'Jorge' },
    'TESORERIA': { title: 'Tesorería & Pagos', holder: 'Graciela' }
  })

  const currentPeriodKey = useMemo(() => {
    return `${rateYear}-${String(rateMonth).padStart(2, '0')}-${rateQuincena}Q`
  }, [rateYear, rateMonth, rateQuincena])

  useEffect(() => {
    onPeriodChange?.(currentPeriodKey)
  }, [currentPeriodKey, onPeriodChange])

  useEffect(() => {
    loadRecordedPeriods()
    loadOrgRoles()
    fetchMacroVariables().then((rows) => setMacroVarsList(rows || [])).catch(() => {})
  }, [])

  useEffect(() => {
    loadRateCards(currentPeriodKey)
  }, [currentPeriodKey])

  useEffect(() => {
    function handleClickOutsidePeriodSelect(event) {
      if (periodDropdownRef.current && !periodDropdownRef.current.contains(event.target)) {
        setIsPeriodSelectOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutsidePeriodSelect)
    return () => document.removeEventListener('mousedown', handleClickOutsidePeriodSelect)
  }, [])

  const showGridFeedback = useCallback((type, text) => {
    setStatusMessage({ type, text })
    setTimeout(() => setStatusMessage(null), 3500)
  }, [])

  async function loadOrgRoles() {
    try {
      const { data, error } = await supabase.from('organization_roles').select('*')
      if (error) throw error
      if (data && data.length > 0) {
        const map = {}
        data.forEach(r => {
          map[r.role_key] = { title: r.role_title, holder: r.holder_name, dept: r.department }
        })
        setOrgRoles(prev => ({ ...prev, ...map }))
      }
    } catch (err) {
      console.warn('Cargando roles por defecto en tarifario:', err)
    }
  }

  async function loadRecordedPeriods() {
    try {
      const { data, error } = await supabase.from('rate_cards').select('*')
      if (error) throw error
      if (data) {
        setAllRateCardRecords(data)
        const map = new Map()
        data.forEach(d => {
          if (!map.has(d.period)) {
            map.set(d.period, {
              period: d.period,
              year: d.year,
              month: d.month,
              quincena: d.quincena,
              dollar_rate: d.dollar_rate
            })
          }
        })
        const unique = Array.from(map.values())
        unique.sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year
          if (a.month !== b.month) return a.month - b.month
          return a.quincena - b.quincena
        })
        setAllRecordedPeriods(unique)
      }
    } catch (err) {
      console.warn('Error al cargar períodos registrados:', err)
    }
  }

  async function loadRateCards(periodToLoad, scope = rateTableScope) {
    try {
      setLoadingRateCards(true)
      let query = supabase.from('rate_cards').select('*')
      if (scope === 'current') {
        query = query.eq('period', periodToLoad)
      }

      const { data, error } = await query
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .order('quincena', { ascending: false })
        .order('admin_center', { ascending: true })
        .order('entity_name', { ascending: true })

      if (error) throw error

      if (data && data.length > 0) {
        setRateCards(assignMonotonicFolios(data, { dateField: 'created_at' }))
        const currentPeriodRows = data.filter(d => d.period === periodToLoad)
        if (currentPeriodRows.length > 0 && currentPeriodRows[0].dollar_rate) {
          const dVal = parseFloat(currentPeriodRows[0].dollar_rate) || 1500
          setDollarRate(dVal)
        }

        const astilleroRows = data.filter(d => d.period === periodToLoad && d.admin_center === 'ASTILLERO')
        if (astilleroRows.length > 0) {
          setAstilleroForm(prev => {
            const next = { ...prev }
            astilleroRows.forEach(row => {
              if (next[row.entity_name]) {
                next[row.entity_name] = {
                  ars: parseFloat(row.rate_oficial_ars) || 0,
                  usd: parseFloat(row.rate_oficial_usd) || 0
                }
              }
            })
            return next
          })
        }
      } else {
        setRateCards([])
      }
    } catch (err) {
      console.warn('Error cargando rate_cards:', err)
      setRateCards([])
    } finally {
      setLoadingRateCards(false)
    }
  }

  const sortedRecordedPeriods = useMemo(() => {
    return [...allRecordedPeriods].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      if (a.month !== b.month) return a.month - b.month
      return a.quincena - b.quincena
    })
  }, [allRecordedPeriods])

  const rateCardsByPeriod = useMemo(() => {
    const lookup = {}
    allRateCardRecords.forEach(r => {
      if (!lookup[r.period]) {
        lookup[r.period] = {
          dollar_rate: r.dollar_rate,
          astillero: {},
          contractors: {}
        }
      }
      if (r.admin_center === 'ASTILLERO') {
        lookup[r.period].astillero[r.entity_name] = {
          ars: parseFloat(r.rate_oficial_ars) || 0,
          usd: parseFloat(r.rate_oficial_usd) || 0
        }
      } else if (r.admin_center === 'CONTRATISTA') {
        lookup[r.period].contractors[r.entity_name] = {
          oficialArs: parseFloat(r.rate_oficial_ars) || 0,
          oficialUsd: parseFloat(r.rate_oficial_usd) || 0,
          ayudanteArs: r.rate_ayudante_ars ? parseFloat(r.rate_ayudante_ars) : null,
          ayudanteUsd: r.rate_ayudante_usd ? parseFloat(r.rate_ayudante_usd) : null,
          hasAyudante: Boolean(r.has_ayudante)
        }
      }
    })
    return lookup
  }, [allRateCardRecords])

  const last10RecordedPeriods = useMemo(() => {
    return sortedRecordedPeriods.slice(-10)
  }, [sortedRecordedPeriods])

  const nextCorrelativePeriod = useMemo(() => {
    if (sortedRecordedPeriods.length === 0) {
      return { year: 2026, month: 11, quincena: 2, period: '2026-11-2Q' }
    }
    const last = sortedRecordedPeriods[sortedRecordedPeriods.length - 1]
    let nextYear = last.year
    let nextMonth = last.month
    let nextQuincena = last.quincena === 1 ? 2 : 1
    if (last.quincena === 2) {
      if (last.month === 12) {
        nextYear = last.year + 1
        nextMonth = 1
      } else {
        nextMonth = last.month + 1
      }
    }
    const nextKey = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${nextQuincena}Q`
    return { year: nextYear, month: nextMonth, quincena: nextQuincena, period: nextKey }
  }, [sortedRecordedPeriods])

  const filteredSelectablePeriods = useMemo(() => {
    if (!periodSearchInput || !periodSearchInput.trim()) {
      return sortedRecordedPeriods
    }
    const query = periodSearchInput.trim().toLowerCase()
    return sortedRecordedPeriods.filter(p => {
      const pKey = (p.period || '').toLowerCase()
      const mName = MONTH_NAMES[p.month - 1] ? MONTH_NAMES[p.month - 1].toLowerCase() : ''
      const qDesc = p.quincena === 1 ? '1ra quincena primera 1q' : '2da quincena segunda 2q'
      return pKey.includes(query) || mName.includes(query) || qDesc.includes(query)
    })
  }, [sortedRecordedPeriods, periodSearchInput])

  const rootContractorsMap = useMemo(() => {
    const map = {}
    const contractors = workers.filter(w => (w.admin_center || '').toUpperCase() === 'CONTRATISTA')
    contractors.forEach(c => {
      const rawGroup = (c.work_group || '').trim().toUpperCase()
      const isAyudanteGroup = rawGroup.endsWith(' AYUDANTE')
      const root = isAyudanteGroup ? rawGroup.replace(/\s+AYUDANTE$/, '').trim() : rawGroup
      if (!root) return
      if (!map[root]) {
        map[root] = {
          name: root,
          hasAyudanteOption: false,
          oficialRateArs: 0,
          ayudanteRateArs: 0,
          workersCount: 0
        }
      }
      const rateArs = parseFloat(c.hourly_rate_ars) || 0
      const isAy = isAyudanteGroup || (c.category || '').toUpperCase().includes('AYUDANTE')
      if (isAy) {
        map[root].hasAyudanteOption = true
        if (rateArs > 0) map[root].ayudanteRateArs = rateArs
      } else {
        if (rateArs > 0) map[root].oficialRateArs = rateArs
      }
      map[root].workersCount += 1
    })
    return map
  }, [workers])

  const uniqueContractorList = useMemo(() => {
    const list = Object.keys(rootContractorsMap)
    if (list.length > 0) return list.sort()
    const set = new Set()
    rateCards.forEach(rc => {
      if (rc.admin_center === 'CONTRATISTA' && rc.entity_name) set.add(rc.entity_name)
    })
    return Array.from(set).sort()
  }, [rootContractorsMap, rateCards])

  const handleSelectPeriod = (p) => {
    setRateYear(p.year)
    setRateMonth(p.month)
    setRateQuincena(p.quincena)
    if (p.dollar_rate) {
      setDollarRate(parseFloat(p.dollar_rate))
    }
    setIsPeriodSelectOpen(false)
    setPeriodSearchInput('')
  }

  const resolveAdminDollarRate = useCallback((y, m, q, rows = macroVarsList) => {
    const exact = rows.find((mv) => Number(mv.year) === Number(y) && Number(mv.month) === Number(m))
    const fallbackRow = exact || rows[0]
    if (!fallbackRow) return dollarRate || 1500
    const qRate = Number(q) === 1
      ? (fallbackRow.dollar_rate_1q || fallbackRow.dollar_rate)
      : (fallbackRow.dollar_rate_2q || fallbackRow.dollar_rate)
    return parseFloat(qRate) || dollarRate || 1500
  }, [macroVarsList, dollarRate])

  const newPeriodDollarRate = useMemo(
    () => resolveAdminDollarRate(newPeriodYear, newPeriodMonth, newPeriodQuincena),
    [newPeriodYear, newPeriodMonth, newPeriodQuincena, resolveAdminDollarRate]
  )

  const handleOpenNewPeriodModal = async () => {
    setNewPeriodYear(nextCorrelativePeriod.year)
    setNewPeriodMonth(nextCorrelativePeriod.month)
    setNewPeriodQuincena(nextCorrelativePeriod.quincena)
    setNewPeriodCopyLast(true)
    try {
      const freshMacro = await fetchMacroVariables()
      setMacroVarsList(freshMacro || [])
    } catch (err) {
      console.warn('Usando cotización macro en memoria:', err)
    }
    setIsNewPeriodModalOpen(true)
  }

  const handleConfirmNewPeriod = async () => {
    const targetKey = `${newPeriodYear}-${String(newPeriodMonth).padStart(2, '0')}-${newPeriodQuincena}Q`
    const exists = sortedRecordedPeriods.some(p => p.period === targetKey)
    if (exists) {
      setRateYear(newPeriodYear)
      setRateMonth(newPeriodMonth)
      setRateQuincena(newPeriodQuincena)
      setIsNewPeriodModalOpen(false)
      showGridFeedback('info', `La quincena ${targetKey} ya existía y fue seleccionada.`)
      return
    }

    setCreatingNewPeriod(true)
    try {
      const userHolder = orgRoles['LIQUIDACION_SUELDOS']?.holder || 'María José'
      const newDollar = parseFloat(newPeriodDollarRate) || 1500

      if (newPeriodCopyLast && sortedRecordedPeriods.length > 0) {
        const lastPeriodKey = sortedRecordedPeriods[sortedRecordedPeriods.length - 1].period
        const lastRecords = allRateCardRecords.filter(r => r.period === lastPeriodKey)
        if (lastRecords.length > 0) {
          const rowsToInsert = lastRecords.map(r => ({
            period: targetKey,
            year: newPeriodYear,
            month: newPeriodMonth,
            quincena: newPeriodQuincena,
            admin_center: r.admin_center,
            entity_name: r.entity_name,
            rate_oficial_ars: r.rate_oficial_ars,
            rate_oficial_usd: newDollar > 0 ? Number((r.rate_oficial_ars / newDollar).toFixed(2)) : 0,
            rate_ayudante_ars: r.rate_ayudante_ars,
            rate_ayudante_usd: (newDollar > 0 && r.rate_ayudante_ars) ? Number((r.rate_ayudante_ars / newDollar).toFixed(2)) : null,
            has_ayudante: r.has_ayudante,
            dollar_rate: newDollar,
            updated_by: userHolder,
            updated_at: new Date().toISOString()
          }))
          const { error } = await supabase.from('rate_cards').upsert(rowsToInsert, { onConflict: 'period,admin_center,entity_name' })
          if (error) throw error
        }
      } else {
        const baseAstilleroRows = ASTILLERO_BASE_CATEGORIES.map(cat => ({
          period: targetKey,
          year: newPeriodYear,
          month: newPeriodMonth,
          quincena: newPeriodQuincena,
          admin_center: 'ASTILLERO',
          entity_name: cat,
          rate_oficial_ars: 0,
          rate_oficial_usd: 0,
          has_ayudante: false,
          dollar_rate: newDollar,
          updated_by: userHolder,
          updated_at: new Date().toISOString()
        }))
        const { error } = await supabase.from('rate_cards').upsert(baseAstilleroRows, { onConflict: 'period,admin_center,entity_name' })
        if (error) throw error

        const zeroAstilleroForm = {}
        ASTILLERO_BASE_CATEGORIES.forEach(cat => {
          zeroAstilleroForm[cat] = { ars: 0, usd: 0 }
        })
        setAstilleroForm(zeroAstilleroForm)
        setContractorOficialArs(0)
        setContractorOficialUsd(0)
        setContractorAyudanteArs(0)
        setContractorAyudanteUsd(0)
      }

      await auditService.logRowAction({
        action: 'ROW_INSERT',
        entityType: 'rate_cards',
        entityName: targetKey,
        rowData: { period: targetKey, dollar_rate: newDollar },
        sheetName: 'Personal · Tarifario Quincenal',
        moduleRoute: '/personal'
      })

      setRateYear(newPeriodYear)
      setRateMonth(newPeriodMonth)
      setRateQuincena(newPeriodQuincena)
      setDollarRate(newDollar)
      setIsNewPeriodModalOpen(false)

      await loadRecordedPeriods()
      await loadRateCards(targetKey)
      showGridFeedback('success', `Nueva quincena ${targetKey} creada con éxito.`)
    } catch (err) {
      console.error(err)
      showGridFeedback('error', `Error al crear nueva quincena: ${err.message}`)
    } finally {
      setCreatingNewPeriod(false)
    }
  }

  const handleSelectContractor = (contractorName) => {
    setSelectedContractor(contractorName)
    const existing = rateCards.find(rc => rc.period === currentPeriodKey && rc.admin_center === 'CONTRATISTA' && rc.entity_name === contractorName)
    if (existing) {
      setContractorHasAyudante(existing.has_ayudante)
      setContractorOficialArs(parseFloat(existing.rate_oficial_ars) || 0)
      setContractorOficialUsd(parseFloat(existing.rate_oficial_usd) || 0)
      setContractorAyudanteArs(existing.rate_ayudante_ars ? parseFloat(existing.rate_ayudante_ars) : 0)
      setContractorAyudanteUsd(existing.rate_ayudante_usd ? parseFloat(existing.rate_ayudante_usd) : 0)
    } else {
      const meta = rootContractorsMap[contractorName]
      const hasAy = meta ? meta.hasAyudanteOption : false
      setContractorHasAyudante(hasAy)
      const ofArs = meta && meta.oficialRateArs > 0 ? meta.oficialRateArs : 18000
      setContractorOficialArs(ofArs)
      setContractorOficialUsd(dollarRate > 0 ? Number((ofArs / dollarRate).toFixed(2)) : 0)
      const ayArs = meta && meta.ayudanteRateArs > 0 ? meta.ayudanteRateArs : (hasAy ? 13500 : 0)
      setContractorAyudanteArs(ayArs)
      setContractorAyudanteUsd(dollarRate > 0 ? Number((ayArs / dollarRate).toFixed(2)) : 0)
    }
  }

  const handleSaveAstilleroRates = async () => {
    setSavingRateCard(true)
    try {
      for (const cat of ASTILLERO_BASE_CATEGORIES) {
        const ars = parseFloat(astilleroForm[cat]?.ars) || 0
        const usd = dollarRate > 0 ? Number((ars / dollarRate).toFixed(2)) : 0

        const { error } = await supabase
          .from('rate_cards')
          .upsert({
            period: currentPeriodKey,
            year: rateYear,
            month: rateMonth,
            quincena: rateQuincena,
            admin_center: 'ASTILLERO',
            entity_name: cat,
            rate_oficial_ars: ars,
            rate_oficial_usd: usd,
            rate_ayudante_ars: null,
            rate_ayudante_usd: null,
            has_ayudante: false,
            dollar_rate: dollarRate,
            updated_by: orgRoles['LIQUIDACION_SUELDOS']?.holder || 'María José',
            updated_at: new Date().toISOString()
          }, { onConflict: 'period,admin_center,entity_name' })

        if (error) throw error

        if (ars > 0) {
          await supabase
            .from('workers')
            .update({ hourly_rate_ars: ars, hourly_rate_usd: usd })
            .eq('admin_center', 'ASTILLERO')
            .eq('category', cat)
        }
      }

      await loadRateCards(currentPeriodKey)
      await loadRecordedPeriods()

      await auditService.logRowAction({
        action: 'ROW_UPDATE',
        entityType: 'rate_cards',
        entityName: `Astillero · ${currentPeriodKey}`,
        rowData: { period: currentPeriodKey, rates: astilleroForm, dollarRate },
        sheetName: 'Personal · Tarifario Quincenal',
        moduleRoute: '/personal'
      })

      showGridFeedback('success', `Escala sindical guardada para la quincena ${currentPeriodKey} y sincronizada con el padrón.`)
    } catch (err) {
      console.error(err)
      showGridFeedback('error', `Error al guardar escala: ${err.message}`)
    } finally {
      setSavingRateCard(false)
    }
  }

  const handleSaveContractorRate = async () => {
    if (!selectedContractor) return
    setSavingRateCard(true)
    try {
      const ofArs = parseFloat(contractorOficialArs) || 0
      const ofUsd = dollarRate > 0 ? Number((ofArs / dollarRate).toFixed(2)) : 0
      const ayArs = contractorHasAyudante ? (parseFloat(contractorAyudanteArs) || 0) : null
      const ayUsd = contractorHasAyudante && dollarRate > 0 && ayArs ? Number((ayArs / dollarRate).toFixed(2)) : null

      const { error } = await supabase
        .from('rate_cards')
        .upsert({
          period: currentPeriodKey,
          year: rateYear,
          month: rateMonth,
          quincena: rateQuincena,
          admin_center: 'CONTRATISTA',
          entity_name: selectedContractor,
          rate_oficial_ars: ofArs,
          rate_oficial_usd: ofUsd,
          rate_ayudante_ars: ayArs,
          rate_ayudante_usd: ayUsd,
          has_ayudante: contractorHasAyudante,
          dollar_rate: dollarRate,
          updated_by: orgRoles['LIQUIDACION_SUELDOS']?.holder || 'María José',
          updated_at: new Date().toISOString()
        }, { onConflict: 'period,admin_center,entity_name' })

      if (error) throw error

      if (contractorHasAyudante && ayArs > 0) {
        await supabase
          .from('workers')
          .update({ hourly_rate_ars: ayArs, hourly_rate_usd: ayUsd })
          .eq('admin_center', 'CONTRATISTA')
          .or(`work_group.eq.${selectedContractor} AYUDANTE,category.eq.${selectedContractor} AYUDANTE`)

        await supabase
          .from('workers')
          .update({ hourly_rate_ars: ofArs, hourly_rate_usd: ofUsd })
          .eq('admin_center', 'CONTRATISTA')
          .eq('work_group', selectedContractor)
          .neq('category', `${selectedContractor} AYUDANTE`)
      } else if (ofArs > 0) {
        await supabase
          .from('workers')
          .update({ hourly_rate_ars: ofArs, hourly_rate_usd: ofUsd })
          .eq('admin_center', 'CONTRATISTA')
          .eq('work_group', selectedContractor)
      }

      await loadRateCards(currentPeriodKey)
      await loadRecordedPeriods()

      await auditService.logRowAction({
        action: 'ROW_UPDATE',
        entityType: 'rate_cards',
        entityName: `${selectedContractor} · ${currentPeriodKey}`,
        rowData: { admin_center: 'CONTRATISTA', contractor: selectedContractor, period: currentPeriodKey, ofArs, ayArs, dollarRate },
        sheetName: 'Personal · Tarifario Quincenal',
        moduleRoute: '/personal'
      })

      showGridFeedback('success', `Tarifa para contratista ${selectedContractor} guardada (${currentPeriodKey}) y sincronizada.`)
    } catch (err) {
      console.error(err)
      showGridFeedback('error', `Error al guardar contratista: ${err.message}`)
    } finally {
      setSavingRateCard(false)
    }
  }

  const handleLoadRateCard = (rc) => {
    if (rc.year && rc.month && rc.quincena) {
      setRateYear(rc.year)
      setRateMonth(rc.month)
      setRateQuincena(rc.quincena)
    }
    if (rc.admin_center === 'ASTILLERO') {
      setRateAdminCenter('ASTILLERO')
      if (rc.rate_oficial_ars) {
        setAstilleroForm(prev => ({
          ...prev,
          [rc.entity_name]: {
            ars: parseFloat(rc.rate_oficial_ars) || 0,
            usd: parseFloat(rc.rate_oficial_usd) || 0
          }
        }))
      }
    } else {
      setRateAdminCenter('CONTRATISTA')
      handleSelectContractor(rc.entity_name)
      setContractorOficialArs(parseFloat(rc.rate_oficial_ars) || 0)
      setContractorOficialUsd(parseFloat(rc.rate_oficial_usd) || 0)
      setContractorHasAyudante(rc.has_ayudante)
      setContractorAyudanteArs(rc.rate_ayudante_ars ? parseFloat(rc.rate_ayudante_ars) : 0)
      setContractorAyudanteUsd(rc.rate_ayudante_usd ? parseFloat(rc.rate_ayudante_usd) : 0)
    }
    showGridFeedback('info', `Editando valores de ${rc.entity_name} para la quincena ${rc.period}.`)
    if (tarifarioFormRef.current) {
      tarifarioFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setIsTargetFocusGlow(true)
      setTimeout(() => setIsTargetFocusGlow(false), 2200)
    }
  }

  const filteredRateCards = useMemo(() => {
    return rateCards.filter(rc => {
      if (filterTableCenter !== 'todos' && rc.admin_center !== filterTableCenter) return false
      if (rateTableSearch && !matchesUniversalSearch(rc, rateTableSearch)) return false
      return true
    })
  }, [rateCards, filterTableCenter, rateTableSearch])

  const rateColumns = useMemo(() => [
    { key: 'rate_oficial_ars', label: 'Oficial AR$' },
    { key: 'rate_ayudante_ars', label: 'Ayudante AR$' }
  ], [])

  const canEditRateCell = useCallback((rc, colKeyOrDef) => {
    if (!rc || rc.is_locked) return false
    const key = typeof colKeyOrDef === 'string' ? colKeyOrDef : colKeyOrDef?.key
    if (key === 'rate_ayudante_ars') {
      return rc.admin_center === 'CONTRATISTA' && Boolean(rc.has_ayudante || rc.rate_ayudante_ars !== null)
    }
    return true
  }, [])

  const applyRateCardSinglePatch = useCallback(async (rowId, colKey, rawValue) => {
    if (auditService.isInvalidEventOrObjectScalar(rawValue)) return null
    const targetRc = rateCards.find(r => r.id === rowId)
    if (!targetRc) return null
    if (targetRc.is_locked) {
      showGridFeedback('error', `🔒 La tarifa de ${targetRc.entity_name} (${targetRc.period}) está bloqueada.`)
      return null
    }
    if (colKey === 'rate_ayudante_ars' && targetRc.admin_center === 'ASTILLERO') return null

    const oldVal = targetRc[colKey]
    const ars = Math.max(0, parseFloat(rawValue) || 0)
    const dRate = parseFloat(targetRc.dollar_rate) || dollarRate || 1500
    const usd = dRate > 0 ? Number((ars / dRate).toFixed(2)) : 0

    const dbPatch = colKey === 'rate_oficial_ars'
      ? { rate_oficial_ars: ars, rate_oficial_usd: usd, updated_at: new Date().toISOString() }
      : { rate_ayudante_ars: ars, rate_ayudante_usd: usd, has_ayudante: true, updated_at: new Date().toISOString() }

    setRateCards(prev => prev.map(r => r.id === rowId ? { ...r, ...dbPatch } : r))

    const { error } = await supabase.from('rate_cards').update(dbPatch).eq('id', rowId)
    if (error) throw error

    await auditService.logCellChange({
      entityType: 'rate_cards',
      entityId: rowId,
      entityName: `${targetRc.entity_name} (${targetRc.period})`,
      field: colKey,
      fieldLabel: colKey === 'rate_oficial_ars' ? 'Oficial AR$' : 'Ayudante AR$',
      oldValue: oldVal,
      newValue: ars,
      sheetName: 'Personal · Tarifario Quincenal',
      moduleRoute: '/personal'
    })

    return ars
  }, [rateCards, dollarRate, showGridFeedback])

  const handleRatesBatchUpdate = useCallback(async ({ colKey, newValue, targetIds, revertMap, isRevert }) => {
    try {
      if (isRevert && revertMap) {
        for (const [id, oldVal] of Object.entries(revertMap)) {
          await applyRateCardSinglePatch(id, colKey, oldVal)
        }
      } else if (Array.isArray(targetIds)) {
        for (const id of targetIds) {
          await applyRateCardSinglePatch(id, colKey, newValue)
        }
      }
    } catch (err) {
      console.error(err)
      showGridFeedback('error', `Error actualizando tarifas: ${err.message}`)
      loadRateCards(currentPeriodKey)
    }
  }, [applyRateCardSinglePatch, showGridFeedback, currentPeriodKey])

  const ratesGrid = useSpreadsheetGrid({
    rows: filteredRateCards,
    columns: rateColumns,
    getRowId: (rc) => rc.id,
    storageKey: 'aloncar_grid_tarifas',
    canEditCell: canEditRateCell,
    onBatchUpdate: handleRatesBatchUpdate,
    onPasteRow: (args) => ratesPasteRef.current?.(args),
    onFocusSearch: () => rateSearchInputRef.current?.focus(),
    onCellActivate: (row, colDef) => {
      if (!row || !colDef) return
      if (row.is_locked) {
        showGridFeedback('error', `🔒 Tarifa bloqueada (${row.period}): no admite edición directa.`)
        return
      }
      if (colDef.key === 'rate_ayudante_ars' && row.admin_center === 'ASTILLERO') return
      setInlineRateEdit({
        rowId: row.id,
        colKey: colDef.key,
        value: row[colDef.key] ?? ''
      })
    },
    showFeedback: showGridFeedback
  })

  const RATE_CLONE_FIELDS = ['period', 'year', 'month', 'quincena', 'admin_center', 'rate_oficial_ars', 'rate_oficial_usd', 'has_ayudante', 'rate_ayudante_ars', 'rate_ayudante_usd', 'dollar_rate']
  const RATE_PASTE_FIELDS = ['rate_oficial_ars', 'rate_oficial_usd', 'has_ayudante', 'rate_ayudante_ars', 'rate_ayudante_usd']

  useEffect(() => {
    const baseRatePaste = buildPasteRowHandler({
      table: 'rate_cards',
      entityType: 'rate_cards',
      fields: RATE_PASTE_FIELDS,
      grid: ratesGrid,
      setList: setRateCards,
      nameOf: (r) => `${r.entity_name || ''} (${r.period || ''})`,
      showFeedback: showGridFeedback
    })
    ratesPasteRef.current = async (args) => {
      if (args?.targetRow?.is_locked) {
        showGridFeedback('error', `🔒 La tarifa de ${args.targetRow.entity_name} (${args.targetRow.period}) está bloqueada.`)
        return
      }
      await baseRatePaste(args)
    }
  })

  const handleDuplicateRateRow = async (rc) => {
    if (!rc) return
    if (rc.is_locked) {
      showGridFeedback('error', `🔒 Período cerrado (${rc.period}): no se puede duplicar en un período bloqueado.`)
      return
    }
    try {
      const created = await duplicateRecord({
        table: 'rate_cards',
        entityType: 'rate_cards',
        source: rc,
        fields: RATE_CLONE_FIELDS,
        overrides: { entity_name: `${rc.entity_name || 'TARIFA'} (COPIA)`, is_locked: false },
        nameOf: (r) => `${r.entity_name} (${r.period})`
      })
      showGridFeedback('success', `Tarifa duplicada como "${created.entity_name}".`)
      loadRateCards(currentPeriodKey)
    } catch (err) {
      console.error(err)
      showGridFeedback('error', `Error al duplicar tarifa: ${err.message}`)
    }
  }

  const commitInlineRateEdit = async () => {
    if (!inlineRateEdit) return
    const { rowId, colKey, value } = inlineRateEdit
    const rc = rateCards.find(r => r.id === rowId)
    setInlineRateEdit(null)
    if (!rc || rc.is_locked) return

    const oldVal = rc[colKey]
    if (Number(oldVal || 0) === Number(value || 0)) return

    try {
      const savedVal = await applyRateCardSinglePatch(rowId, colKey, value)
      if (savedVal !== null) {
        const colDef = rateColumns.find(c => c.key === colKey)
        ratesGrid.pushUndoAction({
          colKey,
          colLabel: colDef?.label || colKey,
          actionLabel: `Editar tarifa ${rc.entity_name} (${rc.period})`,
          previousValues: { [rowId]: oldVal },
          newValue: savedVal,
          timestamp: Date.now()
        })
        showGridFeedback('success', `Tarifa de ${rc.entity_name} actualizada a $${savedVal.toLocaleString('es-AR')}. (Ctrl+Z deshacer)`)
      }
    } catch (err) {
      console.error(err)
      showGridFeedback('error', `Error al guardar tarifa: ${err.message}`)
      loadRateCards(currentPeriodKey)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {statusMessage && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
          statusMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' :
          statusMessage.type === 'info' ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300' :
          'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />}
          <div className="text-sm font-medium">{statusMessage.text}</div>
        </div>
      )}

      {/* PANEL UNIFICADO CASCADA */}
      <div 
        ref={tarifarioFormRef}
        className={`alon-zone-entry rounded-2xl p-5 md:p-6 shadow-xl space-y-5 transition-all duration-500 ${
          isTargetFocusGlow ? 'ring-2 ring-cyan-400 shadow-2xl shadow-cyan-500/25 bg-slate-900/90' : ''
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white">Tarifario Quincenal de Mano de Obra</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Las tarifas se asocian a una quincena específica, protegiendo el histórico inmutable de costos pasados.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="px-2.5 py-1 rounded-lg bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 flex items-center gap-1.5" title={orgRoles['LIQUIDACION_SUELDOS']?.title}>
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Carga Operativa: <strong>{orgRoles['LIQUIDACION_SUELDOS']?.holder}</strong></span>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-950/80 text-amber-300 border border-amber-800/80 flex items-center gap-1.5" title={orgRoles['DIRECCION_OPERACIONES']?.title}>
              <Briefcase className="w-3.5 h-3.5" />
              <span>Tarifas Contratistas: <strong>{orgRoles['DIRECCION_OPERACIONES']?.holder}</strong></span>
            </span>
          </div>
        </div>

        {/* SELECTOR DE CENTRO */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 p-3.5 bg-slate-950/90 border border-slate-800 rounded-xl">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Centro:</span>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setRateAdminCenter('ASTILLERO')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 border ${
                  rateAdminCenter === 'ASTILLERO'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-md shadow-cyan-500/20 font-black ring-1 ring-cyan-400/50'
                    : 'bg-slate-900 border-slate-700/80 text-slate-400 hover:text-white hover:border-slate-600'
                }`}
              >
                <Building2 className={`w-3.5 h-3.5 ${rateAdminCenter === 'ASTILLERO' ? 'text-cyan-400' : 'text-slate-500'}`} />
                <span>Personal del Astillero (5 Categorías)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRateAdminCenter('CONTRATISTA')
                  if (uniqueContractorList.length > 0 && !selectedContractor) {
                    handleSelectContractor(uniqueContractorList[0])
                  }
                }}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 border ${
                  rateAdminCenter === 'CONTRATISTA'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-md shadow-amber-500/20 font-black ring-1 ring-amber-400/50'
                    : 'bg-slate-900 border-slate-700/80 text-slate-400 hover:text-white hover:border-slate-600'
                }`}
              >
                <HardHat className={`w-3.5 h-3.5 ${rateAdminCenter === 'CONTRATISTA' ? 'text-amber-400' : 'text-slate-500'}`} />
                <span>Contratistas</span>
              </button>
            </div>
          </div>

          {rateAdminCenter === 'CONTRATISTA' && (
            <div className="flex flex-wrap items-center gap-2.5 animate-in fade-in duration-150">
              <span className="text-xs text-amber-400 font-bold flex items-center gap-1">
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Contratista:</span>
              </span>
              <select
                value={selectedContractor}
                onChange={(e) => handleSelectContractor(e.target.value)}
                className="bg-slate-900 border border-amber-500/50 rounded-xl px-3 py-1.5 text-xs font-extrabold text-amber-300 focus:outline-none focus:border-amber-400 font-mono cursor-pointer"
              >
                {uniqueContractorList.map(c => (
                  <option key={c} value={c}>
                    {c} {rootContractorsMap[c]?.hasAyudanteOption ? '(Dual: Ofic. + Ayud.)' : '(Oficial Único)'}
                  </option>
                ))}
              </select>
              <span className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-950/60 border border-amber-800/60 text-amber-300 font-medium">
                👥 <strong>{rootContractorsMap[selectedContractor]?.workersCount || 0}</strong> en nómina
              </span>
            </div>
          )}
        </div>

        {/* PERÍODO QUINCENAL Y ACCESO RÁPIDO */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-6 relative" ref={periodDropdownRef}>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <span>Período Quincenal Activo</span>
              </span>
              <span className="text-[10px] text-slate-500">Filtro en tiempo real</span>
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsPeriodSelectOpen(prev => !prev)}
                className="w-full h-[42px] bg-slate-950 border border-slate-700 hover:border-emerald-500/80 rounded-xl px-3.5 text-xs font-bold text-white flex items-center justify-between transition-colors cursor-pointer text-left focus:outline-none focus:border-emerald-500 shadow-inner"
              >
                <span className="flex items-center gap-2 truncate">
                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono font-black text-xs">
                    {currentPeriodKey}
                  </span>
                  <span className="text-slate-300 truncate">
                    {rateQuincena === 1 ? '1ra' : '2da'} Quincena de {MONTH_NAMES[rateMonth - 1]} {rateYear}
                  </span>
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isPeriodSelectOpen ? 'rotate-180 text-emerald-400' : ''}`} />
              </button>

              {isPeriodSelectOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="p-2 border-b border-slate-800 bg-slate-950">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        autoFocus
                        value={periodSearchInput}
                        onChange={(e) => setPeriodSearchInput(e.target.value)}
                        placeholder="Escribí ej: 2026, nov, 1Q..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                      />
                      {periodSearchInput && (
                        <button type="button" onClick={() => setPeriodSearchInput('')} className="absolute right-2 top-2 text-slate-400 hover:text-white">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/60">
                    {filteredSelectablePeriods.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500">
                        No se encontraron quincenas que coincidan con "{periodSearchInput}"
                      </div>
                    ) : (
                      filteredSelectablePeriods.map(p => {
                        const isSelected = p.period === currentPeriodKey
                        return (
                          <button
                            key={p.period}
                            type="button"
                            onClick={() => handleSelectPeriod(p)}
                            className={`w-full px-3.5 py-2 text-xs flex items-center justify-between text-left transition-colors cursor-pointer ${
                              isSelected ? 'bg-emerald-500/15 text-emerald-300 font-bold' : 'hover:bg-slate-800 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-emerald-400 text-[11px]">
                                {p.period}
                              </span>
                              <span className="text-slate-300">
                                {p.quincena === 1 ? '1ra' : '2da'} Quincena de {MONTH_NAMES[p.month - 1]} {p.year}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                              <span>US$ {parseFloat(p.dollar_rate || 1500).toLocaleString('es-AR')}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />}
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="md:col-span-3">
            <button
              type="button"
              onClick={handleOpenNewPeriodModal}
              title="Da apertura a una nueva quincena en el tarifario para permitir la carga manual desde cero ($0) en la tabla inferior o adoptar los valores de la quincena anterior."
              className="w-full h-[42px] bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Nueva Quincena</span>
              <HelpCircle className="w-3.5 h-3.5 opacity-75" />
            </button>
          </div>

          <div className="md:col-span-3">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-1 flex items-center justify-between">
              <span>Valor US$ Quincenal</span>
              <span className="text-[9px] text-slate-400 flex items-center gap-1 font-mono">
                <Lock className="w-2.5 h-2.5 text-amber-400" />
                <span>Fijado por Adm.</span>
              </span>
            </label>
            <div className="h-[42px] bg-slate-950 border border-slate-800 rounded-xl px-3.5 flex items-center justify-between shadow-inner">
              <span className="flex items-center gap-1 font-mono">
                <span className="text-slate-500 font-normal">$</span>
                <span className="text-white text-sm font-bold">{parseFloat(dollarRate).toLocaleString('es-AR')}</span>
              </span>
              <span className="text-[10px] text-slate-500 font-sans">ARS / USD</span>
            </div>
          </div>
        </div>

        {/* 10 QUINCENAS GUARDADAS */}
        {last10RecordedPeriods.length > 0 && (
          <div className="pt-3 border-t border-slate-800/60 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <div className="flex items-center gap-1 text-[11px] text-slate-400 font-semibold mr-1">
              <History className="w-3.5 h-3.5 text-emerald-400" />
              <span>Últimas 10 Quincenas Guardadas:</span>
            </div>
            {last10RecordedPeriods.map(p => {
              const isCurrent = p.period === currentPeriodKey
              const periodData = rateCardsByPeriod[p.period]
              return (
                <div key={p.period} className="relative group">
                  <button
                    type="button"
                    onClick={() => handleSelectPeriod(p)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-md scale-105'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-600 hover:text-white'
                    }`}
                  >
                    {p.period}
                  </button>
                  <div className="opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-72 p-3 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl text-left text-xs invisible group-hover:visible">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
                      <span className="font-bold text-cyan-400 text-[11px]">{p.period}</span>
                      <span className="text-[10px] text-slate-400 font-mono">US$ {periodData?.dollar_rate || 1500}</span>
                    </div>
                    {rateAdminCenter === 'ASTILLERO' ? (
                      <div className="space-y-1">
                        {ASTILLERO_BASE_CATEGORIES.map(cat => {
                          const item = periodData?.astillero?.[cat]
                          return (
                            <div key={cat} className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-400">{cat}:</span>
                              <span className="font-mono text-white font-bold">{item ? `$${item.ars.toLocaleString('es-AR')}` : '—'}</span>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="space-y-1 text-[11px]">
                        <div className="text-amber-300 font-bold">{selectedContractor}</div>
                        {periodData?.contractors?.[selectedContractor] ? (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">OFICIAL:</span>
                              <span className="font-mono text-emerald-400 font-bold">${periodData.contractors[selectedContractor].oficialArs.toLocaleString('es-AR')}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">AYUDANTE:</span>
                              <span className="font-mono text-amber-400 font-bold">{periodData.contractors[selectedContractor].ayudanteArs ? `$${periodData.contractors[selectedContractor].ayudanteArs.toLocaleString('es-AR')}` : 'Tarifa plana'}</span>
                            </div>
                          </>
                        ) : <span className="text-slate-500 italic">Sin tarifa registrada</span>}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* VALORES DE MANO DE OBRA */}
        {rateAdminCenter === 'ASTILLERO' && (
          <div className="space-y-4 pt-2 border-t border-slate-800 animate-in fade-in duration-150">
            <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-xs text-cyan-300 flex items-start gap-2.5">
              <Building2 className="w-4 h-4 shrink-0 mt-0.5 text-cyan-400" />
              <div>
                <strong>Escala Sindical Astillero:</strong> El titular de {orgRoles['LIQUIDACION_SUELDOS']?.title} ({orgRoles['LIQUIDACION_SUELDOS']?.holder}) ingresa los nuevos valores aprobados por convenio sindical para el personal propio de AlonCar. Se imputan obligatoriamente a las 5 categorías oficiales.
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {ASTILLERO_BASE_CATEGORIES.map(category => {
                const currentItem = astilleroForm[category] || { ars: 0, usd: 0 }
                const calcUsd = dollarRate > 0 ? (currentItem.ars / dollarRate).toFixed(2) : 0
                return (
                  <div key={category} className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-cyan-800/60 transition-all space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`px-2.5 py-0.5 rounded text-[11px] border tracking-wider ${getCategoryBadgeStyle(category)}`}>
                        {category}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono font-bold">
                        U$ {calcUsd}
                      </span>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Valor AR$ / Hora</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-slate-500 font-mono font-bold">$</span>
                        <input
                          type="number"
                          step="50"
                          min="0"
                          value={currentItem.ars}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0
                            const uVal = dollarRate > 0 ? Number((val / dollarRate).toFixed(2)) : 0
                            setAstilleroForm(prev => ({ ...prev, [category]: { ars: val, usd: uVal } }))
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Los operarios de Astillero en el padrón se actualizan automáticamente al guardar.</span>
              </div>
              <button
                type="button"
                disabled={savingRateCard}
                onClick={handleSaveAstilleroRates}
                className="px-5 py-2.5 bg-gradient-to-r from-cyan-400 to-blue-500 hover:brightness-110 text-slate-950 text-xs font-extrabold rounded-xl shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4 stroke-[2.5]" />
                <span>{savingRateCard ? 'Guardando y sincronizando...' : 'Guardar Escala Sindical Astillero'}</span>
              </button>
            </div>
          </div>
        )}

        {rateAdminCenter === 'CONTRATISTA' && (
          <div className="space-y-4 pt-2 border-t border-slate-800 animate-in fade-in duration-150">
            <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/40 text-xs text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <HardHat className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <div>
                  <strong>Tarifas de {selectedContractor}:</strong> Determina y negocia los valores por hora con cada prestador.
                </div>
              </div>
              <label className="shrink-0 flex items-center gap-2 text-xs text-amber-300 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-amber-800/60 hover:border-amber-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={contractorHasAyudante}
                  onChange={(e) => setContractorHasAyudante(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-amber-500 cursor-pointer accent-amber-500"
                />
                <span className="text-[11px] font-semibold">
                  {contractorHasAyudante ? 'Ayudante habilitado' : 'Habilitar Ayudante (excepción)'}
                </span>
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-emerald-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Unlock className="w-3.5 h-3.5" />
                    OFICIAL ({selectedContractor})
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono font-bold">
                    U$ {contractorOficialUsd}
                  </span>
                </div>
                <label className="block text-[10px] uppercase font-bold text-slate-400">Valor AR$ / Hora</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-500 font-mono font-bold">$</span>
                  <input
                    type="number"
                    step="100"
                    min="0"
                    value={contractorOficialArs}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0
                      const uVal = dollarRate > 0 ? Number((val / dollarRate).toFixed(2)) : 0
                      setContractorOficialArs(val)
                      setContractorOficialUsd(uVal)
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>
              <div className={`p-4 rounded-xl border transition-all space-y-2 ${contractorHasAyudante ? 'bg-slate-950 border-amber-900/40' : 'bg-slate-950/40 border-slate-800/80 opacity-70'}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${contractorHasAyudante ? 'text-amber-400' : 'text-slate-500'}`}>
                    {contractorHasAyudante ? <Unlock className="w-3.5 h-3.5 text-amber-400" /> : <Lock className="w-3.5 h-3.5 text-slate-500" />}
                    AYUDANTE
                  </span>
                  {contractorHasAyudante && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-mono font-bold">
                      U$ {contractorAyudanteUsd}
                    </span>
                  )}
                </div>
                <label className="block text-[10px] uppercase font-bold text-slate-400">Valor AR$ / Hora</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-500 font-mono font-bold">$</span>
                  <input
                    type="number"
                    step="100"
                    min="0"
                    disabled={!contractorHasAyudante}
                    value={contractorHasAyudante ? contractorAyudanteArs : ''}
                    placeholder={!contractorHasAyudante ? 'Bloqueado (No aplica)' : '0'}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0
                      const uVal = dollarRate > 0 ? Number((val / dollarRate).toFixed(2)) : 0
                      setContractorAyudanteArs(val)
                      setContractorAyudanteUsd(uVal)
                    }}
                    className={`w-full rounded-lg pl-7 pr-3 py-1.5 text-xs font-mono font-bold focus:outline-none ${
                      contractorHasAyudante ? 'bg-slate-900 border border-slate-700 text-white focus:border-amber-400' : 'bg-slate-950/80 border border-slate-800 text-slate-600 cursor-not-allowed'
                    }`}
                  />
                </div>
              </div>
            </div>
            <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Los operarios de {selectedContractor} se actualizan automáticamente en el padrón.</span>
              </div>
              <button
                type="button"
                disabled={savingRateCard}
                onClick={handleSaveContractorRate}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-400 to-orange-500 hover:brightness-110 text-slate-950 text-xs font-extrabold rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4 stroke-[2.5]" />
                <span>{savingRateCard ? 'Guardando y sincronizando...' : `Guardar Tarifa de ${selectedContractor}`}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL HABILITAR NUEVA QUINCENA */}
      {isNewPeriodModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Habilitar Nueva Quincena</h3>
              </div>
              <button type="button" onClick={() => setIsNewPeriodModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-xl text-xs text-emerald-300 flex items-start gap-2">
                <Calendar className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>Sugerencia correlativa: {nextCorrelativePeriod.period}.</div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Año</label>
                  <input
                    type="number"
                    value={newPeriodYear}
                    onChange={(e) => setNewPeriodYear(parseInt(e.target.value) || newPeriodYear)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Mes</label>
                  <select
                    value={newPeriodMonth}
                    onChange={(e) => setNewPeriodMonth(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {MONTH_NAMES.map((name, idx) => (
                      <option key={name} value={idx + 1}>{idx + 1} - {name.slice(0, 3)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Quincena</label>
                  <select
                    value={newPeriodQuincena}
                    onChange={(e) => setNewPeriodQuincena(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value={1}>1Q (1-15)</option>
                    <option value={2}>2Q (16-fin)</option>
                  </select>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold uppercase text-emerald-400 flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-amber-400" />
                    <span>Cotización Dólar US$ (Solo Admin)</span>
                  </label>
                  <Link to="/admin" className="text-[10px] font-bold text-cyan-400 hover:underline">
                    Editar en /admin ↗
                  </Link>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-500 font-mono font-bold">$</span>
                  <input
                    type="number"
                    value={newPeriodDollarRate}
                    readOnly
                    disabled
                    title="Valor oficial fijado exclusivamente desde Panel Administrador (/admin → Variables Macroeconómicas)."
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-7 pr-24 py-2 text-xs font-mono font-bold text-slate-300 cursor-not-allowed"
                  />
                  <span className="absolute right-3 top-2 text-[10px] font-mono text-amber-400/90 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Intocable
                  </span>
                </div>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5" title="Esta acción da apertura a la quincena elegida para cargar valores manualmente desde $0 o clonar los de la quincena anterior.">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newPeriodCopyLast}
                    onChange={(e) => setNewPeriodCopyLast(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-500 cursor-pointer accent-emerald-500 mt-0.5"
                  />
                  <span className="text-xs text-slate-300">
                    <strong>Copiar tarifas de la última quincena guardada</strong> ({sortedRecordedPeriods[sortedRecordedPeriods.length - 1]?.period || 'anterior'}) como base editable.
                  </span>
                </label>
                <p className="text-[10px] text-slate-400 pl-6">
                  {newPeriodCopyLast
                    ? '✓ Tildado: adopta los valores de la quincena anterior para ajustarlos luego.'
                    : '✓ Destildado: crea las 5 categorías en $0 para carga manual limpia desde cero en la tabla inferior.'}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button type="button" onClick={() => setIsNewPeriodModalOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer">
                Cancelar
              </button>
              <button
                type="button"
                disabled={creatingNewPeriod}
                onClick={handleConfirmNewPeriod}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 text-slate-950 text-xs font-extrabold rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {creatingNewPeriod ? <span>Creando período...</span> : <><Check className="w-4 h-4 stroke-[3]" /><span>Crear y Abrir Quincena</span></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BLOQUE OPERATIVO: ZONA 3 + ZONA 4 */}
      <div className="alon-workspace-block">
        <div className="alon-zone-toolbar rounded-2xl p-3 shadow-lg space-y-2.5">
          <CrawlerSearchBar
            value={rateTableSearch}
            onChange={setRateTableSearch}
            onClear={() => setRateTableSearch('')}
            inputRef={rateSearchInputRef}
            placeholder="Buscar por categoría, contratista, quincena, valor hora... (Ctrl+F | Esc limpia)"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterTableCenter('todos')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  filterTableCenter === 'todos' ? 'bg-primary text-slate-950 font-bold' : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Todos ({filteredRateCards.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTableCenter('ASTILLERO')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  filterTableCenter === 'ASTILLERO' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-950 text-cyan-400 hover:text-cyan-300 border border-slate-800'
                }`}
              >
                Astillero Propio
              </button>
              <button
                type="button"
                onClick={() => setFilterTableCenter('CONTRATISTA')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  filterTableCenter === 'CONTRATISTA' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-950 text-amber-400 hover:text-amber-300 border border-slate-800'
                }`}
              >
                Contratistas
              </button>
              <div className="h-4 w-px bg-slate-800 hidden sm:block"></div>
              <select
                value={rateTableScope}
                onChange={(e) => {
                  const newScope = e.target.value
                  setRateTableScope(newScope)
                  loadRateCards(currentPeriodKey, newScope)
                }}
                className="bg-slate-950 border border-slate-700 text-xs font-bold text-white rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
              >
                <option value="current">Solo Quincena Activa ({currentPeriodKey})</option>
                <option value="all">Todas las Quincenas (Historial Completo)</option>
              </select>
            </div>
            <div className="flex items-center gap-1 bg-slate-950/90 border border-slate-800 rounded-lg p-1">
              <button
                type="button"
                disabled={!ratesGrid.canUndo}
                onClick={ratesGrid.undo}
                className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                title="Deshacer cambio en Tarifario (Ctrl + Z)"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={!ratesGrid.canRedo}
                onClick={ratesGrid.redo}
                className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                title="Rehacer cambio en Tarifario (Ctrl + Y)"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div
          ref={ratesGrid.gridContainerRef}
          tabIndex={0}
          onKeyDown={ratesGrid.handleKeyDown}
          className="alon-zone-grid rounded-2xl shadow-xl overflow-hidden focus:outline-none"
        >
          <GridRibbon
            activeCellBadge={ratesGrid.activeCellBadge || 'PLANILLA TARIFAS'}
            onInsertRow={() => {}}
            insertRowLabel="+ Nueva Tarifa"
            undoCount={ratesGrid.undoStack?.length || 0}
            totalRows={filteredRateCards.length}
            entityName="tarifas"
            exportRows={filteredRateCards}
            exportFilename={`personal_tarifas_${new Date().toISOString().split('T')[0]}`}
          />
          <div className="alon-grid-scroll">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="sticky top-0 z-20 alon-grid-thead text-[10px] uppercase font-bold text-slate-300 shadow-sm backdrop-blur-md">
                <tr>
                  <th className="py-2 px-1 text-center w-8 select-none">
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => ratesGrid.toggleSelectAll(filteredRateCards.map(rc => rc.id))}
                        className="text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer"
                        title="Seleccionar todas las tarifas"
                      >
                        {ratesGrid.selectedRowIds.size > 0 && ratesGrid.selectedRowIds.size === filteredRateCards.length ? (
                          <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                        ) : (
                          <Square className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <span className="font-mono text-[9px] text-slate-500 font-bold">#</span>
                    </div>
                  </th>
                  <th className="py-2.5 px-3">Quincena</th>
                  <th className="py-2.5 px-3">Categoría / Contratista</th>
                  <th className="py-2.5 px-3 text-right">Oficial AR$ ✎</th>
                  <th className="py-2.5 px-3 text-center text-emerald-400">Oficial U$</th>
                  <th className="py-2.5 px-3 text-right">Ayudante AR$ ✎</th>
                  <th className="py-2.5 px-3 text-center text-amber-400">Ayudante U$</th>
                  <th className="py-2.5 px-3 text-center">Dólar</th>
                  <th className="py-2.5 px-3 text-center">Centro</th>
                  <th className="py-2.5 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredRateCards.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500">
                      {loadingRateCards ? 'Cargando tarifas...' : 'No se encontraron tarifas registradas para el filtro seleccionado.'}
                    </td>
                  </tr>
                ) : (
                  filteredRateCards.map((rc, rowIndex) => {
                    const isLocked = Boolean(rc.is_locked)
                    const canEditAyudante = !isLocked && rc.admin_center === 'CONTRATISTA' && Boolean(rc.has_ayudante || rc.rate_ayudante_ars !== null)
                    const isEditingOficial = inlineRateEdit && inlineRateEdit.rowId === rc.id && inlineRateEdit.colKey === 'rate_oficial_ars'
                    const isEditingAyudante = inlineRateEdit && inlineRateEdit.rowId === rc.id && inlineRateEdit.colKey === 'rate_ayudante_ars'
                    const oficialActive = ratesGrid.isCellActive(rowIndex, 0)
                    const oficialSelected = ratesGrid.isCellSelected(rowIndex, 0)
                    const oficialFill = ratesGrid.isCellInFillPreview(rowIndex, 0)
                    const ayudanteActive = ratesGrid.isCellActive(rowIndex, 1)
                    const ayudanteSelected = ratesGrid.isCellSelected(rowIndex, 1)
                    const ayudanteFill = ratesGrid.isCellInFillPreview(rowIndex, 1)
                    const isRowSelected = ratesGrid.isRowSelected(rc.id)

                    return (
                      <tr
                        key={rc.id}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          if (ratesGrid.activeCell?.rowIndex !== rowIndex) {
                            ratesGrid.setActiveCell({ rowIndex, colIndex: ratesGrid.activeCell?.colIndex ?? 0 })
                            ratesGrid.setSelectionRange?.(null)
                          }
                          setContextMenuTarget({
                            row: rc,
                            rowIndex,
                            x: e.clientX,
                            y: e.clientY,
                            isRowHeader: false,
                            entityType: 'rate_cards',
                            recordId: rc.id,
                            recordLabel: `${rc.period} · ${rc.entity_name || ''}`
                          })
                        }}
                        className={`group transition-colors select-none ${
                          isRowSelected
                            ? 'bg-cyan-950/35 hover:bg-cyan-950/45 text-cyan-200'
                            : isLocked
                            ? 'bg-slate-900/40 hover:bg-slate-800/40'
                            : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-1 px-1 text-center w-8 select-none relative">
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => ratesGrid.toggleSelectRow(rc.id)}
                              className="text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer"
                            >
                              {isRowSelected ? <CheckSquare className="w-3.5 h-3.5 text-cyan-400" /> : <Square className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setContextMenuTarget(
                                  contextMenuTarget?.recordId === rc.id
                                    ? null
                                    : {
                                        row: rc,
                                        rowIndex,
                                        x: e.clientX,
                                        y: e.clientY,
                                        isRowHeader: true,
                                        entityType: 'rate_cards',
                                        recordId: rc.id,
                                        recordLabel: `${rc.period} · ${rc.entity_name || ''}`
                                      }
                                )
                              }}
                              className={`font-mono text-[9px] font-bold px-1 py-0.5 rounded transition-all cursor-pointer hover:bg-cyan-950/90 hover:text-cyan-300 hover:ring-1 hover:ring-cyan-500/60 ${
                                isRowSelected ? 'text-cyan-300' : 'text-slate-500 group-hover:text-cyan-400'
                              }`}
                              title={`Fila #${rc._rowSeq || rowIndex + 1} • Clic para menú contextual`}
                            >
                              {rc._rowSeq || rowIndex + 1}
                            </button>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-slate-400">
                              <HighlightText text={rc.period} query={rateTableSearch} />
                            </span>
                            {isLocked && <Lock className="w-3 h-3 text-amber-400 cursor-help" title="Período cerrado" />}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          {rc.admin_center === 'ASTILLERO' ? (
                            <span className={`px-2 py-0.5 rounded text-[10px] border ${getCategoryBadgeStyle(rc.entity_name)}`}>
                              <HighlightText text={rc.entity_name} query={rateTableSearch} />
                            </span>
                          ) : (
                            <span className="font-extrabold text-white font-mono">
                              <HighlightText text={rc.entity_name} query={rateTableSearch} />
                            </span>
                          )}
                        </td>
                        <td
                          onClick={(e) => ratesGrid.handleCellClick(rowIndex, 0, e)}
                          onMouseDown={(e) => ratesGrid.handleCellMouseDown(rowIndex, 0, e)}
                          onMouseEnter={() => ratesGrid.handleCellMouseEnter(rowIndex, 0)}
                          onDoubleClick={(e) => {
                            e.stopPropagation()
                            if (isLocked) {
                              showGridFeedback('error', `🔒 La tarifa de ${rc.entity_name} (${rc.period}) está bloqueada por período cerrado.`)
                              return
                            }
                            setInlineRateEdit({ rowId: rc.id, colKey: 'rate_oficial_ars', value: rc.rate_oficial_ars ?? 0 })
                          }}
                          className={`py-2 px-3 text-right font-mono font-bold text-white relative cursor-cell ${
                            oficialActive ? 'ring-2 ring-inset ring-emerald-400 bg-emerald-950/30' :
                            oficialFill ? 'bg-emerald-500/20 ring-1 ring-inset ring-emerald-400/60' :
                            oficialSelected ? 'bg-cyan-500/15' : ''
                          }`}
                        >
                          {isEditingOficial ? (
                            <input
                              type="number"
                              step="50"
                              min="0"
                              autoFocus
                              value={inlineRateEdit.value}
                              onChange={(e) => setInlineRateEdit(prev => ({ ...prev, value: e.target.value }))}
                              onBlur={() => commitInlineRateEdit()}
                              onKeyDown={(e) => {
                                 e.stopPropagation()
                                 if (e.key === 'Enter') commitInlineRateEdit()
                                 if (e.key === 'Escape') setInlineRateEdit(null)
                              }}
                              className="w-28 bg-slate-950 border border-emerald-400 rounded px-2 py-0.5 text-right text-xs text-white font-mono focus:outline-none"
                            />
                          ) : (
                            <span>$<HighlightText text={parseFloat(rc.rate_oficial_ars || 0).toLocaleString('es-AR')} query={rateTableSearch} /></span>
                          )}
                          {!isLocked && ratesGrid.shouldRenderFillHandle(rowIndex, 0) && (
                            <div
                              onMouseDown={ratesGrid.handleFillHandleMouseDown}
                              onDoubleClick={ratesGrid.handleFillHandleDoubleClick}
                              className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border border-slate-950 cursor-crosshair z-30"
                              title="Arrastrar para rellenar hacia abajo"
                            />
                          )}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-extrabold text-emerald-400">
                          $<HighlightText text={parseFloat(rc.rate_oficial_usd || 0).toFixed(2)} query={rateTableSearch} />
                        </td>
                        <td
                          onClick={(e) => ratesGrid.handleCellClick(rowIndex, 1, e)}
                          onMouseDown={(e) => ratesGrid.handleCellMouseDown(rowIndex, 1, e)}
                          onMouseEnter={() => ratesGrid.handleCellMouseEnter(rowIndex, 1)}
                          onDoubleClick={(e) => {
                            e.stopPropagation()
                            if (isLocked) {
                              showGridFeedback('error', `🔒 La tarifa de ${rc.entity_name} (${rc.period}) está bloqueada por período cerrado.`)
                              return
                            }
                            if (!canEditAyudante) return
                            setInlineRateEdit({ rowId: rc.id, colKey: 'rate_ayudante_ars', value: rc.rate_ayudante_ars ?? 0 })
                          }}
                          className={`py-2 px-3 text-right font-mono font-bold relative ${canEditAyudante ? 'cursor-cell' : 'cursor-default'} ${
                            ayudanteActive ? 'ring-2 ring-inset ring-emerald-400 bg-emerald-950/30' :
                            ayudanteFill ? 'bg-emerald-500/20 ring-1 ring-inset ring-emerald-400/60' :
                            ayudanteSelected ? 'bg-cyan-500/15' : ''
                          }`}
                        >
                          {isEditingAyudante ? (
                            <input
                              type="number"
                              step="50"
                              min="0"
                              autoFocus
                              value={inlineRateEdit.value}
                              onChange={(e) => setInlineRateEdit(prev => ({ ...prev, value: e.target.value }))}
                              onBlur={() => commitInlineRateEdit()}
                              onKeyDown={(e) => {
                                 e.stopPropagation()
                                 if (e.key === 'Enter') commitInlineRateEdit()
                                 if (e.key === 'Escape') setInlineRateEdit(null)
                              }}
                              className="w-28 bg-slate-950 border border-amber-400 rounded px-2 py-0.5 text-right text-xs text-white font-mono focus:outline-none"
                            />
                          ) : rc.rate_ayudante_ars ? (
                            <span className="text-white">$<HighlightText text={parseFloat(rc.rate_ayudante_ars).toLocaleString('es-AR')} query={rateTableSearch} /></span>
                          ) : (
                            <span className="text-slate-600 font-normal italic">No aplica</span>
                          )}
                          {canEditAyudante && ratesGrid.shouldRenderFillHandle(rowIndex, 1) && (
                            <div
                              onMouseDown={ratesGrid.handleFillHandleMouseDown}
                              onDoubleClick={ratesGrid.handleFillHandleDoubleClick}
                              className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border border-slate-950 cursor-crosshair z-30"
                              title="Arrastrar para rellenar hacia abajo"
                            />
                          )}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-extrabold text-amber-400">
                          {rc.rate_ayudante_usd ? <span>$<HighlightText text={parseFloat(rc.rate_ayudante_usd).toFixed(2)} query={rateTableSearch} /></span> : '-'}
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-slate-400">
                          $<HighlightText text={String(rc.dollar_rate)} query={rateTableSearch} />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
                            rc.admin_center === 'ASTILLERO' ? 'bg-cyan-950 text-cyan-300 border-cyan-800' : 'bg-amber-950 text-amber-300 border-amber-800'
                          }`}>
                            <HighlightText text={rc.admin_center} query={rateTableSearch} />
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleLoadRateCard(rc)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ml-auto"
                            title="Cargar en el formulario superior"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>Editar</span>
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <GridStatusBarBottom
        filteredCount={filteredRateCards.length}
        totalCount={rateCards.length}
        entityName="tarifas"
        hasActiveFilter={Boolean(rateTableSearch || filterTableCenter !== 'todos')}
        onClearFilters={() => { setRateTableSearch(''); setFilterTableCenter('todos'); }}
        selectionStats={ratesGrid.selectionStats}
        onClearSelection={() => ratesGrid.setSelectionRange(null)}
        customSelection={
          ratesGrid.selectedRowIds.size > 0
            ? {
                count: ratesGrid.selectedRowIds.size,
                label: `${ratesGrid.selectedRowIds.size} tarifa(s) seleccionada(s)`,
                onClear: ratesGrid.clearSelectedRows
              }
            : null
        }
        globalAggregates={[
          { label: 'Tarifas Históricas', value: filteredRateCards.length, highlight: true },
          { label: 'Centro', value: filterTableCenter === 'todos' ? 'Todos' : filterTableCenter }
        ]}
      />

      {contextMenuTarget && (
        <GridContextMenu
          target={contextMenuTarget}
          onClose={() => setContextMenuTarget(null)}
          onCopyCell={ratesGrid.copyActiveCell}
          onCopyRow={ratesGrid.copyRow}
          onPaste={ratesGrid.pasteToActiveOrRange}
          onDeleteCell={ratesGrid.deleteActiveCellOrRange}
          onDeleteRow={null}
          onDuplicateRow={(row) => handleDuplicateRateRow(row)}
          entityType="rate_cards"
          recordId={contextMenuTarget.recordId}
          recordLabel={contextMenuTarget.recordLabel}
        />
      )}
    </div>
  )
}
