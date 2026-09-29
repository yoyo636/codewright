// V2-to-V1 event adapter.
//
// The V2 server (packages/server) publishes native V2 events through
// `/api/event` -- session.next.*, permission.v2.*, session.status, etc.
// The interactive-mode reducers (session-data.ts, subagent-data.ts) are
// written for the legacy V1 event shapes (message.part.*, permission.asked,
// session.error). Rather than rewriting both reducers (1113 + lines), this
// adapter translates V2 events into the V1 shapes they already understand.
//
// The translation is a thin structural mapping -- V2's explicit lifecycle
// events (text.started/delta/ended, tool.input.called/success/failed) map
// naturally onto V1's message/part model. The adapter maintains one piece of
// state: the tool name for each callID, because V2 separates tool naming
// (tool.input.started) from tool execution (tool.called).

import type { Event } from "@codewright-ai/sdk/v2"
import type {
  Message,
  Part,
  PermissionRequest,
  QuestionRequest,
  SessionMessage,
  SessionMessageAssistant,
  SessionMessageUser,
} from "@codewright-ai/sdk/v2"

// V2 events from the server's /api/event SSE stream. The shape is defined by
// the CodewrightEvent schema in @codewright-ai/protocol/groups/event; we only
// need the structural type here (type + data fields).
type V2 = { type: string; data: Record<string, unknown>; id?: string }
type V1 = Event

function payload(type: string, properties: Record<string, unknown>): V1 {
  return { type, properties } as unknown as V1
}

