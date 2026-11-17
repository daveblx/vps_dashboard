# VPS Dashboard

A dashboard for monitoring your VPS and Docker containers.

## Features

- **Real-Time Host Metrics**: Live CPU, Memory, Disk, and Network bandwidth monitoring via WebSockets.
- **Docker Integration**: Automatically lists running containers, their resource usage (CPU/Mem), and uptimes.
- **Traefik Auto-Discovery**: Automatically parses your container labels (e.g., `traefik.http.routers...`) and provides clickable links to your public services right from the dashboard.
- **Live Log Streaming**: View streaming logs for any running container directly in the browser.
- **Ultra-Lean Deployment**: Built into a single, static distroless Docker image. The frontend is embedded directly into the Go binary.
- **Secure by Default**: Integrates natively with Authelia headers (`Remote-User` / `Remote-Groups`) or falls back to Basic Auth. The Docker socket is mounted strictly read-only, and the Go backend only calls read-oriented Docker Engine API endpoints.


### Prerequisites

- Docker and Docker Compose
- A Traefik reverse proxy network (optional but recommended)

## Development Note:

This project was developed using AI-assisted workflows.

