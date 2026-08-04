export interface InputMode {
  single: true
  value: string
}

export interface MultiLineInput {
  kind: "multi"
  lines: string[]
  cursorLine: number
  cursorCol: number
}

export interface MultimodalAttachment {
  id: string
  name: string
  mime: string
  size: number
  ref: string
}

export interface MultimodalInput {
  kind: "multimodal"
  text: string
  attachments: MultimodalAttachment[]
}

export type EditorInput = string | MultiLineInput | MultimodalInput

export interface DraftEditor {
  reset(): void
  isMultiLine(): boolean
  isMultimodal(): boolean
  text(): string
  pushLine(line: string): void
  attach(a: MultimodalAttachment): void
  toJSON(): { kind: "single" | "multi" | "multimodal"; text: string; lines?: string[]; attachments?: MultimodalAttachment[] }
}

export function createDraftEditor(initial?: string): DraftEditor {
  let lines: string[] = initial ? initial.split("\n") : [""]
  let cursorLine = lines.length - 1
  let cursorCol = lines[cursorLine]?.length ?? 0
  let attachments: MultimodalAttachment[] = []

  return {
    reset() {
      lines = [""]
      cursorLine = 0
      cursorCol = 0
      attachments = []
    },
    isMultiLine() {
      return lines.length > 1 || (lines[0] ?? "").includes("\n")
    },
    isMultimodal() {
      return attachments.length > 0
    },
    text() {
      return lines.join("\n")
    },
    pushLine(line: string) {
      if (lines.length === 1 && lines[0] === "") {
        lines = [line]
      } else {
        lines.push(line)
      }
      cursorLine = lines.length - 1
      cursorCol = lines[cursorLine].length
    },
    attach(a: MultimodalAttachment) {
      attachments.push(a)
    },
    toJSON() {
      const text = lines.join("\n")
      if (attachments.length > 0) {
        return { kind: "multimodal", text, attachments: attachments.slice() }
      }
      if (lines.length > 1) {
        return { kind: "multi", text, lines: lines.slice() }
      }
      return { kind: "single", text }
    },
  }
}

export const MAX_LINES = 200
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024
