// Edge Function: envia lembretes/hábitos vencidos por Web Push.
// SEM npm:web-push (não carrega no runtime Deno) — Web Push feito na mão
// com a Web Crypto API (VAPID + aes128gcm, RFC 8291/8292).
import { createClient } from 'npm:@supabase/supabase-js@2'

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } })

// ---------- helpers base64url / bytes ----------
function b64urlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  s += '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(s)
  const b = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i)
  return b
}
function bytesToB64url(b: Uint8Array): string {
  let bin = ''
  for (const x of b) bin += String.fromCharCode(x)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function concat(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((n, a) => n + a.length, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const a of arrs) { out.set(a, o); o += a.length }
  return out
}
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8)
  return new Uint8Array(bits)
}

// ---------- VAPID JWT (ES256) ----------
async function vapidAuthHeader(endpoint: string, subject: string, pubB64: string, privB64: string) {
  const url = new URL(endpoint)
  const aud = `${url.protocol}//${url.host}`
  const te = new TextEncoder()
  const enc = (o: unknown) => bytesToB64url(te.encode(JSON.stringify(o)))
  const signingInput = `${enc({ typ: 'JWT', alg: 'ES256' })}.${enc({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })}`
  const pub = b64urlToBytes(pubB64) // 65 bytes: 0x04 || x || y
  const jwk = {
    kty: 'EC', crv: 'P-256', d: privB64,
    x: bytesToB64url(pub.slice(1, 33)), y: bytesToB64url(pub.slice(33, 65)),
    ext: true, key_ops: ['sign'],
  }
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(signingInput)))
  const jwt = `${signingInput}.${bytesToB64url(sig)}`
  return `vapid t=${jwt}, k=${pubB64}`
}

// ---------- criptografia do payload (aes128gcm) ----------
async function encryptPayload(p256dhB64: string, authB64: string, payloadStr: string) {
  const clientPub = b64urlToBytes(p256dhB64)
  const authSecret = b64urlToBytes(authB64)
  const salt = crypto.getRandomValues(new Uint8Array(16))

  const asPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', asPair.publicKey)) // 65 bytes
  const clientKey = await crypto.subtle.importKey('raw', clientPub, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: clientKey }, asPair.privateKey, 256))

  const te = new TextEncoder()
  const ikm = await hkdf(authSecret, ecdh, concat(te.encode('WebPush: info\0'), clientPub, asPublic), 32)
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12)

  const record = concat(te.encode(payloadStr), new Uint8Array([2])) // delimitador 0x02 (último registro)
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt'])
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, record))

  // header aes128gcm: salt(16) | rs(4=4096) | idlen(1=65) | asPublic(65) | ciphertext
  return concat(salt, new Uint8Array([0, 0, 0x10, 0]), new Uint8Array([asPublic.length]), asPublic, cipher)
}

async function sendWebPush(sub: { endpoint: string; p256dh: string; auth: string }, payloadStr: string, vapid: { subject: string; pub: string; priv: string }) {
  const [auth, body] = await Promise.all([
    vapidAuthHeader(sub.endpoint, vapid.subject, vapid.pub, vapid.priv),
    encryptPayload(sub.p256dh, sub.auth, payloadStr),
  ])
  return fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '2419200',
      Authorization: auth,
    },
    body,
  })
}

// ---------- agendamento ----------
const addMs = (iso: string, ms: number) => new Date(new Date(iso).getTime() + ms).toISOString()
function rollForward(iso: string, stepMs: number) {
  let t = new Date(iso).getTime()
  if (t > Date.now()) return iso
  while (t <= Date.now()) t += stepMs
  return new Date(t).toISOString()
}

Deno.serve(async (req) => {
  try {
    if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
      return json({ error: 'unauthorized (x-cron-secret não bate com CRON_SECRET)' }, 401)
    }
    const vapid = {
      pub: Deno.env.get('VAPID_PUBLIC_KEY') || '',
      priv: Deno.env.get('VAPID_PRIVATE_KEY') || '',
      subject: Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com',
    }
    if (!vapid.pub || !vapid.priv) {
      return json({ error: 'faltam secrets VAPID', VAPID_PUBLIC_KEY: !!vapid.pub, VAPID_PRIVATE_KEY: !!vapid.priv }, 500)
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const sendToUser = async (userId: string, payload: Record<string, unknown>) => {
      const { data: subs } = await supabase.from('push_subscriptions').select('*').eq('user_id', userId)
      const str = JSON.stringify(payload)
      for (const s of subs || []) {
        try {
          const res = await sendWebPush(s, str, vapid)
          if (res.status === 404 || res.status === 410) {
            await supabase.from('push_subscriptions').delete().eq('id', s.id)
          } else if (res.status >= 400) {
            console.error('push', res.status, await res.text())
          }
        } catch (e) {
          console.error('push exception', String(e))
        }
      }
    }

    const nowIso = new Date().toISOString()
    let sent = 0

    const { data: reminders } = await supabase
      .from('reminders').select('*')
      .eq('active', true).eq('done', false)
      .not('next_fire_at', 'is', null).lte('next_fire_at', nowIso)
    for (const r of reminders || []) {
      await sendToUser(r.user_id, {
        title: 'Lembrete', body: r.text || 'Você tem um lembrete',
        url: r.note_id ? `/note/${r.note_id}` : '/', tag: `rem-${r.id}`,
        requireInteraction: r.kind === 'interval',
      })
      sent++
      let patch: Record<string, unknown>
      if (r.kind === 'daily') patch = { next_fire_at: rollForward(r.next_fire_at, 86400000) }
      else if (r.kind === 'interval') patch = { next_fire_at: addMs(nowIso, (Number(r.interval_hours) || 1) * 3600000) }
      else patch = { active: false }
      await supabase.from('reminders').update(patch).eq('id', r.id)
    }

    const { data: habits } = await supabase
      .from('habits').select('*')
      .eq('notify', true).not('notify_next_at', 'is', null).lte('notify_next_at', nowIso)
    for (const h of habits || []) {
      await sendToUser(h.user_id, {
        title: 'Hábito de hoje', body: `${h.emoji || '✅'} ${h.name}`.trim(),
        url: h.note_id ? `/note/${h.note_id}` : '/habits', tag: `habit-${h.id}`,
      })
      sent++
      await supabase.from('habits').update({ notify_next_at: rollForward(h.notify_next_at, 86400000) }).eq('id', h.id)
    }

    return json({ ok: true, sent, at: nowIso })
  } catch (e: any) {
    return json({ error: String(e?.message || e), stack: String(e?.stack || '') }, 500)
  }
})
