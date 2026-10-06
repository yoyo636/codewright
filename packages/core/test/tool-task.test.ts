import { expect, test } from "bun:test"
import { Effect, Layer, Schema } from "effect"
import { AppNodeBuilder } from "@codewright-ai/core/effect/app-node-builder"
import { LayerNode } from "@codewright-ai/core/effect/layer-node"
import { Location } from "@codewright-ai/core/location"
import { LocationMutation } from "@codewright-ai/core/location-mutation"
import { PermissionV2 } from "@codewright-ai/core/permission"
import { AbsolutePath } from "@codewright-ai/core/schema"
import { SessionV2 } from "@codewright-ai/core/session"
import { SessionMessage } from "@codewright-ai/core/session/message"
import { AgentV2 } from "@codewright-ai/core/agent"
import { FileMutation } from "@codewright-ai/core/file-mutation"
import { ToolRegistry } from "@codewright-ai/core/tool/registry"
import { TaskTool } from "@codewright-ai/core/tool/task"
import { ToolOutputStore } from "@codewright-ai/core/tool-output-store"
import { location } from "./fixture/location"
import { tmpdir } from "./fixture/tmpdir"
import { testEffect } from "./lib/effect"
import { toolIdentity, executeTool, settleTool, toolDefinitions } from "./lib/tool"

const sessionID = SessionV2.ID.make("ses_task_tool_test")
const assertions: PermissionV2.AssertInput[] = []

type ChildMessage = { readonly sessionID: string; readonly prompt: string }
const createdSessions: ChildMessage[] = []
let childReport = "Found 3 files using the export: a.ts, b.ts, c.ts"
let childMessages: SessionMessage.Message[] = []

const permission = Layer.succeed(
  PermissionV2.Service,
  PermissionV2.Service.of({
    assert: (input) => Effect.sync(() => assertions.push(input)),
    ask: () => Effect.die("unused"),
    reply: () => Effect.die("unused"),
    get: () => Effect.die("unused"),
    forSession: () => Effect.die("unused"),
    list: () => Effect.die("unused"),
  }),
)

const sessionMock = {
  list: () => Effect.succeed([]),
  create: (input: { readonly location: Location.Ref; readonly agent?: AgentV2.ID }) =>
    Effect.sync(() => {
      const id = SessionV2.ID.make(`ses_child_${createdSessions.length + 1}`)
      return { id, location: input.location, agent: input.agent ?? AgentV2.ID.make("build") }
    }),
  get: () => Effect.die("unused"),
  messages: (input: { readonly sessionID: string }) =>
    Effect.succeed(childMessages.filter(() => input.sessionID.startsWith("ses_child"))),
  message: () => Effect.succeed(undefined),
  context: () => Effect.succeed([]),
  events: () => Effect.die("unused"),
  history: () => Effect.die("unused"),
  switchAgent: () => Effect.die("unused"),
  switchModel: () => Effect.die("unused"),
  prompt: (input: { readonly sessionID: string; readonly prompt: { readonly text: string } }) =>
    Effect.sync(() => {
      createdSessions.push({ sessionID: String(input.sessionID), prompt: input.prompt.text })
    }),
  shell: () => Effect.die("unused"),
  skill: () => Effect.die("unused"),
  compact: () => Effect.die("unused"),
  wait: () => Effect.die("unused"),
  active: Effect.succeed(new Set<string>()),
  resume: () => Effect.succeed(undefined),
  interrupt: () => Effect.void,
  revert: {
    stage: () => Effect.die("unused"),
    clear: () => Effect.die("unused"),
    commit: () => Effect.die("unused"),
  },
} as unknown as SessionV2.Interface

const sessionService = Layer.succeed(SessionV2.Service, SessionV2.Service.of(sessionMock))

const withTool = <A, E, R>(directory: string, body: (registry: ToolRegistry.Interface) => Effect.Effect<A, E, R>) => {
  const activeLocation = Layer.succeed(
    Location.Service,
    Location.Service.of(location({ directory: AbsolutePath.make(directory) })),
  )
  return Effect.gen(function* () {
    return yield* body(yield* ToolRegistry.Service)
  }).pipe(
    Effect.provide(
      AppNodeBuilder.build(
        LayerNode.group([ToolRegistry.node, ToolRegistry.toolsNode, LocationMutation.node, TaskTool.node]),
        [
          [Location.node, activeLocation],
          [PermissionV2.node, permission],
          [FileMutation.node, Layer.succeed(FileMutation.Service, FileMutation.Service.of({
            create: () => Effect.die("unused"),
            write: () => Effect.die("unused"),
            writeTextPreservingBom: () => Effect.die("unused"),
            writeIfUnchanged: () => Effect.die("unused"),
            remove: () => Effect.die("unused"),
          } as unknown as FileMutation.Interface))],
          [ToolOutputStore.node, ToolOutputStore.nodeWithoutConfig],
        ],
      ),
    ),
    // SessionV2.Service is resolved dynamically at runtime (serviceUse) and is
    // not a static dependency of the tool layer; provide it here for the test.
    Effect.provide(sessionService),
    Effect.provide(activeLocation),
  )
}