export function adaptV2Event(event: V2): V1 | undefined {
  const data = event.data as Record<string, unknown>
  switch (event.type) {
    // --- User prompt -----------------------------------------------------------------
    case "session.next.prompted": {
      const prompt = data.prompt as { text: string; files?: unknown[]; agents?: string[] }
      return payload("message.updated", {
        sessionID: data.sessionID,
        info: {
          id: data.messageID,
          sessionID: data.sessionID,
          role: "user",
          time: { created: data.timestamp },
          text: prompt.text,
          files: prompt.files,
          agents: prompt.agents,
        },
      })
    }

    // --- Assistant message lifecycle --------------------------------------------------
    case "session.next.step.started":
      return payload("message.updated", {
        sessionID: data.sessionID,
        info: {
          id: data.assistantMessageID,
          sessionID: data.sessionID,
          role: "assistant",
          agent: data.agent,
          model: data.model,
          content: [],
          time: { created: data.timestamp },
        },
      })

    case "session.next.step.ended":
      return payload("message.part.updated", {
        sessionID: data.sessionID,
        part: {
          id: data.assistantMessageID,
          messageID: data.assistantMessageID,
          sessionID: data.sessionID,
          type: "step-finish",
          reason: data.finish,
          cost: data.cost,
          tokens: data.tokens,
          snapshot: data.snapshot,
          time: { created: data.timestamp },
        },
      })

    case "session.next.step.failed":
      return payload("session.error", {
        sessionID: data.sessionID,
        error: data.error,
      })

    // --- Text streaming ---------------------------------------------------------------
    case "session.next.text.started":
      return payload("message.part.updated", {
        sessionID: data.sessionID,
        part: {
          id: data.textID,
          messageID: data.assistantMessageID,
          sessionID: data.sessionID,
          type: "text",
          text: "",
          time: { created: data.timestamp },
        },
      })

    case "session.next.text.delta":
      return payload("message.part.delta", {
        sessionID: data.sessionID,
        messageID: data.assistantMessageID,
        partID: data.textID,
        field: "text",
        delta: data.delta,
      })

    case "session.next.text.ended":
      return payload("message.part.updated", {
        sessionID: data.sessionID,
        part: {
          id: data.textID,
          messageID: data.assistantMessageID,
          sessionID: data.sessionID,
          type: "text",
          text: data.text,
          time: { created: data.timestamp },
        },
      })

    // --- Reasoning -------------------------------------------------------------------
    case "session.next.reasoning.started":
      return payload("message.part.updated", {
        sessionID: data.sessionID,
        part: {
          id: data.reasoningID,
          messageID: data.assistantMessageID,
          sessionID: data.sessionID,
          type: "reasoning",
          text: "",
          providerMetadata: data.providerMetadata,
          time: { created: data.timestamp },
        },
      })

    case "session.next.reasoning.delta":
      return payload("message.part.delta", {
        sessionID: data.sessionID,
        messageID: data.assistantMessageID,
        partID: data.reasoningID,
        field: "text",
        delta: data.delta,
      })

    case "session.next.reasoning.ended":
      return payload("message.part.updated", {
        sessionID: data.sessionID,
        part: {
          id: data.reasoningID,
          messageID: data.assistantMessageID,
          sessionID: data.sessionID,
          type: "reasoning",
          text: data.text,
          providerMetadata: data.providerMetadata,
          time: { created: data.timestamp },
        },
      })

    // --- Tool lifecycle --------------------------------------------------------------
    case "session.next.tool.input.started":
      return payload("message.part.updated", {
        sessionID: data.sessionID,
        part: {
          id: data.callID,
          messageID: data.assistantMessageID,
          sessionID: data.sessionID,
          type: "tool",
          callID: data.callID,
          tool: data.name,
          state: { status: "pending", input: "", raw: "" },
          time: { created: data.timestamp },
        },
      })

    case "session.next.tool.input.delta":
      return payload("message.part.delta", {
        sessionID: data.sessionID,
        messageID: data.assistantMessageID,
        partID: data.callID,
        field: "raw",
        delta: data.delta,
      })

    case "session.next.tool.input.ended":
      return payload("message.part.updated", {
        sessionID: data.sessionID,
        part: {
          id: data.callID,
          messageID: data.assistantMessageID,
          sessionID: data.sessionID,
          type: "tool",
          callID: data.callID,
          tool: "",
          state: { status: "pending", input: "", raw: data.text },
          time: { created: data.timestamp },
        },
      })

    case "session.next.tool.called":
      return payload("message.part.updated", {
        sessionID: data.sessionID,
        part: {
          id: data.callID,
          messageID: data.assistantMessageID,
          sessionID: data.sessionID,
          type: "tool",
          callID: data.callID,
          tool: data.tool,
          state: {
            status: "running",
            input: data.input,
            title: undefined,
            metadata: undefined,
            time: { start: data.timestamp },
          },
          provider: data.provider,
          time: { ran: data.timestamp },
        },
      })

    case "session.next.tool.progress":
      return payload("message.part.updated", {
        sessionID: data.sessionID,
        part: {
          id: data.callID,
          messageID: data.assistantMessageID,
          sessionID: data.sessionID,
          type: "tool",
          callID: data.callID,
          tool: "",
          state: {
            status: "running",
            input: {},
            title: undefined,
            metadata: data.structured,
            time: { start: data.timestamp },
          },
          structured: data.structured,
          content: data.content,
        },
      })

    case "session.next.tool.success":
      return payload("message.part.updated", {
        sessionID: data.sessionID,
        part: {
          id: data.callID,
          messageID: data.assistantMessageID,
          sessionID: data.sessionID,
          type: "tool",
          callID: data.callID,
          tool: "",
          state: {
            status: "completed",
            input: {},
            output: "",
            title: "",
            metadata: data.structured,
            time: { start: data.timestamp, end: data.timestamp },
          },
          structured: data.structured,
          content: data.content,
          result: data.result,
          provider: data.provider,
          time: { completed: data.timestamp },
        },
      })

    case "session.next.tool.failed":
      return payload("message.part.updated", {
        sessionID: data.sessionID,
        part: {
          id: data.callID,
          messageID: data.assistantMessageID,
          sessionID: data.sessionID,
          type: "tool",
          callID: data.callID,
          tool: "",
          state: {
            status: "error",
            input: {},
            error: String((data.error as { message?: string })?.message ?? data.error),
            metadata: undefined,
            time: { start: data.timestamp, end: data.timestamp },
          },
          result: data.result,
          provider: data.provider,
          time: { completed: data.timestamp },
        },
      })

    // --- Agent / model switches ------------------------------------------------------
    case "session.next.agent.switched":
      return payload("message.updated", {
        sessionID: data.sessionID,
        info: {
          id: data.messageID,
          sessionID: data.sessionID,
          role: "system",
          text: `agent switched to ${data.agent}`,
          time: { created: data.timestamp },
        },
      })

    case "session.next.model.switched": {
      const model = data.model as { providerID: string; modelID: string }
      return payload("message.updated", {
        sessionID: data.sessionID,
        info: {
          id: data.messageID,
          sessionID: data.sessionID,
          role: "system",
          text: `model switched to ${model.providerID}/${model.modelID}`,
          time: { created: data.timestamp },
        },
      })
    }

    // --- Compaction ------------------------------------------------------------------
    case "session.next.compaction.ended":
      return payload("message.updated", {
        sessionID: data.sessionID,
        info: {
          id: data.messageID,
          sessionID: data.sessionID,
          role: "system",
          text: data.text,
          time: { created: data.timestamp },
        },
      })

    // --- Permissions -----------------------------------------------------------------
    case "permission.v2.asked":
      return payload("permission.asked", {
        id: data.id,
        sessionID: data.sessionID,
        permission: data.action,
        patterns: data.resources,
        metadata: data.metadata,
        always: data.save ?? [],
        tool: data.source,
      })

    case "permission.v2.replied":
      return payload("permission.replied", {
        sessionID: data.sessionID,
        requestID: data.requestID,
        reply: data.reply,
      })

    // --- Pass-through (already V1-shaped or no V1 equivalent) ------------------------
    // V2 events carry their payload in `data`; the legacy reducers read from
    // `properties`. Wrap the data so sid()/applyEvent() keep working without
    // per-type handling. Events that have no V1 equivalent (reference.updated,
    // catalog.updated, ...) are harmlessly ignored by the reducers.
    case "session.next.shell.started":
    case "session.next.shell.ended":
    case "session.next.context.updated":
    case "session.next.synthetic":
    case "session.next.prompt.admitted":
    case "session.next.retried":
    case "session.next.compaction.started":
    case "session.next.compaction.delta":
    case "session.status":
    case "session.error":
    case "session.next.moved":
    case "reference.updated":
    case "integration.updated":
    case "catalog.updated":
    case "todo.updated":
    case "session.diff":
    case "session.deleted":
    case "session.updated":
    case "session.created":
    case "question.asked":
    case "question.replied":
    case "question.rejected":
    case "lsp.updated":
    case "vcs.branch.updated":
    case "server.instance.disposed":
    case "installation.updated":
    case "installation.update-available":
    case "command.executed":
    case "file.updated":
    case "file.watcher.updated":
    case "mcp.updated":
    case "plugin.updated":
    case "worktree.updated":
    case "workspace.updated":
    case "project.updated":
    case "project_directory.updated":
    case "pty.updated":
    case "revert.staged":
    case "revert.cleared":
    case "revert.committed":
      return payload(event.type, event.data as Record<string, unknown>)

    default:
      return undefined
  }
}

