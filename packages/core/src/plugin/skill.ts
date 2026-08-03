/// <reference path="../markdown.d.ts" />

export * as SkillPlugin from "./skill"

import { define } from "./internal"
import { Effect } from "effect"
import { AbsolutePath } from "../schema"
import { SkillV2 } from "../skill"
import customizeCodewrightContent from "./skill/customize-codewright.md" with { type: "text" }

export const CustomizeCodewrightContent = customizeCodewrightContent

export const Plugin = define({
  id: "skill",
  effect: Effect.fn(function* (ctx) {
    yield* ctx.skill.transform((draft) => {
      draft.source(
        SkillV2.EmbeddedSource.make({
          type: "embedded",
          skill: SkillV2.Info.make({
            name: "customize-codewright",
            description:
              "Use ONLY when the user is editing or creating codewright's own configuration: codewright.json, codewright.jsonc, files under .codewright/, or files under ~/.config/codewright/. Also use when creating or fixing codewright agents, subagents, commands, skills, plugins, MCP servers, or permission rules. Do not use for the user's own application code, or for any project that is not configuring codewright itself.",
            location: AbsolutePath.make("/builtin/customize-codewright.md"),
            content: CustomizeCodewrightContent,
          }),
        }),
      )
    })
  }),
})
