package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/davidblachnitzky/oled-dashboard/internal/auth"
	"github.com/davidblachnitzky/oled-dashboard/internal/config"
	"github.com/davidblachnitzky/oled-dashboard/internal/docker"
	"github.com/davidblachnitzky/oled-dashboard/internal/host"
	"github.com/davidblachnitzky/oled-dashboard/internal/server"
	"github.com/davidblachnitzky/oled-dashboard/internal/trakt"
)

func main() {
	// Health check mode for Docker healthcheck in distroless containers.
	if len(os.Args) > 1 && os.Args[1] == "-health" {
		addr := os.Getenv("LISTEN_ADDR")
		if addr == "" {
			addr = ":8080"
		}
		resp, err := http.Get("http://localhost" + addr + "/health")
		if err != nil || resp.StatusCode != http.StatusOK {
			os.Exit(1)
		}
		os.Exit(0)
	}

	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})))

	cfg, err := config.Load()
	if err != nil {
		slog.Error("load config", "error", err)
		os.Exit(1)
	}
	cfg.ApplyHostPaths()

	dockerClient, err := docker.NewClient()
	if err != nil {
		slog.Warn("docker unavailable, container features disabled", "error", err)
	}

	var dockerMonitor *docker.Monitor
	if dockerClient != nil {
		dockerMonitor = docker.NewMonitor(dockerClient)
	} else {
		dockerMonitor = docker.NewMonitor(nil)
	}

	hostCollector := host.NewCollector()
	hub := server.NewHub()

	traktStore := trakt.NewStore(getEnv("TRAKT_TOKEN_PATH", "/tmp/trakt_tokens.json"))
	traktCreds := trakt.NewCredentialStore(
		getEnv("TRAKT_CREDENTIALS_PATH", "/tmp/trakt_credentials.json"),
		trakt.Credentials{
			ClientID:     cfg.TraktClientID,
			ClientSecret: cfg.TraktClientSecret,
			RedirectURI:  cfg.TraktRedirectURI,
		},
	)
	traktOAuth := trakt.NewOAuthHandler(traktCreds, traktStore)
	traktClient := trakt.NewClient(traktCreds, traktStore, traktOAuth)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	interval := time.Duration(cfg.MetricsIntervalSecs) * time.Second
	go hostCollector.Run(ctx, interval)
	go hub.Run()

	broadcaster := server.NewMetricsBroadcaster(hub, hostCollector, dockerMonitor, interval)
	go broadcaster.Run(ctx)

	authMW := auth.New(cfg)
	srv := server.New(cfg, hub, hostCollector, dockerMonitor, traktStore, traktOAuth, traktClient, traktCreds)
	handler := srv.Router(authMW)

	httpServer := &http.Server{
		Addr:         cfg.ListenAddr,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 0,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		slog.Info("server starting", "addr", cfg.ListenAddr, "env", cfg.AppEnv)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("shutting down")
	cancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if dockerClient != nil {
		_ = dockerClient.Close()
	}

	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		slog.Error("shutdown error", "error", err)
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
