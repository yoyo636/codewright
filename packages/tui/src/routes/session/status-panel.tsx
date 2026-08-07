import { Show, createMemo, For, createSignal } from "solid-js"
import type { AssistantMessage } from "@codewright-ai/sdk/v2"
import { useSync } from "../../context/sync"
import { useProject } from "../../context/project"
import { useTheme } from "../../context/theme"
import { WorkspaceLabel } from "../../component/workspace-label"
import type { JSX } from "@opentui/solid"
const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
})

const number = new Intl.NumberFormat("en-US")

function ProgressBar(props: { percent: number; color: string; bg: string }) {
  const filled = Math.round(Math.min(props.percent, 100) / 10)
  const empty = 10 - filled
  return (
    <text>
      <span style={{ fg: props.color }}>{"█".repeat(filled)}</span>
      <span style={{ fg: props.bg }}>{"░".repeat(empty)}</span>
    </text>
  )
}

function Section(props: { title: string; children: JSX.Element }) {
  return (
    <box flexDirection="column" gap={0}>
      <text fg={props.title === "Status" ? "#00d4ff" : "#a855f7"}>
        <b>{props.title}</b>
      </text>
      <box paddingLeft={1} flexDirection="column" gap={0}>
        {props.children}
      </box>
    </box>
  )
}

function LabelValue(props: { label: string; value: string; valueColor?: string }) {
  const { theme } = useTheme()
  return (
    <box flexDirection="row" gap={1}>
      <text fg={theme.textMuted}>{props.label}</text>
      <text fg={props.valueColor ?? theme.text}>{props.value}</text>
    </box>
  )
}

