import { useState, useEffect, useMemo } from 'react'
import {
  Building2,
  Search,
  Network,
  Plus,
  Eye,
  Pencil,
  Trash2,
  X,
  Briefcase,
  Target,
  CheckCircle2,
  CornerDownRight,
  ShieldAlert,
  Workflow,
  Save,
  Ship,
  ClipboardList,
  Clock,
  Package,
  Users,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  AlertCircle
} from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import HighlightText from '../HighlightText.jsx'

// Módulos del sistema controlables en la matriz de seguridad
export const SYSTEM_MODULES = [
  { key: 'barcos', label: 'Barcos y Obras', icon: Ship, color: 'text-blue-400' },
  { key: 'ots', label: 'Órdenes de Trabajo', icon: ClipboardList, color: 'text-indigo-400' },
  { key: 'horas', label: 'Carga de Horas', icon: Clock, color: 'text-cyan-400' },
  { key: 'panol', label: 'Pañol / Materiales', icon: Package, color: 'text-emerald-400' },
  { key: 'personal', label: 'Personal (Nómina)', icon: Users, color: 'text-teal-400' },
  { key: 'tarifario', label: 'Tarifario Quincenal', icon: DollarSign, color: 'text-amber-400' },
  { key: 'analisis', label: 'Análisis FX', icon: TrendingUp, color: 'text-purple-400' },
  { key: 'admin', label: 'Admin', icon: ShieldCheck, color: 'text-rose-400' }
]

// Listas estandarizadas desplegables para Puestos y Departamentos
export const STANDARD_DEPARTMENTS = [
  'Dirección General',
  'Operaciones y Producción Naval',
  'Oficina Técnica & Subcontratos',
  'Administración, Nómina & RRHH',
  'Tesorería, Finanzas & Pagos',
  'Pañol, Logística & Abastecimiento'
]

export const STANDARD_JOB_TITLES = [
  'Dirección General & Administración Central',
  'Dirección Operativa y Negociaciones',
  'Oficina Técnica & Subcontratos',
  'Responsable de Liquidación de Sueldos y RRHH',
  'Supervisión de Obra & Pañol',
  'Tesorería & Pagos',
  'Encargado de Pañol y Control de Materiales',
  'Jefe de Obra y Montaje Naval'
]

export const REPORTING_LINES = [
  'Directorio / Accionistas',
  'Dirección General & Administración Central',
  'Dirección Operativa y Negociaciones',
  'Supervisión de Obra & Pañol'
]

// Circuito Operativo Inter-Departamental Alon Car
export const WORKFLOW_CIRCUIT_STEPS = [
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
    icon: HardHatIcon,
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

function HardHatIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2z" />
      <path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5" />
      <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
    </svg>
  )
}

