import {
  LLM,
  LLMClient,
  LLMError,
  LLMEvent,
  Message,
  SystemPart,
  isContextOverflowFailure,
  type ProviderErrorEvent,
} from "@codewright-ai/llm"
import { Cause, DateTime, Effect, FiberSet, Layer, Option, Semaphore, Stream } from "effect"
import { eq } from "drizzle-orm"
import { AgentV2 } from "../../agent"
import { Config } from "../../config"
import { Database } from "../../database/database"
import { EventV2 } from "../../event"
import { Location } from "../../location"
import { ModelV2 } from "../../model"
import { PermissionV2 } from "../../permission"
import { ProviderV2 } from "../../provider"
import { QuestionV2 } from "../../question"
import { SystemContext } from "../../system-context/index"
import { SystemContextRegistry } from "../../system-context/registry"
import { SkillGuidance } from "../../skill/guidance"
import { ReferenceGuidance } from "../../reference/guidance"
import { ToolRegistry } from "../../tool/registry"
import { ToolOutputStore } from "../../tool-output-store"
import { SessionContextEpoch } from "../context-epoch"
import { SessionContextEpochTable } from "../sql"
import { SessionCompaction } from "../compaction"
import { SessionEvent } from "../event"
import { SessionHistory, clearDecodeCache } from "../history"
import { SessionInput } from "../input"
import { SessionSchema } from "../schema"
import { SessionStore } from "../store"
import { type RunError, Service } from "./index"
import { SessionRunnerModel } from "./model"
import { createLLMEventPublisher } from "./publish-llm-event"
import { toLLMMessages, clearConversionCache } from "./to-llm-message"
import { MAX_STEPS_PROMPT } from "./max-steps"
import { Hash } from "../../util/hash"
import { Snapshot } from "../../snapshot"
import { SessionStatusEvent } from "@codewright-ai/schema/session-status-event"
import { makeLocationNode } from "../../effect/app-node"
import { llmClient } from "../../effect/app-node-platform"
import { NodeStepper, PolicyStore, Trajectory, ToolTransaction, TrajectoryStore, Evolution, EvolutionCycle, SelfEvolution } from "../../trajectory"

/**
 * Runs one durable coding-agent Session until it settles.
 *
 * Keep this as orchestration over smaller collaborators rather than rebuilding the legacy
 * `SessionPrompt` monolith. Implement the unchecked items in small reviewed slices:
 *
 * - Session ownership and controls
 *   - [x] Coordinate one local active drain per Session; explicit resumes join and prompt wakeups coalesce.
 *   - [ ] Replace local ownership with durable multi-node ownership when clustered.
 *   - [ ] Mark busy, retrying, idle, interrupted, or terminal-failure status durably.
 *   - [ ] Honor interruption and reject stale work after runtime attachment replacement.
 *   - [x] Honor optional agent step limits.
 *   - [ ] Bound provider retries and repeated identical tool calls.
 *
 * - Runtime context assembly
 *   - Track V1 runtime-context parity canonically in `specs/v2/session.md`.
 *
 * - One provider turn
 *   - [x] Translate every projected V2 Session message variant into canonical
 *     `@codewright-ai/llm` messages.
 *   - [ ] Resolve policy-filtered built-in, MCP, plugin, and structured-output tool definitions.
 *   - [x] Stream exactly one `llm.stream(request)` provider turn.
 *   - [x] Persist assistant text and usage events incrementally as they arrive.
 *   - [ ] Persist snapshots, patches, and retry notices incrementally as they arrive.
 *   - [x] Persist reasoning, provider errors, and tool-call events incrementally as they arrive.
 *
 * - Tool settlement and continuation
 *   - [x] Durably record each tool call before side effects begin.
 *   - [x] Authorize and execute recorded local calls through a core-owned registry hook.
 *   - [x] Persist typed success, failure, and provider-executed tool outcomes.
 *   - [x] Start each recorded local call eagerly and await all settlements before continuation.
 *   - [ ] Add scoped runtime context, progress updates, attachment normalization,
 *     plugins, and cancellation settlement.
 *   - [x] Reload projected history and start the next explicit provider turn after local tool results.
 *   - [x] Continue for durable user steering accepted during an active provider turn.
 *   - [ ] Continue for compaction or another continuation condition when required.
 *
 * - Post-run maintenance
 *   - [ ] Settle final status and expose durable output events to replayable consumers.
 *   - [ ] Coalesce streamed deltas and add covering projected-history indexes.
 *   - [ ] Update title, summaries, compaction state, and cleanup in bounded background work.
 *
 * Use `llm.stream(request)` for each provider turn. Keep tool execution and continuation here.
 * Durable continuation recovery remains a separate future slice with an explicit retry policy.
 *
 * The current slice loads V2 history, translates it, resolves a model through a core service, and persists one
 * provider turn. Registry definitions are advertised, local tool calls are settled durably, and an
 * explicit loop starts the next provider turn after local settlement. Configured agent step limits bound the loop.
 */

