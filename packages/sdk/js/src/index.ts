export * from "./client.js"
export * from "./server.js"

import { createCodewrightClient } from "./client.js"
import { createCodewrightServer } from "./server.js"
import type { ServerOptions } from "./server.js"

export async function createCodewright(options?: ServerOptions) {
  const server = await createCodewrightServer({
    ...options,
  })

  const client = createCodewrightClient({
    baseUrl: server.url,
  })

  return {
    client,
    server,
  }
}
