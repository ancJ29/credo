// Package sqlitedb opens the database with the pragmas the design rests on, and
// applies its schema, stamped with its version.
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

// Open creates the parent directory if needed, opens the file, and applies
// schema unless the file already holds version.
//
// Handlers write concurrently, each on a connection of its own, so every
// transaction begins IMMEDIATE: it takes the write lock at BEGIN, and
// busy_timeout is what makes the others wait their turn rather than fail. WAL
// lets the open listener's reads go on meanwhile.
func Open(path, schema string, version int) (*sql.DB, error) {
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
		"_txlock": {"immediate"},
	}.Encode()

	// sql.Open only looks the driver up, and the import above registers it;
	// apply's first read is what opens the file.
	db, _ := sql.Open("sqlite", dsn)
	if err := apply(db, schema, version); err != nil {
		db.Close()
		return nil, fmt.Errorf("%s: %w", path, err)
	}
	return db, nil
}

// apply runs schema and stamps the file at version, in one transaction, when
// the file is at user_version 0; a file at another version is refused.
//
// Unlike c-storage's, a file at 0 that holds tables is taken, not refused: the
// binaries before the stamp made their files at 0, with this same schema. The
// schema is all IF NOT EXISTS, so on such a file it adds nothing, and a table
// of an older shape fails at the first index on a column it lacks.
func apply(db *sql.DB, schema string, version int) error {
	var have int
	if err := db.QueryRow(`PRAGMA user_version`).Scan(&have); err != nil {
		return fmt.Errorf("open it: %w", err)
	}
	switch have {
	case version:
		return nil
	case 0:
	default:
		return fmt.Errorf("user_version %d is not this binary's %d", have, version)
	}
	if _, err := db.Exec(fmt.Sprintf("BEGIN IMMEDIATE;\n%s\nPRAGMA user_version = %d;\nCOMMIT;", schema, version)); err != nil {
		return fmt.Errorf("apply the schema: %w", err)
	}
	return nil
}
