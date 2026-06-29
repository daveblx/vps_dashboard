package server

import (
	"io/fs"
	"net/http"
	"strings"

	"github.com/davidblachnitzky/oled-dashboard/internal/web"
)

func staticHandler() http.Handler {
	dist, err := fs.Sub(web.Dist, "dist")
	if err != nil {
		return http.NotFoundHandler()
	}
	fileServer := http.FileServer(http.FS(dist))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}

		if _, err := dist.Open(path); err != nil {
			r.URL.Path = "/"
			fileServer.ServeHTTP(w, r)
			return
		}

		r.URL.Path = "/" + path
		fileServer.ServeHTTP(w, r)
	})
}
