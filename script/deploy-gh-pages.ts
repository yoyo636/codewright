/**
 * Deploy the local repo-root index.html to the GitHub Pages branch (gh-pages)
 * via the Git Database REST API. Used when github.com:443 is unreachable but
 * api.github.com is accessible.
 *
 * The local `gh-pages` ref may be stale (the live branch is advanced via API
 * commits that aren't in the local object DB), so this reads the REMOTE
 * gh-pages HEAD as the parent rather than trusting the local ref.
 *
 * Usage: bun run script/deploy-gh-pages.ts
 */
import { $ } from "bun"
import { readFileSync } from "node:fs"

const REPO = "yoyo636/codewright"
const BRANCH = "gh-pages"

// Paths on the gh-pages branch that should mirror the local index.html.
// Both have historically been kept identical on gh-pages.
const TARGET_PATHS = ["index.html", "packages/landing/index.html"]

const token = (await $`gh auth token`.text()).trim()
if (!token) {
  console.error("No gh auth token found. Run `gh auth login`.")
  process.exit(1)
}

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "Content-Type": "application/json",
}

async function api(path: string, options: RequestInit = {}): Promise<any> {
  const url = path.startsWith("http") ? path : `https://api.github.com${path}`
  const resp = await fetch(url, { ...options, headers: { ...headers, ...(options.headers as any) } })
  const text = await resp.text()
  if (!resp.ok) {
    console.error(`API error ${resp.status} for ${path}: ${text.slice(0, 500)}`)
    throw new Error(`API error ${resp.status}`)
  }
  return text ? JSON.parse(text) : null
}

// Read local index.html content
const localContent = readFileSync(new URL("../index.html", import.meta.url), "utf-8")
console.log(`Local index.html: ${localContent.length} bytes`)

// Get REMOTE gh-pages HEAD (do not trust the local ref - it may be stale)
const remoteRef = await api(`/repos/${REPO}/git/refs/heads/${BRANCH}`)
const parentSha = remoteRef.object.sha
console.log(`Remote ${BRANCH} HEAD: ${parentSha}`)

const parentCommit = await api(`/repos/${REPO}/git/commits/${parentSha}`)
const parentTreeSha = parentCommit.tree.sha
console.log(`Parent tree: ${parentTreeSha}`)

// Create blob for the local index.html content
const blob = await api(`/repos/${REPO}/git/blobs`, {
  method: "POST",
  body: JSON.stringify({ content: localContent, encoding: "utf-8" }),
})
console.log(`Created blob: ${blob.sha} (${blob.size} bytes)`)

// Build tree entries replacing each target path with the new blob
const treeEntries = TARGET_PATHS.map((path) => ({
  path,
  mode: "100644",
  type: "blob",
  sha: blob.sha,
}))

const tree = await api(`/repos/${REPO}/git/trees`, {
  method: "POST",
  body: JSON.stringify({ base_tree: parentTreeSha, tree: treeEntries }),
})
console.log(`Created tree: ${tree.sha}`)

// Create commit on top of remote gh-pages HEAD
const newCommit = await api(`/repos/${REPO}/git/commits`, {
  method: "POST",
  body: JSON.stringify({
    message: "deploy: update landing page (remove fake install commands)",
    tree: tree.sha,
    parents: [parentSha],
  }),
})
console.log(`Created commit: ${newCommit.sha}`)

// Update the gh-pages ref
await api(`/repos/${REPO}/git/refs/heads/${BRANCH}`, {
  method: "PATCH",
  body: JSON.stringify({ sha: newCommit.sha, force: false }),
})
console.log(`\n✓ Deployed index.html to ${BRANCH} (${TARGET_PATHS.length} paths)`)
console.log(`  Commit: ${newCommit.sha}`)
console.log(`  Live: https://yoyo636.github.io/codewright/`)
