// Package server is the listener split, and the split is the security design.
//
// Two muxes, two ports, one gate in front of each: a read token reaches a keyed
// handler only if someone registers it on the wrong mux — one visible line, not
// a condition that can evaluate the wrong way at runtime
// (docs/memo/the-listener-is-the-boundary.md).
package server

import (
	"net"
	"net/http"
	"time"

	"credo/audit-backbone/internal/activity"
	"credo/audit-backbone/internal/auth"
	"credo/audit-backbone/internal/httpx"
	"credo/audit-backbone/internal/reqlog"
)

// Listener names, used in every request log line.
const (
	Keyed = "keyed"
	Open  = "open"
)

// Domains carries the two capabilities as their narrow interfaces, so a wiring
// mistake cannot hand the open reader something that writes.
type Domains struct {
	Reader activity.Reader
	Writer activity.Writer
}

// listener is one port's mux plus every pattern registered on it.
// TestEveryRegisteredRouteIsListed reads the patterns, so a route added without
// an entry in the test's route lists fails the gate instead of escaping it.
type listener struct {
	mux      *http.ServeMux
	patterns []string
}

func newListener() *listener {
	l := &listener{mux: http.NewServeMux()}
	// Everything a listener does not serve is 404, including the other
	// listener's paths, and the catch-all suppresses net/http's own 405:
	// TestThisServiceNeverAnswers405.
	l.mux.HandleFunc("/", func(w http.ResponseWriter, _ *http.Request) { httpx.NotFound(w) })
	return l
}

func (l *listener) HandleFunc(pattern string, h func(http.ResponseWriter, *http.Request)) {
	l.mux.HandleFunc(pattern, h)
	l.patterns = append(l.patterns, pattern)
}

type Server struct {
	keyed        *listener
	open         *listener
	key          *auth.Verifier
	buildVersion string
}

// Build wires every route in the process. Tests exercise this function rather
// than assembling their own mux, so "which listener serves this route" is
// asserted against the real wiring.
func Build(writeKey string, d Domains, buildVersion string, now func() time.Time) *Server {
	s := &Server{
		keyed: newListener(),
		open:  newListener(),
		// auth.New panics on an empty key: a missing key is a dead process at
		// boot, never a door without a credential.
		key:          auth.New(writeKey, now),
		buildVersion: buildVersion,
	}
	activity.RegisterWriter(s.keyed, d.Writer, now)
	activity.RegisterTokens(s.keyed, s.key.Mint)
	// The one registration that gets the open mux. Nothing that writes or mints
	// may ever be registered here.
	activity.RegisterReader(s.open, d.Reader)
	return s
}

// KeyedHandler gates the whole mux, fallback included, so an unknown path
// without a key answers 401 like a real one: a 404 beside a 401 would let a
// caller map the keyed surface. TestUnknownKeyedPathsRevealNothingWithoutAKey.
func (s *Server) KeyedHandler() http.Handler {
	return reqlog.Middleware(Keyed, s.health(s.key.Require(s.keyed.mux)))
}

// OpenHandler gates the whole mux on a read token, as KeyedHandler does on the
// key, so an unknown path without one answers 401 too. It is the only listener
// with CORS, since a browser is its one caller, and a preflight answers before
// the gate: a browser sends none with a credential.
func (s *Server) OpenHandler() http.Handler {
	return reqlog.Middleware(Open, cors(s.health(s.key.RequireToken(s.open.mux))))
}

type healthBody struct {
	Status       string `json:"status"`
	BuildVersion string `json:"buildVersion"`
}

// health answers GET /health on both listeners, before either gate, with two
// fields and no more: an unauthenticated body is where an environment leaks.
// opus/ops/verify reads buildVersion on each hostname after a ship.
func (s *Server) health(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet && r.URL.Path == "/health" {
			httpx.JSON(w, http.StatusOK, healthBody{Status: "OK", BuildVersion: s.buildVersion})
			return
		}
		next.ServeHTTP(w, r)
	})
}

// A feed read is a GET carrying its token: the one header a browser must be
// allowed to send.
const (
	corsMethods = "GET"
	corsHeaders = "authorization"
	corsMaxAge  = "86400"
)

// cors allows every origin: a browser never sends a bearer token by itself, so
// a named origin guards nothing the token does not
// (docs/memo/the-reader-takes-a-token.md). Every OPTIONS answers 204 alike, so
// a preflight says nothing about which paths exist.
func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("Access-Control-Allow-Origin", "*")
		if r.Method == http.MethodOptions {
			h.Set("Access-Control-Allow-Methods", corsMethods)
			h.Set("Access-Control-Allow-Headers", corsHeaders)
			h.Set("Access-Control-Max-Age", corsMaxAge)
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Listen binds the loopback interface only: Caddy on the same box is the one
// public door, and a firewall rule is not something this binary can check.
// TestListenersBindLoopbackOnly.
func Listen(port string) (net.Listener, error) {
	return net.Listen("tcp", net.JoinHostPort("127.0.0.1", port))
}
