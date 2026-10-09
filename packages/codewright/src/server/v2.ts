import { createEmbeddedRoutes } from "@codewright-ai/server/routes"
import * as Observability from "@codewright-ai/core/observability"
import { Layer } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { lazy } from "@/util/lazy"

type ServerApp = {
  fetch(request: Request): Response | Promise<Response>
  request(input: string | URL | Request, init?: RequestInit): Response | Promise<Response>
}

// In-process V2 server, mirroring `Server.Default()` but built from the V2
// kernel (`packages/server`) instead of the legacy V1 session handler.
//
// The V2 server is self-contained: `createEmbeddedRoutes()` compiles the full
// application layer (SessionV2, EventV2, Database, ...) and the only extra
// requirement is the HTTP server primitives needed to materialize responses.
// Callers get a plain `fetch` they can hand to the generated SDK client.
export const V2 = lazy(() => {
  const web = HttpRouter.toWebHandler(
    createEmbeddedRoutes().pipe(
      Layer.provide(HttpServer.layerServices),
      // Must stay last: layers provided later build beneath earlier ones, so
      // Observability has to come after the service graph. Otherwise eagerly
      // forked fibers (watcher, project copy, ModelsDev refresh) capture
      // Effect's default stdout logger and print over the TUI (#34730).
      Layer.provideMerge(Observability.layer),
    ),
    { disableLogger: true },
  )
  const app: ServerApp = {
    fetch: (request: Request) => (web.handler as (request: Request) => Promise<Response>)(request),
    request(input, init) {
      return app.fetch(input instanceof Request ? input : new Request(new URL(input, "http://localhost"), init))
    },
  }
  return {
    app,
    dispose: () => web.dispose(),
  }
})