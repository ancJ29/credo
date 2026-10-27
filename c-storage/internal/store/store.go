// Package store is the SQL: services and their hashed keys, and records by key.
package store

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"errors"
)

// Schema is the database's one shape; sqlitedb.Open applies it to a new file.
//
//go:embed schema.sql
var Schema string

var (
	ErrExists   = errors.New("the service code is already registered")
	ErrNotFound = errors.New("no record under that key")
	ErrMoved    = errors.New("the record is not as the caller read it")
)

type Store struct {
	db *sql.DB
}

func New(db *sql.DB) *Store {
	return &Store{db: db}
}

func hash(accessKey string) string {
	sum := sha256.Sum256([]byte(accessKey))
	return hex.EncodeToString(sum[:])
}

// Register adds a service under code, or returns ErrExists.
func (s *Store) Register(ctx context.Context, code, accessKey string) error {
	res, err := s.db.ExecContext(ctx, `INSERT INTO services (code, hashed_access_key) VALUES (?, ?)
		ON CONFLICT (code) DO NOTHING`, code, hash(accessKey))
	if err != nil {
		return err
	}
	// The driver's RowsAffected never fails.
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrExists
	}
	return nil
}

// Tag is a record's version: the SHA-256 of its stored text.
func Tag(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

// Precondition is what a write needs of the record it replaces: the tag the
// caller read, or Absent for none; nil writes always.
type Precondition struct {
	Tag    string
	Absent bool
}

// write runs query where the record meets p, checked in its transaction.
func (s *Store) write(ctx context.Context, code, key string, p *Precondition, query string, args ...any) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var data []byte
	err = tx.QueryRowContext(ctx, `SELECT data FROM records WHERE service_code = ? AND key = ?`, code, key).Scan(&data)
	absent := errors.Is(err, sql.ErrNoRows)
	if err != nil && !absent {
		return err
	}
	// A record has no empty tag, so a tag never meets an absent record.
	if p != nil && (p.Absent != absent || (!absent && Tag(data) != p.Tag)) {
		return ErrMoved
	}
	if _, err := tx.ExecContext(ctx, query, args...); err != nil {
		return err
	}
	return tx.Commit()
}

// Admits reports whether accessKey is code's key; an unknown code admits
// nothing. The hashes compare in constant time.
func (s *Store) Admits(ctx context.Context, code, accessKey string) (bool, error) {
	var stored string
	err := s.db.QueryRowContext(ctx, `SELECT hashed_access_key FROM services WHERE code = ?`, code).Scan(&stored)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return subtle.ConstantTimeCompare([]byte(hash(accessKey)), []byte(stored)) == 1, nil
}

// Get returns key's data as stored, or ErrNotFound.
func (s *Store) Get(ctx context.Context, code, key string) (json.RawMessage, error) {
	var data []byte
	err := s.db.QueryRowContext(ctx, `SELECT data FROM records WHERE service_code = ? AND key = ?`, code, key).Scan(&data)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return data, err
}

// upsert writes one record whole. data goes in as a string: the column is
// STRICT TEXT, which refuses a BLOB.
const upsert = `INSERT INTO records (service_code, key, data) VALUES (?, ?, ?)
	ON CONFLICT (service_code, key) DO UPDATE SET data = excluded.data`

// Put writes key's data, replacing what was there.
func (s *Store) Put(ctx context.Context, code, key string, data json.RawMessage, p *Precondition) error {
	return s.write(ctx, code, key, p, upsert, code, key, string(data))
}

// Remove deletes key, present or not.
func (s *Store) Remove(ctx context.Context, code, key string, p *Precondition) error {
	return s.write(ctx, code, key, p, `DELETE FROM records WHERE service_code = ? AND key = ?`, code, key)
}
