<p align="center">
  <a href="https://opencode.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="OpenCode logo">
    </picture>
  </a>
</p>
<p align="center">The open source AI coding agent.</p>
<p align="center">
  <a href="https://opencode.ai/discord"><img alt="Discord" src="https://img.shields.io/discord/1391832426048651334?style=flat-square&label=discord" /></a>
  <a href="https://www.npmjs.com/package/opencode-ai"><img alt="npm" src="https://img.shields.io/npm/v/opencode-ai?style=flat-square" /></a>
  <a href="https://github.com/anomalyco/opencode/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/anomalyco/opencode/publish.yml?style=flat-square&branch=dev" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.zht.md">繁體中文</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.it.md">Italiano</a> |
  <a href="README.da.md">Dansk</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.pl.md">Polski</a> |
  <a href="README.ru.md">Русский</a> |
  <a href="README.bs.md">Bosanski</a> |
  <a href="README.ar.md">العربية</a> |
  <a href="README.no.md">Norsk</a> |
  <a href="README.br.md">Português (Brasil)</a> |
  <a href="README.th.md">ไทย</a> |
  <a href="README.tr.md">Türkçe</a> |
  <a href="README.uk.md">Українська</a> |
  <a href="README.bn.md">বাংলা</a> |
  <a href="README.gr.md">Ελληνικά</a> |
  <a href="README.vi.md">Tiếng Việt</a>
</p>

