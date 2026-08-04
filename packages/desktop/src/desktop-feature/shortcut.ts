import { BrowserWindow, globalShortcut } from "electron"

export interface ShortcutBinding {
  id: string
  accelerator: string
  handler: () => void
}

let registered: string[] = []
const windowToggles = new Map<string, boolean>()

export function registerGlobalShortcuts(bindings: ShortcutBinding[]): { ok: string[]; failed: string[] } {
  unregisterGlobalShortcuts()
  const ok: string[] = []
  const failed: string[] = []
  for (const b of bindings) {
    try {
      const ret = globalShortcut.register(b.accelerator, b.handler)
      if (ret) ok.push(b.id)
      else failed.push(b.id)
    } catch (err) {
      console.warn("[shortcut] register failed", b.id, err)
      failed.push(b.id)
    }
  }
  return { ok, failed }
}

export function unregisterGlobalShortcuts() {
  for (const acc of registered) {
    try {
      globalShortcut.unregister(acc)
    } catch {
      /* ignore */
    }
  }
  registered = []
  try {
    globalShortcut.unregisterAll()
  } catch {
    /* ignore */
  }
}

export function toggleAlwaysOnTop(win: BrowserWindow): boolean {
  if (win.isDestroyed()) return false
  const next = !win.isAlwaysOnTop()
  win.setAlwaysOnTop(next, "floating")
  return next
}

export function setAlwaysOnTop(win: BrowserWindow, on: boolean, level: "normal" | "floating" | "torn-off-menu" = "floating") {
  if (win.isDestroyed()) return
  win.setAlwaysOnTop(on, level)
}

export function toggleWindowVisible(win: BrowserWindow, key: string): boolean {
  if (win.isDestroyed()) return false
  const current = windowToggles.get(key) ?? win.isVisible()
  const next = !current
  if (next) {
    win.show()
    win.focus()
  } else {
    win.hide()
  }
  windowToggles.set(key, next)
  return next
}
