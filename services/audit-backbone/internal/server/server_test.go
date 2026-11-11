package server

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
	"time"

	"credo/audit-backbone/internal/activity"
	"credo/audit-backbone/internal/auth"
)

const (
	writeKey = "activity-write-key"
	wrongKey = "not-the-key"
	version  = "0123456789abcdef0123456789abcdef01234567"
)

// testNow is the server's clock, so no test reads the wall clock.
var testNow = time.Date(2026, 10, 4, 12, 30, 0, 0, time.UTC)

func clock() time.Time { return testNow }

// stubActivity answers every capability successfully, so a test that reaches a
// handler gets a 2xx — the failure these tests hunt is a route being reachable
// at all, not what it returns.
type stubActivity struct{}

func (stubActivity) ByActor(context.Context, string, string, string, int) (activity.Page, error) {
	return activity.Page{Activities: []activity.Activity{}}, nil
}
func (stubActivity) ByTarget(context.Context, string, string, string, int) (activity.Page, error) {
	return activity.Page{Activities: []activity.Activity{}}, nil
}
func (stubActivity) Append(context.Context, []activity.Input, time.Time) ([]string, error) {
	return []string{"01STUB"}, nil
}

func build(t *testing.T) *Server {
	t.Helper()
	return Build(writeKey, Domains{Reader: stubActivity{}, Writer: stubActivity{}}, version, clock)
}

// tokenAt is a read token for acme, minted under key at the given time.
func tokenAt(key string, at time.Time) string {
	token, _ := auth.New(key, func() time.Time { return at }).Mint("acme")
	return token
}

// readToken is what the client's system hands its browser now.
func readToken() string { return tokenAt(writeKey, testNow) }

// route is one request a caller sends. The two lists below are every route the
// process serves: TestEveryRegisteredRouteIsListed fails when Build registers a
// pattern neither names, so the boundary tests cannot silently stop covering one.
type route struct {
	name string
	req  func(t *testing.T) *http.Request
}

func plain(method, path, body string) func(*testing.T) *http.Request {
	return func(*testing.T) *http.Request {
		if body == "" {
			return httptest.NewRequest(method, path, nil)
		}
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		return r
	}
}

// The keyed listener's routes. Each takes the write key.
var everyRoute = []route{
	{"POST " + activity.Prefix, plain(http.MethodPost, activity.Prefix,
		`{"activities":[{"clientId":"acme","actorId":"emp-1","action":"x"}]}`)},
	{"POST " + activity.TokensPath, plain(http.MethodPost, activity.TokensPath, `{"clientId":"acme"}`)},
}

// The open listener's routes. Each takes a read token.
var everyOpenRoute = []route{
	{"GET by-actor", plain(http.MethodGet, activity.Prefix+"/by-actor/emp-1", "")},
	{"GET by-target", plain(http.MethodGet, activity.Prefix+"/by-target/so-1", "")},
}

func serve(h http.Handler, r *http.Request) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func withKey(r *http.Request, key string) *http.Request {
	if key != "" {
		r.Header.Set(auth.KeyHeader, key)
	}
	return r
}

func withToken(r *http.Request, token string) *http.Request {
	if token != "" {
		r.Header.Set("Authorization", "Bearer "+token)
	}
	return r
}

// The gate for "only the consumed surface crosses": a pattern Build registers
// that no route above reaches is a route no boundary test covers.
func TestEveryRegisteredRouteIsListed(t *testing.T) {
	s := build(t)
	for _, side := range []struct {
		name   string
		l      *listener
		routes []route
	}{
		{Keyed, s.keyed, everyRoute},
		{Open, s.open, everyOpenRoute},
	} {
		var reached []string
		for _, rt := range side.routes {
			_, pattern := side.l.mux.Handler(rt.req(t))
			reached = append(reached, pattern)
		}
		for _, p := range side.l.patterns {
			if !slices.Contains(reached, p) {
				t.Errorf("%s registers %q, which no route in its list reaches — list it, or it is unconsumed", side.name, p)
			}
		}
	}
}

// The structural half of the boundary: a keyed route is unreachable on the open
// listener because it is not registered there. Sent with the real key and a
// real token, so a 404 cannot be a gate passing the test by accident.
func TestNoKeyedRouteIsReachableOnTheOpenListener(t *testing.T) {
	open := build(t).OpenHandler()
	for _, rt := range everyRoute {
		if got := serve(open, withToken(withKey(rt.req(t), writeKey), readToken())).Code; got != http.StatusNotFound {
			t.Errorf("%s on the open listener = %d, want 404 — a keyed route is registered on the open mux", rt.name, got)
		}
	}
}

