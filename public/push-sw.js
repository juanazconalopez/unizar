/* Este script amplía el service worker de Workbox; no registra otro worker. */
const pushAccountCache = 'cdu-push-account-v1'
const pushAccountUrl = new URL('/__push_account__', self.location.origin).href

async function pushOwner() {
  const cache = await caches.open(pushAccountCache)
  const saved = await cache.match(pushAccountUrl)
  return saved ? saved.text() : null
}

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'PUSH_ACCOUNT') return
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(pushAccountCache)
      if (typeof event.data.owner === 'string') await cache.put(pushAccountUrl, new Response(event.data.owner))
      else {
        await cache.delete(pushAccountUrl)
        for (const notification of await self.registration.getNotifications()) notification.close()
      }
      event.ports[0]?.postMessage({ ok: true })
    } catch { event.ports[0]?.postMessage({ ok: false }) }
  })())
})

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let payload
    try { payload = event.data?.json() } catch { return }
    if (!payload || payload.userId !== await pushOwner()) return
    await self.registration.showNotification(typeof payload.title === 'string' ? payload.title : 'CDU Rugby', {
      body: 'Abre la aplicación para consultar el aviso.',
      icon: '/pwa-192x192.png',
      tag: String(payload.eventId),
      data: { url: safePushUrl(payload.url), userId: payload.userId },
    })
  })())
})

function safePushUrl(value) {
  try {
    const url = new URL(value, self.location.origin)
    if (url.origin === self.location.origin && url.pathname === '/') return url.href
  } catch { /* Solo se abren destinos propios. */ }
  return new URL('/', self.location.origin).href
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil((async () => {
    const owner = await pushOwner()
    if (!owner || owner !== event.notification.data?.userId) return
    const url = safePushUrl(event.notification.data?.url)
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin)
    if (existing) {
      await existing.navigate(url)
      await existing.focus()
    } else await self.clients.openWindow(url)
  })())
})
