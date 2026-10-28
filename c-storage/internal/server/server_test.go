package server

import (
	"context"
	"database/sql"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"credo/c-storage/internal/auth"
	"credo/c-storage/internal/sqlitedb"
	"credo/c-storage/internal/store"
)

const (
	internalKey = "internal-key"
	adminKey    = "admin-key"
	accessKey   = "svc-access-key"
	wrongKey    = "not-the-key"
)

// keys is what a request carries: none in the zero value, every one valid in
// allKeys.
type keys struct{ internal, admin, access string }

var allKeys = keys{internalKey, adminKey, accessKey}

// build is the real wiring over a fresh file holding one service, "svc".
func build(t *testing.T) (*Server, *sql.DB) {
	t.Helper()
	db, err := sqlitedb.Open(filepath.Join(t.TempDir(), "c-storage.db"), store.Schema)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	st := store.New(db)
	if err := st.Register(context.Background(), "svc", accessKey); err != nil {
		t.Fatalf("register: %v", err)
	}
	return Build(internalKey, adminKey, st), db
}

func request(method, path, body string, k keys) *http.Request {
	var r *http.Request
	if body == "" {
		r = httptest.NewRequest(method, path, nil)
	} else {
		r = httptest.NewRequest(method, path, strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
	}
	for name, v := range map[string]string{auth.InternalHeader: k.internal, auth.SuperAdminHeader: k.admin, AccessKeyHeader: k.access} {
		if v != "" {
			r.Header.Set(name, v)
		}
	}
	return r
}

func serve(s *Server, r *http.Request) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	s.Handler().ServeHTTP(w, r)
	return w
}

// call sends one request with every key and fails unless it answers want.
func call(t *testing.T, s *Server, method, path, body string, want int) string {
	t.Helper()
	res := serve(s, request(method, path, body, allKeys))
	if res.Code != want {
		t.Fatalf("%s %s = %d %s, want %d", method, path, res.Code, res.Body, want)
	}
	return strings.TrimSpace(res.Body.String())
}

// route is one request a caller sends. everyRoute is every route the process
// serves: TestEveryRegisteredRouteIsListed fails when Build registers a
// pattern no entry reaches, so the gate tests cannot silently miss one.
type route struct {
	method, path, body string
	record             bool
}

var everyRoute = []route{
	{"GET", "/api/records/svc/k", "", true},
	{"POST", "/api/records/svc", `{"key":"k","data":{}}`, true},
	{"DELETE", "/api/records/svc/k", "", true},
	{"POST", "/api/services/register", `{"code":"new","accessKey":"k"}`, false},
}

func (rt route) String() string { return rt.method + " " + rt.path }

func (rt route) send(s *Server, k keys) int {
	return serve(s, request(rt.method, rt.path, rt.body, k)).Code
}

// The gate for "only the consumed crosses": a pattern Build registers that no
// route above reaches is a route no gate test covers.
func TestEveryRegisteredRouteIsListed(t *testing.T) {
	s, _ := build(t)
	var reached []string
	for _, rt := range everyRoute {
		_, pattern := s.mux.Handler(request(rt.method, rt.path, rt.body, allKeys))
		reached = append(reached, pattern)
	}
	for _, p := range s.patterns {
		if !slices.Contains(reached, p) {
			t.Errorf("Build registers %q, which no route in everyRoute reaches — list it, or it is unconsumed", p)
		}
	}
}

func TestEveryRouteAnswersWithItsKeys(t *testing.T) {
	s, _ := build(t)
	for _, rt := range everyRoute {
		// A read of a key nothing pushed yet answers 404 past every gate: the
		// handler's own answer.
		if got := rt.send(s, allKeys); got >= 300 && got != http.StatusNotFound {
			t.Errorf("%s with its keys = %d — the route is not wired", rt, got)
		}
	}
}

func TestEveryRouteRefusesAMissingOrWrongInternalKey(t *testing.T) {
	s, _ := build(t)
	for _, rt := range everyRoute {
		for name, key := range map[string]string{"missing": "", "wrong": wrongKey} {
			if got := rt.send(s, keys{key, adminKey, accessKey}); got != http.StatusUnauthorized {
				t.Errorf("%s with a %s internal key = %d, want 401", rt, name, got)
			}
		}
	}
}

