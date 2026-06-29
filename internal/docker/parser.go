package docker

import (
	"regexp"
	"strings"
)

var hostRulePattern = regexp.MustCompile(`(?i)Host\s*\(\s*` + "`" + `([^` + "`" + `]+)` + "`" + `\s*\)`)

// ParseTraefikURL scans container labels for traefik.http.routers.*.rule keys
// and extracts the first Host(`domain`) match as a public URL.
func ParseTraefikURL(labels map[string]string) string {
	if len(labels) == 0 {
		return ""
	}

	for key, value := range labels {
		if !strings.Contains(key, "traefik.http.routers") || !strings.HasSuffix(key, ".rule") {
			continue
		}
		if host := extractHost(value); host != "" {
			return "https://" + host
		}
	}
	return ""
}

// ParseAllTraefikURLs returns every unique Host rule found across router labels.
func ParseAllTraefikURLs(labels map[string]string) []string {
	if len(labels) == 0 {
		return nil
	}

	seen := make(map[string]struct{})
	var urls []string

	for key, value := range labels {
		if !strings.Contains(key, "traefik.http.routers") || !strings.HasSuffix(key, ".rule") {
			continue
		}
		if host := extractHost(value); host != "" {
			url := "https://" + host
			if _, ok := seen[url]; !ok {
				seen[url] = struct{}{}
				urls = append(urls, url)
			}
		}
	}
	return urls
}

func extractHost(rule string) string {
	matches := hostRulePattern.FindStringSubmatch(rule)
	if len(matches) < 2 {
		return ""
	}
	return strings.TrimSpace(matches[1])
}
