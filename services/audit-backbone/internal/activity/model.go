// Package activity is the audit-log domain: wire shape, SQLite store, and its
// route groups. The reader takes a token and the writer and the mint a key,
// which is why this package never picks a listener — server.Build decides which
// mux each group lands on, and that decision is the boundary.
package activity

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

// TimeFormat is RFC3339 with milliseconds, in UTC — three fractional digits
// always, as a JS `Date` serializes. Matching byte for byte keeps a cutover
// diff free of noise.
const TimeFormat = "2006-01-02T15:04:05.000Z07:00"

// keySep is refused in every id: the service this replaces concatenates ids
// into its partition key, and an input one accepts and the other rejects is a
// caller that breaks on being repointed.
const keySep = "#"

// RetentionDays is measured from a row's createdAt, not its insert time, so a
// backdated backfill does not buy itself a fresh window.
const RetentionDays = 180

// Limits mirror the replaced service's schema, so a caller accepted there is
// accepted here.
const (
	MaxBatchSize = 1000
	MinLimit     = 1
	MaxLimit     = 100
	DefaultLimit = 20
)

// Input is a write's wire shape, as bruno/01-activities/01-log-activities.yml sends it.
type Input struct {
	ClientID  string         `json:"clientId"`
	ActorID   string         `json:"actorId"`
	Action    string         `json:"action"`
	TargetID  string         `json:"targetId,omitempty"`
	Memo      map[string]any `json:"memo,omitempty"`
	Timestamp string         `json:"timestamp,omitempty"`
}

// Activity is the read shape, as bruno/01-activities/03-get-by-actor.yml reads it.
//
// TargetID is a pointer with no omitempty on purpose: the contract says
// `targetId: string | null`, so a missing target serializes as an explicit null
// rather than vanishing from the object.
type Activity struct {
	ID        string          `json:"id"`
	ClientID  string          `json:"clientId"`
	ActorID   string          `json:"actorId"`
	Action    string          `json:"action"`
	TargetID  *string         `json:"targetId"`
	Memo      json.RawMessage `json:"memo"`
	CreatedAt string          `json:"createdAt"`
}

var errEmpty = errors.New("must not be empty")

// Validate reports the first field at fault.
func (in Input) Validate() error {
	if err := validateID("clientId", in.ClientID); err != nil {
		return err
	}
	if err := validateID("actorId", in.ActorID); err != nil {
		return err
	}
	if strings.TrimSpace(in.Action) == "" {
		return fmt.Errorf("action %w", errEmpty)
	}
	if in.TargetID != "" {
		if err := validateID("targetId", in.TargetID); err != nil {
			return err
		}
	}
	if in.Timestamp != "" {
		if _, err := ParseTimestamp(in.Timestamp); err != nil {
			return fmt.Errorf("timestamp must be an ISO-8601 datetime with offset: %w", err)
		}
	}
	return nil
}

// validateID rejects an id that is empty or contains keySep.
func validateID(field, value string) error {
	if strings.TrimSpace(value) == "" {
		return fmt.Errorf("%s %w", field, errEmpty)
	}
	if strings.Contains(value, keySep) {
		return fmt.Errorf("%s must not contain %q", field, keySep)
	}
	return nil
}

// ParseTimestamp accepts the client-stamped time. The client's code stamps at
// the action and flushes later — sometimes sessions later — so receipt time is
// not action time.
func ParseTimestamp(raw string) (time.Time, error) {
	t, err := time.Parse(time.RFC3339, raw)
	if err != nil {
		return time.Time{}, err
	}
	return t.UTC(), nil
}

func FormatTime(t time.Time) string {
	return t.UTC().Format(TimeFormat)
}

// ResolveCreatedAt prefers the client timestamp, which Validate has already
// parsed, and takes receipt time when there is none. It feeds display and
// retention only — never ordering.
func ResolveCreatedAt(in Input, now time.Time) time.Time {
	if t, err := ParseTimestamp(in.Timestamp); err == nil {
		return t
	}
	return now.UTC()
}

// MemoJSON stores the memo as JSON text: this service does not own the memo
// schema and nothing queries inside it. Only MemoJSON writes the column, which
// is why the read path returns it as it stands.
func MemoJSON(memo map[string]any) string {
	if len(memo) == 0 {
		return "{}"
	}
	// The map was decoded from the request's JSON, so it marshals.
	b, _ := json.Marshal(memo)
	return string(b)
}

// ClampLimit applies the contract's bounds to a caller-supplied page size.
func ClampLimit(n int) int {
	switch {
	case n < MinLimit:
		return DefaultLimit
	case n > MaxLimit:
		return MaxLimit
	default:
		return n
	}
}

// expiresAt is the epoch second a row created at createdAt is swept after.
func expiresAt(createdAt time.Time) int64 {
	return createdAt.AddDate(0, 0, RetentionDays).Unix()
}

// A scope names the rows one query may see, and is what a cursor is pinned to.
// `A#` and `T#` keep the two feeds distinct, so a by-actor cursor is not
// silently accepted by by-target.
func actorScope(clientID, actorID string) string {
	return "A" + keySep + clientID + keySep + actorID
}

func targetScope(clientID, targetID string) string {
	return "T" + keySep + clientID + keySep + targetID
}
