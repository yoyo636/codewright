import { Notification, app, type NotificationConstructorOptions } from "electron"

export type NotificationKind = "info" | "success" | "warning" | "error"

export interface NotifyOptions {
  title: string
  body?: string
  kind?: NotificationKind
  silent?: boolean
  onClick?: () => void
}

const COLORS: Record<NotificationKind, string> = {
  info: "#6dd3ff",
  success: "#7ee787",
  warning: "#ffd166",
  error: "#ff6b6b",
}

function supports(): boolean {
  try {
    return Notification.isSupported()
  } catch {
    return false
  }
}

export function notify(opts: NotifyOptions): Notification | null {
  if (!supports()) return null
  const kind = opts.kind ?? "info"
  const o: NotificationConstructorOptions = {
    title: opts.title,
    body: opts.body,
    silent: opts.silent,
    urgency: kind === "error" ? "critical" : "normal",
    timeoutType: "default",
  }
  try {
    const n = new Notification(o)
    if (opts.onClick) n.on("click", () => opts.onClick?.())
    n.show()
    return n
  } catch (err) {
    console.warn("[notification] failed to show", err)
    return null
  }
}

export const kindColor = (kind: NotificationKind) => COLORS[kind]

export function setAppBadge(count: number) {
  if (typeof app.setBadgeCount === "function") {
    try {
      app.setBadgeCount(Math.max(0, count | 0))
    } catch {
      /* ignore unsupported platforms */
    }
  }
}

export function clearAppBadge() {
  setAppBadge(0)
}
