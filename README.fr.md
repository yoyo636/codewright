<p align="center">
  <a href="https://github.com/yoyo636/codewright">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Logo Codewright">
    </picture>
  </a>
</p>
<p align="center">L'agent de codage IA open source.</p>
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

# Gestionnaires de paquets

# no scoop manifest yet — build from source             # Windows
# no chocolatey package yet — build from source             # Windows
# Build from source (see above)
# no brew formula yet — build from source              # macOS et Linux (formule officielle brew, mise à jour moins fréquente)
# no pacman package yet — build from source            # Arch Linux (Stable)
# no AUR package yet — build from source               # Arch Linux (Latest from AUR)
# build from source: git clone https://github.com/yoyo636/codewright.git               # n'importe quel OS
# no nix package yet — build from source           # ou github:yoyo636/codewright pour la branche dev la plus récente
```

> [!TIP]
> Supprimez les versions antérieures à 0.1.x avant d'installer.

### Application de bureau (BETA)

Codewright est aussi disponible en application de bureau. Téléchargez-la directement depuis la [page des releases](https://github.com/yoyo636/codewright/releases) ou [codewright.dev/download](https://github.com/yoyo636/codewright/download).

| Plateforme            | Téléchargement                     |
| --------------------- | ---------------------------------- |
| macOS (Apple Silicon) | `codewright-desktop-mac-arm64.dmg`   |
| macOS (Intel)         | `codewright-desktop-mac-x64.dmg`     |
| Windows               | `codewright-desktop-windows-x64.exe` |
| Linux                 | `.deb`, `.rpm`, ou AppImage        |

```bash
# macOS (Homebrew)
brew install --cask codewright-desktop
# Windows (Scoop)
scoop bucket add extras; scoop install extras/codewright-desktop
```

#### Répertoire d'installation

Le script d'installation respecte l'ordre de priorité suivant pour le chemin d'installation :

1. `$CODEWRIGHT_INSTALL_DIR` - Répertoire d'installation personnalisé
2. `$XDG_BIN_DIR` - Chemin conforme à la spécification XDG Base Directory
3. `$HOME/bin` - Répertoire binaire utilisateur standard (s'il existe ou peut être créé)
4. `$HOME/.codewright/bin` - Repli par défaut

```bash
# Exemples
# Build from source first (see above), then set CODEWRIGHT_INSTALL_DIR
# Build from source first (see above), then set XDG_BIN_DIR
```

### Agents

Codewright inclut deux agents intégrés que vous pouvez basculer avec la touche `Tab`.

- **build** - Par défaut, agent avec accès complet pour le travail de développement
- **plan** - Agent en lecture seule pour l'analyse et l'exploration du code
  - Refuse les modifications de fichiers par défaut
  - Demande l'autorisation avant d'exécuter des commandes bash
  - Idéal pour explorer une base de code inconnue ou planifier des changements

Un sous-agent **general** est aussi inclus pour les recherches complexes et les tâches en plusieurs étapes.
Il est utilisé en interne et peut être invoqué via `@general` dans les messages.

En savoir plus sur les [agents](https://github.com/yoyo636/codewright/docs/agents).

### Documentation

Pour plus d'informations sur la configuration d'Codewright, [**consultez notre documentation**](https://github.com/yoyo636/codewright/docs).

### Contribuer

Si vous souhaitez contribuer à Codewright, lisez nos [docs de contribution](./CONTRIBUTING.md) avant de soumettre une pull request.

### Construire avec Codewright

Si vous travaillez sur un projet lié à Codewright et que vous utilisez "codewright" dans le nom du projet (par exemple, "codewright-dashboard" ou "codewright-mobile"), ajoutez une note dans votre README pour préciser qu'il n'est pas construit par l'équipe Codewright et qu'il n'est pas affilié à nous.

---

**GitHub** [https://github.com/yoyo636/codewright](https://github.com/yoyo636/codewright)
