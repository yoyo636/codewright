/**
 * Kernel hot-path micro-benchmark.
 *
 * Demonstrates the per-turn cost reduction from the history decode cache (slice 1)
 * and the incremental message-conversion cache (slice 3) in the session runner.
 *
 * Run: bun run script/bench-kernel.ts
 */
import { Schema } from "effect"
import { SessionMessage } from "@codewright-ai/schema/session-message"
import { toLLMMessages } from "@codewright-ai/core/session/runner/to-llm-message"
import type { Model } from "@codewright-ai/llm"

const N = 400 // messages in the synthetic history
const TURNS = 40 // simulated provider turns
const PER = N / TURNS // new messages added per turn

const decodeMessage = Schema.decodeUnknownSync(SessionMessage.Message)

const model = (id: string): Model => ({ provider: "test", id } as unknown as Model)

// Build a realistic history: alternating user messages and assistant messages
// that carry a completed tool call (the most expensive conversion path).
function buildHistory() {
  const raw: unknown[] = []
  for (let i = 0; i < N / 2; i++) {
    raw.push({
      id: `msg_u${i}`,
      type: "user",
      text: `Please read the file at path /repo/src/module-${i}.ts and explain it.`,
      time: { created: 0 },
    })
    raw.push({
      id: `msg_a${i}`,
      type: "assistant",
      agent: "build",
      model: { id: "m1", providerID: "test" },
      time: { created: 0 },
      content: [
        { type: "text", id: `p_t${i}`, text: `Reading module-${i}.ts now.` },
        {
          type: "tool",
          id: `p_r${i}`,
          name: "read",
          state: {
            status: "completed",
            input: { path: `/repo/src/module-${i}.ts` },
            content: [
              {
                type: "text",
                text: `// module ${i}\n` + `export const x${i} = ${i}\n`.repeat(40),
              },
            ],
            structured: {},
          },
          time: { created: 0 },
        },
      ],
    })
  }
  return { raw, decoded: raw.map((row) => decodeMessage(row)) }
}

const { raw: rawHistory, decoded: history } = buildHistory()
console.log(`built ${history.length} synthetic messages\n`)

// --- Part A: decode cost (slice 1 motivation) ---
// Every provider turn previously re-decoded the full history through the
// 213-line branded SessionMessage union. The decode cache now skips rows
// already decoded this process.
const tDecode = performance.now()
for (let i = 0; i < rawHistory.length; i++) decodeMessage(rawHistory[i])
const decodeMs = performance.now() - tDecode
console.log(`decode ${N} messages: ${decodeMs.toFixed(1)}ms (per-turn cost the cache now skips)`)

// --- Part C: K-turn accumulation, with-cache vs forced reconvert ---
// Same model across turns: each turn converts only the newly added messages
// (O(n) total over the run) because prior rows hit the conversion cache.
const tWith = performance.now()
for (let t = 1; t <= TURNS; t++) toLLMMessages(history.slice(0, t * PER), model("accumulate"))
const withMs = performance.now() - tWith

// Distinct model per turn: the cache key changes every turn, forcing a full
// reconversion of the growing history each turn (O(n^2) total) — a proxy for
// the pre-cache behavior.
const tForced = performance.now()
for (let t = 1; t <= TURNS; t++) toLLMMessages(history.slice(0, t * PER), model(`forced-${t}`))
const forcedMs = performance.now() - tForced

console.log(
  `\n${TURNS} turns accumulating to ${N} messages:` +
    `\n  with cache (stable model):   ${withMs.toFixed(1)}ms` +
    `\n  forced reconvert (old path): ${forcedMs.toFixed(1)}ms` +
    `\n  ratio: ${(forcedMs / withMs).toFixed(1)}x`,
)

// --- Part B: single-call cold vs warm ---
const tCold = performance.now()
toLLMMessages(history, model("cold"))
const coldMs = performance.now() - tCold

const tWarm = performance.now()
for (let i = 0; i < 50; i++) toLLMMessages(history, model("cold"))
const warmMs = performance.now() - tWarm

console.log(
  `\nsingle toLLMMessages over ${N} messages:` +
    `\n  cold (convert all):  ${coldMs.toFixed(1)}ms` +
    `\n  warm x50 (cache hit): ${warmMs.toFixed(2)}ms`,
)
