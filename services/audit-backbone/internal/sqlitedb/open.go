// Package sqlitedb opens the database with the pragmas the design rests on, and
// applies its schema.
//
// The driver is modernc.org/sqlite, pure Go, so the binary cross-compiles
// static with CGO_ENABLED=0 and shipping never needs a toolchain on either end.
package sqlitedb

import (
	"database/sql"
	"fmt"
	"net/url"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

// Open creates the parent directory if needed, opens the file, and runs schema.
//
// WAL + synchronous=NORMAL is what lets the open reader query while the one
// writer commits, and keeps a commit cheap. busy_timeout is belt-and-braces:
// every write goes through one goroutine, so lock contention here means a bug.
func Open(path string, schema string) (*sql.DB, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}

	dsn := "file:" + url.PathEscape(path) + "?" + url.Values{
		"_pragma": {
			"journal_mode(WAL)",
			"synchronous(NORMAL)",
			"busy_timeout(5000)",
			"foreign_keys(1)",
		},
	}.Encode()

	// sql.Open only looks the driver up, and the import above registers it;
	// Ping is what opens the file.
	db, _ := sql.Open("sqlite", dsn)
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("open %s: %w", path, err)
	}
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, fmt.Errorf("apply schema to %s: %w", path, err)
	}
	return db, nil
}
