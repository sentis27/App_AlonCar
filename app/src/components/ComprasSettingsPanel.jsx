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
  RefreshCw
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

  useEffect(() => {
    fetchSettings()
  }, [])

  async function fetchSettings() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('key', 'compras_whatsapp')
        .maybeSingle()

      if (error) throw error
      if (data?.value) {
        setSettings(prev => ({
          ...prev,
          ...data.value
        }))
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
      const payload = {
        key: 'compras_whatsapp',
        value: settings,
        updated_at: new Date().toISOString(),
        updated_by: 'Administrador'
      }

      const { error } = await supabase
        .from('system_settings')
        .upsert(payload, { onConflict: 'key' })

      if (error) throw error
      showFeedback('success', 'Configuración de Compradores y WhatsApp guardada correctamente.')
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
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 shadow-lg shadow-cyan-500/20">
              <MessageSquare className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Configuración de Compras & Números de Pedido (WhatsApp)
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400 uppercase font-bold">
                  M4b
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Define los 2 números de compradores oficiales para emitir pedidos directos a proveedores por WhatsApp Web.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              WhatsApp Web Activo
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
              • <strong>Número de Evolution API (Automático):</strong> Es una instancia de servidor independiente conectada en la nube para el envío desatendido de recordatorios nocturnos y alertas de cumplimiento normativo del astillero.
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
          <form onSubmit={handleSave} className="space-y-5 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* COMPRADOR 1 */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-cyan-400" />
                    <h3 className="font-bold text-white text-xs">Comprador 1 (Principal)</h3>
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
                    <span className="text-[10px] text-slate-500">Formato recomendado: +549[Área][Número]</span>
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
                    <h3 className="font-bold text-white text-xs">Comprador 2 (Secundario / Pañol)</h3>
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
                    <span className="text-[10px] text-slate-500">Formato recomendado: +549[Área][Número]</span>
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
              <h3 className="font-bold text-white text-xs flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                Mensaje de Pedido Predeterminado
              </h3>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Saludo y Encabezado del Mensaje</label>
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
                  <span>Normalizar automáticamente números de proveedores argentinos (quitar 0 y 15, agregar +54 9)</span>
                </label>
              </div>
            </div>

            {/* BOTÓN GUARDAR */}
            <div className="flex items-center justify-end gap-3 pt-2">
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
                    <span>Guardar Configuración de Compras</span>
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
