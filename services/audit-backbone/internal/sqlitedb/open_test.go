package sqlitedb

import (
	"os"
	"path/filepath"
	"testing"
)

const schema = `
CREATE TABLE IF NOT EXISTS t (id TEXT NOT NULL PRIMARY KEY, k TEXT NOT NULL) STRICT;
CREATE INDEX IF NOT EXISTS t_by_k ON t (k);
`

// The design rests on WAL: the open reader queries while the one writer
// commits. The data directory need not exist yet on a fresh box.
func TestOpenCreatesItsDirectoryAndRunsInWAL(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "data", "a.db"), schema)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer db.Close()
	var mode string
	if err := db.QueryRow(`PRAGMA journal_mode`).Scan(&mode); err != nil || mode != "wal" {
		t.Fatalf("journal_mode = %q, %v; want wal", mode, err)
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
	db, err := Open(older, `CREATE TABLE t (id TEXT NOT NULL PRIMARY KEY) STRICT`)
	if err != nil {
		t.Fatalf("seed: %v", err)
	}
	db.Close()

	for name, path := range map[string]string{
		"a directory under a file":      filepath.Join(file, "data", "a.db"),
		"a directory":                   dir,
		"not a database":                junk,
		"a table older than the schema": older,
	} {
		if db, err := Open(path, schema); err == nil {
			db.Close()
			t.Errorf("%s: Open succeeded", name)
		}
	}
}
