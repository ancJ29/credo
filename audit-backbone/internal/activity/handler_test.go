package activity

import (
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/consocia/credo-audit-backbone/internal/auth"
)

// readKey mints and checks the tokens these tests read with, as the open
// listener's gate does.
var readKey = auth.New("handler-test-key", time.Now)

// routes registers every group on one mux. Which listener each lands on is
// server's to test; these tests are about what a route answers.
func routes(t *testing.T, now time.Time) (http.Handler, *Store, *sql.DB) {
	t.Helper()
	s, db := newStore(t)
	mux := http.NewServeMux()
	RegisterReader(mux, s)
	RegisterWriter(mux, s, func() time.Time { return now })
	RegisterTokens(mux, readKey.Mint)
	return mux, s, db
}

func postTo(h http.Handler, path, body string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func post(h http.Handler, body string) *httptest.ResponseRecorder {
	return postTo(h, Prefix, body)
}

// getWith reads through the token gate with a token.
func getWith(h http.Handler, token, path string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(http.MethodGet, path, nil)
	r.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	readKey.RequireToken(h).ServeHTTP(w, r)
	return w
}

// get reads as acme.
func get(h http.Handler, path string) *httptest.ResponseRecorder {
	token, _ := readKey.Mint("acme")
	return getWith(h, token, path)
}

type feed struct {
	Activities []struct {
		Action    string          `json:"action"`
		Memo      json.RawMessage `json:"memo"`
		CreatedAt string          `json:"createdAt"`
	} `json:"activities"`
	NextCursor string `json:"nextCursor"`
}

func readFeed(t *testing.T, w *httptest.ResponseRecorder) feed {
	t.Helper()
	if w.Code != http.StatusOK {
		t.Fatalf("feed = %d %s, want 200", w.Code, w.Body)
	}
	var f feed
	if err := json.Unmarshal(w.Body.Bytes(), &f); err != nil {
		t.Fatalf("feed body: %v", err)
	}
	return f
}

// details is the part of a 400 the caller acts on.
func details(t *testing.T, w *httptest.ResponseRecorder) string {
	t.Helper()
	var body struct{ Details string }
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("error body: %v", err)
	}
	return body.Details
}

// A write is refused whole, naming the entry and the field at fault, so the
// caller's queue knows which entry to drop rather than retrying all of them.
func TestAWriteIsRefusedNamingTheFieldAtFault(t *testing.T) {
	h, s, _ := routes(t, time.Now())
	one := func(fields string) string { return `{"activities":[{` + fields + `}]}` }
	ok := `"clientId":"acme","actorId":"emp-1","action":"x"`
	tooMany := `{"activities":[` + strings.Repeat(`{`+ok+`},`, MaxBatchSize) + `{` + ok + `}]}`

	for body, want := range map[string]string{
		`not json`:                            "body must be JSON",
		one(ok) + ` junk`:                     "body must be JSON",
		one(ok) + one(ok):                     "body must be JSON",
		`{"activities":[]}`:                   "at least one entry",
		tooMany:                               "at most 1000 entries",
		one(`"actorId":"emp-1","action":"x"`): "activities[0]: clientId must not be empty",
		one(`"clientId":"acme","actorId":"a#b","action":"x"`):            "activities[0]: actorId must not contain",
		one(`"clientId":"acme","actorId":"emp-1","action":"  "`):         "activities[0]: action must not be empty",
		one(ok + `,"targetId":"so#1"`):                                   "activities[0]: targetId must not contain",
		one(ok + `,"timestamp":"2026-10-04 12:00"`):                      "activities[0]: timestamp must be an ISO-8601 datetime",
		`{"activities":[{` + ok + `},{"clientId":"acme","action":"x"}]}`: "activities[1]: actorId must not be empty",
	} {
		w := post(h, body)
		if w.Code != http.StatusBadRequest || !strings.Contains(details(t, w), want) {
			t.Errorf("%.40s… = %d %q, want 400 naming %q", body, w.Code, details(t, w), want)
		}
	}
	if page, _ := s.ByActor(t.Context(), "acme", "emp-1", "", MaxLimit); len(page.Activities) != 0 {
		t.Fatalf("a refused write stored %d entries", len(page.Activities))
	}
}

