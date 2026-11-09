package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

var minted = time.Date(2026, 10, 16, 9, 0, 0, 0, time.UTC)

// clockAt is a Verifier's clock, moved by the test.
func clockAt(at *time.Time) func() time.Time { return func() time.Time { return *at } }

// An empty key is a dead process, never a door without a credential.
func TestNewPanicsOnAnEmptyKey(t *testing.T) {
	defer func() {
		if recover() == nil {
			t.Fatal("auth.New accepted an empty key")
		}
	}()
	New("", time.Now)
}

func TestRequireAcceptsOnlyTheExactKey(t *testing.T) {
	v := New("right", time.Now)
	guarded := v.Require(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	cases := map[string]struct {
		key  string
		want int
	}{
		"exact":         {"right", http.StatusNoContent},
		"absent":        {"", http.StatusUnauthorized},
		"wrong":         {"wrong", http.StatusUnauthorized},
		"prefix":        {"righ", http.StatusUnauthorized},
		"with suffix":   {"rightish", http.StatusUnauthorized},
		"case-shifted":  {"RIGHT", http.StatusUnauthorized},
		"whitespace-ed": {" right", http.StatusUnauthorized},
	}
	for name, tc := range cases {
		r := httptest.NewRequest(http.MethodGet, "/", nil)
		if tc.key != "" {
			r.Header.Set(KeyHeader, tc.key)
		}
		w := httptest.NewRecorder()
		guarded.ServeHTTP(w, r)
		if w.Code != tc.want {
			t.Errorf("%s key = %d, want %d", name, w.Code, tc.want)
		}
	}
}

// read sends one request through RequireToken and answers the status and the
// tenant the handler behind it was handed.
func read(v *Verifier, authorization string) (int, string) {
	var client string
	guarded := v.RequireToken(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		client = ClientID(r)
		w.WriteHeader(http.StatusNoContent)
	}))
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	if authorization != "" {
		r.Header.Set("Authorization", authorization)
	}
	w := httptest.NewRecorder()
	guarded.ServeHTTP(w, r)
	return w.Code, client
}

// A token reads its one tenant for an hour from its minting, and not a second
// longer; Mint answers the instant it stops.
func TestATokenReadsItsTenantUntilItExpires(t *testing.T) {
	now := minted
	v := New("k", clockAt(&now))
	token, expires := v.Mint("acme")
	if !expires.Equal(minted.Add(TokenLifetime)) || expires.Location() != time.UTC {
		t.Fatalf("expires = %v, want %v in UTC", expires, minted.Add(TokenLifetime))
	}
	for at, want := range map[time.Duration]int{
		0:                           http.StatusNoContent,
		TokenLifetime - time.Second: http.StatusNoContent,
		TokenLifetime:               http.StatusUnauthorized,
		24 * time.Hour:              http.StatusUnauthorized,
	} {
		now = minted.Add(at)
		code, client := read(v, "Bearer "+token)
		if code != want || (want == http.StatusNoContent && client != "acme") {
			t.Errorf("at +%v: %d for %q, want %d", at, code, client, want)
		}
	}
}

// The service key itself signs nothing a browser holds: a token's signature is
// made under the key derived from it.
func TestTheServiceKeySignsNoToken(t *testing.T) {
	token, _ := New("k", time.Now).Mint("acme")
	payload, sig, _ := strings.Cut(token, ".")
	raw := hmac.New(sha256.New, []byte("k"))
	raw.Write([]byte(payload))
	if sig == base64.RawURLEncoding.EncodeToString(raw.Sum(nil)) {
		t.Fatal("the token is signed under the service key itself")
	}
}

// signed is a payload the verifier's own key signs: what only the key holder
// can make, so a refusal here is the payload's, not the signature's.
func signed(v *Verifier, payload string) string {
	return payload + "." + v.sign(payload)
}

func claimsOf(c claims) string {
	raw, _ := json.Marshal(c)
	return base64.RawURLEncoding.EncodeToString(raw)
}

// changed is s with its last character replaced by another.
func changed(s string) string {
	if strings.HasSuffix(s, "A") {
		return s[:len(s)-1] + "B"
	}
	return s[:len(s)-1] + "A"
}

// Every token not minted by this key, for a tenant, and still running, is a
// 401 that hands the handler nothing.
func TestEveryTokenNotMintedHereIsRefused(t *testing.T) {
	now := minted
	v := New("k", clockAt(&now))
	token, _ := v.Mint("acme")
	payload, sig, _ := strings.Cut(token, ".")
	other, _ := New("another-key", clockAt(&now)).Mint("acme")
	later := minted.Add(time.Hour).Unix()

	for name, authorization := range map[string]string{
		"no header":              "",
		"no scheme":              token,
		"another scheme":         "Basic " + token,
		"a lowercase scheme":     "bearer " + token,
		"no signature":           "Bearer " + payload,
		"an empty signature":     "Bearer " + payload + ".",
		"a changed signature":    "Bearer " + payload + "." + changed(sig),
		"another tenant claimed": "Bearer " + claimsOf(claims{Client: "other", Expiry: later}) + "." + sig,
		"another key's token":    "Bearer " + other,
		"the key itself":         "Bearer k",
		"signed, not base64":     "Bearer " + signed(v, "!!"),
		"signed, not claims":     "Bearer " + signed(v, base64.RawURLEncoding.EncodeToString([]byte("not json"))),
		"signed, for no tenant":  "Bearer " + signed(v, claimsOf(claims{Expiry: later})),
		"signed, with no expiry": "Bearer " + signed(v, claimsOf(claims{Client: "acme"})),
	} {
		if code, client := read(v, authorization); code != http.StatusUnauthorized || client != "" {
			t.Errorf("%s: %d for %q, want 401 and no tenant", name, code, client)
		}
	}
}