export function StatusPanel(props: { sessionID: string }) {
  const sync = useSync()
  const project = useProject()
  const { theme } = useTheme()

  const session = createMemo(() => sync.session.get(props.sessionID))
  const messages = createMemo(() => sync.data.message[props.sessionID] ?? [])
  const todos = createMemo(() => sync.data.todo[props.sessionID] ?? [])
  const lspList = createMemo(() => sync.data.lsp)
  const hasUserMessage = createMemo(() => messages().some((m) => m.role === "user"))

  const lastAssistant = createMemo(() =>
    messages().findLast((m): m is AssistantMessage => m.role === "assistant" && m.tokens?.output > 0),
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

  const tokenState = createMemo(() => {
    const msg = lastAssistant()
    if (!msg) return null
    const contextTokens = (msg.tokens?.input ?? 0) + (msg.tokens?.cache?.read ?? 0) + (msg.tokens?.cache?.write ?? 0)
    const outputTokens = msg.tokens?.output ?? 0
    const limit = model()?.limit?.context
    const percent = limit ? Math.round((contextTokens / limit) * 100) : null
    return { contextTokens, outputTokens, limit, percent }
  })

  const totalCost = createMemo(() => {
    return messages().reduce((sum, m) => sum + (m.cost ?? 0), 0)
  })

  const totalTokens = createMemo(() => {
    return messages().reduce((sum, m) => sum + (m.tokens?.input ?? 0) + (m.tokens?.output ?? 0), 0)
  })

  const [todoOpen, setTodoOpen] = createSignal(true)
  const [lspOpen, setLspOpen] = createSignal(true)

  const completedTodos = createMemo(() => todos().filter((t) => t.status === "completed").length)
  const pendingTodos = createMemo(() => todos().filter((t) => t.status !== "completed").length)

  const workspace = () => {
    const workspaceID = session()?.workspaceID
    if (!workspaceID) return
    return project.workspace.get(workspaceID)
  }

  return (
    <Show when={hasUserMessage()}>
      <box
        backgroundColor={theme.backgroundPanel}
        width={44}
        height="100%"
        flexDirection="column"
        border={["left"]}
        borderColor={theme.border}
      >
        <scrollbox flexGrow={1} paddingTop={1} paddingBottom={1} paddingLeft={2} paddingRight={2}>
          <box flexDirection="column" gap={1}>
            {/* Session Header */}
            <box flexDirection="column" gap={0}>
              <text fg="#00d4ff">
                <b>◆ {session()?.title ?? "Session"}</b>
              </text>
              <text fg={theme.textMuted}>{session()?.id.slice(0, 8)}</text>
              <Show when={session()?.workspaceID}>
                <text fg={theme.textMuted}>
                  <Show
                    when={workspace()}
                    fallback={
                      <WorkspaceLabel type="unknown" name={session()!.workspaceID!} status="error" icon />
                    }
                  >
                    {(item) => (
                      <WorkspaceLabel
                        type={item().type}
                        name={item().name}
                        status={project.workspace.status(item().id) ?? "error"}
                        icon
                      />
                    )}
                  </Show>
                </text>
              </Show>
              <Show when={session()?.share?.url}>
                <text fg={theme.textMuted}>{session()!.share!.url}</text>
              </Show>
            </box>

            <text fg={theme.border}>{"─".repeat(40)}</text>

            {/* API Info */}
            <Section title="API">
              <LabelValue
                label="Provider:"
                value={provider()?.id ?? "—"}
                valueColor={provider() ? "#00ff88" : undefined}
              />
              <LabelValue
                label="Model:"
                value={model()?.name?.split("/").pop() ?? "—"}
              />
              <Show when={model()?.limit?.context}>
                <LabelValue
                  label="Context:"
                  value={`${number.format(model()!.limit.context / 1000)}K`}
                />
              </Show>
            </Section>

            <text fg={theme.border}>{"─".repeat(40)}</text>

            {/* Token Usage */}
            <Section title="Tokens">
              <Show
                when={tokenState()}
                fallback={<text fg={theme.textMuted}>Awaiting first response...</text>}
              >
                <box flexDirection="row" gap={1}>
                  <text fg={theme.textMuted}>Ctx:</text>
                  <text fg={theme.text}>{number.format(tokenState()!.contextTokens)}</text>
                </box>
                <Show when={tokenState()!.percent !== null}>
                  <box flexDirection="row" gap={1}>
                    <ProgressBar
                      percent={tokenState()!.percent!}
                      color={tokenState()!.percent! > 80 ? "#ff3b30" : tokenState()!.percent! > 50 ? "#ff9f0a" : "#00ff88"}
                      bg={theme.backgroundElement}
                    />
                    <text fg={theme.textMuted}>{tokenState()!.percent}%</text>
                  </box>
                </Show>
                <box flexDirection="row" gap={1}>
                  <text fg={theme.textMuted}>Out:</text>
                  <text fg={theme.text}>{number.format(tokenState()!.outputTokens)}</text>
                </box>
                <LabelValue label="Total:" value={number.format(totalTokens())} />
              </Show>
            </Section>

            <text fg={theme.border}>{"─".repeat(40)}</text>

            {/* Cost */}
            <Section title="Cost">
              <box flexDirection="row" gap={1}>
                <text fg={theme.textMuted}>Session:</text>
                <text fg={theme.text}>{money.format(totalCost())}</text>
              </box>
              <Show when={lastAssistant()?.cost}>
                <LabelValue
                  label="Last:"
                  value={money.format(lastAssistant()!.cost!)}
                />
              </Show>
            </Section>

            <text fg={theme.border}>{"─".repeat(40)}</text>

            {/* Todo List */}
            <Show when={todos().length > 0}>
              <box flexDirection="column" gap={0}>
                <box
                  flexDirection="row"
                  gap={1}
                  onMouseDown={() => setTodoOpen((x) => !x)}
                >
                  <text fg={theme.text}>{todoOpen() ? "▼" : "▶"}</text>
                  <text fg="#a855f7">
                    <b>Todo</b>
                  </text>
                  <Show when={completedTodos() > 0}>
                    <text fg="#00ff88">{completedTodos()}/{todos().length}</text>
                  </Show>
                </box>
                <Show when={todoOpen()}>
                  <For each={todos()}>
                    {(item) => (
                      <box flexDirection="row" gap={1} paddingLeft={2}>
                        <text
                          style={{
                            fg:
                              item.status === "completed"
                                ? "#00ff88"
                                : item.status === "in_progress"
                                  ? "#ff9f0a"
                                  : theme.textMuted,
                          }}
                        >
                          {item.status === "completed" ? "✓" : item.status === "in_progress" ? "◎" : "○"}
                        </text>
                        <text
                          fg={item.status === "completed" ? theme.textMuted : theme.text}
                          style={item.status === "completed" ? { strikethrough: true } : undefined}
                        >
                          {item.content}
                        </text>
                      </box>
                    )}
                  </For>
                </Show>
              </box>
              <text fg={theme.border}>{"─".repeat(40)}</text>
            </Show>

            {/* LSP Status */}
            <Show when={lspList().length > 0}>
              <box flexDirection="column" gap={0}>
                <box
                  flexDirection="row"
                  gap={1}
                  onMouseDown={() => setLspOpen((x) => !x)}
                >
                  <text fg={theme.text}>{lspOpen() ? "▼" : "▶"}</text>
                  <text fg="#a855f7">
                    <b>LSP</b>
                  </text>
                  <text fg="#00ff88">{lspList().length}</text>
                </box>
                <Show when={lspOpen()}>
                  <For each={lspList()}>
                    {(item) => (
                      <box flexDirection="row" gap={1} paddingLeft={2}>
                        <text fg={item.status === "connected" ? "#00ff88" : "#ff3b30"}>
                          {item.status === "connected" ? "●" : "○"}
                        </text>
                        <text fg={theme.textMuted}>{item.id}</text>
                      </box>
                    )}
                  </For>
                </Show>
              </box>
              <text fg={theme.border}>{"─".repeat(40)}</text>
            </Show>

            {/* Footer */}
            <box flexDirection="column" gap={0}>
              <text fg={theme.border}>{"─".repeat(40)}</text>
              <text fg={theme.textMuted}>
                <span style={{ fg: "#00d4ff" }}>◆</span> Codewright v2.1.1
              </text>
            </box>
          </box>
        </scrollbox>
      </box>
    </Show>
  )
}
