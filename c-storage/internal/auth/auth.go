// Package auth is the key gate: one header, one key, compared exactly.
//
// The internal key gates the whole mux and the super-admin key each service
// route. A route is open only by being answered before the gate, never by a
// missing key, so New refuses an empty key outright.
package auth

import (
	"crypto/subtle"
	"net/http"

	"github.com/ancJ29/credo/c-storage/internal/httpx"
)

// The header names a caller sends.
const (
	InternalHeader   = "x-internal-access-key"
	SuperAdminHeader = "x-super-admin-key"
)

type Verifier struct {
	header string
	key    []byte
}

// New panics on an empty key. A Verifier that accepts everything looks
// identical to a working one in every test that does not think to check.
func New(header, key string) *Verifier {
	if key == "" {
		panic("auth.New: empty key for " + header + " — a route is open by being answered before the gate, never by an empty key")
	}
	return &Verifier{header: header, key: []byte(key)}
}

// Require gates a handler. The compare is constant-time: a byte-by-byte early
// exit leaks the shared prefix length to anyone willing to measure it.
func (v *Verifier) Require(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if subtle.ConstantTimeCompare([]byte(r.Header.Get(v.header)), v.key) != 1 {
			httpx.Unauthorized(w)
			return
		}
		next.ServeHTTP(w, r)
	})
}
