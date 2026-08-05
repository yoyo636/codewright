<p align="center">
  <a href="https://github.com/yoyo636/opencode">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Codewright logo">
    </picture>
  </a>
</p>
<p align="center">Der Open-Source KI-Coding-Agent.</p>
<p align="center"><a href="https://github.com/yoyo636/opencode/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/yoyo636/opencode/publish.yml?style=flat-square&branch=dev" /></a>
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

[![Codewright Terminal UI](packages/web/src/assets/lander/screenshot.png)](https://github.com/yoyo636/opencode)

---

### Installation

```bash
# From source
git clone https://github.com/yoyo636/opencode.git
cd opencode
npm install
npm run build

# Paketmanager

scoop install codewright             # Windows
choco install codewright             # Windows
# Build from source (see above)
brew install codewright              # macOS und Linux (offizielle Brew-Formula, seltener aktualisiert)
sudo pacman -S codewright            # Arch Linux (Stable)
paru -S codewright-bin               # Arch Linux (Latest from AUR)
mise use -g codewright               # jedes Betriebssystem
nix run nixpkgs#codewright           # oder github:yoyo636/opencode für den neuesten dev-Branch
```

> [!TIP]
> Entferne Versionen älter als 0.1.x vor der Installation.

### Desktop-App (BETA)

Codewright ist auch als Desktop-Anwendung verfügbar. Lade sie direkt von der [Releases-Seite](https://github.com/yoyo636/opencode/releases) oder [opencode.ai/download](https://github.com/yoyo636/opencode/download) herunter.

| Plattform             | Download                           |
| --------------------- | ---------------------------------- |
| macOS (Apple Silicon) | `codewright-desktop-mac-arm64.dmg`   |
| macOS (Intel)         | `codewright-desktop-mac-x64.dmg`     |
| Windows               | `codewright-desktop-windows-x64.exe` |
| Linux                 | `.deb`, `.rpm` oder AppImage       |

```bash
# macOS (Homebrew)
brew install --cask codewright-desktop
# Windows (Scoop)
scoop bucket add extras; scoop install extras/codewright-desktop
```

#### Installationsverzeichnis

Das Installationsskript beachtet die folgende Prioritätsreihenfolge für den Installationspfad:

1. `$CODEWRIGHT_INSTALL_DIR` - Benutzerdefiniertes Installationsverzeichnis
2. `$XDG_BIN_DIR` - XDG Base Directory Specification-konformer Pfad
3. `$HOME/bin` - Standard-Binärverzeichnis des Users (falls vorhanden oder erstellbar)
4. `$HOME/.codewright/bin` - Standard-Fallback

```bash
# Beispiele
# Build from source first (see above), then set CODEWRIGHT_INSTALL_DIR
# Build from source first (see above), then set XDG_BIN_DIR
```

### Agents

Codewright enthält zwei eingebaute Agents, zwischen denen du mit der `Tab`-Taste wechseln kannst.

- **build** - Standard-Agent mit vollem Zugriff für Entwicklungsarbeit
- **plan** - Nur-Lese-Agent für Analyse und Code-Exploration
  - Verweigert Datei-Edits standardmäßig
  - Fragt vor dem Ausführen von bash-Befehlen nach
  - Ideal zum Erkunden unbekannter Codebases oder zum Planen von Änderungen

Außerdem ist ein **general**-Subagent für komplexe Suchen und mehrstufige Aufgaben enthalten.
Dieser wird intern genutzt und kann in Nachrichten mit `@general` aufgerufen werden.

Mehr dazu unter [Agents](https://github.com/yoyo636/opencode/docs/agents).

### Dokumentation

Mehr Infos zur Konfiguration von Codewright findest du in unseren [**Docs**](https://github.com/yoyo636/opencode/docs).

### Beitragen

Wenn du zu Codewright beitragen möchtest, lies bitte unsere [Contributing Docs](./CONTRIBUTING.md), bevor du einen Pull Request einreichst.

### Auf Codewright aufbauen

Wenn du an einem Projekt arbeitest, das mit Codewright zusammenhängt und "codewright" als Teil seines Namens verwendet (z.B. "codewright-dashboard" oder "codewright-mobile"), füge bitte einen Hinweis in deine README ein, dass es nicht vom Codewright-Team gebaut wird und nicht in irgendeiner Weise mit uns verbunden ist.

---

**GitHub** [https://github.com/yoyo636/opencode](https://github.com/yoyo636/opencode)
