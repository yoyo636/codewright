/** @deprecated V1 legacy event schema. Retained for legacy server compatibility; new code uses the V2 event model. */
export * as LegacyEvent from "./legacy-event"

import { Schema } from "effect"
import { define, inventory } from "../event"
import { SessionID } from "../session-id"
import { SessionV1 } from "./session"

export const CommandExecuted = define({
  type: "command.executed",
  schema: {
    name: Schema.String,
    sessionID: SessionID,
    arguments: Schema.String,
    messageID: SessionV1.MessageID,
  },
})

export const Definitions = inventory(CommandExecuted)
