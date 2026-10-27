// Package server is the mux and its gates: every route the process serves,
// the internal key in front of all of them, and /health before that key.
package server

import (
	"net"
	"net/http"

	"credo/c-storage/internal/auth"
	"credo/c-storage/internal/httpx"
	"credo/c-storage/internal/store"
)

// AccessKeyHeader carries a service's own key, which every record route needs.
const AccessKeyHeader = "x-access-key"

type Server struct {
	mux *http.ServeMux
	// patterns is every pattern registered. TestEveryRegisteredRouteIsListed
	// reads it, so a route added without an entry in the test's list fails the
	// gate instead of escaping it.
	patterns []string
	internal *auth.Verifier
	store    *store.Store
}

// Build wires every route in the process. Tests exercise this function rather
// than assembling their own mux, so what answers is asserted against the real
// wiring. auth.New panics on an empty key: a missing key is a dead process at
// boot, never an open route.
func Build(internalKey, superAdminKey string, st *store.Store) *Server {
	s := &Server{
		mux:      http.NewServeMux(),
		internal: auth.New(auth.InternalHeader, internalKey),
		store:    st,
	}
	// Everything not registered is 404, and the
	// catch-all suppresses net/http's own 405: TestThisServiceNeverAnswers405.
	s.mux.HandleFunc("/", func(w http.ResponseWriter, _ *http.Request) { httpx.NotFound(w) })

	s.handle("GET /api/records/{serviceCode}/{key}", s.withAccessKey(s.getRecord))
	s.handle("POST /api/records/{serviceCode}", s.withAccessKey(s.pushRecord))
	s.handle("DELETE /api/records/{serviceCode}/{key}", s.withAccessKey(s.removeRecord))

	admin := auth.New(auth.SuperAdminHeader, superAdminKey)
	s.handle("POST /api/services/register", admin.Require(unconditional(s.registerService)))
	return s
}

func (s *Server) handle(pattern string, h http.Handler) {
	s.mux.Handle(pattern, h)
	s.patterns = append(s.patterns, pattern)
}

// Handler gates the whole mux, fallback included, so an unknown path without
// the internal key answers 401 like a real one: a 404 beside a 401 would let a
// caller map the surface. TestUnknownPathsRevealNothingWithoutTheInternalKey.
func (s *Server) Handler() http.Handler {
	return s.health(s.internal.Require(s.mux))
}

// withAccessKey admits a record route's request only with its service's own
// key. A missing key, a wrong one and an unknown service are one answer, 403,
// so the gate does not say which services exist.
func (s *Server) withAccessKey(h http.HandlerFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ok, err := s.store.Admits(r.Context(), r.PathValue("serviceCode"), r.Header.Get(AccessKeyHeader))
		switch {
		case err != nil:
			httpx.Internal(w, err)
		case !ok:
			httpx.Forbidden(w)
		default:
			h(w, r)
		}
	})
}

type healthBody struct {
	Status string `json:"status"`
}

// health answers GET /health before the key gate, with one field and no more:
// an unauthenticated body is where an environment leaks.
func (s *Server) health(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet && r.URL.Path == "/health" {
			httpx.JSON(w, http.StatusOK, healthBody{Status: "OK"})
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Listen binds the loopback interface only, so no host but this one reaches the
// port, whatever a firewall says. TestListenBindsLoopbackOnly.
func Listen(port string) (net.Listener, error) {
	return net.Listen("tcp", net.JoinHostPort("127.0.0.1", port))
}
