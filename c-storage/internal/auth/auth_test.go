package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// An empty key is a dead process, never an open route.
func TestNewPanicsOnAnEmptyKey(t *testing.T) {
	defer func() {
		if recover() == nil {
			t.Fatal("auth.New accepted an empty key")
		}
	}()
	New(InternalHeader, "")
}

// A key is compared whole, never by a short digest, so only the key
// itself passes.
func TestRequireAcceptsOnlyTheExactKey(t *testing.T) {
	guarded := New(InternalHeader, "right").Require(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	cases := map[string]struct {
		header, key string
		want        int
	}{
		"exact":              {InternalHeader, "right", http.StatusNoContent},
		"absent":             {InternalHeader, "", http.StatusUnauthorized},
		"wrong":              {InternalHeader, "wrong", http.StatusUnauthorized},
		"prefix":             {InternalHeader, "righ", http.StatusUnauthorized},
		"with suffix":        {InternalHeader, "rightish", http.StatusUnauthorized},
		"case-shifted":       {InternalHeader, "RIGHT", http.StatusUnauthorized},
		"whitespace-ed":      {InternalHeader, " right", http.StatusUnauthorized},
		"under another name": {SuperAdminHeader, "right", http.StatusUnauthorized},
	}
	for name, tc := range cases {
		r := httptest.NewRequest(http.MethodGet, "/", nil)
		if tc.key != "" {
			r.Header.Set(tc.header, tc.key)
		}
		w := httptest.NewRecorder()
		guarded.ServeHTTP(w, r)
		if w.Code != tc.want {
			t.Errorf("%s key = %d, want %d", name, w.Code, tc.want)
		}
	}
}
