package batch

import (
	"context"
	"database/sql"
	"errors"
	"path/filepath"
	"sync"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

func newTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", "file:"+filepath.Join(t.TempDir(), "t.db")+"?_pragma=journal_mode(WAL)")
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	if _, err := db.Exec(`CREATE TABLE t (id INTEGER PRIMARY KEY) STRICT`); err != nil {
		t.Fatalf("schema: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

// start runs w until the test ends.
func start(t *testing.T, w *Writer) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { defer close(done); w.Run(ctx) }()
	t.Cleanup(func() { cancel(); <-done })
}

func insert(id int) Op {
	return func(ctx context.Context, tx *sql.Tx) error {
		_, err := tx.ExecContext(ctx, `INSERT INTO t (id) VALUES (?)`, id)
		return err
	}
}

// waitQueued returns once n units wait in w's queue.
func waitQueued(t *testing.T, w *Writer, n int) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for len(w.queue) < n {
		if time.Now().After(deadline) {
			t.Fatalf("only %d of %d units queued", len(w.queue), n)
		}
		time.Sleep(time.Millisecond)
	}
}

// doAsync submits op from its own goroutine; the channel carries Do's answer.
func doAsync(ctx context.Context, w *Writer, op Op) <-chan error {
	done := make(chan error, 1)
	go func() { done <- w.Do(ctx, 1, op) }()
	return done
}

func count(t *testing.T, db *sql.DB) int {
	t.Helper()
	var n int
	if err := db.QueryRow(`SELECT count(*) FROM t`).Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	return n
}

// Do must not return until the row is committed: a caller told it wrote has no
// way to learn otherwise.
func TestDoReturnsOnlyAfterTheRowIsReadable(t *testing.T) {
	db := newTestDB(t)
	w := New(db)
	start(t, w)

	if err := w.Do(context.Background(), 1, insert(1)); err != nil {
		t.Fatalf("Do: %v", err)
	}
	if got := count(t, db); got != 1 {
		t.Fatalf("row not durable when Do returned: count = %d", got)
	}
}

// The savepoint per unit is what makes sharing a transaction safe. Without it a
// batch-mate's constraint violation would fail unrelated callers' writes.
func TestOneFailingUnitDoesNotFailItsBatchMates(t *testing.T) {
	db := newTestDB(t)
	if _, err := db.Exec(`INSERT INTO t (id) VALUES (7)`); err != nil {
		t.Fatalf("seed: %v", err)
	}
	w := New(db)

	var wg sync.WaitGroup
	errs := make([]error, 3)
	for i, id := range []int{1, 7, 2} { // 7 collides with the seeded row
		wg.Add(1)
		go func() {
			defer wg.Done()
			errs[i] = w.Do(context.Background(), 1, insert(id))
		}()
	}
	// All three wait in the queue before the writer starts, so gather takes them
	// into one transaction — otherwise the test passes without a savepoint.
	waitQueued(t, w, 3)
	start(t, w)
	wg.Wait()

	if errs[0] != nil || errs[2] != nil {
		t.Fatalf("innocent units failed: %v, %v", errs[0], errs[2])
	}
	if errs[1] == nil {
		t.Fatal("the colliding unit reported success")
	}
	if got := count(t, db); got != 3 { // seeded 7, plus 1 and 2
		t.Fatalf("count = %d, want 3", got)
	}
}

func TestConcurrentWritesAreAllDurable(t *testing.T) {
	db := newTestDB(t)
	w := New(db)
	start(t, w)

	const n = 200
	var wg sync.WaitGroup
	for i := range n {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := w.Do(context.Background(), 1, insert(i)); err != nil {
				t.Errorf("Do(%d): %v", i, err)
			}
		}()
	}
	wg.Wait()

	if got := count(t, db); got != n {
		t.Fatalf("count = %d, want %d", got, n)
	}
}

// A stopped writer must refuse work loudly. Silence here is a caller believing
// it wrote during a shutdown.
func TestWorkAfterShutdownFailsRatherThanDisappearing(t *testing.T) {
	db := newTestDB(t)
	w := New(db)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { defer close(done); w.Run(ctx) }()
	cancel()
	<-done

	if err := w.Do(context.Background(), 1, insert(1)); !errors.Is(err, ErrClosed) {
		t.Fatalf("Do after shutdown = %v, want ErrClosed", err)
	}
}

