import { spawn, type ChildProcess } from "node:child_process"
import os from "os"
import path from "path"

const MAX_BUFFER = 200_000

export type Status = "running" | "completed" | "killed" | "error"

export interface Info {
  id: string
  command: string
  status: Status
  exitCode: number | null
  output: string
  startedAt: number
  completedAt?: number
}

interface Entry {
  info: Info
  process: ChildProcess | null
}

const registry = new Map<string, Entry>()
let seq = 0

function nextId(): string {
  seq++
  return `bgshell-${Date.now()}-${seq}`
}

function truncateBuffer(text: string): string {
  if (text.length <= MAX_BUFFER) return text
  return "...(earlier output truncated)...\n" + text.slice(-MAX_BUFFER)
}

export function start(input: {
  command: string
  shell: string
  cwd: string
  env: NodeJS.ProcessEnv
}): string {
  const id = nextId()
  const info: Info = {
    id,
    command: input.command,
    status: "running",
    exitCode: null,
    output: "",
    startedAt: Date.now(),
  }

  const isPwsh = process.platform === "win32" && (input.shell.includes("pwsh") || input.shell.includes("powershell"))
  const child: ChildProcess = isPwsh
    ? spawn(input.shell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", input.command], {
        cwd: input.cwd,
        env: input.env,
        stdio: ["ignore", "pipe", "pipe"],
      })
    : spawn(input.command, [], {
        shell: input.shell,
        cwd: input.cwd,
        env: input.env,
        stdio: ["ignore", "pipe", "pipe"],
        detached: process.platform !== "win32",
      })

  const entry: Entry = { info, process: child }
  registry.set(id, entry)

  const append = (chunk: Buffer | string) => {
    const text = typeof chunk === "string" ? chunk : chunk.toString("utf-8")
    entry.info.output = truncateBuffer(entry.info.output + text)
  }

  child.stdout?.on("data", append)
  child.stderr?.on("data", append)

  child.on("exit", (code) => {
    entry.info.exitCode = code
    entry.info.status = code === 0 ? "completed" : "error"
    entry.info.completedAt = Date.now()
    entry.process = null
  })

  child.on("error", (err) => {
    entry.info.output = truncateBuffer(entry.info.output + `\n[process error: ${err.message}]\n`)
    entry.info.status = "error"
    entry.info.completedAt = Date.now()
    entry.process = null
  })

  return id
}

export function read(id: string): Info | undefined {
  return registry.get(id)?.info
}

export function kill(id: string): Info | undefined {
  const entry = registry.get(id)
  if (!entry) return undefined
  if (entry.info.status !== "running") return entry.info
  if (entry.process) {
    try {
      if (process.platform !== "win32" && entry.process.pid) {
        process.kill(-entry.process.pid, "SIGTERM")
      } else {
        entry.process.kill("SIGTERM")
      }
      setTimeout(() => {
        if (entry.process && entry.process.exitCode === null) {
          try {
            if (process.platform !== "win32" && entry.process.pid) {
              process.kill(-entry.process.pid, "SIGKILL")
            } else {
              entry.process.kill("SIGKILL")
            }
          } catch {}
        }
      }, 3000)
    } catch {}
  }
  entry.info.status = "killed"
  entry.info.completedAt = Date.now()
  return entry.info
}

export function list(): Info[] {
  return Array.from(registry.values()).map((e) => e.info)
}

export function cleanup(maxAge = 30 * 60 * 1000): void {
  const now = Date.now()
  for (const [id, entry] of registry) {
    if (entry.info.status !== "running" && entry.info.completedAt && now - entry.info.completedAt > maxAge) {
      registry.delete(id)
    }
  }
}
