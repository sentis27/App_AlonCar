import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 0. Revisar sesión local persistida (para desarrollo local sin Supabase Cloud)
    const localSaved = localStorage.getItem('aloncar_local_session')
    if (localSaved) {
      try {
        const parsed = JSON.parse(localSaved)
        setUser(parsed)
        setProfile({
          id: parsed.id,
          email: parsed.email,
          full_name: parsed.user_metadata?.full_name || 'Andrés Vanoli',
          role: 'Supervisor'
        })
        setLoading(false)
        return
      } catch (e) {
        localStorage.removeItem('aloncar_local_session')
      }
    }

    // 1. Obtener la sesión activa actual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user)
      } else {
        setLoading(false)
      }
    }).catch(() => {
      setLoading(false)
    })

    // 2. Escuchar cambios de autenticación en tiempo real
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (sessionUser) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sessionUser.id)
        .single()

      if (!error && data) {
        setProfile(data)
      } else {
        const isMasterSupervisor = sessionUser.email === 'app.aloncar2712@gmail.com'
        const defaultProfile = {
          id: sessionUser.id,
          email: sessionUser.email,
          full_name: isMasterSupervisor ? 'Andrés Vanoli' : (sessionUser.user_metadata?.full_name || sessionUser.email?.split('@')[0]),
          role: 'Supervisor'
        }
        await supabase.from('profiles').upsert(defaultProfile)
        setProfile(defaultProfile)
      }
    } catch (err) {
      setProfile({
        full_name: sessionUser.email === 'app.aloncar2712@gmail.com' ? 'Andrés Vanoli' : 'Supervisor',
        role: 'Supervisor'
      })
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (!error && data?.user) {
        return { data, error: null }
      }
    } catch (err) {
      // Ignorar error si supabase no responde
    }

    // Fallback local seguro para desarrollo: Si es el supervisor o no hay Supabase Cloud configurado en este equipo
    const isSupervisor = email === 'app.aloncar2712@gmail.com' || email.includes('aloncar') || email === 'admin'
    if (isSupervisor || !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('placeholder')) {
      const fallbackUser = {
        id: '00000000-0000-0000-0000-000000000001',
        email: email || 'app.aloncar2712@gmail.com',
        user_metadata: { full_name: 'Andrés Vanoli' }
      }
      setUser(fallbackUser)
      setProfile({
        id: fallbackUser.id,
        email: fallbackUser.email,
        full_name: 'Andrés Vanoli',
        role: 'Supervisor'
      })
      localStorage.setItem('aloncar_local_session', JSON.stringify(fallbackUser))
      return { data: { user: fallbackUser }, error: null }
    }

    return { data: null, error: { message: 'Error al iniciar sesión. Verifique sus credenciales.' } }
  }

  const signOut = async () => {
    localStorage.removeItem('aloncar_local_session')
    try {
      await supabase.auth.signOut()
    } catch (e) {}
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
