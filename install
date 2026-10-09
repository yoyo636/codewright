#!/usr/bin/env bash
# Install codewright from GitHub release binaries.
#
# Usage:
#   curl -fsSL https://yoyo636.github.io/codewright/install | bash
#   VERSION=3.0.3-beta curl -fsSL https://yoyo636.github.io/codewright/install | bash
#
# Environment:
#   VERSION             release version to install (default: latest)
#   CODEWRIGHT_BIN_DIR  install destination (default: $HOME/.codewright/bin)
set -euo pipefail

REPO="yoyo636/codewright"
DEST="${CODEWRIGHT_BIN_DIR:-$HOME/.codewright/bin}"

case "$(uname -s)" in
  Darwin) os="darwin" ;;
  Linux)  os="linux" ;;
  *)
    echo "codewright: unsupported OS $(uname -s)." >&2
    echo "On Windows, download codewright-windows-*.zip from:" >&2
    echo "  https://github.com/$REPO/releases" >&2
    exit 1
    ;;
esac

case "$(uname -m)" in
  x86_64|amd64) arch="x64" ;;
  arm64|aarch64) arch="arm64" ;;
  *)
    echo "codewright: unsupported architecture $(uname -m)" >&2
    exit 1
    ;;
esac

if [ -n "${VERSION:-}" ]; then
  tag="v${VERSION#v}"
else
  tag="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name"' | head -1 | cut -d '"' -f 4)"
fi
if [ -z "$tag" ]; then
  echo "codewright: could not resolve latest release tag" >&2
  exit 1
fi

if [ "$os" = "linux" ]; then
  ext="tar.gz"
else
  ext="zip"
fi

# Prefer the AVX2 build, fall back to baseline, then musl variants.
candidates=(
  "codewright-${os}-${arch}"
  "codewright-${os}-${arch}-baseline"
  "codewright-${os}-${arch}-musl"
  "codewright-${os}-${arch}-baseline-musl"
)

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

downloaded=""
for name in "${candidates[@]}"; do
  url="https://github.com/$REPO/releases/download/$tag/$name.$ext"
  if curl -fsSL -o "$tmp/archive.$ext" "$url" 2>/dev/null; then
    downloaded="$name"
    break
  fi
done
if [ -z "$downloaded" ]; then
  echo "codewright: no prebuilt binary for ${os}-${arch} at $tag" >&2
  exit 1
fi

if [ "$ext" = "tar.gz" ]; then
  tar -xzf "$tmp/archive.$ext" -C "$tmp"
else
  unzip -q "$tmp/archive.$ext" -d "$tmp"
fi

mkdir -p "$DEST"
mv "$tmp/codewright"* "$DEST/" 2>/dev/null || mv "$tmp"/bin/codewright* "$DEST/"
chmod +x "$DEST/codewright"

echo "codewright $tag ($downloaded) installed to $DEST/codewright"
case ":$PATH:" in
  *":$DEST:"*) ;;
  *) echo "Add it to your PATH:  export PATH=\"$DEST:\$PATH\"" ;;
esac
