package server

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/davidblachnitzky/oled-dashboard/internal/auth"
	"github.com/davidblachnitzky/oled-dashboard/internal/config"
	"github.com/davidblachnitzky/oled-dashboard/internal/docker"
	"github.com/davidblachnitzky/oled-dashboard/internal/host"
	"github.com/davidblachnitzky/oled-dashboard/internal/trakt"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

type Server struct {
	cfg           *config.Config
	hub           *Hub
	hostCollector *host.Collector
	dockerMonitor *docker.Monitor
	traktOAuth    *trakt.OAuthHandler
	traktStore    *trakt.Store
	traktClient   *trakt.Client
	traktCreds    *trakt.CredentialStore
}

func New(cfg *config.Config, hub *Hub, hostCollector *host.Collector, dockerMonitor *docker.Monitor, traktStore *trakt.Store, traktOAuth *trakt.OAuthHandler, traktClient *trakt.Client, traktCreds *trakt.CredentialStore) *Server {
	return &Server{
		cfg:           cfg,
		hub:           hub,
		hostCollector: hostCollector,
		dockerMonitor: dockerMonitor,
		traktStore:    traktStore,
		traktOAuth:    traktOAuth,
		traktClient:   traktClient,
		traktCreds:    traktCreds,
	}
}

func (s *Server) Router(authMW *auth.Middleware) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"https://*", "http://*"},
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", s.cfg.AutheliaUserHeader, s.cfg.AutheliaGroupsHeader},
		ExposedHeaders:   []string{s.cfg.AutheliaUserHeader, s.cfg.AutheliaGroupsHeader},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Get("/health", s.handleHealth)

	r.Get("/api/auth/trakt/login", s.handleTraktLogin)
	r.Get("/api/auth/trakt/callback", s.handleTraktCallback)
	r.Get("/api/auth/trakt/me", s.handleTraktMe)
	r.Post("/api/auth/trakt/logout", s.handleTraktLogout)

	r.Group(func(r chi.Router) {
		r.Use(authMW.Handler)

		r.Get("/api/containers", s.handleListContainers)
		r.Get("/api/containers/{id}/logs", s.handleContainerLogs)
		r.Get("/api/metrics", s.handleMetricsSnapshot)
		r.Get("/api/metrics/history", s.handleMetricsHistory)
		r.Get("/ws", s.hub.ServeWS)
		r.Get("/api/trakt/config", s.handleTraktConfigGet)
		r.Post("/api/trakt/config", s.handleTraktConfigSave)
		r.Get("/api/trakt/watchlist", s.handleTraktWatchlist)
		r.Get("/api/trakt/watched", s.handleTraktWatched)
	})

	r.Handle("/*", staticHandler())

	return r
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (s *Server) handleListContainers(w http.ResponseWriter, r *http.Request) {
	containers, err := s.dockerMonitor.ListContainers(r.Context())
	if err != nil {
		slog.Error("list containers", "error", err)
		http.Error(w, "failed to list containers", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(containers)
}

func (s *Server) handleMetricsSnapshot(w http.ResponseWriter, r *http.Request) {
	hostMetrics, err := s.hostCollector.Collect(r.Context())
	if err != nil {
		slog.Error("collect host metrics", "error", err)
		http.Error(w, "failed to collect metrics", http.StatusInternalServerError)
		return
	}

	containerStats, err := s.dockerMonitor.CollectStats(r.Context())
	if err != nil {
		slog.Error("collect container stats", "error", err)
		containerStats = []docker.ContainerStats{}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(MetricsFrame{
		Type:       "metrics",
		Timestamp:  time.Now().UnixMilli(),
		Host:       hostMetrics,
		Containers: containerStats,
	})
}

func (s *Server) handleMetricsHistory(w http.ResponseWriter, r *http.Request) {
	rangeDur, maxPoints := parseHistoryRange(r.URL.Query().Get("range"))

	points := s.hostCollector.History().Range(rangeDur, maxPoints)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"range":  r.URL.Query().Get("range"),
		"points": points,
	})
}

// parseHistoryRange maps a range label to a duration and a target point count.
func parseHistoryRange(label string) (time.Duration, int) {
	switch label {
	case "1m":
		return time.Minute, 60
	case "12h":
		return 12 * time.Hour, 180
	case "24h":
		return 24 * time.Hour, 240
	case "1h":
		fallthrough
	default:
		return time.Hour, 120
	}
}

func (s *Server) handleContainerLogs(w http.ResponseWriter, r *http.Request) {
	containerID := chi.URLParam(r, "id")
	stream := r.URL.Query().Get("stream") == "true"
	tail := r.URL.Query().Get("tail")
	if tail == "" {
		tail = "100"
	}

	if !stream {
		s.handleContainerLogsBatch(w, r, containerID, tail)
		return
	}

	reader, err := s.dockerMonitor.StreamLogs(r.Context(), containerID, tail, true)
	if err != nil {
		slog.Error("stream container logs", "error", err, "container", containerID)
		http.Error(w, "failed to stream logs", http.StatusInternalServerError)
		return
	}
	defer reader.Close()

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	buf := make([]byte, 4096)
	for {
		select {
		case <-r.Context().Done():
			return
		default:
		}

		n, err := reader.Read(buf)
		if n > 0 {
			lines := strings.Split(string(buf[:n]), "\n")
			for _, line := range lines {
				if line == "" {
					continue
				}
				clean := stripDockerLogHeader(line)
				if clean == "" {
					continue
				}
				_, _ = w.Write([]byte("data: " + jsonEscapeSSE(clean) + "\n\n"))
				flusher.Flush()
			}
		}
		if err != nil {
			if err != io.EOF {
				slog.Debug("log stream ended", "error", err, "container", containerID)
			}
			return
		}
	}
}

func (s *Server) handleContainerLogsBatch(w http.ResponseWriter, r *http.Request, containerID, tail string) {
	reader, err := s.dockerMonitor.StreamLogs(r.Context(), containerID, tail, false)
	if err != nil {
		slog.Error("fetch container logs", "error", err, "container", containerID)
		http.Error(w, "failed to fetch logs", http.StatusInternalServerError)
		return
	}
	defer reader.Close()

	data, err := io.ReadAll(reader)
	if err != nil {
		http.Error(w, "failed to read logs", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write(stripDockerLogHeaders(data))
}

func stripDockerLogHeader(line string) string {
	if len(line) > 8 && line[0] <= 2 {
		return line[8:]
	}
	return line
}

func stripDockerLogHeaders(data []byte) []byte {
	lines := strings.Split(string(data), "\n")
	out := make([]string, 0, len(lines))
	for _, line := range lines {
		if line == "" {
			continue
		}
		out = append(out, stripDockerLogHeader(line))
	}
	return []byte(strings.Join(out, "\n"))
}

func jsonEscapeSSE(s string) string {
	b, err := json.Marshal(s)
	if err != nil {
		return strconv.Quote(s)
	}
	return string(b)
}
