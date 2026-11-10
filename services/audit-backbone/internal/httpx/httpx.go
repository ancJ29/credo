// Package httpx holds the JSON write helpers and the error → status mapping.
// One rule runs through it: an error the caller can act on gets a message,
// everything else gets a generic one — a SQLite error text names files on disk.
package httpx

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

// ErrorBody is `{error, details?}`, the shape every caller already parses.
type ErrorBody struct {
	Error   string `json:"error"`
	Details string `json:"details,omitempty"`
}

// JSON writes body after the status line. Every body here marshals, so an
// error from Encode is a client that hung up, and there is no one to tell.
func JSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

// BadRequest echoes details because the caller can act on them.
func BadRequest(w http.ResponseWriter, details string) {
	JSON(w, http.StatusBadRequest, ErrorBody{Error: "Bad request", Details: details})
}

// Unauthorized carries no details: which of the key or the header name was
// wrong is what a prober wants to learn.
func Unauthorized(w http.ResponseWriter) {
	JSON(w, http.StatusUnauthorized, ErrorBody{Error: "Unauthorized"})
}

func NotFound(w http.ResponseWriter) {
	JSON(w, http.StatusNotFound, ErrorBody{Error: "Not found"})
}

// TooLarge is c-storage's answer to a body over its cap, so a caller reads one
// refusal from both.
func TooLarge(w http.ResponseWriter) {
	JSON(w, http.StatusRequestEntityTooLarge, ErrorBody{Error: "Request body too large"})
}

// Internal logs the real error and returns a generic one.
func Internal(w http.ResponseWriter, err error) {
	slog.Error("request failed", "error", err)
	JSON(w, http.StatusInternalServerError, ErrorBody{Error: "Internal server error"})
}