// The 201 names every entry, and each reads back with its memo and the time
// the caller stamped: the panel shows when the action happened, not when the
// browser got round to flushing it. Whitespace after the body is no bytes after
// it: a file sent by curl ends on a newline.
func TestAWriteAnswersItsIdsAndReadsBackAsSent(t *testing.T) {
	h, _, _ := routes(t, time.Now())
	w := post(h, `{"activities":[
		{"clientId":"acme","actorId":"emp-1","action":"priced","memo":{"qty":5,"note":"rush"},"timestamp":"2026-10-04T09:15:00+07:00"},
		{"clientId":"acme","actorId":"emp-1","action":"viewed"}]}`+"\n")
	if w.Code != http.StatusCreated {
		t.Fatalf("POST = %d %s, want 201", w.Code, w.Body)
	}
	var created struct{ IDs []string }
	if err := json.Unmarshal(w.Body.Bytes(), &created); err != nil || len(created.IDs) != 2 {
		t.Fatalf("201 body = %s, want two ids", w.Body)
	}

	f := readFeed(t, get(h, Prefix+"/by-actor/emp-1"))
	priced := f.Activities[1]
	if priced.Action != "priced" || string(priced.Memo) != `{"note":"rush","qty":5}` ||
		priced.CreatedAt != "2026-10-04T02:15:00.000Z" {
		t.Fatalf("read back %+v", priced)
	}
	if string(f.Activities[0].Memo) != `{}` {
		t.Fatalf("an entry without a memo reads back %s, want {}", f.Activities[0].Memo)
	}
}

// Absence is stated, not dropped: an empty feed is `[]`, which a caller maps
// over, and a missing target is `null`, never an absent field.
func TestAbsenceIsExplicitOnTheWire(t *testing.T) {
	h, s, _ := routes(t, time.Now())
	if body := strings.TrimSpace(get(h, Prefix+"/by-actor/nobody").Body.String()); body != `{"activities":[]}` {
		t.Errorf("an empty feed = %s, want {\"activities\":[]}", body)
	}
	mustAppend(t, s, time.Now(), entry("acme", "emp-1", "logged in", ""))
	if body := get(h, Prefix+"/by-actor/emp-1").Body.String(); !strings.Contains(body, `"targetId":null`) {
		t.Errorf("a targetless entry = %s, want \"targetId\":null", body)
	}
}

// A page holds at most `limit` entries and its cursor leads to the rest; a
// limit outside 1–100 takes the bound the contract names.
func TestAFeedPagesWithinItsLimit(t *testing.T) {
	h, s, _ := routes(t, time.Now())
	in := make([]Input, MaxLimit+1)
	for i := range in {
		in[i] = entry("acme", "emp-1", "touched", "")
	}
	mustAppend(t, s, time.Now(), in...)

	feedPath := Prefix + "/by-actor/emp-1"
	for limit, want := range map[string]int{"?limit=2": 2, "?limit=0": DefaultLimit, "?limit=500": MaxLimit, "": DefaultLimit} {
		if got := readFeed(t, get(h, feedPath+limit)); len(got.Activities) != want || got.NextCursor == "" {
			t.Errorf("limit %q: %d entries, cursor %q — want %d and a cursor", limit, len(got.Activities), got.NextCursor, want)
		}
	}

	first := readFeed(t, get(h, feedPath+"?limit=100"))
	rest := readFeed(t, get(h, feedPath+"?limit=100&cursor="+first.NextCursor))
	if len(rest.Activities) != 1 || rest.NextCursor != "" {
		t.Fatalf("the second page = %d entries, cursor %q — want the last one, and no cursor", len(rest.Activities), rest.NextCursor)
	}
}

// What a caller can get wrong on a read is a 400, never an empty page that
// reads as "no activity".
func TestAFeedRefusesWhatItCannotRead(t *testing.T) {
	h, _, _ := routes(t, time.Now())
	notJSON := base64.RawURLEncoding.EncodeToString([]byte("not json"))
	for query, want := range map[string]string{
		"?limit=ten":         "limit must be an integer",
		"?cursor=%21%21":     "cursor is not valid",
		"?cursor=" + notJSON: "cursor is not valid",
	} {
		w := get(h, Prefix+"/by-target/so-1"+query)
		if w.Code != http.StatusBadRequest || !strings.Contains(details(t, w), want) {
			t.Errorf("%q = %d %q, want 400 naming %q", query, w.Code, details(t, w), want)
		}
	}
}

// A feed reads the tenant its token names and no other: a clientId in the
// query is ignored, so one tenant's token never reads another's log.
func TestAFeedReadsTheTokensTenantAlone(t *testing.T) {
	h, s, _ := routes(t, time.Now())
	mustAppend(t, s, time.Now(), entry("acme", "emp-1", "acme's", "so-1"), entry("other", "emp-1", "other's", "so-1"))
	for _, path := range []string{Prefix + "/by-actor/emp-1?clientId=other", Prefix + "/by-target/so-1?clientId=other"} {
		if f := readFeed(t, get(h, path)); len(f.Activities) != 1 || f.Activities[0].Action != "acme's" {
			t.Errorf("%s with acme's token = %+v, want acme's entry alone", path, f.Activities)
		}
	}
}

