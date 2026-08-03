import { Context } from "effect"
import type { InstanceContext } from "@/project/instance-context"
import type { WorkspaceV2 } from "@codewright-ai/core/workspace"

export const InstanceRef = Context.Reference<InstanceContext | undefined>("~codewright/InstanceRef", {
  defaultValue: () => undefined,
})

export const WorkspaceRef = Context.Reference<WorkspaceV2.ID | undefined>("~codewright/WorkspaceRef", {
  defaultValue: () => undefined,
})
