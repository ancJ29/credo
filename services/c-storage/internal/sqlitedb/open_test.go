package sqlitedb

import (
	"database/sql"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const schema = `CREATE TABLE t (id TEXT NOT NULL PRIMARY KEY) STRICT;`

// The data directory need not exist on a fresh box; the file comes up in WAL,
// stamped, and opens again as itself.
func TestOpenCreatesAStampedFileAndReopensIt(t *testing.T) {
	path := filepath.Join(t.TempDir(), "data", "a.db")
	db, err := Open(path, schema)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	var mode string
	var stamped int
	if err := db.QueryRow(`SELECT journal_mode, user_version FROM pragma_journal_mode, pragma_user_version`).Scan(&mode, &stamped); err != nil {
		t.Fatalf("read pragmas: %v", err)
	}
	if mode != "wal" || stamped != version {
		t.Fatalf("journal_mode = %q, user_version = %d; want wal, %d", mode, stamped, version)
	}
	db.Close()

	// A schema that would fail if run again proves the second open skipped it.
	again, err := Open(path, "this is not SQL")
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	again.Close()
}

// Every write begins IMMEDIATE: a transaction that reads first holds the write
// lock already, so a second one waits at its BEGIN instead of reading the same
// row and committing over the first.
func TestEveryTransactionTakesTheWriteLockAtBegin(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "a.db"), schema)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer db.Close()
	first, err := db.Begin()
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	defer first.Rollback()
	// On a second connection that does not wait, a deferred BEGIN would succeed
	// here; an IMMEDIATE one is refused at once.
	conn, err := db.Conn(t.Context())
	if err != nil {
		t.Fatalf("conn: %v", err)
	}
	defer conn.Close()
	if _, err := conn.ExecContext(t.Context(), `PRAGMA busy_timeout = 0`); err != nil {
		t.Fatalf("pragma: %v", err)
	}
	if second, err := conn.BeginTx(t.Context(), nil); err == nil {
		second.Rollback()
		t.Fatal("a second transaction began while the first held the write lock")
	}
}

// Every way the file cannot be used is an error at start-up: a process that
// answers while pointed at no database, or at a database of another shape, is
// the costliest failure there is.
func TestOpenRefusesWhatItCannotUse(t *testing.T) {
	dir := t.TempDir()
	file := filepath.Join(dir, "a-file")
	junk := filepath.Join(dir, "junk.db")
	for path, content := range map[string]string{file: "", junk: "these bytes are not a SQLite database header"} {
		if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
			t.Fatalf("write %s: %v", path, err)
		}
	}
	unstamped := seed(t, filepath.Join(dir, "unstamped.db"), `CREATE TABLE migrations (id TEXT)`)
	future := seed(t, filepath.Join(dir, "future.db"), `PRAGMA user_version = 2`)

	for name, tc := range map[string]struct{ path, schema, want string }{
		"a directory under a file":     {filepath.Join(file, "data", "a.db"), schema, "data dir"},
		"a directory":                  {dir, schema, "open"},
		"not a database":               {junk, schema, "open"},
		"a table at user_version 0":    {unstamped, schema, "did not create"},
		"another binary's version":     {future, schema, "user_version 2"},
		"a schema that does not apply": {filepath.Join(dir, "new.db"), "this is not SQL", "apply"},
	} {
		db, err := Open(tc.path, tc.schema)
		if err == nil {
			db.Close()
			t.Errorf("%s: Open succeeded", name)
			continue
		}
		if !strings.Contains(err.Error(), tc.want) {
			t.Errorf("%s: error %q does not say %q", name, err, tc.want)
		}
	}
}

// seed makes a file as another binary would have left it.
func seed(t *testing.T, path, sql string) string {
	t.Helper()
	db, err := Open(path, schema)
	if err != nil {
		t.Fatalf("seed %s: %v", path, err)
	}
	defer db.Close()
	if _, err := db.Exec(`DROP TABLE t; PRAGMA user_version = 0; ` + sql); err != nil {
		t.Fatalf("seed %s: %v", path, err)
	}
	return path
}

// busy_timeout is what makes a second writer wait its turn instead of failing:
// every connection the pool opens carries it, not only the first.
func TestEveryConnectionWaitsForTheWriteLock(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "a.db"), schema)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer db.Close()
	first, err := db.Conn(t.Context())
	if err != nil {
		t.Fatalf("conn: %v", err)
	}
	defer first.Close()
	second, err := db.Conn(t.Context())
	if err != nil {
		t.Fatalf("conn: %v", err)
	}
	defer second.Close()
	for _, conn := range []*sql.Conn{first, second} {
		var ms int
		if err := conn.QueryRowContext(t.Context(), `PRAGMA busy_timeout`).Scan(&ms); err != nil || ms != 5000 {
			t.Errorf("busy_timeout = %d, %v; want 5000", ms, err)
		}
	}
}
