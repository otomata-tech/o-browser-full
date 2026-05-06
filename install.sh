#!/usr/bin/env bash
# o-browser-full installer (Mac / Linux).
#
# Two ways to run:
#
#   1. Curl one-liner (recommended for ops, no clone needed):
#        curl -fsSL https://raw.githubusercontent.com/otomata-tech/o-browser-full/main/install.sh | bash
#      In this mode the script clones the repo into ~/.o-browser-full/source first.
#
#   2. From a local clone:
#        git clone https://github.com/otomata-tech/o-browser-full.git
#        cd o-browser-full && ./install.sh
#
# The script:
#   - Clones (or reuses) ~/.o-browser-full/source/ when needed.
#   - Sets up ~/.o-browser-full/{compose.yml, profiles, recordings, sessions, extensions}.
#   - Symlinks `o-browser` from the source into /usr/local/bin (sudo on Mac).
#   - Installs the CLI Node deps under ~/.o-browser-full/source/.
#   - Pulls the ghcr image and starts the container.
set -euo pipefail

HOME_DIR="${O_BROWSER_HOME:-$HOME/.o-browser-full}"
BIN_DIR="${O_BROWSER_BIN:-/usr/local/bin}"
REPO_URL="${O_BROWSER_REPO_URL:-https://github.com/otomata-tech/o-browser-full.git}"
REPO_REF="${O_BROWSER_REPO_REF:-main}"

# Detect how the script is being run
script_path="${BASH_SOURCE[0]:-}"
if [[ -n "$script_path" ]] && [[ -f "$script_path" ]]; then
  REPO_DIR="$(cd "$(dirname "$script_path")" && pwd)"
else
  # Curl-piped: no script path, we'll clone below
  REPO_DIR=""
fi

# Validate the repo dir actually contains the source files we need
needs_clone=true
if [[ -n "$REPO_DIR" ]] && [[ -f "$REPO_DIR/bin/o-browser" ]] && [[ -f "$REPO_DIR/compose.user.yml" ]]; then
  needs_clone=false
fi

echo "==> Checking prerequisites"
command -v docker >/dev/null || { echo "Docker not found — install Docker Desktop first."; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "docker compose not available"; exit 1; }
command -v node >/dev/null || { echo "Node.js not found — install Node 20+ (https://nodejs.org/)."; exit 1; }
command -v npm >/dev/null || { echo "npm not found"; exit 1; }
command -v git >/dev/null || { echo "git not found — required for 'o-browser extension install'"; exit 1; }

if [[ "$needs_clone" == "true" ]]; then
  REPO_DIR="$HOME_DIR/source"
  if [[ -d "$REPO_DIR/.git" ]]; then
    echo "==> Updating $REPO_DIR"
    git -C "$REPO_DIR" fetch --quiet origin "$REPO_REF"
    git -C "$REPO_DIR" reset --hard --quiet "origin/$REPO_REF"
  else
    echo "==> Cloning $REPO_URL → $REPO_DIR"
    git clone --depth=1 --branch "$REPO_REF" --quiet "$REPO_URL" "$REPO_DIR"
  fi
fi

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
Source:     $REPO_DIR (\`o-browser\` symlinks to bin/o-browser here; git pull to update)
EOF
