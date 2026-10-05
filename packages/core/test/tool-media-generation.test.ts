import fs from "fs/promises"
import path from "path"
import { describe, expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import { HttpClient, HttpClientResponse } from "effect/unstable/http"
import { FileMutation } from "@codewright-ai/core/file-mutation"
import { AppNodeBuilder } from "@codewright-ai/core/effect/app-node-builder"
import { LayerNode } from "@codewright-ai/core/effect/layer-node"
import { LayerNodePlatform } from "@codewright-ai/core/effect/app-node-platform"
import { FSUtil } from "@codewright-ai/core/fs-util"
import { Location } from "@codewright-ai/core/location"
import { LocationMutation } from "@codewright-ai/core/location-mutation"
import { PermissionV2 } from "@codewright-ai/core/permission"
import { AbsolutePath } from "@codewright-ai/core/schema"
import { SessionV2 } from "@codewright-ai/core/session"
import { ImageGenTool } from "@codewright-ai/core/tool/imagegen"
import { ToolRegistry } from "@codewright-ai/core/tool/registry"
import { TTSTool } from "@codewright-ai/core/tool/tts"
import { ToolOutputStore } from "@codewright-ai/core/tool-output-store"
import { location } from "./fixture/location"
import { tmpdir } from "./fixture/tmpdir"
import { testEffect } from "./lib/effect"
import { toolIdentity, executeTool, settleTool, toolDefinitions } from "./lib/tool"

const sessionID = SessionV2.ID.make("ses_media_generation_test")
const assertions: PermissionV2.AssertInput[] = []

interface Request {
  readonly url: string
  readonly headers: Record<string, string>
  readonly body: unknown
}

const requests: Request[] = []

let imageConfig: ImageGenTool.Config = { apiKey: "test-key", baseUrl: "https://api.openai.test/v1", model: "gpt-image-1" }
let ttsConfig: TTSTool.Config = { apiKey: "test-key", baseUrl: "https://api.openai.test/v1", model: "gpt-4o-mini-tts" }
let makeResponse = () => new Response("{}", { status: 200 })

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

const http = Layer.succeed(
  HttpClient.HttpClient,
  HttpClient.make((request) =>
    Effect.sync(() => {
      if (request.body._tag !== "Uint8Array") throw new Error(`Unexpected request body: ${request.body._tag}`)
      requests.push({
        url: request.url,
        headers: request.headers,
        body: JSON.parse(new TextDecoder().decode(request.body.body)),
      })
      return HttpClientResponse.fromWeb(request, makeResponse())
    }),
  ),
)

const imageConfigLayer = Layer.succeed(
  ImageGenTool.ConfigService,
  ImageGenTool.ConfigService.of({
    get apiKey() {
      return imageConfig.apiKey
    },
    get baseUrl() {
      return imageConfig.baseUrl
    },
    get model() {
      return imageConfig.model
    },
  }),
)
const ttsConfigLayer = Layer.succeed(
  TTSTool.ConfigService,
  TTSTool.ConfigService.of({
    get apiKey() {
      return ttsConfig.apiKey
    },
    get baseUrl() {
      return ttsConfig.baseUrl
    },
    get model() {
      return ttsConfig.model
    },
  }),
)

const withTools = <A, E, R>(directory: string, body: (registry: ToolRegistry.Interface) => Effect.Effect<A, E, R>) => {
  const activeLocation = Layer.succeed(
    Location.Service,
    Location.Service.of(location({ directory: AbsolutePath.make(directory) })),
  )
  return Effect.gen(function* () {
    return yield* body(yield* ToolRegistry.Service)
  }).pipe(
    Effect.provide(
      AppNodeBuilder.build(
        LayerNode.group([
          ToolRegistry.node,
          ToolRegistry.toolsNode,
          LocationMutation.node,
          FileMutation.node,
          ImageGenTool.node,
          TTSTool.node,
        ]),
        [
          [Location.node, activeLocation],
          [PermissionV2.node, permission],
          [LayerNodePlatform.httpClient, http],
          [ImageGenTool.configNode, imageConfigLayer],
          [TTSTool.configNode, ttsConfigLayer],
          [ToolOutputStore.node, ToolOutputStore.nodeWithoutConfig],
        ],
      ),
    ),
  )
}

const reset = () => {
  assertions.length = 0
  requests.length = 0
  imageConfig = { apiKey: "test-key", baseUrl: "https://api.openai.test/v1", model: "gpt-image-1" }
  ttsConfig = { apiKey: "test-key", baseUrl: "https://api.openai.test/v1", model: "gpt-4o-mini-tts" }
  makeResponse = () => new Response("{}", { status: 200 })
}

const imageCall = (input: Record<string, unknown>, id = "call-imagegen") => ({
  sessionID,
  ...toolIdentity,
  call: { type: "tool-call" as const, id, name: "imagegen", input },
})
const ttsCall = (input: Record<string, unknown>, id = "call-tts") => ({
  sessionID,
  ...toolIdentity,
  call: { type: "tool-call" as const, id, name: "tts", input },
})

const it = testEffect(Layer.empty)

const PNG_BYTES = Buffer.from("generated-image-bytes")

describe("ImageGenTool", () => {
  it.live("registers imagegen and tts, generates an image, and saves it as media", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => {
        reset()
        makeResponse = () =>
          new Response(JSON.stringify({ data: [{ b64_json: PNG_BYTES.toString("base64") }] }), { status: 200 })
        return withTools(tmp.path, (registry) =>
          Effect.gen(function* () {
            expect((yield* toolDefinitions(registry)).map((tool) => tool.name).sort()).toEqual(["imagegen", "tts"])
            const settled = yield* settleTool(
              registry,
              imageCall({ prompt: "a red fox in snow", path: "art/fox.png", size: "1024x1024", quality: "high" }),
            )
            expect(settled.result).toEqual({
              type: "content",
              value: [
                { type: "text", text: "Generated image saved to art/fox.png" },
                {
                  type: "file",
                  uri: `data:image/png;base64,${PNG_BYTES.toString("base64")}`,
                  mime: "image/png",
                  name: path.join(tmp.path, "art", "fox.png"),
                },
              ],
            })
            expect(settled.output?.structured).toMatchObject({
              operation: "imagegen",
              resource: "art/fox.png",
              mime: "image/png",
            })
            expect(settled.output?.content).toEqual([
              { type: "text", text: "Generated image saved to art/fox.png" },
              { type: "file", uri: `data:image/png;base64,${PNG_BYTES.toString("base64")}`, mime: "image/png", name: path.join(tmp.path, "art", "fox.png") },
            ])
            expect(
              Buffer.compare(
                yield* Effect.promise(() => fs.readFile(path.join(tmp.path, "art", "fox.png"))),
                PNG_BYTES,
              ),
            ).toBe(0)
            expect(assertions).toMatchObject([
              { sessionID, action: "edit", resources: ["art/fox.png"], save: ["*"] },
            ])
            expect(requests).toEqual([
              {
                url: "https://api.openai.test/v1/images/generations",
                headers: expect.objectContaining({ authorization: "Bearer test-key" }),
                body: {
                  model: "gpt-image-1",
                  prompt: "a red fox in snow",
                  size: "1024x1024",
                  quality: "high",
                  output_format: "png",
                  n: 1,
                },
              },
            ])
          }),
        )
      },
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )

  it.live("defaults the output path into generated/ with a prompt slug", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => {
        reset()
        makeResponse = () =>
          new Response(JSON.stringify({ data: [{ b64_json: PNG_BYTES.toString("base64") }] }), { status: 200 })
        return withTools(tmp.path, (registry) =>
          Effect.gen(function* () {
            const settled = yield* settleTool(registry, imageCall({ prompt: "Blue Circuit Board!" }))
            expect(settled.output?.structured).toMatchObject({
              resource: expect.stringMatching(/^generated\/image-\d{8}-\d{6}-blue-circuit-board\.png$/) as RegExp,
            })
            expect(yield* Effect.promise(() => fs.readdir(path.join(tmp.path, "generated")))).toHaveLength(1)
          }),
        )
      },
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )

  it.live("fails with a clear message when the API key is missing", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => {
        reset()
        imageConfig = { apiKey: undefined, baseUrl: "https://api.openai.test/v1", model: "gpt-image-1" }
        return withTools(tmp.path, (registry) =>
          Effect.gen(function* () {
            expect(
              yield* executeTool(registry, imageCall({ prompt: "a cat" })),
            ).toEqual({
              type: "error",
              value: "Image generation requires the OPENAI_API_KEY environment variable",
            })
            expect(requests).toEqual([])
          }),
        )
      },
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )

  it.live("maps provider errors without leaking credentials", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => {
        reset()
        makeResponse = () => new Response(JSON.stringify({ error: { message: "content policy" } }), { status: 400 })
        return withTools(tmp.path, (registry) =>
          Effect.gen(function* () {
            expect(
              yield* executeTool(registry, imageCall({ prompt: "a cat", path: "art/blocked.png" })),
            ).toEqual({
              type: "error",
              value: "Unable to generate image: Image generation request failed with status 400",
            })
            expect(yield* Effect.promise(() => fs.readdir(path.join(tmp.path, "art")).catch(() => []))).toEqual([])
          }),
        )
      },
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )
})

describe("TTSTool", () => {
  it.live("generates speech audio and saves it to disk", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => {
        reset()
        const audio = Buffer.from("fake-mp3-audio")
        makeResponse = () => new Response(audio, { status: 200 })
        return withTools(tmp.path, (registry) =>
          Effect.gen(function* () {
            const settled = yield* settleTool(
              registry,
              ttsCall({ text: "Hello from codewright", path: "audio/hello.mp3", voice: "nova" }),
            )
            expect(settled.result).toEqual({
              type: "text",
              value: "Speech audio saved to audio/hello.mp3 (14 bytes)",
            })
            expect(settled.output?.structured).toMatchObject({
              operation: "tts",
              resource: "audio/hello.mp3",
              mime: "audio/mpeg",
              bytes: 14,
            })
            expect(
              Buffer.compare(
                yield* Effect.promise(() => fs.readFile(path.join(tmp.path, "audio", "hello.mp3"))),
                audio,
              ),
            ).toBe(0)
            expect(assertions).toMatchObject([
              { sessionID, action: "edit", resources: ["audio/hello.mp3"], save: ["*"] },
            ])
            expect(requests).toEqual([
              {
                url: "https://api.openai.test/v1/audio/speech",
                headers: expect.objectContaining({ authorization: "Bearer test-key" }),
                body: {
                  model: "gpt-4o-mini-tts",
                  input: "Hello from codewright",
                  voice: "nova",
                  response_format: "mp3",
                },
              },
            ])
          }),
        )
      },
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )

  it.live("fails when the API key is missing or the text is too long", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => {
        reset()
        ttsConfig = { apiKey: undefined, baseUrl: "https://api.openai.test/v1", model: "gpt-4o-mini-tts" }
        return withTools(tmp.path, (registry) =>
          Effect.gen(function* () {
            expect(
              yield* executeTool(registry, ttsCall({ text: "hello" })),
            ).toEqual({
              type: "error",
              value: "Speech generation requires the OPENAI_API_KEY environment variable",
            })
            reset()
            expect(
              yield* executeTool(registry, ttsCall({ text: "x".repeat(TTSTool.MAX_TEXT_CHARACTERS + 1) })),
            ).toEqual({
              type: "error",
              value: `Text exceeds ${TTSTool.MAX_TEXT_CHARACTERS} characters (got ${TTSTool.MAX_TEXT_CHARACTERS + 1})`,
            })
            expect(requests).toEqual([])
          }),
        )
      },
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )
})

test("imagegen prompt length guard stays within the API limit", () => {
  expect(ImageGenTool.MAX_PROMPT_CHARACTERS).toBeLessThanOrEqual(4000)
  expect(TTSTool.MAX_TEXT_CHARACTERS).toBeLessThanOrEqual(4096)
})
