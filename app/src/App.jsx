import { BrowserRouter, Routes, Route, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { isRouteAllowed } from './lib/permissionsEngine'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import LaborLogs from './pages/LaborLogs'
import Personal from './pages/Personal'
import WorkOrders from './pages/WorkOrders'
import Ships from './pages/Ships'
import AdminDashboard from './pages/AdminDashboard'
import Terceros from './pages/Terceros'
import Compras from './pages/Compras'
import Panol from './pages/Panol'
import Tesoreria from './pages/Tesoreria'
import ResumenGerencial from './pages/ResumenGerencial'
import { Loader2 } from 'lucide-react'

// Guardián de rutas protegidas y control de permisos por puesto (Etapa 5 / FL-022)
function ProtectedRoute({ children }) {
  const { user, profile, orgRole, allowedSections, loading, signOut } = useAuth()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
        <p className="text-xs uppercase tracking-widest font-semibold">Cargando Alon Car ERP...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const { allowed, redirectTo } = isRouteAllowed(location.pathname, searchParams.get('tab'), {
    profile,
    orgRole,
    allowedSections,
  })

  if (!allowed) {
    const currentFull = `${location.pathname}${location.search}`
    if (redirectTo && redirectTo !== currentFull) {
      return <Navigate to={redirectTo} replace />
    }
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-slate-300 p-6 text-center space-y-3">
        <p className="text-base font-bold text-white">Sin módulos habilitados para este puesto</p>
        <p className="text-xs text-slate-400 max-w-md">
          El puesto <strong className="text-cyan-300">{orgRole?.role_title || profile?.full_name || user?.email}</strong> no tiene secciones activas en la Matriz de Puestos. Solicitá acceso al Administrador.
        </p>
        <button
          type="button"
          onClick={signOut}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white border border-slate-700 cursor-pointer"
        >
          Cambiar de usuario / Cerrar sesión
        </button>
      </div>
    )
  }

  return children
}

// Redirección si ya está autenticado
function PublicRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return null

  if (user) {
    return <Navigate to="/" replace />
  }

  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Ruta Pública: Login */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />

          {/* Rutas Privadas dentro del Layout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="ots" element={<WorkOrders />} />
            <Route path="barcos" element={<Ships />} />
            <Route path="terceros" element={<Terceros />} />
            <Route path="horas" element={<LaborLogs />} />
            <Route path="panol" element={<Panol />} />
            <Route path="compras" element={<Compras />} />
            <Route path="personal" element={<Personal />} />
            <Route path="tesoreria" element={<Tesoreria />} />
            <Route path="resumen-gerencial" element={<ResumenGerencial />} />
            <Route path="comparador" element={<Navigate to="/resumen-gerencial?tab=comparador" replace />} />
            <Route path="admin" element={<AdminDashboard />} />
          </Route>

          {/* Redirección por defecto */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
