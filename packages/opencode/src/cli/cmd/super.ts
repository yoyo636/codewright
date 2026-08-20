import { UI } from "../ui"
import { EOL } from "os"
import type { Argv } from "yargs"
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs"

function modeFilePath(): string {
  const xdgConfig = process.env.XDG_CONFIG_HOME || `${process.env.HOME}/.config`
  return `${xdgConfig}/codewright/mode`
}

function currentMode(): string {
  try {
    return readFileSync(modeFilePath(), "utf8").trim()
  } catch {
    return "normal"
  }
}

function writeMode(mode: string) {
  const file = modeFilePath()
  mkdirSync(file.substring(0, file.lastIndexOf("/")), { recursive: true })
  writeFileSync(file, mode, "utf8")
}

export const SuperCommand = {
  command: "super",
  describe: "switch to super mode (full system access, no permission prompts)",
  builder: (yargs: Argv) => yargs,
  handler: async () => {
    if (currentMode() === "super") {
      UI.println(UI.Style.TEXT_DIM + "Already in super mode" + UI.Style.TEXT_NORMAL)
      return
    }
    writeMode("super")
    UI.println()
    UI.println(UI.Style.TEXT_WARNING + " ⚠  Super mode grants codewright full system access" + UI.Style.TEXT_NORMAL)
    UI.println(UI.Style.TEXT_DIM + "    All permission prompts will be skipped." + UI.Style.TEXT_NORMAL)
    UI.println()
    UI.println(UI.Style.TEXT_SUCCESS_BOLD + " ✓ Switched to super mode" + UI.Style.TEXT_NORMAL)
  },
}

export const NormalCommand = {
  command: "normal",
  describe: "switch to normal mode (standard permission prompts)",
  builder: (yargs: Argv) => yargs,
  handler: async () => {
    if (currentMode() === "normal") {
      UI.println(UI.Style.TEXT_DIM + "Already in normal mode" + UI.Style.TEXT_NORMAL)
      return
    }
    writeMode("normal")
    UI.println(UI.Style.TEXT_SUCCESS_BOLD + " ✓ Switched to normal mode" + UI.Style.TEXT_NORMAL)
  },
}