// A full queue blocks the caller rather than dropping its work, and a caller
// that gives up while blocked gets its own error back.
func TestACallerThatGivesUpOnAFullQueueGetsItsOwnError(t *testing.T) {
	w := New(newTestDB(t))
	for range queueDepth {
		w.queue <- &unit{res: make(chan error, 1)}
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := w.Do(ctx, 1, insert(1)); !errors.Is(err, context.Canceled) {
		t.Fatalf("Do on a full queue = %v, want context.Canceled", err)
	}
}

// A caller that gives up after queueing abandons the answer, not the work: the
// writer owns it and commits it. So a caller must never read its own write
// back to decide what happened.
func TestACallerThatGivesUpAfterQueueingLeavesTheWorkToTheWriter(t *testing.T) {
	db := newTestDB(t)
	w := New(db)
	ctx, cancel := context.WithCancel(context.Background())
	answer := doAsync(ctx, w, insert(1))
	waitQueued(t, w, 1)
	cancel()
	if err := <-answer; !errors.Is(err, context.Canceled) {
		t.Fatalf("Do = %v, want context.Canceled", err)
	}

	start(t, w)
	deadline := time.Now().Add(5 * time.Second)
	for count(t, db) != 1 {
		if time.Now().After(deadline) {
			t.Fatal("the abandoned unit was never committed")
		}
		time.Sleep(time.Millisecond)
	}
}

// A batch stops gathering once it holds maxRows rows, and the rest wait for the
// next commit: one transaction never holds the whole queue.
func TestABatchStopsGatheringAtMaxRows(t *testing.T) {
	w := New(newTestDB(t))
	for range 9 {
		w.queue <- &unit{rows: maxRows / 5, res: make(chan error, 1)}
	}
	if got := len(w.gather(&unit{rows: maxRows / 5})); got != 5 || len(w.queue) != 5 {
		t.Fatalf("gathered %d units of %d rows, %d left — want 5 and 5", got, maxRows/5, len(w.queue))
	}
}

// A writer stopped mid-batch — the shutdown grace ran out with work in flight
// — fails every unit in that batch and commits none of it: no caller is told
// "committed" by a commit that never ran.
func TestAWriterStoppedMidBatchFailsEveryUnitInIt(t *testing.T) {
	for name, opErr := range map[string]error{
		"between two units":    nil,
		"inside a unit's work": errors.New("the unit failed too"),
	} {
		t.Run(name, func(t *testing.T) {
			db := newTestDB(t)
			w := New(db)
			ctx, stop := context.WithCancel(context.Background())
			answers := []<-chan error{
				doAsync(context.Background(), w, func(ctx context.Context, tx *sql.Tx) error {
					if err := insert(1)(ctx, tx); err != nil {
						return err
					}
					stop()
					return opErr
				}),
			}
			waitQueued(t, w, 1)
			answers = append(answers, doAsync(context.Background(), w, insert(2)))
			waitQueued(t, w, 2)

			w.Run(ctx)
			for i, answer := range answers {
				if err := <-answer; err == nil {
					t.Errorf("unit %d was told it committed", i)
				}
			}
			if got := count(t, db); got != 0 {
				t.Fatalf("%d rows landed from a batch that never committed", got)
			}
		})
	}
}

// The writer can take a unit off the queue in the same instant it is stopped.
// That unit is failed, never left waiting for an answer.
func TestAStopAsABatchBeginsFailsTheBatch(t *testing.T) {
	w := New(newTestDB(t))
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	u := &unit{op: insert(1), rows: 1, res: make(chan error, 1)}
	w.commitBatch(ctx, []*unit{u})
	if err := <-u.res; err == nil {
		t.Fatal("a batch begun after the stop reported success")
	}
}

// Work still queued when the writer stops is failed with ErrClosed, not left
// to wait for an answer that will never come.
func TestWorkStillQueuedWhenTheWriterStopsIsFailed(t *testing.T) {
	w := New(newTestDB(t))
	answer := doAsync(context.Background(), w, insert(1))
	waitQueued(t, w, 1)
	w.drainClosed()
	if err := <-answer; !errors.Is(err, ErrClosed) {
		t.Fatalf("queued work at stop = %v, want ErrClosed", err)
	}
}

// A commit that fails on its own — after every unit's work succeeded, as a
// full disk fails one — fails every unit in the batch, and the writer goes on
// to commit the next. A deferred foreign key stands in: it fails only at COMMIT.
func TestACommitThatFailsFailsTheBatchAndNotTheWriter(t *testing.T) {
	db := newTestDB(t)
	db.SetMaxOpenConns(1) // the pragma below is per connection
	if _, err := db.Exec(`PRAGMA foreign_keys = ON;
		CREATE TABLE parent (id INTEGER PRIMARY KEY) STRICT;
		CREATE TABLE child (parent INTEGER REFERENCES parent (id) DEFERRABLE INITIALLY DEFERRED) STRICT`); err != nil {
		t.Fatalf("schema: %v", err)
	}
	w := New(db)
	orphan := func(ctx context.Context, tx *sql.Tx) error {
		_, err := tx.ExecContext(ctx, `INSERT INTO child (parent) VALUES (404)`)
		return err
	}
	answers := []<-chan error{doAsync(context.Background(), w, insert(1))}
	waitQueued(t, w, 1)
	answers = append(answers, doAsync(context.Background(), w, orphan))
	waitQueued(t, w, 2)
	start(t, w)

	for i, answer := range answers {
		if err := <-answer; err == nil {
			t.Errorf("unit %d was told it committed", i)
		}
	}
	if err := w.Do(context.Background(), 1, insert(2)); err != nil {
		t.Fatalf("the writer after a failed commit: %v", err)
	}
	if got := count(t, db); got != 1 {
		t.Fatalf("count = %d, want only the unit after the failed commit", got)
	}
}
