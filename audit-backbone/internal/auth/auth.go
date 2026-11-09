// Package auth holds the two credentials: the service key in front of the keyed
// listener, and the read token in front of the open one.
//
// Both derive from one key, so New refuses an empty key outright: a missing key
// is a dead process at boot, never a door without a credential.
package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/consocia/credo-audit-backbone/internal/httpx"
)

// KeyHeader is the name every caller of the activity writer already sends.
const KeyHeader = "x-internal-access-key"

// TokenLifetime is how long a read token reads: the client's system mints
// again within it, and a leaked token is good for no longer.
const TokenLifetime = time.Hour

type Verifier struct {
	key      string
	tokenKey []byte
	now      func() time.Time
}

// New panics on an empty key. A Verifier that accepts everything looks
// identical to a working one in every test that does not think to check.
func New(key string, now func() time.Time) *Verifier {
	if key == "" {
		panic("auth.New: empty key — a door is never opened by an empty key")
	}
	// Tokens are signed under a key derived from the service key, so the
	// service key itself signs nothing a browser holds, and a new service key
	// ends every token.
	derive := hmac.New(sha256.New, []byte(key))
	derive.Write([]byte("audit-backbone read token"))
	return &Verifier{key: key, tokenKey: derive.Sum(nil), now: now}
}

// Require gates a handler, comparing in constant time: a byte-by-byte early
// exit leaks the shared prefix length to anyone willing to measure it.
func (v *Verifier) Require(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got := r.Header.Get(KeyHeader)
		if got == "" || subtle.ConstantTimeCompare([]byte(got), []byte(v.key)) != 1 {
			httpx.Unauthorized(w)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// claims is a token's payload: the one tenant it reads, and when it stops.
type claims struct {
	Client string `json:"c"`
	Expiry int64  `json:"x"`
}

// Mint answers a token that reads clientID's log until the returned time.
func (v *Verifier) Mint(clientID string) (string, time.Time) {
	expires := time.Unix(v.now().Add(TokenLifetime).Unix(), 0).UTC()
	// A string and an integer always marshal.
	raw, _ := json.Marshal(claims{Client: clientID, Expiry: expires.Unix()})
	payload := base64.RawURLEncoding.EncodeToString(raw)
	return payload + "." + v.sign(payload), expires
}

func (v *Verifier) sign(payload string) string {
	mac := hmac.New(sha256.New, v.tokenKey)
	mac.Write([]byte(payload))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

type clientKey struct{}

// RequireToken gates a handler on `authorization: Bearer <token>` and hands it
// the token's tenant through ClientID. The signature is checked before the
// payload is read, so nothing a caller forged is ever parsed.
func (v *Verifier) RequireToken(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		client, ok := v.verify(r.Header.Get("Authorization"))
		if !ok {
			httpx.Unauthorized(w)
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), clientKey{}, client)))
	})
}

func (v *Verifier) verify(header string) (string, bool) {
	token, bearer := strings.CutPrefix(header, "Bearer ")
	payload, sig, _ := strings.Cut(token, ".")
	if !bearer || !hmac.Equal([]byte(sig), []byte(v.sign(payload))) {
		return "", false
	}
	var c claims
	raw, err := base64.RawURLEncoding.DecodeString(payload)
	if err != nil || json.Unmarshal(raw, &c) != nil || c.Client == "" || !v.now().Before(time.Unix(c.Expiry, 0)) {
		return "", false
	}
	return c.Client, true
}

// ClientID is the tenant RequireToken let through, and the only tenant a read
// may name.
func ClientID(r *http.Request) string {
	client, _ := r.Context().Value(clientKey{}).(string)
	return client
}
