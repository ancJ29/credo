package lifecycle

import (
	"bufio"
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"credo/audit-backbone/internal/activity"
	"credo/audit-backbone/internal/auth"
	"credo/audit-backbone/internal/config"
	"credo/audit-backbone/internal/server"
	"credo/audit-backbone/internal/sqlitedb"
)

const writeKey = "lifecycle-write-key"

// taken binds a loopback port and keeps it, so a Run asked for it must fail.
func taken(t *testing.T) string {
	t.Helper()
	ln, err := server.Listen(config.DefaultListenAddr, "0")
	if err != nil {
		t.Fatalf("Listen: %v", err)
	}
	t.Cleanup(func() { ln.Close() })
	return strconv.Itoa(ln.Addr().(*net.TCPAddr).Port)
}

func cfg(t *testing.T, port, openPort string) *config.Config {
	return &config.Config{
		Port: port, OpenPort: openPort, ListenAddr: config.DefaultListenAddr, WriteKey: writeKey,
		DBPath: filepath.Join(t.TempDir(), "data", "activities.db"),
	}
}

// Run starts on whatever ports it is given and stops cleanly when told to.
func TestRunStopsCleanlyWhenItsContextEnds(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := Run(ctx, cfg(t, "0", "0"), "v"); err != nil {
		t.Fatalf("Run = %v, want a clean stop", err)
	}
}

// Every way the process cannot start is an error before anything answers.
func TestRunRefusesToStartWithoutItsDatabaseOrItsPorts(t *testing.T) {
	underAFile := cfg(t, "0", "0")
	file := filepath.Join(t.TempDir(), "a-file")
	if err := os.WriteFile(file, nil, 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}
	underAFile.DBPath = filepath.Join(file, "activities.db")

	for name, c := range map[string]*config.Config{
		"no database":         underAFile,
		"the keyed port held": cfg(t, taken(t), "0"),
		"the open port held":  cfg(t, "0", taken(t)),
	} {
		if err := Run(context.Background(), c, "v"); err == nil {
			t.Errorf("%s: Run started", name)
		}
	}
}

// started runs serve on two fresh loopback listeners until the test ends.
// before, if given, runs against the database before serve starts.
func started(t *testing.T, grace time.Duration, before func(*sql.DB)) (db *sql.DB, keyed, open net.Listener, stop context.CancelFunc, done <-chan error) {
	t.Helper()
	db, err := sqlitedb.Open(filepath.Join(t.TempDir(), "activities.db"), activity.Schema)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	if before != nil {
		before(db)
	}
	for _, ln := range []*net.Listener{&keyed, &open} {
		if *ln, err = server.Listen(config.DefaultListenAddr, "0"); err != nil {
			t.Fatalf("Listen: %v", err)
		}
	}
	ctx, stop := context.WithCancel(context.Background())
	served := make(chan error, 1)
	go func() { served <- serve(ctx, db, writeKey, "v", keyed, open, grace) }()
	t.Cleanup(stop)
	return db, keyed, open, stop, served
}

