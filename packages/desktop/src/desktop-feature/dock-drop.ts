import { app, BrowserWindow, type NativeImage, nativeImage } from "electron"
import { join } from "node:path"

export interface DockDropOptions {
  onFiles: (files: Array<{ name: string; mime: string; size: number; path: string }>) => void
  onText?: (text: string) => void
}

function getIcon(): NativeImage {
  if (process.platform !== "darwin") return nativeImage.createEmpty()
  const path = join(__dirname, "..", "..", "resources", "icons", "iconTemplate.png")
  const img = nativeImage.createFromPath(path)
  img.setTemplateImage(true)
  return img
}

export function setDockBadge(text: string) {
  if (process.platform !== "darwin" || !app.dock) return
  try {
    app.dock.setBadge(text)
  } catch {
    /* ignore */
  }
}

export function bounceDock(kind: "critical" | "informational" = "informational") {
  if (process.platform !== "darwin" || !app.dock) return
  try {
    app.dock.bounce(kind)
  } catch {
    /* ignore */
  }
}

export function setDockIcon() {
  if (process.platform !== "darwin" || !app.dock) return
  const img = getIcon()
  if (!img.isEmpty()) {
    try {
      app.dock.setIcon(img)
    } catch {
      /* ignore */
    }
  }
}

export function attachDockDrop(opts: DockDropOptions) {
  if (process.platform !== "darwin" || !app.dock) return () => undefined
  const handler = (event: Event, files: string[]) => {
    const items = files.map((p) => {
      const name = p.split("/").pop() ?? p
      return { name, mime: "application/octet-stream", size: 0, path: p }
    })
    if (items.length) opts.onFiles(items)
  }
  try {
    app.on("open-file", handler as any)
  } catch (err) {
    console.warn("[dock-drop] attach failed", err)
    return () => undefined
  }
  return () => {
    try {
      app.off("open-file", handler as any)
    } catch {
      /* ignore */
    }
  }
}

export function attachWindowDrop(win: BrowserWindow, opts: DockDropOptions) {
  if (win.isDestroyed()) return
  try {
    win.webContents.on("will-navigate", (event) => {
      const url = event.url
      if (url.startsWith("file://")) event.preventDefault()
    })
  } catch {
    /* ignore */
  }
  void opts
}
