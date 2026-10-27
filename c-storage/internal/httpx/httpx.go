// Package httpx holds the JSON helpers and the error → status mapping. One
// rule runs through it: an error the caller can act on gets a message,
// everything else gets a generic one — a SQLite error text names files on disk.
package httpx

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
)

// MaxBody bounds every request body; nothing a caller stores comes near it.
const MaxBody = 10 << 20

// ErrorBody is `{error, details?}`, the one error shape.
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

// Decode reads a JSON body of at most MaxBody bytes into v, and answers the
// refusal itself when it cannot: false means the response is already written.
// A decoder stops after one value, so anything after it but whitespace is
// refused here: `{"key":"k"}}` is malformed, not a push.
func Decode(w http.ResponseWriter, r *http.Request, v any) bool {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, MaxBody))
	err := dec.Decode(v)
	if err == nil {
		if rest := dec.Decode(&struct{}{}); rest != io.EOF {
			err = errors.Join(errors.New("bytes after the body"), rest)
		}
	}
	var tooLarge *http.MaxBytesError
	switch {
	case errors.As(err, &tooLarge):
		JSON(w, http.StatusRequestEntityTooLarge, ErrorBody{Error: "Request body too large"})
		return false
	case err != nil:
		BadRequest(w, "the body is not the JSON this route takes")
		return false
	}
	return true
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

// Forbidden is a record route's refusal of the service's access key, whether
// the key is missing or wrong or the service unknown: the three read alike.
func Forbidden(w http.ResponseWriter) {
	JSON(w, http.StatusForbidden, ErrorBody{Error: "Invalid access key"})
}

func NotFound(w http.ResponseWriter) {
	JSON(w, http.StatusNotFound, ErrorBody{Error: "Not found"})
}

func Conflict(w http.ResponseWriter, details string) {
	JSON(w, http.StatusConflict, ErrorBody{Error: "Conflict", Details: details})
}

// PreconditionFailed answers a write whose record moved since it was read.
func PreconditionFailed(w http.ResponseWriter) {
	JSON(w, http.StatusPreconditionFailed, ErrorBody{Error: "Precondition failed", Details: "the record moved since it was read"})
}

// Internal logs the real error and returns a generic one.
func Internal(w http.ResponseWriter, err error) {
	slog.Error("request failed", "error", err)
	JSON(w, http.StatusInternalServerError, ErrorBody{Error: "Internal server error"})
}
