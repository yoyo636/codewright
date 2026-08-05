import { Show, createSignal, onMount } from "solid-js"
import { TextAttributes } from "@opentui/core"
import { Dialog } from "../ui/dialog"
import { useTheme } from "../context/theme"
import { ThinkingSpinner } from "./spinner"
import { useBindings, useCodewrightModeStack } from "../keymap"

type VoicePhase = "recording" | "processing" | "done" | "error"

type VoiceData = { transcript: string; polished: string } | null

export function DialogVoiceInput(props: {
  state: "recording"
  onConfirm: (text: string) => void
  onCancel: () => void
  onRecord: () => Promise<{ transcript: string; polished: string } | null>
}) {
  const { theme } = useTheme()
  const modeStack = useCodewrightModeStack()
  const [phase, setPhase] = createSignal<VoicePhase>("recording")
  const [data, setData] = createSignal<VoiceData>(null)
  const [errorMsg, setErrorMsg] = createSignal<string>("")
  const [useOriginal, setUseOriginal] = createSignal(false)

  const phaseLabel = () => {
    switch (phase()) {
      case "recording":
        return "Recording… (5s)"
      case "processing":
        return "Transcribing & polishing…"
      case "done":
        return "Review and confirm"
      case "error":
        return "Error"
    }
  }

  const displayText = () => {
    if (!data()) return ""
    return useOriginal() ? data()!.transcript : data()!.polished
  }

  onMount(() => {
    const pop = modeStack.push("dialog.voice")
    void (async () => {
      setPhase("recording")
      const result = await props.onRecord()
      if (!result) {
        setErrorMsg("Voice input failed. Check microphone and API key.")
        setPhase("error")
        return
      }
      setData(result)
      setPhase("done")
    })()
    return pop
  })

  useBindings(() => ({
    mode: "dialog.voice",
    bindings: [
      {
        command: "dialog.voice.confirm",
        key: "return",
        run: () => {
          if (phase() === "done" && data()) {
            props.onConfirm(displayText())
          }
        },
      },
      {
        command: "dialog.voice.cancel",
        key: "escape",
        run: () => props.onCancel(),
      },
      {
        command: "dialog.voice.toggle",
        key: "tab",
        run: () => {
          if (phase() === "done") setUseOriginal((v) => !v)
        },
      },
    ],
  }))

  return (
    <Dialog size="large" onClose={() => props.onCancel()}>
      <box flexDirection="column" padding={1}>
        <Show when={phase() === "recording" || phase() === "processing"}>
          <box flexDirection="row" gap={1}>
            <ThinkingSpinner color={theme.warning}>{phaseLabel()}</ThinkingSpinner>
          </box>
        </Show>

        <Show when={phase() === "done" && data()}>
          <box flexDirection="column" gap={1}>
            <text fg={theme.primary} attributes={TextAttributes.BOLD}>
              {phaseLabel()}
            </text>
            <box flexDirection="row" gap={1}>
              <text fg={useOriginal() ? theme.textMuted : theme.accent}>
                {useOriginal() ? "  " : "▶ "}Polished
              </text>
              <text fg={useOriginal() ? theme.accent : theme.textMuted}>
                {useOriginal() ? "▶ " : "  "}Original
              </text>
              <text fg={theme.textMuted}> (Tab to toggle)</text>
            </box>
            <box marginTop={1}>
              <text fg={theme.text} wrapMode="word">
                {displayText()}
              </text>
            </box>
            <box marginTop={1} flexDirection="row" gap={2}>
              <text fg={theme.success} attributes={TextAttributes.BOLD}>
                Enter
              </text>
              <text fg={theme.textMuted}>to send</text>
              <text fg={theme.error} attributes={TextAttributes.BOLD}>
                Esc
              </text>
              <text fg={theme.textMuted}>to cancel</text>
            </box>
          </box>
        </Show>

        <Show when={phase() === "error"}>
          <box flexDirection="column" gap={1}>
            <text fg={theme.error} attributes={TextAttributes.BOLD}>
              {errorMsg()}
            </text>
            <text fg={theme.textMuted}>Press Esc to close</text>
          </box>
        </Show>
      </box>
    </Dialog>
  )
}
