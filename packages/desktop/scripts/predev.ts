import { $ } from "bun"
import { downloadCliToResources } from "./utils"

await $`bun run install-electron`

await $`bun ./scripts/copy-icons.ts ${process.env.CODEWRIGHT_CHANNEL ?? "dev"}`

await $`cd ../codewright && bun script/build-node.ts`
await downloadCliToResources()
