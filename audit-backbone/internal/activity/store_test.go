package activity

import (
	"context"
	"database/sql"
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/consocia/credo-audit-backbone/internal/batch"
	"github.com/consocia/credo-audit-backbone/internal/sqlitedb"
)

func newStore(t *testing.T) (*Store, *sql.DB) {
	t.Helper()
	db, err := sqlitedb.Open(filepath.Join(t.TempDir(), "activities.db"), Schema)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	w := batch.New(db)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { defer close(done); w.Run(ctx) }()
	t.Cleanup(func() { cancel(); <-done })

	return NewStore(db, w, NewIDFactory()), db
}

func entry(client, actor, action, target string) Input {
	return Input{ClientID: client, ActorID: actor, Action: action, TargetID: target}
}

func mustAppend(t *testing.T, s *Store, now time.Time, in ...Input) []string {
	t.Helper()
	ids, err := s.Append(context.Background(), in, now)
	if err != nil {
		t.Fatalf("Append: %v", err)
	}
	return ids
}

func TestBothFeedsAreNewestFirstAndTenantScoped(t *testing.T) {
	s, _ := newStore(t)
	now := time.Now()

	mustAppend(t, s, now,
		entry("acme", "emp-1", "created", "so-1"),
		entry("acme", "emp-1", "updated", "so-1"))
	// Same actor id and same target id, different tenant. clientId leads every
	// index, so neither feed may see these.
	mustAppend(t, s, now, entry("other", "emp-1", "leaked", "so-1"))

	byActor, err := s.ByActor(context.Background(), "acme", "emp-1", "", 20)
	if err != nil {
		t.Fatalf("ByActor: %v", err)
	}
	if len(byActor.Activities) != 2 {
		t.Fatalf("by-actor returned %d, want 2 — the query crossed tenants", len(byActor.Activities))
	}
	if byActor.Activities[0].Action != "updated" {
		t.Fatalf("by-actor is not newest-first: %q", byActor.Activities[0].Action)
	}

	byTarget, err := s.ByTarget(context.Background(), "acme", "so-1", "", 20)
	if err != nil {
		t.Fatalf("ByTarget: %v", err)
	}
	if len(byTarget.Activities) != 2 {
		t.Fatalf("by-target returned %d, want 2", len(byTarget.Activities))
	}
}

// An entry with no target is in its actor's feed and never in by-target; how
// it reads on the wire is TestAbsenceIsExplicitOnTheWire's.
func TestEntriesWithoutATargetStayOutOfTheTargetFeed(t *testing.T) {
	s, _ := newStore(t)
	now := time.Now()
	mustAppend(t, s, now, entry("acme", "emp-1", "logged in", ""))

	byActor, _ := s.ByActor(context.Background(), "acme", "emp-1", "", 20)
	if len(byActor.Activities) != 1 {
		t.Fatalf("by-actor returned %d, want 1", len(byActor.Activities))
	}
	if byActor.Activities[0].TargetID != nil {
		t.Fatal("a targetless entry came back with a target")
	}

	byTarget, _ := s.ByTarget(context.Background(), "acme", "", "", 20)
	if len(byTarget.Activities) != 0 {
		t.Fatalf("by-target returned %d targetless entries, want 0", len(byTarget.Activities))
	}
}

// The two feeds issue cursors under different scopes (`A#` and `T#`), so one
// cannot be walked with the other's — which would silently page through the
// wrong index.
func TestACursorIsNotAcceptedByTheOtherFeed(t *testing.T) {
	s, _ := newStore(t)
	now := time.Now()
	for range 3 {
		mustAppend(t, s, now, entry("acme", "emp-1", "touched", "so-1"))
	}

	page, err := s.ByActor(context.Background(), "acme", "emp-1", "", 1)
	if err != nil || page.NextCursor == "" {
		t.Fatalf("expected a by-actor cursor: %v", err)
	}
	if _, err := s.ByTarget(context.Background(), "acme", "so-1", page.NextCursor, 20); !errors.Is(err, ErrBadCursor) {
		t.Fatalf("by-target accepted a by-actor cursor: %v", err)
	}
}

// Retention runs from the caller's stamp, so an entry flushed today but stamped
// a year ago is already expired.
func TestSweepDeletesByCreatedAtNotInsertTime(t *testing.T) {
	s, db := newStore(t)
	now := time.Now().UTC()

	old := entry("acme", "emp-1", "ancient", "")
	old.Timestamp = now.AddDate(0, 0, -400).Format(time.RFC3339)
	mustAppend(t, s, now, old)
	mustAppend(t, s, now, entry("acme", "emp-1", "fresh", ""))

	deleted, err := s.Sweep(context.Background(), now)
	if err != nil {
		t.Fatalf("Sweep: %v", err)
	}
	if deleted != 1 {
		t.Fatalf("swept %d rows, want 1", deleted)
	}

	var left string
	if err := db.QueryRow(`SELECT action FROM activities`).Scan(&left); err != nil {
		t.Fatalf("read: %v", err)
	}
	if left != "fresh" {
		t.Fatalf("the wrong row survived: %q", left)
	}
}

// A sweep that fails says so: (0, nil) would read as "nothing expired", and
// retention would stop with the log quiet. Dropping the table stands in for any
// failure the database reports.
func TestASweepTheDatabaseRefusesIsAnError(t *testing.T) {
	s, db := newStore(t)
	if _, err := db.Exec(`DROP TABLE activities`); err != nil {
		t.Fatalf("drop: %v", err)
	}
	if _, err := s.Sweep(context.Background(), time.Now()); err == nil {
		t.Fatal("a sweep against a broken database reported success")
	}
}

// Two clocks: the feed sorts by insert time and retention runs from the
// caller's stamp. A backdated entry must still be seen by a reader who has
// paged past older ids, and must expire on its own stamp.
func TestBackdatedEntryKeepsInsertOrderButExpiresEarlier(t *testing.T) {
	s, db := newStore(t)
	now := time.Now().UTC()

	old := entry("acme", "emp-1", "backdated", "")
	old.Timestamp = now.AddDate(0, 0, -179).Format(time.RFC3339)

	mustAppend(t, s, now, entry("acme", "emp-1", "fresh", ""))
	ids := mustAppend(t, s, now, old)

	page, err := s.ByActor(context.Background(), "acme", "emp-1", "", 20)
	if err != nil {
		t.Fatalf("ByActor: %v", err)
	}
	if page.Activities[0].Action != "backdated" {
		t.Fatal("the backdated entry did not sort by insert time — it would be stored and never seen")
	}

	var backdated, fresh int64
	if err := db.QueryRow(`SELECT expires_at FROM activities WHERE id = ?`, ids[0]).Scan(&backdated); err != nil {
		t.Fatalf("read expiry: %v", err)
	}
	if err := db.QueryRow(`SELECT min(expires_at) FROM activities WHERE id != ?`, ids[0]).Scan(&fresh); err != nil {
		t.Fatalf("read expiry: %v", err)
	}
	if backdated >= fresh {
		t.Fatalf("backdated expiry %d is not earlier than %d — retention is running from insert time", backdated, fresh)
	}
}
