package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	AppEnv                string
	ListenAddr            string
	HostProc              string
	HostSys               string
	MetricsIntervalSecs   int
	DashboardUsername     string
	DashboardPasswordHash string
	AutheliaUserHeader    string
	AutheliaGroupsHeader  string
	TraktClientID         string
	TraktClientSecret     string
	TraktRedirectURI      string
	TMDBAPIKey            string
}

func Load() (*Config, error) {
	cfg := &Config{
		AppEnv:                getEnv("APP_ENV", "development"),
		ListenAddr:            getEnv("LISTEN_ADDR", ":8080"),
		HostProc:              getEnv("HOST_PROC", "/proc"),
		HostSys:               getEnv("HOST_SYS", "/sys"),
		MetricsIntervalSecs:   getEnvInt("METRICS_INTERVAL_SECS", 2),
		DashboardUsername:     getEnv("DASHBOARD_USERNAME", "admin"),
		DashboardPasswordHash: os.Getenv("DASHBOARD_PASSWORD_HASH"),
		AutheliaUserHeader:    getEnv("AUTHELIA_USER_HEADER", "Remote-User"),
		AutheliaGroupsHeader:  getEnv("AUTHELIA_GROUPS_HEADER", "Remote-Groups"),
		TraktClientID:         os.Getenv("TRAKT_CLIENT_ID"),
		TraktClientSecret:     os.Getenv("TRAKT_CLIENT_SECRET"),
		TraktRedirectURI:      os.Getenv("TRAKT_REDIRECT_URI"),
		TMDBAPIKey:            os.Getenv("TMDB_API_KEY"),
	}

	if cfg.MetricsIntervalSecs < 1 {
		return nil, fmt.Errorf("METRICS_INTERVAL_SECS must be >= 1")
	}

	return cfg, nil
}

func (c *Config) ApplyHostPaths() {
	if c.HostProc != "" {
		os.Setenv("HOST_PROC", c.HostProc)
	}
	if c.HostSys != "" {
		os.Setenv("HOST_SYS", c.HostSys)
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}
