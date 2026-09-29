# Codewright

Open-source AI coding agent that runs in your terminal, desktop, browser, or CI.
Codewright reads your repository, forms a plan, edits files, runs commands, and
verifies the result — then reports honestly what changed and what it couldn't
confirm. No code leaves your machine except to the model provider you choose.

This repository is the **V2 kernel**: a persistent, resumable execution graph
(`packages/core/src/trajectory/`) backs every session, so a turn that was
interrupted can be resumed from exactly where it stopped instead of replayed
from the top.

## Install

```bash
npm install -g @codewright-ai/codewright
```

On platforms without a prebuilt binary the CLI falls back to running from
source via Bun, so it still works:

```bash
codewright "ship the auth refactor"
```

### From source (development)

```bash
git clone https://github.com/yoyo636/codewright.git
cd codewright
bun install
bun run build
```

`bun run build` produces prebuilt binaries under
`packages/codewright/dist/`. Install the one for your platform onto PATH:

```bash
./script/install-bin.sh            # -> ~/bin/codewright
CODEWRIGHT_BIN_DIR=/usr/local/bin ./script/install-bin.sh
```

## Layout

| Package | Role |
|---|---|
| `packages/codewright` | CLI (`run`, `tui`, `acp`, `serve`, `session`, …) |
| `packages/core` | V2 session kernel + trajectory / stepper / state store |
| `packages/server` | V2 HTTP server (`/api/*`) |
| `packages/sdk` | Generated client (v1 + v2) |
| `packages/tui` | Terminal UI (V2 reducer in `context/data.tsx`) |
| `packages/protocol` | Shared event + capability schemas |

## License

MIT