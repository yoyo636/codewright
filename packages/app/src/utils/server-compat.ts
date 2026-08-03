// @ts-nocheck -- v1 protocol compatibility shim: maps legacy v1 client methods to v2 SDK surface; full v2 refactor is tracked separately.
import type { ServerApi } from "./server"
import type { ServerProtocol } from "./server-protocol"
import type { CodewrightClient, Session } from "@codewright-ai/sdk/v2/client"
import type { SessionInfo } from "@codewright-ai/client/promise"

type LegacyClient = any
type LegacyFor = (directory?: string) => LegacyClient

type LegacyLocation = { directory?: string }
type LegacyPrompt = {
  agent?: string
  model?: { providerID: string; modelID?: string; id?: string; variant?: string }
  variant?: string
  legacyParts?: any[]
}

type SessionListInput = {
  directory?: string
  workspace?: string
  parentID?: string | null
  search?: string
  limit?: number
  order?: "asc" | "desc"
  cursor?: string
  roots?: boolean | "true" | "false"
  scope?: "project"
  path?: string
  start?: number
}
type SessionListResult = { data: SessionInfo[]; cursor: { next?: string } }

type SessionCreateInput = {
  directory?: string
  workspace?: string
  parentID?: string
  title?: string
  agent?: string
  model?: { id: string; providerID: string; variant?: string }
  metadata?: Record<string, unknown>
  permission?: unknown
  location?: LegacyLocation
}
type SessionGetInput = { sessionID: string; directory?: string }
type SessionForkInput = { sessionID: string; messageID?: string }
type SessionInterruptInput = { sessionID: string }
type SessionRenameInput = { sessionID: string; title?: string; directory?: string }
type SessionRemoveInput = { sessionID: string; directory?: string }
type SessionPromptInput = {
  sessionID: string
  id?: string
  text?: string
  files?: any[]
  agents?: any[]
  delivery?: "steer" | "queue"
}
type SessionCommandInput = {
  sessionID: string
  id?: string
  command: string
  arguments?: string
  agent?: string
  model?: { providerID: string; id: string; variant?: string }
  files?: any[]
  delivery?: "steer" | "queue"
}
type SessionShellInput = { sessionID: string; id?: string; command: string; agent?: string; model?: LegacyPrompt["model"] }
type SessionCompactInput = { sessionID: string; id?: string; model?: LegacyPrompt["model"] }

type RevertStageInput = { sessionID: string; messageID: string; directory?: string }
type RevertClearInput = { sessionID: string; directory?: string }
type RevertCommitInput = { sessionID: string; directory?: string }

type FileListInput = { directory?: string; path?: string; location?: LegacyLocation }
type FileListNode = { absolute: string; path: string; type: "file" | "directory" }
type FileListResult = { data: FileListNode[]; location?: { directory: string } }
type FileFindInput = {
  directory?: string
  query: string
  type?: "file" | "directory"
  limit?: number
  location?: LegacyLocation
}
type FileFindResult = { data: FileListNode[]; location?: { directory: string } }

type PtyInfo = { id: string; title?: string; command?: string; cwd?: string; status?: string }
type PtyListResult = { data: PtyInfo[]; location?: { directory: string } }
type PtyResult = { data: PtyInfo; location?: { directory: string } }
type PtyCreateInput = {
  command?: string
  args?: string[]
  cwd?: string
  title?: string
  env?: Record<string, string>
  location?: LegacyLocation
}
type PtyUpdateInput = {
  ptyID: string
  title?: string
  size?: { rows: number; cols: number }
  directory?: string
  location?: LegacyLocation
}
type PtyRemoveInput = { ptyID: string; directory?: string; location?: LegacyLocation }
type PtyGetInput = { ptyID: string; directory?: string; location?: LegacyLocation }

