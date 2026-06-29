package server

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestStaticHandlerRootDoesNotRedirect(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()

	staticHandler().ServeHTTP(rec, req)

	if rec.Code >= 300 && rec.Code < 400 {
		t.Fatalf("expected root path not to redirect, got status %d with Location %q", rec.Code, rec.Header().Get("Location"))
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}
}

func TestStaticHandlerIndexDoesNotRedirect(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/index.html", nil)
	rec := httptest.NewRecorder()

	staticHandler().ServeHTTP(rec, req)

	if rec.Code >= 300 && rec.Code < 400 {
		t.Fatalf("expected index path not to redirect, got status %d with Location %q", rec.Code, rec.Header().Get("Location"))
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}
}
