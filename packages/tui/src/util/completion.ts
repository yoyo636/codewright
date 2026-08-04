export interface CompletionItem {
  value: string
  description?: string
  insertText?: string
  kind?: "command" | "agent" | "file" | "model" | "tag" | "template" | "argument"
  icon?: string
}

export interface CompletionProvider {
  id: string
  prefix?: RegExp
  provide(prefix: string, ctx: CompletionContext): Promise<CompletionItem[]> | CompletionItem[]
}

export interface CompletionContext {
  input: string
  cursor: number
  argv: string[]
  cwd: string
  env: Record<string, string>
}

const providers: CompletionProvider[] = []
const subscriber = new Set<() => void>()

export function registerCompletion(p: CompletionProvider): () => void {
  providers.push(p)
  for (const s of subscriber) s()
  return () => {
    const idx = providers.indexOf(p)
    if (idx >= 0) providers.splice(idx, 1)
  }
}

export function listProviders(): CompletionProvider[] {
  return providers.slice()
}

export function onCompletionChange(fn: () => void): () => void {
  subscriber.add(fn)
  return () => subscriber.delete(fn)
}

export async function complete(input: string, ctx: Omit<CompletionContext, "input"> = { cursor: 0, argv: [], cwd: process.cwd(), env: process.env as Record<string, string> }): Promise<CompletionItem[]> {
  const ctxFull: CompletionContext = { ...ctx, input, cursor: input.length }
  const out: CompletionItem[] = []
  for (const p of providers) {
    try {
      const list = await p.provide(input, ctxFull)
      if (p.prefix && !p.prefix.test(input)) continue
      for (const item of list) out.push(item)
    } catch {
      /* ignore provider errors */
    }
  }
  const seen = new Set<string>()
  return out.filter((it) => {
    const key = it.kind + ":" + it.value
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function builtinPrefixProvider(): CompletionProvider {
  return {
    id: "builtin-slash",
    prefix: /^\s*\/\w*$/,
    provide(input) {
      const m = input.match(/\/(\w*)$/)
      const tail = m ? m[1] : ""
      const commands: CompletionItem[] = [
        { value: "/help", description: "查看帮助", kind: "command" },
        { value: "/new", description: "开启新会话", kind: "command" },
        { value: "/sessions", description: "列出所有会话", kind: "command" },
        { value: "/tags", description: "管理会话标签", kind: "command" },
        { value: "/templates", description: "使用会话模板", kind: "command" },
        { value: "/usage", description: "查看用量统计", kind: "command" },
        { value: "/export", description: "导出会话", kind: "command" },
        { value: "/sync", description: "跨端同步状态", kind: "command" },
        { value: "/exit", description: "退出 TUI", kind: "command" },
      ]
      return commands.filter((c) => c.value.toLowerCase().includes("/" + tail.toLowerCase()))
    },
  }
}

export function builtinFileProvider(): CompletionProvider {
  return {
    id: "builtin-file",
    prefix: /(?:^|\s)@([^\s@]*)$/,
    provide(input) {
      const m = input.match(/(?:^|\s)@([^\s@]*)$/)
      const tail = m ? m[1] : ""
      return [
        { value: `@${tail || "file.txt"}`, description: "引用文件（自动补全路径）", kind: "file", insertText: tail },
      ]
    },
  }
}

export function builtinAgentProvider(): CompletionProvider {
  return {
    id: "builtin-agent",
    prefix: /(?:^|\s)#([\w-]*)$/,
    provide() {
      return [
        { value: "#code-reviewer", description: "代码评审 agent", kind: "agent" },
        { value: "#investigator", description: "故障调查 agent", kind: "agent" },
        { value: "#tester", description: "测试生成 agent", kind: "agent" },
        { value: "#doc-writer", description: "文档撰写 agent", kind: "agent" },
      ]
    },
  }
}
