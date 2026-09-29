import { describe, it, expect } from "bun:test"
import { V2 } from "@/server/v2"

// The V2 server (packages/server) is self-contained: createEmbeddedRoutes()
// compiles the full application layer (SessionV2, EventV2, Database, ...) and
// the only extra requirement is the HTTP primitives needed to materialize
// responses. This boots it in-process and exercises a real route, so a
// regression in the routes layer or its service dependencies fails loudly
// instead of surfacing only at runtime.
describe("V2 server", () => {
  it("boots and serves /api/health", async () => {
    const server = V2()
    const res = await server.app.request("/api/health")
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('"healthy":true')
    server.dispose()
  })
})