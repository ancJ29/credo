// Package reqlog writes one structured line per request.
//
// Request bodies are never logged: a memo carries business data, and a log file
// is a much wider audience than the activity panel.
package reqlog

import (
	"context"
	"log/slog"
	"net/http"
	"time"
)

type ctxKey int

const infoKey ctxKey = iota

type reqInfo struct {
	clientID string
	count    int
	counted  bool
}

// SetClient annotates the current request's log line.
func SetClient(r *http.Request, clientID string) {
	if info, ok := r.Context().Value(infoKey).(*reqInfo); ok {
		info.clientID = clientID
	}
}

// SetCount annotates the current request with how many rows it moved.
func SetCount(r *http.Request, n int) {
	if info, ok := r.Context().Value(infoKey).(*reqInfo); ok {
		info.count = n
		info.counted = true
	}
}

// statusWriter starts at 200, the status net/http sends for a handler that
// never calls WriteHeader.
type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

// Middleware wraps a listener's whole chain. listener names which of the two
// the request arrived on: which port served a request is the one fact the
// listener split exists to make checkable after the fact.
func Middleware(listener string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		info := &reqInfo{}
		sw := &statusWriter{ResponseWriter: w, status: http.StatusOK}

		next.ServeHTTP(sw, r.WithContext(context.WithValue(r.Context(), infoKey, info)))

		attrs := []any{
			"listener", listener,
			"method", r.Method,
			"path", r.URL.Path,
			"status", sw.status,
			"duration_ms", time.Since(start).Milliseconds(),
		}
		if info.clientID != "" {
			attrs = append(attrs, "clientId", info.clientID)
		}
		if info.counted {
			attrs = append(attrs, "count", info.count)
		}
		slog.Info("request", attrs...)
	})
}
