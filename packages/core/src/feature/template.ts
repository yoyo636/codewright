export interface SessionTemplate {
  id: string
  name: string
  description?: string
  agent?: string
  model?: string
  prompt: string
  attachments?: Array<{ name: string; mime: string; size: number; dataBase64: string }>
  icon?: string
  builtin?: boolean
  createdAt: number
}

const BUILTINS: SessionTemplate[] = [
  {
    id: "tpl.code-review",
    name: "代码评审",
    description: "审查当前分支的所有变更并给出建议",
    agent: "code-reviewer",
    prompt: "请评审当前 git 分支的所有变更，输出问题清单与改进建议。",
    icon: "shield-check",
    builtin: true,
    createdAt: 0,
  },
  {
    id: "tpl.bug-investigate",
    name: "Bug 调查",
    description: "从报错日志入手定位根因",
    agent: "investigator",
    prompt: "请根据以下报错定位根因，给出最小修复 patch。",
    icon: "bug",
    builtin: true,
    createdAt: 0,
  },
  {
    id: "tpl.test-gen",
    name: "测试生成",
    description: "为目标文件补充单元测试",
    agent: "tester",
    prompt: "为指定文件生成高质量的单元测试，目标覆盖率 ≥ 85%。",
    icon: "flask",
    builtin: true,
    createdAt: 0,
  },
  {
    id: "tpl.docs",
    name: "文档撰写",
    description: "从代码生成 API 文档",
    agent: "doc-writer",
    prompt: "基于源码生成 Markdown 格式的 API 文档。",
    icon: "book",
    builtin: true,
    createdAt: 0,
  },
]

const templates = new Map<string, SessionTemplate>()
for (const t of BUILTINS) templates.set(t.id, t)
const listeners = new Set<() => void>()

function rid() {
  return "tpl." + Math.random().toString(36).slice(2, 10)
}

export function listTemplates(): SessionTemplate[] {
  return Array.from(templates.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export function getTemplate(id: string): SessionTemplate | undefined {
  return templates.get(id)
}

export function createTemplate(input: Omit<SessionTemplate, "id" | "createdAt">): SessionTemplate {
  const t: SessionTemplate = { ...input, id: rid(), createdAt: Date.now() }
  templates.set(t.id, t)
  emit()
  return t
}

export function updateTemplate(id: string, patch: Partial<SessionTemplate>): SessionTemplate | undefined {
  const cur = templates.get(id)
  if (!cur || cur.builtin) return cur
  const next = { ...cur, ...patch, id: cur.id }
  templates.set(id, next)
  emit()
  return next
}

export function removeTemplate(id: string) {
  const cur = templates.get(id)
  if (!cur || cur.builtin) return
  templates.delete(id)
  emit()
}

export function onTemplatesChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function emit() {
  for (const l of listeners) {
    try {
      l()
    } catch {
      /* ignore */
    }
  }
}