// --- V2 message / permission projection ------------------------------------------
//
// The interactive-mode reducers (session-data.ts, subagent-data.ts,
// session-replay.ts) consume the legacy V1 message shape
// ({ info: Message, parts: Part[] }) and the legacy PermissionRequest /
// QuestionRequest shapes. The V2 server projects session history as V2
// SessionMessage records (a tagged union) and publishes permission requests
// with `action`/`resources` instead of `permission`/`patterns`.
//
// These projectors translate V2 shapes back into the V1 shapes the reducers
// already understand, so history replay and bootstrap keep working on the V2
// kernel without rewriting the reducers. Only the fields the reducers actually
// read are projected; everything else is dropped.

type LegacyPart = Part
type LegacyMessage = Message

function textPart(sessionID: string, messageID: string, id: string, text: string, synthetic?: boolean): LegacyPart {
  return {
    id,
    sessionID,
    messageID,
    type: "text",
    text,
    ...(synthetic ? { synthetic: true } : {}),
  } as LegacyPart
}

function toolPart(
  sessionID: string,
  messageID: string,
  id: string,
  name: string,
  state: Record<string, unknown>,
): LegacyPart {
  return {
    id,
    sessionID,
    messageID,
    type: "tool",
    callID: id,
    tool: name,
    state: state as never,
  } as LegacyPart
}

function projectToolState(state: Record<string, unknown>): Record<string, unknown> {
  const status = state.status
  if (status === "pending") {
    return { status: "pending", input: {}, raw: String(state.input ?? "") }
  }
  if (status === "running") {
    return {
      status: "running",
      input: (state.input as Record<string, unknown>) ?? {},
      title: undefined,
      metadata: (state.structured as Record<string, unknown>) ?? undefined,
      time: { start: 0 },
    }
  }
  if (status === "completed") {
    return {
      status: "completed",
      input: (state.input as Record<string, unknown>) ?? {},
      output: String(state.result ?? ""),
      title: "",
      metadata: (state.structured as Record<string, unknown>) ?? {},
      time: { start: 0, end: 0 },
    }
  }
  if (status === "error") {
    const error = (state.error as { message?: string } | undefined)?.message ?? String(state.error ?? "")
    return {
      status: "error",
      input: (state.input as Record<string, unknown>) ?? {},
      error,
      metadata: (state.structured as Record<string, unknown>) ?? undefined,
      time: { start: 0, end: 0 },
    }
  }
  return { status, ...state }
}

function projectAssistantContent(
  sessionID: string,
  messageID: string,
  content: SessionMessageAssistant["content"],
): LegacyPart[] {
  const parts: LegacyPart[] = []
  for (const item of content) {
    if (item.type === "text") {
      parts.push(textPart(sessionID, messageID, item.id, item.text))
    } else if (item.type === "reasoning") {
      parts.push({
        id: item.id,
        sessionID,
        messageID,
        type: "reasoning",
        text: item.text,
        ...(item.providerMetadata ? { metadata: item.providerMetadata } : {}),
        ...(item.time ? { time: { start: item.time.created } } : {}),
      } as LegacyPart)
    } else if (item.type === "tool") {
      parts.push(
        toolPart(sessionID, messageID, item.id, item.name, projectToolState(item.state as Record<string, unknown>)),
      )
    }
  }
  return parts
}

