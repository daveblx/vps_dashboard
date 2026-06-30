package server

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/davidblachnitzky/oled-dashboard/internal/trakt"
)

const traktStateCookie = "trakt_oauth_state"

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

	http.Redirect(w, r, s.traktOAuth.BuildAuthURL(state), http.StatusFound)
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

	if err := s.traktOAuth.ExchangeCode(code); err != nil {
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