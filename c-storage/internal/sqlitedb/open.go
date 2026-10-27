// Package sqlitedb opens the database with the pragmas the design rests on, and
// applies its schema to a file this binary creates.
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

// version is the user_version a file holds once schema is applied.
const version = 1

// Open creates the parent directory if needed, opens the file, and applies
// schema when the file is new.
//
// Handlers write concurrently, each on a connection of its own, so every
// transaction begins IMMEDIATE: a read-modify-write takes the write lock at
// BEGIN, and busy_timeout is what makes the others wait their turn rather than
// fail. WAL lets reads go on meanwhile.
func Open(path string, schema string) (*sql.DB, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}

	dsn := "file:" + url.PathEscape(path) + "?" + url.Values{
		"_pragma": {
			"journal_mode(WAL)",
			"synchronous(NORMAL)",
			"busy_timeout(5000)",
		},
		"_txlock": {"immediate"},
	}.Encode()

	// sql.Open only looks the driver up, and the import above registers it;
	// apply's first read is what opens the file.
	db, _ := sql.Open("sqlite", dsn)
	if err := apply(db, schema); err != nil {
		db.Close()
		return nil, fmt.Errorf("%s: %w", path, err)
	}
	return db, nil
}

// apply runs schema on a file with no table and stamps it at version, in one
// transaction. Any other file is refused: at user_version 0 with a table, it
// is one this binary did not make, and running on its columns would fail
// later, on a caller's request, instead of now.
func apply(db *sql.DB, schema string) error {
	var have, tables int
	if err := db.QueryRow(`SELECT user_version, (SELECT count(*) FROM sqlite_schema WHERE type = 'table')
		FROM pragma_user_version`).Scan(&have, &tables); err != nil {
		return fmt.Errorf("open it: %w", err)
	}
	switch {
	case have == version:
		return nil
	case have != 0:
		return fmt.Errorf("user_version %d is not this binary's %d", have, version)
	case tables > 0:
		return fmt.Errorf("holds tables at user_version 0: a database this binary did not create")
	}
	if _, err := db.Exec(fmt.Sprintf("BEGIN IMMEDIATE;\n%s\nPRAGMA user_version = %d;\nCOMMIT;", schema, version)); err != nil {
		return fmt.Errorf("apply the schema: %w", err)
	}
	return nil
}