// Every record route needs the service's key, and an unknown service is
// refused alike: no record is public, and an absent one is no 404 to a caller
// without the key.
func TestEveryRecordRouteRefusesAMissingOrWrongAccessKeyOrAnUnknownService(t *testing.T) {
	s, _ := build(t)
	for _, rt := range everyRoute {
		if !rt.record {
			continue
		}
		for name, k := range map[string]keys{
			"a missing access key": {internalKey, adminKey, ""},
			"a wrong access key":   {internalKey, adminKey, wrongKey},
		} {
			if got := rt.send(s, k); got != http.StatusForbidden {
				t.Errorf("%s with %s = %d, want 403", rt, name, got)
			}
		}
		unknown := route{rt.method, strings.Replace(rt.path, "/svc", "/nobody", 1), rt.body, true}
		if got := unknown.send(s, allKeys); got != http.StatusForbidden {
			t.Errorf("%s = %d, want 403", unknown, got)
		}
	}
}

func TestEveryServiceRouteRefusesAMissingOrWrongAdminKey(t *testing.T) {
	s, _ := build(t)
	for _, rt := range everyRoute {
		if rt.record {
			continue
		}
		for name, key := range map[string]string{"missing": "", "wrong": wrongKey} {
			if got := rt.send(s, keys{internalKey, key, accessKey}); got != http.StatusUnauthorized {
				t.Errorf("%s with a %s admin key = %d, want 401", rt, name, got)
			}
		}
	}
}

// Without the internal key, every path answers the same way: a 404 for an
// unknown path beside a 401 for a real one lets a caller map the surface.
func TestUnknownPathsRevealNothingWithoutTheInternalKey(t *testing.T) {
	s, _ := build(t)
	for _, path := range []string{"/api/nothing-here", "/", "/healthz", "/health/"} {
		if got := serve(s, request("GET", path, "", keys{})).Code; got != http.StatusUnauthorized {
			t.Errorf("GET %s without a key = %d, want 401", path, got)
		}
		if got := serve(s, request("GET", path, "", allKeys)).Code; got != http.StatusNotFound {
			t.Errorf("GET %s with every key = %d, want 404", path, got)
		}
	}
	if got := serve(s, request("POST", "/health", "", keys{})).Code; got != http.StatusUnauthorized {
		t.Errorf("POST /health without a key = %d, want 401", got)
	}
}

// /health is the one answer without a key, and it carries two fields: status
// and the build it runs, a commit's sha when `make box` stamped it, "dev" when
// not. An unauthenticated body is where an environment leaks, so no third.
func TestHealthNamesTheBuild(t *testing.T) {
	s, _ := build(t)
	get := func() string {
		res := serve(s, request("GET", "/health", "", keys{}))
		if res.Code != http.StatusOK {
			t.Fatalf("GET /health = %d %s", res.Code, res.Body)
		}
		return strings.TrimSpace(res.Body.String())
	}
	if got, want := get(), `{"status":"OK","buildVersion":"dev"}`; got != want {
		t.Errorf("unstamped: GET /health = %s, want %s", got, want)
	}
	stamped := BuildVersion
	t.Cleanup(func() { BuildVersion = stamped })
	BuildVersion = "0123456789abcdef0123456789abcdef01234567"
	if got, want := get(), `{"status":"OK","buildVersion":"0123456789abcdef0123456789abcdef01234567"}`; got != want {
		t.Errorf("stamped: GET /health = %s, want %s", got, want)
	}
}

// This service answers no 405: it would confirm that a route exists. The cost,
// priced and accepted: a wrong verb on a real route reads as 404.
func TestThisServiceNeverAnswers405(t *testing.T) {
	s, _ := build(t)
	for _, rt := range everyRoute {
		for _, method := range []string{"PUT", "PATCH", "HEAD", "OPTIONS"} {
			if got := serve(s, request(method, rt.path, "", allKeys)).Code; got == http.StatusMethodNotAllowed {
				t.Errorf("%s %s = 405 — it tells a caller the route exists", method, rt.path)
			}
		}
	}
}

// read is a record's answer: its data as stored, then the tag of that text.
func read(data string) string {
	return `{"record":{"data":` + data + `,"tag":"` + store.Tag([]byte(data)) + `"}}`
}

func TestARecordReadsBackAsPushed(t *testing.T) {
	s, _ := build(t)
	call(t, s, "GET", "/api/records/svc/k", "", http.StatusNotFound)
	// A field no rule reads decodes into nothing.
	if got := call(t, s, "POST", "/api/records/svc", `{"key":"k","data":{"a":[1,"x"]},"isPrivate":false,"description":"d"}`, http.StatusCreated); got != `{}` {
		t.Fatalf("push = %s, want {}", got)
	}
	if got := call(t, s, "GET", "/api/records/svc/k", "", http.StatusOK); got != read(`{"a":[1,"x"]}`) {
		t.Fatalf("read = %s", got)
	}
	call(t, s, "POST", "/api/records/svc", `{"key":"k"}`, http.StatusCreated)
	if got := call(t, s, "GET", "/api/records/svc/k", "", http.StatusOK); got != read(`{}`) {
		t.Fatalf("a push without data reads %s, want {} as its data", got)
	}
	call(t, s, "DELETE", "/api/records/svc/k", "", http.StatusNoContent)
	call(t, s, "DELETE", "/api/records/svc/k", "", http.StatusNoContent)
	call(t, s, "GET", "/api/records/svc/k", "", http.StatusNotFound)
}

