import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Anchor, Lock, Mail, AlertCircle, ArrowRight, Loader2, Sparkles, UserCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { organizationRolesRepository } from '../repositories/organizationRolesRepository'
import { getFirstAllowedRoute } from '../lib/permissionsEngine'

export default function Login() {
  const [email, setEmail] = useState('app.aloncar2712@gmail.com')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeRoles, setActiveRoles] = useState([])
  const [selectedRoleKey, setSelectedRoleKey] = useState('')
  const { signIn, signInAsRole } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    organizationRolesRepository
      .listRoles({ orderBy: [{ column: 'holder_name', ascending: true }] })
      .then(({ data }) => {
        if (!mounted || !Array.isArray(data)) return
        const activos = data.filter((r) => (r.status || 'ACTIVO') === 'ACTIVO')
        setActiveRoles(activos)
        if (activos.length > 0) setSelectedRoleKey(activos[0].role_key)
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error } = await signIn(email, password)
      if (error) {
        setError(error.message || 'Error al iniciar sesión. Verifique sus credenciales.')
      } else {
        navigate('/')
      }
    } catch {
      setError('Ocurrió un error inesperado al conectar con el servidor.')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickLogin = async () => {
    setError('')
    setLoading(true)
    try {
      await signIn('app.aloncar2712@gmail.com', 'admin')
      navigate('/')
    } catch {
      setError('Error en acceso rápido.')
    } finally {
      setLoading(false)
    }
  }

  const handleRoleLogin = async () => {
    const target = activeRoles.find((r) => r.role_key === selectedRoleKey)
    if (!target) return
    setError('')
    setLoading(true)
    try {
      const res = await signInAsRole(target)
      if (res?.error) setError(res.error.message)
      else navigate(getFirstAllowedRoute({ orgRole: target }) || '/')
    } catch {
      setError('No se pudo ingresar con el puesto seleccionado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden bg-slate-950">
      {/* Luces de fondo decorativas */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800/90 rounded-2xl p-8 backdrop-blur-2xl shadow-2xl relative z-10">
        {/* Cabecera / Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-blue-600 items-center justify-center shadow-[0_0_25px_rgba(0,242,254,0.4)] mb-4">
            <Anchor className="w-8 h-8 text-slate-950 stroke-[2.5]" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">ALON CAR S.A.</h1>
          <p className="text-xs uppercase tracking-widest text-primary font-semibold mt-1">
            Sistema de Gestión de Obra & ERP
          </p>
        </div>

        {/* Mensaje de Error */}
        {error && (
          <div className="mb-6 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operaciones@aloncar.com"
                className="w-full bg-slate-950/60 border border-slate-700/80 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950/60 border border-slate-700/80 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-gradient-to-r from-primary to-blue-500 text-slate-950 font-bold rounded-lg shadow-[0_0_20px_rgba(0,242,254,0.3)] hover:shadow-[0_0_30px_rgba(0,242,254,0.5)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Ingresando...</span>
              </>
            ) : (
              <>
                <span>Ingresar al Sistema</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Botón de Acceso Rápido / Selector de Puesto Activo (Etapa 5) */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2.5">
          <button
            type="button"
            onClick={handleQuickLogin}
            disabled={loading}
            className="w-full py-2.5 px-3 bg-cyan-950/50 hover:bg-cyan-900/60 text-cyan-300 text-xs font-semibold rounded-lg border border-cyan-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(0,242,254,0.1)] hover:shadow-[0_0_20px_rgba(0,242,254,0.25)]"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Ingreso Directo como Andrés Vanoli (Admin)</span>
          </button>

          {activeRoles.length > 0 && (
            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
              <label
                htmlFor="login-role-selector"
                className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400"
              >
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ingresar como puesto (permisos reales)</span>
              </label>
              <div className="flex items-center gap-2">
                <select
                  id="login-role-selector"
                  value={selectedRoleKey}
                  onChange={(e) => setSelectedRoleKey(e.target.value)}
                  className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-semibold focus:outline-none focus:border-emerald-400"
                >
                  {activeRoles.map((r) => (
                    <option key={r.role_key} value={r.role_key}>
                      {r.holder_name || r.role_key} — {r.role_title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleRoleLogin}
                  disabled={loading || !selectedRoleKey}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 text-xs font-bold cursor-pointer transition-colors shrink-0 disabled:opacity-50"
                >
                  Entrar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Pie de autenticación */}
        <div className="mt-4 text-center">
          <p className="text-[11px] text-slate-400">
            Acceso restringido para personal autorizado de Alon Car S.A.
          </p>
        </div>
      </div>
    </div>
  )
}
