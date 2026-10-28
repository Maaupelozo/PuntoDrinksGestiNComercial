import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { configurationError, requireSupabase, supabase } from '../lib/supabase'
import { validatePassword } from '../lib/settings-rules'

interface AuthState {
  session: Session | null
  loading: boolean
  error: string | null
  recovering: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  updateProfileName: (name: string) => Promise<void>
  requestEmailChange: (email: string) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState<string | null>(configurationError)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    if (!supabase) return
    let active = true
    let receivedAuthEvent = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return
      receivedAuthEvent = true
      setSession(nextSession)
      setLoading(false)
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (event === 'SIGNED_OUT') setRecovering(false)
    })
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active || receivedAuthEvent) return
      if (sessionError) setError(sessionError.message)
      setSession(data.session)
      setLoading(false)
    }).catch((connectionError: unknown) => {
      if (!active) return
      setError(connectionError instanceof Error ? connectionError.message : 'Error de conexión con Supabase.')
      setLoading(false)
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  const value = useMemo<AuthState>(() => ({
    session, loading, error, recovering,
    async signIn(email, password) {
      const { error } = await requireSupabase().auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    async signOut() {
      const { error } = await requireSupabase().auth.signOut()
      if (error) throw error
    },
    async requestPasswordReset(email) {
      const redirectTo = new URL(`${import.meta.env.BASE_URL}restablecer-clave`, window.location.origin).toString()
      // Always return the same response to avoid revealing registered addresses.
      await requireSupabase().auth.resetPasswordForEmail(email, { redirectTo })
    },
    async updatePassword(password) {
      validatePassword(password)
      const { error } = await requireSupabase().auth.updateUser({ password })
      if (error) throw error
      const signedOut = await requireSupabase().auth.signOut()
      if (signedOut.error) throw signedOut.error
      setRecovering(false)
    },
    async updateProfileName(name) {
      const clean = name.trim()
      if (!clean || clean.length > 120) throw new Error('Ingresá un nombre de hasta 120 caracteres.')
      const { error } = await requireSupabase().auth.updateUser({ data: { display_name: clean } })
      if (error) throw error
    },
    async requestEmailChange(email) {
      const clean = email.trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new Error('Ingresá un correo electrónico válido.')
      const { error } = await requireSupabase().auth.updateUser({ email: clean })
      if (error) throw error
    },
    async changePassword(currentPassword, newPassword) {
      if (!currentPassword) throw new Error('Ingresá la contraseña actual.')
      validatePassword(newPassword)
      const { error } = await requireSupabase().auth.updateUser({
        password: newPassword, current_password: currentPassword,
      })
      if (error) throw error
    },
  }), [session, loading, error, recovering])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('AuthProvider no está disponible.')
  return context
}
