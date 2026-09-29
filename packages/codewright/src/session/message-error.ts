import { Schema } from "effect"
import { NamedError } from "@codewright-ai/core/util/error"

export const OutputLengthError = NamedError.create("MessageOutputLengthError", {})

export const AuthError = NamedError.create("ProviderAuthError", {
  providerID: Schema.String,
  message: Schema.String,
})

export const Shared = [AuthError.EffectSchema, NamedError.Unknown.EffectSchema, OutputLengthError.EffectSchema] as const
export const SharedSchema = Schema.Union(Shared)

/** @deprecated V1 message error types. Retained for legacy server compatibility; V2 uses @codewright-ai/core session error types. */
export * as MessageError from "./message-error"
