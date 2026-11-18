package sqlitedb

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	"credo/audit-backbone/internal/activity"
)

const schema = `
CREATE TABLE IF NOT EXISTS t (id TEXT NOT NULL PRIMARY KEY, k TEXT NOT NULL) STRICT;
CREATE INDEX IF NOT EXISTS t_by_k ON t (k);
`

// seed writes script to a file at user_version 0, the way the binaries before
// the stamp made theirs.
func seed(t *testing.T, path, script string) {
	t.Helper()
	db, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatalf("seed %s: %v", path, err)
	}
	defer db.Close()
	if _, err := db.Exec(script); err != nil {
		t.Fatalf("seed %s: %v", path, err)
	}
}

func userVersion(t *testing.T, db *sql.DB) int {
	t.Helper()
	var v int
	if err := db.QueryRow(`PRAGMA user_version`).Scan(&v); err != nil {
		t.Fatalf("user_version: %v", err)
	}
	return v
}

// The design rests on WAL: the open reader queries while a writer commits. The
// data directory need not exist yet on a fresh box, and a file opened again
// keeps its stamp.
func TestOpenCreatesItsDirectoryRunsInWALAndStampsItsVersion(t *testing.T) {
	path := filepath.Join(t.TempDir(), "data", "a.db")
	for range 2 {
		db, err := Open(path, schema, 3)
		if err != nil {
			t.Fatalf("Open: %v", err)
		}
		var mode string
		if err := db.QueryRow(`PRAGMA journal_mode`).Scan(&mode); err != nil || mode != "wal" {
			t.Fatalf("journal_mode = %q, %v; want wal", mode, err)
		}
		if v := userVersion(t, db); v != 3 {
			t.Fatalf("user_version = %d, want 3", v)
		}
		db.Close()
	}
}

// The binaries before the stamp made their file at user_version 0 with today's
// schema, and ridge's box holds one: it opens, keeps its rows, and is stamped,
// where c-storage would refuse it.
func TestAFileMadeBeforeTheStampOpensKeepsItsRowsAndIsStamped(t *testing.T) {
	path := filepath.Join(t.TempDir(), "activities.db")
	seed(t, path, activity.Schema+`
		INSERT INTO activities (id, client_id, actor_id, action, created_at, expires_at)
		VALUES ('01KEPT', 'acme', 'emp-1', 'before the stamp', '2026-11-18T00:00:00.000Z', 4102444800);`)

	db, err := Open(path, activity.Schema, activity.SchemaVersion)
	if err != nil {
		t.Fatalf("Open = %v, want the file taken", err)
	}
	defer db.Close()
	var n int
	if err := db.QueryRow(`SELECT count(*) FROM activities`).Scan(&n); err != nil || n != 1 {
		t.Fatalf("rows = %d, %v; want the one written before the stamp", n, err)
	}
	if v := userVersion(t, db); v != activity.SchemaVersion {
		t.Fatalf("user_version = %d, want %d", v, activity.SchemaVersion)
	}
}

// Every way the database cannot be used is an error at start-up: a process
// that answers while pointed at no database is the costliest failure there is.
func TestOpenRefusesWhatItCannotUse(t *testing.T) {
	dir := t.TempDir()
	file := filepath.Join(dir, "a-file")
	junk := filepath.Join(dir, "junk.db")
	for path, content := range map[string]string{file: "", junk: "these bytes are not a SQLite database header"} {
		if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
			t.Fatalf("write %s: %v", path, err)
		}
	}
	// CREATE TABLE IF NOT EXISTS skips a table of an older shape, and the index
	// after it fails: the process stops instead of running on columns it lacks.
	older := filepath.Join(dir, "older.db")
	seed(t, older, `CREATE TABLE t (id TEXT NOT NULL PRIMARY KEY) STRICT`)
	newer := filepath.Join(dir, "newer.db")
	seed(t, newer, `PRAGMA user_version = 2`)

	for name, path := range map[string]string{
		"a directory under a file":      filepath.Join(file, "data", "a.db"),
		"a directory":                   dir,
		"not a database":                junk,
		"a table older than the schema": older,
		"another version":               newer,
	} {
		if db, err := Open(path, schema, 1); err == nil {
			db.Close()
			t.Errorf("%s: Open succeeded", name)
		}
	}
}