const reset = () => {
  assertions.length = 0
  createdSessions.length = 0
  childReport = "Found 3 files using the export: a.ts, b.ts, c.ts"
  childMessages = []
}

const assistantMessage = (text: string): SessionMessage.Message =>
  ({
    type: "assistant",
    id: SessionMessage.ID.create(),
    content: [{ type: "text", text }],
  }) as unknown as SessionMessage.Message

const it = testEffect(Layer.empty)

it.live("registers task, asserts permission, and returns the sub-agent report", () =>
  Effect.acquireRelease(
    Effect.promise(() => tmpdir()),
    (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
  ).pipe(
    Effect.flatMap((tmp) => {
      reset()
      childMessages = [assistantMessage("intermediate reasoning"), assistantMessage(childReport)]
      return withTool(tmp.path, (registry) =>
        Effect.gen(function* () {
          expect((yield* toolDefinitions(registry)).map((tool) => tool.name)).toEqual(["task"])
          const settled = yield* settleTool(registry, {
            sessionID,
            ...toolIdentity,
            call: {
              type: "tool-call",
              id: "call-task",
              name: "task",
              input: { description: "audit exports", prompt: "Find every file exporting `createSession`." },
            },
          })
          expect(settled.result).toEqual({ type: "text", value: childReport })
          expect(settled.output?.structured).toMatchObject({
            operation: "task",
            description: "audit exports",
            output: childReport,
          })
          expect(settled.output?.structured).toHaveProperty("sessionID")
          expect(createdSessions).toEqual([
            {
              sessionID: (settled.output?.structured as { sessionID: string }).sessionID,
              prompt: "Find every file exporting `createSession`.",
            },
          ])
          expect(assertions).toMatchObject([
            { sessionID, action: "task", resources: ["audit exports"], save: ["*"] },
          ])
        }),
      )
    }),
  ),
)

it.live("returns a fallback when the sub-agent produced no reportable text", () =>
  Effect.acquireRelease(
    Effect.promise(() => tmpdir()),
    (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
  ).pipe(
    Effect.flatMap((tmp) => {
      reset()
      childMessages = []
      return withTool(tmp.path, (registry) =>
        Effect.gen(function* () {
          const settled = yield* settleTool(registry, {
            sessionID,
            ...toolIdentity,
            call: {
              type: "tool-call",
              id: "call-task-empty",
              name: "task",
              input: { description: "empty run", prompt: "do nothing" },
            },
          })
          expect(settled.result).toEqual({ type: "text", value: "(sub-agent produced no reportable text)" })
        }),
      )
    }),
  ),
)

it.live("rejects oversized prompts", () =>
  Effect.acquireRelease(
    Effect.promise(() => tmpdir()),
    (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
  ).pipe(
    Effect.flatMap((tmp) => {
      reset()
      return withTool(tmp.path, (registry) =>
        Effect.gen(function* () {
          const result = yield* executeTool(registry, {
            sessionID,
            ...toolIdentity,
            call: {
              type: "tool-call",
              id: "call-task-oversize",
              name: "task",
              input: { description: "big", prompt: "x".repeat(TaskTool.MAX_PROMPT_CHARACTERS + 1) },
            },
          })
          expect(result).toEqual({
            type: "error",
            value: `Prompt exceeds ${TaskTool.MAX_PROMPT_CHARACTERS} characters (got ${TaskTool.MAX_PROMPT_CHARACTERS + 1})`,
          })
          expect(createdSessions).toEqual([])
        }),
      )
    }),
  ),
)

test("task timeout and output caps stay within sane bounds", () => {
  expect(TaskTool.DEFAULT_TIMEOUT_SECONDS).toBeLessThanOrEqual(TaskTool.MAX_TIMEOUT_SECONDS)
  expect(TaskTool.MAX_OUTPUT_CHARACTERS).toBeLessThanOrEqual(100_000)
  expect(Schema.decodeUnknownSync(TaskTool.Input)({ description: "x", prompt: "y", timeout: TaskTool.MAX_TIMEOUT_SECONDS }).timeout).toBe(
    TaskTool.MAX_TIMEOUT_SECONDS,
  )
  expect(() => Schema.decodeUnknownSync(TaskTool.Input)({ description: "x", prompt: "y", timeout: 0 })).toThrow()
  expect(() =>
    Schema.decodeUnknownSync(TaskTool.Input)({ description: "x", prompt: "y", timeout: TaskTool.MAX_TIMEOUT_SECONDS + 1 }),
  ).toThrow()
})

export {}
