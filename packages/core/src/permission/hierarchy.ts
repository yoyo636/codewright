export * as PermissionMode from "./hierarchy"

import { Context, Effect, Layer } from "effect"
import { makeGlobalNode } from "../effect/app-node"
import { FSUtil } from "../fs-util"
import { Global } from "../global"
import { AppProcess } from "../process"
import path from "node:path"
import { ChildProcess } from "effect/unstable/process"

export type Mode = "normal" | "super"

export interface Interface {
  readonly get: () => Effect.Effect<Mode>
  readonly set: (mode: Mode) => Effect.Effect<void>
  readonly toggle: () => Effect.Effect<Mode>
  /** Check if sudo has been configured via sudoers file. */
  readonly canSudo: () => Effect.Effect<boolean>
  /** Run a command with sudo (only works in super mode when sudoers is configured). */
  readonly sudo: (command: string) => Effect.Effect<string, Error>
}

export class Service extends Context.Service<Service, Interface>()("@codewright/v2/PermissionMode") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const global = yield* Global.Service
    const fs = yield* FSUtil.Service
    const process = yield* AppProcess.Service
    const modeFile = path.join(global.config, "mode")
    const sudoersFile = "/etc/sudoers.d/codewright"

    const get = Effect.fn("PermissionMode.get")(function* () {
      const content = yield* fs.readFileStringSafe(modeFile).pipe(Effect.orDie)
      const mode = content?.trim()
      if (mode !== "normal" && mode !== "super") return "normal" as Mode
      return mode as Mode
    })

    const set = Effect.fn("PermissionMode.set")(function* (mode: Mode) {
      yield* fs.writeWithDirs(modeFile, mode).pipe(Effect.orDie)
    })

    const toggle = Effect.fn("PermissionMode.toggle")(function* () {
      const current = yield* get()
      const next: Mode = current === "normal" ? "super" : "normal"
      yield* set(next)
      return next
    })

    const canSudo = Effect.fn("PermissionMode.canSudo")(function* () {
      const exists = yield* fs.existsSafe(sudoersFile)
      return exists
    })

    const sudo = Effect.fn("PermissionMode.sudo")(function* (command: string) {
      const mode = yield* get()
      if (mode !== "super") return yield* Effect.fail(new Error("Super mode required for sudo"))
      const hasSudo = yield* canSudo()
      if (!hasSudo) return yield* Effect.fail(new Error("Sudoers not configured. Run the first-run wizard to set up."))
      const result = yield* process.run(
        ChildProcess.make("sudo", ["-n", ...command.split(" ").filter(Boolean)]),
      )
      if (result.exitCode !== 0) {
        return yield* Effect.fail(new Error(`sudo failed: ${result.stderr.toString("utf8")}`))
      }
      return result.stdout.toString("utf8")
    })

    return Service.of({ get, set, toggle, canSudo, sudo })
  }),
)

export const node = makeGlobalNode({ service: Service, layer, deps: [Global.node, FSUtil.node, AppProcess.node] })
