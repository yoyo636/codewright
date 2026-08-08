<p align="center">
  <a href="https://github.com/yoyo636/codewright">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Codewright logo">
    </picture>
  </a>
</p>
<p align="center">Den open source AI-kodeagent.</p>
<p align="center"><a href="https://github.com/yoyo636/codewright/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/yoyo636/codewright/publish.yml?style=flat-square&branch=dev" /></a>
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

[![Codewright Terminal UI](packages/web/src/assets/lander/screenshot.png)](https://github.com/yoyo636/codewright)

---

### Installation

```bash
# From source
git clone https://github.com/yoyo636/codewright.git
cd codewright
bun install
bun run --cwd packages/opencode build

# Pakkehåndteringer

# no scoop manifest yet — build from source             # Windows
# no chocolatey package yet — build from source             # Windows
# Build from source (see above)
# no brew formula yet — build from source              # macOS og Linux (officiel brew formula, opdateres sjældnere)
# no pacman package yet — build from source            # Arch Linux (Stable)
# no AUR package yet — build from source               # Arch Linux (Latest from AUR)
# build from source: git clone https://github.com/yoyo636/codewright.git               # alle OS
# no nix package yet — build from source           # eller github:yoyo636/codewright for nyeste dev-branch
```

> [!TIP]
> Fjern versioner ældre end 0.1.x før installation.

### Desktop-app (BETA)

Codewright findes også som desktop-app. Download direkte fra [releases-siden](https://github.com/yoyo636/codewright/releases) eller [codewright.dev/download](https://github.com/yoyo636/codewright/download).

| Platform              | Download                           |
| --------------------- | ---------------------------------- |
| macOS (Apple Silicon) | `codewright-desktop-mac-arm64.dmg`   |
| macOS (Intel)         | `codewright-desktop-mac-x64.dmg`     |
| Windows               | `codewright-desktop-windows-x64.exe` |
| Linux                 | `.deb`, `.rpm`, eller AppImage     |

```bash
# macOS (Homebrew)
brew install --cask codewright-desktop
# Windows (Scoop)
scoop bucket add extras; scoop install extras/codewright-desktop
```

#### Installationsmappe

Installationsscriptet bruger følgende prioriteringsrækkefølge for installationsstien:

1. `$CODEWRIGHT_INSTALL_DIR` - Tilpasset installationsmappe
2. `$XDG_BIN_DIR` - Sti der følger XDG Base Directory Specification
3. `$HOME/bin` - Standard bruger-bin-mappe (hvis den findes eller kan oprettes)
4. `$HOME/.codewright/bin` - Standard fallback

```bash
# Eksempler
# Build from source first (see above), then set CODEWRIGHT_INSTALL_DIR
# Build from source first (see above), then set XDG_BIN_DIR
```

### Agents

Codewright har to indbyggede agents, som du kan skifte mellem med `Tab`-tasten.

- **build** - Standard, agent med fuld adgang til udviklingsarbejde
- **plan** - Skrivebeskyttet agent til analyse og kodeudforskning
  - Afviser filredigering som standard
  - Spørger om tilladelse før bash-kommandoer
  - Ideel til at udforske ukendte kodebaser eller planlægge ændringer

Derudover findes der en **general**-subagent til komplekse søgninger og flertrinsopgaver.
Den bruges internt og kan kaldes via `@general` i beskeder.

Læs mere om [agents](https://github.com/yoyo636/codewright/docs/agents).

### Dokumentation

For mere info om konfiguration af Codewright, [**se vores docs**](https://github.com/yoyo636/codewright/docs).

### Bidrag

Hvis du vil bidrage til Codewright, så læs vores [contributing docs](./CONTRIBUTING.md) før du sender en pull request.

### Bygget på Codewright

Hvis du arbejder på et projekt der er relateret til Codewright og bruger "codewright" som en del af navnet; f.eks. "codewright-dashboard" eller "codewright-mobile", så tilføj en note i din README, der tydeliggør at projektet ikke er bygget af Codewright-teamet og ikke er tilknyttet os på nogen måde.

---

**GitHub** [https://github.com/yoyo636/codewright](https://github.com/yoyo636/codewright)