// A read token is no key: what a browser holds neither writes nor mints.
func TestEveryKeyedRouteRefusesAMissingOrWrongKey(t *testing.T) {
	keyed := build(t).KeyedHandler()
	for _, rt := range everyRoute {
		for name, key := range map[string]string{"missing": "", "wrong": wrongKey, "read token's": readToken()} {
			if got := serve(keyed, withToken(withKey(rt.req(t), key), readToken())).Code; got != http.StatusUnauthorized {
				t.Errorf("%s with a %s key = %d, want 401", rt.name, name, got)
			}
		}
	}
}

func TestEveryKeyedRouteAnswersWithItsKey(t *testing.T) {
	keyed := build(t).KeyedHandler()
	for _, rt := range everyRoute {
		if got := serve(keyed, withKey(rt.req(t), writeKey)).Code; got < 200 || got > 299 {
			t.Errorf("%s with its key = %d, want 2xx — the route is not wired", rt.name, got)
		}
	}
}

// A decoder stops after one value, so a route that does not read its body to
// the end stores `{…} junk` as good. The keyed routes are every route that
// reads a body.
func TestEveryKeyedRouteRefusesBytesAfterItsBody(t *testing.T) {
	keyed := build(t).KeyedHandler()
	for _, rt := range everyRoute {
		r := rt.req(t)
		if r.Body == http.NoBody {
			continue
		}
		body, _ := io.ReadAll(r.Body)
		r.Body = io.NopCloser(bytes.NewReader(append(body, " junk"...)))
		if got := serve(keyed, withKey(r, writeKey)).Code; got != http.StatusBadRequest {
			t.Errorf("%s with bytes after its body = %d, want 400", rt.name, got)
		}
	}
}

// The reader reads only with a token this key minted and still running
// (docs/memo/the-reader-takes-a-token.md); the write key is no token either.
func TestEveryOpenRouteRefusesAMissingForgedOrExpiredToken(t *testing.T) {
	open := build(t).OpenHandler()
	for _, rt := range everyOpenRoute {
		for name, r := range map[string]*http.Request{
			"no token":            rt.req(t),
			"the key, as the key": withKey(rt.req(t), writeKey),
			"the key, as a token": withToken(rt.req(t), writeKey),
			"another key's token": withToken(rt.req(t), tokenAt(wrongKey, testNow)),
			"an hour-old token":   withToken(rt.req(t), tokenAt(writeKey, testNow.Add(-auth.TokenLifetime))),
		} {
			if got := serve(open, r).Code; got != http.StatusUnauthorized {
				t.Errorf("%s with %s = %d, want 401", rt.name, name, got)
			}
		}
	}
}

func TestEveryOpenRouteAnswersWithItsToken(t *testing.T) {
	open := build(t).OpenHandler()
	for _, rt := range everyOpenRoute {
		if got := serve(open, withToken(rt.req(t), readToken())).Code; got != http.StatusOK {
			t.Errorf("%s with its token = %d, want 200 — the route is not wired", rt.name, got)
		}
	}
}

// tenantReader records the tenant a feed was asked for.
type tenantReader struct {
	stubActivity
	asked *string
}

func (r tenantReader) ByActor(_ context.Context, clientID, _, _ string, _ int) (activity.Page, error) {
	*r.asked = clientID
	return activity.Page{Activities: []activity.Activity{}}, nil
}

// One key mints on the keyed listener and checks on the open one: the token a
// client's system is handed reads its tenant there, for an hour.
func TestATokenMintedOnTheKeyedListenerReadsOnTheOpen(t *testing.T) {
	var asked string
	now := testNow
	s := Build(writeKey, Domains{Reader: tenantReader{asked: &asked}, Writer: stubActivity{}}, version,
		func() time.Time { return now })

	mint := withKey(httptest.NewRequest(http.MethodPost, activity.TokensPath, strings.NewReader(`{"clientId":"other"}`)), writeKey)
	var minted struct{ Token string }
	if res := serve(s.KeyedHandler(), mint); res.Code != http.StatusOK || json.Unmarshal(res.Body.Bytes(), &minted) != nil {
		t.Fatalf("mint = %d %s, want 200 and a token", res.Code, res.Body)
	}
	read := func() int {
		r := withToken(httptest.NewRequest(http.MethodGet, activity.Prefix+"/by-actor/emp-1?clientId=acme", nil), minted.Token)
		return serve(s.OpenHandler(), r).Code
	}
	if got := read(); got != http.StatusOK || asked != "other" {
		t.Fatalf("read = %d for %q, want 200 for the token's tenant", got, asked)
	}
	now = testNow.Add(auth.TokenLifetime)
	if got := read(); got != http.StatusUnauthorized {
		t.Fatalf("read an hour on = %d, want 401", got)
	}
}

