package server

import (
	"encoding/json"
	"errors"
	"net/http"
	"regexp"

	"github.com/ancJ29/credo/c-storage/internal/httpx"
	"github.com/ancJ29/credo/c-storage/internal/store"
)

// Each answer carries what a caller reads and no more. A field no rule reads
// decodes into nothing, and encoding/json matches a field's name in any case: no
// caller sends `KEY`.

type recordBody struct {
	Record struct {
		Data json.RawMessage `json:"data"`
		Tag  string          `json:"tag"`
	} `json:"record"`
}

type codeBody struct {
	Code string `json:"code"`
}

var empty = struct{}{}

var tagShape = regexp.MustCompile(`^[0-9a-f]{64}$`)

const preconditionRule = "a write names at most one of If-Match, a record's tag, and If-None-Match: *"

// precondition is If-Match, the tag the caller read, or If-None-Match: *, that
// none exists. One it cannot read is refused, never ignored, or a conditional
// write would run unconditional.
func precondition(r *http.Request) (p *store.Precondition, ok bool) {
	match, noneMatch := r.Header.Get("If-Match"), r.Header.Get("If-None-Match")
	switch {
	case match != "" && noneMatch != "":
		return nil, false
	case noneMatch != "":
		return &store.Precondition{Absent: true}, noneMatch == "*"
	case match != "":
		return &store.Precondition{Tag: match}, tagShape.MatchString(match)
	}
	return nil, true
}

// unconditional refuses a precondition on a write that cannot honour one.
func unconditional(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("If-Match") != "" || r.Header.Get("If-None-Match") != "" {
			httpx.BadRequest(w, "this write takes no If-Match or If-None-Match")
			return
		}
		h(w, r)
	}
}

func (s *Server) getRecord(w http.ResponseWriter, r *http.Request) {
	data, err := s.store.Get(r.Context(), r.PathValue("serviceCode"), r.PathValue("key"))
	switch {
	case errors.Is(err, store.ErrNotFound):
		httpx.NotFound(w)
	case err != nil:
		httpx.Internal(w, err)
	default:
		var body recordBody
		body.Record.Data = data
		body.Record.Tag = store.Tag(data)
		httpx.JSON(w, http.StatusOK, body)
	}
}

func (s *Server) pushRecord(w http.ResponseWriter, r *http.Request) {
	p, ok := precondition(r)
	if !ok {
		httpx.BadRequest(w, preconditionRule)
		return
	}
	var body struct {
		Key  string          `json:"key"`
		Data json.RawMessage `json:"data"`
	}
	if !httpx.Decode(w, r, &body) {
		return
	}
	if body.Data == nil {
		body.Data = json.RawMessage(`{}`)
	}
	if body.Key == "" || body.Data[0] != '{' {
		httpx.BadRequest(w, "key is a non-empty string, and data, when sent, an object")
		return
	}
	err := s.store.Put(r.Context(), r.PathValue("serviceCode"), body.Key, body.Data, p)
	switch {
	case errors.Is(err, store.ErrMoved):
		httpx.PreconditionFailed(w)
	case err != nil:
		httpx.Internal(w, err)
	default:
		httpx.JSON(w, http.StatusCreated, empty)
	}
}

func (s *Server) removeRecord(w http.ResponseWriter, r *http.Request) {
	p, ok := precondition(r)
	if !ok {
		httpx.BadRequest(w, preconditionRule)
		return
	}
	err := s.store.Remove(r.Context(), r.PathValue("serviceCode"), r.PathValue("key"), p)
	switch {
	case errors.Is(err, store.ErrMoved):
		httpx.PreconditionFailed(w)
	case err != nil:
		httpx.Internal(w, err)
	default:
		w.WriteHeader(http.StatusNoContent)
	}
}

// registerService answers a taken code 409, which a caller that only needs the
// service to exist reads as registered.
func (s *Server) registerService(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Code      string `json:"code"`
		AccessKey string `json:"accessKey"`
	}
	if !httpx.Decode(w, r, &body) {
		return
	}
	if body.Code == "" || body.AccessKey == "" {
		httpx.BadRequest(w, "code and accessKey are non-empty strings")
		return
	}
	err := s.store.Register(r.Context(), body.Code, body.AccessKey)
	switch {
	case errors.Is(err, store.ErrExists):
		httpx.Conflict(w, "the service code already exists")
	case err != nil:
		httpx.Internal(w, err)
	default:
		httpx.JSON(w, http.StatusCreated, codeBody{Code: body.Code})
	}
}
