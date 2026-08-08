/**
 * Full Install-section rewrite for every docs index.mdx (English + locales),
 * plus the gitlab.mdx CI fake command. Preserves each locale's translated
 * section headers (only the body between the first "## " header and the second
 * "## " header is replaced with a locale-neutral honest build-from-source block).
 *
 * Cleans up the messy state left by the prior command-line replacement
 * (stray "p#" from a pnpm substring match, leftover TabItem comments, and
 * translated prose that still claimed a brew formula existed).
 *
 * Usage: bun run script/fix-install-sections.ts
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs"
import { join } from "node:path"

const DOCS = "packages/web/src/content/docs"

const HONEST_BODY = `

Codewright is currently distributed as source. Clone the repository, install dependencies with [Bun](https://bun.sh), and build.

\`\`\`bash
# Clone the repository
git clone https://github.com/yoyo636/codewright.git
cd codewright

# Install dependencies
bun install

# Build and run
bun run --cwd packages/opencode build
./packages/opencode/dist/yoyocode
\`\`\`

Prebuilt binaries will be published to [GitHub Releases](https://github.com/yoyo636/codewright/releases).

:::tip[Windows]
For the best experience on Windows, we recommend using [Windows Subsystem for Linux (WSL)](/docs/windows-wsl).
:::

---

`

// Honest replacement for the fake `npm install --global codewright-ai` in gitlab CI YAML.
// Kept as a single YAML entry that builds from source into /tmp so it doesn't
// change the job's working directory.
const GITLAB_HONEST =
  "git clone https://github.com/yoyo636/codewright.git /tmp/codewright" +
  " && cd /tmp/codewright" +
  " && curl -fsSL https://bun.sh/install | bash" +
  " && bun install && bun run --cwd packages/opencode build"

let sectionRewrites = 0
let gitlabFixes = 0

function walkMdx(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...walkMdx(p))
    else if (e.name.endsWith(".mdx")) out.push(p)
  }
  return out
}

function rewriteInstallSection(path: string): void {
  const content = readFileSync(path, "utf-8")
  // First "## " header line = Install section header
  const m1 = content.match(/^## .+$/m)
  if (!m1 || m1.index === undefined) return
  const firstHeaderEnd = m1.index + m1[0].length
  // Second "## " header line = Configure (boundary)
  const after = content.slice(firstHeaderEnd)
  const m2 = after.match(/^## .+$/m)
  if (!m2 || m2.index === undefined) return
  const secondHeaderStart = firstHeaderEnd + m2.index
  const next = content.slice(0, firstHeaderEnd) + HONEST_BODY + content.slice(secondHeaderStart)
  if (next !== content) {
    writeFileSync(path, next)
    sectionRewrites++
    console.log(`  ✓ ${path}`)
  }
}

for (const f of walkMdx(DOCS)) {
  if (f.endsWith("/index.mdx") || f === join(DOCS, "index.mdx")) {
    rewriteInstallSection(f)
  }
  // Fix the fake npm command in every gitlab.mdx (CI example)
  if (f.endsWith("/gitlab.mdx") || f === join(DOCS, "gitlab.mdx")) {
    const content = readFileSync(f, "utf-8")
    if (content.includes("npm install --global codewright-ai")) {
      writeFileSync(f, content.split("npm install --global codewright-ai").join(GITLAB_HONEST))
      gitlabFixes++
      console.log(`  ✓ ${f} (gitlab CI npm -> build from source)`)
    }
  }
}

console.log(`\n✓ ${sectionRewrites} index.mdx Install sections rewritten, ${gitlabFixes} gitlab.mdx fixed`)