type VcsStatusInput = { location?: LegacyLocation; directory?: string }
type VcsDiffInput = { directory?: string; mode: "git" | "branch"; context?: number; location?: LegacyLocation }
type VcsFileDiffInfo = {
  file: string
  patch?: string
  additions: number
  deletions: number
  status?: "added" | "deleted" | "modified"
}
type VcsResult<T> = { data: T; location: { directory: string; project: { id: string; directory: string } } }

type ProjectCurrentResult = { id: string; directory: string }
type ProjectListInput = { directory?: string; location?: LegacyLocation }
type ProjectDirectoriesInput = {
  location?: LegacyLocation
  projectID?: string
  directory?: string
}

export type IntegrationMethods = { type: "key" | "oauth"; label?: string; id?: string; prompts?: any[] }[]
export type IntegrationInfo = {
  id: string
  name: string
  methods: IntegrationMethods
  connections: any[]
}
export type IntegrationGetInput = { integrationID: string; location?: LegacyLocation }
export type IntegrationGetResult = { data: IntegrationInfo; location: { directory: string } }
export type IntegrationKeyInput = { integrationID: string; key: string; location?: LegacyLocation }
export type OAuthConnectInput = {
  integrationID: string
  methodID: string
  inputs?: Record<string, string>
  location?: LegacyLocation
}
export type OAuthAttempt = {
  attemptID: string
  url: string
  instructions: string
  mode: "auto" | "code"
  time: { created: number; expires: number }
}
export type OAuthConnectResult = { data: OAuthAttempt; location: { directory: string } }
export type OAuthCompleteInput = { integrationID: string; attemptID: string; code: string; location?: LegacyLocation }
export type OAuthStatusInput = { integrationID: string; attemptID: string; location?: LegacyLocation }

type PermissionReplyInput = {
  sessionID: string
  requestID: string
  reply: "allow" | "deny" | "always"
  directory?: string
  location?: LegacyLocation
}
type PermissionRequestInput = {
  sessionID: string
  id?: string
  action?: string
  resources?: string[]
  save?: string[]
  metadata?: Record<string, unknown>
  source?: string
  agent?: string
  location?: LegacyLocation
}

type QuestionReplyInput = {
  sessionID?: string
  requestID: string
  answers: string[][]
  location?: LegacyLocation
}
type QuestionRejectInput = { sessionID?: string; requestID: string; location?: LegacyLocation }

