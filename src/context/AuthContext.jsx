import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { setGeminiKey } from '../lib/ai'

const AuthContext = createContext(null)

// puxa a chave do Gemini salva na conta para o cache local (runtime)
function syncGeminiKey(user) {
  const k = user?.user_metadata?.gemini_key
  if (k) setGeminiKey(k)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      syncGeminiKey(data.session?.user)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      syncGeminiKey(session?.user)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const value = {
    user,
    loading,
    // só exige login quando há Supabase configurado
    needsAuth: isSupabaseConfigured && !user,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signUp: (email, password, name) =>
      supabase.auth.signUp({ email, password, options: { data: { name } } }),
    updateName: (name) => supabase.auth.updateUser({ data: { name } }),
    updateGeminiKey: (gemini_key) => supabase.auth.updateUser({ data: { gemini_key } }),
    signOut: () => supabase.auth.signOut(),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