// Not a security property — it is the same data — but a route answering on
// both ports is a second surface nobody asked for.
func TestOpenRoutesLiveOnlyOnTheOpenListener(t *testing.T) {
	keyed := build(t).KeyedHandler()
	for _, rt := range everyOpenRoute {
		if got := serve(keyed, withKey(rt.req(t), writeKey)).Code; got != http.StatusNotFound {
			t.Errorf("%s answered on the keyed listener with %d", rt.name, got)
		}
	}
}

// Without a key, every path on the keyed listener answers the same way. A 404
// for an unregistered path next to a 401 for a registered one lets an
// unauthenticated caller map the keyed surface by diffing status codes.
func TestUnknownKeyedPathsRevealNothingWithoutAKey(t *testing.T) {
	keyed := build(t).KeyedHandler()

	registered := serve(keyed, everyRoute[0].req(t)).Code
	unknown := serve(keyed, httptest.NewRequest(http.MethodGet, "/api/nothing-here", nil)).Code
	if registered != http.StatusUnauthorized || unknown != http.StatusUnauthorized {
		t.Fatalf("registered = %d, unknown = %d — both must be 401 or the pair is a route oracle", registered, unknown)
	}

	// With the key the distinction returns: a trusted caller gets an honest 404.
	r := withKey(httptest.NewRequest(http.MethodGet, "/api/nothing-here", nil), writeKey)
	if got := serve(keyed, r).Code; got != http.StatusNotFound {
		t.Fatalf("an authenticated caller got %d for an unknown path, want 404", got)
	}
}

// The open listener's gate covers its fallback too, for the same reason.
func TestUnknownOpenPathsRevealNothingWithoutAToken(t *testing.T) {
	open := build(t).OpenHandler()

	registered := serve(open, everyOpenRoute[0].req(t)).Code
	unknown := serve(open, httptest.NewRequest(http.MethodGet, "/api/nothing-here", nil)).Code
	if registered != http.StatusUnauthorized || unknown != http.StatusUnauthorized {
		t.Fatalf("registered = %d, unknown = %d — both must be 401 or the pair is a route oracle", registered, unknown)
	}

	r := withToken(httptest.NewRequest(http.MethodGet, "/api/nothing-here", nil), readToken())
	if got := serve(open, r).Code; got != http.StatusNotFound {
		t.Fatalf("a caller with a token got %d for an unknown path, want 404", got)
	}
}

// /health is the one unauthenticated answer on each listener, and it carries
// two fields: an unauthenticated body is where an environment leaks.
func TestHealthAnswersOnlyStatusAndBuildVersion(t *testing.T) {
	s := build(t)
	for name, h := range map[string]http.Handler{Keyed: s.KeyedHandler(), Open: s.OpenHandler()} {
		res := serve(h, httptest.NewRequest(http.MethodGet, "/health", nil))
		if res.Code != http.StatusOK {
			t.Fatalf("GET /health on the %s listener = %d, want 200", name, res.Code)
		}
		var body map[string]any
		if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
			t.Fatalf("%s /health body: %v", name, err)
		}
		want := map[string]any{"status": "OK", "buildVersion": version}
		if len(body) != len(want) || body["status"] != want["status"] || body["buildVersion"] != want["buildVersion"] {
			t.Errorf("%s /health = %v, want exactly %v", name, body, want)
		}
	}
}

// Only GET /health answers, and on the open listener a preflight; every other
// probe without a credential meets the gate.
func TestNoOtherUnauthenticatedSurface(t *testing.T) {
	s := build(t)
	for name, h := range map[string]http.Handler{Keyed: s.KeyedHandler(), Open: s.OpenHandler()} {
		for _, path := range []string{"/healthz", "/version", "/api/health", "/status", "/health/"} {
			if got := serve(h, httptest.NewRequest(http.MethodGet, path, nil)).Code; got != http.StatusUnauthorized {
				t.Errorf("GET %s on the %s listener without a credential = %d, want 401", path, name, got)
			}
		}
		if got := serve(h, httptest.NewRequest(http.MethodPost, "/health", nil)).Code; got != http.StatusUnauthorized {
			t.Errorf("POST /health on the %s listener without a credential = %d, want 401", name, got)
		}
	}
}