export function projectV2Messages(
  messages: SessionMessage[],
  sessionID: string,
): Array<{ info: LegacyMessage; parts: LegacyPart[] }> {
  const out: Array<{ info: LegacyMessage; parts: LegacyPart[] }> = []
  for (const message of messages) {
    const id = message.id
    const created = message.time.created
    switch (message.type) {
      case "user": {
        const user = message as SessionMessageUser
        out.push({
          info: {
            id,
            sessionID,
            role: "user",
            time: { created },
            agent: user.agents?.[0]?.name ?? "build",
            model: { providerID: "openai", modelID: "gpt-5" },
          } as LegacyMessage,
          parts: user.text ? [textPart(sessionID, id, id, user.text, true)] : [],
        })
        break
      }
      case "assistant": {
        const assistant = message as SessionMessageAssistant
        const model = assistant.model
        out.push({
          info: {
            id,
            sessionID,
            role: "assistant",
            time: { created, ...(typeof assistant.time.completed === "number" ? { completed: assistant.time.completed } : {}) },
            modelID: model.id,
            providerID: model.providerID,
            mode: "build",
            ...(typeof assistant.cost === "number" ? { cost: assistant.cost } : {}),
            ...(assistant.tokens ? { tokens: assistant.tokens } : {}),
            ...(assistant.finish ? { finish: assistant.finish } : {}),
            ...(assistant.error ? { error: assistant.error } : {}),
          } as LegacyMessage,
          parts: projectAssistantContent(sessionID, id, assistant.content),
        })
        break
      }
      case "system": {
        out.push({
          info: {
            id,
            sessionID,
            role: "system",
            time: { created },
            text: message.text,
          } as unknown as LegacyMessage,
          parts: [textPart(sessionID, id, id, message.text, true)],
        })
        break
      }
      case "synthetic": {
        out.push({
          info: {
            id,
            sessionID,
            role: "system",
            time: { created },
            text: message.text,
          } as unknown as LegacyMessage,
          parts: [textPart(sessionID, id, id, message.text, true)],
        })
        break
      }
      case "shell": {
        out.push({
          info: {
            id,
            sessionID,
            role: "system",
            time: { created, ...(typeof message.time.completed === "number" ? { completed: message.time.completed } : {}) },
            text: `${message.command}\n${message.output}`,
          } as unknown as LegacyMessage,
          parts: [toolPart(sessionID, id, message.callID, "bash", {
            status: typeof message.time.completed === "number" ? "completed" : "running",
            input: { command: message.command },
            output: message.output,
            title: message.command,
            metadata: {},
            time: { start: created, end: message.time.completed ?? created },
          })],
        })
        break
      }
      case "agent-switched": {
        out.push({
          info: {
            id,
            sessionID,
            role: "system",
            time: { created },
            text: `agent switched to ${message.agent}`,
          } as unknown as LegacyMessage,
          parts: [textPart(sessionID, id, id, `agent switched to ${message.agent}`, true)],
        })
        break
      }
      case "model-switched": {
        const model = message.model
        out.push({
          info: {
            id,
            sessionID,
            role: "system",
            time: { created },
            text: `model switched to ${model.providerID}/${model.id}`,
          } as unknown as LegacyMessage,
          parts: [textPart(sessionID, id, id, `model switched to ${model.providerID}/${model.id}`, true)],
        })
        break
      }
      case "compaction": {
        out.push({
          info: {
            id,
            sessionID,
            role: "system",
            time: { created },
            text: message.summary,
          } as unknown as LegacyMessage,
          parts: [{
            id,
            sessionID,
            messageID: id,
            type: "compaction",
            auto: message.reason === "auto",
          } as LegacyPart],
        })
        break
      }
      default:
        break
    }
  }
  return out
}

export function projectV2PermissionRequest(request: {
  id: string
  sessionID: string
  action: string
  resources: Array<string>
  save?: Array<string>
  metadata?: Record<string, unknown>
  source?: { type: string; messageID: string; callID: string }
}): PermissionRequest {
  return {
    id: request.id,
    sessionID: request.sessionID,
    permission: request.action,
    patterns: request.resources,
    metadata: request.metadata ?? {},
    always: request.save ?? [],
    ...(request.source
      ? { tool: { messageID: request.source.messageID, callID: request.source.callID } }
      : {}),
  }
}

export function projectV2QuestionRequest(request: {
  id: string
  sessionID: string
  questions: Array<Record<string, unknown>>
  tool?: { messageID: string; callID: string }
}): QuestionRequest {
  return {
    id: request.id,
    sessionID: request.sessionID,
    questions: request.questions as never,
    ...(request.tool ? { tool: request.tool } : {}),
  } as QuestionRequest
}