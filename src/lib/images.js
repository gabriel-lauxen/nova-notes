import { supabase } from './supabase'
import { isSupabaseConfigured } from './supabase'

const BUCKET = 'note-images'
const SIGNED_TTL = 60 * 60 * 24 * 7 // 7 dias

// lê um arquivo como data URL (fallback p/ modo local, sem nuvem)
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

// sobe a imagem pro Storage e devolve o CAMINHO estável (não a URL).
// no markdown guardamos o caminho; a URL assinada é gerada na hora de exibir.
export async function uploadImage(file) {
  if (!isSupabaseConfigured || !supabase) {
    // sem nuvem: embute como data URL
    return await fileToDataUrl(file)
  }
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth?.user?.id || 'anon'
  const ext = (file.name?.split('.').pop() || file.type?.split('/')?.[1] || 'png')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  const id = (crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(16).slice(2))
  const path = `${uid}/${id}.${ext || 'png'}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined })
  if (error) throw error
  return path
}

const cache = new Map() // path -> { url, exp }

// converte um caminho do Storage numa URL assinada (com cache curto em memória)
export async function signedUrl(path) {
  if (!path) return ''
  // já é exibível diretamente
  if (/^(https?:|data:|blob:)/.test(path)) return path
  if (!isSupabaseConfigured || !supabase) return path
  const hit = cache.get(path)
  const now = Date.now()
  if (hit && hit.exp > now) return hit.url
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL)
  if (error) throw error
  cache.set(path, { url: data.signedUrl, exp: now + (SIGNED_TTL - 600) * 1000 })
  return data.signedUrl
}

export function isImageFile(file) {
  return file && /^image\//.test(file.type || '')
}
