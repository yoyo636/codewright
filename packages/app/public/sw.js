const CACHE = "codewright-app-v1"
const RUNTIME_CACHE = "codewright-runtime-v1"
const SHELL = ["/", "/index.html"]
const RUNTIME_PATTERNS = [/\.(?:js|css|woff2?|svg|png|jpg|jpeg|gif|webp|ico)$/]

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      await cache.addAll(SHELL).catch(() => undefined)
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names.filter((n) => n !== CACHE && n !== RUNTIME_CACHE).map((n) => caches.delete(n)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (RUNTIME_PATTERNS.some((re) => re.test(url.pathname))) {
    event.respondWith(staleWhileRevalidate(req))
    return
  }
  if (req.mode === "navigate") {
    event.respondWith(networkWithOfflineFallback(req))
    return
  }
})

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME_CACHE)
  const cached = await cache.match(req)
  const networkPromise = fetch(req)
    .then((res) => {
      if (res && res.status === 200) cache.put(req, res.clone()).catch(() => undefined)
      return res
    })
    .catch(() => cached)
  return cached || networkPromise
}

async function networkWithOfflineFallback(req) {
  const cache = await caches.open(CACHE)
  try {
    const res = await fetch(req)
    if (res && res.status === 200) cache.put(req, res.clone()).catch(() => undefined)
    return res
  } catch (err) {
    const cached = await cache.match(req)
    if (cached) return cached
    const shell = await cache.match("/index.html")
    if (shell) return shell
    throw err
  }
}
