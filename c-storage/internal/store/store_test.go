package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"sync"
	"testing"

	"credo/c-storage/internal/sqlitedb"
)

func open(t *testing.T) *Store {
	t.Helper()
	db, err := sqlitedb.Open(filepath.Join(t.TempDir(), "c-storage.db"), Schema)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return New(db)
}

// The file holds a hash of each key, never the key.
func TestAccessKeysAreStoredHashed(t *testing.T) {
	s := open(t)
	ctx := context.Background()
	if err := s.Register(ctx, "svc", "the-access-key"); err != nil {
		t.Fatalf("register: %v", err)
	}
	var stored string
	if err := s.db.QueryRow(`SELECT hashed_access_key FROM services`).Scan(&stored); err != nil {
		t.Fatalf("read: %v", err)
	}
	if stored != hash("the-access-key") || len(stored) != 64 {
		t.Fatalf("stored %q, want the key's hex SHA-256", stored)
	}
	for key, want := range map[string]bool{"the-access-key": true, "the-access-ke": false, "": false} {
		if ok, err := s.Admits(ctx, "svc", key); err != nil || ok != want {
			t.Errorf("Admits(%q) = %v, %v; want %v", key, ok, err, want)
		}
	}
	if ok, err := s.Admits(ctx, "nobody", "the-access-key"); err != nil || ok {
		t.Errorf("Admits for an unknown service = %v, %v; want false", ok, err)
	}
}

// Callers who read the record as absent all write; the check and the write
// are one transaction, so exactly one lands.
func TestOfWritesNamingNoRecordOneLands(t *testing.T) {
	s := open(t)
	const n = 16
	var wg sync.WaitGroup
	errs := make(chan error, n)
	for i := range n {
		wg.Go(func() {
			errs <- s.Put(context.Background(), "svc", "k", json.RawMessage(fmt.Sprintf(`{"by":%d}`, i)), &Precondition{Absent: true})
		})
	}
	wg.Wait()
	close(errs)
	landed := 0
	for err := range errs {
		if err == nil {
			landed++
		} else if !errors.Is(err, ErrMoved) {
			t.Fatalf("put: %v", err)
		}
	}
	if landed != 1 {
		t.Fatalf("%d of %d writes naming no record landed, want 1", landed, n)
	}
}

// A conditional write that cannot begin or cannot write leaves the record as it was.
func TestAConditionalWriteThatFailsChangesNothing(t *testing.T) {
	s := open(t)
	ctx := context.Background()
	if err := s.Put(ctx, "svc", "k", json.RawMessage(`{}`), nil); err != nil {
		t.Fatalf("put: %v", err)
	}
	tag := Tag([]byte(`{}`))
	gone, cancel := context.WithCancel(ctx)
	cancel()
	if err := s.Remove(gone, "svc", "k", &Precondition{Tag: tag}); err == nil {
		t.Fatal("a remove under a cancelled context succeeded")
	}
	if _, err := s.db.Exec(`CREATE TRIGGER refuse BEFORE DELETE ON records BEGIN SELECT RAISE(ABORT, 'refused'); END`); err != nil {
		t.Fatalf("trigger: %v", err)
	}
	if err := s.Remove(ctx, "svc", "k", &Precondition{Tag: tag}); err == nil || errors.Is(err, ErrMoved) {
		t.Fatalf("a refused delete = %v, want the store's error", err)
	}
	if _, err := s.Get(ctx, "svc", "k"); err != nil {
		t.Fatalf("after it, the record reads %v", err)
	}
}
