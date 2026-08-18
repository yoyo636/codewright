import type { TuiPlugin, TuiPluginApi } from "@codewright-ai/plugin/tui"
import type { BuiltinTuiPlugin } from "../builtins"
import { createMemo, createSignal, Match, onCleanup, onMount, Show, Switch } from "solid-js"
import { abbreviateHome } from "../../runtime"
import { useTuiPaths } from "../../context/runtime"
import { useHomeSessionDestination } from "../../routes/home/session-destination"
import { readFileSync, existsSync } from "node:fs"

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

const id = "internal:home-footer"

function Directory(props: { api: TuiPluginApi }) {
  const theme = () => props.api.theme.current
  const destination = useHomeSessionDestination()
  const paths = useTuiPaths()
  const dir = createMemo(() => {
    const selected = destination?.destination()
    if (!selected || selected.type === "new") return
    const out = abbreviateHome(selected.directory, paths.home)
    const branch =
      selected.directory === (props.api.state.path.directory || paths.cwd) ? props.api.state.vcs?.branch : undefined
    if (branch) return out + ":" + branch
    return out
  })

  return <Show when={dir()}>{(value) => <text fg={theme().textMuted}>{value()}</text>}</Show>
}

function Mcp(props: { api: TuiPluginApi }) {
  const theme = () => props.api.theme.current
  const list = createMemo(() => props.api.state.mcp())
  const has = createMemo(() => list().length > 0)
  const err = createMemo(() => list().some((item) => item.status === "failed"))
  const count = createMemo(() => list().filter((item) => item.status === "connected").length)

  return (
    <Show when={has()}>
      <box gap={1} flexDirection="row" flexShrink={0}>
        <text fg={theme().text}>
          <Switch>
            <Match when={err()}>
              <span style={{ fg: theme().error }}>⊙ </span>
            </Match>
            <Match when={true}>
              <span style={{ fg: count() > 0 ? theme().success : theme().textMuted }}>⊙ </span>
            </Match>
          </Switch>
          {count()} MCP
        </text>
        <text fg={theme().textMuted}>/status</text>
      </box>
    </Show>
  )
}

function Version(props: { api: TuiPluginApi }) {
  const theme = () => props.api.theme.current

  return (
    <box flexShrink={0}>
      <text fg={theme().textMuted}>{props.api.app.version}</text>
    </box>
  )
}

function View(props: { api: TuiPluginApi }) {
  return (
    <box
      width="100%"
      paddingTop={1}
      paddingBottom={1}
      paddingLeft={2}
      paddingRight={2}
      flexDirection="row"
      flexShrink={0}
      gap={2}
    >
      <ModeIndicator />
      <Directory api={props.api} />
      <Mcp api={props.api} />
      <box flexGrow={1} />
      <Version api={props.api} />
    </box>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 100,
    slots: {
      home_footer() {
        return <View api={api} />
      },
    },
  })
}

const plugin: BuiltinTuiPlugin = {
  id,
  tui,
}

export default plugin
