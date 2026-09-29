import { describe, it, expect } from "bun:test"
import { v2Calls } from "@/session/backend-fetch"

// The V2 backend speaks the V2 protocol (/api/session/*) directly over a plain
// fetch rather than delegating to the legacy-shaped SDK client. These tests pin
// the HTTP contract: paths, methods, and the PromptInput projection from the
// CLI's generic prompt parts.
describe("v2Calls", () => {
  function mockFetch(responder: (url: string, init?: RequestInit) => Response) {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const fetch: typeof globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString()
      calls.push({ url, init })
      return Promise.resolve(responder(url, init))
    }) as typeof globalThis.fetch
    return { fetch, calls }
  }

  it("projects text parts onto the V2 prompt payload", async () => {
    const { fetch, calls } = mockFetch(() =>
      new Response(JSON.stringify({ data: { messageID: "msg_1" } }), { status: 200, headers: { "content-type": "application/json" } }),
    )
    const backend = v2Calls(fetch)
    const result = await backend.prompt({
      sessionID: "ses_1",
      messageID: "msg_1",
      parts: [{ type: "text", text: "hello" }],
    })
    expect(result).toEqual({ data: { messageID: "msg_1" } })
    expect(calls[0].url).toBe("http://codewright.internal/api/session/ses_1/prompt")
    expect(calls[0].init?.method).toBe("POST")
    const body = JSON.parse((calls[0].init?.body as string) ?? "{}")
    expect(body).toEqual({ id: "msg_1", prompt: { text: "hello" } })
  })

  it("projects file parts onto the V2 prompt payload", async () => {
    const { fetch, calls } = mockFetch(() =>
      new Response(JSON.stringify({ data: { messageID: "msg_2" } }), { status: 200, headers: { "content-type": "application/json" } }),
    )
    const backend = v2Calls(fetch)
    await backend.prompt({
      sessionID: "ses_2",
      parts: [
        { type: "text", text: "look" },
        { type: "file", mime: "text/plain", filename: "a.txt", url: "file:///a.txt" },
      ],
    })
    const body = JSON.parse((calls[0].init?.body as string) ?? "{}")
    expect(body.prompt).toEqual({
      text: "look",
      files: [{ uri: "file:///a.txt", name: "a.txt" }],
    })
  })

  it("creates a session at the V2 endpoint", async () => {
    const { fetch, calls } = mockFetch(() =>
      new Response(JSON.stringify({ data: { id: "ses_new" } }), { status: 200, headers: { "content-type": "application/json" } }),
    )
    const backend = v2Calls(fetch)
    const result = await backend.create({ id: "ses_new" } as any)
    expect(result).toEqual({ data: { id: "ses_new" } })
    expect(calls[0].url).toBe("http://codewright.internal/api/session")
    expect(calls[0].init?.method).toBe("POST")
  })

  it("lists sessions at the V2 endpoint", async () => {
    const { fetch, calls } = mockFetch(() =>
      new Response(JSON.stringify({ data: [{ id: "ses_1" }] }), { status: 200, headers: { "content-type": "application/json" } }),
    )
    const backend = v2Calls(fetch)
    const result = await backend.list()
    expect(result).toEqual({ data: [{ id: "ses_1" }] })
    expect(calls[0].url).toBe("http://codewright.internal/api/session")
    expect(calls[0].init?.method).toBeUndefined()
  })

  it("surfaces HTTP errors as thrown errors", async () => {
    const { fetch } = mockFetch(() => new Response(JSON.stringify({ message: "not found" }), { status: 404 }))
    const backend = v2Calls(fetch)
    await expect(backend.prompt({ sessionID: "missing" })).rejects.toThrow("not found")
  })

  it("fork is unsupported on the V2 kernel", async () => {
    const { fetch } = mockFetch(() => new Response("", { status: 200 }))
    const backend = v2Calls(fetch)
    await expect(backend.fork({} as never)).rejects.toThrow("not available on the V2 kernel")
  })
})