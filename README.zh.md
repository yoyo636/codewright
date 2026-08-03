<p align="center">
  <a href="https://opencode.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="OpenCode logo">
    </picture>
  </a>
</p>
<p align="center">开源的 AI Coding Agent。</p>
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

### 功能特性

- **两种内置 Agent** - 用 `Tab` 切换：`build`（默认，完整权限）用于开发，`plan`（只读）用于分析与探索。
- **子 Agent** - 用 `@general` 委托复杂搜索与多步任务。
- **工具与扩展** - 内置文件、Shell、Web 等工具；可通过 **MCP 服务器**（支持 OAuth）与**插件**扩展。
- **会话** - 持久化且可恢复。可继续（`--continue`）、按 ID 恢复（`--session`）或派生（`--fork`）任意对话。
- **权限** - 细粒度控制可运行的工具与命令。
- **多端运行** - 终端 TUI、桌面应用（macOS/Windows/Linux）、Web，以及用于脚本与 CI 的无头模式 `opencode run`。
- **多 Provider** - 支持 Anthropic、OpenAI、OpenRouter 等众多厂商，可自带 API Key。

### 安装

```bash
# 直接安装 (YOLO)
curl -fsSL https://opencode.ai/install | bash

# 软件包管理器
npm i -g opencode-ai@latest        # 也可使用 bun/pnpm/yarn
scoop install opencode             # Windows
choco install opencode             # Windows
brew install anomalyco/tap/opencode # macOS 和 Linux（推荐，始终保持最新）
brew install opencode              # macOS 和 Linux（官方 brew formula，更新频率较低）
sudo pacman -S opencode            # Arch Linux (Stable)
paru -S opencode-bin               # Arch Linux (Latest from AUR)
mise use -g opencode               # 任意系统
nix run nixpkgs#opencode           # 或用 github:anomalyco/opencode 获取最新 dev 分支
```

> [!TIP]
> 安装前请先移除 0.1.x 之前的旧版本。

### 桌面应用程序 (BETA)

