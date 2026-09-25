import { Config, ConfigProvider, Context, Effect, Layer, Option } from "effect"
import { ConfigService } from "@/effect/config-service"

const bool = (name: string) => Config.boolean(name).pipe(Config.withDefault(false))
const positiveInteger = (name: string) =>
  Config.number(name).pipe(
    Config.map((value) => (Number.isInteger(value) && value > 0 ? value : undefined)),
    Config.orElse(() => Config.succeed(undefined)),
  )
const experimental = bool("CODEWRIGHT_EXPERIMENTAL")
const enabledByExperimental = (name: string) =>
  Config.all({ experimental, enabled: Config.boolean(name).pipe(Config.option) }).pipe(
    Config.map((flags) => Option.getOrElse(flags.enabled, () => flags.experimental)),
  )

export class Service extends ConfigService.Service<Service>()("@codewright/RuntimeFlags", {
  autoShare: bool("CODEWRIGHT_AUTO_SHARE"),
  pure: bool("CODEWRIGHT_PURE"),
  disableDefaultPlugins: bool("CODEWRIGHT_DISABLE_DEFAULT_PLUGINS"),
  disableEmbeddedWebUi: bool("CODEWRIGHT_DISABLE_EMBEDDED_WEB_UI"),
  disableExternalSkills: bool("CODEWRIGHT_DISABLE_EXTERNAL_SKILLS"),
  disableLspDownload: bool("CODEWRIGHT_DISABLE_LSP_DOWNLOAD"),
  disableClaudeCodePrompt: Config.all({
    broad: bool("CODEWRIGHT_DISABLE_CLAUDE_CODE"),
    direct: bool("CODEWRIGHT_DISABLE_CLAUDE_CODE_PROMPT"),
  }).pipe(Config.map((flags) => flags.broad || flags.direct)),
  disableClaudeCodeSkills: Config.all({
    broad: bool("CODEWRIGHT_DISABLE_CLAUDE_CODE"),
    direct: bool("CODEWRIGHT_DISABLE_CLAUDE_CODE_SKILLS"),
  }).pipe(Config.map((flags) => flags.broad || flags.direct)),
  enableExa: Config.all({
    experimental,
    enabled: bool("CODEWRIGHT_ENABLE_EXA"),
    legacy: bool("CODEWRIGHT_EXPERIMENTAL_EXA"),
  }).pipe(Config.map((flags) => flags.experimental || flags.enabled || flags.legacy)),
  enableParallel: Config.all({
    enabled: bool("CODEWRIGHT_ENABLE_PARALLEL"),
    legacy: bool("CODEWRIGHT_EXPERIMENTAL_PARALLEL"),
  }).pipe(Config.map((flags) => flags.enabled || flags.legacy)),
  enableExperimentalModels: bool("CODEWRIGHT_ENABLE_EXPERIMENTAL_MODELS"),
  enableQuestionTool: bool("CODEWRIGHT_ENABLE_QUESTION_TOOL"),
  experimentalReferences: enabledByExperimental("CODEWRIGHT_EXPERIMENTAL_REFERENCES"),
  experimentalBackgroundSubagents: enabledByExperimental("CODEWRIGHT_EXPERIMENTAL_BACKGROUND_SUBAGENTS"),
  experimentalLspTy: bool("CODEWRIGHT_EXPERIMENTAL_LSP_TY"),
  experimentalLspTool: enabledByExperimental("CODEWRIGHT_EXPERIMENTAL_LSP_TOOL"),
  experimentalOxfmt: enabledByExperimental("CODEWRIGHT_EXPERIMENTAL_OXFMT"),
  experimentalPlanMode: enabledByExperimental("CODEWRIGHT_EXPERIMENTAL_PLAN_MODE"),
  experimentalCodeMode: enabledByExperimental("CODEWRIGHT_EXPERIMENTAL_CODE_MODE"),
  experimentalEventSystem: enabledByExperimental("CODEWRIGHT_EXPERIMENTAL_EVENT_SYSTEM"),
  experimentalWorkspaces: enabledByExperimental("CODEWRIGHT_EXPERIMENTAL_WORKSPACES"),
  experimentalIconDiscovery: enabledByExperimental("CODEWRIGHT_EXPERIMENTAL_ICON_DISCOVERY"),
  outputTokenMax: positiveInteger("CODEWRIGHT_EXPERIMENTAL_OUTPUT_TOKEN_MAX"),
  bashDefaultTimeoutMs: positiveInteger("CODEWRIGHT_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS"),
  experimentalNativeLlm: bool("CODEWRIGHT_EXPERIMENTAL_NATIVE_LLM"),
  experimentalWebSockets: bool("CODEWRIGHT_EXPERIMENTAL_WEBSOCKETS"),
  client: Config.string("CODEWRIGHT_CLIENT").pipe(Config.withDefault("cli")),
}) {}

export type Info = Context.Service.Shape<typeof Service>

const emptyConfigLayer = Service.layer.pipe(
  Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({}))),
  Layer.orDie,
)

export const layer = (overrides: Partial<Info> = {}) =>
  Layer.effect(
    Service,
    Effect.gen(function* () {
      const flags = yield* Service
      return Service.of({ ...flags, ...overrides })
    }),
  ).pipe(Layer.provide(emptyConfigLayer))

export const node = LayerNode.make({ service: Service, layer: Service.layer.pipe(Layer.orDie), deps: [] })

export * as RuntimeFlags from "./runtime-flags"
import { LayerNode } from "@codewright-ai/core/effect/layer-node"
