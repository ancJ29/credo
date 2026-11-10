package activity

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"credo/audit-backbone/internal/batch"
)

// Schema is applied at start-up and is the whole data model.
const Schema = `
CREATE TABLE IF NOT EXISTS activities (
  id         TEXT    NOT NULL PRIMARY KEY,
  client_id  TEXT    NOT NULL,
  actor_id   TEXT    NOT NULL,
  action     TEXT    NOT NULL,
  target_id  TEXT,
  memo       TEXT    NOT NULL DEFAULT '{}',
  created_at TEXT    NOT NULL,
  expires_at INTEGER NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS activities_by_actor
  ON activities (client_id, actor_id, id DESC);

-- Partial: an entry without a target costs this index nothing. target_id = ?
-- never matches its NULL, so the by-target feed is the same with or without it.
CREATE INDEX IF NOT EXISTS activities_by_target
  ON activities (client_id, target_id, id DESC) WHERE target_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS activities_expiry ON activities (expires_at);
`

// sweepBatch bounds one retention transaction: a year of expiries is large
// enough to hold the write transaction while live traffic queues behind it.
const sweepBatch = 5000

// Page is one feed response. Activities is never nil: it marshals to `[]`, and
// the browser calls `.map` on it.
type Page struct {
	Activities []Activity
	NextCursor string
}

// Reader is the open half: the two feeds and nothing else. It is a separate
// interface from Writer so the open listener cannot be handed something that
// writes — the half of the boundary the compiler checks.
type Reader interface {
	ByActor(ctx context.Context, clientID, actorID, cursor string, limit int) (Page, error)
	ByTarget(ctx context.Context, clientID, targetID, cursor string, limit int) (Page, error)
}

// Writer appends. No read: the client's system that holds the key reads through
// a token, on the open listener's feeds.
type Writer interface {
	Append(ctx context.Context, inputs []Input, now time.Time) ([]string, error)
}

// Store implements both, plus the retention sweep that lifecycle runs.
type Store struct {
	db     *sql.DB
	writer *batch.Writer
	ids    *IDFactory
}

func NewStore(db *sql.DB, writer *batch.Writer, ids *IDFactory) *Store {
	return &Store{db: db, writer: writer, ids: ids}
}

// Append inserts a batch and returns the ids that landed.
//
// The ULID is minted from insert time while created_at and expires_at come from
// the caller's timestamp: a caller-controlled sort key would let a backdated
// entry land behind a cursor the reader has already walked past.
func (s *Store) Append(ctx context.Context, inputs []Input, now time.Time) ([]string, error) {
	ids := make([]string, len(inputs))
	for i := range inputs {
		ids[i] = s.ids.New(now)
	}

	err := s.writer.Do(ctx, len(inputs), func(ctx context.Context, tx *sql.Tx) error {
		stmt, err := tx.PrepareContext(ctx, `
			INSERT INTO activities
				(id, client_id, actor_id, action, target_id, memo, created_at, expires_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
		if err != nil {
			return err
		}
		defer stmt.Close()

		for i, in := range inputs {
			createdAt := ResolveCreatedAt(in, now)
			var target any
			if in.TargetID != "" {
				target = in.TargetID
			}
			if _, err := stmt.ExecContext(ctx,
				ids[i], in.ClientID, in.ActorID, in.Action, target,
				MemoJSON(in.Memo), FormatTime(createdAt), expiresAt(createdAt),
			); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return ids, nil
}

func (s *Store) ByActor(ctx context.Context, clientID, actorID, cursor string, limit int) (Page, error) {
	return s.feed(ctx, actorScope(clientID, actorID), "actor_id", clientID, actorID, cursor, limit)
}

func (s *Store) ByTarget(ctx context.Context, clientID, targetID, cursor string, limit int) (Page, error) {
	return s.feed(ctx, targetScope(clientID, targetID), "target_id", clientID, targetID, cursor, limit)
}

// feed is both reads: same shape, different indexed column. Newest-first, and
// clientId is the leading column of every index, so a query cannot cross tenants
// even if a caller supplies someone else's actorId.
func (s *Store) feed(ctx context.Context, scope, column, clientID, id, rawCursor string, limit int) (Page, error) {
	after, err := decodeCursor(rawCursor, scope)
	if err != nil {
		return Page{}, err
	}

	query := `SELECT id, client_id, actor_id, action, target_id, memo, created_at
		FROM activities WHERE client_id = ? AND ` + column + ` = ?`
	args := []any{clientID, id}
	if after != "" {
		query += ` AND id < ?`
		args = append(args, after)
	}
	query += ` ORDER BY id DESC LIMIT ?`
	args = append(args, limit+1)

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return Page{}, err
	}
	defer rows.Close()

	page := Page{Activities: []Activity{}}
	for rows.Next() {
		var (
			a      Activity
			target sql.NullString
			memo   string
		)
		// The table is STRICT and only target_id may be NULL, so every row
		// converts; rows closed under the loop report through rows.Err.
		_ = rows.Scan(&a.ID, &a.ClientID, &a.ActorID, &a.Action, &target, &memo, &a.CreatedAt)
		if target.Valid {
			v := target.String
			a.TargetID = &v
		}
		a.Memo = json.RawMessage(memo)
		page.Activities = append(page.Activities, a)
	}

	if len(page.Activities) > limit {
		page.Activities = page.Activities[:limit]
		page.NextCursor = encodeCursor(scope, page.Activities[limit-1].ID)
	}
	// After an error mid-read the page is partial; the handler answers 500.
	return page, rows.Err()
}

// Sweep is retention, in bounded batches. It is the only mechanism, so a sweep
// that stops running is a store that grows forever
// (docs/memo/retention-is-a-predicate.md).
func (s *Store) Sweep(ctx context.Context, now time.Time) (int, error) {
	cutoff := now.UTC().Unix()
	total := 0
	for {
		var deleted int64
		err := s.writer.Do(ctx, sweepBatch, func(ctx context.Context, tx *sql.Tx) error {
			res, err := tx.ExecContext(ctx, `
				DELETE FROM activities
				WHERE id IN (SELECT id FROM activities WHERE expires_at < ? LIMIT ?)`,
				cutoff, sweepBatch)
			if err != nil {
				return err
			}
			deleted, err = res.RowsAffected()
			return err
		})
		if err != nil {
			return total, fmt.Errorf("sweep: %w", err)
		}
		total += int(deleted)
		if deleted < sweepBatch {
			return total, nil
		}
	}
}
