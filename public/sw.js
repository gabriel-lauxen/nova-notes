// Service worker mínimo: network-first para navegação (sempre conteúdo fresco),
// com fallback ao cache da última visita quando offline.
const CACHE = 'nova-v1'

self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then((c) => c.add('/')))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  // navegação (HTML): network-first
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => { caches.open(CACHE).then((c) => c.put('/', res.clone())); return res })
        .catch(() => caches.match('/')),
    )
    return
  }
  // assets estáticos: cache-first
  if (/\.(?:js|css|png|svg|woff2?)$/.test(new URL(req.url).pathname)) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => { caches.open(CACHE).then((c) => c.put(req, res.clone())); return res })),
    )
  }
})

// ---------- Web Push ----------
// recebe o push do servidor (Edge Function) e mostra a notificação,
// mesmo com o app fechado (o SW acorda sozinho)
self.addEventListener('push', (e) => {
  let data = {}
  try { data = e.data ? e.data.json() : {} } catch { data = { body: e.data && e.data.text() } }
  const title = data.title || 'NOVA'
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    tag: data.tag || undefined,
    data: { url: data.url || '/' },
    requireInteraction: !!data.requireInteraction,
  }
  e.waitUntil(self.registration.showNotification(title, options))
})

// clique na notificação: foca uma aba aberta do app ou abre uma nova
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          c.navigate?.(url)
          return c.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
