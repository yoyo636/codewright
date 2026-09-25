import type { ConfigPermissionV1 } from "@codewright-ai/core/v1/config/permission"

/**
 * Named approval presets, mirroring the approval modes of OpenAI's Codex CLI.
 *
 * - `suggest`   - ask for edits and commands; reads and searches stay automatic.
 * - `auto-edit` - auto-apply edits; risky and destructive commands are still
 *                 gated by the safety layer (this is the default).
 * - `full-auto` - auto-approve everything at the permission level; the safety
 *                 layer still blocks destructive commands, and risky commands
 *                 still ask unless `experimental.safety.dangerous` is set to
 *                 `allow` (e.g. via the `--yolo` CLI flag).
 */

export type ApprovalMode = "suggest" | "auto-edit" | "full-auto"

export function approvalModeDefaults(mode: ApprovalMode, whitelistedDirs: string[]): ConfigPermissionV1.Info {
  const externalDirectory: ConfigPermissionV1.Object = {
    "*": "ask",
    ...Object.fromEntries(whitelistedDirs.map((dir) => [dir, "allow" as const])),
  }
  // mirrors github.com/github/gitignore Node.gitignore pattern for .env files
  const read: ConfigPermissionV1.Object = {
    "*": "allow",
    "*.env": "ask",
    "*.env.*": "ask",
    "*.env.example": "allow",
  }
  const base = {
    doom_loop: "ask",
    external_directory: externalDirectory,
    question: "deny",
    plan_enter: "deny",
    plan_exit: "deny",
    read,
  } as const

  if (mode === "suggest") {
    return { ...base, "*": "ask", glob: "allow", grep: "allow", list: "allow" }
  }

  // auto-edit and full-auto share the same permission matrix; they differ in
  // how the safety layer treats risky commands (--auto / --yolo).
  return { ...base, "*": "allow" }
}