// inFlight opens a write whose handler is running and waiting for its body.
// net/http drops a request whose headers it reads after the stop, so a test of
// the stop starts here: the handler answers 100 Continue when it first reads.
func inFlight(t *testing.T, keyed net.Listener, body string) (net.Conn, *bufio.Reader) {
	t.Helper()
	conn, err := net.Dial("tcp", keyed.Addr().String())
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	t.Cleanup(func() { conn.Close() })
	head := "POST " + activity.Prefix + " HTTP/1.1\r\nHost: audit\r\n" + auth.KeyHeader + ": " + writeKey +
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

// A write already in flight when the stop comes still commits and answers 201:
// the listeners stop first and the writer last. In the reverse order this
// request would read ErrClosed and answer 500, for a write the caller retries.
func TestAWriteInFlightAtShutdownCommits(t *testing.T) {
	db, keyed, _, stop, done := started(t, shutdownGrace, nil)
	body := `{"activities":[{"clientId":"acme","actorId":"emp-1","action":"in flight"}]}`
	conn, answers := inFlight(t, keyed, body)

	stop()
	// The listener closing is the shutdown under way.
	deadline := time.Now().Add(5 * time.Second)
	for {
		probe, err := net.Dial("tcp", keyed.Addr().String())
		if err != nil {
			break
		}
		probe.Close()
		if time.Now().After(deadline) {
			t.Fatal("the keyed listener never closed")
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
		t.Fatalf("the in-flight write answered %d, want 201", res.StatusCode)
	}
	if err := <-done; err != nil {
		t.Fatalf("serve = %v, want a clean stop", err)
	}
	var n int
	if err := db.QueryRow(`SELECT count(*) FROM activities`).Scan(&n); err != nil || n != 1 {
		t.Fatalf("rows = %d, %v; want the one that answered 201", n, err)
	}
}

// A stop whose grace runs out abandons what is still in flight and is still a
// clean stop, so systemd records a stopped unit, not a failed one.
func TestAStopPastItsGraceIsStillClean(t *testing.T) {
	_, keyed, _, stop, done := started(t, 10*time.Millisecond, nil)
	inFlight(t, keyed, `{"activities":[]}`)
	stop()
	if err := <-done; err != nil {
		t.Fatalf("serve = %v, want a clean stop", err)
	}
}

// Retention runs at start-up, through the process's own wiring: a row already
// expired when the box comes up is gone long before the first hourly tick.
func TestTheProcessSweepsAtStartUp(t *testing.T) {
	db, _, _, _, _ := started(t, shutdownGrace, func(db *sql.DB) {
		if _, err := db.Exec(`INSERT INTO activities (id, client_id, actor_id, action, created_at, expires_at)
			VALUES ('01EXPIRED', 'acme', 'emp-1', 'old', '2020-01-01T00:00:00.000Z', 1)`); err != nil {
			t.Fatalf("seed: %v", err)
		}
	})
	deadline := time.Now().Add(5 * time.Second)
	for {
		var n int
		if err := db.QueryRow(`SELECT count(*) FROM activities`).Scan(&n); err == nil && n == 0 {
			return
		}
		if time.Now().After(deadline) {
			t.Fatal("the expired row outlived start-up")
		}
		time.Sleep(time.Millisecond)
	}
}

// A listener that stops on its own ends the process, so the unit restarts
// rather than run with one door shut.
func TestAListenerThatStopsOnItsOwnEndsTheProcess(t *testing.T) {
	_, _, open, _, done := started(t, shutdownGrace, nil)
	open.Close()
	err := <-done
	if err == nil || !strings.Contains(err.Error(), "the open listener stopped") {
		t.Fatalf("serve = %v, want the open listener named", err)
	}
}

// sweepLog records whether a sweep failure reached the log.
type sweepLog struct{ failed atomic.Bool }

func (l *sweepLog) Enabled(context.Context, slog.Level) bool { return true }
func (l *sweepLog) WithAttrs([]slog.Attr) slog.Handler       { return l }
func (l *sweepLog) WithGroup(string) slog.Handler            { return l }
func (l *sweepLog) Handle(_ context.Context, r slog.Record) error {
	if r.Message == "retention sweep failed" {
		l.failed.Store(true)
	}
	return nil
}

func recordSweepLog(t *testing.T) *sweepLog {
	l := &sweepLog{}
	prev := slog.Default()
	slog.SetDefault(slog.New(l))
	t.Cleanup(func() { slog.SetDefault(prev) })
	return l
}

// A failed sweep is logged and tried again on the next tick: a sweep that
// stops is a store that grows forever.
func TestAFailedSweepIsLoggedAndRetried(t *testing.T) {
	log := recordSweepLog(t)
	var calls atomic.Int32
	sweep := func(context.Context, time.Time) (int, error) {
		if calls.Add(1) == 1 {
			return 0, errors.New("disk I/O error")
		}
		return 3, nil
	}

	ctx, cancel := context.WithCancel(context.Background())
	stopped := make(chan struct{})
	go func() { defer close(stopped); runSweeper(ctx, sweep, time.Millisecond) }()
	deadline := time.Now().Add(5 * time.Second)
	for calls.Load() < 2 {
		if time.Now().After(deadline) {
			t.Fatal("the failed sweep was never retried")
		}
		time.Sleep(time.Millisecond)
	}
	cancel()
	<-stopped
	if !log.failed.Load() {
		t.Fatal("the failed sweep was not logged")
	}
}

// A sweep the stop cuts short is not a failure, and must not read as one in
// the journal of a box that was only being restarted.
func TestASweepCutShortByTheStopIsNotAFailure(t *testing.T) {
	log := recordSweepLog(t)
	ctx, stop := context.WithCancel(context.Background())
	defer stop()
	returned := make(chan struct{})
	go func() {
		defer close(returned)
		runSweeper(ctx, func(ctx context.Context, _ time.Time) (int, error) {
			stop()
			return 0, ctx.Err()
		}, time.Hour)
	}()
	select {
	case <-returned:
	case <-time.After(5 * time.Second):
		t.Fatal("the start-up sweep never ran")
	}
	if log.failed.Load() {
		t.Fatal("a sweep cut short by the stop was logged as a failure")
	}
}

// The keyed listener takes the configured address and the open one stays on loopback whatever that
// address is: ::1 tells them apart from the default 127.0.0.1.
func TestTheKeyedListenerTakesTheConfiguredAddressAndTheOpenOneStaysOnLoopback(t *testing.T) {
	probe, err := net.Listen("tcp", "[::1]:0")
	if err != nil {
		t.Skipf("no IPv6 loopback on this host: %v", err)
	}
	probe.Close()
	c := cfg(t, "0", "0")
	c.ListenAddr = "::1"
	keyed, open, err := bind(c)
	if err != nil {
		t.Fatalf("bind: %v", err)
	}
	defer keyed.Close()
	defer open.Close()
	if got := keyed.Addr().(*net.TCPAddr).IP.String(); got != "::1" {
		t.Errorf("keyed bound %s, want ::1", got)
	}
	if got := open.Addr().(*net.TCPAddr).IP.String(); got != config.DefaultListenAddr {
		t.Errorf("open bound %s, want %s", got, config.DefaultListenAddr)
	}
}

// An address the host does not own stops the start naming the keyed listener, with nothing left bound.
func TestRunRefusesAKeyedAddressTheHostDoesNotOwn(t *testing.T) {
	c := cfg(t, "0", "0")
	c.ListenAddr = "192.0.2.1"
	err := Run(context.Background(), c, "v")
	if err == nil || !strings.Contains(err.Error(), server.Keyed) {
		t.Fatalf("Run = %v, want a refusal naming the %s listener", err, server.Keyed)
	}
}