// This service answers no 405, anywhere: it would confirm that a route exists
// to whoever holds a credential for the other one. The cost, priced and
// accepted: a wrong verb on a real route reads as 404.
func TestThisServiceNeverAnswers405(t *testing.T) {
	s := build(t)
	probes := []struct {
		name    string
		handler http.Handler
		path    string
		key     string
		token   string
	}{
		{"a real POST route on the keyed listener", s.KeyedHandler(), activity.Prefix, writeKey, ""},
		{"a real GET route on the open listener", s.OpenHandler(), activity.Prefix + "/by-actor/emp-1", "", readToken()},
		{"a keyed path probed with a token", s.OpenHandler(), activity.Prefix, "", readToken()},
	}
	for _, p := range probes {
		for _, method := range []string{http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodHead} {
			got := serve(p.handler, withToken(withKey(httptest.NewRequest(method, p.path, nil), p.key), p.token)).Code
			if got == http.StatusMethodNotAllowed {
				t.Errorf("%s: %s returned 405 — it tells a caller the route exists", p.name, method)
			}
		}
	}
}

// A browser is the open reader's one caller, and every call it makes carries
// its token, so every call is preflighted, and the preflight carries none.
func TestTheOpenListenerAnswersEveryPreflight(t *testing.T) {
	open := build(t).OpenHandler()
	for _, path := range []string{activity.Prefix + "/by-actor/emp-1", "/no-such-path"} {
		r := httptest.NewRequest(http.MethodOptions, path, nil)
		r.Header.Set("Origin", "https://acme.internal.example")
		r.Header.Set("Access-Control-Request-Method", http.MethodGet)
		res := serve(open, r)
		if res.Code != http.StatusNoContent {
			t.Fatalf("preflight to %s = %d, want 204 for every path alike", path, res.Code)
		}
		h := res.Header()
		if h.Get("Access-Control-Allow-Origin") != "*" {
			t.Errorf("allow-origin = %q, want *", h.Get("Access-Control-Allow-Origin"))
		}
		if h.Get("Access-Control-Allow-Methods") != "GET" {
			t.Errorf("allow-methods = %q", h.Get("Access-Control-Allow-Methods"))
		}
		if h.Get("Access-Control-Allow-Headers") != "authorization" {
			t.Errorf("allow-headers = %q, want authorization", h.Get("Access-Control-Allow-Headers"))
		}
	}
}

// A refusal is readable cross-origin, so a browser holding a spent token sees
// its 401 and asks for another, not an error that names nothing.
func TestARefusedReadCarriesCORS(t *testing.T) {
	res := serve(build(t).OpenHandler(), everyOpenRoute[0].req(t))
	if res.Code != http.StatusUnauthorized || res.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Fatalf("a read without a token = %d with allow-origin %q, want 401 and *",
			res.Code, res.Header().Get("Access-Control-Allow-Origin"))
	}
}

// The keyed listener's callers are servers; it has no CORS, so no browser page
// can be made to send the write key cross-origin and read the answer.
func TestTheKeyedListenerHasNoCORS(t *testing.T) {
	keyed := build(t).KeyedHandler()
	r := httptest.NewRequest(http.MethodOptions, activity.Prefix, nil)
	r.Header.Set("Origin", "https://acme.internal.example")
	res := serve(keyed, r)
	if res.Code != http.StatusUnauthorized || res.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatalf("keyed preflight = %d with allow-origin %q, want 401 and none",
			res.Code, res.Header().Get("Access-Control-Allow-Origin"))
	}
}

func TestBuildPanicsRatherThanRunningWithoutAKey(t *testing.T) {
	defer func() {
		if recover() == nil {
			t.Fatal("Build accepted an empty key — every keyed route would have been open")
		}
	}()
	Build("", Domains{Reader: stubActivity{}, Writer: stubActivity{}}, version, clock)
}

// Caddy on the same box is the one public door; a listener on every interface
// would make the firewall the only thing between the internet and the keyed port.
func TestListenersBindLoopbackOnly(t *testing.T) {
	ln, err := Listen("0")
	if err != nil {
		t.Fatalf("Listen: %v", err)
	}
	defer ln.Close()
	if ip := ln.Addr().(*net.TCPAddr).IP; !ip.IsLoopback() {
		t.Fatalf("bound %s, want a loopback address", ip)
	}
}