// Plantillas rápidas de permisos por puesto (Presets)
export const ROLE_PRESETS = [
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

export default function AdminRolesMatrixPanel({ onRoleCountChange }) {
  const [roles, setRoles] = useState([])
  const [roleSearch, setRoleSearch] = useState('')
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

  useEffect(() => {
    loadRoles()
  }, [])

  const filteredRoles = useMemo(() => {
    if (!roleSearch.trim()) return roles
    const q = roleSearch.toLowerCase().trim()
    return roles.filter(r =>
      (r.role_title || '').toLowerCase().includes(q) ||
      (r.holder_name || '').toLowerCase().includes(q) ||
      (r.department || '').toLowerCase().includes(q) ||
      (r.security_level || '').toLowerCase().includes(q)
    )
  }, [roles, roleSearch])

  async function loadRoles() {
    try {
      setLoadingRoles(true)
      const { data, error } = await supabase
        .from('organization_roles')
        .select('*')
        .order('role_title', { ascending: true })

      if (error) throw error
      const list = data || []
      setRoles(list)
      onRoleCountChange?.(list.length)
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

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
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

        {/* BARRA DE BÚSQUEDA ESTÁNDAR */}
        <div className="alon-zone-toolbar p-2.5 rounded-xl border border-slate-800/60 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar puesto, responsable, departamento o nivel de seguridad... (Esc limpia)"
              value={roleSearch}
              onChange={(e) => setRoleSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setRoleSearch('')
                  e.target.blur()
                }
              }}
              className="w-full border border-slate-800 rounded-lg pl-9 pr-10 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all shadow-inner"
            />
            {roleSearch && (
              <button
                type="button"
                onClick={() => setRoleSearch('')}
                className="absolute right-3 top-2 text-slate-500 hover:text-white cursor-pointer"
                title="Limpiar búsqueda"
              >
                ✕
              </button>
            )}
          </div>
          <span className="text-[11px] text-slate-400 whitespace-nowrap">
            Mostrando {filteredRoles.length} de {roles.length} puestos
          </span>
        </div>

        {/* ESQUEMA VISUAL DEL CIRCUITO OPERATIVO INTER-DEPARTAMENTAL ALON CAR */}
        {showWorkflowCircuit && (
          <div className="p-4 bg-purple-950/20 border border-purple-500/30 rounded-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
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
                          className="w-full py-1 px-2 rounded-lg hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-[10px] font-bold text-cyan-300 flex items-center justify-center gap-1 transition-colors cursor-pointer"
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

        {/* TABLA MAESTRA CON MATRIZ VISUAL INTERACTIVA */}
        <div className="overflow-y-auto max-h-[calc(100vh-280px)] border border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="sticky top-0 z-20 alon-grid-thead">
              <tr>
                <th className="py-2.5 px-3">Puesto / Función Técnica</th>
                <th className="py-2.5 px-3">Persona a Cargo</th>
                <th className="py-2.5 px-2 text-center">Nivel</th>
                {SYSTEM_MODULES.map(mod => {
                  const Icon = mod.icon
                  return (
                    <th key={mod.key} className="py-2.5 px-1.5 text-center">
                      <div className="flex items-center justify-center gap-1" title={`Módulo: ${mod.label}`}>
                        <Icon className={`w-3 h-3 ${mod.color}`} />
                        <span>{mod.label}</span>
                      </div>
                    </th>
                  )
                })}
                <th className="py-2.5 px-2 text-center">Estado</th>
                <th className="py-2.5 px-3 text-right">Acciones</th>
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
                filteredRoles.map((r) => {
                  const isActivo = r.status === 'ACTIVO'
                  const allowed = r.allowed_sections || []

                  return (
                    <tr 
                      key={r.role_key} 
                      className={`hover:bg-slate-800/30 transition-colors ${!isActivo ? 'opacity-50 bg-rose-950/5' : ''}`}
                    >
                      {/* Puesto */}
                      <td className="py-2.5 px-3">
                        <span className="font-extrabold text-white block">
                          <HighlightText text={r.role_title} query={roleSearch} />
                        </span>
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
                        <HighlightText text={r.holder_name} query={roleSearch} />
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

                      {/* 8 Módulos de la App - Píldoras Interactivas */}
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

      {/* MODAL 0: FICHA DETALLADA DE PUESTO, MISIÓN Y VINCULACIONES INTER-DEPARTAMENTALES */}
      {roleDetailModal.isOpen && roleDetailModal.role && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Header del Modal */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
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

              {/* Responsabilidades Clave */}
              <div className="space-y-2.5">
                <h4 className="text-xs uppercase font-extrabold text-slate-300 tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Responsabilidades y Tareas Clave</span>
                </h4>
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
                  <p className="text-xs text-slate-500 italic p-3 bg-slate-950/40 rounded-xl border border-slate-800/60">
                    No se han registrado responsabilidades específicas todavía.
                  </p>
                )}
              </div>

              {/* Vinculaciones Inter-Departamentales */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs uppercase font-extrabold text-slate-300 tracking-wider">
                    <Workflow className="w-4 h-4 text-purple-400" />
                    <span>Vinculaciones e Interacciones Inter-Departamentales</span>
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
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                        : type.includes('ENTRADA') || type.includes('INSUMO')
                        ? 'bg-cyan-950/80 text-cyan-300 border-cyan-700'
                        : 'bg-purple-950/80 text-purple-300 border-purple-700'

                      return (
                        <div key={idx} className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5 shadow-sm">
                          <div className="flex items-center justify-between">
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${badgeClass}`}>
                              {link.interaction_type || 'Interacción'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">{link.target_department}</span>
                          </div>
                          <p className="text-xs text-white font-semibold leading-snug">
                            {link.deliverable || link.description}
                          </p>
                          {link.rule && (
                            <div className="text-[10px] text-amber-300/90 font-mono bg-amber-950/30 p-1.5 rounded border border-amber-900/50 flex items-start gap-1">
                              <ShieldAlert className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                              <span>{link.rule}</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic p-3 bg-slate-950/40 rounded-xl border border-slate-800/60">
                    No se han registrado vinculaciones inter-departamentales específicas.
                  </p>
                )}
              </div>

              {/* Acceso a Módulos */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Módulos de la Aplicación Habilitados
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
                            ? 'bg-slate-950 border-emerald-600/60 text-white font-bold'
                            : 'bg-slate-950/40 border-slate-800 text-slate-600 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <Icon className={`w-3.5 h-3.5 ${isAllowed ? mod.color : 'text-slate-600'}`} />
                          <span className="truncate">{mod.label}</span>
                        </div>
                        <span className={`text-[10px] font-black ${isAllowed ? 'text-emerald-400' : 'text-slate-600'}`}>
                          {isAllowed ? '✓' : '--'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Footer del Modal */}
            <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const target = roleDetailModal.role
                  setRoleDetailModal({ isOpen: false, role: null })
                  handleEditRole(target)
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-800/60 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Editar este Puesto</span>
              </button>
              <button
                type="button"
                onClick={() => setRoleDetailModal({ isOpen: false, role: null })}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cerrar Ficha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: ALTA Y EDICIÓN DE PUESTO INSTITUCIONAL */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="alon-modal-card max-w-5xl">
            {/* Cabecera del Modal */}
            <div className="alon-modal-header">
              <div className="flex items-center gap-2.5 min-w-0">
                <Building2 className="w-5 h-5 text-primary shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-black text-white text-sm truncate">
                    {editingRole ? `Editar Puesto: ${editingRole.role_title}` : 'Crear Nuevo Puesto Institucional'}
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate">
                    Recorrido guiado por color y tecla <strong className="text-slate-200">Tab</strong>: 1° Estructura ➔ 2° Misión ➔ 3° Presets ➔ 4° Módulos.
                  </p>
                </div>
              </div>
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setIsRoleModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSaveRoleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden text-xs">
              <div className="alon-modal-body">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-start">
                  {/* COLUMNA IZQUIERDA: BLOQUES 1 Y 2 */}
                  <div className="space-y-3">
                    {/* BLOQUE 1: ESTRUCTURA Y JERARQUÍA INSTITUCIONAL (.alon-chunk-sky) */}
                    <div className="alon-chunk-sky space-y-2.5">
                      <div className="flex items-center justify-between pb-1 border-b border-sky-500/20">
                        <span className="font-black text-[11px] uppercase tracking-wider text-sky-400">
                          1. Estructura y Jerarquía Institucional
                        </span>
                        <span className="text-[10px] text-sky-300/70 font-mono">Puesto & Dependencia</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {/* Título del Puesto con Lista Desplegable Estandarizada */}
                        <div>
                          <label className="text-[11px] font-bold text-slate-300 block mb-1">
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
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-400 font-bold"
                          >
                            {STANDARD_JOB_TITLES.map((title) => (
                              <option key={title} value={title}>{title}</option>
                            ))}
                            <option value="__OTRO__">➕ Otro Puesto (Personalizado)...</option>
                          </select>

                          {(!STANDARD_JOB_TITLES.includes(roleForm.role_title) || roleForm.role_title === '') && (
                            <input
                              type="text"
                              required
                              value={roleForm.role_title}
                              onChange={(e) => setRoleForm({ ...roleForm, role_title: e.target.value })}
                              placeholder="Escribí el nombre del nuevo puesto..."
                              className="mt-1.5 w-full bg-slate-900 border border-sky-600 rounded-xl px-2.5 py-1.5 text-xs text-sky-200 focus:outline-none focus:border-sky-400 animate-in fade-in"
                            />
                          )}
                        </div>

                        {/* Persona a Cargo */}
                        <div>
                          <label className="text-[11px] font-bold text-slate-300 block mb-1">
                            Persona a Cargo (Nombre y Apellido) *
                          </label>
                          <input
                            type="text"
                            required
                            value={roleForm.holder_name}
                            onChange={(e) => setRoleForm({ ...roleForm, holder_name: e.target.value })}
                            placeholder="ej. Hugo Obregozo / María José"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-400 font-bold font-mono"
                          />
                        </div>

                        {/* Departamento con Lista Desplegable Estandarizada */}
                        <div>
                          <label className="text-[11px] font-bold text-slate-300 block mb-1">
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
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-400 font-bold"
                          >
                            {STANDARD_DEPARTMENTS.map((dept) => (
                              <option key={dept} value={dept}>{dept}</option>
                            ))}
                            <option value="__OTRO__">➕ Otro Departamento (Personalizado)...</option>
                          </select>

                          {(!STANDARD_DEPARTMENTS.includes(roleForm.department) || roleForm.department === '') && (
                            <input
                              type="text"
                              required
                              value={roleForm.department}
                              onChange={(e) => setRoleForm({ ...roleForm, department: e.target.value })}
                              placeholder="Escribí el departamento..."
                              className="mt-1.5 w-full bg-slate-900 border border-sky-600 rounded-xl px-2.5 py-1.5 text-xs text-sky-200 focus:outline-none focus:border-sky-400 animate-in fade-in"
                            />
                          )}
                        </div>

                        {/* Reporta a */}
                        <div>
                          <label className="text-[11px] font-bold text-slate-300 block mb-1">
                            Reporta Jerárquicamente a
                          </label>
                          <select
                            value={roleForm.reports_to || 'Dirección General & Administración Central'}
                            onChange={(e) => setRoleForm({ ...roleForm, reports_to: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-400 font-bold"
                          >
                            {REPORTING_LINES.map((rep) => (
                              <option key={rep} value={rep}>{rep}</option>
                            ))}
                          </select>
                        </div>

                        {/* Nivel de Seguridad */}
                        <div className="sm:col-span-2">
                          <label className="text-[11px] font-bold text-slate-300 block mb-1">
                            Nivel de Seguridad y Permisos
                          </label>
                          <select
                            value={roleForm.security_level}
                            onChange={(e) => setRoleForm({ ...roleForm, security_level: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-400 font-bold"
                          >
                            <option value="ADMINISTRADOR">👑 Administrador (Acceso Maestro)</option>
                            <option value="DIRECCION">👔 Dirección / Gerencia</option>
                            <option value="SUPERVISOR">🛡️ Supervisor / Jefe de Área</option>
                            <option value="OPERATIVO">📋 Operativo / Carga</option>
                            <option value="AUDITOR">👁️ Auditor (Solo Lectura)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* BLOQUE 2: MISIÓN Y RESPONSABILIDADES (.alon-chunk-indigo) */}
                    <div className="alon-chunk-indigo space-y-2.5">
                      <div className="flex items-center justify-between pb-1 border-b border-indigo-500/20">
                        <span className="font-black text-[11px] uppercase tracking-wider text-indigo-400">
                          2. Misión y Responsabilidades Clave
                        </span>
                        <span className="text-[10px] text-indigo-300/70 font-mono">Perfil Funcional</span>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-300 block mb-1">
                          Misión Principal del Puesto (Propósito Fundamental)
                        </label>
                        <textarea
                          rows={2}
                          value={roleForm.job_mission}
                          onChange={(e) => setRoleForm({ ...roleForm, job_mission: e.target.value })}
                          placeholder="ej. Conducir las operaciones y producción en astillero, acordar tarifas quincenales y coordinar la ejecución técnica de obras navales."
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-400 leading-relaxed"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-300 block mb-1">
                          Responsabilidades y Tareas Clave (una por línea)
                        </label>
                        <textarea
                          rows={3}
                          value={roleForm.key_responsibilities}
                          onChange={(e) => setRoleForm({ ...roleForm, key_responsibilities: e.target.value })}
                          placeholder="Escribí una tarea o responsabilidad por línea:&#10;• Negociación de valores hora con contratistas&#10;• Fijación de la paritaria testigo del astillero&#10;• Autorización de órdenes de trabajo"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-400 font-mono leading-relaxed"
                        />
                      </div>
                    </div>
                  </div>

                  {/* COLUMNA DERECHA: BLOQUES 3 Y 4 */}
                  <div className="space-y-3">
                    {/* BLOQUE 3: PRESETS RÁPIDOS (.alon-chunk-amber) */}
                    <div className="alon-chunk-amber space-y-2">
                      <div className="flex items-center justify-between pb-1 border-b border-amber-500/20">
                        <span className="font-black text-[11px] uppercase tracking-wider text-amber-400">
                          3. Plantillas Rápidas de Permisos (1 Clic)
                        </span>
                        <span className="text-[10px] text-amber-300/70 font-mono">Autoconfiguración</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {ROLE_PRESETS.map(preset => (
                          <button
                            key={preset.name}
                            type="button"
                            tabIndex={-1}
                            onClick={() => setRoleForm({
                              ...roleForm,
                              security_level: preset.security_level,
                              allowed_sections: preset.sections
                            })}
                            className="p-2 bg-slate-900/60 hover:bg-amber-950/30 border border-slate-700 hover:border-amber-500/50 rounded-xl text-left transition-all cursor-pointer"
                          >
                            <strong className="text-xs text-white block truncate">{preset.name}</strong>
                            <span className="text-[10px] text-slate-400 block leading-tight mt-0.5 line-clamp-2">{preset.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* BLOQUE 4: MATRIZ DE MÓDULOS HABILITADOS (.alon-chunk-purple) */}
                    <div className="alon-chunk-purple space-y-2">
                      <div className="flex items-center justify-between pb-1 border-b border-purple-500/20">
                        <span className="font-black text-[11px] uppercase tracking-wider text-purple-400">
                          4. Módulos de la App Habilitados
                        </span>
                        <span className="text-[10px] text-purple-300/70 font-mono">{roleForm.allowed_sections.length} seleccionados</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                        {SYSTEM_MODULES.map(mod => {
                          const isChecked = roleForm.allowed_sections.includes(mod.key)
                          const Icon = mod.icon
                          return (
                            <label 
                              key={mod.key} 
                              className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                                isChecked 
                                  ? 'bg-purple-950/40 border-purple-500 text-white font-bold shadow-sm' 
                                  : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
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
                                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-primary cursor-pointer accent-primary shrink-0"
                              />
                              <Icon className={`w-3.5 h-3.5 ${mod.color} shrink-0`} />
                              <span className="truncate">{mod.label}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="alon-modal-footer">
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingRole}
                  className="px-5 py-1.5 bg-primary hover:brightness-110 text-slate-950 font-black rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-md"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingRole ? 'Guardando...' : 'Guardar Puesto'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
