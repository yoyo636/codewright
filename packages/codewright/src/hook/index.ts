import { Effect } from "effect"
import type { Config } from "@/config/config"
import { ConfigHooksV1 } from "@codewright-ai/core/v1/config/hooks"

export type HookEvent =
  | "PreToolUse"
  | "PostToolUse"
  | "UserPromptSubmit"
  | "SessionStart"
  | "Stop"
  | "BeforeCompaction"
  | "AfterCompaction"

export interface HookInput {
  toolName?: string
  toolArgs?: unknown
  sessionID?: string
  cwd?: string
  userPrompt?: string
}

export interface HookResult {
  blocked: boolean
  reason?: string
  context?: string
}

function matchTool(matcher: string, toolName?: string): boolean {
  if (!toolName) return false
  if (matcher === "*") return true
  if (matcher.endsWith("*")) return toolName.startsWith(matcher.slice(0, -1))
  return matcher === toolName
}

export function run(
  event: HookEvent,
  input: HookInput,
  config: Config.Interface,
): Effect.Effect<HookResult> {
  return Effect.gen(function* () {
    const cfg = yield* config.get()
    const hooks = cfg.hooks ?? []
    const matching = hooks.filter(
      (h: ConfigHooksV1.Spec) => h.event === event && (!h.matcher || matchTool(h.matcher, input.toolName)),
    )

    if (matching.length === 0) return { blocked: false }

    let blocked = false
    let reason: string | undefined
    const contextParts: string[] = []

    const payload = JSON.stringify({
      event,
      toolName: input.toolName,
      toolArgs: input.toolArgs,
      sessionID: input.sessionID,
      cwd: input.cwd,
      userPrompt: input.userPrompt,
    })

    for (const hook of matching) {
      const proc = Bun.spawnSync(["sh", "-c", hook.command], {
        cwd: input.cwd ?? process.cwd(),
        stdin: new TextEncoder().encode(payload),
        stdout: "pipe",
        stderr: "pipe",
      })

      const stdout = proc.stdout.toString("utf-8").trim()
      const stderr = proc.stderr.toString("utf-8").trim()

      if (event === "PreToolUse" && proc.exitCode === 2) {
        blocked = true
        reason = stderr || stdout || "Blocked by PreToolUse hook"
        break
      }

      if (stdout) contextParts.push(stdout)
    }

    return {
      blocked,
      reason,
      context: contextParts.length > 0 ? contextParts.join("\n") : undefined,
    }
  })
}

export * as hook from "./index"
