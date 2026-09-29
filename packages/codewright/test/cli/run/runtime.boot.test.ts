import { afterEach, describe, expect, mock, spyOn, test } from "bun:test"
import { CodewrightClient } from "@codewright-ai/sdk/v2"
import type { Resolved } from "@codewright-ai/tui/config"
import { TuiConfig } from "@/config/tui"
import { resolveDiffStyle, resolveModelInfo, resolveRunTuiConfig } from "@/cli/cmd/run/runtime.boot"
import { createTuiResolvedConfig } from "../../fixture/tui-runtime"

function model(id: string, providerID: string, context: number, variants?: Record<string, Record<string, never>>) {
  return {
    id,
    providerID,
    name: id,
    api: {
      id: providerID,
      type: "aisdk" as const,
      package: `@ai-sdk/${providerID}`,
      url: `https://${providerID}.test`,
    },
    capabilities: {
      temperature: true,
      reasoning: true,
      attachment: true,
      toolcall: true,
      input: { text: true, audio: false, image: false, video: false, pdf: false },
      output: { text: true, audio: false, image: false, video: false, pdf: false },
    },
    request: { headers: {}, body: {} },
    variants: Object.entries(variants ?? {}).map(([vid]) => ({ id: vid, headers: {}, body: {} })),
    time: { released: 0 },
    cost: [],
    status: "active" as const,
    enabled: true,
    limit: { context, output: 8192 },
  }
}

function provider(id: string, name: string) {
  return {
    id,
    name,
    api: { type: "aisdk" as const, package: `@ai-sdk/${id}` },
    request: { headers: {}, body: {} },
  }
}

function config(input?: {
  leader?: string
  leaderTimeout?: number
  diff_style?: "auto" | "stacked"
  bindings?: Partial<{
    commandList: string[]
    variantCycle: string[]
    interrupt: string[]
    historyPrevious: string[]
    historyNext: string[]
    inputClear: string[]
    inputSubmit: string[]
    inputNewline: string[]
  }>
}): Resolved {
  const bind = input?.bindings
  return createTuiResolvedConfig({
    diff_style: input?.diff_style,
    leader_timeout: input?.leaderTimeout,
    keybinds: {
      ...(input?.leader && { leader: input.leader }),
      ...(bind?.commandList && { command_list: bind.commandList }),
      ...(bind?.variantCycle && { variant_cycle: bind.variantCycle }),
      ...(bind?.interrupt && { session_interrupt: bind.interrupt }),
      ...(bind?.historyPrevious && { history_previous: bind.historyPrevious }),
      ...(bind?.historyNext && { history_next: bind.historyNext }),
      ...(bind?.inputClear && { input_clear: bind.inputClear }),
      ...(bind?.inputSubmit && { input_submit: bind.inputSubmit }),
      ...(bind?.inputNewline && { input_newline: bind.inputNewline }),
    },
  })
}

