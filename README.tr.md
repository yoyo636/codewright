<p align="center">
  <a href="https://github.com/yoyo636/opencode">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Codewright logo">
    </picture>
  </a>
</p>
<p align="center">Açık kaynaklı yapay zeka kodlama asistanı.</p>
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

### Kurulum

```bash
# From source
git clone https://github.com/yoyo636/opencode.git
cd opencode
npm install
npm run build

# Paket yöneticileri

scoop install codewright             # Windows
choco install codewright             # Windows
# Build from source (see above)
brew install codewright              # macOS ve Linux (resmi brew formülü, daha az güncellenir)
sudo pacman -S codewright            # Arch Linux (Stable)
paru -S codewright-bin               # Arch Linux (Latest from AUR)
mise use -g codewright               # Tüm işletim sistemleri
nix run nixpkgs#codewright           # veya en güncel geliştirme dalı için github:yoyo636/opencode
```

> [!TIP]
> Kurulumdan önce 0.1.x'ten eski sürümleri kaldırın.

### Masaüstü Uygulaması (BETA)

Codewright ayrıca masaüstü uygulaması olarak da mevcuttur. Doğrudan [sürüm sayfasından](https://github.com/yoyo636/opencode/releases) veya [opencode.ai/download](https://github.com/yoyo636/opencode/download) adresinden indirebilirsiniz.

| Platform              | İndirme                            |
| --------------------- | ---------------------------------- |
| macOS (Apple Silicon) | `codewright-desktop-mac-arm64.dmg`   |
| macOS (Intel)         | `codewright-desktop-mac-x64.dmg`     |
| Windows               | `codewright-desktop-windows-x64.exe` |
| Linux                 | `.deb`, `.rpm` veya AppImage       |

```bash
# macOS (Homebrew)
brew install --cask codewright-desktop
# Windows (Scoop)
scoop bucket add extras; scoop install extras/codewright-desktop
```

#### Kurulum Dizini (Installation Directory)

Kurulum betiği (install script), kurulum yolu (installation path) için aşağıdaki öncelik sırasını takip eder:

1. `$CODEWRIGHT_INSTALL_DIR` - Özel kurulum dizini
2. `$XDG_BIN_DIR` - XDG Base Directory Specification uyumlu yol
3. `$HOME/bin` - Standart kullanıcı binary dizini (varsa veya oluşturulabiliyorsa)
4. `$HOME/.codewright/bin` - Varsayılan yedek konum

```bash
# Örnekler
# Build from source first (see above), then set CODEWRIGHT_INSTALL_DIR
# Build from source first (see above), then set XDG_BIN_DIR
```

### Ajanlar

Codewright, `Tab` tuşuyla aralarında geçiş yapabileceğiniz iki yerleşik (built-in) ajan içerir.

- **build** - Varsayılan, geliştirme çalışmaları için tam erişimli ajan
- **plan** - Analiz ve kod keşfi için salt okunur ajan
  - Varsayılan olarak dosya düzenlemelerini reddeder
  - Bash komutlarını çalıştırmadan önce izin ister
  - Tanımadığınız kod tabanlarını keşfetmek veya değişiklikleri planlamak için ideal

Ayrıca, karmaşık aramalar ve çok adımlı görevler için bir **genel** alt ajan bulunmaktadır.
Bu dahili olarak kullanılır ve mesajlarda `@general` ile çağrılabilir.

[Ajanlar](https://github.com/yoyo636/opencode/docs/agents) hakkında daha fazla bilgi edinin.

### Dokümantasyon

Codewright'u nasıl yapılandıracağınız hakkında daha fazla bilgi için [**dokümantasyonumuza göz atın**](https://github.com/yoyo636/opencode/docs).

### Katkıda Bulunma

Codewright'a katkıda bulunmak istiyorsanız, lütfen bir pull request göndermeden önce [katkıda bulunma dokümanlarımızı](./CONTRIBUTING.md) okuyun.

### Codewright Üzerine Geliştirme

Codewright ile ilgili bir proje üzerinde çalışıyorsanız ve projenizin adının bir parçası olarak "codewright" kullanıyorsanız (örneğin, "codewright-dashboard" veya "codewright-mobile"), lütfen README dosyanıza projenin Codewright ekibi tarafından geliştirilmediğini ve bizimle hiçbir şekilde bağlantılı olmadığını belirten bir not ekleyin.

---

**GitHub** [https://github.com/yoyo636/opencode](https://github.com/yoyo636/opencode)
