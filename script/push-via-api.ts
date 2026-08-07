/**
 * Push commits to GitHub via the Git Database REST API.
 * Used when github.com:443 is unreachable but api.github.com is accessible.
 */
import { $ } from "bun"

const REPO = "yoyo636/codewright"
const BRANCH = "dev"

// Get auth token from gh CLI
const token = (await $`gh auth token`.text()).trim()
if (!token) {
  console.error("No gh auth token found")
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

// Get commits to push (oldest first)
const remoteSha = (await api(`/repos/${REPO}/git/refs/heads/${BRANCH}`)).object.sha
console.log(`Remote ${BRANCH} SHA: ${remoteSha}`)

const commitsToPush = (await $`git rev-list --reverse ${remoteSha}..HEAD`.text())
  .trim()
  .split("\n")
  .filter(Boolean)
console.log(`Commits to push: ${commitsToPush.length}`)

// apiParentSha tracks the commit created via the API (for parent linking)
let apiParentSha = remoteSha

for (const commitSha of commitsToPush) {
  const meta = (await $`git log -1 --format='%H||%s||%an||%ae||%aI||%P' ${commitSha}`.text()).trim()
  const [, subject, authorName, authorEmail, authorDate, parentStr] = meta.split("||")
  // localParentSha is the parent in local git history (for diffing)
  const localParentSha = parentStr.split(" ")[0]
  console.log(`\nProcessing: ${subject.slice(0, 60)}`)

  // Get parent tree SHA from the API parent (which may be remote or a previously created commit)
  const parentTreeSha = (await api(`/repos/${REPO}/git/commits/${apiParentSha}`)).tree.sha

  // Get changed files between local parent and this commit
  const diff = (await $`git diff --name-status ${localParentSha} ${commitSha}`.text()).trim()
  if (!diff) {
    console.log("  No changes, skipping")
    // Still need to create a commit pointing to parent tree
    apiParentSha = localParentSha
    continue
  }

  const entries: any[] = []
  for (const line of diff.split("\n")) {
    const [status, ...pathParts] = line.split("\t")
    const filepath = pathParts.join("\t")

    if (status === "D") {
      entries.push({ path: filepath, mode: "100644", type: "blob", sha: null })
      console.log(`  DELETE: ${filepath}`)
    } else {
      const content = await $`git show ${commitSha}:${filepath}`.text()
      const blob = await api(`/repos/${REPO}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({ content, encoding: "utf-8" }),
      })
      entries.push({ path: filepath, mode: "100644", type: "blob", sha: blob.sha })
      console.log(`  ${status}: ${filepath}`)
    }
  }

  // Create tree based on parent's tree
  const tree = await api(`/repos/${REPO}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: parentTreeSha, tree: entries }),
  })
  console.log(`  Tree: ${tree.sha}`)

  // Create commit
  const commitMessage = (await $`git log -1 --format='%B' ${commitSha}`.text()).trim()
  const newCommit = await api(`/repos/${REPO}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message: commitMessage,
      tree: tree.sha,
      parents: [apiParentSha],
      author: { name: authorName, email: authorEmail, date: authorDate },
    }),
  })
  console.log(`  Commit: ${newCommit.sha}`)
  apiParentSha = newCommit.sha
}

// Update ref
console.log(`\nUpdating ${BRANCH} ref to ${apiParentSha}...`)
await api(`/repos/${REPO}/git/refs/heads/${BRANCH}`, {
  method: "PATCH",
  body: JSON.stringify({ sha: apiParentSha, force: false }),
})
console.log(`✓ Pushed ${commitsToPush.length} commits to ${BRANCH}`)