// The mint answers a token for the tenant it was asked for, which reads that
// tenant's log, and the instant it stops; what it cannot mint for is a 400
// naming why.
func TestAReadTokenIsMintedForOneTenant(t *testing.T) {
	h, s, _ := routes(t, time.Now())
	mustAppend(t, s, time.Now(), entry("acme", "emp-1", "acme's", ""), entry("other", "emp-1", "other's", ""))

	w := postTo(h, TokensPath, `{"clientId":"other"}`+"\n")
	var minted struct{ Token, ExpiresAt string }
	if w.Code != http.StatusOK || json.Unmarshal(w.Body.Bytes(), &minted) != nil {
		t.Fatalf("mint = %d %s, want 200 and a token", w.Code, w.Body)
	}
	if at, err := time.Parse(TimeFormat, minted.ExpiresAt); err != nil || time.Until(at) <= auth.TokenLifetime-time.Minute {
		t.Errorf("expiresAt = %q, want an hour from now", minted.ExpiresAt)
	}
	if f := readFeed(t, getWith(h, minted.Token, Prefix+"/by-actor/emp-1")); len(f.Activities) != 1 || f.Activities[0].Action != "other's" {
		t.Errorf("the minted token read %+v, want other's entry alone", f.Activities)
	}

	for body, want := range map[string]string{
		`not json`:                 "body must be JSON",
		`{"clientId":"acme"} junk`: "body must be JSON",
		`{}`:                       "clientId must not be empty",
		`{"clientId":"  "}`:        "clientId must not be empty",
		`{"clientId":"a#b"}`:       "clientId must not contain",
	} {
		if w := postTo(h, TokensPath, body); w.Code != http.StatusBadRequest || !strings.Contains(details(t, w), want) {
			t.Errorf("%s = %d %q, want 400 naming %q", body, w.Code, details(t, w), want)
		}
	}
}

// A body over 8 MiB is a 413 on every route that reads one, though it is JSON,
// whether the cap falls inside the value or in the whitespace after it.
func TestABodyOverItsCapIs413(t *testing.T) {
	h, s, _ := routes(t, time.Now())
	pad := strings.Repeat("x", 8<<20)
	for name, req := range map[string]struct{ path, body string }{
		"a write, inside its value": {Prefix, `{"activities":[{"clientId":"acme","actorId":"emp-1","action":"x","memo":{"pad":"` + pad + `"}}]}`},
		"a mint, inside its value":  {TokensPath, `{"clientId":"` + pad + `"}`},
		"a mint, after its value":   {TokensPath, `{"clientId":"acme"}` + strings.Repeat(" ", 8<<20)},
	} {
		w := postTo(h, req.path, req.body)
		if w.Code != http.StatusRequestEntityTooLarge || strings.TrimSpace(w.Body.String()) != `{"error":"Request body too large"}` {
			t.Errorf("%s = %d %.80s, want 413 and c-storage's body", name, w.Code, w.Body)
		}
	}
	if page, _ := s.ByActor(t.Context(), "acme", "emp-1", "", MaxLimit); len(page.Activities) != 0 {
		t.Fatalf("an oversized write stored %d entries", len(page.Activities))
	}
}

// A database that fails is a 500 whose body names nothing: SQLite's own text
// names files on disk. Dropping the table stands in for any failure the
// database reports.
func TestABrokenDatabaseIsA500ThatNamesNothing(t *testing.T) {
	h, _, db := routes(t, time.Now())
	if _, err := db.Exec(`DROP TABLE activities`); err != nil {
		t.Fatalf("drop: %v", err)
	}
	for name, w := range map[string]*httptest.ResponseRecorder{
		"a write": post(h, `{"activities":[{"clientId":"acme","actorId":"emp-1","action":"x"}]}`),
		"a read":  get(h, Prefix+"/by-actor/emp-1"),
	} {
		if w.Code != http.StatusInternalServerError || strings.TrimSpace(w.Body.String()) != `{"error":"Internal server error"}` {
			t.Errorf("%s = %d %s, want 500 and the generic body", name, w.Code, w.Body)
		}
	}
}

// One entry the database refuses fails its whole request, and nothing of it is
// committed: the 201 names committed ids, so the request lands whole or not at
// all. A trigger stands in for a full disk.
func TestAnEntryTheDatabaseRefusesCommitsNothingOfItsRequest(t *testing.T) {
	h, s, db := routes(t, time.Now())
	if _, err := db.Exec(`CREATE TRIGGER refuse BEFORE INSERT ON activities
		WHEN NEW.action = 'refused' BEGIN SELECT RAISE(ABORT, 'refused'); END`); err != nil {
		t.Fatalf("trigger: %v", err)
	}
	w := post(h, `{"activities":[
		{"clientId":"acme","actorId":"emp-1","action":"fine"},
		{"clientId":"acme","actorId":"emp-1","action":"refused"}]}`)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("POST = %d, want 500", w.Code)
	}
	if page, _ := s.ByActor(t.Context(), "acme", "emp-1", "", MaxLimit); len(page.Activities) != 0 {
		t.Fatalf("%d entries of a failed request were committed", len(page.Activities))
	}
}
