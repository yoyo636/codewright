import { Schema } from "effect"

export const Event = Schema.Literals([
  "PreToolUse",
  "PostToolUse",
  "UserPromptSubmit",
  "SessionStart",
  "Stop",
  "BeforeCompaction",
  "AfterCompaction",
])

export const Spec = Schema.Struct({
  event: Event.annotate({ description: "Hook event that triggers this hook" }),
  matcher: Schema.optional(Schema.String).annotate({
    description:
      "Tool name matcher for PreToolUse/PostToolUse events. Supports glob patterns (e.g., 'bash', 'edit', '*'). If omitted, matches all tools.",
  }),
  command: Schema.String.annotate({
    description:
      "Shell command to execute. Event data is passed as JSON via stdin. For PreToolUse, exit code 2 blocks the tool and stderr is shown to the model. For other events, stdout is injected as additional context.",
  }),
}).annotate({ identifier: "ConfigHook" })

export type Spec = Schema.Schema.Type<typeof Spec>

export * as ConfigHooksV1 from "./hooks"
