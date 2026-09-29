import { describe, expect, test } from "bun:test"
import { adaptV2Event } from "@/cli/cmd/run/v2-adapter"

describe("adaptV2Event", () => {
  test("translates text.started to message.part.updated", () => {
    const v2 = {
      type: "session.next.text.started",
      data: {
        sessionID: "ses_1",
        assistantMessageID: "msg_a1",
        textID: "prt_t1",
        timestamp: 1000,
      },
    }
    const v1 = adaptV2Event(v2)
    expect(v1).toEqual({
      type: "message.part.updated",
      properties: {
        sessionID: "ses_1",
        part: {
          id: "prt_t1",
          messageID: "msg_a1",
          sessionID: "ses_1",
          type: "text",
          text: "",
          time: { created: 1000 },
        },
      },
    })
  })

  test("translates text.delta to message.part.delta", () => {
    const v2 = {
      type: "session.next.text.delta",
      data: {
        sessionID: "ses_1",
        assistantMessageID: "msg_a1",
        textID: "prt_t1",
        delta: "hello",
        timestamp: 1000,
      },
    }
    const v1 = adaptV2Event(v2)
    expect(v1).toEqual({
      type: "message.part.delta",
      properties: {
        sessionID: "ses_1",
        messageID: "msg_a1",
        partID: "prt_t1",
        field: "text",
        delta: "hello",
      },
    })
  })

  test("translates text.ended to message.part.updated with final text", () => {
    const v2 = {
      type: "session.next.text.ended",
      data: {
        sessionID: "ses_1",
        assistantMessageID: "msg_a1",
        textID: "prt_t1",
        text: "final text",
        timestamp: 2000,
      },
    }
    const v1 = adaptV2Event(v2)
    expect(v1).toEqual({
      type: "message.part.updated",
      properties: {
        sessionID: "ses_1",
        part: {
          id: "prt_t1",
          messageID: "msg_a1",
          sessionID: "ses_1",
          type: "text",
          text: "final text",
          time: { created: 2000 },
        },
      },
    })
  })

  test("translates step.started to message.updated with assistant info", () => {
    const v2 = {
      type: "session.next.step.started",
      data: {
        sessionID: "ses_1",
        assistantMessageID: "msg_a1",
        agent: "build",
        model: { providerID: "anthropic", modelID: "claude-sonnet" },
        snapshot: "snap_1",
        timestamp: 1000,
      },
    }
    const v1 = adaptV2Event(v2)
    expect(v1).toEqual({
      type: "message.updated",
      properties: {
        sessionID: "ses_1",
        info: {
          id: "msg_a1",
          sessionID: "ses_1",
          role: "assistant",
          agent: "build",
          model: { providerID: "anthropic", modelID: "claude-sonnet" },
          content: [],
          time: { created: 1000 },
        },
      },
    })
  })

  test("translates tool.input.started to message.part.updated with pending state", () => {
    const v2 = {
      type: "session.next.tool.input.started",
      data: {
        sessionID: "ses_1",
        assistantMessageID: "msg_a1",
        callID: "call_1",
        name: "bash",
        timestamp: 1000,
      },
    }
    const v1 = adaptV2Event(v2)
    expect(v1).toEqual({
      type: "message.part.updated",
      properties: {
        sessionID: "ses_1",
        part: {
          id: "call_1",
          messageID: "msg_a1",
          sessionID: "ses_1",
          type: "tool",
          callID: "call_1",
          tool: "bash",
          state: { status: "pending", input: "", raw: "" },
          time: { created: 1000 },
        },
      },
    })
  })

  test("translates tool.called to message.part.updated with running state", () => {
    const v2 = {
      type: "session.next.tool.called",
      data: {
        sessionID: "ses_1",
        assistantMessageID: "msg_a1",
        callID: "call_1",
        tool: "bash",
        input: { command: "ls" },
        provider: { executed: true },
        timestamp: 1000,
      },
    }
    const v1 = adaptV2Event(v2)
    expect(v1).toEqual({
      type: "message.part.updated",
      properties: {
        sessionID: "ses_1",
        part: {
          id: "call_1",
          messageID: "msg_a1",
          sessionID: "ses_1",
          type: "tool",
          callID: "call_1",
          tool: "bash",
          state: {
            status: "running",
            input: { command: "ls" },
            title: undefined,
            metadata: undefined,
            time: { start: 1000 },
          },
          provider: { executed: true },
          time: { ran: 1000 },
        },
      },
    })
  })

  test("translates tool.success to message.part.updated with completed state", () => {
    const v2 = {
      type: "session.next.tool.success",
      data: {
        sessionID: "ses_1",
        assistantMessageID: "msg_a1",
        callID: "call_1",
        structured: {},
        content: [],
        result: "done",
        provider: { executed: true },
        timestamp: 2000,
      },
    }
    const v1 = adaptV2Event(v2)
    expect(v1?.type).toBe("message.part.updated")
    expect((v1 as any).properties.part.state.status).toBe("completed")
  })

  test("translates permission.v2.asked to permission.asked", () => {
    const v2 = {
      type: "permission.v2.asked",
      data: {
        id: "per_1",
        sessionID: "ses_1",
        action: "shell",
        resources: ["ls *"],
        metadata: {},
        source: { type: "tool", messageID: "msg_a1", callID: "call_1" },
        timestamp: 1000,
      },
    }
    const v1 = adaptV2Event(v2)
    expect(v1).toEqual({
      type: "permission.asked",
      properties: {
        id: "per_1",
        sessionID: "ses_1",
        permission: "shell",
        patterns: ["ls *"],
        metadata: {},
        always: [],
        tool: { type: "tool", messageID: "msg_a1", callID: "call_1" },
      },
    })
  })

  test("translates step.failed to session.error", () => {
    const v2 = {
      type: "session.next.step.failed",
      data: {
        sessionID: "ses_1",
        assistantMessageID: "msg_a1",
        error: { name: "APIError", message: "rate limited" },
        timestamp: 2000,
      },
    }
    const v1 = adaptV2Event(v2)
    expect(v1).toEqual({
      type: "session.error",
      properties: {
        sessionID: "ses_1",
        error: { name: "APIError", message: "rate limited" },
      },
    })
  })

  test("passes through session.status as properties", () => {
    const v2 = {
      type: "session.status",
      data: { sessionID: "ses_1", status: { type: "busy" } },
    }
    const v1 = adaptV2Event(v2)
    expect(v1).toEqual({
      type: "session.status",
      properties: { sessionID: "ses_1", status: { type: "busy" } },
    })
  })

  test("passes through session.next.shell.started as properties", () => {
    const v2 = {
      type: "session.next.shell.started",
      data: { sessionID: "ses_1", callID: "call_1", command: "ls", timestamp: 1000 },
    }
    const v1 = adaptV2Event(v2)
    expect(v1).toEqual({
      type: "session.next.shell.started",
      properties: { sessionID: "ses_1", callID: "call_1", command: "ls", timestamp: 1000 },
    })
  })

  test("returns undefined for unknown event types", () => {
    const v2 = { type: "unknown.event", data: {} }
    expect(adaptV2Event(v2 as any)).toBeUndefined()
  })
})