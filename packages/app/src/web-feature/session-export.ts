export interface ExportableMessage {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  createdAt?: number
}

export interface ExportableSession {
  id: string
  title?: string
  directory?: string
  createdAt?: number
  updatedAt?: number
  messages: ExportableMessage[]
  tags?: string[]
}

export type ExportFormat = "json" | "markdown" | "html"

export function exportSession(session: ExportableSession, format: ExportFormat): { filename: string; mime: string; content: string } {
  const safeTitle = (session.title ?? session.id).replace(/[\\/:*?"<>|]/g, "-").slice(0, 60)
  if (format === "json") {
    return {
      filename: `${safeTitle}.json`,
      mime: "application/json",
      content: JSON.stringify(session, null, 2),
    }
  }
  if (format === "markdown") {
    const lines: string[] = []
    lines.push(`# ${session.title ?? session.id}`)
    if (session.directory) lines.push(`> Directory: \`${session.directory}\``)
    if (session.createdAt) lines.push(`> Created: ${new Date(session.createdAt).toISOString()}`)
    if (session.tags?.length) lines.push(`> Tags: ${session.tags.map((t) => `\`${t}\``).join(", ")}`)
    lines.push("")
    for (const m of session.messages) {
      lines.push(`## ${m.role}${m.createdAt ? ` · ${new Date(m.createdAt).toISOString()}` : ""}`)
      lines.push("")
      lines.push(m.content)
      lines.push("")
    }
    return { filename: `${safeTitle}.md`, mime: "text/markdown", content: lines.join("\n") }
  }
  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
  const rows = session.messages
    .map(
      (m) => `<section class="msg msg-${m.role}"><h3>${m.role}</h3><pre>${escape(m.content)}</pre></section>`,
    )
    .join("\n")
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escape(session.title ?? session.id)}</title>
<style>
body{font-family:ui-sans-serif,system-ui,sans-serif;max-width:780px;margin:40px auto;padding:0 20px;color:#1a1d23}
h1{font-size:24px}
.msg{margin:18px 0;padding:14px 18px;border-radius:12px;background:#f4f6fb}
.msg h3{margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280}
.msg-user{background:linear-gradient(135deg,#e3f2ff,#f3e8ff)}
pre{white-space:pre-wrap;word-break:break-word;margin:0;font-family:ui-monospace,Menlo,monospace;font-size:13px;line-height:1.55}
</style></head><body>
<h1>${escape(session.title ?? session.id)}</h1>
${rows}
</body></html>`
  return { filename: `${safeTitle}.html`, mime: "text/html", content: html }
}

export function downloadFile(file: { filename: string; content: string; mime: string }) {
  if (typeof window === "undefined") return
  const blob = new Blob([file.content], { type: file.mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = file.filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function importSessionFromFile(file: File): Promise<ExportableSession> {
  const text = await file.text()
  if (file.name.endsWith(".json") || file.type === "application/json") {
    const data = JSON.parse(text) as ExportableSession
    if (!data || typeof data !== "object" || !Array.isArray(data.messages)) {
      throw new Error("无效的会话文件：缺少 messages 字段")
    }
    return data
  }
  throw new Error("仅支持 JSON 格式的会话导入")
}
