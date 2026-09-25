// @ts-nocheck

import { Codewright } from "@codewright-ai/core"
import { ReadTool } from "@codewright-ai/core/tools"

const codewright = Codewright.make({})

codewright.tool.add(ReadTool)

codewright.tool.add({
  name: "bash",
  schema: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "The command to run.",
      },
    },
    required: ["command"],
  },
  execute(input, ctx) {},
})

codewright.auth.add({
  provider: "openai",
  type: "api",
  value: process.env.OPENAI_API_KEY,
})

codewright.agent.add({
  name: "build",
  permissions: [],
  model: {
    id: "gpt-5-5",
    provider: "openai",
    variant: "xhigh",
  },
})

const sessionID = await codewright.session.create({
  agent: "build",
})

codewright.subscribe((event) => {
  console.log(event)
})

await codewright.session.prompt({
  sessionID,
  text: "hey what is up",
})

await codewright.session.prompt({
  sessionID,
  text: "what is up with this",
  files: [
    {
      mime: "image/png",
      uri: "data:image/png;base64,xxxx",
    },
  ],
})

await codewright.session.wait()

console.log(await codewright.session.messages(sessionID))
