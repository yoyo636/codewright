<p align="center">
  <a href="https://github.com/yoyo636/opencode">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Logo do Codewright">
    </picture>
  </a>
</p>
<p align="center">O agente de programação com IA de código aberto.</p>
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

### Instalação

```bash
# From source
git clone https://github.com/yoyo636/opencode.git
cd opencode
npm install
npm run build

# Gerenciadores de pacotes

scoop install codewright             # Windows
choco install codewright             # Windows
# Build from source (see above)
brew install codewright              # macOS e Linux (fórmula oficial do brew, atualiza menos)
sudo pacman -S codewright            # Arch Linux (Stable)
paru -S codewright-bin               # Arch Linux (Latest from AUR)
mise use -g codewright               # qualquer sistema
nix run nixpkgs#codewright           # ou github:yoyo636/opencode para a branch dev mais recente
```

> [!TIP]
> Remova versões anteriores a 0.1.x antes de instalar.

### App desktop (BETA)

O Codewright também está disponível como aplicativo desktop. Baixe diretamente pela [página de releases](https://github.com/yoyo636/opencode/releases) ou em [opencode.ai/download](https://github.com/yoyo636/opencode/download).

| Plataforma            | Download                           |
| --------------------- | ---------------------------------- |
| macOS (Apple Silicon) | `codewright-desktop-mac-arm64.dmg`   |
| macOS (Intel)         | `codewright-desktop-mac-x64.dmg`     |
| Windows               | `codewright-desktop-windows-x64.exe` |
| Linux                 | `.deb`, `.rpm` ou AppImage         |

```bash
# macOS (Homebrew)
brew install --cask codewright-desktop
# Windows (Scoop)
scoop bucket add extras; scoop install extras/codewright-desktop
```

#### Diretório de instalação

O script de instalação respeita a seguinte ordem de prioridade para o caminho de instalação:

1. `$CODEWRIGHT_INSTALL_DIR` - Diretório de instalação personalizado
2. `$XDG_BIN_DIR` - Caminho compatível com a especificação XDG Base Directory
3. `$HOME/bin` - Diretório binário padrão do usuário (se existir ou puder ser criado)
4. `$HOME/.codewright/bin` - Fallback padrão

```bash
# Exemplos
# Build from source first (see above), then set CODEWRIGHT_INSTALL_DIR
# Build from source first (see above), then set XDG_BIN_DIR
```

### Agents

O Codewright inclui dois agents integrados, que você pode alternar com a tecla `Tab`.

- **build** - Padrão, agent com acesso total para trabalho de desenvolvimento
- **plan** - Agent somente leitura para análise e exploração de código
  - Nega edições de arquivos por padrão
  - Pede permissão antes de executar comandos bash
  - Ideal para explorar codebases desconhecidas ou planejar mudanças

Também há um subagent **general** para buscas complexas e tarefas em várias etapas.
Ele é usado internamente e pode ser invocado com `@general` nas mensagens.

Saiba mais sobre [agents](https://github.com/yoyo636/opencode/docs/agents).

### Documentação

Para mais informações sobre como configurar o Codewright, [**veja nossa documentação**](https://github.com/yoyo636/opencode/docs).

### Contribuir

Se você tem interesse em contribuir com o Codewright, leia os [contributing docs](./CONTRIBUTING.md) antes de enviar um pull request.

### Construindo com Codewright

Se você estiver trabalhando em um projeto relacionado ao Codewright e estiver usando "codewright" como parte do nome (por exemplo, "codewright-dashboard" ou "codewright-mobile"), adicione uma nota no README para deixar claro que não foi construído pela equipe do Codewright e não é afiliado a nós de nenhuma forma.

---

**GitHub** [https://github.com/yoyo636/opencode](https://github.com/yoyo636/opencode)
