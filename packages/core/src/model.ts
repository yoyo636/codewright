import { Option, Types } from "effect"
import { Model } from "@opencode-ai/schema/model"
import { ProviderV2 } from "./provider"

export const ID = Model.ID
export type ID = typeof ID.Type

export const VariantID = Model.VariantID
export type VariantID = typeof VariantID.Type

// Grouping of models, eg claude opus, claude sonnet
export const Family = Model.Family
export type Family = Model.Family

export const Capabilities = Model.Capabilities
export type Capabilities = Model.Capabilities

export const Cost = Model.Cost

export const Ref = Model.Ref
export type Ref = typeof Ref.Type

export const Api = Model.Api
export type Api = Model.Api

export const Info = Model.Info
export type Info = Model.Info

export type MutableInfo = Omit<Types.DeepMutable<Info>, "api"> & {
  api: ProviderV2.MutableApi<Api>
}

export type Parsed = { providerID: ProviderV2.ID; modelID: ID }

export function parse(input: string): Option.Option<Parsed> {
  // A model reference must be "provider/model": a "/" with a non-empty provider
  // before it and a non-empty model after it. The model part may itself contain
  // further "/" characters. Naively splitting silently produces garbage (e.g.
  // "gpt-4" -> provider "gpt-4", model ""), which surfaces much later as a
  // confusing lookup failure. Return None so callers can skip the invalid entry.
  const idx = input.indexOf("/")
  if (idx <= 0 || idx === input.length - 1) {
    return Option.none()
  }
  return Option.some({
    providerID: ProviderV2.ID.make(input.slice(0, idx)),
    modelID: ID.make(input.slice(idx + 1)),
  })
}

export * as ModelV2 from "./model"
