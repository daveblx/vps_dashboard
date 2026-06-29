package docker

import (
	"testing"
)

func TestParseTraefikURL(t *testing.T) {
	tests := []struct {
		name   string
		labels map[string]string
		want   string
	}{
		{
			name:   "empty labels",
			labels: nil,
			want:   "",
		},
		{
			name: "standard host rule",
			labels: map[string]string{
				"traefik.http.routers.myapp.rule": "Host(`sub.domain.com`)",
			},
			want: "https://sub.domain.com",
		},
		{
			name: "host rule with spaces",
			labels: map[string]string{
				"traefik.http.routers.web.rule": "Host( `app.example.org` )",
			},
			want: "https://app.example.org",
		},
		{
			name: "case insensitive Host",
			labels: map[string]string{
				"traefik.http.routers.api.rule": "host(`api.local.dev`)",
			},
			want: "https://api.local.dev",
		},
		{
			name: "compound rule picks host",
			labels: map[string]string{
				"traefik.http.routers.svc.rule": "Host(`dashboard.home.lan`) && PathPrefix(`/`)",
			},
			want: "https://dashboard.home.lan",
		},
		{
			name: "non traefik label ignored",
			labels: map[string]string{
				"com.docker.compose.service": "web",
			},
			want: "",
		},
		{
			name: "traefik enable without rule",
			labels: map[string]string{
				"traefik.enable": "true",
			},
			want: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ParseTraefikURL(tt.labels)
			if got != tt.want {
				t.Errorf("ParseTraefikURL() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestParseAllTraefikURLs(t *testing.T) {
	labels := map[string]string{
		"traefik.http.routers.a.rule": "Host(`one.example.com`)",
		"traefik.http.routers.b.rule": "Host(`two.example.com`)",
		"traefik.http.routers.c.rule": "Host(`one.example.com`)",
	}

	urls := ParseAllTraefikURLs(labels)
	if len(urls) != 2 {
		t.Fatalf("expected 2 unique URLs, got %d: %v", len(urls), urls)
	}
}
