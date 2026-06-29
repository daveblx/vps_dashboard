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
- **Secure by Default**: Integrates natively with Authelia headers (`Remote-User` / `Remote-Groups`) or falls back to Basic Auth. The Docker socket is mounted strictly read-only, and the Go backend complies by only importing the Read/List capabilities of the Docker SDK.

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

1. Clone the repository.
2. Generate a bcrypt hash for your fallback basic auth password:
   ```bash
   # You can use an online tool or a local utility like htpasswd
   # Example hash for password 'admin': $2y$05$5D4wZk...
   ```
3. Open `docker-compose.yml` and:
   - Paste your generated bcrypt hash in `DASHBOARD_PASSWORD_HASH` (escape `$` with `$$` in YAML).
   - Uncomment and customize the Traefik labels under the `oled-dashboard-backend` service.
   - Adjust the `traefik_public` network name to match your setup.
4. Spin up the stack:
   ```bash
   docker-compose up -d --build
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

- **Backend**: Go 1.22, Chi Router, Gorilla WebSockets, gopsutil, Docker SDK.
- **Frontend**: React 19, TypeScript, Vite, Vanilla CSS.
- **Packaging**: Multi-stage Docker build utilizing Alpine and Google Distroless.
