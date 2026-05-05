#!/usr/bin/env bash
# o-browser-full installer (Mac / Linux).
#
# - Sets up a user-level data dir at ~/.o-browser-full (compose.yml + profiles/
#   + recordings/ + sessions/), pointing at the published ghcr image.
# - Symlinks the `o-browser` wrapper from the cloned repo into a PATH dir so
#   updates via `git pull` are picked up immediately.
# - Installs the CLI Node deps (tsx, playwright-core, ws).
# - Pulls the image and starts the container.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
HOME_DIR="${O_BROWSER_HOME:-$HOME/.o-browser-full}"
BIN_DIR="${O_BROWSER_BIN:-/usr/local/bin}"

echo "==> Checking prerequisites"
command -v docker >/dev/null || { echo "Docker not found — install Docker Desktop first."; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "docker compose not available"; exit 1; }
command -v node >/dev/null || { echo "Node.js not found — install Node 20+."; exit 1; }
command -v npm >/dev/null || { echo "npm not found"; exit 1; }
command -v git >/dev/null || { echo "git not found — required for 'o-browser extension install'"; exit 1; }

echo "==> Setting up $HOME_DIR"
mkdir -p "$HOME_DIR" "$HOME_DIR/profiles" "$HOME_DIR/recordings" "$HOME_DIR/sessions" "$HOME_DIR/extensions"
cp -f "$REPO_DIR/compose.user.yml" "$HOME_DIR/docker-compose.yml"

echo "==> Installing CLI dependencies"
( cd "$REPO_DIR" && npm install --silent )

echo "==> Linking 'o-browser' to $BIN_DIR"
TARGET="$BIN_DIR/o-browser"
if [[ -w "$BIN_DIR" ]]; then
  ln -sf "$REPO_DIR/bin/o-browser" "$TARGET"
else
  echo "    (sudo required for $BIN_DIR)"
  sudo ln -sf "$REPO_DIR/bin/o-browser" "$TARGET"
fi

echo "==> Pulling image"
( cd "$HOME_DIR" && docker compose pull )

echo "==> Starting container"
( cd "$HOME_DIR" && docker compose up -d )

echo "==> Waiting for health"
for i in {1..30}; do
  if curl -fs http://localhost:8080/health >/dev/null 2>&1; then
    echo "    OK"
    break
  fi
  sleep 1
  if [[ $i -eq 30 ]]; then
    echo "    timeout — check 'o-browser logs'"
    exit 1
  fi
done

cat <<EOF

==> Done.

   o-browser status                # container health
   o-browser session start         # start a browser session
   o-browser nav https://...       # navigate
   o-browser extension install <user>/<repo>

VNC viewer: http://localhost:8080/vnc/vnc.html?autoconnect=true
API base:   http://localhost:8080/

Data dir:   $HOME_DIR (profiles, recordings, sessions, extensions)
Repo dir:   $REPO_DIR (the o-browser command symlinks to bin/o-browser here)
EOF
