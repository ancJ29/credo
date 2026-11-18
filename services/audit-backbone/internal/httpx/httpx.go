// Package httpx holds the JSON write helpers and the error → status mapping.
// One rule runs through it: an error the caller can act on gets a message,
// everything else gets a generic one — a SQLite error text names files on disk.
package httpx

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
)

// maxBody caps the request body. Memos are small, but "small" is the caller's
// word, not ours.
const maxBody = 8 << 20 // 8 MiB

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

// Decode reads the body as one JSON value of at most maxBody into v, and
// answers the refusal itself: false means the response is written. A decoder
// stops after one value, so anything after it but whitespace is refused here:
// `{…} junk` is a malformed body, not a request. shape names what the route
// takes, in the 400's details.
func Decode(w http.ResponseWriter, r *http.Request, v any, shape string) bool {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBody))
	err := dec.Decode(v)
	if err == nil {
		if rest := dec.Decode(&struct{}{}); rest != io.EOF {
			err = errors.Join(errors.New("bytes after the body"), rest)
		}
	}
	var tooLarge *http.MaxBytesError
	switch {
	case errors.As(err, &tooLarge):
		// c-storage's answer to a body over its cap, so a caller reads one
		// refusal from both.
		JSON(w, http.StatusRequestEntityTooLarge, ErrorBody{Error: "Request body too large"})
	case err != nil:
		BadRequest(w, "body must be JSON: "+shape)
	}
	return err == nil
}

// Internal logs the real error and returns a generic one.
func Internal(w http.ResponseWriter, err error) {
	slog.Error("request failed", "error", err)
	JSON(w, http.StatusInternalServerError, ErrorBody{Error: "Internal server error"})
}
