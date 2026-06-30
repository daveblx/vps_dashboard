package trakt

import (
	"encoding/json"
	"os"
	"strings"
	"sync"
)

// Credentials holds the Trakt OAuth application credentials.
type Credentials struct {
	ClientID     string `json:"client_id"`
	ClientSecret string `json:"client_secret"`
	// RedirectURI is optional. When empty it is derived from the incoming
	// request. Once a login succeeds it is persisted so token refreshes use
	// the exact same value.
	RedirectURI string `json:"redirect_uri"`
}

func (c Credentials) Configured() bool {
	return c.ClientID != "" && c.ClientSecret != ""
}

// CredentialStore persists Trakt credentials to disk and allows runtime
// reconfiguration via the settings UI. Values from the environment are used
// as defaults until overridden.
type CredentialStore struct {
	mu       sync.RWMutex
	creds    Credentials
	filePath string
}

func NewCredentialStore(filePath string, env Credentials) *CredentialStore {
	cs := &CredentialStore{filePath: filePath, creds: env}
	cs.load()
	return cs
}

func (cs *CredentialStore) load() {
	data, err := os.ReadFile(cs.filePath)
	if err != nil {
		return
	}
	var c Credentials
	if err := json.Unmarshal(data, &c); err != nil {
		return
	}
	// Persisted file takes precedence over env defaults, but keep any env
	// value for fields the file leaves blank.
	if c.ClientID != "" {
		cs.creds.ClientID = c.ClientID
	}
	if c.ClientSecret != "" {
		cs.creds.ClientSecret = c.ClientSecret
	}
	if c.RedirectURI != "" {
		cs.creds.RedirectURI = c.RedirectURI
	}
}

func (cs *CredentialStore) save() {
	cs.mu.RLock()
	c := cs.creds
	path := cs.filePath
	cs.mu.RUnlock()

	if path == "" {
		return
	}
	data, err := json.Marshal(c)
	if err != nil {
		return
	}
	_ = os.WriteFile(path, data, 0600)
}

func (cs *CredentialStore) Get() Credentials {
	cs.mu.RLock()
	defer cs.mu.RUnlock()
	return cs.creds
}

// Update replaces the client id/secret/redirect. Empty client secret leaves
// the existing secret untouched so the UI can avoid re-sending it.
func (cs *CredentialStore) Update(c Credentials) {
	cs.mu.Lock()
	cs.creds.ClientID = strings.TrimSpace(c.ClientID)
	if strings.TrimSpace(c.ClientSecret) != "" {
		cs.creds.ClientSecret = strings.TrimSpace(c.ClientSecret)
	}
	cs.creds.RedirectURI = strings.TrimSpace(c.RedirectURI)
	cs.mu.Unlock()
	cs.save()
}

// SetRedirectURI records the redirect URI that was actually used for a
// successful authorization so future token refreshes match it.
func (cs *CredentialStore) SetRedirectURI(uri string) {
	if uri == "" {
		return
	}
	cs.mu.Lock()
	changed := cs.creds.RedirectURI != uri
	cs.creds.RedirectURI = uri
	cs.mu.Unlock()
	if changed {
		cs.save()
	}
}
