<p align="center">
  <a href="https://github.com/yoyo636/opencode">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Logo Codewright">
    </picture>
  </a>
</p>
<p align="center">L’agente di coding AI open source.</p>
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

### Installazione

```bash
# From source
git clone https://github.com/yoyo636/opencode.git
cd opencode
npm install
npm run build

# Package manager

scoop install codewright             # Windows
choco install codewright             # Windows
# Build from source (see above)
brew install codewright              # macOS e Linux (formula brew ufficiale, aggiornata meno spesso)
sudo pacman -S codewright            # Arch Linux (Stable)
paru -S codewright-bin               # Arch Linux (Latest from AUR)
mise use -g codewright               # Qualsiasi OS
nix run nixpkgs#codewright           # oppure github:yoyo636/opencode per l’ultima branch di sviluppo
```

> [!TIP]
> Rimuovi le versioni precedenti alla 0.1.x prima di installare.

### App Desktop (BETA)

Codewright è disponibile anche come applicazione desktop. Puoi scaricarla direttamente dalla [pagina delle release](https://github.com/yoyo636/opencode/releases) oppure da [opencode.ai/download](https://github.com/yoyo636/opencode/download).

| Piattaforma           | Download                           |
| --------------------- | ---------------------------------- |
| macOS (Apple Silicon) | `codewright-desktop-mac-arm64.dmg`   |
| macOS (Intel)         | `codewright-desktop-mac-x64.dmg`     |
| Windows               | `codewright-desktop-windows-x64.exe` |
| Linux                 | `.deb`, `.rpm`, oppure AppImage    |

```bash
# macOS (Homebrew)
brew install --cask codewright-desktop
# Windows (Scoop)
scoop bucket add extras; scoop install extras/codewright-desktop
```

#### Directory di installazione

Lo script di installazione rispetta il seguente ordine di priorità per il percorso di installazione:

1. `$CODEWRIGHT_INSTALL_DIR` – Directory di installazione personalizzata
2. `$XDG_BIN_DIR` – Percorso conforme alla XDG Base Directory Specification
3. `$HOME/bin` – Directory binaria standard dell’utente (se esiste o può essere creata)
4. `$HOME/.codewright/bin` – Fallback predefinito

```bash
# Esempi
# Build from source first (see above), then set CODEWRIGHT_INSTALL_DIR
# Build from source first (see above), then set XDG_BIN_DIR
```

### Agenti

Codewright include due agenti integrati tra cui puoi passare usando il tasto `Tab`.

- **build** – Predefinito, agente con accesso completo per il lavoro di sviluppo
- **plan** – Agente in sola lettura per analisi ed esplorazione del codice
  - Nega le modifiche ai file per impostazione predefinita
  - Chiede il permesso prima di eseguire comandi bash
  - Ideale per esplorare codebase sconosciute o pianificare modifiche

È inoltre incluso un sotto-agente **general** per ricerche complesse e attività multi-step.
Viene utilizzato internamente e può essere invocato usando `@general` nei messaggi.

Scopri di più sugli [agenti](https://github.com/yoyo636/opencode/docs/agents).

### Documentazione

Per maggiori informazioni su come configurare Codewright, [**consulta la nostra documentazione**](https://github.com/yoyo636/opencode/docs).

### Contribuire

Se sei interessato a contribuire a Codewright, leggi la nostra [guida alla contribuzione](./CONTRIBUTING.md) prima di inviare una pull request.

### Costruire su Codewright

Se stai lavorando a un progetto correlato a Codewright e che utilizza “codewright” come parte del nome (ad esempio “codewright-dashboard” o “codewright-mobile”), aggiungi una nota nel tuo README per chiarire che non è sviluppato dal team Codewright e che non è affiliato in alcun modo con noi.

---

**GitHub** [https://github.com/yoyo636/opencode](https://github.com/yoyo636/opencode)
