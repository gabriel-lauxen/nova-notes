import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured =
  !!url && !!key && !url.includes('SEU-PROJETO') && key !== 'sua-anon-key-aqui'

export const supabase = isSupabaseConfigured ? createClient(url, key) : null

if (!isSupabaseConfigured) {
  console.warn(
    '[NOVA] Supabase não configurado — usando armazenamento local (navegador). ' +
      'Preencha o arquivo .env para sincronizar na nuvem.',
  )
}
