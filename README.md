# o-browser-full

The full local browser stack: stealth Chrome + Xvfb + VNC viewer + CDP proxy + session recording (rrweb + HAR + screencast). Wraps everything needed to drive a real Chrome from another process (Playwright via CDP) or a human (via VNC), without instrumentation that fingerprints as a bot.

Sister project of [`o-browser`](https://github.com/otomata-tech/o-browser), the lightweight Python client lib. Use `o-browser` when a local Chrome on your machine is enough; use `o-browser-full` when you need a stable container, recordings, persistent profiles for sites that fight bots (banking, fintech), or remote/VNC access.

## Install (Mac / Linux)

Prerequisites: [Docker](https://www.docker.com/products/docker-desktop/), Node 20+, git.

**One-liner** (recommended):

```bash
curl -fsSL https://raw.githubusercontent.com/otomata-tech/o-browser-full/main/install.sh | bash
```

The script clones the repo into `~/.o-browser-full/source/`, drops a `~/.o-browser-full/docker-compose.yml`, symlinks `o-browser` into `/usr/local/bin` (sudo on Mac), pulls the prebuilt image, and starts the container.

**Or from a local clone** (if you want the source on hand):

```bash
git clone https://github.com/otomata-tech/o-browser-full.git
cd o-browser-full
./install.sh
```

After install:

```bash
o-browser status                # health check
o-browser logs                  # container logs
o-browser stop                  # stop
o-browser start                 # start (idempotent)
```

## Or run directly

```bash
docker run -d --name browser \
  -p 127.0.0.1:8080:8080 -p 127.0.0.1:6080:6080 -p 127.0.0.1:9222:9223 \
  -v ./profiles:/app/profiles \
  -v ./recordings:/app/recordings \
  --shm-size=2g --security-opt seccomp=unconfined \
  ghcr.io/otomata-tech/o-browser-full:latest
```

Or with `docker-compose`:

```bash
docker compose up -d
```

## Access

- Web UI : http://localhost:8080/
- VNC viewer : http://localhost:8080/vnc/vnc.html?autoconnect=true
- API : http://localhost:8080/api/
- CDP : http://localhost:8080/cdp/

Stop: `docker compose down` (or `docker stop browser && docker rm browser`).

## Auth

No bearer-token auth. The container is meant to be reachable only from a trusted network — defaults bind to `127.0.0.1` only. If you put it behind a reverse proxy, add auth there.

## Features

- Chrome headful in a virtual display (Xvfb + x11vnc + noVNC)
- CDP endpoint for Playwright / Puppeteer (`/cdp/*` proxied through nginx)
- Session lifecycle API: start, stop, screenshot, list recordings
- Per-session recording: rrweb DOM + HAR + screencast.mp4 + named screenshots
- Persistent Chrome profiles (cookies, login state) under `profiles/`

## API

| Method | Path | Description |
|------|------|-------------|
| `GET`    | `/health` | Health check |
| `POST`   | `/api/sessions` | Start session `{workflow, profile}` |
| `GET`    | `/api/sessions/current` | Current session (CDP URL, status) |
| `DELETE` | `/api/sessions/current` | End session |
| `POST`   | `/api/sessions/current/screenshot` | X11 screenshot `{name}` |
| `GET`    | `/api/sessions/:id/files` | List recording files |
| `GET`    | `/api/recordings/:id/:file` | Serve recording file |
| `GET`    | `/api/profiles` | List Chrome profiles |

### Examples

```bash
# Start a session
curl -X POST http://localhost:8080/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"profile":"default"}'

# Current session
curl http://localhost:8080/api/sessions/current

# End session
curl -X DELETE http://localhost:8080/api/sessions/current
```

## Profiles

- `profiles/` — persistent Chrome profiles (volume-mounted, hold cookies / login state)
- `profiles-seed/` — drop profile templates here to seed `profiles/` on first use

## Recording

Each session writes to `recordings/<session_id>/`:

- `rrweb-events.json` — DOM replay events
- `network.har` — HTTP traffic with bodies
- `browser-state.jsonl` — cookies / storage snapshots
- `screencast.mp4` — X11 screencast
- `screenshots/` — named screenshots taken via API

## Deployment (Cloud Run)

```bash
docker build -t europe-west1-docker.pkg.dev/<project>/<repo>/browser .
docker push europe-west1-docker.pkg.dev/<project>/<repo>/browser

gcloud run deploy browser \
  --image=europe-west1-docker.pkg.dev/<project>/<repo>/browser:latest \
  --region=europe-west1 \
  --execution-environment=gen2 \
  --memory=4Gi --cpu=2 \
  --no-cpu-throttling \
  --min-instances=1 --max-instances=1 \
  --timeout=3600 \
  --session-affinity \
  --port=8080
```

Key flags:
- `gen2` — full Linux kernel (Chrome)
- `no-cpu-throttling` — Chrome needs CPU even idle
- `min-instances=1` — avoid cold starts (Xvfb / Chrome boot slow)
- `session-affinity` — sticky VNC / CDP connections
- `timeout=3600` — 1 h sessions

Profiles are ephemeral on Cloud Run (lost on scale-down). For persistence, mount a GCS Fuse volume or run on a Compute VM.

## Sister project

[`o-browser`](https://github.com/otomata-tech/o-browser) — Python client lib (`BrowserClient` for local Chrome, `RemoteBrowser` for CDP-connecting to this server).
