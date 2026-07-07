import { supabase, isSupabaseConfigured } from './supabase'

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

export const pushConfigured = isSupabaseConfigured && !!VAPID_PUBLIC

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

// no iOS o Push só existe quando o app está instalado na tela de início
export function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.navigator.standalone === true
  )
}

export function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function getRegistration() {
  return (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.ready)
}

// 'unsupported' | 'need-install' | 'denied' | 'enabled' | 'off'
export async function pushStatus() {
  if (!isPushSupported() || !pushConfigured) return 'unsupported'
  if (isIOS() && !isStandalone()) return 'need-install'
  if (Notification.permission === 'denied') return 'denied'
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager?.getSubscription()
    return sub ? 'enabled' : 'off'
  } catch {
    return 'off'
  }
}

async function saveSubscription(sub) {
  const json = sub.toJSON()
  const { data: auth } = await supabase.auth.getUser()
  const row = {
    user_id: auth?.user?.id,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    user_agent: navigator.userAgent.slice(0, 200),
  }
  // upsert pelo endpoint (único) — reinstalar/recriar não duplica
  const { error } = await supabase.from('push_subscriptions').upsert(row, { onConflict: 'endpoint' })
  if (error) throw error
}

// pede permissão, inscreve no push e salva a subscription no Supabase
export async function enablePush() {
  if (!isPushSupported()) throw new Error('Seu navegador não suporta notificações push.')
  if (!pushConfigured) throw new Error('Push não configurado (faltam Supabase ou a chave VAPID).')
  if (isIOS() && !isStandalone())
    throw new Error('No iPhone, adicione o app à Tela de Início primeiro e abra pelo ícone.')

  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Permissão de notificação negada.')

  const reg = await getRegistration()
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    })
  }
  await saveSubscription(sub)
  return true
}

export async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager?.getSubscription()
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      await sub.unsubscribe()
    }
  } catch {}
}
