# o-browser-server

Remote Chrome service: API, VNC viewer, CDP proxy, session recording (rrweb + HAR + screencast). Sister project of [`o-browser`](https://github.com/otomata-tech/o-browser) (Python client lib).

## Quick start

Prerequisites: [Docker](https://www.docker.com/products/docker-desktop/).

### Pull pre-built image

```bash
docker run -d --name browser \
  -p 8080:8080 -p 6080:6080 -p 9222:9222 \
  -v ./profiles:/app/profiles \
  -v ./recordings:/app/recordings \
  --shm-size=2g --security-opt seccomp=unconfined \
  ghcr.io/otomata-tech/o-browser-server:latest
```

### Build from source

```bash
git clone https://github.com/otomata-tech/o-browser-server.git
cd o-browser-server
docker compose up -d
```

### Access

- Web UI : http://localhost:8080/
- VNC viewer : http://localhost:8080/vnc/vnc.html?autoconnect=true
- API : http://localhost:8080/api/
- CDP : http://localhost:8080/cdp/

To stop : `docker stop browser && docker rm browser` or `docker compose down`.

## Auth

No bearer-token auth by default. The container is intended to be reachable only from a trusted network. To restrict to loopback only, override the port bindings in `docker-compose.yml`:

```yaml
ports:
  - "127.0.0.1:8080:8080"
```

## Features

- Chrome headful in virtual display (Xvfb + x11vnc + noVNC)
- CDP endpoint for Playwright/Puppeteer (`/cdp/*` proxied through nginx)
- Session lifecycle API (start, stop, screenshot, list recordings)
- Per-session recording: rrweb DOM + HAR + screencast.mp4 + screenshots/

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

# Current session (CDP URL inside the response)
curl http://localhost:8080/api/sessions/current

# End session
curl -X DELETE http://localhost:8080/api/sessions/current
```

## Profiles

- `profiles/` — persistent Chrome profiles (volume-mounted, contain cookies/login state)
- `profiles-seed/` — empty by default; drop profile templates here to seed `profiles/` on first use

## Recording

Each session writes to `recordings/<session_id>/` :
- `rrweb-events.json` — DOM replay events
- `network.har` — HTTP traffic with bodies
- `browser-state.jsonl` — cookies/storage snapshots
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
- `gen2` : full Linux kernel (needed for Chrome)
- `no-cpu-throttling` : Chrome needs CPU even idle
- `min-instances=1` : avoid cold starts (Xvfb/Chrome boot slow)
- `session-affinity` : sticky VNC/CDP connections
- `timeout=3600` : 1h sessions

Profiles are ephemeral on Cloud Run (lost on scale-down). For persistence, mount a GCS Fuse volume or use a Compute VM instead.

## Sister project

Python client lib: [`o-browser`](https://github.com/otomata-tech/o-browser) — `BrowserClient` (local Chrome) and `RemoteBrowser` (connects to this server via CDP).
