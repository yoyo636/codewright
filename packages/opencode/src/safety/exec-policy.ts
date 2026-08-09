/**
 * Command safety classification, modeled on the exec-policy layer of OpenAI's
 * Codex CLI.
 *
 * Two verdicts matter here:
 * - `banned` - destructive / non-recoverable operations. Never executed, even
 *   under a full-auto policy. The model receives a clear reason and adapts.
 * - `risky`  - operations that can damage the workspace, the system, or a git
 *   remote. Escalated to an explicit approval prompt even when the session
 *   policy is "allow all".
 *
 * The classifier is intentionally conservative and pattern-based. Every rule
 * matches at a command position (start of line or after `; & |`), so commands
 * merely echoed or printed are not flagged. Path containment (e.g. `rm`
 * outside the worktree) is already handled by the `external_directory`
 * permission; this layer only flags what is dangerous regardless of location.
 * Shell wrappers such as `bash -c '...'` are unwrapped so a destructive
 * script hidden inside a string argument is still caught.
 */

export type SafetyAction = "safe" | "risky" | "banned"

export interface PolicyVerdict {
  action: SafetyAction
  reason: string
  pattern: string
}

/** A command position: start of input, a newline, or after `;`, `&`, `|`. */
const CMD = "(?:^|\\n|[;&|]\\s*)"
const SUDO = "(?:sudo\\s+)?"

interface Rule {
  re: RegExp
  reason: string
  pattern: string
}

const BANNED: Rule[] = [
  {
    // A flag containing both `r` and `f` in any order (-rf, -fr, -Rf, ...).
    re: new RegExp(`${CMD}${SUDO}rm\\s+-(?=[a-zA-Z]*[rR])(?=[a-zA-Z]*[fF])[a-zA-Z]+\\s+[\\/~](?:\\s|$)`),
    reason: "recursive delete of a filesystem root (rm -rf / or ~)",
    pattern: "rm -rf root",
  },
  {
    re: new RegExp(`${CMD}mkfs(?:\\.[a-z0-9]+)?\\b`),
    reason: "creating a filesystem (mkfs) destroys the target volume",
    pattern: "mkfs",
  },
  {
    re: new RegExp(`${CMD}(?:shred|wipefs|sfdisk)\\b`),
    reason: "disk destruction utility (shred / wipefs / sfdisk)",
    pattern: "shred/wipefs/sfdisk",
  },
  {
    re: new RegExp(`${CMD}dd\\b.*?\\bof=\\/dev\\/(?!null|zero|urandom|random|tty)\\S+`, "s"),
    reason: "dd writing to a block device",
    pattern: "dd of=/dev/*",
  },
  {
    re: />\s*\/dev\/(?:sd[a-z]|disk|rdisk|nvme)\S*/,
    reason: "redirecting output to a block device",
    pattern: "> /dev/sd*",
  },
  {
    re: new RegExp(`${CMD}${SUDO}chmod\\s+-R\\s+0*777\\s+[\\/~](?:\\s|$)`),
    reason: "recursive world-writable chmod on a filesystem root",
    pattern: "chmod -R 777 /",
  },
  {
    re: /:\s*\(\s*\)\s*\{\s*:/,
    reason: "fork bomb",
    pattern: ":(){...}",
  },
]

const RISKY: Rule[] = [
  {
    re: new RegExp(`${CMD}(?:sudo|pkexec|doas)\\b`),
    reason: "privilege escalation",
    pattern: "sudo",
  },
  {
    re: new RegExp(`${CMD}su\\s+`),
    reason: "switching user",
    pattern: "su",
  },
  {
    re: new RegExp(`${CMD}eval\\b`),
    reason: "eval executes arbitrary strings",
    pattern: "eval",
  },
  {
    re: new RegExp(`${CMD}git\\s+push\\b(?!.*--force-with-lease).*?(-f\\b|--force\\b)`),
    reason: "force-push to a git remote",
    pattern: "git push --force",
  },
  {
    re: new RegExp(`${CMD}git\\s+reset\\s+--hard\\b`),
    reason: "discards all uncommitted changes",
    pattern: "git reset --hard",
  },
  {
    re: new RegExp(`${CMD}git\\s+clean\\s+-(?:[a-z]*f[a-z]*d|d[a-z]*f)\\b`),
    reason: "deletes untracked files",
    pattern: "git clean -fd",
  },
  {
    re: new RegExp(`${CMD}chmod\\s+0*000\\b`),
    reason: "removes all access (chmod 000)",
    pattern: "chmod 000",
  },
  {
    re: new RegExp(`${CMD}(?:kill\\s+-9|pkill\\s+-9|killall\\s+-9)\\b`),
    reason: "force-killing processes",
    pattern: "kill -9",
  },
]

/**
 * Shell wrappers that execute a nested script: `bash -c '...'`, `sh -lc "..."`,
 * `bash --command '...'`. A c-flag may be combined with other letters (e.g.
 * `-lc`), which is why the flag is matched with a lookahead for `c`.
 */
const WRAPPER =
  /^((?:[A-Za-z0-9_.\/-]*\/)?(?:bash|sh|zsh|dash|ash|ksh|fish)\s+)(?:-(?=[a-zA-Z]*c)[a-zA-Z]*\s+|--command\s+)+(['"])([\s\S]*?)\2(?:\s|$)/s

/** `curl <url> | sh` / `wget <url> | bash` - piping a remote download into a shell. */
function pipeToShell(text: string): PolicyVerdict | undefined {
  const match = new RegExp(`${CMD}(?:curl|wget)\\s+([^|]*?)\\s*\\|\\s*(?:sudo\\s+)?(?:sh|bash)\\b`).exec(text)
  if (!match) return
  const target = match[1]
  if (/https?:\/\//.test(target) && !/https:\/\//.test(target)) {
    return { action: "banned", reason: "piping a non-HTTPS download into a shell", pattern: "curl | sh (http)" }
  }
  return { action: "risky", reason: "piping a remote download into a shell", pattern: "curl | sh" }
}

/** Any other `... | sh` / `... | bash` pipe at the end of a command. */
function genericPipeToShell(text: string): PolicyVerdict | undefined {
  if (/\|\s*(?:sudo\s+)?(?:sh|bash)\s*(?:#.*)?$/.test(text)) {
    return { action: "risky", reason: "piping command output into a shell", pattern: "| sh" }
  }
  return
}

function match(rules: Rule[], action: SafetyAction, text: string): PolicyVerdict | undefined {
  for (const rule of rules) {
    if (rule.re.test(text)) return { action, reason: rule.reason, pattern: rule.pattern }
  }
  return
}

/** Classify a shell command string. */
export function classify(raw: string): PolicyVerdict {
  const text = raw.trim()
  if (!text) return { action: "safe", reason: "", pattern: "" }

  // Unwrap shell wrappers and classify the nested script they execute.
  const wrapper = WRAPPER.exec(text)
  if (wrapper) {
    const inner = classify(wrapper[3])
    if (inner.action !== "safe") return inner
  }

  const piped = pipeToShell(text)
  if (piped) return piped

  const banned = match(BANNED, "banned", text)
  if (banned) return banned

  const risky = match(RISKY, "risky", text) ?? genericPipeToShell(text)
  if (risky) return risky

  return { action: "safe", reason: "", pattern: "" }
}
