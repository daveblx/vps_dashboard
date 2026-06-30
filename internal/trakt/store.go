package trakt

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"time"
)

type Tokens struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresAt    time.Time `json:"expires_at"`
	Scope        string    `json:"scope"`
	Username     string    `json:"username"`
}

type Store struct {
	mu       sync.RWMutex
	tokens   *Tokens
	filePath string
}

func NewStore(filePath string) *Store {
	s := &Store{filePath: filePath}
	s.load()
	return s
}

func (s *Store) load() {
	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return
	}
	var t Tokens
	if err := json.Unmarshal(data, &t); err != nil {
		return
	}
	s.tokens = &t
}

func (s *Store) save() {
	if s.tokens == nil {
		_ = os.Remove(s.filePath)
		return
	}
	data, err := json.Marshal(s.tokens)
	if err != nil {
		return
	}
	_ = os.WriteFile(s.filePath, data, 0600)
}

func (s *Store) Get() *Tokens {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.tokens == nil {
		return nil
	}
	cpy := *s.tokens
	return &cpy
}

func (s *Store) Set(t *Tokens) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.tokens = t
	s.save()
}

func (s *Store) Clear() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.tokens = nil
	s.save()
}

func (s *Store) IsAuthenticated() bool {
	t := s.Get()
	if t == nil {
		return false
	}
	if time.Now().After(t.ExpiresAt) {
		return false
	}
	return true
}

func (s *Store) NeedsRefresh() bool {
	t := s.Get()
	if t == nil {
		return false
	}
	return time.Now().Add(5 * time.Minute).After(t.ExpiresAt)
}

func (s *Store) GetAccessToken() (string, error) {
	t := s.Get()
	if t == nil {
		return "", fmt.Errorf("not authenticated")
	}
	if time.Now().After(t.ExpiresAt) {
		return "", fmt.Errorf("token expired, re-authentication required")
	}
	return t.AccessToken, nil
}
