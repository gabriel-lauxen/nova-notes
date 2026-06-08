import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
// nova publishable key (sb_publishable_...); cai pra anon legacy se ainda usar
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured =
  !!url && !!key && !url.includes('SEU-PROJETO') && !/^sua-/.test(key)

export const supabase = isSupabaseConfigured
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
  : null

if (!isSupabaseConfigured) {
  console.warn(
    '[NOVA] Supabase não configurado — usando armazenamento local (navegador). ' +
      'Preencha o .env para sincronizar na nuvem e habilitar login.',
  )
}
