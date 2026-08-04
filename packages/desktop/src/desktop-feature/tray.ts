import { Tray, Menu, type Tray as TrayType, app, nativeImage } from "electron"
import { join } from "node:path"

export interface TrayMenuItem {
  id: string
  label: string
  type?: "normal" | "separator" | "checkbox"
  checked?: boolean
  accelerator?: string
  enabled?: boolean
  submenu?: TrayMenuItem[]
}

export interface TrayControllerOptions {
  iconPath?: string
  tooltip?: string
  onItem: (id: string) => void
  onShow: () => void
  onQuit: () => void
}

let tray: TrayType | null = null

function defaultIconPath(): string {
  if (process.platform === "darwin") {
    return join(__dirname, "..", "..", "resources", "tray", "trayTemplate.png")
  }
  return join(__dirname, "..", "..", "resources", "tray", "tray.png")
}

function loadIcon(path: string) {
  const img = nativeImage.createFromPath(path)
  if (process.platform === "darwin") img.setTemplateImage(true)
  return img.isEmpty() ? nativeImage.createEmpty() : img
}

export function createTray(opts: TrayControllerOptions): TrayType | null {
  if (tray) return tray
  try {
    const icon = loadIcon(opts.iconPath ?? defaultIconPath())
    tray = new Tray(icon)
    tray.setToolTip(opts.tooltip ?? "Codewright")
    const menu = Menu.buildFromTemplate([
      { label: "打开 Codewright", click: () => opts.onShow() },
      { type: "separator" },
      { label: "退出", click: () => opts.onQuit() },
    ])
    tray.setContextMenu(menu)
    tray.on("click", () => opts.onShow())
    tray.on("double-click", () => opts.onShow())
    return tray
  } catch (err) {
    console.warn("[tray] failed to create", err)
    return null
  }
}

export function updateTrayMenu(items: TrayMenuItem[], opts: TrayControllerOptions) {
  if (!tray) return
  const template = items.map((it) => {
    if (it.type === "separator") return { type: "separator" as const }
    return {
      label: it.label,
      type: it.type ?? ("normal" as const),
      checked: it.checked,
      accelerator: it.accelerator,
      enabled: it.enabled !== false,
      submenu: it.submenu?.map((s) => ({
        label: s.label,
        enabled: s.enabled !== false,
        click: () => opts.onItem(s.id),
      })),
      click: () => opts.onItem(it.id),
    }
  })
  try {
    tray.setContextMenu(Menu.buildFromTemplate(template))
  } catch (err) {
    console.warn("[tray] failed to update menu", err)
  }
}

export function destroyTray() {
  if (!tray) return
  try {
    tray.destroy()
  } catch {
    /* ignore */
  }
  tray = null
}

export function hideToTray() {
  if (process.platform !== "darwin" || !app.dock) return
  app.dock.hide()
}

export function showFromTray() {
  if (process.platform !== "darwin" || !app.dock) return
  app.dock.show()
}
