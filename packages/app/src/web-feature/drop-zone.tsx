import { createSignal, onCleanup, onMount, type JSX, Show } from "solid-js"
import { Portal } from "solid-js/web"

export interface DroppedFile {
  id: string
  name: string
  mime: string
  size: number
  dataUrl?: string
  textPreview?: string
  at: number
}

export type DropHandler = (files: DroppedFile[]) => void

const MAX_PREVIEW_BYTES = 64 * 1024
const MAX_DATAURL_BYTES = 2 * 1024 * 1024

async function readAsDataUrl(file: File): Promise<string | undefined> {
  if (file.size > MAX_DATAURL_BYTES) return undefined
  return new Promise((resolve) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result as string)
    fr.onerror = () => resolve(undefined)
    fr.readAsDataURL(file)
  })
}

async function readAsTextPreview(file: File): Promise<string | undefined> {
  if (!file.type.startsWith("text/") && !/\.(md|json|ya?ml|toml|txt|log|ts|tsx|js|jsx|css|html|xml|csv)$/i.test(file.name)) {
    return undefined
  }
  if (file.size > MAX_PREVIEW_BYTES) return undefined
  return new Promise((resolve) => {
    const fr = new FileReader()
    fr.onload = () => resolve(typeof fr.result === "string" ? fr.result : undefined)
    fr.onerror = () => resolve(undefined)
    fr.readAsText(file)
  })
}

async function fileToDropped(file: File): Promise<DroppedFile> {
  const id = "f-" + Math.random().toString(36).slice(2, 10)
  const [dataUrl, textPreview] = await Promise.all([readAsDataUrl(file), readAsTextPreview(file)])
  return { id, name: file.name, mime: file.type || "application/octet-stream", size: file.size, dataUrl, textPreview, at: Date.now() }
}

export function createGlobalDropZone(onDrop: DropHandler, opts?: { container?: HTMLElement }) {
  const [hover, setHover] = createSignal(false)
  const target: HTMLElement | Window = opts?.container ?? window

  const onEnter = (e: DragEvent) => {
    if (!e.dataTransfer?.types?.includes("Files")) return
    e.preventDefault()
    setHover(true)
  }
  const onOver = (e: DragEvent) => {
    if (!e.dataTransfer?.types?.includes("Files")) return
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"
  }
  const onLeave = (e: DragEvent) => {
    if (e.relatedTarget && (e.currentTarget as Node).contains(e.relatedTarget as Node)) return
    setHover(false)
  }
  const onDropEvent = async (e: DragEvent) => {
    e.preventDefault()
    setHover(false)
    const list = e.dataTransfer?.files
    if (!list || list.length === 0) return
    const files = await Promise.all(Array.from(list).map(fileToDropped))
    onDrop(files)
  }

  onMount(() => {
    target.addEventListener("dragenter", onEnter as unknown as EventListener)
    target.addEventListener("dragover", onOver as unknown as EventListener)
    target.addEventListener("dragleave", onLeave as unknown as EventListener)
    target.addEventListener("drop", onDropEvent as unknown as EventListener)
  })
  onCleanup(() => {
    target.removeEventListener("dragenter", onEnter as unknown as EventListener)
    target.removeEventListener("dragover", onOver as unknown as EventListener)
    target.removeEventListener("dragleave", onLeave as unknown as EventListener)
    target.removeEventListener("drop", onDropEvent as unknown as EventListener)
  })

  return { hover }
}

export function DropOverlay(props: { visible: boolean; count?: number }): JSX.Element {
  return (
    <Show when={props.visible}>
      <Portal>
        <div class="cw-dropzone" aria-live="polite">
          <div class="cw-dropzone__inner">
            <div class="cw-dropzone__icon">⤓</div>
            <div class="cw-dropzone__title">松手以附加到当前会话</div>
            <Show when={(props.count ?? 0) > 0}>
              <div class="cw-dropzone__hint">{props.count} 个文件已就绪</div>
            </Show>
          </div>
        </div>
        <style>{`
          .cw-dropzone{position:fixed;inset:0;z-index:9999;pointer-events:none;background:rgba(10,12,20,0.45);backdrop-filter:blur(8px);display:grid;place-items:center;animation:cw-dz-in 180ms ease}
          .cw-dropzone__inner{border:2px dashed rgba(180,200,255,0.6);border-radius:18px;padding:36px 56px;background:linear-gradient(135deg,rgba(109,211,255,0.18),rgba(162,128,255,0.18));color:#fff;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.4)}
          .cw-dropzone__icon{font-size:48px;line-height:1;margin-bottom:12px}
          .cw-dropzone__title{font-size:18px;font-weight:600}
          .cw-dropzone__hint{font-size:12px;margin-top:6px;opacity:0.75}
          @keyframes cw-dz-in{from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)}}
        `}</style>
      </Portal>
    </Show>
  )
}
