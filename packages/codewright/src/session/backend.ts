import type { CodewrightClient } from "@codewright-ai/sdk/v2"

export type SessionKernel = "v1" | "v2"

/**
 * Capabilities a caller may rely on. V2 does not ship everything V1 does, so
 * callers consult `caps` and degrade explicitly (hide an entry point, return an
 * unsupported error) instead of silently failing mid-session.
 */
export type Capabilities = {
  task: boolean
  lsp: boolean
  plan: boolean
  mcp: boolean
  plugin: boolean
  shell: boolean
  command: boolean
  compact: boolean
  wait: boolean
  status: boolean
}

export const V1_CAPABILITIES: Capabilities = {
  task: true,
  lsp: true,
  plan: true,
  mcp: true,
  plugin: true,
  shell: true,
  command: true,
  compact: true,
  wait: true,
  status: true,
}

// Core V2 ships twelve location-scoped built-in tools and still lacks task,
// LSP, plan, repo, code mode, and the MCP/plugin transforms
// (core/src/tool/builtins.ts). SessionV2 declares shell, skill, compact, and
// wait unavailable, and the runner does not persist status yet
// (core/src/session/runner/llm.ts).
export const V2_CAPABILITIES: Capabilities = {
  task: false,
  lsp: false,
  plan: false,
  mcp: false,
  plugin: false,
  shell: false,
  command: false,
  compact: false,
  wait: false,
  status: false,
}

export type SessionPromptInput = Parameters<CodewrightClient["session"]["prompt"]>[0]
export type SessionCreateInput = Parameters<CodewrightClient["session"]["create"]>[0]
export type SessionForkInput = Parameters<CodewrightClient["session"]["fork"]>[0]

// Methods are spread from a local object rather than annotated one by one: the
// SDK declares `prompt<ThrowOnError extends boolean = false>`, and annotating
// with `ReturnType<...>` instantiates that parameter with `unknown`, which
// drops the `error` field callers rely on. Inference keeps it.
export function createBackend(client: CodewrightClient, kind: SessionKernel) {
  // The V2 backend arrives with the run switch; until then selecting it is a
  // hard error rather than a silent fallback to V1, because the two kernels
  // project session history differently and must never be mixed mid-session.
  if (kind === "v2") throw new Error("V2 session backend is not wired yet")
  const calls = {
    create: (input: SessionCreateInput) => client.session.create(input),
    list: () => client.session.list(),
    fork: (input: SessionForkInput) => client.session.fork(input),
    prompt: (input: SessionPromptInput) => client.session.prompt(input),
  }
  return { kind, caps: V1_CAPABILITIES, ...calls }
}

export type SessionBackend = ReturnType<typeof createBackend>
