import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1. Obtener la sesión activa actual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user)
      } else {
        setLoading(false)
      }
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
        // Intentar guardar en la tabla profiles de Supabase
        await supabase.from('profiles').upsert(defaultProfile)
        setProfile(defaultProfile)
      }
    } catch (err) {
      console.error('Error fetching profile:', err)
      setProfile({
        full_name: sessionUser.email === 'app.aloncar2712@gmail.com' ? 'Andrés Vanoli' : 'Supervisor',
        role: 'Supervisor'
      })
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
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
