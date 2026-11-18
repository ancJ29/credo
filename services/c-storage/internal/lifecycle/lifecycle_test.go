package lifecycle

import (
	"bufio"
	"context"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"credo/c-storage/internal/auth"
	"credo/c-storage/internal/config"
	"credo/c-storage/internal/server"
	"credo/c-storage/internal/sqlitedb"
	"credo/c-storage/internal/store"
)

const (
	internalKey = "internal-key"
	accessKey   = "svc-access-key"
)

// taken binds a loopback port and keeps it, so a Run asked for it must fail.
func taken(t *testing.T) string {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("Listen: %v", err)
	}
	t.Cleanup(func() { ln.Close() })
	return strconv.Itoa(ln.Addr().(*net.TCPAddr).Port)
}

func cfg(t *testing.T, port string) *config.Config {
	return &config.Config{
		Port: port, ListenAddr: config.DefaultListenAddr, InternalKey: internalKey, SuperAdminKey: "admin-key",
		DBPath: filepath.Join(t.TempDir(), "data", "c-storage.db"),
	}
}

func TestRunStopsCleanlyWhenItsContextEnds(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := Run(ctx, cfg(t, "0")); err != nil {
		t.Fatalf("Run = %v, want a clean stop", err)
	}
}

// Every way the process cannot start is an error before anything answers.
func TestRunRefusesToStartWithoutItsDatabaseOrItsPort(t *testing.T) {
	underAFile := cfg(t, "0")
	file := filepath.Join(t.TempDir(), "a-file")
	if err := os.WriteFile(file, nil, 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}
	underAFile.DBPath = filepath.Join(file, "c-storage.db")

	// An address this host does not own (TEST-NET-1): Run binds the address it is configured with.
	notOurs := cfg(t, "0")
	notOurs.ListenAddr = "192.0.2.1"

	for name, c := range map[string]*config.Config{
		"no database":                underAFile,
		"the port held":              cfg(t, taken(t)),
		"an address this host lacks": notOurs,
	} {
		// A bounded run, so a Run that starts anyway ends the test with its failure, not a hang.
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		if err := Run(ctx, c); err == nil {
			t.Errorf("%s: Run started", name)
		}
		cancel()
	}
}

// A listener on every interface would make a firewall the only thing between the network and the
// port: Run binds the one address it is given, whichever family, and the other loopback on the
// same port stays shut.
func TestRunBindsTheAddressItIsGiven(t *testing.T) {
	others := map[string]string{"127.0.0.1": "::1"}
	// Only the ::1 case needs IPv6; a host without it still tests 127.0.0.1.
	if probe, err := net.Listen("tcp", "[::1]:0"); err == nil {
		probe.Close()
		others["::1"] = "127.0.0.1"
	} else {
		t.Logf("no IPv6 loopback on this host, ::1 not tested: %v", err)
	}
	for addr, other := range others {
		port := freeOnBoth(t)
		c := cfg(t, port)
		c.ListenAddr = addr
		ctx, cancel := context.WithCancel(context.Background())
		ran := make(chan error, 1)
		go func() { ran <- Run(ctx, c) }()
		answered(t, net.JoinHostPort(addr, port), ran)
		if conn, err := net.Dial("tcp", net.JoinHostPort(other, port)); err == nil {
			conn.Close()
			t.Errorf("Run on %s also answered on %s", addr, other)
		}
		cancel()
		if err := <-ran; err != nil {
			t.Fatalf("Run on %s = %v, want a clean stop", addr, err)
		}
	}
}

// freeOnBoth is a port no listener holds on either loopback, as far as a bind can tell.
func freeOnBoth(t *testing.T) string {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("Listen: %v", err)
	}
	port := strconv.Itoa(ln.Addr().(*net.TCPAddr).Port)
	ln.Close()
	if six, err := net.Listen("tcp", net.JoinHostPort("::1", port)); err == nil {
		six.Close()
	}
	return port
}

// answered waits, at most 3 s, until addr takes a connection; ran ending first is the failure.
func answered(t *testing.T, addr string, ran <-chan error) {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if conn, err := net.Dial("tcp", addr); err == nil {
			conn.Close()
			return
		}
		select {
		case err := <-ran:
			t.Fatalf("Run on %s ended before it answered: %v", addr, err)
		case <-time.After(20 * time.Millisecond):
		}
	}
	t.Fatalf("Run did not answer on %s within 3 s", addr)
}

// started runs serve on a fresh loopback listener, over a file holding one
// service, until the test ends. Like Run, it closes the database only after
// serve returns; done carries serve's answer once that is so.
func started(t *testing.T, grace time.Duration) (dbPath string, ln net.Listener, stop context.CancelFunc, done <-chan error) {
	t.Helper()
	dbPath = filepath.Join(t.TempDir(), "c-storage.db")
	db, err := sqlitedb.Open(dbPath, store.Schema, store.Version)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	st := store.New(db)
	if err := st.Register(context.Background(), "svc", accessKey); err != nil {
		t.Fatalf("register: %v", err)
	}
	if ln, err = net.Listen("tcp", "127.0.0.1:0"); err != nil {
		t.Fatalf("Listen: %v", err)
	}
	ctx, stop := context.WithCancel(context.Background())
	served := make(chan error, 1)
	go func() {
		err := serve(ctx, server.Build(internalKey, "admin-key", st).Handler(), ln, grace)
		db.Close()
		served <- err
	}()
	t.Cleanup(stop)
	return dbPath, ln, stop, served
}

