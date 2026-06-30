package trakt

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	traktAPI        = "https://api.trakt.tv"
	traktAuthURL    = "https://trakt.tv/oauth/authorize"
	traktTokenURL    = "https://api.trakt.tv/oauth/token"
)

type OAuthHandler struct {
	creds      *CredentialStore
	store      *Store
	httpClient *http.Client
}

func NewOAuthHandler(creds *CredentialStore, store *Store) *OAuthHandler {
	return &OAuthHandler{
		creds:      creds,
		store:      store,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

func (h *OAuthHandler) IsConfigured() bool {
	return h.creds.Get().Configured()
}

type tokenReq struct {
	Code         string `json:"code,omitempty"`
	ClientID     string `json:"client_id"`
	ClientSecret string `json:"client_secret"`
	RedirectURI  string `json:"redirect_uri,omitempty"`
	GrantType    string `json:"grant_type"`
	RefreshToken string `json:"refresh_token,omitempty"`
}

type tokenResp struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	CreatedAt    int64  `json:"created_at"`
	Scope        string `json:"scope"`
	TokenType    string `json:"token_type"`
}

type userSettingsResp struct {
	User struct {
		Username string `json:"username"`
	} `json:"user"`
}

func (h *OAuthHandler) BuildAuthURL(state, redirectURI string) string {
	return fmt.Sprintf("%s?response_type=code&client_id=%s&redirect_uri=%s&state=%s",
		traktAuthURL, url.QueryEscape(h.creds.Get().ClientID), url.QueryEscape(redirectURI), url.QueryEscape(state))
}

func GenerateState() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func (h *OAuthHandler) ExchangeCode(code, redirectURI string) error {
	creds := h.creds.Get()
	body := tokenReq{
		Code:         code,
		ClientID:     creds.ClientID,
		ClientSecret: creds.ClientSecret,
		RedirectURI:  redirectURI,
		GrantType:    "authorization_code",
	}

	tokens, err := h.doTokenRequest(body)
	if err != nil {
		return err
	}

	// Persist the redirect URI actually used so refreshes match it.
	h.creds.SetRedirectURI(redirectURI)

	username, _ := h.fetchUsername(tokens.AccessToken)

	h.store.Set(&Tokens{
		AccessToken:  tokens.AccessToken,
		RefreshToken: tokens.RefreshToken,
		ExpiresAt:    time.Unix(tokens.CreatedAt, 0).Add(time.Duration(tokens.ExpiresIn) * time.Second),
		Scope:        tokens.Scope,
		Username:     username,
	})

	return nil
}

func (h *OAuthHandler) RefreshTokens() error {
	t := h.store.Get()
	if t == nil || t.RefreshToken == "" {
		return fmt.Errorf("no refresh token available")
	}

	creds := h.creds.Get()
	body := tokenReq{
		ClientID:     creds.ClientID,
		ClientSecret: creds.ClientSecret,
		RedirectURI:  creds.RedirectURI,
		GrantType:    "refresh_token",
		RefreshToken: t.RefreshToken,
	}

	tokens, err := h.doTokenRequest(body)
	if err != nil {
		return err
	}

	h.store.Set(&Tokens{
		AccessToken:  tokens.AccessToken,
		RefreshToken: tokens.RefreshToken,
		ExpiresAt:    time.Unix(tokens.CreatedAt, 0).Add(time.Duration(tokens.ExpiresIn) * time.Second),
		Scope:        tokens.Scope,
		Username:     t.Username,
	})

	return nil
}

func (h *OAuthHandler) RefreshIfNeeded() error {
	if !h.store.NeedsRefresh() {
		return nil
	}
	if err := h.RefreshTokens(); err != nil {
		slog.Warn("trakt token refresh failed, clearing tokens", "error", err)
		h.store.Clear()
		return fmt.Errorf("re-authentication required")
	}
	return nil
}

func (h *OAuthHandler) Logout() {
	h.store.Clear()
}

func (h *OAuthHandler) doTokenRequest(body tokenReq) (*tokenResp, error) {
	b, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest(http.MethodPost, traktTokenURL, bytes.NewReader(b))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("token request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("token request returned status %d: %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}

	var tr tokenResp
	if err := json.Unmarshal(respBody, &tr); err != nil {
		return nil, fmt.Errorf("failed to parse token response: %w", err)
	}

	return &tr, nil
}

func (h *OAuthHandler) fetchUsername(accessToken string) (string, error) {
	req, _ := http.NewRequest(http.MethodGet, traktAPI+"/users/settings", nil)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("trakt-api-version", "2")
	req.Header.Set("trakt-api-key", h.creds.Get().ClientID)
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var us userSettingsResp
	if err := json.Unmarshal(body, &us); err != nil {
		return "", err
	}
	return us.User.Username, nil
}