describe("run runtime boot", () => {
  afterEach(() => {
    mock.restore()
  })

  test("reads footer keybinds from resolved keybind config", async () => {
    spyOn(TuiConfig, "get").mockResolvedValue(
      config({
        leader: "ctrl+g",
        bindings: {
          commandList: ["ctrl+p"],
          variantCycle: ["ctrl+t", "alt+t"],
          interrupt: ["ctrl+c"],
          historyPrevious: ["k"],
          historyNext: ["j"],
          inputClear: ["ctrl+l"],
          inputSubmit: ["ctrl+s"],
          inputNewline: ["alt+return"],
        },
      }),
    )

    const result = await resolveRunTuiConfig()

    expect(result.keybinds.get("leader")?.[0]?.key).toBe("ctrl+g")
    expect(result.leader_timeout).toBe(2000)
    expect(result.keybinds.get("command.palette.show")?.[0]?.key).toBe("ctrl+p")
    expect(result.keybinds.get("variant.cycle").map((item) => item.key)).toEqual(["ctrl+t", "alt+t"])
    expect(result.keybinds.get("session.interrupt")?.[0]?.key).toBe("ctrl+c")
    expect(result.keybinds.get("prompt.history.previous")?.[0]?.key).toBe("k")
    expect(result.keybinds.get("prompt.history.next")?.[0]?.key).toBe("j")
    expect(result.keybinds.get("prompt.clear")?.[0]?.key).toBe("ctrl+l")
    expect(result.keybinds.get("input.submit")?.[0]?.key).toBe("ctrl+s")
    expect(result.keybinds.get("input.newline")?.[0]?.key).toBe("alt+return")
  })

  test("falls back to default tui keymap config when config load fails", async () => {
    spyOn(TuiConfig, "get").mockRejectedValue(new Error("boom"))

    const result = await resolveRunTuiConfig()

    expect(result.keybinds.get("leader")?.[0]?.key).toBe("ctrl+x")
    expect(result.leader_timeout).toBe(2000)
    expect(result.diff_style).toBe("auto")
    expect(result.keybinds.get("command.palette.show")?.[0]?.key).toBe("ctrl+p")
    expect(result.keybinds.get("variant.cycle")?.[0]?.key).toBe("ctrl+t")
    expect(result.keybinds.get("session.interrupt")?.[0]?.key).toBe("escape")
    expect(result.keybinds.get("prompt.history.previous")?.[0]?.key).toBe("up")
    expect(result.keybinds.get("prompt.history.next")?.[0]?.key).toBe("down")
    expect(result.keybinds.get("prompt.clear")?.[0]?.key).toBe("ctrl+c")
    expect(result.keybinds.get("input.submit")?.[0]?.key).toBe("return")
    expect(result.keybinds.get("input.newline")?.[0]?.key).toBe("shift+return,ctrl+return,alt+return,ctrl+j")
  })

  test("preserves disabled leader from resolved tui config", async () => {
    spyOn(TuiConfig, "get").mockResolvedValue(config({ leader: "none" }))

    const result = await resolveRunTuiConfig()

    expect(result.keybinds.get("leader")).toEqual([])
  })

  test("reads diff style and falls back to auto", async () => {
    spyOn(TuiConfig, "get").mockResolvedValue(config({ diff_style: "stacked" }))
    await expect(resolveDiffStyle()).resolves.toBe("stacked")

    mock.restore()
    spyOn(TuiConfig, "get").mockRejectedValue(new Error("boom"))
    await expect(resolveDiffStyle()).resolves.toBe("auto")
  })

  test("projects provider and model lists into the model selector data", async () => {
    const sdk = new CodewrightClient()
    const providers = [provider("openai", "OpenAI"), provider("anthropic", "Anthropic")]
    const models = [
      model("gpt-5", "openai", 128000, { high: {}, minimal: {} }),
      model("sonnet", "anthropic", 200000),
    ]
    const location = { directory: "/workspace", project: { id: "p", directory: "/workspace" } }
    spyOn(sdk.v2.provider, "list").mockImplementation(() =>
      Promise.resolve({
        data: { location, data: providers },
        error: undefined,
        request: new Request("https://codewright.test"),
        response: new Response(),
      } as any),
    )
    spyOn(sdk.v2.model, "list").mockImplementation(() =>
      Promise.resolve({
        data: { location, data: models },
        error: undefined,
        request: new Request("https://codewright.test"),
        response: new Response(),
      } as any),
    )

    await expect(resolveModelInfo(sdk, "/workspace", { providerID: "openai", modelID: "gpt-5" })).resolves.toEqual({
      providers: [
        {
          id: "openai",
          name: "OpenAI",
          models: {
            "gpt-5": {
              id: "gpt-5",
              name: "gpt-5",
              status: "active",
              limit: { context: 128000 },
              variants: { high: { headers: {}, body: {} }, minimal: { headers: {}, body: {} } },
              cost: undefined,
            },
          },
        },
        {
          id: "anthropic",
          name: "Anthropic",
          models: {
            sonnet: {
              id: "sonnet",
              name: "sonnet",
              status: "active",
              limit: { context: 200000 },
              variants: {},
              cost: undefined,
            },
          },
        },
      ],
      variants: ["high", "minimal"],
      limits: {
        "openai/gpt-5": 128000,
        "anthropic/sonnet": 200000,
      },
    })
  })

  test("falls back to an empty catalog when the model list is unavailable", async () => {
    const sdk = new CodewrightClient()
    const providers = [provider("openai", "OpenAI")]
    const location = { directory: "/workspace", project: { id: "p", directory: "/workspace" } }
    spyOn(sdk.v2.provider, "list").mockImplementation(() =>
      Promise.resolve({
        data: { location, data: providers },
        error: undefined,
        request: new Request("https://codewright.test"),
        response: new Response(),
      } as any),
    )
    spyOn(sdk.v2.model, "list").mockRejectedValue(new Error("boom"))

    await expect(resolveModelInfo(sdk, "/workspace", { providerID: "openai", modelID: "gpt-5" })).resolves.toEqual({
      providers: [
        {
          id: "openai",
          name: "OpenAI",
          models: {},
        },
      ],
      variants: [],
      limits: {},
    })
  })
})