// inFlight opens a push whose handler is running and waiting for its body.
// net/http drops a request whose headers it reads after the stop, so a test of
// the stop starts here: the handler answers 100 Continue when it first reads.
func inFlight(t *testing.T, ln net.Listener, body string) (net.Conn, *bufio.Reader) {
	t.Helper()
	conn, err := net.Dial("tcp", ln.Addr().String())
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	t.Cleanup(func() { conn.Close() })
	head := "POST /api/records/svc HTTP/1.1\r\nHost: c-storage\r\n" +
		auth.InternalHeader + ": " + internalKey + "\r\n" + server.AccessKeyHeader + ": " + accessKey +
		"\r\nContent-Type: application/json\r\nExpect: 100-continue\r\nContent-Length: " +
		strconv.Itoa(len(body)) + "\r\n\r\n"
	if _, err := conn.Write([]byte(head)); err != nil {
		t.Fatalf("write: %v", err)
	}
	answers := bufio.NewReader(conn)
	if res, err := http.ReadResponse(answers, nil); err != nil || res.StatusCode != http.StatusContinue {
		t.Fatalf("waiting for the handler: %v, %v", res, err)
	}
	return conn, answers
}

// A push already in flight when the stop comes still commits and answers 201:
// the listener stops first and the database closes last. In the reverse order
// this request would answer 500, for a write the caller retries.
func TestAWriteInFlightAtShutdownCommits(t *testing.T) {
	dbPath, ln, stop, done := started(t, shutdownGrace)
	body := `{"key":"in-flight","data":{}}`
	conn, answers := inFlight(t, ln, body)

	stop()
	// The listener closing is the shutdown under way.
	deadline := time.Now().Add(5 * time.Second)
	for {
		probe, err := net.Dial("tcp", ln.Addr().String())
		if err != nil {
			break
		}
		probe.Close()
		if time.Now().After(deadline) {
			t.Fatal("the listener never closed")
		}
		time.Sleep(time.Millisecond)
	}

	if _, err := conn.Write([]byte(body)); err != nil {
		t.Fatalf("write the body: %v", err)
	}
	res, err := http.ReadResponse(answers, nil)
	if err != nil {
		t.Fatalf("read the answer: %v", err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("the in-flight push answered %d, want 201", res.StatusCode)
	}
	if err := <-done; err != nil {
		t.Fatalf("serve = %v, want a clean stop", err)
	}
	// The file is read back after the stop, as the next start would find it.
	db, err := sqlitedb.Open(dbPath, store.Schema, store.Version)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	defer db.Close()
	var n int
	if err := db.QueryRow(`SELECT count(*) FROM records`).Scan(&n); err != nil || n != 1 {
		t.Fatalf("rows = %d, %v; want the one that answered 201", n, err)
	}
}

// A stop whose grace runs out abandons what is still in flight and is still a
// clean stop, so systemd records a stopped unit, not a failed one.
func TestAStopPastItsGraceIsStillClean(t *testing.T) {
	_, ln, stop, done := started(t, 10*time.Millisecond)
	inFlight(t, ln, `{"key":"k"}`)
	stop()
	if err := <-done; err != nil {
		t.Fatalf("serve = %v, want a clean stop", err)
	}
}

// A listener that stops on its own ends the process, so the unit restarts
// rather than run with its door shut.
func TestAListenerThatStopsOnItsOwnEndsTheProcess(t *testing.T) {
	_, ln, _, done := started(t, shutdownGrace)
	ln.Close()
	if err := <-done; err == nil || !strings.Contains(err.Error(), "the listener stopped") {
		t.Fatalf("serve = %v, want the listener named", err)
	}
}

// net/http answers `OPTIONS *` itself, before any handler, unless told not to:
// a 200 to a caller with no key. It is 401 like every other path.
func TestOptionsStarWithoutTheInternalKeyIs401(t *testing.T) {
	_, ln, _, _ := started(t, shutdownGrace)
	conn, err := net.Dial("tcp", ln.Addr().String())
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	t.Cleanup(func() { conn.Close() })
	if _, err := conn.Write([]byte("OPTIONS * HTTP/1.1\r\nHost: c-storage\r\n\r\n")); err != nil {
		t.Fatalf("write: %v", err)
	}
	res, err := http.ReadResponse(bufio.NewReader(conn), nil)
	if err != nil {
		t.Fatalf("read the answer: %v", err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("OPTIONS * without the key = %d, want 401", res.StatusCode)
	}
}