[![OpenCode Terminal UI](packages/web/src/assets/lander/screenshot.png)](https://opencode.ai)

---

### Features

- **Two built-in agents** — switch with `Tab`: `build` (default, full-access) for development, `plan` (read-only) for analysis and exploration.
- **Subagents** — delegate complex searches and multi-step tasks with `@general`.
- **Tools & extensibility** — built-in file, shell, and web tools; extend with **MCP servers** (OAuth supported) and **plugins**.
- **Sessions** — persistent and resumable. Continue (`--continue`), resume by ID (`--session`), or fork (`--fork`) any conversation.
- **Permissions** — fine-grained control over which tools and commands may run.
- **Runs everywhere** — terminal TUI, desktop app (macOS/Windows/Linux), web, and headless `opencode run` for scripts and CI.
- **Provider-agnostic** — Anthropic, OpenAI, OpenRouter, and many more; bring your own API key.

### Installation

```bash
# YOLO
curl -fsSL https://opencode.ai/install | bash

# Package managers
npm i -g opencode-ai@latest        # or bun/pnpm/yarn
scoop install opencode             # Windows
choco install opencode             # Windows
brew install anomalyco/tap/opencode # macOS and Linux (recommended, always up to date)
brew install opencode              # macOS and Linux (official brew formula, updated less)
sudo pacman -S opencode            # Arch Linux (Stable)
paru -S opencode-bin               # Arch Linux (Latest from AUR)
mise use -g opencode               # Any OS
nix run nixpkgs#opencode           # or github:anomalyco/opencode for latest dev branch
```

> [!TIP]
> Remove versions older than 0.1.x before installing.

### Desktop App (BETA)

OpenCode is also available as a desktop application. Download directly from the [releases page](https://github.com/anomalyco/opencode/releases) or [opencode.ai/download](https://opencode.ai/download).

| Platform              | Download                           |
| --------------------- | ---------------------------------- |
| macOS (Apple Silicon) | `opencode-desktop-mac-arm64.dmg`   |
| macOS (Intel)         | `opencode-desktop-mac-x64.dmg`     |
| Windows               | `opencode-desktop-windows-x64.exe` |
| Linux                 | `.deb`, `.rpm`, or `.AppImage`     |

```bash
# macOS (Homebrew)
brew install --cask opencode-desktop
# Windows (Scoop)
scoop bucket add extras; scoop install extras/opencode-desktop
```

#### Installation Directory

The install script respects the following priority order for the installation path:

1. `$OPENCODE_INSTALL_DIR` - Custom installation directory
2. `$XDG_BIN_DIR` - XDG Base Directory Specification compliant path
3. `$HOME/bin` - Standard user binary directory (if it exists or can be created)
4. `$HOME/.opencode/bin` - Default fallback

```bash
# Examples
OPENCODE_INSTALL_DIR=/usr/local/bin curl -fsSL https://opencode.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://opencode.ai/install | bash
```

### Quick Start

After installing, connect a provider and start coding:

```bash
# Connect a provider interactively (Anthropic, OpenAI, OpenRouter, ...)
opencode auth login

# Start the interactive UI
opencode
```

Prefer an environment variable? Skip the login flow:

```bash
export ANTHROPIC_API_KEY="sk-..."
opencode
```

List what's available:

```bash
opencode models      # list available models
```

### Configuration

OpenCode loads configuration from several sources:

- Global: `~/.config/opencode/opencode.json`
- The `OPENCODE_CONFIG` env var (path to a config file)
- Project: `opencode.json` or `opencode.jsonc` in your project (walked up to the worktree root)

A minimal config:

```jsonc
{
  "model": "anthropic/claude-sonnet-4-5",
  "provider": {
    "anthropic": { "env": ["ANTHROPIC_API_KEY"] }
  }
}
```

- **Model references** use the `provider/model` format (e.g. `anthropic/claude-sonnet-4-5`).
- **Secrets** - use `{env:VAR}` to inline an environment variable, or `{file:path}` to read from a file, e.g. `"apiKey": "{env:ANTHROPIC_API_KEY}"`. A missing `{env:}` variable is an error by default.

See the [docs](https://opencode.ai/docs) for the full schema.

### Agents

OpenCode includes two built-in agents you can switch between with the `Tab` key.

- **build** - Default, full-access agent for development work
- **plan** - Read-only agent for analysis and code exploration
  - Denies file edits by default
  - Asks permission before running bash commands
  - Ideal for exploring unfamiliar codebases or planning changes

Also included is a **general** subagent for complex searches and multistep tasks.
This is used internally and can be invoked using `@general` in messages.

Learn more about [agents](https://opencode.ai/docs/agents).

### Documentation

For more info on how to configure OpenCode, [**head over to our docs**](https://opencode.ai/docs).

### Troubleshooting & Diagnostics

**View logs:**

```bash
opencode logs            # tail the last 50 log lines
opencode logs -n 200     # tail 200 lines
opencode logs --path     # print the log file path
```

The log file lives at `~/.local/share/opencode/log/opencode.log`.

**Common issues:**

| Symptom | Fix |
| --- | --- |
| `No AI providers are configured` | Run `opencode auth login`, or set an API key env var such as `ANTHROPIC_API_KEY`. |
| `Model not found: ...` | Run `opencode models` and check the `provider/model` spelling in your config. |
| `Config file at ... is not valid JSON(C)` | The error points to the line and column; fix the syntax in your `opencode.json`. |
| `environment variable "..." is not set` | A `{env:VAR}` reference in config could not be resolved; export the variable. |

**Diagnostic environment variables:**

| Variable | Purpose |
| --- | --- |
| `OPENCODE_LOG_LEVEL` | Log level: `DEBUG`, `INFO` (default), `WARN`, `ERROR`. |
| `OPENCODE_PRINT_LOGS` | Set to `1` to also stream logs to stderr (and print full stack traces from `opencode run`). |
| `OPENCODE_CONFIG` | Path to a config file to load. |
| `OPENCODE_CONFIG_DIR` | Directory to load config from. |
| `OPENCODE_CONFIG_CONTENT` | Inline config content (overrides file-based config). |
| `OPENCODE_AUTH_CONTENT` | Inline auth JSON (e.g. for CI). |
| `OPENCODE_DISABLE_PROJECT_CONFIG` | Set to `1` to ignore project-level config. |
| `OPENCODE_PURE` | Set to `1` to run without external plugins. |

### Contributing

If you're interested in contributing to OpenCode, please read our [contributing docs](./CONTRIBUTING.md) before submitting a pull request.

### Building on OpenCode

If you are working on a project that's related to OpenCode and is using "opencode" as part of its name, for example "opencode-dashboard" or "opencode-mobile", please add a note to your README to clarify that it is not built by the OpenCode team and is not affiliated with us in any way.

---

**Join our community** [Discord](https://discord.gg/opencode) | [X.com](https://x.com/opencode)