type CompatibleSessionApi = {
  list: (value?: SessionListInput, options?: any) => Promise<SessionListResult>
  create: (value?: SessionCreateInput) => Promise<SessionInfo>
  get: (value: SessionGetInput) => Promise<SessionInfo>
  active: () => Promise<Record<string, { type: "running" }>>
  rename: (value: SessionRenameInput) => Promise<any>
  remove: (value: SessionRemoveInput) => Promise<any>
  fork: (value: SessionForkInput) => Promise<SessionInfo>
  interrupt: (value: SessionInterruptInput) => Promise<any>
  prompt: (value: SessionPromptInput & LegacyPrompt) => Promise<any>
  command: (value: SessionCommandInput & LegacyPrompt) => Promise<any>
  shell: (value: SessionShellInput & LegacyPrompt) => Promise<any>
  compact: (value: SessionCompactInput & { model?: LegacyPrompt["model"] }) => Promise<any>
  revert: {
    stage: (value: RevertStageInput) => Promise<{ messageID: string }>
    clear: (value: RevertClearInput) => Promise<any>
    commit: (value: RevertCommitInput) => Promise<any>
  }
  sync: (sessionID: string, options?: { force?: boolean }) => Promise<any>
  history: any
  todo: any
  evict: (sessionID: string) => void
  archive: (value: any) => Promise<any>
  unarchive: (value: any) => Promise<any>
  share: (value: any) => Promise<any>
  unshare: (value: any) => Promise<any>
  abort: (value: any) => Promise<any>
  fetch: (count?: number) => Promise<any>
  more: any
  init: (value: any) => Promise<any>
}
type CompatiblePermissionApi = {
  list: (input: { sessionID?: string; location?: LegacyLocation; directory?: string }) => Promise<{ data: any[] }>
  request: {
    list: (input: { sessionID?: string; location?: LegacyLocation; directory?: string }) => Promise<{ data: any[] }>
    get: (input: { sessionID: string; requestID: string; directory?: string }) => Promise<any>
    create: (input: PermissionRequestInput) => Promise<any>
    reply: (input: PermissionReplyInput) => Promise<any>
  }
  reply: (input: PermissionReplyInput) => Promise<any>
  get: (input: { sessionID: string; requestID: string; directory?: string }) => Promise<any>
}
type CompatibleQuestionApi = {
  list: (input: { sessionID: string; directory?: string }) => Promise<{ data: any[] }>
  reply: (input: QuestionReplyInput) => Promise<any>
  reject: (input: QuestionRejectInput) => Promise<any>
}
type CompatibleFileApi = {
  read: (input: { path: string; directory?: string; location?: LegacyLocation }) => Promise<any>
  stat: (input: { path: string; directory?: string; location?: LegacyLocation }) => Promise<any>
  list: (input?: FileListInput) => Promise<FileListResult>
  find: (input: FileFindInput, options?: any) => Promise<FileFindResult>
}
type CompatiblePtyApi = {
  list: (input?: { location?: LegacyLocation }) => Promise<PtyListResult>
  create: (input?: PtyCreateInput) => Promise<PtyResult>
  get: (input: PtyGetInput) => Promise<PtyResult>
  update: (input: PtyUpdateInput) => Promise<PtyResult>
  remove: (input: PtyRemoveInput) => Promise<any>
}
type CompatibleVcsApi = {
  status: (input?: VcsStatusInput) => Promise<VcsResult<VcsFileStatusItem[]>>
  diff: (input: VcsDiffInput) => Promise<VcsResult<VcsFileDiffInfo[]>>
}
type VcsFileStatusItem = { file: string; status?: string }
type CompatibleProjectApi = {
  list: (input?: ProjectListInput) => Promise<{ data: any[] }>
  current: (input?: { location?: LegacyLocation; directory?: string }) => Promise<ProjectCurrentResult>
  directories: (
    input: ProjectDirectoriesInput,
  ) => Promise<{ data: { directory: string }[] }>
}
type CompatibleIntegrationApi = {
  get: (input: IntegrationGetInput) => Promise<IntegrationGetResult>
  list: (input?: { location?: LegacyLocation }) => Promise<{ data: IntegrationInfo[] }>
  connect: {
    key: (input: IntegrationKeyInput) => Promise<any>
  }
  oauth: {
    connect: (input: OAuthConnectInput) => Promise<OAuthConnectResult>
    complete: (input: OAuthCompleteInput) => Promise<any>
    status: (input: OAuthStatusInput) => Promise<any>
  }
}

export type CompatibleApi = Omit<
  ServerApi,
  "session" | "permission" | "file" | "pty" | "vcs" | "project" | "integration" | "question"
> & {
  readonly session: CompatibleSessionApi
  readonly permission: CompatiblePermissionApi
  readonly question: CompatibleQuestionApi
  readonly file: CompatibleFileApi
  readonly pty: CompatiblePtyApi
  readonly vcs: CompatibleVcsApi
  readonly project: CompatibleProjectApi
  readonly integration: CompatibleIntegrationApi
}
type CompatibleInput = {
  protocol: Promise<ServerProtocol>
  current: ServerApi
  legacy: LegacyFor
  directory?: string
}

function mime(uri: string) {
  const match = /^data:([^;,]+)/.exec(uri)
  return match?.[1] ?? "application/octet-stream"
}

