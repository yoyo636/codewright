import { createMemo, onMount, Show } from "solid-js"
import { useSync } from "../../context/sync"
import { DialogSelect, type DialogSelectOption } from "../../ui/dialog-select"
import type { TextPart } from "@codewright-ai/sdk/v2"
import { useSDK } from "../../context/sdk"
import { useDialog } from "../../ui/dialog"

export function DialogQueuedPrompts(props: { sessionID: string }) {
  const sync = useSync()
  const sdk = useSDK()
  const dialog = useDialog()

  onMount(() => {
    dialog.setSize("large")
  })

  const messages = createMemo(() => sync.data.message[props.sessionID] ?? [])

  const pending = createMemo(() => {
    const completed = messages().findLast((x) => x.role === "assistant" && x.time.completed)?.id
    return messages().findLast((x) => x.role === "assistant" && !x.time.completed && (!completed || x.id > completed))
      ?.id
  })

  const queuedMessages = createMemo(() => {
    const p = pending()
    if (!p) return []
    return messages().filter((m) => m.role === "user" && m.id > p)
  })

  const options = createMemo((): DialogSelectOption<string>[] => {
    const result: DialogSelectOption<string>[] = []
    for (const message of queuedMessages()) {
      const part = (sync.data.part[message.id] ?? []).find(
        (x) => x.type === "text" && !x.synthetic && !x.ignored,
      ) as TextPart | undefined
      const text = part?.text?.replace(/\n/g, " ").slice(0, 80) ?? "(empty)"
      result.push({
        title: text,
        value: message.id,
        onSelect: () => {
          sdk.client.session
            .deleteMessage(
              { sessionID: props.sessionID, messageID: message.id },
              { throwOnError: true },
            )
            .then(() => dialog.clear())
        },
      })
    }
    return result
  })

  return (
    <Show
      when={options().length > 0}
      fallback={
        <box flexDirection="column" padding={1}>
          <text>No queued prompts</text>
        </box>
      }
    >
      <DialogSelect
        title="Queued Prompts"
        placeholder="Select a prompt to remove it from the queue"
        options={options()}
      />
    </Show>
  )
}
