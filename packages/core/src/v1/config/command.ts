export * as ConfigCommandV1 from "./command"

import { Schema } from "effect"

export const Info = Schema.Struct({
  template: Schema.String,
  description: Schema.optional(Schema.String),
  agent: Schema.optional(Schema.String),
  model: Schema.optional(Schema.String),
  variant: Schema.optional(Schema.String),
  subtask: Schema.optional(Schema.Boolean),
  argumentHint: Schema.optional(Schema.String).annotate({
    description: "Hint text shown in the UI when typing this command (e.g., '<file> <pattern>')",
  }),
})
export type Info = Schema.Schema.Type<typeof Info>