type StepTokens = {
  input: number
  output: number
  reasoning: number
  cache: { read: number; write: number }
}

function computeCost(info: ModelV2.Info, tokens: StepTokens): number {
  const pricing = info.cost.find((c) => c.tier === undefined) ?? info.cost[0]
  if (!pricing) return 0
  const input = tokens.input * pricing.input
  const output = tokens.output * pricing.output
  const cacheRead = tokens.cache.read * pricing.cache.read
  const cacheWrite = tokens.cache.write * pricing.cache.write
  const reasoning = tokens.reasoning * pricing.output
  return Math.round((input + output + cacheRead + cacheWrite + reasoning) * 1_000_000) / 1_000_000
}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const events = yield* EventV2.Service
    const llm = yield* LLMClient.Service
    const agents = yield* AgentV2.Service
    const tools = yield* ToolRegistry.Service
    const models = yield* SessionRunnerModel.Service
    const store = yield* SessionStore.Service
    const location = yield* Location.Service
    const systemContext = yield* SystemContextRegistry.Service
    const skillGuidance = yield* SkillGuidance.Service
    const referenceGuidance = yield* ReferenceGuidance.Service
    const config = yield* Config.Service
    const snapshots = yield* Snapshot.Service
    const db = (yield* Database.Service).db
    const trajectory = yield* TrajectoryStore.Service
    const stepper = yield* NodeStepper.Service
    const toolTransaction = yield* ToolTransaction.Service
    const policyStore = yield* PolicyStore.Service
    const evolution = yield* Evolution.Service
    const evolutionCycle = yield* EvolutionCycle.Service
    const compaction = SessionCompaction.make({ events, llm, config: yield* config.entries() })
    const getSession = Effect.fn("SessionRunner.getSession")(function* (sessionID: SessionSchema.ID) {
      const session = yield* store.get(sessionID)
      if (!session) return yield* Effect.die(`Session not found: ${sessionID}`)
      return session
    })

    const getContext = Effect.fn("SessionRunner.getContext")(function* (sessionID: SessionSchema.ID) {
      return yield* store.context(sessionID)
    })
    /**
     * A task class is the stable intent of a session: agent + title. Two
     * sessions attempting the same task share a class, which is what makes
     * convergence (cross-graph strategy overlap) measurable.
     */
    const resolveTaskClass = Effect.fn("SessionRunner.resolveTaskClass")(function* (sessionID: SessionSchema.ID) {
      const session = yield* getSession(sessionID)
      return Hash.sha256(`${session.agent ?? "default"}:${session.title ?? ""}`)
    })
    const readEpoch = Effect.fn("SessionRunner.readEpoch")(function* (sessionID: SessionSchema.ID) {
      const row = yield* db
        .select({ baselineSeq: SessionContextEpochTable.baseline_seq })
        .from(SessionContextEpochTable)
        .where(eq(SessionContextEpochTable.session_id, sessionID))
        .get()
        .pipe(Effect.orDie)
      return row?.baselineSeq ?? 0
    })
    const failInterruptedTools = Effect.fn("SessionRunner.failInterruptedTools")(function* (
      sessionID: SessionSchema.ID,
    ) {
      let failed = false
      for (const message of yield* getContext(sessionID)) {
        if (message.type !== "assistant") continue
        for (const tool of message.content) {
          if (tool.type !== "tool" || (tool.state.status !== "pending" && tool.state.status !== "running")) continue
          yield* events.publish(SessionEvent.Tool.Failed, {
            sessionID,
            timestamp: yield* DateTime.now,
            assistantMessageID: message.id,
            callID: tool.id,
            error: { type: "unknown", message: "Tool execution interrupted" },
            provider: {
              executed: tool.provider?.executed === true,
              ...(tool.provider?.metadata === undefined ? {} : { metadata: tool.provider.metadata }),
            },
          })
          failed = true
        }
      }
      // The decode and conversion caches were populated by getContext above
      // with the pre-mutation state of any interrupted tools. Draining the
      // caches ensures the next turn loads the freshly-projected (failed) state.
      if (failed) {
        clearDecodeCache()
        clearConversionCache()
      }
    })

    const awaitToolFibers = (fibers: FiberSet.FiberSet<void, ToolOutputStore.Error>) =>
      Effect.raceFirst(FiberSet.join(fibers), FiberSet.awaitEmpty(fibers))

    // Match V1: declining a user prompt halts the loop instead of becoming model-facing tool output.
    const isUserDeclined = (cause: Cause.Cause<unknown>) =>
      cause.reasons.some(
        (reason) =>
          Cause.isDieReason(reason) &&
          (reason.defect instanceof PermissionV2.DeclinedError || reason.defect instanceof QuestionV2.RejectedError),
      )

    type TurnTransition =
      // Automatic compaction completed; rebuild the request from compacted history.
      | { readonly _tag: "ContinueAfterCompaction"; readonly step: number }
      // Overflow compaction completed; rebuild once through the path without overflow recovery.
      | { readonly _tag: "ContinueAfterOverflowCompaction"; readonly step: number }

    class TurnTransitionError extends Error {
      constructor(readonly transition: TurnTransition) {
        super()
      }
    }

    const continueAfterCompaction = (step: number) => new TurnTransitionError({ _tag: "ContinueAfterCompaction", step })
    const continueAfterOverflowCompaction = (step: number) =>
      new TurnTransitionError({ _tag: "ContinueAfterOverflowCompaction", step })

    const loadSystemContext = (agent: AgentV2.Selection) =>
      Effect.all([systemContext.load(), skillGuidance.load(agent), referenceGuidance.load()], {
        concurrency: "unbounded",
      }).pipe(Effect.map(SystemContext.combine))

    const runTurnAttempt = Effect.fn("SessionRunner.runTurn")(function* (
      sessionID: SessionSchema.ID,
      promotion: SessionInput.Delivery | undefined,
      step: number,
      recoverOverflow?: typeof compaction.compactAfterOverflow,
      policyTools?: readonly string[],
    ) {
      const session = yield* getSession(sessionID)
      if (session.location.directory !== location.directory || session.location.workspaceID !== location.workspaceID)
        return yield* Effect.interrupt
      const agent = yield* agents.select(session.agent)
      const initialized = yield* SessionContextEpoch.initialize(db, loadSystemContext(agent), session.id)
      const toolFibers = yield* FiberSet.make<void, ToolOutputStore.Error>()
      let needsContinuation = false
      let currentStep = step
      if (promotion) {
        const cutoff = yield* EventV2.latestSequence(db, session.id)
        let promoted = 0
        if (promotion === "steer") promoted = yield* SessionInput.promoteSteers(db, events, session.id, cutoff)
        if (promotion === "queue") {
          promoted += Number(yield* SessionInput.promoteNextQueued(db, events, session.id))
          promoted += yield* SessionInput.promoteSteers(db, events, session.id, cutoff)
        }
        if (promoted > 0) currentStep = 1
      }
      const system =
        initialized ?? (yield* SessionContextEpoch.prepare(db, events, loadSystemContext(agent), session.id))
      const resolved = yield* models.resolve(session)
      const model = resolved.model
      const modelInfo = resolved.info
      const entries = yield* SessionHistory.entriesForRunner(db, session.id, system.baselineSeq)
      const context = entries.map((entry) => entry.message)
      const isLastStep = agent.info?.steps !== undefined && currentStep >= agent.info.steps
      const toolMaterialization = isLastStep ? undefined : yield* tools.materialize(agent.info?.permissions)
      const promptCacheKey = /^ses_[0-9a-f]{64}$/.test(session.id) ? session.id.slice(4) : session.id
      const request = LLM.request({
        model,
        providerOptions: { openai: { promptCacheKey } },
        system: (() => {
          const parts = [agent.info?.system, system.baseline].filter(
            (part): part is string => part !== undefined && part.length > 0,
          )
          if (policyTools && policyTools.length > 0) {
            parts.push(
              `Preferred tool order for this task class: ${policyTools.join(" -> ")}. ` +
                "Follow it when it fits the current step; deviate only when the step genuinely requires a different tool.",
            )
          }
          return parts.map(SystemPart.make)
        })(),
        messages: [...toLLMMessages(context, model), ...(isLastStep ? [Message.assistant(MAX_STEPS_PROMPT)] : [])],
        tools: toolMaterialization?.definitions ?? [],
        toolChoice: isLastStep ? "none" : undefined,
      })
      if (yield* compaction.compactIfNeeded({ sessionID: session.id, entries, model, request }))
        return yield* Effect.die(continueAfterCompaction(currentStep))
      const startSnapshot = yield* snapshots.capture()
      const publisher = createLLMEventPublisher(events, {
        sessionID: session.id,
        agent: agent.id,
        model: {
          id: ModelV2.ID.make(model.id),
          providerID: ProviderV2.ID.make(model.provider),
          ...(session.model?.variant === undefined ? {} : { variant: session.model.variant }),
        },
        snapshot: startSnapshot,
      })
      const withPublication = Semaphore.makeUnsafe(1).withPermit
      const publish = (event: LLMEvent, outputPaths: ReadonlyArray<string> = []) =>
        withPublication(publisher.publish(event, outputPaths))
      let overflowFailure: ProviderErrorEvent | undefined
      const providerStream = llm.stream(request).pipe(
        Stream.runForEach((event) =>
          Effect.gen(function* () {
            if (overflowFailure || publisher.hasProviderError()) return
            if (LLMEvent.is.providerError(event)) {
              if (isContextOverflowFailure(event) && !publisher.hasAssistantStarted()) {
                overflowFailure = event
                return
              }
            }
            yield* publish(event)
            if (event.type !== "tool-call" || event.providerExecuted) return
            if (!toolMaterialization) {
              yield* withPublication(publisher.failUnsettledTools("Tools are disabled after the maximum agent steps"))
              return
            }
            needsContinuation = true
            const assistantMessageID = yield* publisher.assistantMessageID(event.id)
            yield* Effect.uninterruptibleMask((restore) =>
              restore(
                toolMaterialization.settle({
                  sessionID: session.id,
                  agent: agent.id,
                  assistantMessageID,
                  call: event,
                }),
              ).pipe(
                Effect.flatMap((settlement) =>
                  publish(
                    LLMEvent.toolResult({
                      id: event.id,
                      name: event.name,
                      result: settlement.result,
                      output: settlement.output,
                    }),
                    settlement.outputPaths ?? [],
                  ),
                ),
              ),
            ).pipe(FiberSet.run(toolFibers))
          }),
        ),
        Effect.ensuring(withPublication(publisher.flush())),
      )

      return yield* Effect.uninterruptibleMask((restore) =>
        Effect.gen(function* () {
          const stream = yield* restore(providerStream).pipe(Effect.exit)
          const failure =
            stream._tag === "Failure" ? Option.getOrUndefined(Cause.findErrorOption(stream.cause)) : undefined
          if (
            recoverOverflow &&
            !publisher.hasAssistantStarted() &&
            isContextOverflowFailure(overflowFailure ?? failure) &&
            (yield* restore(recoverOverflow({ sessionID: session.id, entries, model, request })))
          )
            return yield* Effect.die(continueAfterOverflowCompaction(currentStep))
          if (overflowFailure) yield* publish(overflowFailure)
          const llmFailure = failure instanceof LLMError ? failure : undefined
          if (llmFailure && !publisher.hasProviderError()) {
            yield* withPublication(publisher.failUnsettledTools("Provider did not return a tool result", true))
            yield* withPublication(publisher.failAssistant(llmFailure.reason.message))
          }
          if (stream._tag === "Failure" && Cause.hasInterrupts(stream.cause)) yield* FiberSet.clear(toolFibers)
          const settled = yield* restore(awaitToolFibers(toolFibers)).pipe(Effect.exit)
          if (settled._tag === "Failure" && isUserDeclined(settled.cause)) {
            yield* FiberSet.clear(toolFibers)
            yield* withPublication(publisher.failUnsettledTools("Tool execution interrupted"))
            return yield* Effect.interrupt
          }
          if (
            (stream._tag === "Failure" && Cause.hasInterrupts(stream.cause)) ||
            (settled._tag === "Failure" && Cause.hasInterrupts(settled.cause))
          ) {
            yield* FiberSet.clear(toolFibers)
            yield* withPublication(publisher.failUnsettledTools("Tool execution interrupted"))
            if (publisher.hasActiveAssistant())
              yield* withPublication(publisher.failAssistant("Provider turn interrupted"))
          }
          if (settled._tag === "Failure" && !Cause.hasInterrupts(settled.cause)) {
            const failure = Cause.squash(settled.cause)
            const message = failure instanceof Error ? failure.message : String(failure)
            yield* withPublication(publisher.failUnsettledTools(`Tool execution failed: ${message}`))
          }
          const stepSettlement = publisher.stepSettlement()
          if (stepSettlement && !publisher.hasProviderError()) {
            const endSnapshot = yield* snapshots.capture()
            const files =
              startSnapshot && endSnapshot
                ? yield* snapshots
                    .files({ from: startSnapshot, to: endSnapshot })
                    .pipe(Effect.catch(() => Effect.succeed(undefined)))
                : undefined
            const stepCost = computeCost(modelInfo, stepSettlement.tokens)
            yield* withPublication(
              events.publish(SessionEvent.Step.Ended, {
                sessionID: session.id,
                timestamp: yield* DateTime.now,
                assistantMessageID: yield* publisher.startAssistant(),
                finish: stepSettlement.finish,
                cost: stepCost,
                tokens: stepSettlement.tokens,
                snapshot: endSnapshot,
                files,
              }),
            )
          }
          if (publisher.hasProviderError())
            yield* withPublication(publisher.failUnsettledTools("Tool execution interrupted"))
          if (stream._tag === "Success" && !publisher.hasProviderError())
            yield* withPublication(publisher.failUnsettledTools("Provider did not return a tool result", true))
          if (stream._tag === "Failure") return yield* Effect.failCause(stream.cause)
          if (settled._tag === "Failure" && Cause.hasInterrupts(settled.cause))
            return yield* Effect.failCause(settled.cause)
          return { needsContinuation: !publisher.hasProviderError() && needsContinuation, step: currentStep }
        }),
      )
    }, Effect.scoped)
    type RunTurn = (
      sessionID: SessionSchema.ID,
      promotion: SessionInput.Delivery | undefined,
      step: number,
      policyTools?: readonly string[],
    ) => Effect.Effect<{ readonly needsContinuation: boolean; readonly step: number }, RunError>

    const runAfterOverflowCompaction: RunTurn = Effect.fnUntraced(function* (sessionID, promotion, step, policyTools) {
      return yield* runTurnAttempt(sessionID, promotion, step, undefined, policyTools).pipe(
        Effect.catchDefect(
          Effect.fnUntraced(function* (defect) {
            if (!(defect instanceof TurnTransitionError)) return yield* Effect.die(defect)
            if (defect.transition._tag === "ContinueAfterOverflowCompaction")
              return yield* Effect.die("Post-compaction provider attempt cannot recover another overflow")
            yield* Effect.yieldNow
            return yield* runAfterOverflowCompaction(sessionID, undefined, defect.transition.step, policyTools)
          }),
        ),
      )
    })

    const runTurn: RunTurn = Effect.fnUntraced(function* (sessionID, promotion, step, policyTools) {
      return yield* runTurnAttempt(sessionID, promotion, step, compaction.compactAfterOverflow, policyTools).pipe(
        Effect.catchDefect(
          Effect.fnUntraced(function* (defect) {
            if (!(defect instanceof TurnTransitionError)) return yield* Effect.die(defect)
            yield* Effect.yieldNow
            if (defect.transition._tag === "ContinueAfterOverflowCompaction")
              return yield* runAfterOverflowCompaction(sessionID, undefined, defect.transition.step, policyTools)
            return yield* runTurn(sessionID, undefined, defect.transition.step, policyTools)
          }),
        ),
      )
    })

    /**
     * Runs one provider turn and records it as an immutable trajectory node.
     *
     * The node's parent is the previous step node on the root branch, so the
     * execution graph is a chain that `restoreState` can walk to rebuild
     * context. The turn logic itself is unchanged; the append captures the
     * input (delivery + step), output (settlement), and the state snapshot
     * (context epoch) needed to resume from this node.
     */
    type StepPayload = {
      readonly sessionID: SessionSchema.ID
      readonly step: number
      readonly promotion: SessionInput.Delivery | undefined
    }
    type StepResult = { readonly needsContinuation: boolean; readonly step: number; readonly nodeId: string; readonly stepIndex: number }

    /**
     * Whether following a policy's tool sequence paid off. A step counts as a
     * miss when the model errored out or left tools unresolved — either way the
     * sequence did not get the run through its next step unaided.
     */
    const policySucceeded = (result: { readonly needsContinuation: boolean; readonly step: number }) =>
      result.step > 0 && result.needsContinuation

    const recordStep = Effect.fn("SessionRunner.recordStep")(function* (
      input: {
        readonly sessionID: SessionSchema.ID
        readonly graphID: string
        readonly parentID: string | undefined
        readonly parentStep: number
        readonly promotion: SessionInput.Delivery | undefined
        readonly step: number
      },
    ) {
      // Look up a validated policy for the state this step enters from. When
      // one hits, the runner follows the distilled tool sequence (softly, via
      // the system prompt) and marks the appended node with a `shortcut` edge
      // so the graph-differential self-evolution can measure convergence.
      const preEpoch = yield* readEpoch(input.sessionID)
      const taskClass = yield* resolveTaskClass(input.sessionID)
      const stateHash = Hash.sha256(
        TrajectoryStore.canonicalJson({
          session_id: input.sessionID,
          step: input.step,
          context_epoch: preEpoch,
        }),
      )
      const policy = yield* policyStore.lookup(stateHash, taskClass)
      const result = yield* runTurn(input.sessionID, input.promotion, input.step, policy?.tool_sequence)
      // Grade the policy we just followed. This is what keeps a distilled
      // sequence falsifiable: `PolicyStore.demote` retires one whose observed
      // success rate decays, so a stale policy cannot steer every future run.
      if (policy) {
        yield* policyStore.recordOutcome(policy.id, policySucceeded(result) ? "hit" : "miss").pipe(Effect.ignore)
      }
      const epoch = yield* readEpoch(input.sessionID)
      const payload: StepPayload = { sessionID: input.sessionID, step: input.step, promotion: input.promotion }
      const fingerprint = yield* toolTransaction.fingerprint({
        tool_name: "session.step",
        input_payload: payload as unknown as Trajectory.JSONValue,
      })
      const node = yield* trajectory
        .append({
          trajectory_id: input.graphID,
          branch_id: "root",
          parent_ids: input.parentID ? [input.parentID] : [],
          input_payload: payload as unknown as Trajectory.JSONValue,
          output_payload: result as unknown as Trajectory.JSONValue,
          state_snapshot: {
            session_id: input.sessionID,
            step: result.step,
            context_epoch: epoch,
          },
          step_index: input.parentStep + 1,
          extra_edges:
            policy && input.parentID ? [evolution.markShortcut(input.parentID)] : undefined,
          metadata: {
            annotations: {
              fingerprint,
              // Provenance for the graph-differential loop: which policy was
              // followed here and whether it was still validated when it was.
              // Failure itself is recorded by the tool layer via `status`, not
              // derived from continuation — a step that simply finished is not
              // a failure, and marking it so would collapse the fitness signal.
              ...(policy
                ? { policy_id: policy.id, task_class: taskClass, policy_validated: policy.validated }
                : {}),
            },
          },
        })
        .pipe(Effect.orDie)
      return { needsContinuation: result.needsContinuation, step: result.step, nodeId: node.id, stepIndex: node.step_index }
    })

    const run = Effect.fn("SessionRunner.run")(function* (input: {
      readonly sessionID: SessionSchema.ID
      readonly force: boolean
    }) {
      const hasSteer = yield* SessionInput.hasPending(db, input.sessionID, "steer")
      const hasQueue = hasSteer ? false : yield* SessionInput.hasPending(db, input.sessionID, "queue")
      if (!input.force && !hasSteer && !hasQueue) return
      yield* failInterruptedTools(input.sessionID)
      // Busy is published only after the early-exit gate: a queued prompt that
      // never reaches a provider turn stays idle, and the run coordinator's
      // single-drain-per-session guarantee keeps busy/idle pairs un-nested.
      yield* events.publish(SessionStatusEvent.Status, { sessionID: input.sessionID, status: { type: "busy" } })
      yield* Effect.gen(function* () {
        // Rebuild execution state from the durable trajectory before draining,
        // so a resumed session picks up where it left off. The runner derives
        // its immediate context from the EventV2 store; this restores the
        // trajectory-side snapshot that future state-externalized resumes use.
        const graph = yield* trajectory.forSession(input.sessionID)
        let last = yield* trajectory.lastNode(graph.id, "root")
        if (last) yield* stepper.restoreState(graph.id, last.id).pipe(Effect.ignore)
        let parentID = last?.id
        let parentStep = last?.step_index ?? -1
        let promotion: SessionInput.Delivery | undefined = hasSteer ? "steer" : hasQueue ? "queue" : undefined
        let shouldRun = input.force || hasSteer || hasQueue
        while (shouldRun) {
          let needsContinuation = true
          let step = 1
          while (needsContinuation) {
            const result = yield* recordStep({
              sessionID: input.sessionID,
              graphID: graph.id,
              parentID,
              parentStep,
              promotion,
              step,
            })
            parentID = result.nodeId
            parentStep = result.stepIndex
            needsContinuation = result.needsContinuation
            step = result.step + 1
            promotion = "steer"
            if (!needsContinuation) needsContinuation = yield* SessionInput.hasPending(db, input.sessionID, "steer")
          }
          shouldRun = yield* SessionInput.hasPending(db, input.sessionID, "queue")
          promotion = shouldRun ? "queue" : undefined
        }
      }).pipe(
        // ensuring (not just a trailing publish) so failure and interruption
        // exits still report idle; a publish failure must not mask the
        // original exit. Only the non-deprecated session.status is published.
        Effect.ensuring(
          events
            .publish(SessionStatusEvent.Status, { sessionID: input.sessionID, status: { type: "idle" } })
            .pipe(Effect.ignore),
        ),
      ).pipe(
        // Self-evolution runs after the session settles, never during it: the
        // runner must not block the user's next turn on graph comparison, and a
        // failed run must still publish idle before the cycle can observe the
        // graph it is about to score.
        Effect.ensuring(
          Effect.gen(function* () {
            const taskClass = yield* resolveTaskClass(input.sessionID)
            yield* Effect.forkDetach(evolutionCycle.run({ taskClass }).pipe(Effect.ignore))
          }).pipe(Effect.ignore),
        ),
      )
    })

    return Service.of({
      run,
    })
  }),
)

export const node = makeLocationNode({
  service: Service,
  layer,
  deps: [
    EventV2.node,
    llmClient,
    AgentV2.node,
    ToolRegistry.node,
    SessionRunnerModel.node,
    SessionStore.node,
    Location.node,
    SystemContextRegistry.node,
    SkillGuidance.node,
    ReferenceGuidance.node,
    Config.node,
    Snapshot.node,
    Database.node,
    TrajectoryStore.node,
    NodeStepper.node,
    ToolTransaction.node,
    PolicyStore.node,
    Evolution.node,
    EvolutionCycle.node,
    SelfEvolution.node,
  ],
})
