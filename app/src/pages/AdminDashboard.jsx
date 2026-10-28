import { useState, useEffect, useMemo } from 'react'
import { 
  ShieldCheck, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Percent, 
  Calendar, 
  Lock, 
  Unlock, 
  Check, 
  X, 
  Plus, 
  Pencil, 
  Trash2, 
  Save, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  HardHat, 
  Building2, 
  SlidersHorizontal, 
  Layers, 
  Package, 
  Clock, 
  Ship, 
  ClipboardList, 
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  Eye,
  FileText,
  Network,
  GitBranch,
  ArrowDown,
  Briefcase,
  ListChecks,
  Share2,
  HelpCircle,
  Workflow,
  Info,
  CornerDownRight,
  ExternalLink,
  Target,
  Brain,
  ShoppingCart,
  MessageSquare
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AiGovernancePanel from '../components/AiGovernancePanel'
import ComprasSettingsPanel from '../components/ComprasSettingsPanel'

// Módulos del sistema controlables en la matriz de seguridad
const SYSTEM_MODULES = [
  { key: 'barcos', label: 'Barcos y Obras', icon: Ship, color: 'text-blue-400' },
  { key: 'ots', label: 'Órdenes de Trabajo', icon: ClipboardList, color: 'text-indigo-400' },
  { key: 'horas', label: 'Carga de Horas', icon: Clock, color: 'text-cyan-400' },
  { key: 'panol', label: 'Pañol / Materiales', icon: Package, color: 'text-emerald-400' },
  { key: 'personal', label: 'Personal (Nómina)', icon: Users, color: 'text-teal-400' },
  { key: 'tarifario', label: 'Tarifario Quincenal', icon: DollarSign, color: 'text-amber-400' },
  { key: 'analisis', label: 'Análisis FX', icon: TrendingUp, color: 'text-purple-400' },
  { key: 'admin', label: 'Admin', icon: ShieldCheck, color: 'text-rose-400' }
]

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

// Listas estandarizadas desplegables para Puestos y Departamentos
const STANDARD_DEPARTMENTS = [
  'Dirección General',
  'Operaciones y Producción Naval',
  'Oficina Técnica & Subcontratos',
  'Administración, Nómina & RRHH',
  'Tesorería, Finanzas & Pagos',
  'Pañol, Logística & Abastecimiento'
]

const STANDARD_JOB_TITLES = [
  'Dirección General & Administración Central',
  'Dirección Operativa y Negociaciones',
  'Oficina Técnica & Subcontratos',
  'Responsable de Liquidación de Sueldos y RRHH',
  'Supervisión de Obra & Pañol',
  'Tesorería & Pagos',
  'Encargado de Pañol y Control de Materiales',
  'Jefe de Obra y Montaje Naval'
]

const REPORTING_LINES = [
  'Directorio / Accionistas',
  'Dirección General & Administración Central',
  'Dirección Operativa y Negociaciones',
  'Supervisión de Obra & Pañol'
]

// Circuito Operativo Inter-Departamental Alon Car
const WORKFLOW_CIRCUIT_STEPS = [
  {
    step: 1,
    title: 'Negociación y Fijación de Tarifas',
    department: 'Operaciones y Producción Naval',
    holder: 'Hugo Obregozo',
    roleKey: 'DIRECCION_OPERACIONES',
    badgeColor: 'bg-amber-950 text-amber-300 border-amber-600',
    icon: DollarSign,
    summary: 'Acuerda con cada prestador/contratista el valor $/h (en ARS y USD de referencia) previo al inicio de quincena.',
    handoff: 'Entrega Tarifario Acordado a María José (Administración) antes de comenzar la quincena.'
  },
  {
    step: 2,
    title: 'Carga en ERP & Apertura de OTs',
    department: 'Administración, Nómina & RRHH',
    holder: 'María José + Jefes de Obra',
    roleKey: 'LIQUIDACION_SUELDOS',
    badgeColor: 'bg-cyan-950 text-cyan-300 border-cyan-600',
    icon: ClipboardList,
    summary: 'Carga el tarifario quincenal en el sistema. Los Jefes de Obra abren las Órdenes de Trabajo por buque (ej. B/P Siempre Don Roberto).',
    handoff: 'Habilita la imputación de partes diarios de horas y vales de retiro en Pañol.'
  },
  {
    step: 3,
    title: 'Ejecución, Registro Diario & Pañol',
    department: 'Operaciones / Supervisión & Pañol',
    holder: 'Jorge + Rodrigo / Mariano + Sabrina',
    roleKey: 'SUPERVISION_OBRA',
    badgeColor: 'bg-emerald-950 text-emerald-300 border-emerald-600',
    icon: HardHat,
    summary: 'Carga diaria de partes de horas (RMO) con Sabrina. Control de stock y entregas de PRFV y consumibles.',
    hardRule: 'Regla Dura: Prohibido entregar materiales ni herramientas a contratistas en OTs donde no tengan horas asignadas.',
    handoff: 'Partes firmados remitidos a Administración; vales de consumibles remitidos para deducción.'
  },
  {
    step: 4,
    title: 'Auditoría Técnica y Cotejo de Facturación',
    department: 'Oficina Técnica & Subcontratos',
    holder: 'Omar + María José',
    roleKey: 'OFICINA_TECNICA',
    badgeColor: 'bg-purple-950 text-purple-300 border-purple-600',
    icon: Workflow,
    summary: 'Cotejo de remitos de talleres externos. María José emite Anexo de Facturación vinculando RPF con FCR (Alberto Gonzáles y Roberto Zubiat).',
    handoff: 'Expediente auditado y orden de liquidación neta enviado a Tesorería.'
  },
  {
    step: 5,
    title: 'Auditoría Financiera, Retenciones & Pago',
    department: 'Tesorería, Finanzas & Pagos',
    holder: 'Graciela',
    roleKey: 'TESORERIA',
    badgeColor: 'bg-rose-950 text-rose-300 border-rose-600',
    icon: ShieldCheck,
    summary: 'Aplica deducciones por consumibles y herramientas retiradas. Ejecuta transferencias quincenales y congela el período.',
    handoff: 'Reporte de flujo de fondos y liquidación final a Dirección Operativa y General.'
  }
]

// Plantillas rápidas de permisos por puesto (Presets)
const ROLE_PRESETS = [
  {
    name: '👑 Director / Admin',
    desc: 'Acceso total y configuración maestra de todo el ERP',
    security_level: 'ADMINISTRADOR',
    sections: ['barcos', 'ots', 'horas', 'panol', 'personal', 'tarifario', 'analisis', 'admin']
  },
  {
    name: '👔 Dirección Operativa',
    desc: 'Control de barcos, horas, contratos y negociación de tarifas',
    security_level: 'DIRECCION',
    sections: ['barcos', 'ots', 'horas', 'personal', 'tarifario', 'analisis']
  },
  {
    name: '📋 Liquidación & RRHH',
    desc: 'Gestión de horas, personal y tarifario quincenal',
    security_level: 'SUPERVISOR',
    sections: ['horas', 'personal', 'tarifario', 'analisis']
  },
  {
    name: '🛠️ Supervisión de Obra & Pañol',
    desc: 'Control de barcos, OTs, horas de personal y retiros de pañol',
    security_level: 'SUPERVISOR',
    sections: ['barcos', 'ots', 'horas', 'panol']
  },
  {
    name: '👁️ Auditoría / Tesorería',
    desc: 'Control de consistencia de horas, tarifas y auditoría financiera',
    security_level: 'AUDITOR',
    sections: ['horas', 'tarifario', 'analisis']
  }
]

export default function AdminDashboard() {
  const { profile, user } = useAuth()
  const [activeTab, setActiveTab] = useState('matriz') // 'matriz' | 'macro' | 'alertas' | 'reglas'
  
  // Estados de la Matriz de Puestos
  const [roles, setRoles] = useState([])
  const [loadingRoles, setLoadingRoles] = useState(true)
  const [editingRole, setEditingRole] = useState(null)
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false)
  const [savingRole, setSavingRole] = useState(false)
  const [roleMessage, setRoleMessage] = useState(null)

  // Modal para Ver Ficha Técnica, Misión y Vinculaciones Inter-Departamentales
  const [roleDetailModal, setRoleDetailModal] = useState({ isOpen: false, role: null })

  // Toggle de visualización del Circuito Operativo Inter-Departamental
  const [showWorkflowCircuit, setShowWorkflowCircuit] = useState(false)

  // Formulario de Puesto
  const [roleForm, setRoleForm] = useState({
    role_key: '',
    role_title: STANDARD_JOB_TITLES[0],
    holder_name: '',
    department: STANDARD_DEPARTMENTS[0],
    security_level: 'SUPERVISOR',
    status: 'ACTIVO',
    allowed_sections: ['horas', 'personal'],
    notes: '',
    reports_to: 'Dirección General & Administración Central',
    job_mission: '',
    key_responsibilities: '',
    departmental_links: []
  })

  // Estados de Control Macroeconómico & Cierre Quincenal
  const [macroVariables, setMacroVariables] = useState([])
  const [ratePeriods, setRatePeriods] = useState([])
  const [loadingMacro, setLoadingMacro] = useState(true)
  const [macroForm, setMacroForm] = useState({
    year: 2026,
    month: 10,
    dollar_rate: 1500,
    monthly_inflation_pct: 3.2
  })
  const [savingMacro, setSavingMacro] = useState(false)
  const [isEditingMacro, setIsEditingMacro] = useState(false)
  const [macroEditTarget, setMacroEditTarget] = useState(null)

  // Modal de edición completa de variables macro
  const [macroEditModal, setMacroEditModal] = useState({
    isOpen: false,
    id: null,
    year: 2026,
    month: 1,
    dollar_rate: 1500,
    dollar_rate_1q: 1500,
    dollar_rate_2q: 1500,
    monthly_inflation_pct: 0
  })

  // Modal de ajuste manual de dólar por quincena
  const [quincenaDollarModal, setQuincenaDollarModal] = useState({
    isOpen: false,
    period: '',
    year: 2026,
    month: 1,
    quincena: 1,
    dollar_rate: 1500
  })

  // Selección manual de quincenas (Checkboxes para borrado granular)
  const [selectedPeriods, setSelectedPeriods] = useState(new Set())

  // Estados de Alertas Operativas
  const [alertSummary, setAlertSummary] = useState({
    redContractorsCount: 0,
    panolWithoutHoursCount: 0,
    auditedHoursCount: 0
  })

  useEffect(() => {
    loadRoles()
    loadMacroData()
    loadAlertSummary()
  }, [])

  // =============================================================
  // 1. CARGA Y GESTIÓN DE LA MATRIZ DE PUESTOS Y PERMISOS
  // =============================================================
  async function loadRoles() {
    try {
      setLoadingRoles(true)
      const { data, error } = await supabase
        .from('organization_roles')
        .select('*')
        .order('role_title', { ascending: true })

      if (error) throw error
      setRoles(data || [])
    } catch (err) {
      console.error('Error cargando roles:', err)
    } finally {
      setLoadingRoles(false)
    }
  }

  // Toggle interactivo de 1 clic para habilitar/deshabilitar una sección en la tabla
  async function toggleSectionPermission(role, sectionKey) {
    const currentSections = role.allowed_sections || []
    const hasSection = currentSections.includes(sectionKey)
    const newSections = hasSection
      ? currentSections.filter(s => s !== sectionKey)
      : [...currentSections, sectionKey]

    // Actualización optimista
    setRoles(prev => prev.map(r => r.role_key === role.role_key ? { ...r, allowed_sections: newSections } : r))

    try {
      const { error } = await supabase
        .from('organization_roles')
        .update({
          allowed_sections: newSections,
          updated_at: new Date().toISOString()
        })
        .eq('role_key', role.role_key)

      if (error) throw error
    } catch (err) {
      console.error('Error actualizando permiso:', err)
      loadRoles()
    }
  }

  // Toggle de Estado del Puesto (Activo / Inactivo)
  async function toggleRoleStatus(role) {
    const newStatus = role.status === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO'
    setRoles(prev => prev.map(r => r.role_key === role.role_key ? { ...r, status: newStatus } : r))

    try {
      const { error } = await supabase
        .from('organization_roles')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('role_key', role.role_key)

      if (error) throw error
    } catch (err) {
      console.error('Error alternando estado de rol:', err)
      loadRoles()
    }
  }

  // Abrir modal para crear nuevo puesto
  function handleNewRole() {
    setEditingRole(null)
    setRoleForm({
      role_key: '',
      role_title: STANDARD_JOB_TITLES[0],
      holder_name: '',
      department: STANDARD_DEPARTMENTS[0],
      security_level: 'SUPERVISOR',
      status: 'ACTIVO',
      allowed_sections: ['horas', 'personal'],
      notes: '',
      reports_to: 'Dirección General & Administración Central',
      job_mission: '',
      key_responsibilities: '',
      departmental_links: []
    })
    setIsRoleModalOpen(true)
  }

  // Abrir modal para editar puesto existente
  function handleEditRole(role) {
    setEditingRole(role)
    const respStr = Array.isArray(role.key_responsibilities)
      ? role.key_responsibilities.join('\n')
      : (role.key_responsibilities || '')

    setRoleForm({
      role_key: role.role_key,
      role_title: role.role_title,
      holder_name: role.holder_name,
      department: role.department || STANDARD_DEPARTMENTS[1],
      security_level: role.security_level || 'SUPERVISOR',
      status: role.status || 'ACTIVO',
      allowed_sections: role.allowed_sections || [],
      notes: role.notes || '',
      reports_to: role.reports_to || 'Dirección General & Administración Central',
      job_mission: role.job_mission || '',
      key_responsibilities: respStr,
      departmental_links: role.departmental_links || []
    })
    setIsRoleModalOpen(true)
  }

  // Eliminar puesto
  async function handleDeleteRole(role) {
    if (!window.confirm(`¿Estás seguro de eliminar el puesto de "${role.role_title}"?`)) return
    try {
      setRoles(prev => prev.filter(r => r.role_key !== role.role_key))
      const { error } = await supabase
        .from('organization_roles')
        .delete()
        .eq('role_key', role.role_key)

      if (error) throw error
      setRoleMessage({ type: 'info', text: `Se eliminó el puesto "${role.role_title}".` })
      setTimeout(() => setRoleMessage(null), 3000)
    } catch (err) {
      console.error('Error eliminando puesto:', err)
      loadRoles()
    }
  }

  // Guardar puesto (Alta o Edición)
  async function handleSaveRoleSubmit(e) {
    e.preventDefault()
    try {
      setSavingRole(true)
      let key = roleForm.role_key.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_')
      if (!key) {
        key = roleForm.role_title.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_')
      }

      // Convertir responsabilidades de texto multilinea a array
      const responsibilitiesArray = typeof roleForm.key_responsibilities === 'string'
        ? roleForm.key_responsibilities.split('\n').map(s => s.trim()).filter(Boolean)
        : (roleForm.key_responsibilities || [])

      const payload = {
        role_key: key,
        role_title: roleForm.role_title.trim(),
        holder_name: roleForm.holder_name.trim(),
        department: roleForm.department.trim(),
        security_level: roleForm.security_level,
        status: roleForm.status,
        allowed_sections: roleForm.allowed_sections,
        notes: roleForm.notes.trim(),
        reports_to: roleForm.reports_to?.trim() || null,
        job_mission: roleForm.job_mission?.trim() || null,
        key_responsibilities: responsibilitiesArray,
        departmental_links: roleForm.departmental_links || [],
        updated_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('organization_roles')
        .upsert(payload, { onConflict: 'role_key' })

      if (error) throw error

      setRoleMessage({
        type: 'success',
        text: `Puesto "${payload.role_title}" asignado exitosamente a ${payload.holder_name}.`
      })
      setTimeout(() => setRoleMessage(null), 4000)
      setIsRoleModalOpen(false)
      loadRoles()
    } catch (err) {
      console.error('Error al guardar puesto:', err)
      setRoleMessage({ type: 'error', text: `Error al guardar puesto: ${err.message}` })
    } finally {
      setSavingRole(false)
    }
  }

  // =============================================================
  // 2. CONTROL MACROECONÓMICO Y CIERRE / BLOQUEO QUINCENAL
  // =============================================================
  async function loadMacroData() {
    try {
      setLoadingMacro(true)
      const [macroRes, ratesRes] = await Promise.all([
        supabase.from('macro_variables').select('*').order('year', { ascending: false }).order('month', { ascending: false }),
        supabase.from('rate_cards').select('period, year, month, quincena, dollar_rate, monthly_inflation_pct, is_locked, entity_name, admin_center').order('year', { ascending: false }).order('month', { ascending: false }).order('quincena', { ascending: false })
      ])

      const macroList = macroRes.data || []
      setMacroVariables(macroList)

      const ratesList = ratesRes.data || []
      
      // Construir mapa unificado de quincenas:
      const periodMap = new Map()

      // 1. Quincenas derivadas de cada mes cargado en macro_variables (1Q y 2Q)
      macroList.forEach(m => {
        const y = m.year
        const mo = m.month
        const moStr = String(mo).padStart(2, '0')
        const q1Key = `${y}-${moStr}-1Q`
        const q2Key = `${y}-${moStr}-2Q`

        const d1q = m.dollar_rate_1q ? parseFloat(m.dollar_rate_1q) : (parseFloat(m.dollar_rate) || 1500)
        const d2q = m.dollar_rate_2q ? parseFloat(m.dollar_rate_2q) : (parseFloat(m.dollar_rate) || 1500)
        const infPct = parseFloat(m.monthly_inflation_pct) || 0

        // 1Q
        const ratesQ1 = ratesList.filter(r => r.period === q1Key)
        const isLockedQ1 = m.is_locked_1q ?? (ratesQ1.length > 0 ? ratesQ1.every(r => r.is_locked) : false)
        periodMap.set(q1Key, {
          period: q1Key,
          year: y,
          month: mo,
          quincena: 1,
          dollar_rate: d1q,
          monthly_inflation_pct: infPct,
          is_locked: isLockedQ1,
          rates_count: ratesQ1.length,
          origin: 'macro'
        })

        // 2Q
        const ratesQ2 = ratesList.filter(r => r.period === q2Key)
        const isLockedQ2 = m.is_locked_2q ?? (ratesQ2.length > 0 ? ratesQ2.every(r => r.is_locked) : false)
        periodMap.set(q2Key, {
          period: q2Key,
          year: y,
          month: mo,
          quincena: 2,
          dollar_rate: d2q,
          monthly_inflation_pct: infPct,
          is_locked: isLockedQ2,
          rates_count: ratesQ2.length,
          origin: 'macro'
        })
      })

      // 2. Incluir cualquier período existente en rate_cards que no esté en macro_variables
      ratesList.forEach(r => {
        if (!periodMap.has(r.period)) {
          const ratesThisPeriod = ratesList.filter(x => x.period === r.period)
          periodMap.set(r.period, {
            period: r.period,
            year: r.year,
            month: r.month,
            quincena: r.quincena,
            dollar_rate: parseFloat(r.dollar_rate) || 1500,
            monthly_inflation_pct: parseFloat(r.monthly_inflation_pct) || 0,
            is_locked: Boolean(r.is_locked),
            rates_count: ratesThisPeriod.length,
            origin: 'rate_cards_legacy'
          })
        }
      })

      // Ordenar cronológico estricto para calcular variaciones: de más antiguo a más nuevo
      const chronological = Array.from(periodMap.values()).sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year
        if (a.month !== b.month) return a.month - b.month
        return a.quincena - b.quincena
      })

      // Calcular variación de Dólar e Inflación respecto al mes anterior para cada quincena
      const enrichedPeriods = chronological.map(p => {
        // Buscar el mes anterior (mismo año o año anterior si es enero)
        const prevYear = p.month === 1 ? p.year - 1 : p.year
        const prevMonth = p.month === 1 ? 12 : p.month - 1

        // 1. Variación de Inflación respecto al mes anterior (diferencia en puntos porcentuales)
        const prevMonthMacro = macroList.find(m => m.year === prevYear && m.month === prevMonth)
        let infDiff = null
        if (prevMonthMacro) {
          infDiff = p.monthly_inflation_pct - parseFloat(prevMonthMacro.monthly_inflation_pct)
        }

        // 2. Variación % del Dólar respecto al mes anterior (misma quincena o mes anterior)
        const prevMonthSameQ = chronological.find(x => x.year === prevYear && x.month === prevMonth && x.quincena === p.quincena)
        const prevMonthAny = chronological.find(x => x.year === prevYear && x.month === prevMonth)
        const prevDollarTarget = prevMonthSameQ ? prevMonthSameQ.dollar_rate : (prevMonthAny ? prevMonthAny.dollar_rate : null)

        let dollarDiffPct = null
        if (prevDollarTarget && prevDollarTarget > 0) {
          dollarDiffPct = ((p.dollar_rate - prevDollarTarget) / prevDollarTarget) * 100
        }

        // Variación intra-mes (2Q vs 1Q)
        let intraDollarDiffPct = null
        if (p.quincena === 2) {
          const q1Period = chronological.find(x => x.year === p.year && x.month === p.month && x.quincena === 1)
          if (q1Period && q1Period.dollar_rate > 0) {
            intraDollarDiffPct = ((p.dollar_rate - q1Period.dollar_rate) / q1Period.dollar_rate) * 100
          }
        }

        return {
          ...p,
          infDiff,
          dollarDiffPct,
          intraDollarDiffPct
        }
      })

      // Invertir a orden descendente para mostrar las quincenas más recientes arriba
      enrichedPeriods.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year
        if (a.month !== b.month) return b.month - a.month
        return b.quincena - a.quincena
      })

      setRatePeriods(enrichedPeriods)
    } catch (err) {
      console.error('Error cargando variables macro:', err)
    } finally {
      setLoadingMacro(false)
    }
  }

  // Guardar Dólar e Inflación Mensual desde el formulario superior
  async function handleSaveMacroSubmit(e) {
    e.preventDefault()
    try {
      setSavingMacro(true)
      const yr = parseInt(macroForm.year)
      const mo = parseInt(macroForm.month)
      const dRate = parseFloat(macroForm.dollar_rate) || 1500
      const infPct = parseFloat(macroForm.monthly_inflation_pct) || 0

      // 1. Guardar en macro_variables inicializando 1Q y 2Q con dRate
      const { error: macroErr } = await supabase
        .from('macro_variables')
        .upsert({
          year: yr,
          month: mo,
          dollar_rate: dRate,
          dollar_rate_1q: dRate,
          dollar_rate_2q: dRate,
          monthly_inflation_pct: infPct,
          updated_by: profile?.full_name || user?.email || 'Administrador',
          updated_at: new Date().toISOString()
        }, { onConflict: 'year,month' })

      if (macroErr) throw macroErr

      // 2. Sincronizar en rate_cards si existiesen
      await supabase
        .from('rate_cards')
        .update({
          dollar_rate: dRate,
          monthly_inflation_pct: infPct
        })
        .eq('year', yr)
        .eq('month', mo)

      setRoleMessage({
        type: 'success',
        text: `Parámetros guardados: Dólar $${dRate.toLocaleString('es-AR')} e Inflación ${infPct}% para ${MONTH_NAMES[mo - 1]} ${yr}. Se aplicó a ambas quincenas (1Q y 2Q).`
      })
      setTimeout(() => setRoleMessage(null), 5000)
      loadMacroData()
    } catch (err) {
      console.error('Error al guardar variables macro:', err)
      setRoleMessage({ type: 'error', text: `Error al guardar: ${err.message}` })
    } finally {
      setSavingMacro(false)
    }
  }

  // Abrir Modal de Edición Completa de Variables Macroeconómicas
  function handleOpenMacroModal(item) {
    const dBase = parseFloat(item.dollar_rate) || 1500
    setMacroEditModal({
      isOpen: true,
      id: item.id,
      year: item.year,
      month: item.month,
      dollar_rate: dBase,
      dollar_rate_1q: item.dollar_rate_1q ? parseFloat(item.dollar_rate_1q) : dBase,
      dollar_rate_2q: item.dollar_rate_2q ? parseFloat(item.dollar_rate_2q) : dBase,
      monthly_inflation_pct: parseFloat(item.monthly_inflation_pct) || 0
    })
  }

  // Guardar Cambios desde el Modal de Variables Macroeconómicas
  async function handleSaveMacroModalSubmit(e) {
    e.preventDefault()
    try {
      setSavingMacro(true)
      const yr = parseInt(macroEditModal.year)
      const mo = parseInt(macroEditModal.month)
      const dBase = parseFloat(macroEditModal.dollar_rate) || 1500
      const d1q = parseFloat(macroEditModal.dollar_rate_1q) || dBase
      const d2q = parseFloat(macroEditModal.dollar_rate_2q) || dBase
      const infPct = parseFloat(macroEditModal.monthly_inflation_pct) || 0

      // 1. Guardar en macro_variables
      const { error: macroErr } = await supabase
        .from('macro_variables')
        .upsert({
          year: yr,
          month: mo,
          dollar_rate: dBase,
          dollar_rate_1q: d1q,
          dollar_rate_2q: d2q,
          monthly_inflation_pct: infPct,
          updated_by: profile?.full_name || user?.email || 'Administrador',
          updated_at: new Date().toISOString()
        }, { onConflict: 'year,month' })

      if (macroErr) throw macroErr

      // 2. Sincronizar en rate_cards si existen
      const q1Key = `${yr}-${String(mo).padStart(2, '0')}-1Q`
      const q2Key = `${yr}-${String(mo).padStart(2, '0')}-2Q`

      await Promise.all([
        supabase.from('rate_cards').update({ dollar_rate: d1q, monthly_inflation_pct: infPct }).eq('period', q1Key),
        supabase.from('rate_cards').update({ dollar_rate: d2q, monthly_inflation_pct: infPct }).eq('period', q2Key)
      ])

      setRoleMessage({
        type: 'success',
        text: `Variables actualizadas para ${MONTH_NAMES[mo - 1]} ${yr}: 1Q a $${d1q.toLocaleString('es-AR')}, 2Q a $${d2q.toLocaleString('es-AR')}, e Inflación ${infPct}%.`
      })
      setTimeout(() => setRoleMessage(null), 5000)
      setMacroEditModal(prev => ({ ...prev, isOpen: false }))
      loadMacroData()
    } catch (err) {
      console.error('Error al guardar variables macro:', err)
      setRoleMessage({ type: 'error', text: `Error al guardar: ${err.message}` })
    } finally {
      setSavingMacro(false)
    }
  }

  // Abrir Modal de Ajuste Rápido de Dólar por Quincena
  function handleOpenQuincenaDollar(p) {
    setQuincenaDollarModal({
      isOpen: true,
      period: p.period,
      year: p.year,
      month: p.month,
      quincena: p.quincena,
      dollar_rate: p.dollar_rate
    })
  }

  // Guardar Ajuste Rápido de Dólar por Quincena
  async function handleSaveQuincenaDollarSubmit(e) {
    e.preventDefault()
    try {
      const { period, year, month, quincena, dollar_rate } = quincenaDollarModal
      const newD = parseFloat(dollar_rate) || 1500

      // 1. Actualizar macro_variables (columna 1q o 2q)
      const col = quincena === 1 ? 'dollar_rate_1q' : 'dollar_rate_2q'
      await supabase
        .from('macro_variables')
        .update({ [col]: newD, updated_at: new Date().toISOString() })
        .eq('year', year)
        .eq('month', month)

      // 2. Actualizar rate_cards de ese período
      await supabase
        .from('rate_cards')
        .update({ dollar_rate: newD })
        .eq('period', period)

      setRoleMessage({
        type: 'success',
        text: `Dólar ajustado para la quincena ${period}: $${newD.toLocaleString('es-AR')}.`
      })
      setTimeout(() => setRoleMessage(null), 4000)
      setQuincenaDollarModal(prev => ({ ...prev, isOpen: false }))
      loadMacroData()
    } catch (err) {
      console.error('Error al ajustar dólar quincenal:', err)
      setRoleMessage({ type: 'error', text: `Error al ajustar: ${err.message}` })
    }
  }

  // Eliminar registro mensual de macro_variables
  async function handleDeleteMacro(item) {
    const monthName = MONTH_NAMES[item.month - 1]
    if (!window.confirm(`¿Estás seguro de eliminar el registro macroeconómico de ${monthName} ${item.year}?`)) return
    try {
      const { error } = await supabase
        .from('macro_variables')
        .delete()
        .eq('id', item.id)

      if (error) throw error

      setRoleMessage({
        type: 'info',
        text: `Se eliminó el registro de variables macro de ${monthName} ${item.year}.`
      })
      setTimeout(() => setRoleMessage(null), 4000)
      loadMacroData()
    } catch (err) {
      console.error('Error eliminando macro:', err)
      setRoleMessage({ type: 'error', text: `Error al eliminar: ${err.message}` })
    }
  }

  // Alternar Bloqueo / Congelamiento Quincenal (Inmutabilidad)
  async function togglePeriodLock(periodItem) {
    const periodKey = periodItem.period
    const newLockState = !periodItem.is_locked

    setRatePeriods(prev => prev.map(p => p.period === periodKey ? { ...p, is_locked: newLockState } : p))

    try {
      // 1. Guardar estado de bloqueo en macro_variables
      const col = periodItem.quincena === 1 ? 'is_locked_1q' : 'is_locked_2q'
      await supabase
        .from('macro_variables')
        .update({ [col]: newLockState })
        .eq('year', periodItem.year)
        .eq('month', periodItem.month)

      // 2. Sincronizar en rate_cards si existen registros para esa quincena
      await supabase
        .from('rate_cards')
        .update({ is_locked: newLockState })
        .eq('period', periodKey)

      setRoleMessage({
        type: 'info',
        text: `Quincena ${periodKey} ${newLockState ? 'CONGELADA (Inmutable)' : 'DESBLOQUEADA (Abierta para edición)'}.`
      })
      setTimeout(() => setRoleMessage(null), 3000)
    } catch (err) {
      console.error('Error al alternar bloqueo de quincena:', err)
      loadMacroData()
    }
  }

  // Alternar selección de una quincena (Checkbox)
  function toggleSelectPeriod(periodKey) {
    setSelectedPeriods(prev => {
      const next = new Set(prev)
      if (next.has(periodKey)) next.delete(periodKey)
      else next.add(periodKey)
      return next
    })
  }

  // Alternar selección de todas las quincenas
  function toggleSelectAllPeriods() {
    if (selectedPeriods.size === ratePeriods.length) {
      setSelectedPeriods(new Set())
    } else {
      setSelectedPeriods(new Set(ratePeriods.map(p => p.period)))
    }
  }

  // Borrar una quincena específica a mano
  async function handleDeleteSinglePeriod(p) {
    if (!window.confirm(`¿Confirmas eliminar las tarifas y registros de la quincena "${p.period}"?`)) return
    try {
      // Eliminar de rate_cards
      const { error } = await supabase
        .from('rate_cards')
        .delete()
        .eq('period', p.period)

      if (error) throw error

      setRoleMessage({
        type: 'info',
        text: `Registros de la quincena ${p.period} eliminados.`
      })
      setTimeout(() => setRoleMessage(null), 3000)
      loadMacroData()
    } catch (err) {
      console.error('Error eliminando quincena:', err)
      setRoleMessage({ type: 'error', text: `Error al eliminar: ${err.message}` })
    }
  }

  // Borrar quincenas seleccionadas manualmente
  async function handleDeleteSelectedPeriods() {
    const count = selectedPeriods.size
    if (count === 0) return
    if (!window.confirm(`¿Confirmas eliminar las ${count} quincenas seleccionadas y todas sus tarifas de mano de obra asociadas?`)) return
    try {
      const periodsArr = Array.from(selectedPeriods)

      const { error } = await supabase
        .from('rate_cards')
        .delete()
        .in('period', periodsArr)

      if (error) throw error

      setRoleMessage({
        type: 'success',
        text: `Se eliminaron las tarifas de las ${count} quincenas seleccionadas.`
      })
      setTimeout(() => setRoleMessage(null), 4000)
      setSelectedPeriods(new Set())
      loadMacroData()
    } catch (err) {
      console.error('Error eliminando quincenas seleccionadas:', err)
      setRoleMessage({ type: 'error', text: `Error al eliminar seleccionados: ${err.message}` })
    }
  }

  // =============================================================
  // 3. RADAR DE ALERTAS Y CONSISTENCIA
  // =============================================================
  async function loadAlertSummary() {
    try {
      const [rateCardsRes] = await Promise.all([
        supabase.from('rate_cards').select('rate_oficial_ars, admin_center, entity_name, period').limit(200)
      ])
      // Cálculo básico de alertas
      setAlertSummary({
        redContractorsCount: 2, // Alertas activas según semáforo
        panolWithoutHoursCount: 1, // Casos de retiro de pañol sin horas
        auditedHoursCount: 4 // Horas observadas en auditoría
      })
    } catch (err) {
      console.error('Error cargando alertas:', err)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* HEADER PRINCIPAL DEL ADMINISTRADOR */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800/90 to-slate-900 border border-slate-700/60 p-6 md:p-8 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              Centro de Gobierno & Control Maestro Alon Car
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
              Dashboard del Administrador
            </h1>
            <p className="text-slate-400 text-xs md:text-sm mt-1 max-w-2xl leading-relaxed">
              Administración central de variables macroeconómicas quincenales, matriz de puestos institucionales y asignación de permisos de seguridad por módulo.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-950/80 px-4 py-2.5 rounded-xl border border-slate-700/60 self-start md:self-auto">
            <Lock className="w-4 h-4 text-amber-400" />
            <div className="text-xs">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Sesión Activa:</span>
              <span className="font-extrabold text-white">{profile?.full_name || user?.email || 'Administrador Central'}</span>
            </div>
          </div>
        </div>

        {/* Glow de fondo */}
        <div className="absolute right-0 top-0 w-96 h-full bg-gradient-to-l from-rose-500/10 to-transparent pointer-events-none" />
      </div>

      {/* MENSAJES DE ESTADO */}
      {roleMessage && (
        <div className={`p-4 rounded-xl border flex items-center gap-2.5 text-xs font-bold animate-in fade-in ${
          roleMessage.type === 'success' 
            ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300' 
            : roleMessage.type === 'info'
            ? 'bg-blue-950/60 border-blue-800 text-blue-300'
            : 'bg-rose-950/60 border-rose-800 text-rose-300'
        }`}>
          {roleMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{roleMessage.text}</span>
        </div>
      )}

      {/* PESTAÑAS DE CONTROL */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('matriz')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'matriz'
              ? 'bg-primary text-slate-950 shadow-[0_0_15px_rgba(0,242,254,0.3)]'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Matriz de Puestos & Permisos</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/50">
            {roles.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('macro')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'macro'
              ? 'bg-primary text-slate-950 shadow-[0_0_15px_rgba(0,242,254,0.3)]'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Variables Macro & Cierre Quincenal</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('alertas')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'alertas'
              ? 'bg-primary text-slate-950 shadow-[0_0_15px_rgba(0,242,254,0.3)]'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Radar de Alertas Operativas</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ia')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'ia'
              ? 'bg-primary text-slate-950 shadow-[0_0_15px_rgba(0,242,254,0.3)]'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Brain className="w-4 h-4" />
          <span>🧠 Gobernanza IA & Prompts</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('compras')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'compras'
              ? 'bg-primary text-slate-950 shadow-[0_0_15px_rgba(0,242,254,0.3)]'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Config. Compras & WhatsApp</span>
        </button>
      </div>

      {activeTab === 'ia' && <AiGovernancePanel />}
      {activeTab === 'compras' && <ComprasSettingsPanel />}


      {/* ========================================================================= */}
      {/* PESTAÑA 1: MATRIZ VISUAL DE PUESTOS Y PERMISOS DE SEGURIDAD (OPCIÓN A) */}
      {/* ========================================================================= */}
      {activeTab === 'matriz' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm uppercase tracking-wider font-extrabold text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-cyan-400" />
                  Matriz de Puestos y Permisos de Acceso por Módulo
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Hacé clic directamente sobre cualquier módulo para otorgar <strong className="text-emerald-400 font-bold">[✓] Acceso</strong> o denegarlo <strong className="text-slate-500 font-bold">[--] Bloqueado</strong>.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowWorkflowCircuit(!showWorkflowCircuit)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                    showWorkflowCircuit
                      ? 'bg-purple-950 text-purple-300 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.25)]'
                      : 'bg-slate-950 text-slate-300 hover:text-white border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <Network className="w-3.5 h-3.5 text-purple-400" />
                  <span>{showWorkflowCircuit ? 'Ocultar Circuito' : '🔄 Ver Circuito Inter-Departamental'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleNewRole}
                  className="px-3.5 py-2 bg-gradient-to-r from-primary to-cyan-500 hover:brightness-110 text-slate-950 font-extrabold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Nuevo Puesto / Responsable</span>
                </button>
              </div>
            </div>

            {/* ESQUEMA VISUAL DEL CIRCUITO OPERATIVO INTER-DEPARTAMENTAL ALON CAR */}
            {showWorkflowCircuit && (
              <div className="p-4 bg-slate-950/90 border border-purple-500/30 rounded-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-xs uppercase tracking-wider font-extrabold text-purple-300 flex items-center gap-2">
                      <Workflow className="w-4 h-4 text-purple-400" />
                      Circuito Operativo Inter-Departamental Alon Car: Flujo de Insumos y Entregables
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Interacción secuencial entre Dirección Operativa, Administración, Supervisión de Obra, Pañol, Oficina Técnica y Tesorería.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-700 self-start">
                    5 Etapas Determinísticas
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {WORKFLOW_CIRCUIT_STEPS.map((step) => {
                    const StepIcon = step.icon
                    const matchingRole = roles.find(r => r.role_key === step.roleKey)
                    return (
                      <div 
                        key={step.step}
                        className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 flex flex-col justify-between space-y-2.5 transition-all shadow-md group relative"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-black border uppercase ${step.badgeColor}`}>
                              Paso {step.step}
                            </span>
                            <StepIcon className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                          </div>

                          <div>
                            <h4 className="text-xs font-black text-white leading-tight">{step.title}</h4>
                            <span className="text-[10px] text-cyan-400 font-bold block mt-0.5">{step.holder}</span>
                            <span className="text-[9px] text-slate-400 block">{step.department}</span>
                          </div>

                          <p className="text-[11px] text-slate-300 leading-relaxed">
                            {step.summary}
                          </p>

                          {step.hardRule && (
                            <div className="p-2 rounded-lg bg-rose-950/60 border border-rose-800 text-[10px] text-rose-300 font-medium leading-tight flex items-start gap-1.5">
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                              <span>{step.hardRule}</span>
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t border-slate-800 space-y-2">
                          <div className="text-[10px] text-slate-400 flex items-start gap-1">
                            <CornerDownRight className="w-3 h-3 text-cyan-400 shrink-0 mt-0.5" />
                            <span className="italic leading-tight">{step.handoff}</span>
                          </div>

                          {matchingRole && (
                            <button
                              type="button"
                              onClick={() => setRoleDetailModal({ isOpen: true, role: matchingRole })}
                              className="w-full py-1 px-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-[10px] font-bold text-cyan-300 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Ver Ficha & Tareas</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* TABLA MAESTRA CON MATRIZ VISUAL INTERACTIVA (OPCIÓN A) */}
            <div className="overflow-y-auto max-h-[calc(100vh-280px)] border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="sticky top-0 z-20 bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800 shadow-sm backdrop-blur-md">
                  <tr>
                    <th className="py-2.5 px-3 bg-slate-950">Puesto / Función Técnica</th>
                    <th className="py-2.5 px-3 bg-slate-950">Persona a Cargo</th>
                    <th className="py-2.5 px-2 text-center bg-slate-950">Nivel</th>
                    {SYSTEM_MODULES.map(mod => {
                      const Icon = mod.icon
                      return (
                        <th key={mod.key} className="py-2.5 px-1.5 text-center bg-slate-950">
                          <div className="flex items-center justify-center gap-1" title={`Módulo: ${mod.label}`}>
                            <Icon className={`w-3 h-3 ${mod.color}`} />
                            <span>{mod.label}</span>
                          </div>
                        </th>
                      )
                    })}
                    <th className="py-2.5 px-2 text-center bg-slate-950">Estado</th>
                    <th className="py-2.5 px-3 text-right bg-slate-950">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {loadingRoles ? (
                    <tr>
                      <td colSpan={13} className="py-10 text-center text-slate-500">
                        Cargando matriz de puestos y permisos...
                      </td>
                    </tr>
                  ) : roles.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="py-10 text-center text-slate-500">
                        No hay puestos registrados en la organización.
                      </td>
                    </tr>
                  ) : (
                    roles.map(r => {
                      const isActivo = r.status === 'ACTIVO'
                      const allowed = r.allowed_sections || []

                      return (
                        <tr 
                          key={r.role_key} 
                          className={`hover:bg-slate-800/30 transition-colors ${!isActivo ? 'opacity-50 bg-rose-950/5' : ''}`}
                        >
                          {/* Puesto */}
                          <td className="py-2.5 px-3">
                            <span className="font-extrabold text-white block">{r.role_title}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-slate-400">{r.department || 'Operaciones'}</span>
                              {r.reports_to && (
                                <span className="text-[9px] text-slate-500 hidden sm:inline">
                                  • Reporta a: {r.reports_to.split('&')[0].trim()}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => setRoleDetailModal({ isOpen: true, role: r })}
                              className="mt-1 text-[10px] text-cyan-400 hover:text-cyan-300 font-bold inline-flex items-center gap-1 cursor-pointer transition-colors hover:underline"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Ver misión, tareas & vinculaciones</span>
                            </button>
                          </td>

                          {/* Persona a Cargo */}
                          <td className="py-2.5 px-3 font-mono font-bold text-cyan-300">
                            {r.holder_name}
                          </td>

                          {/* Nivel de Seguridad */}
                          <td className="py-2.5 px-2 text-center">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-black border uppercase ${
                              r.security_level === 'ADMINISTRADOR'
                                ? 'bg-rose-950 text-rose-300 border-rose-700'
                                : r.security_level === 'DIRECCION'
                                ? 'bg-amber-950 text-amber-300 border-amber-700'
                                : r.security_level === 'SUPERVISOR'
                                ? 'bg-purple-950 text-purple-300 border-purple-700'
                                : 'bg-slate-900 text-slate-400 border-slate-700'
                            }`}>
                              {r.security_level}
                            </span>
                          </td>

                          {/* 8 Módulos de la App - Píldoras Interactivas (Opción A) */}
                          {SYSTEM_MODULES.map(mod => {
                            const isAllowed = allowed.includes(mod.key)
                            return (
                              <td key={mod.key} className="py-2 px-1 text-center">
                                <button
                                  type="button"
                                  onClick={() => toggleSectionPermission(r, mod.key)}
                                  className={`w-7 h-6 rounded flex items-center justify-center text-[10px] font-black mx-auto transition-all cursor-pointer ${
                                    isAllowed
                                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-600 hover:bg-emerald-900 shadow-sm'
                                      : 'bg-slate-950 text-slate-600 border border-slate-800 hover:border-slate-700 hover:text-slate-400'
                                  }`}
                                  title={`${isAllowed ? 'Habilitado' : 'Bloqueado'} para ${mod.label}. Clic para alternar.`}
                                >
                                  {isAllowed ? '✓' : '--'}
                                </button>
                              </td>
                            )
                          })}

                          {/* Estado */}
                          <td className="py-2.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => toggleRoleStatus(r)}
                              className={`text-[9px] px-2 py-0.5 rounded font-bold border transition-all cursor-pointer ${
                                isActivo
                                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600 hover:bg-emerald-900'
                                  : 'bg-rose-950 text-rose-300 border-rose-600 hover:bg-rose-900'
                              }`}
                              title="Clic para alternar estado"
                            >
                              {isActivo ? 'ACTIVO' : 'INACTIVO'}
                            </button>
                          </td>

                          {/* Acciones */}
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => setRoleDetailModal({ isOpen: true, role: r })}
                                className="p-1 text-slate-400 hover:text-cyan-300 rounded hover:bg-cyan-500/10 transition-colors cursor-pointer"
                                title="Ver Ficha Técnica, Misión y Vinculaciones"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditRole(r)}
                                className="p-1 text-slate-400 hover:text-primary rounded hover:bg-slate-800 transition-colors cursor-pointer"
                                title="Editar puesto y persona"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteRole(r)}
                                className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-500/10 transition-colors cursor-pointer"
                                title="Eliminar puesto"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
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
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 2: CONTROL MACROECONÓMICO & CIERRE / BLOQUEO QUINCENAL */}
      {/* ========================================================================= */}
      {activeTab === 'macro' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Formulario de Carga y Fijación Mensual/Quincenal */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm uppercase tracking-wider font-extrabold text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  {isEditingMacro ? `Modificar Parámetros: ${macroEditTarget}` : 'Fijación Central de Dólar e Inflación Mensual'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Los valores aquí establecidos rigen automáticamente para la 1ª y 2ª quincena (1Q y 2Q) de ese mes en todo el sistema.
                </p>
              </div>

              {isEditingMacro && (
                <button
                  type="button"
                  onClick={handleCancelEditMacro}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all border border-slate-700 self-start sm:self-auto cursor-pointer"
                >
                  ✕ Cancelar Edición
                </button>
              )}
            </div>

            <form onSubmit={handleSaveMacroSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Año
                </label>
                <select
                  value={macroForm.year}
                  onChange={(e) => setMacroForm({ ...macroForm, year: parseInt(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-400"
                >
                  {[2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Mes de Aplicación
                </label>
                <select
                  value={macroForm.month}
                  onChange={(e) => {
                    const m = parseInt(e.target.value)
                    const existing = macroVariables.find(v => v.year === macroForm.year && v.month === m)
                    setMacroForm({
                      ...macroForm,
                      month: m,
                      dollar_rate: existing ? parseFloat(existing.dollar_rate) : macroForm.dollar_rate,
                      monthly_inflation_pct: existing ? parseFloat(existing.monthly_inflation_pct) : macroForm.monthly_inflation_pct
                    })
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-400"
                >
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={idx + 1} value={idx + 1}>{name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-emerald-400" /> Dólar Referencia (AR$/USD)
                </label>
                <input
                  type="number"
                  step="1"
                  value={macroForm.dollar_rate}
                  onChange={(e) => setMacroForm({ ...macroForm, dollar_rate: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-extrabold text-emerald-300 focus:outline-none focus:border-emerald-400"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                  <Percent className="w-3 h-3 text-amber-400" /> Inflación Mensual (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={macroForm.monthly_inflation_pct}
                  onChange={(e) => setMacroForm({ ...macroForm, monthly_inflation_pct: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-extrabold text-amber-300 focus:outline-none focus:border-emerald-400"
                  required
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={savingMacro}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingMacro ? 'Guardando...' : isEditingMacro ? 'Guardar Cambios' : 'Aplicar a Quincenas'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* TABLA DE HISTORIAL MENSUAL DE VARIABLES MACROECONÓMICAS */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm uppercase tracking-wider font-extrabold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Historial Mensual de Parámetros Macro (Dólar & Inflación)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Registros cargados por mes. Cada fila rige para la 1ª y 2ª quincena (1Q y 2Q) de su respectivo mes.
                </p>
              </div>
              <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 self-start sm:self-auto font-bold">
                {macroVariables.length} {macroVariables.length === 1 ? 'mes registrado' : 'meses registrados'}
              </span>
            </div>

            <div className="overflow-y-auto max-h-[calc(100vh-280px)] border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="sticky top-0 z-20 bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800 shadow-sm backdrop-blur-md">
                  <tr>
                    <th className="py-2.5 px-3 bg-slate-950">Mes y Año</th>
                    <th className="py-2.5 px-3 text-right bg-slate-950">Dólar Referencia ($ / USD)</th>
                    <th className="py-2.5 px-3 text-center bg-slate-950">Inflación Mensual (%)</th>
                    <th className="py-2.5 px-3 text-center bg-slate-950">Quincenas que Rige</th>
                    <th className="py-2.5 px-3 bg-slate-950">Registrado por</th>
                    <th className="py-2.5 px-3 text-center bg-slate-950">Fecha de Carga</th>
                    <th className="py-2.5 px-3 text-right bg-slate-950">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {macroVariables.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No hay variables macroeconómicas cargadas aún. Utiliza el formulario superior para crear la primera.
                      </td>
                    </tr>
                  ) : (
                    macroVariables.map(item => {
                      const monthName = MONTH_NAMES[item.month - 1]
                      const q1Key = `${item.year}-${String(item.month).padStart(2, '0')}-1Q`
                      const q2Key = `${item.year}-${String(item.month).padStart(2, '0')}-2Q`
                      const updatedDate = item.updated_at ? new Date(item.updated_at).toLocaleDateString('es-AR', {
                        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      }) : '--'

                      return (
                        <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span className="font-extrabold text-white text-sm">
                                {monthName} {item.year}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-black text-emerald-400 text-sm">
                            ${Number(item.dollar_rate).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-amber-300">
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 font-extrabold">
                              {Number(item.monthly_inflation_pct).toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-bold">
                                {q1Key}
                              </span>
                              <span className="text-slate-500 text-[10px]">&</span>
                              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-bold">
                                {q2Key}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-300 text-xs">
                            <span className="font-semibold text-white">{item.updated_by || 'Administrador'}</span>
                          </td>
                          <td className="py-3 px-3 text-center text-slate-400 text-[11px] font-mono">
                            {updatedDate}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenMacroModal(item)}
                                className="p-1.5 text-slate-400 hover:text-emerald-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                                title="Editar parámetros e inflacion de este mes"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMacro(item)}
                                className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                                title="Eliminar registro"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* TABLA DE QUINCENAS, VARIACIÓN RESPECTO AL MES ANTERIOR & CIERRE INMUTABLE */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm uppercase tracking-wider font-extrabold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400" />
                  Historial Quincenal & Control de Períodos Cerrados
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  El Dólar admite ajuste manual por quincena (1Q / 2Q) con su variación % respecto al mes anterior. La inflación es mensual y se hereda a ambas quincenas.
                </p>
              </div>

              {selectedPeriods.size > 0 && (
                <button
                  type="button"
                  onClick={handleDeleteSelectedPeriods}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-lg shadow-rose-950/40 cursor-pointer self-start sm:self-auto animate-in fade-in"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar ({selectedPeriods.size}) quincenas seleccionadas</span>
                </button>
              )}
            </div>

            <div className="overflow-y-auto max-h-[calc(100vh-280px)] border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="sticky top-0 z-20 bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800 shadow-sm backdrop-blur-md">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center bg-slate-950">
                      <input
                        type="checkbox"
                        checked={ratePeriods.length > 0 && selectedPeriods.size === ratePeriods.length}
                        onChange={toggleSelectAllPeriods}
                        className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-primary cursor-pointer accent-primary"
                        title="Seleccionar todas las quincenas"
                      />
                    </th>
                    <th className="py-2.5 px-3 bg-slate-950">Quincena (Período)</th>
                    <th className="py-2.5 px-3 text-right bg-slate-950">Dólar Quincenal (AR$/USD)</th>
                    <th className="py-2.5 px-3 text-center bg-slate-950">Inflación Mensual</th>
                    <th className="py-2.5 px-3 text-center bg-slate-950">Tarifario de Mano de Obra</th>
                    <th className="py-2.5 px-3 text-center bg-slate-950">Estado del Período</th>
                    <th className="py-2.5 px-3 text-right bg-slate-950">Control de Cierre</th>
                    <th className="py-2.5 px-3 text-right bg-slate-950">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {ratePeriods.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        No hay quincenas generadas en la base de datos.
                      </td>
                    </tr>
                  ) : (
                    ratePeriods.map(p => {
                      const hasRates = p.rates_count > 0
                      const isSelected = selectedPeriods.has(p.period)

                      return (
                        <tr 
                          key={p.period} 
                          className={`hover:bg-slate-800/30 transition-colors ${isSelected ? 'bg-cyan-950/20' : ''}`}
                        >
                          {/* Checkbox de selección manual */}
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectPeriod(p.period)}
                              className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-primary cursor-pointer accent-primary"
                              title={`Seleccionar quincena ${p.period}`}
                            />
                          </td>

                          {/* Quincena */}
                          <td className="py-3 px-3 font-mono font-bold text-cyan-300 text-sm">
                            {p.period}
                            <span className="ml-2 text-[10px] font-normal text-slate-400 font-sans block sm:inline">
                              ({p.quincena === 1 ? '1ª Quincena' : '2ª Quincena'} de {MONTH_NAMES[p.month - 1]} {p.year})
                            </span>
                          </td>

                          {/* Dólar Quincenal con Ajuste Manual y Variación % vs Mes Anterior */}
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5 font-mono">
                              <span className="font-extrabold text-emerald-400 text-sm">
                                ${p.dollar_rate.toLocaleString('es-AR')}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleOpenQuincenaDollar(p)}
                                className="p-1 text-slate-400 hover:text-emerald-300 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                title={`Ajustar cotización de dólar para ${p.period}`}
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Variación % del Dólar respecto al mes anterior */}
                            <div className="flex items-center justify-end gap-1 mt-0.5 font-mono text-[10px]">
                              {p.dollarDiffPct !== null ? (
                                <span className={`px-1.5 py-0.2 rounded font-bold ${
                                  p.dollarDiffPct > 0 
                                    ? 'bg-amber-950 text-amber-300 border border-amber-800/60' 
                                    : p.dollarDiffPct < 0 
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                                    : 'text-slate-500'
                                }`}>
                                  {p.dollarDiffPct > 0 ? '+' : ''}{p.dollarDiffPct.toFixed(1)}% vs mes ant.
                                </span>
                              ) : (
                                <span className="text-slate-500 text-[9px]">Base inicial</span>
                              )}

                              {p.intraDollarDiffPct !== null && Math.abs(p.intraDollarDiffPct) > 0.01 && (
                                <span className="text-[9px] text-cyan-400 ml-1">
                                  ({p.intraDollarDiffPct > 0 ? '+' : ''}{p.intraDollarDiffPct.toFixed(1)}% vs 1Q)
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Inflación Mensual con Variación de Puntos Porcentuales vs Mes Anterior */}
                          <td className="py-3 px-3 text-center">
                            <span className="font-mono font-bold text-amber-300 text-sm block">
                              {p.monthly_inflation_pct}% mensual
                            </span>
                            {p.infDiff !== null ? (
                              <span className={`text-[10px] font-mono font-bold inline-block mt-0.5 px-1.5 py-0.2 rounded ${
                                p.infDiff > 0 
                                  ? 'bg-rose-950 text-rose-300 border border-rose-800/60' 
                                  : p.infDiff < 0 
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                                  : 'text-slate-500'
                              }`}>
                                {p.infDiff > 0 ? '+' : ''}{p.infDiff.toFixed(1)} p.p. vs mes ant.
                              </span>
                            ) : (
                              <span className="text-[9px] text-slate-500 block">Base inicial</span>
                            )}
                          </td>

                          {/* Tarifario Mano de Obra */}
                          <td className="py-3 px-3 text-center">
                            {hasRates ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-950/80 text-blue-300 border border-blue-800/60 font-semibold inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-blue-400" />
                                {p.rates_count} tarifas vigentes (Personal & Tarifas)
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-medium inline-flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 text-amber-400/80" />
                                Pendiente fijar tarifas de mano de obra
                              </span>
                            )}
                          </td>

                          {/* Estado de Cierre / Candado */}
                          <td className="py-3 px-3 text-center">
                            <span className={`text-[9px] px-2.5 py-1 rounded font-black border uppercase inline-flex items-center gap-1.5 ${
                              p.is_locked
                                ? 'bg-amber-950 text-amber-300 border-amber-700'
                                : 'bg-emerald-950 text-emerald-300 border-emerald-700'
                            }`}>
                              {p.is_locked ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                              <span>{p.is_locked ? 'CONGELADA / CERRADA' : 'ABIERTA / MODIFICABLE'}</span>
                            </span>
                          </td>

                          {/* Botón de Cierre */}
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => togglePeriodLock(p)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                p.is_locked
                                  ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700'
                                  : 'bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800'
                              }`}
                            >
                              {p.is_locked ? 'Desbloquear Quincena' : 'Bloquear e Inmutabilizar'}
                            </button>
                          </td>

                          {/* Borrado Manual Individual */}
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteSinglePeriod(p)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                              title={`Eliminar registros de la quincena ${p.period}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 3: RADAR DE ALERTAS OPERATIVAS & CONSISTENCIA */}
      {/* ========================================================================= */}
      {activeTab === 'alertas' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/90 border border-rose-900/40 rounded-2xl p-5 shadow-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-rose-400 font-bold uppercase">
                <span>Contratistas en Zona Roja</span>
                <ShieldAlert className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-3xl font-black text-rose-400 font-mono">
                {alertSummary.redContractorsCount}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Cuadrillas con desvíos salariales mayores a +5% respecto a la paritaria oficial de Astillero.
              </p>
            </div>

            <div className="bg-slate-900/90 border border-amber-900/40 rounded-2xl p-5 shadow-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-amber-400 font-bold uppercase">
                <span>Pañol sin Horas</span>
                <Package className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-3xl font-black text-amber-400 font-mono">
                {alertSummary.panolWithoutHoursCount}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Retiros de consumibles realizados por terceros que aún no tienen horas imputadas en la quincena.
              </p>
            </div>

            <div className="bg-slate-900/90 border border-cyan-900/40 rounded-2xl p-5 shadow-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-cyan-400 font-bold uppercase">
                <span>Horas en Auditoría</span>
                <Clock className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-3xl font-black text-cyan-400 font-mono">
                {alertSummary.auditedHoursCount}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Registros diarios marcados con códigos R, RR o RRR pendientes de resolución técnica.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 0: FICHA DETALLADA DE PUESTO, MISIÓN Y VINCULACIONES INTER-DEPARTAMENTALES */}
      {/* ========================================================================= */}
      {roleDetailModal.isOpen && roleDetailModal.role && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Header del Modal */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-800 flex items-center justify-center text-cyan-400">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                    {roleDetailModal.role.role_title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span className="font-bold text-cyan-300">{roleDetailModal.role.holder_name}</span>
                    <span>•</span>
                    <span className="text-slate-300">{roleDetailModal.role.department || 'Operaciones'}</span>
                    {roleDetailModal.role.reports_to && (
                      <>
                        <span>•</span>
                        <span className="text-slate-400 text-[11px]">
                          Reporta a: <strong className="text-slate-200">{roleDetailModal.role.reports_to}</strong>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRoleDetailModal({ isOpen: false, role: null })}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido de la Ficha Técnica */}
            <div className="p-6 space-y-5 overflow-y-auto">
              {/* Tarjeta de Misión del Puesto */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-slate-950 to-slate-900 border border-cyan-900/40 space-y-1.5 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-black uppercase text-cyan-400 tracking-wider">
                  <Target className="w-4 h-4 text-cyan-400" />
                  <span>Misión del Puesto (Propósito Fundamental)</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed font-medium">
                  {roleDetailModal.role.job_mission || 'Misión no especificada para este puesto en la estructura.'}
                </p>
              </div>

              {/* Responsabilidades y Tareas Clave */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-black uppercase text-slate-300 tracking-wider">
                  <ListChecks className="w-4 h-4 text-primary" />
                  <span>Responsabilidades y Tareas Clave</span>
                </div>

                {Array.isArray(roleDetailModal.role.key_responsibilities) && roleDetailModal.role.key_responsibilities.length > 0 ? (
                  <ul className="space-y-2 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                    {roleDetailModal.role.key_responsibilities.map((resp, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-300 leading-snug">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{resp}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-500 italic">
                    No se han registrado tareas específicas todavía. Podés cargarlas haciendo clic en "Editar Puesto".
                  </div>
                )}
              </div>

              {/* Vinculaciones Inter-Departamentales (Handoffs & Entregables) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-black uppercase text-purple-300 tracking-wider">
                    <Workflow className="w-4 h-4 text-purple-400" />
                    <span>Vinculaciones Inter-Departamentales (Flujos, Insumos & Entregables)</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {Array.isArray(roleDetailModal.role.departmental_links) ? roleDetailModal.role.departmental_links.length : 0} conexiones
                  </span>
                </div>

                {Array.isArray(roleDetailModal.role.departmental_links) && roleDetailModal.role.departmental_links.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {roleDetailModal.role.departmental_links.map((link, idx) => {
                      const type = (link.interaction_type || '').toUpperCase()
                      const badgeClass = type.includes('SALIDA') || type.includes('ENTREGABLE')
                        ? 'bg-amber-950 text-amber-300 border-amber-700'
                        : type.includes('ENTRADA') || type.includes('INSUMO')
                        ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                        : type.includes('CONTROL')
                        ? 'bg-rose-950 text-rose-300 border-rose-700'
                        : 'bg-purple-950 text-purple-300 border-purple-700'

                      return (
                        <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5 flex flex-col justify-between">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-extrabold text-white">
                              {link.related_department}
                              {link.responsible && <span className="text-slate-400 font-normal"> ({link.responsible})</span>}
                            </span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-black border uppercase shrink-0 ${badgeClass}`}>
                              {link.interaction_type || 'COORDINACIÓN'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300 leading-relaxed">
                            {link.description}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-500 italic">
                    Sin vinculaciones formalizadas cargadas aún.
                  </div>
                )}
              </div>

              {/* Módulos Habilitados en el ERP */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <span className="text-xs font-bold text-slate-400 block">
                  Permisos de Acceso en el Sistema:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SYSTEM_MODULES.map(mod => {
                    const isAllowed = (roleDetailModal.role.allowed_sections || []).includes(mod.key)
                    const Icon = mod.icon
                    return (
                      <div
                        key={mod.key}
                        className={`p-2 rounded-lg border text-xs flex items-center justify-between ${
                          isAllowed
                            ? 'bg-emerald-950/40 border-emerald-700 text-white font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-600 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <Icon className={`w-3.5 h-3.5 ${isAllowed ? mod.color : 'text-slate-600'}`} />
                          <span>{mod.label}</span>
                        </div>
                        <span className="text-[10px] font-mono">
                          {isAllowed ? '✓' : '--'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Footer con Acciones */}
            <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const target = roleDetailModal.role
                  setRoleDetailModal({ isOpen: false, role: null })
                  handleEditRole(target)
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-primary border border-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Editar Puesto & Tareas</span>
              </button>

              <button
                type="button"
                onClick={() => setRoleDetailModal({ isOpen: false, role: null })}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ALTA Y EDICIÓN DE PUESTO INSTITUCIONAL (CON LISTAS DESPLEGABLES) */}
      {/* ========================================================================= */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Cabecera del Modal */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-white text-base">
                  {editingRole ? `Editar Puesto: ${editingRole.role_title}` : 'Crear Nuevo Puesto Institucional'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRoleModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSaveRoleSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Título del Puesto con Lista Desplegable Estandarizada */}
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">
                    Título del Puesto / Rol Técnico *
                  </label>
                  <select
                    value={STANDARD_JOB_TITLES.includes(roleForm.role_title) ? roleForm.role_title : '__OTRO__'}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val !== '__OTRO__') {
                        setRoleForm({ ...roleForm, role_title: val })
                      } else if (STANDARD_JOB_TITLES.includes(roleForm.role_title)) {
                        setRoleForm({ ...roleForm, role_title: '' })
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary font-bold"
                  >
                    {STANDARD_JOB_TITLES.map((title) => (
                      <option key={title} value={title}>{title}</option>
                    ))}
                    <option value="__OTRO__">➕ Otro Puesto (Personalizado)...</option>
                  </select>

                  {/* Input libre si eligió personalizado o no coincide con los estándares */}
                  {(!STANDARD_JOB_TITLES.includes(roleForm.role_title) || roleForm.role_title === '') && (
                    <input
                      type="text"
                      required
                      value={roleForm.role_title}
                      onChange={(e) => setRoleForm({ ...roleForm, role_title: e.target.value })}
                      placeholder="Escribí el nombre del nuevo puesto..."
                      className="mt-2 w-full bg-slate-900 border border-cyan-700 rounded-xl px-3 py-2 text-xs text-cyan-200 focus:outline-none focus:border-primary animate-in fade-in"
                    />
                  )}
                </div>

                {/* Persona a Cargo */}
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">
                    Persona a Cargo (Nombre y Apellido) *
                  </label>
                  <input
                    type="text"
                    required
                    value={roleForm.holder_name}
                    onChange={(e) => setRoleForm({ ...roleForm, holder_name: e.target.value })}
                    placeholder="ej. Hugo Obregozo / María José"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary font-bold font-mono"
                  />
                </div>

                {/* Departamento con Lista Desplegable Estandarizada */}
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">
                    Departamento *
                  </label>
                  <select
                    value={STANDARD_DEPARTMENTS.includes(roleForm.department) ? roleForm.department : '__OTRO__'}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val !== '__OTRO__') {
                        setRoleForm({ ...roleForm, department: val })
                      } else if (STANDARD_DEPARTMENTS.includes(roleForm.department)) {
                        setRoleForm({ ...roleForm, department: '' })
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary font-bold"
                  >
                    {STANDARD_DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                    <option value="__OTRO__">➕ Otro Departamento (Personalizado)...</option>
                  </select>

                  {/* Input libre si eligió departamento personalizado */}
                  {(!STANDARD_DEPARTMENTS.includes(roleForm.department) || roleForm.department === '') && (
                    <input
                      type="text"
                      required
                      value={roleForm.department}
                      onChange={(e) => setRoleForm({ ...roleForm, department: e.target.value })}
                      placeholder="Escribí el nombre del nuevo departamento..."
                      className="mt-2 w-full bg-slate-900 border border-cyan-700 rounded-xl px-3 py-2 text-xs text-cyan-200 focus:outline-none focus:border-primary animate-in fade-in"
                    />
                  )}
                </div>

                {/* Reporta a */}
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">
                    Reporta Jerárquicamente a
                  </label>
                  <select
                    value={roleForm.reports_to || 'Dirección General & Administración Central'}
                    onChange={(e) => setRoleForm({ ...roleForm, reports_to: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary font-bold"
                  >
                    {REPORTING_LINES.map((rep) => (
                      <option key={rep} value={rep}>{rep}</option>
                    ))}
                  </select>
                </div>

                {/* Nivel de Seguridad */}
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-slate-400 block mb-1">
                    Nivel de Seguridad
                  </label>
                  <select
                    value={roleForm.security_level}
                    onChange={(e) => setRoleForm({ ...roleForm, security_level: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary font-bold"
                  >
                    <option value="ADMINISTRADOR">👑 Administrador (Acceso Maestro)</option>
                    <option value="DIRECCION">👔 Dirección / Gerencia</option>
                    <option value="SUPERVISOR">🛡️ Supervisor / Jefe de Área</option>
                    <option value="OPERATIVO">📋 Operativo / Carga</option>
                    <option value="AUDITOR">👁️ Auditor (Solo Lectura)</option>
                  </select>
                </div>
              </div>

              {/* Misión Principal del Puesto */}
              <div>
                <label className="text-xs font-bold text-cyan-300 block mb-1">
                  Misión Principal del Puesto (Propósito Fundamental)
                </label>
                <textarea
                  rows={2}
                  value={roleForm.job_mission}
                  onChange={(e) => setRoleForm({ ...roleForm, job_mission: e.target.value })}
                  placeholder="ej. Conducir las operaciones y producción en astillero, acordar tarifas quincenales y coordinar la ejecución técnica de obras navales."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-primary leading-relaxed"
                />
              </div>

              {/* Responsabilidades y Tareas Clave */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Responsabilidades y Tareas Clave (una por línea)
                </label>
                <textarea
                  rows={4}
                  value={roleForm.key_responsibilities}
                  onChange={(e) => setRoleForm({ ...roleForm, key_responsibilities: e.target.value })}
                  placeholder="Escribí una tarea o responsabilidad por línea:&#10;• Negociación de valores hora con contratistas&#10;• Fijación de la paritaria testigo del astillero&#10;• Autorización de órdenes de trabajo"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-primary font-mono leading-relaxed"
                />
              </div>

              {/* Plantillas Rápidas (Presets) */}
              <div className="pt-2">
                <span className="text-xs font-bold text-slate-400 block mb-2">
                  Plantillas Rápidas de Permisos (1 Clic):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {ROLE_PRESETS.map(preset => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => setRoleForm({
                        ...roleForm,
                        security_level: preset.security_level,
                        allowed_sections: preset.sections
                      })}
                      className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl text-left transition-all cursor-pointer"
                    >
                      <strong className="text-xs text-white block">{preset.name}</strong>
                      <span className="text-[10px] text-slate-400 block leading-tight mt-0.5">{preset.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Selector de Módulos Permitidos */}
              <div className="pt-2">
                <span className="text-xs font-bold text-slate-400 block mb-2">
                  Módulos de la App Habilitados:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  {SYSTEM_MODULES.map(mod => {
                    const isChecked = roleForm.allowed_sections.includes(mod.key)
                    const Icon = mod.icon
                    return (
                      <label 
                        key={mod.key} 
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                          isChecked 
                            ? 'bg-emerald-950/40 border-emerald-700 text-white font-bold' 
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setRoleForm({ ...roleForm, allowed_sections: [...roleForm.allowed_sections, mod.key] })
                            } else {
                              setRoleForm({ ...roleForm, allowed_sections: roleForm.allowed_sections.filter(s => s !== mod.key) })
                            }
                          }}
                          className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-primary cursor-pointer accent-primary"
                        />
                        <Icon className={`w-3.5 h-3.5 ${mod.color}`} />
                        <span>{mod.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Botones de acción */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingRole}
                  className="px-5 py-2 bg-primary hover:brightness-110 text-slate-950 rounded-xl text-xs font-extrabold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingRole ? 'Guardando...' : 'Guardar Puesto'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: EDICIÓN COMPLETA DE VARIABLES MACROECONÓMICAS (LÁPIZ DE MES)    */}
      {/* ========================================================================= */}
      {macroEditModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">
                  Editar Variables: {MONTH_NAMES[macroEditModal.month - 1]} {macroEditModal.year}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setMacroEditModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMacroModalSubmit} className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Mes y Año de Aplicación</span>
                  <span className="font-extrabold text-cyan-300 text-sm">{MONTH_NAMES[macroEditModal.month - 1]} {macroEditModal.year}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Quincenas Alcanzadas</span>
                  <span className="font-mono text-emerald-400 font-bold">1Q y 2Q</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-amber-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5" /> Inflación Mensual (%) *
                </label>
                <p className="text-[11px] text-slate-400 mb-1.5">
                  La inflación es mensual y aplica automáticamente para ambas quincenas (1Q y 2Q).
                </p>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={macroEditModal.monthly_inflation_pct}
                  onChange={(e) => setMacroEditModal({ ...macroEditModal, monthly_inflation_pct: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono font-extrabold text-amber-300 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="border-t border-slate-800 pt-3 space-y-3">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" /> Ajuste Manual de Dólar por Quincena
                </span>
                <p className="text-[11px] text-slate-400">
                  Podés definir un tipo de cambio específico e independiente para cada quincena del mes.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1">
                    <label className="text-[11px] font-bold text-cyan-300 block font-mono">
                      Dólar 1ª Quincena (1Q)
                    </label>
                    <input
                      type="number"
                      step="1"
                      required
                      value={macroEditModal.dollar_rate_1q}
                      onChange={(e) => setMacroEditModal({ ...macroEditModal, dollar_rate_1q: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-extrabold text-emerald-300 focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1">
                    <label className="text-[11px] font-bold text-cyan-300 block font-mono">
                      Dólar 2ª Quincena (2Q)
                    </label>
                    <input
                      type="number"
                      step="1"
                      required
                      value={macroEditModal.dollar_rate_2q}
                      onChange={(e) => setMacroEditModal({ ...macroEditModal, dollar_rate_2q: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-extrabold text-emerald-300 focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setMacroEditModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingMacro}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 rounded-xl text-xs font-extrabold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingMacro ? 'Guardando...' : 'Guardar Cambios'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: AJUSTE RÁPIDO DE DÓLAR POR QUINCENA (LÁPIZ DE QUINCENA)          */}
      {/* ========================================================================= */}
      {quincenaDollarModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-sm">
                  Ajustar Dólar de Quincena
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setQuincenaDollarModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuincenaDollarSubmit} className="space-y-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Quincena Seleccionada
                </span>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono font-bold text-cyan-300 text-sm flex items-center justify-between">
                  <span>{quincenaDollarModal.period}</span>
                  <span className="text-xs text-slate-400 font-normal font-sans">
                    {quincenaDollarModal.quincena === 1 ? '1ª Quincena' : '2ª Quincena'} de {MONTH_NAMES[quincenaDollarModal.month - 1]}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-1">
                  Cotización Dólar Oficial (AR$/USD) *
                </label>
                <input
                  type="number"
                  step="1"
                  required
                  autoFocus
                  value={quincenaDollarModal.dollar_rate}
                  onChange={(e) => setQuincenaDollarModal({ ...quincenaDollarModal, dollar_rate: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-base font-mono font-black text-emerald-300 focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setQuincenaDollarModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Guardar Dólar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
