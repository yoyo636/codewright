export * as TTSTool from "./tts"

import { ToolFailure } from "@codewright-ai/llm"
import { Context, Duration, Effect, Layer, Schema } from "effect"
import { HttpClient, HttpClientRequest } from "effect/unstable/http"
import { makeLocationNode } from "../effect/app-node"
import { LayerNodePlatform } from "../effect/app-node-platform"
import { FileMutation } from "../file-mutation"
import { LocationMutation } from "../location-mutation"
import { PermissionV2 } from "../permission"
import { collectBoundedResponseBody } from "./http-body"
import { ToolRegistry } from "./registry"
import { Tool } from "./tool"
import { Tools } from "./tools"

export const name = "tts"
export const MAX_TEXT_CHARACTERS = 4096
export const MAX_RESPONSE_BYTES = 64 * 1024 * 1024
export const REQUEST_TIMEOUT_SECONDS = 120

export const description = `Generate spoken audio from text (text-to-speech) and save it as an audio file in the workspace.

Requires the OPENAI_API_KEY environment variable. Set CODEWRIGHT_TTS_BASE_URL or CODEWRIGHT_TTS_MODEL to override the endpoint (defaults: https://api.openai.com/v1 and gpt-4o-mini-tts).`

export interface Config {
  readonly apiKey?: string
  readonly baseUrl: string
  readonly model: string
}

export class ConfigService extends Context.Service<ConfigService, Config>()("@codewright/v2/TTSConfig") {}

export const defaultConfigLayer = Layer.sync(ConfigService, () =>
  ConfigService.of({
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: process.env.CODEWRIGHT_TTS_BASE_URL ?? "https://api.openai.com/v1",
    model: process.env.CODEWRIGHT_TTS_MODEL ?? "gpt-4o-mini-tts",
  }),
)

export const configNode = makeLocationNode({ service: ConfigService, layer: defaultConfigLayer, deps: [] })

const Voices = Schema.Literals([
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "onyx",
  "nova",
  "sage",
  "shimmer",
])
const Formats = Schema.Literals(["mp3", "opus", "aac", "flac", "wav", "pcm"])

const MIMES: Record<string, string> = {
  mp3: "audio/mpeg",
  opus: "audio/ogg",
  aac: "audio/aac",
  flac: "audio/flac",
  wav: "audio/wav",
  pcm: "audio/pcm",
}

export const Input = Schema.Struct({
  text: Schema.String.annotate({ description: "The text to convert to speech" }),
  path: Schema.optional(Schema.String).annotate({
    description:
      "Output file path. Relative paths resolve within the active Location. Defaults to generated/speech-<timestamp>.<format>.",
  }),
  voice: Voices.pipe(Schema.withDecodingDefault(Effect.succeed("alloy" as const))).annotate({
    description: "Voice for the speech (default: alloy)",
  }),
  format: Formats.pipe(Schema.withDecodingDefault(Effect.succeed("mp3" as const))).annotate({
    description: "Audio file format (default: mp3)",
  }),
})

const Output = Schema.Struct({
  operation: Schema.Literal("tts"),
  path: Schema.String,
  resource: Schema.String,
  mime: Schema.String,
  bytes: Schema.Number,
})

const defaultPath = (format: string) => {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-")
  return `generated/speech-${stamp}.${format}`
}

const statusMessage = (error: unknown) => {
  if (!error || typeof error !== "object" || !("reason" in error)) return undefined
  const reason = error.reason
  if (!reason || typeof reason !== "object" || !("_tag" in reason) || reason._tag !== "StatusCodeError") return undefined
  if (!("response" in reason)) return undefined
  const response = reason.response as { status: number }
  return `Speech generation request failed with status ${response.status}`
}

const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const tools = yield* Tools.Service
    const http = yield* HttpClient.HttpClient
    const config = yield* ConfigService
    const mutation = yield* LocationMutation.Service
    const files = yield* FileMutation.Service
    const permission = yield* PermissionV2.Service

    yield* tools
      .register({
        [name]: Tool.withPermission(
          Tool.make({
            description,
            input: Input,
            output: Output,
            toModelOutput: ({ output }) => [
              { type: "text", text: `Speech audio saved to ${output.resource} (${output.bytes} bytes)` },
            ],
            execute: (input, context) =>
              Effect.gen(function* () {
                if (!config.apiKey)
                  return yield* new ToolFailure({ message: "Speech generation requires the OPENAI_API_KEY environment variable" })
                if (input.text.length > MAX_TEXT_CHARACTERS)
                  return yield* new ToolFailure({
                    message: `Text exceeds ${MAX_TEXT_CHARACTERS} characters (got ${input.text.length})`,
                  })

                const source = {
                  type: "tool" as const,
                  messageID: context.assistantMessageID,
                  callID: context.toolCallID,
                }
                const outputPath = input.path ?? defaultPath(input.format)
                const target = yield* mutation.resolve({ path: outputPath, kind: "file" })
                const external = target.externalDirectory
                if (external)
                  yield* permission.assert({
                    ...LocationMutation.externalDirectoryPermission(external),
                    sessionID: context.sessionID,
                    agent: context.agent,
                    source,
                  })
                yield* permission.assert({
                  action: "edit",
                  resources: [target.resource],
                  save: ["*"],
                  sessionID: context.sessionID,
                  agent: context.agent,
                  source,
                })

                const request = yield* HttpClientRequest.post(`${config.baseUrl}/audio/speech`).pipe(
                  HttpClientRequest.bearerToken(config.apiKey),
                  HttpClientRequest.schemaBodyJson(Schema.Struct({
                    model: Schema.String,
                    input: Schema.String,
                    voice: Schema.String,
                    response_format: Schema.String,
                  }))({
                    model: config.model,
                    input: input.text,
                    voice: input.voice,
                    response_format: input.format,
                  }),
                )
                const audio = yield* Effect.gen(function* () {
                  const response = yield* HttpClient.filterStatusOk(http).execute(request)
                  return yield* collectBoundedResponseBody(
                    response,
                    MAX_RESPONSE_BYTES,
                    () => new Error(`Speech generation response exceeded ${MAX_RESPONSE_BYTES} bytes`),
                  )
                }).pipe(
                  Effect.mapError((error) => statusMessage(error) ?? "Speech generation request failed"),
                  Effect.timeoutOrElse({
                    duration: Duration.seconds(REQUEST_TIMEOUT_SECONDS),
                    orElse: () => Effect.fail("Speech generation request timed out"),
                  }),
                )

                yield* files.write({ target, content: audio })
                return {
                  operation: "tts" as const,
                  path: target.canonical,
                  resource: target.resource,
                  mime: MIMES[input.format] ?? "audio/mpeg",
                  bytes: audio.byteLength,
                }
              }).pipe(
                Effect.mapError(
                  (error) =>
                    new ToolFailure({
                      message:
                        error instanceof ToolFailure
                          ? error.message
                          : typeof error === "string"
                            ? `Unable to generate speech: ${error}`
                            : "Unable to generate speech",
                    }),
                ),
              ),
          }),
          "edit",
        ),
      })
      .pipe(Effect.orDie)
  }),
)

export const node = makeLocationNode({
  name: "tool/tts",
  layer,
  deps: [ToolRegistry.node, LocationMutation.node, FileMutation.node, PermissionV2.node, LayerNodePlatform.httpClient, configNode],
})
