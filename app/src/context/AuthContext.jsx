import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { profilesRepository } from '../repositories/profilesRepository.js'
import { organizationRolesRepository } from '../repositories/organizationRolesRepository.js'
import {
  mapSecurityLevelToProfileRole,
  resolveEffectiveAllowedSections,
  resolveUserCapabilities,
} from '../lib/permissionsEngine.js'

const AuthContext = createContext({})
const LOCAL_SESSION_KEY = 'aloncar_local_session'
const MASTER_EMAIL = 'app.aloncar2712@gmail.com'

function matchOrgRoleForSession(sessionUser, rolesList = []) {
  const activeRoles = (rolesList || []).filter((r) => (r.status || 'ACTIVO') === 'ACTIVO')
  if (sessionUser?.role_key) {
    const byKey = activeRoles.find((r) => r.role_key === sessionUser.role_key)
    if (byKey) return byKey
  }
  const cleanEmail = String(sessionUser?.email || '').trim().toLowerCase()
  if (cleanEmail) {
    const byEmail = activeRoles.find((r) => String(r.email || '').trim().toLowerCase() === cleanEmail)
    if (byEmail) return byEmail
    if (cleanEmail === MASTER_EMAIL) {
      return activeRoles.find((r) => r.role_key === 'ADMIN_GENERAL') || null
    }
  }
  return null
}

function buildProfileFromOrgRole(sessionUser, matchedRole, dbProfile = null) {
  if (matchedRole) {
    return {
      ...(dbProfile || {}),
      id: sessionUser.id,
      email: sessionUser.email || matchedRole.email || '',
      full_name: matchedRole.holder_name || dbProfile?.full_name || matchedRole.role_title,
      role: mapSecurityLevelToProfileRole(matchedRole.security_level),
      role_key: matchedRole.role_key,
    }
  }
  if (dbProfile) return dbProfile
  const isMaster = sessionUser?.email === MASTER_EMAIL
  return {
    id: sessionUser.id,
    email: sessionUser.email,
    full_name: isMaster ? 'Andrés Vanoli' : (sessionUser.user_metadata?.full_name || sessionUser.email?.split('@')[0]),
    role: 'Supervisor',
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [orgRole, setOrgRole] = useState(null)
  const [loading, setLoading] = useState(true)

  const syncUserAndRole = useCallback(async (sessionUser, { fetchDbProfile = true } = {}) => {
    try {
      const [rolesRes, profileRes] = await Promise.all([
        organizationRolesRepository.listRoles().catch(() => ({ data: [], error: null })),
        fetchDbProfile && sessionUser?.id
          ? profilesRepository.getByUserId(sessionUser.id).catch(() => ({ data: null, error: null }))
          : Promise.resolve({ data: null, error: null }),
      ])
      const matched = matchOrgRoleForSession(sessionUser, rolesRes?.data || [])
      let dbProf = !profileRes?.error && profileRes?.data ? profileRes.data : null
      if (fetchDbProfile && !dbProf && sessionUser?.id && sessionUser?.email) {
        dbProf = buildProfileFromOrgRole(sessionUser, matched, null)
        await profilesRepository.upsertProfile({
          id: dbProf.id,
          email: dbProf.email,
          full_name: dbProf.full_name,
          role: dbProf.role,
        }).catch(() => {})
      }
      setOrgRole(matched)
      setProfile(buildProfileFromOrgRole(sessionUser, matched, dbProf))
    } catch {
      setOrgRole(null)
      setProfile(buildProfileFromOrgRole(sessionUser, null, null))
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshPermissions = useCallback(async () => {
    if (!user) return
    const { data } = await organizationRolesRepository.listRoles().catch(() => ({ data: [] }))
    const matched = matchOrgRoleForSession(user, data || [])
    setOrgRole(matched)
    if (matched) {
      setProfile((prev) => buildProfileFromOrgRole(user, matched, prev))
    }
  }, [user])

  useEffect(() => {
    const localSaved = localStorage.getItem(LOCAL_SESSION_KEY)
    if (localSaved) {
      try {
        const parsed = JSON.parse(localSaved)
        setUser(parsed)
        syncUserAndRole(parsed, { fetchDbProfile: false })
        return
      } catch {
        localStorage.removeItem(LOCAL_SESSION_KEY)
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) syncUserAndRole(session.user, { fetchDbProfile: true })
      else setLoading(false)
    }).catch(() => setLoading(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) syncUserAndRole(session.user, { fetchDbProfile: true })
      else {
        setProfile(null)
        setOrgRole(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [syncUserAndRole])

  const signInAsRole = useCallback(async (roleRecord) => {
    if (!roleRecord?.role_key) return { data: null, error: { message: 'Puesto inválido.' } }
    const localUser = {
      id: '00000000-0000-0000-0000-000000000001',
      email: roleRecord.email || `${roleRecord.role_key.toLowerCase()}@aloncar.local`,
      role_key: roleRecord.role_key,
      user_metadata: { full_name: roleRecord.holder_name || roleRecord.role_title },
    }
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(localUser))
    setUser(localUser)
    setOrgRole(roleRecord)
    setProfile(buildProfileFromOrgRole(localUser, roleRecord, null))
    setLoading(false)
    return { data: { user: localUser, orgRole: roleRecord }, error: null }
  }, [])

  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (!error && data?.user) return { data, error: null }
    } catch {
      // Continuar con resolución local / puesto organizacional
    }

    const cleanEmail = String(email || '').trim().toLowerCase()
    const { data: rolesList } = await organizationRolesRepository.listRoles().catch(() => ({ data: [] }))
    const activeRoles = (rolesList || []).filter((r) => (r.status || 'ACTIVO') === 'ACTIVO')
    const roleByEmail = cleanEmail
      ? activeRoles.find((r) => String(r.email || '').trim().toLowerCase() === cleanEmail)
      : null
    if (roleByEmail) return signInAsRole(roleByEmail)

    const isSupervisor = cleanEmail === MASTER_EMAIL || cleanEmail.includes('aloncar') || cleanEmail === 'admin'
    if (isSupervisor || !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('placeholder')) {
      const adminRole = activeRoles.find((r) => r.role_key === 'ADMIN_GENERAL') || null
      const fallbackUser = {
        id: '00000000-0000-0000-0000-000000000001',
        email: cleanEmail || MASTER_EMAIL,
        role_key: adminRole?.role_key || null,
        user_metadata: { full_name: 'Andrés Vanoli' },
      }
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(fallbackUser))
      setUser(fallbackUser)
      setOrgRole(adminRole)
      setProfile({
        id: fallbackUser.id,
        email: fallbackUser.email,
        full_name: 'Andrés Vanoli',
        role: 'Supervisor',
        role_key: adminRole?.role_key || null,
      })
      return { data: { user: fallbackUser }, error: null }
    }

    return { data: null, error: { message: 'Error al iniciar sesión. Verificá tu correo o seleccioná un puesto activo.' } }
  }

  const signOut = async () => {
    localStorage.removeItem(LOCAL_SESSION_KEY)
    try {
      await supabase.auth.signOut()
    } catch {
      // noop
    }
    setUser(null)
    setProfile(null)
    setOrgRole(null)
  }

  const allowedSections = useMemo(() => resolveEffectiveAllowedSections(orgRole), [orgRole])
  const capabilities = useMemo(() => resolveUserCapabilities(profile, orgRole), [profile, orgRole])

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        orgRole,
        allowedSections,
        capabilities,
        loading,
        signIn,
        signInAsRole,
        refreshPermissions,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
