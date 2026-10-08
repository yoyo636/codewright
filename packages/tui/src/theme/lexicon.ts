/**
 * The Aether Lexicon — codewright's status vocabulary.
 *
 * Every other agent tells you it is "thinking". codewright tells you what the
 * aether is doing. The vocabulary is deliberately closed: one word per phase,
 * each with a live form (in flight) and a settled form (landed), so a single
 * word carries both the phase and whether it has finished.
 *
 *   reasoning   Kindling → Kindled
 *   answer      Coursing → Coursed
 *   tools       Forging  → Forged
 *   loading     Attuning → Attuned
 *   compaction  Settling → Settled
 *
 * Transient states keep a single form: Relighting (retry), Quiescent (idle),
 * Eclipsed (failed), Sundered (interrupted).
 *
 * Rules for extending this file:
 *   - one word per phase, no synonyms, no generic verbs (no "processing")
 *   - live forms read as present participles, settled forms as past
 *   - phrases stay lower-case after the first word and end in an ellipsis when
 *     they describe work that is still in flight
 *
 * Keep this module dependency-free: the CLI (packages/codewright) imports it
 * through the `@codewright-ai/tui/theme/lexicon` export.
 */

export const lexicon = {
  /** Model reasoning, before the answer starts arriving. */
  reasoning: { active: "Kindling", settled: "Kindled" },
  /** The answer itself, streaming token by token. */
  answer: { active: "Coursing", settled: "Coursed" },
  /** Tool execution. */
  tool: { active: "Forging", settled: "Forged" },
  /** Boot, panel hydration, anything fetching before it can render. */
  load: { active: "Attuning", settled: "Attuned" },
  /** Context compaction. */
  compaction: { active: "Settling", settled: "Settled" },
  /** Provider retry backoff. */
  retry: "Relighting",
  /** Nothing in flight. */
  idle: "Quiescent",
  /** A failed turn. */
  error: "Eclipsed",
  /** A turn stopped by the user. */
  interrupt: "Sundered",
} as const

/** Longer copy. Sentence case, no exclamation marks, no emoji. */
export const phrases = {
  booting: "Attuning the aether…",
  booted: "Stepping through…",
  authorization: "Awaiting the handshake…",
  signal: "Awaiting the signal…",
  diff: "Reading the weave…",
  directories: "Attuning directories…",
  orgs: "Attuning orgs…",
  skill: "Invoking skill…",
  /** Default busy label for dialogs that do not name their own work. */
  working: "Coursing…",
} as const
