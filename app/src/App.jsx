import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import LaborLogs from './pages/LaborLogs'
import ModulePlaceholder from './pages/ModulePlaceholder'
import { Loader2 } from 'lucide-react'

// Guardián de rutas protegidas
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

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
            <Route path="ots" element={<ModulePlaceholder />} />
            <Route path="barcos" element={<ModulePlaceholder />} />
            <Route path="horas" element={<LaborLogs />} />
            <Route path="panol" element={<ModulePlaceholder />} />
            <Route path="compras" element={<ModulePlaceholder />} />
            <Route path="personal" element={<ModulePlaceholder />} />
            <Route path="comparador" element={<ModulePlaceholder />} />
          </Route>

          {/* Redirección por defecto */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
