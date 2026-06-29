package auth

import (
	"context"
	"crypto/subtle"
	"encoding/base64"
	"net/http"
	"strings"

	"github.com/davidblachnitzky/oled-dashboard/internal/config"
	"golang.org/x/crypto/bcrypt"
)

type contextKey string

const UserContextKey contextKey = "authUser"

type Middleware struct {
	cfg *config.Config
}

func New(cfg *config.Config) *Middleware {
	return &Middleware{cfg: cfg}
}

func (m *Middleware) Handler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if user := r.Header.Get(m.cfg.AutheliaUserHeader); user != "" {
			ctx := context.WithValue(r.Context(), UserContextKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		if m.cfg.DashboardPasswordHash != "" {
			if user, ok := m.validateBasicAuth(r); ok {
				ctx := context.WithValue(r.Context(), UserContextKey, user)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}
			w.Header().Set("WWW-Authenticate", `Basic realm="OLED Dashboard"`)
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		if m.cfg.AppEnv == "development" {
			next.ServeHTTP(w, r)
			return
		}

		http.Error(w, "unauthorized", http.StatusUnauthorized)
	})
}

func (m *Middleware) validateBasicAuth(r *http.Request) (string, bool) {
	auth := r.Header.Get("Authorization")
	if !strings.HasPrefix(auth, "Basic ") {
		return "", false
	}

	payload, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(auth, "Basic "))
	if err != nil {
		return "", false
	}

	parts := strings.SplitN(string(payload), ":", 2)
	if len(parts) != 2 {
		return "", false
	}

	username, password := parts[0], parts[1]
	if subtle.ConstantTimeCompare([]byte(username), []byte(m.cfg.DashboardUsername)) != 1 {
		return "", false
	}

	if err := bcrypt.CompareHashAndPassword([]byte(m.cfg.DashboardPasswordHash), []byte(password)); err != nil {
		return "", false
	}

	return username, true
}

func UserFromContext(ctx context.Context) string {
	user, _ := ctx.Value(UserContextKey).(string)
	return user
}