// with sends a request that carries a precondition, and answers its status.
func with(s *Server, method, path, body string, headers ...[2]string) int {
	r := request(method, path, body, allKeys)
	for _, h := range headers {
		r.Header.Add(h[0], h[1])
	}
	return serve(s, r).Code
}

// A write honours its precondition or refuses it, on every write route: one
// ignored would run unconditional, the lost write the tag exists to stop.
func TestNoWriteIgnoresAPrecondition(t *testing.T) {
	stale := [2]string{"If-Match", strings.Repeat("0", 64)}
	unreadable := [][][2]string{
		{{"If-None-Match", "abc"}},
		{{"If-Match", "*"}},
		{{"If-Match", "abc"}},
		{stale, {"If-None-Match", "*"}},
		{{"If-Match", ""}},
		{{"If-None-Match", ""}},
		{stale, stale},
		{{"If-None-Match", "*"}, {"If-None-Match", "*"}},
	}
	readable := [][][2]string{{stale}, {{"If-None-Match", "*"}}}
	for _, rt := range everyRoute {
		if rt.method == "GET" {
			continue
		}
		honours := rt.method == "DELETE" || rt.path == "/api/records/svc"
		cases := unreadable
		if !honours {
			cases = append(slices.Clone(unreadable), readable...)
		}
		for _, headers := range cases {
			s, _ := build(t)
			call(t, s, "POST", "/api/records/svc", `{"key":"k","data":{"n":1}}`, http.StatusCreated)
			if got := with(s, rt.method, rt.path, rt.body, headers...); got != http.StatusBadRequest {
				t.Errorf("%s with %v = %d, want 400", rt, headers, got)
			}
			if got := call(t, s, "GET", "/api/records/svc/k", "", http.StatusOK); got != read(`{"n":1}`) {
				t.Errorf("%s with %v changed the record: %s", rt, headers, got)
			}
		}
	}
}

// Two callers who read the same record each write what they saw: the later
// write must be refused, or the earlier one is lost without a word.
func TestAWriteNamingAMovedRecordIsRefused(t *testing.T) {
	s, _ := build(t)
	call(t, s, "POST", "/api/records/svc", `{"key":"k","data":{"n":1}}`, http.StatusCreated)
	var read struct{ Record struct{ Tag string } }
	if err := json.Unmarshal([]byte(call(t, s, "GET", "/api/records/svc/k", "", http.StatusOK)), &read); err != nil || len(read.Record.Tag) != 64 {
		t.Fatalf("a read carries the record's tag, got %q (%v)", read.Record.Tag, err)
	}
	put := `{"key":"k","data":{"n":2}}`
	stale := [2]string{"If-Match", strings.Repeat("0", 64)}

	if got := with(s, "POST", "/api/records/svc", put, stale); got != http.StatusPreconditionFailed {
		t.Errorf("a push naming a stale tag = %d, want 412", got)
	}
	if got := with(s, "POST", "/api/records/svc", put, [2]string{"If-None-Match", "*"}); got != http.StatusPreconditionFailed {
		t.Errorf("a push naming no record, over one = %d, want 412", got)
	}
	if got := with(s, "DELETE", "/api/records/svc/k", "", stale); got != http.StatusPreconditionFailed {
		t.Errorf("a remove naming a stale tag = %d, want 412", got)
	}
	if got := call(t, s, "GET", "/api/records/svc/k", "", http.StatusOK); !strings.Contains(got, `"n":1`) {
		t.Errorf("a refused write changed the record: %s", got)
	}
	if got := with(s, "POST", "/api/records/svc", put, [2]string{"If-Match", read.Record.Tag}); got != http.StatusCreated {
		t.Errorf("a push naming the current tag = %d, want 201", got)
	}
	if got := with(s, "POST", "/api/records/svc", `{"key":"new","data":{}}`, [2]string{"If-None-Match", "*"}); got != http.StatusCreated {
		t.Errorf("a push naming no record, over none = %d, want 201", got)
	}

	// A tag never meets an absent record: the one a read returned, and the
	// record gone since.
	call(t, s, "DELETE", "/api/records/svc/k", "", http.StatusNoContent)
	earlier := [2]string{"If-Match", read.Record.Tag}
	if got := with(s, "POST", "/api/records/svc", put, earlier); got != http.StatusPreconditionFailed {
		t.Errorf("a push naming a tag, over no record = %d, want 412", got)
	}
	if got := with(s, "DELETE", "/api/records/svc/k", "", earlier); got != http.StatusPreconditionFailed {
		t.Errorf("a remove naming a tag, over no record = %d, want 412", got)
	}
	call(t, s, "GET", "/api/records/svc/k", "", http.StatusNotFound)
}

