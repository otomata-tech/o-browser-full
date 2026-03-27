# o-browser-server

Remote Chrome service with VNC, CDP, session management, and recording.

For the Python client library, see [o-browser](https://github.com/AlexisLaporte/o-browser).

## Quick start

```bash
AUTH_TOKEN=your-secret-token docker compose up -d
```

Open http://localhost:8080/?token=your-secret-token

## Features

- Chrome headful in virtual display (Xvfb)
- VNC access via WebSocket (noVNC)
- CDP endpoint for Playwright/Puppeteer
- Session management API (start/stop, recordings)
- Web UI for manual control

## API

### Start session
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"profile":"default"}' \
  http://localhost:8080/api/sessions
```

### Get current session
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/sessions/current
```

### Stop session
```bash
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/sessions/current
```

## Deployment (Cloud Run)

```bash
docker compose build
docker tag o-browser-server:latest europe-west1-docker.pkg.dev/PROJECT/docker/o-browser-server
docker push europe-west1-docker.pkg.dev/PROJECT/docker/o-browser-server

gcloud run deploy o-browser-server \
  --image=europe-west1-docker.pkg.dev/PROJECT/docker/o-browser-server:latest \
  --region=europe-west1 \
  --execution-environment=gen2 \
  --memory=4Gi --cpu=2 \
  --no-cpu-throttling \
  --min-instances=1 --max-instances=1 \
  --timeout=3600 \
  --session-affinity \
  --allow-unauthenticated \
  --port=8080 \
  --set-env-vars=AUTH_TOKEN=xxx
```
