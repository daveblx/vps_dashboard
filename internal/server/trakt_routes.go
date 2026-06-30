package server

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/davidblachnitzky/oled-dashboard/internal/trakt"
)

const traktStateCookie = "trakt_oauth_state"

// effectiveRedirect returns the configured redirect URI, or derives one from
// the incoming request (honouring reverse-proxy forwarded headers).
func (s *Server) effectiveRedirect(r *http.Request) string {
	if c := s.traktCreds.Get(); c.RedirectURI != "" {
		return c.RedirectURI
	}
	scheme := "http"
	if r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https") {
		scheme = "https"
	}
	host := r.Host
	if fwd := r.Header.Get("X-Forwarded-Host"); fwd != "" {
		host = fwd
	}
	return scheme + "://" + host + "/api/auth/trakt/callback"
}

func (s *Server) handleTraktLogin(w http.ResponseWriter, r *http.Request) {
	if s.traktOAuth == nil || !s.traktOAuth.IsConfigured() {
		http.Error(w, "Trakt not configured", http.StatusServiceUnavailable)
		return
	}

	state, err := trakt.GenerateState()
	if err != nil {
		slog.Error("generate trakt state", "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     traktStateCookie,
		Value:    state,
		Path:     "/",
		HttpOnly: true,
		Secure:   r.TLS != nil,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   600,
	})

	http.Redirect(w, r, s.traktOAuth.BuildAuthURL(state, s.effectiveRedirect(r)), http.StatusFound)
}

func (s *Server) handleTraktCallback(w http.ResponseWriter, r *http.Request) {
	if s.traktOAuth == nil {
		http.Error(w, "Trakt not configured", http.StatusServiceUnavailable)
		return
	}

	code := r.URL.Query().Get("code")
	gotState := r.URL.Query().Get("state")

	cookie, err := r.Cookie(traktStateCookie)
	if err != nil || cookie.Value == "" || cookie.Value != gotState {
		slog.Warn("trakt oauth state mismatch", "got", gotState)
		http.Error(w, "invalid state", http.StatusBadRequest)
		return
	}

	if err := s.traktOAuth.ExchangeCode(code, s.effectiveRedirect(r)); err != nil {
		slog.Error("trakt code exchange failed", "error", err)
		http.Redirect(w, r, "/?trakt_error=1", http.StatusFound)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     traktStateCookie,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
	})

	http.Redirect(w, r, "/?trakt_success=1", http.StatusFound)
}

func (s *Server) handleTraktMe(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if s.traktOAuth == nil || s.traktStore == nil {
		_ = json.NewEncoder(w).Encode(map[string]any{"connected": false})
		return
	}

	t := s.traktStore.Get()
	if t == nil {
		_ = json.NewEncoder(w).Encode(map[string]any{"connected": false})
		return
	}

	if time.Now().After(t.ExpiresAt) {
		if err := s.traktOAuth.RefreshTokens(); err != nil {
			_ = json.NewEncoder(w).Encode(map[string]any{"connected": false})
			return
		}
		t = s.traktStore.Get()
	}

	_ = json.NewEncoder(w).Encode(map[string]any{
		"connected": true,
		"username":  t.Username,
	})
}

func (s *Server) handleTraktLogout(w http.ResponseWriter, r *http.Request) {
	if s.traktOAuth != nil {
		s.traktOAuth.Logout()
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// handleTraktConfigGet returns the current (non-secret) Trakt app config plus
// the redirect URI the backend will use, so the UI can show what to register.
func (s *Server) handleTraktConfigGet(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if s.traktCreds == nil {
		_ = json.NewEncoder(w).Encode(map[string]any{"configured": false})
		return
	}
	c := s.traktCreds.Get()
	_ = json.NewEncoder(w).Encode(map[string]any{
		"clientId":    c.ClientID,
		"hasSecret":   c.ClientSecret != "",
		"redirectUri": s.effectiveRedirect(r),
		"configured":  c.Configured(),
	})
}

// handleTraktConfigSave persists Trakt credentials supplied from the UI.
func (s *Server) handleTraktConfigSave(w http.ResponseWriter, r *http.Request) {
	if s.traktCreds == nil {
		http.Error(w, "unavailable", http.StatusServiceUnavailable)
		return
	}

	var body struct {
		ClientID     string `json:"clientId"`
		ClientSecret string `json:"clientSecret"`
		RedirectURI  string `json:"redirectUri"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}

	s.traktCreds.Update(trakt.Credentials{
		ClientID:     body.ClientID,
		ClientSecret: body.ClientSecret,
		RedirectURI:  body.RedirectURI,
	})

	c := s.traktCreds.Get()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"clientId":    c.ClientID,
		"hasSecret":   c.ClientSecret != "",
		"redirectUri": s.effectiveRedirect(r),
		"configured":  c.Configured(),
	})
}

func (s *Server) handleTraktWatchlist(w http.ResponseWriter, r *http.Request) {
	if s.traktClient == nil || s.traktStore == nil || !s.traktStore.IsAuthenticated() {
		http.Error(w, "not authenticated", http.StatusUnauthorized)
		return
	}

	t := s.traktStore.Get()
	if t == nil || t.Username == "" {
		http.Error(w, "no username", http.StatusInternalServerError)
		return
	}

	list, err := s.traktClient.GetWatchlist(t.Username)
	if err != nil {
		slog.Error("trakt watchlist", "error", err)
		http.Error(w, "failed to fetch watchlist", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(list)
}

func (s *Server) handleTraktWatched(w http.ResponseWriter, r *http.Request) {
	if s.traktClient == nil || s.traktStore == nil || !s.traktStore.IsAuthenticated() {
		http.Error(w, "not authenticated", http.StatusUnauthorized)
		return
	}

	t := s.traktStore.Get()
	if t == nil || t.Username == "" {
		http.Error(w, "no username", http.StatusInternalServerError)
		return
	}

	list, err := s.traktClient.GetWatched(t.Username)
	if err != nil {
		slog.Error("trakt watched", "error", err)
		http.Error(w, "failed to fetch watched", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(list)
}