OpenCode 也提供桌面版应用。可直接从 [发布页 (releases page)](https://github.com/anomalyco/opencode/releases) 或 [opencode.ai/download](https://opencode.ai/download) 下载。

| 平台                  | 下载文件                           |
| --------------------- | ---------------------------------- |
| macOS (Apple Silicon) | `opencode-desktop-mac-arm64.dmg`   |
| macOS (Intel)         | `opencode-desktop-mac-x64.dmg`     |
| Windows               | `opencode-desktop-windows-x64.exe` |
| Linux                 | `.deb`、`.rpm` 或 AppImage         |

```bash
# macOS (Homebrew Cask)
brew install --cask opencode-desktop
# Windows (Scoop)
scoop bucket add extras; scoop install extras/opencode-desktop
```

#### 安装目录

安装脚本按照以下优先级决定安装路径：

1. `$OPENCODE_INSTALL_DIR` - 自定义安装目录
2. `$XDG_BIN_DIR` - 符合 XDG 基础目录规范的路径
3. `$HOME/bin` - 如果存在或可创建的用户二进制目录
4. `$HOME/.opencode/bin` - 默认备用路径

```bash
# 示例
OPENCODE_INSTALL_DIR=/usr/local/bin curl -fsSL https://opencode.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://opencode.ai/install | bash
```

### 快速上手

安装后，连接一个 provider 即可开始：

```bash
# 交互式连接 provider（Anthropic、OpenAI、OpenRouter 等）
opencode auth login

# 启动交互式 UI
opencode
```

更愿意用环境变量？可跳过登录流程：

```bash
export ANTHROPIC_API_KEY="sk-..."
opencode
```

查看可用内容：

```bash
opencode models      # 列出可用模型
```

### 配置

OpenCode 从以下来源加载配置：

- 全局：`~/.config/opencode/opencode.json`
- `OPENCODE_CONFIG` 环境变量（配置文件路径）
- 项目：项目中的 `opencode.json` 或 `opencode.jsonc`（向上查找至 worktree 根目录）

最小配置示例：

```jsonc
{
  "model": "anthropic/claude-sonnet-4-5",
  "provider": {
    "anthropic": { "env": ["ANTHROPIC_API_KEY"] }
  }
}
```

- **模型引用**使用 `provider/model` 格式（如 `anthropic/claude-sonnet-4-5`）。
- **密钥** - 用 `{env:VAR}` 内联环境变量，或用 `{file:path}` 读取文件，如 `"apiKey": "{env:ANTHROPIC_API_KEY}"`。默认情况下 `{env:}` 变量缺失会报错。

完整 schema 请查看[官方文档](https://opencode.ai/docs)。

### Agents

OpenCode 内置两种 Agent，可用 `Tab` 键快速切换：

- **build** - 默认模式，具备完整权限，适合开发工作
- **plan** - 只读模式，适合代码分析与探索
  - 默认拒绝修改文件
  - 运行 bash 命令前会询问
  - 便于探索未知代码库或规划改动

另外还包含一个 **general** 子 Agent，用于复杂搜索和多步任务，内部使用，也可在消息中输入 `@general` 调用。

了解更多 [Agents](https://opencode.ai/docs/agents) 相关信息。

### 文档

更多配置说明请查看我们的 [**官方文档**](https://opencode.ai/docs)。

### 问题排查与诊断

**查看日志：**

```bash
opencode logs            # 输出最后 50 行日志
opencode logs -n 200     # 输出 200 行
opencode logs --path     # 打印日志文件路径
```

日志文件位于 `~/.local/share/opencode/log/opencode.log`。

**常见问题：**

| 现象 | 解决方法 |
| --- | --- |
| `No AI providers are configured` | 运行 `opencode auth login`，或设置 API Key 环境变量（如 `ANTHROPIC_API_KEY`）。 |
| `Model not found: ...` | 运行 `opencode models`，检查配置中 `provider/model` 拼写。 |
| `Config file at ... is not valid JSON(C)` | 报错会指明行与列；修正 `opencode.json` 中的语法。 |
| `environment variable "..." is not set` | 配置中的 `{env:VAR}` 引用无法解析；请导出该变量。 |

**诊断环境变量：**

| 变量 | 用途 |
| --- | --- |
| `OPENCODE_LOG_LEVEL` | 日志级别：`DEBUG`、`INFO`（默认）、`WARN`、`ERROR`。 |
| `OPENCODE_PRINT_LOGS` | 设为 `1` 时同时把日志输出到 stderr（并让 `opencode run` 打印完整堆栈）。 |
| `OPENCODE_CONFIG` | 要加载的配置文件路径。 |
| `OPENCODE_CONFIG_DIR` | 加载配置的目录。 |
| `OPENCODE_CONFIG_CONTENT` | 内联配置内容（覆盖文件配置）。 |
| `OPENCODE_AUTH_CONTENT` | 内联 auth JSON（如用于 CI）。 |
| `OPENCODE_DISABLE_PROJECT_CONFIG` | 设为 `1` 时忽略项目级配置。 |
| `OPENCODE_PURE` | 设为 `1` 时不加载外部插件。 |

### 参与贡献

如有兴趣贡献代码，请在提交 PR 前阅读 [贡献指南 (Contributing Docs)](./CONTRIBUTING.md)。

### 基于 OpenCode 进行开发

如果你在项目名中使用了 “opencode”（如 “opencode-dashboard” 或 “opencode-mobile”），请在 README 里注明该项目不是 OpenCode 团队官方开发，且不存在隶属关系。

---

**加入我们的社区** [飞书](https://applink.feishu.cn/client/chat/chatter/add_by_link?link_token=52ao9352-5623-4fa0-b7dd-3407c392c1af&qr_code=true) | [X.com](https://x.com/opencode)
