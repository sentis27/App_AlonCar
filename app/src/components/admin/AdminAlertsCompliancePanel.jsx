import { useState, useEffect } from 'react'
import {
  ShieldAlert,
  Package,
  Clock,
  AlertCircle
} from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import MariaJoseBudgetAlertsCard from '../workOrders/MariaJoseBudgetAlertsCard.jsx'
import MariaJoseContractAlertsCard from '../personal/MariaJoseContractAlertsCard.jsx'

export default function AdminAlertsCompliancePanel({ onSummaryChange }) {
  const { profile, user } = useAuth()

  const [alertSummary, setAlertSummary] = useState({
    redContractorsCount: 2,
    panolWithoutHoursCount: 0,
    auditedHoursCount: 4,
    pendingRubroCount: 0,
    complianceAlertsCount: 0
  })
  const [pendingRubroMaterials, setPendingRubroMaterials] = useState([])
  const [complianceAlerts, setComplianceAlerts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAlertData()
  }, [])

  async function loadAlertData() {
    try {
      setLoading(true)
      const [pendingMatsRes, complianceRes] = await Promise.all([
        supabase.from('materials').select('*').eq('rubro_status', 'PENDIENTE_HOMOLOGACION').order('created_at', { ascending: false }),
        supabase.from('compliance_alerts').select('*, ships(name), workers(name)').eq('status', 'PENDIENTE').order('created_at', { ascending: false })
      ])

      const pendingMats = pendingMatsRes.data || []
      const compAlerts = complianceRes.data || []

      setPendingRubroMaterials(pendingMats)
      setComplianceAlerts(compAlerts)

      const summary = {
        redContractorsCount: 2,
        panolWithoutHoursCount: compAlerts.filter((a) => a.entity_type === 'inventory_transactions').length,
        auditedHoursCount: 4,
        pendingRubroCount: pendingMats.length,
        complianceAlertsCount: compAlerts.length
      }

      setAlertSummary(summary)
      onSummaryChange?.({ summary, alertsCount: compAlerts.length, pendingRubroCount: pendingMats.length })
    } catch (err) {
      console.error('Error cargando alertas operativas:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleResolveComplianceAlert(alertItem, resolutionNotes = 'Resuelto por Administrador') {
    try {
      const userIdentifier = profile?.full_name || user?.email || 'Jorge Sentis'
      const { error } = await supabase
        .from('compliance_alerts')
        .update({
          status: 'COMPLETADO',
          completed_at: new Date().toISOString(),
          completed_by: userIdentifier,
          notes: alertItem.notes ? `${alertItem.notes} - [${resolutionNotes}]` : resolutionNotes
        })
        .eq('id', alertItem.id)

      if (error) throw error

      setComplianceAlerts((prev) => {
        const next = prev.filter((a) => a.id !== alertItem.id)
        setAlertSummary((prevSum) => {
          const updatedSum = {
            ...prevSum,
            complianceAlertsCount: next.length,
            panolWithoutHoursCount: next.filter((a) => a.entity_type === 'inventory_transactions').length
          }
          onSummaryChange?.({ summary: updatedSum, alertsCount: next.length, pendingRubroCount: pendingRubroMaterials.length })
          return updatedSum
        })
        return next
      })
    } catch (err) {
      alert('Error al resolver la alerta: ' + err.message)
    }
  }

  async function handleApproveWorkerPermission(alertItem) {
    try {
      if (alertItem.entity_id) {
        const { error: workerErr } = await supabase
          .from('workers')
          .update({ can_withdraw_materials: true })
          .eq('id', alertItem.entity_id)
        if (workerErr) throw workerErr
      }
      await handleResolveComplianceAlert(alertItem, 'Permiso de retiro en Pañol habilitado')
    } catch (err) {
      alert('Error habilitando permiso de operario: ' + err.message)
    }
  }

  async function handleApproveMaterialRubro(materialId, finalRubro) {
    if (!finalRubro || !finalRubro.trim()) return alert('Debe indicar el rubro definitivo.')
    try {
      const { error } = await supabase
        .from('materials')
        .update({
          rubro: finalRubro.trim().toUpperCase(),
          rubro_status: 'APROBADO'
        })
        .eq('id', materialId)
      if (error) throw error

      setPendingRubroMaterials((prev) => {
        const next = prev.filter((m) => m.id !== materialId)
        setAlertSummary((prevSum) => {
          const updatedSum = { ...prevSum, pendingRubroCount: next.length }
          onSummaryChange?.({ summary: updatedSum, alertsCount: complianceAlerts.length, pendingRubroCount: next.length })
          return updatedSum
        })
        return next
      })
    } catch (err) {
      alert('Error homologando rubro: ' + err.message)
    }
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* 4 TARJETAS DEL RADAR DE ALERTAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

        <div className="bg-slate-900/90 border border-purple-900/50 rounded-2xl p-5 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-purple-400 font-bold uppercase">
            <span>Nuevos Rubros de Materiales</span>
            <Package className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-3xl font-black text-purple-400 font-mono">
            {pendingRubroMaterials.length}
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Materiales dados de alta en Compras con solicitud de apertura de nuevo rubro para Pañol.
          </p>
        </div>
      </div>

      {/* BANDEJA DEDICADA: PRESUPUESTOS ADICIONALES PENDIENTES (MARÍA JOSÉ) */}
      <MariaJoseBudgetAlertsCard
        alerts={complianceAlerts.filter((a) => a.entity_type === 'work_items')}
        user={user}
        userName={profile?.full_name || user?.email || 'María José'}
        onResolved={() => loadAlertData()}
      />

      {/* BANDEJA DEDICADA: CONTRATOS ASTILLERO POR VENCER <= 7D & REGLA EPP (MARÍA JOSÉ) */}
      <MariaJoseContractAlertsCard
        alerts={complianceAlerts.filter((a) => a.entity_type === 'workers' && a.responsible_role === 'maria_jose')}
        user={user}
        userName={profile?.full_name || user?.email || 'María José'}
        onResolved={() => loadAlertData()}
      />

      {/* BANDEJA DE RESOLUCIÓN: ALERTAS OPERATIVAS & SOLICITUDES DE APERTURA DE OT / PERMISOS */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Bandeja de Cumplimiento: Solicitudes de Apertura de OT y Habilitaciones (Compliance Alerts)
            </h3>
            <p className="text-xs text-slate-400">
              Solicitudes enviadas en tiempo real desde Pañol Central y Horas por contratistas no asignados, pedidos de habilitación de operarios y retiros bajo (⚠️ Sin OT).
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-amber-950 border border-amber-800 text-amber-300 text-xs font-bold">
            {complianceAlerts.length} pendiente(s)
          </span>
        </div>

        {complianceAlerts.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
            ✓ No hay solicitudes operativas pendientes de resolución en la base de datos.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="alon-grid-thead">
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3">Tipo de Requerimiento</th>
                  <th className="py-2.5 px-3">Buque / Obra</th>
                  <th className="py-2.5 px-3">Detalle / Motivo</th>
                  <th className="py-2.5 px-3">Origen / Notas</th>
                  <th className="py-2.5 px-3 text-center">Acción Administrador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {complianceAlerts.map((alert) => {
                  const isOtReq = alert.entity_type === 'work_orders'
                  const isWorkerReq = alert.entity_type === 'workers'
                  const isSinOtAudit = alert.entity_type === 'inventory_transactions'
                  const isBudgetPendingReq = alert.entity_type === 'work_items'

                  return (
                    <tr key={alert.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {alert.created_at ? new Date(alert.created_at).toLocaleDateString('es-AR') : '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        {isOtReq && (
                          <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 font-bold text-[10px]">
                            ➕ Apertura de OT
                          </span>
                        )}
                        {isWorkerReq && (
                          <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold text-[10px]">
                            👤 Permiso Pañol (P)
                          </span>
                        )}
                        {isSinOtAudit && (
                          <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold text-[10px]">
                            ⚠️ Retiro sin OT
                          </span>
                        )}
                        {isBudgetPendingReq && (
                          <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-600 font-bold text-[10px]">
                            🧾 Nº Presupuesto (María José)
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-white">
                        {alert.ships?.name || 'Astillero General'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-200">
                        {alert.alert_message}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px] font-mono">
                        {alert.notes || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {isWorkerReq ? (
                          <button
                            type="button"
                            onClick={() => handleApproveWorkerPermission(alert)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs cursor-pointer shadow transition-colors"
                          >
                            ✓ Habilitar Permiso (P) y Resolver
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleResolveComplianceAlert(alert, isOtReq ? 'OT Creada / Asignada' : 'Auditado por Administrador')}
                            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg text-xs cursor-pointer shadow transition-colors"
                          >
                            ✓ Marcar Resuelto
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* BANDEJA DE RESOLUCIÓN: SOLICITUDES DE NUEVO RUBRO DE MATERIALES */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-purple-400" />
              Solicitudes de Apertura / Ajuste de Rubro en Catálogo de Materiales
            </h3>
            <p className="text-xs text-slate-400">
              Cuando Compras da de alta un material cuyo rubro no existe, queda registrado aquí para que el Administrador valide o ajuste el nombre del rubro definitivo.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-purple-950 border border-purple-800 text-purple-300 text-xs font-bold">
            {pendingRubroMaterials.length} pendiente(s)
          </span>
        </div>

        {pendingRubroMaterials.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
            No hay solicitudes pendientes de apertura de rubro en el catálogo maestro de materiales.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="alon-grid-thead">
                  <th className="py-2.5 px-3">Material Creado</th>
                  <th className="py-2.5 px-3">Categoría</th>
                  <th className="py-2.5 px-3">Unidad / % Seg.</th>
                  <th className="py-2.5 px-3">Rubro Propuesto (Editable)</th>
                  <th className="py-2.5 px-3 text-center">Acción Administrador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {pendingRubroMaterials.map((mat) => (
                  <tr key={mat.id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-bold text-white">{mat.name}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-semibold text-[10px]">
                        {mat.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 font-mono">
                      {mat.unit_measure} • {Math.round(((Number(mat.security_factor) || 1.06) - 1) * 100)}%
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        defaultValue={mat.suggested_rubro || ''}
                        id={`rubro-input-${mat.id}`}
                        className="bg-slate-950 border border-purple-500/50 rounded-lg px-2.5 py-1 text-xs text-purple-200 font-bold uppercase focus:outline-none focus:border-purple-400"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          const inputEl = document.getElementById(`rubro-input-${mat.id}`)
                          const val = inputEl ? inputEl.value : mat.suggested_rubro
                          handleApproveMaterialRubro(mat.id, val)
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs cursor-pointer transition-colors"
                      >
                        ✓ Aprobar y Asignar Rubro
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
