#!/usr/bin/env bash
# Install the prebuilt codewright binary for the current platform onto PATH.
#
# Usage:
#   ./script/install-bin.sh              # install to ~/bin
#   CODEWRIGHT_BIN_DIR=/usr/local/bin ./script/install-bin.sh
#
# The dist archives are produced by `packages/codewright/script/build.ts`.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$REPO_ROOT/packages/codewright/dist"
DEST="${CODEWRIGHT_BIN_DIR:-$HOME/bin}"

case "$(uname -s)" in
  Darwin) os="darwin" ;;
  Linux)  os="linux" ;;
  MINGW*|MSYS*|CYGWIN*) os="windows" ;;
  *) echo "install-bin: unsupported OS $(uname -s)" >&2; exit 1 ;;
esac

case "$(uname -m)" in
  x86_64|amd64) arch="x64" ;;
  arm64|aarch64) arch="arm64" ;;
  arm) arch="arm" ;;
  *) echo "install-bin: unsupported arch $(uname -m)" >&2; exit 1 ;;
esac

# Prefer the AVX2 build, fall back to baseline, then musl variants.
candidates=(
  "codewright-${os}-${arch}"
  "codewright-${os}-${arch}-baseline"
  "codewright-${os}-${arch}-musl"
  "codewright-${os}-${arch}-baseline-musl"
)

archive=""
for name in "${candidates[@]}"; do
  for ext in ".zip" ".tar.gz"; do
    if [[ -f "$DIST/$name$ext" ]]; then
      archive="$DIST/$name$ext"
      break 2
    fi
  done
done

if [[ -z "$archive" ]]; then
  echo "install-bin: no prebuilt binary found for ${os}-${arch} in $DIST" >&2
  echo "install-bin: run 'bun run build' first (packages/codewright)" >&2
  exit 1
fi

mkdir -p "$DEST"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

if [[ "$archive" == *.zip ]]; then
  unzip -q "$archive" -d "$tmp"
  src="$tmp/codewright"
else
  tar -xzf "$archive" -C "$tmp"
  src="$(find "$tmp" -maxdepth 2 -name codewright -type f | head -n1)"
fi

if [[ -z "$src" || ! -f "$src" ]]; then
  echo "install-bin: could not extract codewright binary from $archive" >&2
  exit 1
fi

install -m 0755 "$src" "$DEST/codewright"

if ! "$DEST/codewright" --version >/dev/null 2>&1; then
  echo "install-bin: installed binary failed its own --version check" >&2
  exit 1
fi

echo "install-bin: codewright -> $DEST/codewright"
echo "install-bin: ensure '$DEST' is on PATH, e.g.: export PATH=\"\$HOME/bin:\$PATH\""