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
	ln, err := server.Listen("0")
	if err != nil {
		t.Fatalf("Listen: %v", err)
	}
	t.Cleanup(func() { ln.Close() })
	return strconv.Itoa(ln.Addr().(*net.TCPAddr).Port)
}

func cfg(t *testing.T, port string) *config.Config {
	return &config.Config{
		Port: port, InternalKey: internalKey, SuperAdminKey: "admin-key",
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

	for name, c := range map[string]*config.Config{
		"no database":   underAFile,
		"the port held": cfg(t, taken(t)),
	} {
		if err := Run(context.Background(), c); err == nil {
			t.Errorf("%s: Run started", name)
		}
	}
}

// started runs serve on a fresh loopback listener, over a file holding one
// service, until the test ends. Like Run, it closes the database only after
// serve returns; done carries serve's answer once that is so.
func started(t *testing.T, grace time.Duration) (dbPath string, ln net.Listener, stop context.CancelFunc, done <-chan error) {
	t.Helper()
	dbPath = filepath.Join(t.TempDir(), "c-storage.db")
	db, err := sqlitedb.Open(dbPath, store.Schema)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	st := store.New(db)
	if err := st.Register(context.Background(), "svc", accessKey); err != nil {
		t.Fatalf("register: %v", err)
	}
	if ln, err = server.Listen("0"); err != nil {
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
	db, err := sqlitedb.Open(dbPath, store.Schema)
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
