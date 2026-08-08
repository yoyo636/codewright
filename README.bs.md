<p align="center">
  <a href="https://github.com/yoyo636/codewright">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Codewright logo">
    </picture>
  </a>
</p>
<p align="center">Codewright je open source AI agent za programiranje.</p>
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

### Instalacija

```bash
# From source
git clone https://github.com/yoyo636/codewright.git
cd codewright
bun install
bun run --cwd packages/opencode build

# Package manageri

# no scoop manifest yet — build from source             # Windows
# no chocolatey package yet — build from source             # Windows
# Build from source (see above)
# no brew formula yet — build from source              # macOS i Linux (zvanična brew formula, rjeđe se ažurira)
# no pacman package yet — build from source            # Arch Linux (Stable)
# no AUR package yet — build from source               # Arch Linux (Latest from AUR)
# build from source: git clone https://github.com/yoyo636/codewright.git               # Bilo koji OS
# no nix package yet — build from source           # ili github:yoyo636/codewright za najnoviji dev branch
```

> [!TIP]
> Ukloni verzije starije od 0.1.x prije instalacije.

### Desktop aplikacija (BETA)

Codewright je dostupan i kao desktop aplikacija. Preuzmi je direktno sa [stranice izdanja](https://github.com/yoyo636/codewright/releases) ili sa [codewright.dev/download](https://github.com/yoyo636/codewright/download).

| Platforma             | Preuzimanje                        |
| --------------------- | ---------------------------------- |
| macOS (Apple Silicon) | `codewright-desktop-mac-arm64.dmg`   |
| macOS (Intel)         | `codewright-desktop-mac-x64.dmg`     |
| Windows               | `codewright-desktop-windows-x64.exe` |
| Linux                 | `.deb`, `.rpm`, ili AppImage       |

```bash
# macOS (Homebrew)
brew install --cask codewright-desktop
# Windows (Scoop)
scoop bucket add extras; scoop install extras/codewright-desktop
```

#### Instalacijski direktorij

Instalacijska skripta koristi sljedeći redoslijed prioriteta za putanju instalacije:

1. `$CODEWRIGHT_INSTALL_DIR` - Prilagođeni instalacijski direktorij
2. `$XDG_BIN_DIR` - Putanja usklađena sa XDG Base Directory specifikacijom
3. `$HOME/bin` - Standardni korisnički bin direktorij (ako postoji ili se može kreirati)
4. `$HOME/.codewright/bin` - Podrazumijevana rezervna lokacija

```bash
# Primjeri
# Build from source first (see above), then set CODEWRIGHT_INSTALL_DIR
# Build from source first (see above), then set XDG_BIN_DIR
```

### Agenti

Codewright uključuje dva ugrađena agenta između kojih možeš prebacivati tasterom `Tab`.

- **build** - Podrazumijevani agent sa punim pristupom za razvoj
- **plan** - Agent samo za čitanje za analizu i istraživanje koda
  - Podrazumijevano zabranjuje izmjene datoteka
  - Traži dozvolu prije pokretanja bash komandi
  - Idealan za istraživanje nepoznatih codebase-ova ili planiranje izmjena

Uključen je i **general** pod-agent za složene pretrage i višekoračne zadatke.
Koristi se interno i može se pozvati pomoću `@general` u porukama.

Saznaj više o [agentima](https://github.com/yoyo636/codewright/docs/agents).

### Dokumentacija

Za više informacija o konfiguraciji Codewright-a, [**pogledaj dokumentaciju**](https://github.com/yoyo636/codewright/docs).

### Doprinosi

Ako želiš doprinositi Codewright-u, pročitaj [upute za doprinošenje](./CONTRIBUTING.md) prije slanja pull requesta.

### Gradnja na Codewright-u

Ako radiš na projektu koji je povezan s Codewright-om i koristi "codewright" kao dio naziva, npr. "codewright-dashboard" ili "codewright-mobile", dodaj napomenu u svoj README da projekat nije napravio Codewright tim i da nije povezan s nama.

---

**GitHub** [https://github.com/yoyo636/codewright](https://github.com/yoyo636/codewright)
