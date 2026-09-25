import { run as runTui, type TuiInput } from "@codewright-ai/tui"
import { Global } from "@codewright-ai/core/global"
import { AppNodeBuilder } from "@codewright-ai/core/effect/app-node-builder"
import { Effect } from "effect"

export function run(input: TuiInput) {
  return runTui(input).pipe(Effect.provide(AppNodeBuilder.build(Global.node)))
}
