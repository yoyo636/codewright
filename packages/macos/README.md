# Codewright for macOS

A native SwiftUI client for the [Codewright](https://github.com/yoyo636/codewright) coding agent.
It talks to a local `codewright serve` instance over the official REST + SSE API.

## Features

- **Native macOS UI** — sidebar of sessions, streaming chat, inspector for files & stats.
- **Live streaming** — prompts stream back over Server-Sent Events (`/api/session/{id}/prompt`).
- **Approval center** — pending permission (approval) requests surface inline with Allow / Deny / Always, wired to the safety layer.
- **Questions** — agent questions are answered inline without leaving the app.
- **File browser** — browse and preview project files via `/api/fs/*`.
- **Settings** — launch a local server, choose working directory, default agent / model, approval mode, and store the provider API key in the Keychain.
- **Stats** — session cost, token usage, models, providers, agents.

## Requirements

- macOS 14+
- Xcode 15+ (for building the `.app`)
- A linked `codewright` CLI on `PATH` (`bun link` in the codewright repo)

## Build

This package is built with [XcodeGen](https://github.com/yonaskolb/XcodeGen):

```bash
cd packages/macos
xcodegen generate        # creates Codewright.xcodeproj
open Codewright.xcodeproj
# Run the "Codewright" scheme (⌘R)
```

> A `Package.swift` is also provided so the code can be type-checked with
> `swift build --disable-sandbox`. The real `.app` bundle comes from the
> XcodeGen project.

## How it connects

On first launch the app either:

1. **Launches** `codewright serve --port <port> --hostname 127.0.0.1` as a
   subprocess (default), or
2. **Attaches** to a server already running at the configured host/port
   (set *Launch local server on start* off in Settings).

All communication goes through `http://127.0.0.1:<port>` using the same API
that powers the web UI.
