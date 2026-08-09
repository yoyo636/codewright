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
