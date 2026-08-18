import { createMemo, createSignal, Match, onCleanup, onMount, Show, Switch } from "solid-js"
import type { AssistantMessage } from "@codewright-ai/sdk/v2"
import { useTheme } from "../../context/theme"
import { useSync } from "../../context/sync"
import { useDirectory } from "../../context/directory"
import { useConnected } from "../../component/use-connected"
import { createStore } from "solid-js/store"
import { useRoute } from "../../context/route"
import { readFileSync, existsSync } from "node:fs"

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
})

// Context usage thresholds (percentage of the model context window).
const CONTEXT_WARN_PCT = 60
const CONTEXT_DANGER_PCT = 80

function ModeIndicator() {
  const [mode, setMode] = createSignal<"normal" | "super">("normal")

  const readMode = () => {
    try {
      const xdgConfig = process.env.XDG_CONFIG_HOME || `${process.env.HOME}/.config`
      const file = `${xdgConfig}/codewright/mode`
      if (existsSync(file)) {
        const val = readFileSync(file, "utf8").trim()
        setMode(val === "super" ? "super" : "normal")
      } else {
        setMode("normal")
      }
    } catch {
      setMode("normal")
    }
  }

  onMount(() => {
    readMode()
    const interval = setInterval(readMode, 5000)
    onCleanup(() => clearInterval(interval))
  })

  return (
    <Show when={mode() === "super"}>
      <text fg="#ff6b35">
        <b>[SUPER]</b>
      </text>
    </Show>
  )
}

export function Footer() {
  const { theme } = useTheme()
  const sync = useSync()
  const route = useRoute()
  const mcp = createMemo(() => Object.values(sync.data.mcp).filter((x) => x.status === "connected").length)
  const mcpError = createMemo(() => Object.values(sync.data.mcp).some((x) => x.status === "failed"))
  const lsp = createMemo(() => Object.keys(sync.data.lsp))
  const permissions = createMemo(() => {
    if (route.data.type !== "session") return []
    return sync.data.permission[route.data.sessionID] ?? []
  })
  const directory = useDirectory()
  const connected = useConnected()

  const sessionID = createMemo(() => (route.data.type === "session" ? route.data.sessionID : null))
  const messages = createMemo(() => {
    const id = sessionID()
    return id ? (sync.data.message[id] ?? []) : []
  })
  const lastAssistant = createMemo(() =>
    messages().findLast((m): m is AssistantMessage => m.role === "assistant" && (m.tokens?.output ?? 0) > 0),
  )
  const provider = createMemo(() => {
    const msg = lastAssistant()
    if (!msg) return null
    return sync.data.provider.find((p) => p.id === msg.providerID)
  })
  const model = createMemo(() => {
    const p = provider()
    const msg = lastAssistant()
    if (!p || !msg) return null
    return p.models[msg.modelID]
  })
  const modelName = createMemo(() => model()?.name?.split("/").pop() ?? null)
  const contextPercent = createMemo(() => {
    const msg = lastAssistant()
    if (!msg) return null
    const contextTokens =
      (msg.tokens?.input ?? 0) + (msg.tokens?.cache?.read ?? 0) + (msg.tokens?.cache?.write ?? 0)
    const limit = model()?.limit?.context
    return limit ? Math.round((contextTokens / limit) * 100) : null
  })
  const contextState = createMemo(() => {
    const pct = contextPercent()
    if (pct === null) return null
    if (pct >= CONTEXT_DANGER_PCT) return "danger"
    if (pct >= CONTEXT_WARN_PCT) return "warn"
    return "ok"
  })
  const totalCost = createMemo(() =>
    messages()
      .filter((m): m is AssistantMessage => m.role === "assistant")
      .reduce((sum, m) => sum + (m.cost ?? 0), 0),
  )
  const gitBranch = createMemo(() => sync.data.vcs?.branch)

  const [store, setStore] = createStore({
    welcome: false,
  })

  onMount(() => {
    // Track all timeouts to ensure proper cleanup
    const timeouts: ReturnType<typeof setTimeout>[] = []

    function tick() {
      if (connected()) return
      if (!store.welcome) {
        setStore("welcome", true)
        timeouts.push(setTimeout(() => tick(), 5000))
        return
      }

      if (store.welcome) {
        setStore("welcome", false)
        timeouts.push(setTimeout(() => tick(), 10_000))
        return
      }
    }
    timeouts.push(setTimeout(() => tick(), 10_000))

    onCleanup(() => {
      timeouts.forEach(clearTimeout)
    })
  })

  return (
    <box
      flexDirection="row"
      justifyContent="space-between"
      gap={1}
      flexShrink={0}
      border={["top"]}
      borderColor={theme.borderSubtle}
      paddingTop={1}
    >
      <box gap={1} flexDirection="row" flexShrink={0} alignItems="center">
        <text fg={theme.textMuted}>{directory()}</text>
        <Show when={gitBranch()}>
          <text fg={theme.textMuted}>
            <span style={{ fg: theme.border }}>│</span>{" "}
            <span style={{ fg: theme.success }}>⎇</span> {gitBranch()}
          </text>
        </Show>
      </box>
      <box gap={2} flexDirection="row" flexShrink={0} alignItems="center">
        <Switch>
          <Match when={store.welcome}>
            <text fg={theme.text}>
              Get started <span style={{ fg: theme.textMuted }}>/connect</span>
            </text>
          </Match>
          <Match when={connected()}>
            <ModeIndicator />
            <Show when={modelName()}>
              <text fg={theme.text}>
                <span style={{ fg: theme.primary }}>◆</span> {modelName()}
              </text>
            </Show>
            <Show when={contextPercent() !== null}>
              <text
                fg={
                  contextState() === "danger"
                    ? theme.error
                    : contextState() === "warn"
                      ? theme.warning
                      : theme.textMuted
                }
              >
                ctx:{contextPercent()}%
              </text>
            </Show>
            <Show when={totalCost() > 0}>
              <text fg={theme.textMuted}>{money.format(totalCost())}</text>
            </Show>
            <Show when={permissions().length > 0}>
              <text fg={theme.warning}>
                <span style={{ fg: theme.warning }}>△</span> {permissions().length} Permission
                {permissions().length > 1 ? "s" : ""}
              </text>
            </Show>
            <Show when={lsp().length > 0}>
              <text fg={theme.textMuted}>
                <span style={{ fg: lsp().length > 0 ? theme.success : theme.textMuted }}>●</span> {lsp().length} LSP
              </text>
            </Show>
            <Show when={mcp()}>
              <text fg={theme.textMuted}>
                <Switch>
                  <Match when={mcpError()}>
                    <span style={{ fg: theme.error }}>⊙ </span>
                  </Match>
                  <Match when={true}>
                    <span style={{ fg: theme.success }}>⊙ </span>
                  </Match>
                </Switch>
                {mcp()} MCP
              </text>
            </Show>
            <text fg={theme.textMuted}>/status</text>
          </Match>
        </Switch>
      </box>
    </box>
  )
}
