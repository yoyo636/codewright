export * as ImageGenTool from "./imagegen"

import { ToolFailure } from "@codewright-ai/llm"
import { Context, Duration, Effect, Layer, Schema } from "effect"
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http"
import { makeLocationNode } from "../effect/app-node"
import { LayerNodePlatform } from "../effect/app-node-platform"
import { FileMutation } from "../file-mutation"
import { LocationMutation } from "../location-mutation"
import { PermissionV2 } from "../permission"
import { collectBoundedResponseBody } from "./http-body"
import { ToolRegistry } from "./registry"
import { Tool } from "./tool"
import { Tools } from "./tools"

export const name = "imagegen"
export const MAX_PROMPT_CHARACTERS = 4000
export const MAX_RESPONSE_BYTES = 32 * 1024 * 1024
export const REQUEST_TIMEOUT_SECONDS = 120

export const description = `Generate an image from a text prompt and save it as an image file in the workspace.

Requires the OPENAI_API_KEY environment variable. Set CODEWRIGHT_IMAGEGEN_BASE_URL or CODEWRIGHT_IMAGEGEN_MODEL to override the endpoint (defaults: https://api.openai.com/v1 and gpt-image-1).`

export interface Config {
  readonly apiKey?: string
  readonly baseUrl: string
  readonly model: string
}

export class ConfigService extends Context.Service<ConfigService, Config>()("@codewright/v2/ImageGenConfig") {}

export const defaultConfigLayer = Layer.sync(ConfigService, () =>
  ConfigService.of({
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: process.env.CODEWRIGHT_IMAGEGEN_BASE_URL ?? "https://api.openai.com/v1",
    model: process.env.CODEWRIGHT_IMAGEGEN_MODEL ?? "gpt-image-1",
  }),
)

export const configNode = makeLocationNode({ service: ConfigService, layer: defaultConfigLayer, deps: [] })

const Sizes = Schema.Literals(["1024x1024", "1024x1536", "1536x1024", "auto"])
const Qualities = Schema.Literals(["low", "medium", "high", "auto"])
const Formats = Schema.Literals(["png", "jpeg", "webp"])

const MIMES: Record<string, string> = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" }

export const Input = Schema.Struct({
  prompt: Schema.String.annotate({ description: "Description of the image to generate" }),
  path: Schema.optional(Schema.String).annotate({
    description:
      "Output file path. Relative paths resolve within the active Location. Defaults to generated/<timestamp>-<slug>.<format>.",
  }),
  size: Schema.optional(Sizes).annotate({ description: "Image dimensions (default: auto)" }),
  quality: Schema.optional(Qualities).annotate({ description: "Rendering quality (default: auto)" }),
  outputFormat: Formats.pipe(Schema.withDecodingDefault(Effect.succeed("png" as const))).annotate({
    description: "File format: png, jpeg or webp (default: png)",
  }),
})

const Output = Schema.Struct({
  operation: Schema.Literal("imagegen"),
  path: Schema.String,
  resource: Schema.String,
  mime: Schema.String,
  data: Schema.String,
})

const slug = (prompt: string) =>
  prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "image"

const defaultPath = (prompt: string, format: string) => {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-")
  return `generated/image-${stamp}-${slug(prompt)}.${format}`
}

const ApiResult = Schema.Struct({
  data: Schema.Array(Schema.Struct({ b64_json: Schema.optional(Schema.String), url: Schema.optional(Schema.String) })),
})

const statusMessage = (error: unknown) => {
  if (!error || typeof error !== "object" || !("reason" in error)) return undefined
  const reason = error.reason
  if (!reason || typeof reason !== "object" || !("_tag" in reason) || reason._tag !== "StatusCodeError") return undefined
  if (!("response" in reason)) return undefined
  const response = reason.response as HttpClientResponse.HttpClientResponse
  return `Image generation request failed with status ${response.status}`
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
              { type: "text", text: `Generated image saved to ${output.resource}` },
              { type: "file", data: output.data, mime: output.mime, name: output.path },
            ],
            execute: (input, context) =>
              Effect.gen(function* () {
                if (!config.apiKey)
                  return yield* new ToolFailure({ message: "Image generation requires the OPENAI_API_KEY environment variable" })
                if (input.prompt.length > MAX_PROMPT_CHARACTERS)
                  return yield* new ToolFailure({
                    message: `Prompt exceeds ${MAX_PROMPT_CHARACTERS} characters (got ${input.prompt.length})`,
                  })

                const source = {
                  type: "tool" as const,
                  messageID: context.assistantMessageID,
                  callID: context.toolCallID,
                }
                const outputPath = input.path ?? defaultPath(input.prompt, input.outputFormat)
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

                const request = yield* HttpClientRequest.post(`${config.baseUrl}/images/generations`).pipe(
                  HttpClientRequest.bearerToken(config.apiKey),
                  HttpClientRequest.schemaBodyJson(Schema.Struct({
                    model: Schema.String,
                    prompt: Schema.String,
                    size: Schema.optional(Schema.String),
                    quality: Schema.optional(Schema.String),
                    output_format: Schema.optional(Schema.String),
                    n: Schema.Literal(1),
                  }))({
                    model: config.model,
                    prompt: input.prompt,
                    size: input.size,
                    quality: input.quality,
                    output_format: input.outputFormat,
                    n: 1 as const,
                  }),
                )
                const body = yield* Effect.gen(function* () {
                  const response = yield* HttpClient.filterStatusOk(http).execute(request)
                  return yield* collectBoundedResponseBody(
                    response,
                    MAX_RESPONSE_BYTES,
                    () => new Error(`Image generation response exceeded ${MAX_RESPONSE_BYTES} bytes`),
                  )
                }).pipe(
                  Effect.mapError((error) => statusMessage(error) ?? "Image generation request failed"),
                  Effect.timeoutOrElse({
                    duration: Duration.seconds(REQUEST_TIMEOUT_SECONDS),
                    orElse: () => Effect.fail("Image generation request timed out"),
                  }),
                )

                const result = yield* Schema.decodeUnknownEffect(ApiResult)(JSON.parse(body.toString("utf8"))).pipe(
                  Effect.mapError(() => "Image generation returned an unexpected response"),
                )
                const base64 = result.data[0]?.b64_json
                if (!base64)
                  return yield* new ToolFailure({
                    message: "Image generation returned no image data (URL-based responses are unsupported)",
                  })

                yield* files.write({ target, content: Buffer.from(base64, "base64") })
                return {
                  operation: "imagegen" as const,
                  path: target.canonical,
                  resource: target.resource,
                  mime: MIMES[input.outputFormat] ?? "image/png",
                  data: base64,
                }
              }).pipe(
                Effect.mapError(
                  (error) =>
                    new ToolFailure({
                      message:
                        error instanceof ToolFailure
                          ? error.message
                          : typeof error === "string"
                            ? `Unable to generate image: ${error}`
                            : "Unable to generate image",
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
  name: "tool/imagegen",
  layer,
  deps: [ToolRegistry.node, LocationMutation.node, FileMutation.node, PermissionV2.node, LayerNodePlatform.httpClient, configNode],
})
