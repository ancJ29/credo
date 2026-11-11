package activity

import (
	"encoding/base64"
	"encoding/json"
	"errors"
)

// ErrBadCursor is a caller mistake, never a server fault; the handler maps it
// to 400.
var ErrBadCursor = errors.New("invalid cursor")

// The cursor carries the feed it was issued for, though the id alone would page:
// a cursor pasted from another feed is a 400 rather than an empty page reading
// as "no activities". It is base64 JSON, not signed, and one a caller builds
// pages only the feed it names.
type cursor struct {
	Scope string `json:"s"`
	ID    string `json:"i"`
}

func encodeCursor(scope, id string) string {
	// Two strings always marshal.
	raw, _ := json.Marshal(cursor{Scope: scope, ID: id})
	return base64.RawURLEncoding.EncodeToString(raw)
}

func decodeCursor(raw, expectScope string) (string, error) {
	if raw == "" {
		return "", nil
	}
	decoded, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return "", ErrBadCursor
	}
	var c cursor
	if err := json.Unmarshal(decoded, &c); err != nil {
		return "", ErrBadCursor
	}
	if c.ID == "" || c.Scope != expectScope {
		return "", ErrBadCursor
	}
	return c.ID, nil
}
