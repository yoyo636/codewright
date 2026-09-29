#!/usr/bin/env bash
# Deploy the codewright website to GitHub Pages.
#
# The website is a single self-contained index.html at the repo root. GitHub
# Pages is configured to build from the `gh-pages` branch (root). This script
# copies the current index.html onto a gh-pages worktree and pushes it, so a
# deploy is one command: ./script/deploy-website.sh
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
BRANCH="gh-pages"
REMOTE="github"

# Confirm the gh-pages branch exists on the remote.
if ! git ls-remote --exit-code --heads "$REMOTE" "$BRANCH" >/dev/null 2>&1; then
  echo "error: $REMOTE/$BRANCH does not exist" >&2
  exit 1
fi

VERSION="$(grep -o 'v3\.0\.[0-9]*' "$ROOT/index.html" | head -1 || true)"

WORKTREE="$(mktemp -d)/$BRANCH"
cleanup() {
  git worktree remove --force "$WORKTREE" >/dev/null 2>&1 || true
}
trap cleanup EXIT

git fetch "$REMOTE" "$BRANCH" --quiet
git worktree add --force "$WORKTREE" "$REMOTE/$BRANCH" >/dev/null

cp "$ROOT/index.html" "$WORKTREE/index.html"
cp "$ROOT/script/install.sh" "$WORKTREE/install"
touch "$WORKTREE/.nojekyll"

git -C "$WORKTREE" add index.html install .nojekyll
if git -C "$WORKTREE" diff --cached --quiet; then
  echo "website already up to date on $BRANCH"
  exit 0
fi
git -C "$WORKTREE" commit --quiet -m "deploy: website ${VERSION:-latest}"
git -C "$WORKTREE" push "$REMOTE" "HEAD:$BRANCH"
echo "deployed ${VERSION:-latest} to $REMOTE/$BRANCH → https://yoyo636.github.io/codewright/"
