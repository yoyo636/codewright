export * as TaskTool from "./task"

import { ToolFailure } from "@codewright-ai/llm"
import { Duration, Effect, Layer, Schema } from "effect"
import { makeLocationNode } from "../effect/app-node"
import { serviceUse } from "../effect/service-use"
import { AgentV2 } from "../agent"
import { Location } from "../location"
import { PermissionV2 } from "../permission"
import { SessionV2 } from "../session"
import { SessionMessage } from "../session/message"
import { ToolRegistry } from "./registry"
import { Tool } from "./tool"
import { Tools } from "./tools"

export const name = "task"
export const MAX_PROMPT_CHARACTERS = 100_000
export const DEFAULT_TIMEOUT_SECONDS = 600
export const MAX_TIMEOUT_SECONDS = 3600
export const MAX_OUTPUT_CHARACTERS = 50_000

export const description = `Launch a sub-agent with an independent context to run a focused task and return its report.

Use this for work that benefits from isolation: broad multi-file searches, independent research, or parallelizable subtasks. The sub-agent runs in its own session and cannot see this conversation; it receives only the prompt you give it. When it finishes, its final assistant text is returned here as the tool result.

- description: a concise 3-5 word label for the subtask
- prompt: the complete task instruction, including any file paths, context, and the desired output
- timeout: optional wall-clock budget in seconds (default ${DEFAULT_TIMEOUT_SECONDS}, maximum ${MAX_TIMEOUT_SECONDS})`

const Timeout = Schema.Number.check(Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(MAX_TIMEOUT_SECONDS))

export const Input = Schema.Struct({
  description: Schema.String.annotate({ description: "A concise 3-5 word label for the subtask" }),
  prompt: Schema.String.annotate({ description: "The complete task instruction for the sub-agent" }),
  timeout: Timeout.pipe(Schema.optional).annotate({
    description: `Optional wall-clock budget in seconds (maximum: ${MAX_TIMEOUT_SECONDS})`,
  }),
})

const Output = Schema.Struct({
  operation: Schema.Literal("task"),
  sessionID: Schema.String,
  description: Schema.String,
  output: Schema.String,
})
export type Output = typeof Output.Type

const sessions = serviceUse(SessionV2.Service)

const truncate = (value: string) =>
  value.length <= MAX_OUTPUT_CHARACTERS
    ? value
    : `${value.slice(0, MAX_OUTPUT_CHARACTERS)}\n\n[output truncated at ${MAX_OUTPUT_CHARACTERS} characters]`

const extractReport = (messages: readonly SessionMessage.Message[]): string => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message.type !== "assistant") continue
    const text = message.content
      .filter((part) => part.type === "text")
      .map((part) => (part as { text: string }).text)
      .join("\n")
      .trim()
    if (text) return text
  }
  return "(sub-agent produced no reportable text)"
}

/**
 * Drives a child Session: admit a prompt, join its execution to completion, and
 * read back its final assistant text. Runs on the ambient environment, which at
 * runtime is the Location layer built atop the app's global SessionV2.Service.
 */
const runSubagent = (
  input: {
    readonly prompt: string
    readonly description: string
    readonly agent: AgentV2.ID
    readonly timeout: number
  },
) =>
  Effect.gen(function* () {
    const location = yield* Location.Service
    const child = yield* sessions.create({
      agent: input.agent,
      location: { directory: location.directory, workspaceID: location.workspaceID },
    })
    yield* sessions.prompt({
      sessionID: child.id,
      prompt: { text: input.prompt },
      delivery: "queue",
    })
    yield* sessions.resume(child.id).pipe(
      Effect.timeoutOrElse({
        duration: Duration.seconds(input.timeout),
        orElse: () =>
          Effect.gen(function* () {
            yield* sessions.interrupt(child.id)
            return yield* new ToolFailure({ message: `Sub-agent timed out after ${input.timeout}s` })
          }),
      }),
    )
    const messages = yield* sessions.messages({
      sessionID: child.id,
      order: "desc",
      limit: 50,
    })
    return {
      operation: "task" as const,
      sessionID: child.id,
      description: input.description,
      output: truncate(extractReport(messages)),
    }
  })

const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const tools = yield* Tools.Service
    const permission = yield* PermissionV2.Service

    yield* tools
      .register({
        [name]: Tool.make({
          description,
          input: Input,
          output: Output,
          toModelOutput: ({ output }) => [{ type: "text", text: output.output }],
          execute: (input, context) =>
            Effect.gen(function* () {
              if (input.prompt.length > MAX_PROMPT_CHARACTERS)
                return yield* new ToolFailure({
                  message: `Prompt exceeds ${MAX_PROMPT_CHARACTERS} characters (got ${input.prompt.length})`,
                })
              yield* permission.assert({
                action: name,
                resources: [input.description],
                save: ["*"],
                metadata: input,
                sessionID: context.sessionID,
                agent: context.agent,
                source: { type: "tool", messageID: context.assistantMessageID, callID: context.toolCallID },
              })
              // serviceUse resolves SessionV2.Service from the ambient environment
              // at runtime; the static requirement is discharged here because the
              // tool settle fiber carries the full Location + global environment.
              return yield* runSubagent({
                prompt: input.prompt,
                description: input.description,
                agent: context.agent,
                timeout: input.timeout ?? DEFAULT_TIMEOUT_SECONDS,
              })
            }).pipe(
              Effect.mapError(
                (error) =>
                  new ToolFailure({
                    message: error instanceof ToolFailure ? error.message : `Sub-agent failed: ${String(error)}`,
                  }),
              ),
            ) as unknown as Effect.Effect<Output, ToolFailure>,
        }),
      })
      .pipe(Effect.orDie)
  }),
)

export const node = makeLocationNode({
  name: "tool/task",
  layer,
  deps: [ToolRegistry.node, PermissionV2.node, Location.node],
})