function sessionInfo(session: Session): SessionInfo {
  return {
    id: session.id,
    parentID: session.parentID,
    projectID: session.projectID,
    agent: session.agent,
    model: session.model && {
      id: session.model.id,
      providerID: session.model.providerID,
      variant: session.model.variant,
    },
    cost: session.cost ?? 0,
    tokens: session.tokens ?? { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    time: session.time,
    title: session.title,
    location: { directory: session.directory, workspaceID: session.workspaceID },
    subpath: session.path,
    revert: session.revert && {
      messageID: session.revert.messageID,
      partID: session.revert.partID,
      snapshot: session.revert.snapshot,
    },
  }
}

export function createCompatibleApi(input: CompatibleInput): CompatibleApi {
  const v1 = createV1Api(input)
  return lazyApi(
    input.protocol.then((protocol) => (protocol === "v1" ? v1 : input.current)),
    input.current,
  )
}

function lazyApi<T extends object>(implementation: Promise<T>, shape: T): T {
  const cache = new Map<PropertyKey, unknown>()
  return new Proxy(shape, {
    get(target, property, receiver) {
      const sample = Reflect.get(target, property, receiver)
      if (typeof sample === "function") {
        return (...args: unknown[]) =>
          implementation.then((value) => {
            const method = Reflect.get(value, property)
            if (typeof method !== "function") throw new Error(`API method unavailable: ${String(property)}`)
            return Reflect.apply(method, value, args)
          })
      }
      if (sample === null || typeof sample !== "object") return sample
      if (cache.has(property)) return cache.get(property)
      const nested = lazyApi(
        implementation.then((value) => {
          const result = Reflect.get(value, property)
          if (result === null || typeof result !== "object") {
            throw new Error(`API namespace unavailable: ${String(property)}`)
          }
          return result
        }),
        sample,
      )
      cache.set(property, nested)
      return nested
    },
  })
}

function createV1Api(input: CompatibleInput): any {
  const directory = (location?: { directory?: string }) => location?.directory ?? input.directory
  const legacy = (location?: { directory?: string }) => input.legacy(directory(location))
  const located = <T>(data: T, value?: { directory?: string }) => ({
    location: {
      directory: directory(value) ?? "",
      project: { id: "", directory: directory(value) ?? "" },
    },
    data,
  })

  return {
    ...input.current,
    session: {
      ...input.current.session,
      async list(
        value?: Parameters<ServerApi["session"]["list"]>[0],
        options?: Parameters<ServerApi["session"]["list"]>[1],
      ) {
        if (!value?.directory && value?.search !== undefined) {
          const result = await legacy().experimental.session.list(
            {
              roots: value.parentID === null ? true : undefined,
              search: value.search,
              limit: value.limit,
            },
            options,
          )
          return { data: (result.data ?? []).map(sessionInfo), cursor: {} }
        }
        const result = await legacy({ directory: value?.directory }).session.list({
          directory: value?.directory,
          roots: value?.parentID === null ? true : undefined,
          search: value?.search,
          limit: value?.limit,
        })
        return { data: (result.data ?? []).map(sessionInfo), cursor: {} }
      },
      async create(value?: Parameters<ServerApi["session"]["create"]>[0]) {
        const result = await legacy(value?.location ?? undefined).session.create({
          directory: directory(value?.location ?? undefined),
        })
        if (!result.data) throw new Error("Failed to create session")
        return sessionInfo(result.data)
      },
      async get(value: Parameters<ServerApi["session"]["get"]>[0]) {
        const result = await legacy().session.get(value)
        if (!result.data) throw new Error(`Session not found: ${value.sessionID}`)
        return sessionInfo(result.data)
      },
      async active() {
        const result = await legacy().session.status()
        return Object.fromEntries(
          Object.entries(result.data ?? {}).flatMap(([sessionID, status]) =>
            status.type === "idle" ? [] : [[sessionID, { type: "running" as const }]],
          ),
        )
      },
      async rename(value: Parameters<ServerApi["session"]["rename"]>[0] & LegacyLocation) {
        await legacy(value).session.update({ sessionID: value.sessionID, title: value.title })
      },
      // async archive(value: Parameters<ServerApi["session"]["archive"]>[0] & LegacyLocation) {
      //   await legacy(value).session.update({ sessionID: value.sessionID, time: { archived: Date.now() } })
      // },
      async remove(value: Parameters<ServerApi["session"]["remove"]>[0] & LegacyLocation) {
        await legacy(value).session.delete(value)
      },
      async fork(value: Parameters<ServerApi["session"]["fork"]>[0]) {
        const result = await legacy().session.fork(value)
        if (!result.data) throw new Error("Failed to fork session")
        return sessionInfo(result.data)
      },
      async interrupt(value: Parameters<ServerApi["session"]["interrupt"]>[0]) {
        await legacy().session.abort(value)
      },
      async prompt(value: SessionPromptInput & LegacyPrompt) {
        await legacy().session.promptAsync({
          sessionID: value.sessionID,
          messageID: value.id ?? undefined,
          agent: value.agent,
          model: value.model,
          variant: value.variant,
          parts: value.legacyParts ?? [
            { type: "text", text: value.text },
            ...(value.files ?? []).map((file) => ({
              type: "file" as const,
              mime: file.mention ? "text/plain" : mime(file.uri),
              url: file.uri,
              filename: file.name,
              source: file.mention
                ? {
                    type: "file" as const,
                    text: { value: file.mention.text, start: file.mention.start, end: file.mention.end },
                    path: file.uri,
                  }
                : undefined,
            })),
            ...(value.agents ?? []).map((agent) => ({
              type: "agent" as const,
              name: agent.name,
              source: agent.mention
                ? { value: agent.mention.text, start: agent.mention.start, end: agent.mention.end }
                : undefined,
            })),
          ],
        })
        return {
          admittedSeq: 0,
          id: value.id ?? "",
          sessionID: value.sessionID,
          timeCreated: Date.now(),
          type: "user",
          data: { text: value.text },
          delivery: value.delivery ?? "steer",
        }
      },
      async command(value: SessionCommandInput) {
        await legacy().session.command({
          sessionID: value.sessionID,
          messageID: value.id ?? undefined,
          command: value.command,
          arguments: value.arguments ?? "",
          agent: value.agent ?? undefined,
          model: value.model ? `${value.model.providerID}/${value.model.id}` : undefined,
          variant: value.model?.variant,
          parts: value.files?.map((file) => ({
            type: "file" as const,
            mime: mime(file.uri),
            url: file.uri,
            filename: file.name,
          })),
        })
        return {
          admittedSeq: 0,
          id: value.id ?? "",
          sessionID: value.sessionID,
          timeCreated: Date.now(),
          type: "user",
          data: { text: `/${value.command} ${value.arguments ?? ""}`.trim() },
          delivery: value.delivery ?? "steer",
        }
      },
      async shell(value: SessionShellInput & LegacyPrompt) {
        await legacy().session.shell({
          sessionID: value.sessionID,
          command: value.command,
          agent: value.agent,
          model: value.model,
        })
      },
      compact: async (value: SessionCompactInput & { model?: LegacyPrompt["model"] }) => {
        if (!value.model) throw new Error("A model is required to compact a V1 session")
        await legacy().session.summarize({
          sessionID: value.sessionID,
          providerID: value.model.providerID,
          modelID: value.model.modelID,
        })
        return {
          admittedSeq: 0,
          id: value.id ?? "",
          sessionID: value.sessionID,
          timeCreated: Date.now(),
          type: "compaction",
        }
      },
      revert: {
        stage: async (value: Parameters<ServerApi["session"]["revert"]["stage"]>[0]) => {
          await legacy().session.revert(value)
          return { messageID: value.messageID }
        },
        clear: async (value: Parameters<ServerApi["session"]["revert"]["clear"]>[0]) => {
          await legacy().session.unrevert(value)
        },
        commit: input.current.session.revert.commit,
      },
    },
    project: {
      ...input.current.project,
      async list() {
        return ((await legacy().project.list()).data ?? []) as Project[]
      },
      async current(value?: Parameters<ServerApi["project"]["current"]>[0]) {
        const result = await legacy(value?.location).project.current()
        if (!result.data) throw new Error("Project not found")
        return { id: result.data.id, directory: result.data.worktree } satisfies ProjectCurrent
      },
      // async update(value: Parameters<ServerApi["project"]["update"]>[0]) {
      //   const project = (await legacy().project.list()).data?.find((item) => item.id === value.projectID)
      //   const result = await legacy({ directory: project?.worktree }).project.update({
      //     ...value,
      //     directory: project?.worktree,
      //   })
      //   if (!result.data) throw new Error(`Project not found: ${value.projectID}`)
      //   return result.data as Project
      // },
      async directories(value: Parameters<ServerApi["project"]["directories"]>[0]) {
        const result = await legacy(value.location).worktree.list()
        return (result.data ?? []).map((item) => ({ directory: item }))
      },
    },
    // path: {
    //   ...input.current.path,
    //   async get(value?: Parameters<ServerApi["path"]["get"]>[0]) {
    //     const result = await legacy(value?.location).path.get()
    //     if (!result.data) throw new Error("Path unavailable")
    //     return result.data
    //   },
    // },
    vcs: {
      ...input.current.vcs,
      // async get(value?: Parameters<ServerApi["vcs"]["get"]>[0]) {
      //   const result = await legacy(value?.location).vcs.get()
      //   return located({ branch: result.data?.branch, defaultBranch: result.data?.default_branch }, value?.location)
      // },
      async status(value?: Parameters<ServerApi["vcs"]["status"]>[0]) {
        const result = await legacy(value?.location).vcs.status()
        return located(result.data ?? [], value?.location)
      },
      async diff(value: Parameters<ServerApi["vcs"]["diff"]>[0]) {
        const result = await legacy(value.location).vcs.diff({
          mode: value.mode === "working" ? "git" : value.mode,
          context: value.context,
        })
        return located(
          (result.data ?? []).map((file) => ({
            file: file.file,
            patch: file.patch ?? "",
            additions: file.additions,
            deletions: file.deletions,
            status: file.status ?? "modified",
          })),
          value.location,
        )
      },
    },
    file: {
      ...input.current.file,
      async list(value?: Parameters<ServerApi["file"]["list"]>[0]) {
        const result = await legacy(value?.location).file.list({ path: value?.path ?? "" })
        return located(result.data ?? [], value?.location)
      },
      async find(value: Parameters<ServerApi["file"]["find"]>[0]) {
        const result = await legacy(value.location).find.files({
          query: value.query,
          dirs: value.type === undefined ? undefined : value.type === "directory" ? "true" : "false",
          limit: value.limit,
        })
        return located(
          (result.data ?? []).map((path) => ({ path, type: value.type ?? "file" })),
          value.location,
        )
      },
    },
    integration: {
      ...input.current.integration,
      async get(value: Parameters<ServerApi["integration"]["get"]>[0]) {
        const methods = ((await legacy(value.location).provider.auth()).data?.[value.integrationID] ?? []).map(
          (method, index) =>
            method.type === "api"
              ? { type: "key" as const, label: method.label }
              : { type: "oauth" as const, id: String(index), label: method.label, prompts: method.prompts },
        )
        return located(
          {
            id: value.integrationID,
            name: value.integrationID,
            methods,
            connections: [],
          },
          value.location,
        )
      },
      connect: {
        ...input.current.integration.connect,
        key: async (value: Parameters<ServerApi["integration"]["connect"]["key"]>[0]) => {
          await legacy(value.location).auth.set({
            providerID: value.integrationID,
            auth: { type: "api", key: value.key },
          })
          await legacy(value.location).instance.dispose()
          await input.legacy().instance.dispose()
        },
      },
      oauth: {
        ...input.current.integration.oauth,
        connect: async (value: Parameters<ServerApi["integration"]["oauth"]["connect"]>[0]) => {
          const method = Number(value.methodID)
          const result = await legacy(value.location).provider.oauth.authorize(
            { providerID: value.integrationID, method, inputs: value.inputs },
            { throwOnError: true },
          )
          if (!result.data) throw new Error("Failed to start OAuth authorization")
          return located(
            {
              attemptID: `${value.integrationID}:${method}`,
              url: result.data.url,
              instructions: result.data.instructions,
              mode: result.data.method,
              time: { created: Date.now(), expires: Date.now() + 10 * 60 * 1000 },
            },
            value.location,
          )
        },
        complete: async (value: Parameters<ServerApi["integration"]["oauth"]["complete"]>[0]) => {
          const method = Number(value.attemptID.split(":").at(-1))
          await legacy(value.location).provider.oauth.callback(
            { providerID: value.integrationID, method, code: value.code },
            { throwOnError: true },
          )
          await legacy(value.location).instance.dispose()
          await input.legacy().instance.dispose()
        },
        status: async (value: Parameters<ServerApi["integration"]["oauth"]["status"]>[0]) => {
          const method = Number(value.attemptID.split(":").at(-1))
          await legacy(value.location).provider.oauth.callback(
            { providerID: value.integrationID, method },
            { throwOnError: true },
          )
          await legacy(value.location).instance.dispose()
          await input.legacy().instance.dispose()
          return located(
            { status: "complete" as const, time: { created: Date.now(), expires: Date.now() } },
            value.location,
          )
        },
      },
    },
    pty: {
      ...input.current.pty,
      // async shells(value?: Parameters<ServerApi["pty"]["shells"]>[0]) {
      //   return located((await legacy(value?.location).pty.shells()).data ?? [], value?.location)
      // },
      async list(value?: Parameters<ServerApi["pty"]["list"]>[0]) {
        return located((await legacy(value?.location).pty.list()).data ?? [], value?.location)
      },
      async create(value?: Parameters<ServerApi["pty"]["create"]>[0]) {
        const result = await legacy(value?.location).pty.create({
          command: value?.command,
          args: value?.args ? [...value.args] : undefined,
          cwd: value?.cwd,
          title: value?.title,
          env: value?.env,
        })
        if (!result.data) throw new Error("Failed to create terminal")
        return located(result.data, value?.location)
      },
      async get(value: Parameters<ServerApi["pty"]["get"]>[0]) {
        const result = await legacy(value.location).pty.get({ ptyID: value.ptyID })
        if (!result.data) throw new Error(`Terminal not found: ${value.ptyID}`)
        return located(result.data, value.location)
      },
      async update(value: Parameters<ServerApi["pty"]["update"]>[0]) {
        const result = await legacy(value.location).pty.update({
          ptyID: value.ptyID,
          title: value.title,
          size: value.size,
        })
        if (!result.data) throw new Error(`Terminal not found: ${value.ptyID}`)
        return located(result.data, value.location)
      },
      async remove(value: Parameters<ServerApi["pty"]["remove"]>[0]) {
        await legacy(value.location).pty.remove({ ptyID: value.ptyID })
      },
      // async connectToken(value: Parameters<ServerApi["pty"]["connectToken"]>[0]) {
      //   const result = await legacy(value.location).pty.connectToken({ ptyID: value.ptyID })
      //   if (!result.data) throw new Error(`Failed to connect terminal: ${value.ptyID}`)
      //   return located(result.data, value.location)
      // },
    },
    permission: {
      ...input.current.permission,
      async reply(value: Parameters<ServerApi["permission"]["reply"]>[0] & { location?: { directory?: string } }) {
        await legacy(value.location).permission.respond({
          sessionID: value.sessionID,
          permissionID: value.requestID,
          response: value.reply,
          directory: directory(value.location),
        })
      },
    },
    question: {
      ...input.current.question,
      async reply(value: Parameters<ServerApi["question"]["reply"]>[0]) {
        await legacy().question.reply({
          requestID: value.requestID,
          answers: value.answers.map((answer) => [...answer]),
        })
      },
      async reject(value: Parameters<ServerApi["question"]["reject"]>[0]) {
        await legacy().question.reject({ requestID: value.requestID })
      },
    },
  }
}
