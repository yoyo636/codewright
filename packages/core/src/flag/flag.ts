import { Config } from "effect"

export function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

const copy = process.env["CODEWRIGHT_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"]
const fff = process.env["CODEWRIGHT_DISABLE_FFF"]

function enabledByExperimental(key: string) {
  return process.env[key] === undefined ? truthy("CODEWRIGHT_EXPERIMENTAL") : truthy(key)
}

// Session kernel selection. V1 is the legacy prompt loop (packages/codewright);
// V2 is the core session runner (packages/core). The RUN path is permanently V2
// and the per-path keys are retained only as escape hatches: ACP and TUI still
// fall back to V1 until their consumers are migrated. The V1 kernel surface is
// marked @deprecated in the mean time; deletion is gated on the legacy server
// and the ACP/TUI consumers moving to V2.
function sessionV2(scope?: "RUN" | "ACP" | "TUI") {
  const scoped = scope ? process.env[`CODEWRIGHT_SESSION_V2_${scope}`] : undefined
  const value = scoped ?? process.env["CODEWRIGHT_SESSION_V2"]
  if (value === undefined) return scope === "RUN" ? true : truthy("CODEWRIGHT_EXPERIMENTAL")
  return truthy(value)
}

export const Flag = {
  OTEL_EXPORTER_OTLP_ENDPOINT: process.env["OTEL_EXPORTER_OTLP_ENDPOINT"],
  OTEL_EXPORTER_OTLP_HEADERS: process.env["OTEL_EXPORTER_OTLP_HEADERS"],

  CODEWRIGHT_AUTO_HEAP_SNAPSHOT: truthy("CODEWRIGHT_AUTO_HEAP_SNAPSHOT"),
  CODEWRIGHT_GIT_BASH_PATH: process.env["CODEWRIGHT_GIT_BASH_PATH"],
  CODEWRIGHT_CONFIG: process.env["CODEWRIGHT_CONFIG"],
  CODEWRIGHT_CONFIG_CONTENT: process.env["CODEWRIGHT_CONFIG_CONTENT"],
  CODEWRIGHT_DISABLE_AUTOUPDATE: truthy("CODEWRIGHT_DISABLE_AUTOUPDATE"),
  CODEWRIGHT_ALWAYS_NOTIFY_UPDATE: truthy("CODEWRIGHT_ALWAYS_NOTIFY_UPDATE"),
  CODEWRIGHT_DISABLE_PRUNE: truthy("CODEWRIGHT_DISABLE_PRUNE"),
  CODEWRIGHT_DISABLE_TERMINAL_TITLE: truthy("CODEWRIGHT_DISABLE_TERMINAL_TITLE"),
  CODEWRIGHT_SHOW_TTFD: truthy("CODEWRIGHT_SHOW_TTFD"),
  CODEWRIGHT_DISABLE_AUTOCOMPACT: truthy("CODEWRIGHT_DISABLE_AUTOCOMPACT"),
  CODEWRIGHT_DISABLE_MODELS_FETCH: truthy("CODEWRIGHT_DISABLE_MODELS_FETCH"),
  CODEWRIGHT_DISABLE_MOUSE: truthy("CODEWRIGHT_DISABLE_MOUSE"),
  CODEWRIGHT_FAKE_VCS: process.env["CODEWRIGHT_FAKE_VCS"],
  CODEWRIGHT_SERVER_PASSWORD: process.env["CODEWRIGHT_SERVER_PASSWORD"],
  CODEWRIGHT_SERVER_USERNAME: process.env["CODEWRIGHT_SERVER_USERNAME"],
  CODEWRIGHT_DISABLE_FFF: fff === undefined ? process.platform === "win32" : truthy("CODEWRIGHT_DISABLE_FFF"),

  // Experimental
  CODEWRIGHT_EXPERIMENTAL_FILEWATCHER: Config.boolean("CODEWRIGHT_EXPERIMENTAL_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  CODEWRIGHT_EXPERIMENTAL_DISABLE_FILEWATCHER: Config.boolean("CODEWRIGHT_EXPERIMENTAL_DISABLE_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  CODEWRIGHT_EXPERIMENTAL_DISABLE_COPY_ON_SELECT:
    copy === undefined ? process.platform === "win32" : truthy("CODEWRIGHT_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"),
  CODEWRIGHT_MODELS_URL: process.env["CODEWRIGHT_MODELS_URL"],
  CODEWRIGHT_MODELS_PATH: process.env["CODEWRIGHT_MODELS_PATH"],
  CODEWRIGHT_DB: process.env["CODEWRIGHT_DB"],

  CODEWRIGHT_WORKSPACE_ID: process.env["CODEWRIGHT_WORKSPACE_ID"],
  CODEWRIGHT_EXPERIMENTAL_WORKSPACES: enabledByExperimental("CODEWRIGHT_EXPERIMENTAL_WORKSPACES"),

  // Session kernel selection: V1 legacy prompt loop vs V2 core session.
  get CODEWRIGHT_SESSION_V2() {
    return sessionV2()
  },
  get CODEWRIGHT_SESSION_V2_RUN() {
    return sessionV2("RUN")
  },
  get CODEWRIGHT_SESSION_V2_ACP() {
    return sessionV2("ACP")
  },
  get CODEWRIGHT_SESSION_V2_TUI() {
    return sessionV2("TUI")
  },

  // Evaluated at access time (not module load) because tests, the CLI, and
  // external tooling set these env vars at runtime.
  get CODEWRIGHT_DISABLE_PROJECT_CONFIG() {
    return truthy("CODEWRIGHT_DISABLE_PROJECT_CONFIG")
  },
  get CODEWRIGHT_EXPERIMENTAL_REFERENCES() {
    return enabledByExperimental("CODEWRIGHT_EXPERIMENTAL_REFERENCES")
  },
  get CODEWRIGHT_TUI_CONFIG() {
    return process.env["CODEWRIGHT_TUI_CONFIG"]
  },
  get CODEWRIGHT_CONFIG_DIR() {
    return process.env["CODEWRIGHT_CONFIG_DIR"]
  },
  get CODEWRIGHT_PURE() {
    return truthy("CODEWRIGHT_PURE")
  },
  get CODEWRIGHT_PERMISSION() {
    return process.env["CODEWRIGHT_PERMISSION"]
  },
  get CODEWRIGHT_PLUGIN_META_FILE() {
    return process.env["CODEWRIGHT_PLUGIN_META_FILE"]
  },
  get CODEWRIGHT_CLIENT() {
    return process.env["CODEWRIGHT_CLIENT"] ?? "cli"
  },

  // Approval-mode / safety overrides driven by the CLI `--auto` / `--yolo`
  // flags. Evaluated at access time so the CLI can set them before the agent
  // lazily loads config.
  get CODEWRIGHT_APPROVAL_MODE() {
    return process.env["CODEWRIGHT_APPROVAL_MODE"]
  },
  get CODEWRIGHT_SAFETY_DANGEROUS() {
    return process.env["CODEWRIGHT_SAFETY_DANGEROUS"]
  },
}
