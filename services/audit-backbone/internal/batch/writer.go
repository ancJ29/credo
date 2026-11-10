// Package batch is the single writer goroutine that every write in the process
// funnels through, and the group commit that makes that cheap.
//
// One writer per database means no lock contention and no SQLITE_BUSY retry
// logic anywhere else. And Do does not return until the commit that carried its
// work succeeded (docs/memo/a-201-means-committed.md).
package batch

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"strconv"
	"sync/atomic"
)

// maxRows caps one commit so a single huge batch cannot hold the write
// transaction while everyone else queues behind it.
const maxRows = 5000

// queueDepth bounds how much work can wait. A full queue blocks the caller
// rather than dropping it: backpressure shows in a latency graph, a dropped
// audit event shows nowhere.
const queueDepth = 256

// ErrClosed is returned to work submitted after Run has stopped, and to work
// already queued when it stops. A shutdown must fail loudly: silence here is
// the caller believing it wrote.
var ErrClosed = errors.New("batch: writer is closed")

// Op is one caller's work, run inside a savepoint of the shared transaction.
type Op func(context.Context, *sql.Tx) error

type unit struct {
	op   Op
	rows int
	res  chan error
}

// Writer owns the only write path to one database.
type Writer struct {
	db     *sql.DB
	queue  chan *unit
	closed atomic.Bool
}

func New(db *sql.DB) *Writer {
	return &Writer{db: db, queue: make(chan *unit, queueDepth)}
}

// Do submits work and blocks until it has been committed, or until ctx ends.
//
// rows is the caller's weight, used only to cap a batch; it need not be exact.
func (w *Writer) Do(ctx context.Context, rows int, op Op) error {
	u := &unit{op: op, rows: rows, res: make(chan error, 1)}

	if w.closed.Load() {
		return ErrClosed
	}
	select {
	case w.queue <- u:
	case <-ctx.Done():
		return ctx.Err()
	}

	select {
	case err := <-u.res:
		return err
	case <-ctx.Done():
		// The work may still commit — the writer owns it now. Returning here
		// only abandons the answer, so a caller must not read its own write back
		// to decide what happened.
		return ctx.Err()
	}
}

// Run is the writer goroutine. It returns when ctx ends, after failing
// everything still queued.
func (w *Writer) Run(ctx context.Context) {
	defer w.drainClosed()

	for {
		select {
		case <-ctx.Done():
			w.closed.Store(true)
			return
		case first := <-w.queue:
			w.commitBatch(ctx, w.gather(first))
		}
	}
}

// gather takes everything already queued behind the first unit, and waits for
// nothing. Under load the batch forms during the previous commit, which is where
// the amortised fsync comes from; under no load it is a batch of one.
func (w *Writer) gather(first *unit) []*unit {
	batch := []*unit{first}
	rows := first.rows
	for rows < maxRows {
		select {
		case u := <-w.queue:
			batch = append(batch, u)
			rows += u.rows
		default:
			return batch
		}
	}
	return batch
}

// commitBatch runs every unit in one transaction, each inside its own
// savepoint, then commits once. The savepoints make sharing safe: one caller's
// bad row rolls back to its own mark instead of failing its batch-mates.
func (w *Writer) commitBatch(ctx context.Context, batch []*unit) {
	tx, err := w.db.BeginTx(ctx, nil)
	if err != nil {
		w.answerAll(batch, fmt.Errorf("begin: %w", err))
		return
	}

	errs := make([]error, len(batch))
	for i, u := range batch {
		name := "u" + strconv.Itoa(i)
		if _, err := tx.ExecContext(ctx, "SAVEPOINT "+name); err != nil {
			errs[i] = fmt.Errorf("savepoint: %w", err)
			continue
		}
		if err := u.op(ctx, tx); err != nil {
			if _, rbErr := tx.ExecContext(ctx, "ROLLBACK TO "+name); rbErr != nil {
				// The transaction is no longer trustworthy; fail the whole batch
				// rather than commit a partially rolled-back state.
				_ = tx.Rollback()
				w.answerAll(batch, fmt.Errorf("rollback to savepoint: %w", rbErr))
				return
			}
			errs[i] = err
			continue
		}
		if _, err := tx.ExecContext(ctx, "RELEASE "+name); err != nil {
			errs[i] = fmt.Errorf("release savepoint: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		w.answerAll(batch, fmt.Errorf("commit: %w", err))
		return
	}
	if len(batch) > 1 {
		slog.Debug("group commit", "units", len(batch))
	}
	for i, u := range batch {
		u.res <- errs[i]
	}
}

func (w *Writer) answerAll(batch []*unit, err error) {
	for _, u := range batch {
		u.res <- err
	}
}

// drainClosed fails work that arrived between the last commit and the stop.
func (w *Writer) drainClosed() {
	w.closed.Store(true)
	for {
		select {
		case u := <-w.queue:
			u.res <- ErrClosed
		default:
			return
		}
	}
}
