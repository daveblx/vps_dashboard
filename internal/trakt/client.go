package trakt

import (
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"
)

type Client struct {
	creds *CredentialStore
	store *Store
	oauth *OAuthHandler
	http  *http.Client
}

func NewClient(creds *CredentialStore, store *Store, oauth *OAuthHandler) *Client {
	return &Client{
		creds: creds,
		store: store,
		oauth: oauth,
		http:  &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *Client) do(req *http.Request) (*http.Response, error) {
	if err := c.oauth.RefreshIfNeeded(); err != nil {
		return nil, err
	}
	
	token, err := c.store.GetAccessToken()
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("trakt-api-version", "2")
	req.Header.Set("trakt-api-key", c.creds.Get().ClientID)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("User-Agent", "YourAppName/1.0 (+https://yourdomain.com)")
	//slog.Info("trakt outgoing request", "method", req.Method, "url", req.URL.String())
	return c.http.Do(req)
}

func (c *Client) get(url string) ([]byte, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		slog.Warn("trakt api error", "url", url, "status", resp.StatusCode, "body", string(body))
		if resp.StatusCode == http.StatusUnauthorized {
			c.store.Clear()
			return nil, fmt.Errorf("re-authentication required")
		}
		return nil, fmt.Errorf("trakt API returned status %d", resp.StatusCode)
	}

	return io.ReadAll(resp.Body)
}

type WatchlistMovie struct {
	ListedAt string      `json:"listed_at"`
	Movie    TraktMovie  `json:"movie"`
}

type WatchedMovie struct {
	Plays        int        `json:"plays"`
	LastWatchedAt string    `json:"last_watched_at"`
	Movie        TraktMovie `json:"movie"`
}

type TraktMovie struct {
	Title string   `json:"title"`
	Year  int      `json:"year"`
	IDs   TraktIDs `json:"ids"`
}

type TraktIDs struct {
	Trakt int    `json:"trakt"`
	Slug  string `json:"slug"`
	TMDB  int    `json:"tmdb"`
	IMDB  string `json:"imdb"`
}

func (c *Client) GetWatchlist(username string) ([]WatchlistMovie, error) {
	data, err := c.get(fmt.Sprintf("%s/users/%s/watchlist/movies", traktAPI, username))
	if err != nil {
		return nil, err
	}
	var list []WatchlistMovie
	if err := json.Unmarshal(data, &list); err != nil {
		return nil, err
	}
	return list, nil
}

func (c *Client) GetWatched(username string) ([]WatchedMovie, error) {
	data, err := c.get(fmt.Sprintf("%s/users/%s/watched/movies", traktAPI, username))
	if err != nil {
		return nil, err
	}
	var list []WatchedMovie
	if err := json.Unmarshal(data, &list); err != nil {
		return nil, err
	}
	return list, nil
}

func (c *Client) GetUsername() (string, error) {
	data, err := c.get(traktAPI + "/users/settings")
	if err != nil {
		return "", err
	}
	var us userSettingsResp
	if err := json.Unmarshal(data, &us); err != nil {
		return "", err
	}
	return us.User.Username, nil
}
