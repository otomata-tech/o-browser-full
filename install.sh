#!/usr/bin/env bash
# o-browser-full installer (Mac / Linux).
#
# Sets up a user-level install at ~/.o-browser-full with a docker-compose.yml
# pointing at the published ghcr image, exposes the `o-browser` wrapper on PATH,
# and starts the container.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
HOME_DIR="${O_BROWSER_HOME:-$HOME/.o-browser-full}"
BIN_DIR="${O_BROWSER_BIN:-/usr/local/bin}"

echo "==> Checking prerequisites"
command -v docker >/dev/null || { echo "Docker not found — install Docker Desktop first."; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "docker compose not available"; exit 1; }

echo "==> Setting up $HOME_DIR"
mkdir -p "$HOME_DIR" "$HOME_DIR/profiles" "$HOME_DIR/recordings" "$HOME_DIR/sessions"
cp -f "$REPO_DIR/compose.user.yml" "$HOME_DIR/docker-compose.yml"

echo "==> Installing 'o-browser' wrapper to $BIN_DIR"
if [[ -w "$BIN_DIR" ]]; then
  install -m 0755 "$REPO_DIR/bin/o-browser" "$BIN_DIR/o-browser"
else
  echo "    (sudo required for $BIN_DIR)"
  sudo install -m 0755 "$REPO_DIR/bin/o-browser" "$BIN_DIR/o-browser"
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

   o-browser status     # health
   o-browser logs       # container logs
   o-browser stop|start

VNC viewer: http://localhost:8080/vnc/vnc.html?autoconnect=true
API base:   http://localhost:8080/

Profiles + recordings live at $HOME_DIR/{profiles,recordings,sessions}.
EOF
