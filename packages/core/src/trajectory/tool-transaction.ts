export * as ToolTransaction from "./tool-transaction"

import { Context, Effect, Layer } from "effect"
import { makeGlobalNode } from "../effect/app-node"
import { Hash } from "../util/hash"
import { TrajectorySchema } from "./schema"
import { SideEffect } from "./side-effect"

/**
 * Tool executions are wrapped as reentrant transactions: the input fingerprint
 * is recorded before the call, and stdout/stderr/exit code/declared side
 * effects are packaged into the resulting Node payload afterwards.
 */

export interface ToolExecutionInput {
  readonly tool_name: string
  readonly tool_call_id?: string
  readonly input_payload: TrajectorySchema.JSONValue
  readonly state_snapshot?: TrajectorySchema.JSONValue
}

export interface ToolExecutionResult {
  readonly output_payload: TrajectorySchema.JSONValue
  readonly resource_usage?: TrajectorySchema.ResourceUsage
  readonly side_effects: readonly SideEffect.Declaration[]
}

export interface Interface {
  readonly run: (input: ToolExecutionInput) => Effect.Effect<ToolExecutionResult>
  /** Stable fingerprint of a tool call's inputs, for determinism checks. */
  readonly fingerprint: (input: ToolExecutionInput) => Effect.Effect<string>
}

export class Service extends Context.Service<Service, Interface>()("@codewright/v2/trajectory/ToolTransaction") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const fingerprint = Effect.fn("ToolTransaction.fingerprint")(function* (input: ToolExecutionInput) {
      return Hash.sha256(canonicalToolInput(input))
    })
    return Service.of({
      fingerprint,
      run: Effect.fn("ToolTransaction.run")(function* (input) {
        const inputFingerprint = yield* fingerprint(input)
        // The tool executor (Phase 3) fills output_payload/side_effects after
        // executing the wrapped capability; the transaction boundary guarantees
        // every tool call is recorded with its input fingerprint.
        return {
          output_payload: {},
          side_effects: [
            {
              kind: "external-call",
              target: input.tool_name,
              fingerprint: inputFingerprint,
              declared: true,
            },
          ],
        }
      }),
    })
  }),
)

export const node = makeGlobalNode({ service: Service, layer, deps: [] })

function canonicalToolInput(input: ToolExecutionInput): string {
  return [
    input.tool_name,
    input.tool_call_id ?? "",
    JSON.stringify(input.input_payload),
    input.state_snapshot === undefined ? "" : JSON.stringify(input.state_snapshot),
  ].join("|")
}
