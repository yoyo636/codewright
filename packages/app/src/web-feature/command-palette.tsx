import { createMemo, createSignal, For, onCleanup, onMount, Show, type JSX } from "solid-js"
import { Portal } from "solid-js/web"

export interface PaletteItem {
  id: string
  label: string
  hint?: string
  shortcut?: string
  group?: string
  run: () => void | Promise<void>
}

export interface PaletteOptions {
  items: () => PaletteItem[]
}

export function createCommandPalette(opts: PaletteOptions) {
  const [open, setOpen] = createSignal(false)
  const [query, setQuery] = createSignal("")
  const [active, setActive] = createSignal(0)
  let inputRef: HTMLInputElement | undefined

  const filtered = createMemo(() => {
    const q = query().trim().toLowerCase()
    const all = opts.items()
    if (!q) return all
    return all.filter((it) => it.label.toLowerCase().includes(q) || it.hint?.toLowerCase().includes(q) || it.group?.toLowerCase().includes(q))
  })

  const onKey = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault()
      setOpen((v) => !v)
      return
    }
    if (e.key === "Escape" && open()) {
      e.preventDefault()
      setOpen(false)
    }
  }

  onMount(() => {
    window.addEventListener("keydown", onKey)
  })
  onCleanup(() => window.removeEventListener("keydown", onKey))

  const show = () => setOpen(true)
  const hide = () => setOpen(false)
  const toggle = () => setOpen((v) => !v)

  const run = async (idx: number) => {
    const list = filtered()
    const item = list[idx]
    if (!item) return
    setOpen(false)
    setQuery("")
    setActive(0)
    try {
      await item.run()
    } catch (err) {
      console.error("[command-palette] run failed", err)
    }
  }

  const onInputKey = (e: KeyboardEvent) => {
    const list = filtered()
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((i) => Math.min(list.length - 1, i + 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      run(active())
    }
  }

  const render = (): JSX.Element => (
    <Show when={open()}>
      <Portal>
        <div class="cw-cp-mask" onClick={() => setOpen(false)} role="presentation">
          <div class="cw-cp" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Command Palette">
            <input
              ref={(el) => (inputRef = el)}
              class="cw-cp__input"
              type="text"
              placeholder="输入命令或搜索…"
              value={query()}
              onInput={(e) => {
                setQuery(e.currentTarget.value)
                setActive(0)
              }}
              onKeyDown={onInputKey}
              autofocus
            />
            <div class="cw-cp__list">
              <Show
                when={filtered().length > 0}
                fallback={<div class="cw-cp__empty">没有匹配的命令</div>}
              >
                <For each={filtered()}>
                  {(item, i) => (
                    <div
                      class="cw-cp__item"
                      classList={{ "cw-cp__item--active": i() === active() }}
                      onMouseEnter={() => setActive(i())}
                      onClick={() => run(i())}
                    >
                      <div class="cw-cp__label">
                        <span class="cw-cp__group">{item.group ?? ""}</span>
                        <span>{item.label}</span>
                      </div>
                      <div class="cw-cp__hint">
                        <Show when={item.hint}>
                          <span class="cw-cp__hint-text">{item.hint}</span>
                        </Show>
                        <Show when={item.shortcut}>
                          <kbd class="cw-cp__kbd">{item.shortcut}</kbd>
                        </Show>
                      </div>
                    </div>
                  )}
                </For>
              </Show>
            </div>
            <div class="cw-cp__footer">
              <span>↑↓ 选择</span>
              <span>↵ 运行</span>
              <span>Esc 关闭</span>
            </div>
          </div>
        </div>
        <style>{`
          .cw-cp-mask{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.45);backdrop-filter:blur(6px);display:grid;place-items:flex-start center;padding-top:14vh;animation:cw-cp-in 140ms ease}
          .cw-cp{width:min(620px,92vw);max-height:60vh;background:rgba(20,22,30,0.92);border:1px solid rgba(180,200,255,0.18);border-radius:16px;box-shadow:0 32px 80px rgba(0,0,0,0.55);color:#e7ecf3;overflow:hidden;display:flex;flex-direction:column}
          .cw-cp__input{background:transparent;border:0;border-bottom:1px solid rgba(180,200,255,0.18);color:inherit;padding:16px 18px;font-size:16px;outline:none}
          .cw-cp__list{overflow:auto;padding:6px;flex:1}
          .cw-cp__item{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-radius:10px;cursor:pointer;gap:12px}
          .cw-cp__item--active{background:linear-gradient(135deg,rgba(109,211,255,0.16),rgba(162,128,255,0.16))}
          .cw-cp__label{display:flex;align-items:center;gap:8px;min-width:0}
          .cw-cp__group{font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#9aa0a6;background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:4px}
          .cw-cp__hint{display:flex;align-items:center;gap:8px;color:#9aa0a6;font-size:12px;min-width:0}
          .cw-cp__hint-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px}
          .cw-cp__kbd{font-family:ui-monospace,Menlo,monospace;font-size:11px;background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px}
          .cw-cp__empty{padding:24px;text-align:center;color:#9aa0a6}
          .cw-cp__footer{display:flex;gap:14px;padding:8px 14px;border-top:1px solid rgba(180,200,255,0.12);font-size:11px;color:#9aa0a6}
          @keyframes cw-cp-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
        `}</style>
      </Portal>
    </Show>
  )

  return { open, show, hide, toggle, query, setQuery, render }
}
