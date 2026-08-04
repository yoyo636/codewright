export function registerServiceWorker(swUrl = "/sw.js"): void {
  if (typeof window === "undefined") return
  if (!("serviceWorker" in navigator)) return
  if (location.protocol !== "http:" && location.protocol !== "https:") return
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(swUrl, { scope: "/" })
      .catch((err) => console.warn("[pwa] service worker registration failed", err))
  })
}

export function linkManifest(head: HTMLHeadElement, href = "/manifest.webmanifest"): void {
  if (head.querySelector('link[rel="manifest"]')) return
  const link = document.createElement("link")
  link.rel = "manifest"
  link.href = href
  head.appendChild(link)
}
