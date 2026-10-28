import { useState, useEffect } from 'react'
import {
  ShoppingCart,
  MessageSquare,
  Phone,
  User,
  Save,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  RefreshCw,
  FileText,
  Bell,
  Mail,
  UserCheck
} from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function ComprasSettingsPanel() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const [settings, setSettings] = useState({
    buyer_1: {
      name: 'Jorge Sentis',
      phone: '+5492235000001',
      role: 'Administración / Compras',
      is_active: true
    },
    buyer_2: {
      name: 'Andrés',
      phone: '+5492235000002',
      role: 'Pañol / Compras',
      is_active: true
    },
    message_greeting: 'Estimados,\nDesde Alon Car S.A. les enviamos el siguiente pedido de compra:',
    auto_format_phone: true
  })

  const [seCompraAlerts, setSeCompraAlerts] = useState({
    hugo: {
      name: 'Hugo Sentis',
      role: 'Gerente General',
      phone: '+5492235000001',
      email: 'hugo@aloncar.com',
      enabled: true
    },
    martin: {
      name: 'Martín Sentis',
      role: 'Gerente de Operaciones',
      phone: '+5492235000002',
      email: 'martin@aloncar.com',
      enabled: true
    },
    foreman: {
      name: 'Jefe de Obra de la OT',
      role: 'Jefe de Obra Asignado',
      auto_from_ot: true,
      enabled: true
    },
    auto_notify: true
  })

  useEffect(() => {
    fetchSettings()
  }, [])

  async function fetchSettings() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .in('key', ['compras_whatsapp', 'se_compra_alertas'])

      if (error) throw error
      if (data) {
        const whats = data.find((d) => d.key === 'compras_whatsapp')
        if (whats?.value) {
          setSettings((prev) => ({ ...prev, ...whats.value }))
        }
        const alerts = data.find((d) => d.key === 'se_compra_alertas')
        if (alerts?.value) {
          setSeCompraAlerts((prev) => ({ ...prev, ...alerts.value }))
        }
      }
    } catch (err) {
      console.error('Error cargando configuración de compras:', err)
      showFeedback('error', 'Error al leer configuración: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  function showFeedback(type, text) {
    setFeedback({ type, text })
    setTimeout(() => setFeedback(null), 4000)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payloadWhats = {
        key: 'compras_whatsapp',
        value: settings,
        updated_at: new Date().toISOString(),
        updated_by: 'Administrador'
      }

      const payloadAlerts = {
        key: 'se_compra_alertas',
        value: seCompraAlerts,
        updated_at: new Date().toISOString(),
        updated_by: 'Administrador'
      }

      const { error: err1 } = await supabase
        .from('system_settings')
        .upsert(payloadWhats, { onConflict: 'key' })
      if (err1) throw err1

      const { error: err2 } = await supabase
        .from('system_settings')
        .upsert(payloadAlerts, { onConflict: 'key' })
      if (err2) throw err2

      showFeedback('success', 'Configuración de Compras y Alertas guardada correctamente.')
    } catch (err) {
      console.error('Error guardando configuración:', err)
      showFeedback('error', 'Error al guardar configuración: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* CABECERA */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 shadow-lg shadow-cyan-500/20">
              <MessageSquare className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Configuración de Compras, WhatsApp & Alertas
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400 uppercase font-bold">
                  M4b
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Define los 2 números de compradores oficiales para pedidos a proveedores y los destinatarios de la alerta "SE COMPRA?".
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              WhatsApp Web & Alertas Activas
            </span>
          </div>
        </div>

        {/* ALERTA INFORMATIVA DIFERENCIADORA */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 flex items-start gap-3">
          <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-white">Distinción de Circuitos de Comunicación:</p>
            <p className="text-slate-400 text-[11px]">
              • <strong>Estos 2 Números de Compradores:</strong> Se utilizan para la operativa diaria humana al presionar <em>"🛒 Pedir Agrupado"</em> en Compras, abriendo WhatsApp Web desde el navegador del usuario para chatear directamente con el proveedor.
            </p>
            <p className="text-slate-400 text-[11px]">
              • <strong>Número de Evolution API (Automático):</strong> Es una instancia de servidor independiente conectada en la nube para el envío desatendido de recordatorios nocturnos y alertas normativas del astillero.
            </p>
          </div>
        </div>

        {/* MENSAJE DE FEEDBACK */}
        {feedback && (
          <div
            className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between ${
              feedback.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{feedback.text}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">✕</button>
          </div>
        )}

        {/* FORMULARIO */}
        {loading ? (
          <div className="text-center py-12 text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
            Cargando configuración...
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6 pt-2">
            {/* SECCIÓN 1: COMPRADORES WHATSAPP */}
            <div className="space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                1. Compradores Oficiales para Pedidos WhatsApp
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* COMPRADOR 1 */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-cyan-400" />
                      <h4 className="font-bold text-white text-xs">Comprador 1 (Principal)</h4>
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.buyer_1.is_active}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            buyer_1: { ...settings.buyer_1, is_active: e.target.checked }
                          })
                        }
                        className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500"
                      />
                      <span>Habilitado</span>
                    </label>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Nombre y Apellido</label>
                      <input
                        type="text"
                        value={settings.buyer_1.name}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            buyer_1: { ...settings.buyer_1, name: e.target.value }
                          })
                        }
                        placeholder="Ej: Jorge Sentis"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500 font-medium"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Teléfono / WhatsApp Móvil</label>
                      <input
                        type="text"
                        value={settings.buyer_1.phone}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            buyer_1: { ...settings.buyer_1, phone: e.target.value }
                          })
                        }
                        placeholder="Ej: +5492234810922"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono focus:outline-none focus:border-cyan-500"
                        required
                      />
                      <span className="text-[10px] text-slate-500">Formato: +549[Área][Número]</span>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Rol o Sector</label>
                      <input
                        type="text"
                        value={settings.buyer_1.role}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            buyer_1: { ...settings.buyer_1, role: e.target.value }
                          })
                        }
                        placeholder="Ej: Administración / Compras"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-300 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                </div>

                {/* COMPRADOR 2 */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-400" />
                      <h4 className="font-bold text-white text-xs">Comprador 2 (Secundario / Pañol)</h4>
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.buyer_2.is_active}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            buyer_2: { ...settings.buyer_2, is_active: e.target.checked }
                          })
                        }
                        className="rounded border-slate-700 text-blue-500 focus:ring-blue-500"
                      />
                      <span>Habilitado</span>
                    </label>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Nombre y Apellido</label>
                      <input
                        type="text"
                        value={settings.buyer_2.name}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            buyer_2: { ...settings.buyer_2, name: e.target.value }
                          })
                        }
                        placeholder="Ej: Andrés"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500 font-medium"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Teléfono / WhatsApp Móvil</label>
                      <input
                        type="text"
                        value={settings.buyer_2.phone}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            buyer_2: { ...settings.buyer_2, phone: e.target.value }
                          })
                        }
                        placeholder="Ej: +5492235550202"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono focus:outline-none focus:border-cyan-500"
                        required
                      />
                      <span className="text-[10px] text-slate-500">Formato: +549[Área][Número]</span>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Rol o Sector</label>
                      <input
                        type="text"
                        value={settings.buyer_2.role}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            buyer_2: { ...settings.buyer_2, role: e.target.value }
                          })
                        }
                        placeholder="Ej: Pañol Central"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-300 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* PLANTILLA DE MENSAJE & FORMATEO */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
                <h4 className="font-bold text-white text-xs flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  Mensaje de Pedido Predeterminado
                </h4>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Saludo y Encabezado del Pedido</label>
                  <textarea
                    rows="2"
                    value={settings.message_greeting}
                    onChange={(e) => setSettings({ ...settings, message_greeting: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500 font-sans"
                  />
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-slate-300 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.auto_format_phone}
                      onChange={(e) => setSettings({ ...settings, auto_format_phone: e.target.checked })}
                      className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500"
                    />
                    <span>Normalizar automáticamente números de proveedores argentinos (+54 9)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: ALERTA "SE COMPRA?" (DESTINATARIOS GERENCIALES) */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-pink-400 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-pink-400" />
                    2. Destinatarios de Alerta "SE COMPRA?" (Decisión Gerencial)
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Personas a las que el sistema notificará cuando una compra se marque en duda técnica/financiera con el estado "SE COMPRA?".
                  </p>
                </div>
                <label className="flex items-center gap-1.5 text-xs text-pink-300 font-bold bg-pink-950/60 border border-pink-500/40 px-3 py-1 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={seCompraAlerts.auto_notify}
                    onChange={(e) => setSeCompraAlerts({ ...seCompraAlerts, auto_notify: e.target.checked })}
                    className="rounded border-slate-700 text-pink-500 focus:ring-pink-500"
                  />
                  <span>Disparar Alertas Automáticas</span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* HUGO - GERENTE GENERAL */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-pink-400" />
                      <h4 className="font-bold text-white text-xs">Hugo (Gerente General)</h4>
                    </div>
                    <input
                      type="checkbox"
                      checked={seCompraAlerts.hugo.enabled}
                      onChange={(e) =>
                        setSeCompraAlerts({
                          ...seCompraAlerts,
                          hugo: { ...seCompraAlerts.hugo, enabled: e.target.checked }
                        })
                      }
                      className="rounded border-slate-700 text-pink-500 focus:ring-pink-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Nombre</label>
                    <input
                      type="text"
                      value={seCompraAlerts.hugo.name}
                      onChange={(e) =>
                        setSeCompraAlerts({
                          ...seCompraAlerts,
                          hugo: { ...seCompraAlerts.hugo, name: e.target.value }
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">WhatsApp / Móvil</label>
                    <input
                      type="text"
                      value={seCompraAlerts.hugo.phone}
                      onChange={(e) =>
                        setSeCompraAlerts({
                          ...seCompraAlerts,
                          hugo: { ...seCompraAlerts.hugo, phone: e.target.value }
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Email</label>
                    <input
                      type="email"
                      value={seCompraAlerts.hugo.email}
                      onChange={(e) =>
                        setSeCompraAlerts({
                          ...seCompraAlerts,
                          hugo: { ...seCompraAlerts.hugo, email: e.target.value }
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                    />
                  </div>
                </div>

                {/* MARTÍN - GERENTE DE OPERACIONES */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-pink-400" />
                      <h4 className="font-bold text-white text-xs">Martín (Gerente Operaciones)</h4>
                    </div>
                    <input
                      type="checkbox"
                      checked={seCompraAlerts.martin.enabled}
                      onChange={(e) =>
                        setSeCompraAlerts({
                          ...seCompraAlerts,
                          martin: { ...seCompraAlerts.martin, enabled: e.target.checked }
                        })
                      }
                      className="rounded border-slate-700 text-pink-500 focus:ring-pink-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Nombre</label>
                    <input
                      type="text"
                      value={seCompraAlerts.martin.name}
                      onChange={(e) =>
                        setSeCompraAlerts({
                          ...seCompraAlerts,
                          martin: { ...seCompraAlerts.martin, name: e.target.value }
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">WhatsApp / Móvil</label>
                    <input
                      type="text"
                      value={seCompraAlerts.martin.phone}
                      onChange={(e) =>
                        setSeCompraAlerts({
                          ...seCompraAlerts,
                          martin: { ...seCompraAlerts.martin, phone: e.target.value }
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Email</label>
                    <input
                      type="email"
                      value={seCompraAlerts.martin.email}
                      onChange={(e) =>
                        setSeCompraAlerts({
                          ...seCompraAlerts,
                          martin: { ...seCompraAlerts.martin, email: e.target.value }
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                    />
                  </div>
                </div>

                {/* JEFE DE OBRA DINÁMICO */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-cyan-400" />
                      <h4 className="font-bold text-white text-xs">Jefe de Obra (Dinámico)</h4>
                    </div>
                    <input
                      type="checkbox"
                      checked={seCompraAlerts.foreman.enabled}
                      onChange={(e) =>
                        setSeCompraAlerts({
                          ...seCompraAlerts,
                          foreman: { ...seCompraAlerts.foreman, enabled: e.target.checked }
                        })
                      }
                      className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500"
                    />
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-[11px] text-slate-400 space-y-1">
                    <p className="font-semibold text-slate-300">Detección Automática:</p>
                    <p>
                      El sistema identifica automáticamente al Jefe de Obra asignado al buque y OT seleccionados en la orden de compra y le dirige la consulta para validación técnica.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* BOTÓN GUARDAR */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold rounded-xl text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Guardando cambios...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 stroke-[2.5]" />
                    <span>Guardar Configuración de Compras & Alertas</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
