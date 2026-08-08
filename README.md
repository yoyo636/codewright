<p align="center">
  <a href="https://github.com/yoyo636/codewright">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Codewright logo">
    </picture>
  </a>
</p>
<p align="center">The open source AI coding agent.</p>
<p align="center">
  <a href="https://github.com/yoyo636/codewright/releases"><img alt="GitHub Releases" src="https://img.shields.io/github/v/release/yoyo636/codewright?style=flat-square" /></a>
  <a href="https://github.com/yoyo636/codewright/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/yoyo636/codewright/publish.yml?style=flat-square&branch=dev" /></a>
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

### Features

- **Two built-in agents** — switch with `Tab`: `build` (default, full-access) for development, `plan` (read-only) for analysis and exploration.
- **Subagents** — delegate complex searches and multi-step tasks with `@general`.
- **Tools & extensibility** — built-in file, shell, and web tools; extend with **MCP servers** (OAuth supported) and **plugins**.
- **Sessions** — persistent and resumable. Continue (`--continue`), resume by ID (`--session`), or fork (`--fork`) any conversation.
- **Permissions** — fine-grained control over which tools and commands may run.
- **Runs everywhere** — terminal TUI, desktop app (macOS/Windows/Linux), web, and headless `codewright run` for scripts and CI.
- **Provider-agnostic** — Anthropic, OpenAI, OpenRouter, and many more; bring your own API key.

### Installation

#### From Source

```bash
# Clone the repository
git clone https://github.com/yoyo636/codewright.git
cd codewright

# Install dependencies
bun install

# Build and run
bun run --cwd packages/opencode build
./packages/opencode/dist/yoyocode
```

#### Requirements

- **Bun** 1.3+ - [Install Bun](https://bun.sh)

### Desktop App (BETA)

Codewright is also available as a desktop application. Download directly from the [releases page](https://github.com/yoyo636/codewright/releases).

| Platform              | Download                           |
| --------------------- | ---------------------------------- |
| macOS (Apple Silicon) | `codewright-desktop-mac-arm64.dmg`   |
| macOS (Intel)         | `codewright-desktop-mac-x64.dmg`     |
| Windows               | `codewright-desktop-windows-x64.exe` |
| Linux                 | `.deb`, `.rpm`, or `.AppImage`     |

### Quick Start

After installing, configure your provider and start coding:

```bash
# Start the interactive UI
codewright
```

Set your API key via environment variable:

```bash
export ANTHROPIC_API_KEY="sk-..."
codewright
```

List what's available:

```bash
codewright models      # list available models
```

### Configuration

Codewright loads configuration from several sources:

- Global: `~/.config/codewright/codewright.json`
- The `CODEWRIGHT_CONFIG` env var (path to a config file)
- Project: `codewright.json` or `codewright.jsonc` in your project (walked up to the worktree root)

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

### Agents

Codewright includes two built-in agents you can switch between with the `Tab` key.

- **build** - Default, full-access agent for development work
- **plan** - Read-only agent for analysis and code exploration
  - Denies file edits by default
  - Asks permission before running bash commands
  - Ideal for exploring unfamiliar codebases or planning changes

Also included is a **general** subagent for complex searches and multistep tasks.
This is used internally and can be invoked using `@general` in messages.

### Troubleshooting & Diagnostics

**View logs:**

```bash
codewright logs            # tail the last 50 log lines
codewright logs -n 200     # tail 200 lines
codewright logs --path     # print the log file path
```

The log file lives at `~/.local/share/codewright/log/codewright.log`.

**Common issues:**

| Symptom | Fix |
| --- | --- |
| `No AI providers are configured` | Set an API key env var such as `ANTHROPIC_API_KEY`. |
| `Model not found: ...` | Run `codewright models` and check the `provider/model` spelling in your config. |
| `Config file at ... is not valid JSON(C)` | The error points to the line and column; fix the syntax in your `codewright.json`. |
| `environment variable "..." is not set` | A `{env:VAR}` reference in config could not be resolved; export the variable. |

**Diagnostic environment variables:**

| Variable | Purpose |
| --- | --- |
| `CODEWRIGHT_LOG_LEVEL` | Log level: `DEBUG`, `INFO` (default), `WARN`, `ERROR`. |
| `CODEWRIGHT_PRINT_LOGS` | Set to `1` to also stream logs to stderr (and print full stack traces from `codewright run`). |
| `CODEWRIGHT_CONFIG` | Path to a config file to load. |
| `CODEWRIGHT_CONFIG_DIR` | Directory to load config from. |
| `CODEWRIGHT_CONFIG_CONTENT` | Inline config content (overrides file-based config). |
| `CODEWRIGHT_AUTH_CONTENT` | Inline auth JSON (e.g. for CI). |
| `CODEWRIGHT_DISABLE_PROJECT_CONFIG` | Set to `1` to ignore project-level config. |
| `CODEWRIGHT_PURE` | Set to `1` to run without external plugins. |

### Contributing

If you're interested in contributing to Codewright, please read our [contributing docs](./CONTRIBUTING.md) before submitting a pull request.

### Building on Codewright

If you are working on a project that's related to Codewright and is using "codewright" as part of its name, for example "codewright-dashboard" or "codewright-mobile", please add a note to your README to clarify that it is not built by the Codewright team and is not affiliated with us in any way.

---

**Project Link** [GitHub](https://github.com/yoyo636/codewright)
