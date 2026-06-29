# VPS Dashboard

A clean real-time dashboard for monitoring your VPS and Docker containers.

Designed for speed and a lightweight footprint, it features a concurrent Go backend paired with a snappy React/Vite frontend. It securely hooks into your host's system metrics and the Docker daemon, while remaining fully decoupled from container lifecycle mutations.

---

## Features

- **Real-Time Host Metrics**: Live CPU, Memory, Disk, and Network bandwidth monitoring via WebSockets.
- **Docker Integration**: Automatically lists running containers, their resource usage (CPU/Mem), and uptimes.
- **Traefik Auto-Discovery**: Automatically parses your container labels (e.g., `traefik.http.routers...`) and provides clickable links to your public services right from the dashboard.
- **Live Log Streaming**: View streaming logs for any running container directly in the browser.
- **Ultra-Lean Deployment**: Built into a single, static distroless Docker image. The frontend is embedded directly into the Go binary.
- **Secure by Default**: Integrates natively with Authelia headers (`Remote-User` / `Remote-Groups`) or falls back to Basic Auth. The Docker socket is mounted strictly read-only, and the Go backend only calls read-oriented Docker Engine API endpoints.

---

## Architecture

The backend utilizes the **Socket & Mount approach** for high performance:

```text
[ Host System ] <--- (/proc, /sys mounts) <---------+
                                                    |
[ Docker Daemon ] <-- (/var/run/docker.sock) <--- [ Go Backend Container ]
                                                    |
[ Frontend (OLED) ] <--- (WebSockets / SSE) <-------+
```

## Getting Started

### Prerequisites

- Docker and Docker Compose
- A Traefik reverse proxy network (optional but recommended)

### Deployment

1. Generate a bcrypt hash for your fallback basic auth password:
   ```bash
   # You can use an online tool or a local utility like htpasswd
   # Example hash for password 'admin': $2y$05$5D4wZk...
   ```
2. Create a `docker-compose.yml` on your VPS:
   ```yaml
   version: '3.8'

   services:
     oled-dashboard-backend:
       image: ghcr.io/daveblx/vps_dashboard:main
       container_name: oled_dashboard_backend
       restart: unless-stopped
       security_opt:
         - no-new-privileges:true
       read_only: true
       tmpfs:
         - /tmp
       volumes:
         - /var/run/docker.sock:/var/run/docker.sock:ro
         - /proc:/host/proc:ro
         - /sys:/host/sys:ro
       environment:
         - HOST_PROC=/host/proc
         - HOST_SYS=/host/sys
         - APP_ENV=production
         - LISTEN_ADDR=:8080
         - METRICS_INTERVAL_SECS=2
         - DASHBOARD_USERNAME=admin
         - DASHBOARD_PASSWORD_HASH=$$2a$$12$$YOUR_BCRYPT_HASH_HERE
       healthcheck:
         test: ["CMD", "/server", "-health"]
         interval: 30s
         timeout: 5s
         retries: 3
         start_period: 10s
       networks:
         - traefik_public
       labels:
         # Uncomment and configure with your domain:
         # - "traefik.enable=true"
         # - "traefik.http.routers.oled-dashboard.rule=Host(`dashboard.yourdomain.com`)"
         # - "traefik.http.routers.oled-dashboard.entrypoints=websecure"
         # - "traefik.http.routers.oled-dashboard.tls.certresolver=letsencrypt"
         # - "traefik.http.services.oled-dashboard.loadbalancer.server.port=8080"
         # Authelia middleware (uncomment if using Authelia):
         # - "traefik.http.routers.oled-dashboard.middlewares=authelia@docker"
         - "traefik.enable=false"

   networks:
     traefik_public:
       external: true
   ```
3. Edit the compose file:
   - Paste your generated bcrypt hash in `DASHBOARD_PASSWORD_HASH` (escape `$` with `$$` in YAML).
   - Uncomment and customize the Traefik labels under the `oled-dashboard-backend` service.
   - Adjust the `traefik_public` network name to match your setup.
4. Pull the published image and start the stack:
   ```bash
   docker compose pull
   docker compose up -d
   ```

### Local Development

If you want to run the stack locally for development:

**Terminal 1 (Backend):**
```bash
go run ./cmd/server
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm install
npm run dev
```
*The Vite development server runs on `http://localhost:5173` and automatically proxies API/WebSocket requests to the Go backend on port 8080.*

---

## Security Posture

- **No Root Privileges**: The container runs with `security_opt: [no-new-privileges:true]` and drops to a `nonroot` user.
- **Immutable Filesystem**: The container is deployed with `read_only: true` to prevent any writes to the container filesystem.
- **Read-Only Sockets**: The Docker socket (`/var/run/docker.sock`) is mounted as `:ro`.
- **API Constraints**: The Go application does not compile in methods to stop, delete, or mutate containers.

## Tech Stack

- **Backend**: Go 1.25, Chi Router, Gorilla WebSockets, gopsutil, Docker Engine API.
- **Frontend**: React 19, TypeScript, Vite, Vanilla CSS.
- **Packaging**: Multi-stage Docker build utilizing Alpine and Google Distroless.
