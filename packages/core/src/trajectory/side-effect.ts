export * as SideEffect from "./side-effect"

import { Schema } from "effect"

/**
 * Any capability that cannot be expressed directly as a trajectory operation
 * (direct database mutation, external calls, filesystem writes, environment
 * mutation) must first be declared as a SideEffectDeclaration. Undeclared
 * side effects are not allowed to bypass the trajectory system.
 */

export const Kind = Schema.Literals(["db-mutation", "external-call", "fs-write", "env-mutation"])
export type Kind = Schema.Schema.Type<typeof Kind>

export const Declaration = Schema.Struct({
  kind: Kind,
  target: Schema.String,
  /** Canonical input fingerprint that identifies this effect invocation. */
  fingerprint: Schema.String,
  declared: Schema.Boolean,
})
export type Declaration = Schema.Schema.Type<typeof Declaration>
