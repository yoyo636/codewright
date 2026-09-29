import type { SessionPromptInput, SessionCreateInput, SessionForkInput } from "./backend"

// The V2 session endpoints live under /api/session and are shaped by the V2
// protocol (packages/protocol), not by the legacy-shaped SDK client. The V2
// backend therefore speaks to the V2 server over a plain fetch instead of
// delegating to `client.session.*`, which is generated from the legacy
// OpenAPI and would POST to /session/{id}/message.
export type FetchLike = typeof globalThis.fetch

type Json = Record<string, unknown>

async function json<T>(response: Response): Promise<T> {
  const text = await response.text()
  if (!response.ok) {
    let message = `HTTP ${response.status}`
    try {
      const body = JSON.parse(text) as Json
      message = String(body?.message ?? body?.error ?? message)
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  return JSON.parse(text) as T
}

// Map the CLI's generic prompt parts onto the V2 PromptInput shape. Text and
// file parts are the two the CLI emits; agent/subtask parts are skipped from
// the text/files projection (they are carried by the V1 kernel only).
function toPromptInput(input: SessionPromptInput) {
  const parts = (input.parts ?? []) as Array<Record<string, unknown>>
  const text = parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("")
  const files = parts
    .filter((part): part is { type: "file"; url: string; filename?: string } => part.type === "file")
    .map((part) => ({ uri: part.url, name: part.filename }))
  return { text, files: files.length ? files : undefined }
}

export { toPromptInput }

export function v2Calls(fetch: FetchLike) {
  const base = "http://codewright.internal"
  return {
    create: async (input: SessionCreateInput) => {
      const response = await fetch(`${base}/api/session`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: (input as any).id }),
      })
      return json<{ data: { id: string } }>(response)
    },
    list: async () => {
      const response = await fetch(`${base}/api/session`)
      return json<{ data: Array<{ id: string }> }>(response)
    },
    fork: async (_input: SessionForkInput) => {
      throw new Error("session.fork is not available on the V2 kernel yet")
    },
    prompt: async (input: SessionPromptInput) => {
      const response = await fetch(`${base}/api/session/${input.sessionID}/prompt`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: input.messageID,
          prompt: toPromptInput(input),
        }),
      })
      return json<{ data: { messageID: string } }>(response)
    },
  }
}