func TestAPushNeedsAKeyAndObjectData(t *testing.T) {
	s, _ := build(t)
	for _, body := range []string{`{}`, `{"key":""}`, `{"key":"k","data":null}`, `{"key":"k","data":[]}`, `{"key":"k","data":"x"}`, `null`} {
		call(t, s, "POST", "/api/records/svc", body, http.StatusBadRequest)
	}
}

// A malformed body is 400, and a body past 10 MiB is 413.
func TestAMalformedOrOversizedBodyIsRefused(t *testing.T) {
	s, _ := build(t)
	for _, body := range []string{`{"key":`, `[]`, `{"key":5}`, `{"key":"k"}}`, `{"key":"k"} {}`} {
		call(t, s, "POST", "/api/records/svc", body, http.StatusBadRequest)
	}
	big := `{"key":"k","data":{"pad":"` + strings.Repeat("x", 10<<20) + `"}}`
	call(t, s, "POST", "/api/records/svc", big, http.StatusRequestEntityTooLarge)
}

// A code already registered is a 409, which a caller that only needs the
// service to exist reads as registered.
func TestRegisteringACodeTwiceIsAConflict(t *testing.T) {
	s, _ := build(t)
	body := `{"name":"Acme","code":"acme","description":"","accessKey":"acme-key","memo":{}}`
	if got := call(t, s, "POST", "/api/services/register", body, http.StatusCreated); got != `{"code":"acme"}` {
		t.Fatalf("register = %s", got)
	}
	call(t, s, "POST", "/api/services/register", strings.Replace(body, "acme-key", "other-key", 1), http.StatusConflict)
	// The key the first registration set is the one that opens its records.
	for key, want := range map[string]int{"acme-key": http.StatusCreated, "other-key": http.StatusForbidden} {
		if res := serve(s, request("POST", "/api/records/acme", `{"key":"k"}`, keys{internalKey, "", key})); res.Code != want {
			t.Fatalf("a push with %s = %d, want %d", key, res.Code, want)
		}
	}
	for _, bad := range []string{`{"code":"x"}`, `{"accessKey":"k"}`, `{"code":"","accessKey":"k"}`, `[`} {
		call(t, s, "POST", "/api/services/register", bad, http.StatusBadRequest)
	}
}

// A store that fails answers 500 with a generic body: a SQLite error text
// names files on disk.
func TestAStoreFailureIsAGeneric500(t *testing.T) {
	s, db := build(t)
	if _, err := db.Exec(`DROP TABLE records`); err != nil {
		t.Fatalf("drop: %v", err)
	}
	for _, rt := range everyRoute[:3] {
		res := serve(s, request(rt.method, rt.path, rt.body, allKeys))
		var body map[string]any
		_ = json.Unmarshal(res.Body.Bytes(), &body)
		if res.Code != http.StatusInternalServerError || len(body) != 1 || body["error"] != "Internal server error" {
			t.Errorf("%s over a broken store = %d %s, want 500 and a generic body", rt, res.Code, res.Body)
		}
	}
	if _, err := db.Exec(`DROP TABLE services`); err != nil {
		t.Fatalf("drop: %v", err)
	}
	for _, rt := range everyRoute {
		if got := rt.send(s, allKeys); got != http.StatusInternalServerError {
			t.Errorf("%s with no services table = %d, want 500", rt, got)
		}
	}
}

func TestBuildPanicsRatherThanRunningWithoutAKey(t *testing.T) {
	for name, k := range map[string][2]string{"internal": {"", adminKey}, "super-admin": {internalKey, ""}} {
		func() {
			defer func() {
				if recover() == nil {
					t.Errorf("Build accepted an empty %s key — every route it gates would be open", name)
				}
			}()
			Build(k[0], k[1], nil)
		}()
	}
}

// A listener on every interface would make a firewall the only thing between the network and the
// port: Listen binds the one address it is given, whichever family.
func TestListenBindsTheAddressItIsGiven(t *testing.T) {
	probe, err := net.Listen("tcp", "[::1]:0")
	if err != nil {
		t.Skipf("no IPv6 loopback on this host: %v", err)
	}
	probe.Close()
	for _, addr := range []string{"127.0.0.1", "::1"} {
		ln, err := Listen(addr, "0")
		if err != nil {
			t.Fatalf("Listen(%s): %v", addr, err)
		}
		got := ln.Addr().(*net.TCPAddr).IP.String()
		ln.Close()
		if got != addr {
			t.Fatalf("Listen(%s) bound %s", addr, got)
		}
	}
}
