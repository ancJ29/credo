package activity

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"time"

	"credo/audit-backbone/internal/auth"
	"credo/audit-backbone/internal/httpx"
	"credo/audit-backbone/internal/reqlog"
)

// Prefix is the base path every caller already holds.
const Prefix = "/api/activities"

// TokensPath is where a client's system mints its browser's read token.
const TokensPath = "/api/read-tokens"

// maxBody caps the request body. Memos are small, but "small" is the caller's
// word, not ours.
const maxBody = 8 << 20 // 8 MiB

type logActivitiesResponse struct {
	IDs []string `json:"ids"`
}

type listResponse struct {
	Activities []Activity `json:"activities"`
	NextCursor string     `json:"nextCursor,omitempty"`
}

type tokenResponse struct {
	Token     string `json:"token"`
	ExpiresAt string `json:"expiresAt"`
}

// Router is what a listener hands this domain to register on.
type Router interface {
	HandleFunc(pattern string, handler func(http.ResponseWriter, *http.Request))
}

// RegisterReader adds the two feeds, which read the tenant of the token in
// front of them and no other (docs/memo/the-reader-takes-a-token.md). It takes
// a Reader, which has no write method, so the open listener cannot be handed one.
func RegisterReader(mux Router, repo Reader) {
	r := &reader{repo: repo}
	mux.HandleFunc("GET "+Prefix+"/by-actor/{actorId}", r.byActor)
	mux.HandleFunc("GET "+Prefix+"/by-target/{targetId}", r.byTarget)
}

// RegisterWriter adds the append route. Its caller is the client's system,
// holding the key.
func RegisterWriter(mux Router, repo Writer, now func() time.Time) {
	w := &writer{repo: repo, now: now}
	mux.HandleFunc("POST "+Prefix, w.logActivities)
}

// RegisterTokens adds the route the client's system mints a read token on, for
// one tenant. It belongs on the keyed listener: whoever mints holds the key,
// and the browser holds only the token.
func RegisterTokens(mux Router, mint func(clientID string) (string, time.Time)) {
	mux.HandleFunc("POST "+TokensPath, func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			ClientID string `json:"clientId"`
		}
		if !decodeOne(w, r, &body, "{clientId}") {
			return
		}
		if err := validateID("clientId", body.ClientID); err != nil {
			httpx.BadRequest(w, err.Error())
			return
		}
		token, expires := mint(body.ClientID)
		reqlog.SetClient(r, body.ClientID)
		httpx.JSON(w, http.StatusOK, tokenResponse{Token: token, ExpiresAt: expires.Format(TimeFormat)})
	})
}

// decodeOne reads the body as one JSON value of at most maxBody, and answers
// the refusal itself: false means the response is written. A decoder stops
// after one value, so anything after it but whitespace is refused here: `{…}
// junk` is a malformed body, not a request.
func decodeOne(w http.ResponseWriter, r *http.Request, v any, shape string) bool {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBody))
	err := dec.Decode(v)
	if err == nil {
		if rest := dec.Decode(&struct{}{}); rest != io.EOF {
			err = errors.Join(errors.New("bytes after the body"), rest)
		}
	}
	var tooLarge *http.MaxBytesError
	switch {
	case errors.As(err, &tooLarge):
		httpx.TooLarge(w)
	case err != nil:
		httpx.BadRequest(w, "body must be JSON: "+shape)
	}
	return err == nil
}

type reader struct{ repo Reader }

func (rd *reader) byActor(w http.ResponseWriter, r *http.Request) {
	rd.list(w, r, r.PathValue("actorId"), rd.repo.ByActor)
}

func (rd *reader) byTarget(w http.ResponseWriter, r *http.Request) {
	rd.list(w, r, r.PathValue("targetId"), rd.repo.ByTarget)
}

type queryFn func(ctx context.Context, clientID, id, cursor string, limit int) (Page, error)

func (rd *reader) list(w http.ResponseWriter, r *http.Request, id string, query queryFn) {
	q := r.URL.Query()
	clientID := auth.ClientID(r)

	limit := DefaultLimit
	if raw := q.Get("limit"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil {
			httpx.BadRequest(w, "limit must be an integer")
			return
		}
		limit = ClampLimit(n)
	}

	page, err := query(r.Context(), clientID, id, q.Get("cursor"), limit)
	if err != nil {
		if errors.Is(err, ErrBadCursor) {
			httpx.BadRequest(w, "cursor is not valid for this query")
			return
		}
		httpx.Internal(w, err)
		return
	}

	reqlog.SetCount(r, len(page.Activities))
	reqlog.SetClient(r, clientID)
	httpx.JSON(w, http.StatusOK, listResponse{Activities: page.Activities, NextCursor: page.NextCursor})
}

type writer struct {
	repo Writer
	now  func() time.Time
}

func (wr *writer) logActivities(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Activities []Input `json:"activities"`
	}
	if !decodeOne(w, r, &body, "{activities: [...]}") {
		return
	}
	if len(body.Activities) == 0 {
		httpx.BadRequest(w, "activities must contain at least one entry")
		return
	}
	if len(body.Activities) > MaxBatchSize {
		httpx.BadRequest(w, "activities must contain at most "+strconv.Itoa(MaxBatchSize)+" entries")
		return
	}
	for i, entry := range body.Activities {
		if err := entry.Validate(); err != nil {
			httpx.BadRequest(w, "activities["+strconv.Itoa(i)+"]: "+err.Error())
			return
		}
	}

	ids, err := wr.repo.Append(r.Context(), body.Activities, wr.now())
	if err != nil {
		httpx.Internal(w, err)
		return
	}

	reqlog.SetCount(r, len(ids))
	reqlog.SetClient(r, body.Activities[0].ClientID)
	// The request is one unit of the batch writer, so it commits whole or not at
	// all and a 201 names every entry. A caller left without one retries the
	// batch whole: a duplicate is a visible artefact, where a gap is
	// indistinguishable from an event that never happened.
	httpx.JSON(w, http.StatusCreated, logActivitiesResponse{IDs: ids})
}
