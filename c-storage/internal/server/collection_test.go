package server

import (
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// bruno/ is the way into the service by hand and the e2e job's whole input.
// bru 4.2.0 exits non-zero only when it counts a failure, so a request with no
// test passes green: this holds one request per route at least, none to a route
// the service lacks, and a test on every request. The boundary folder is the
// one place a request may reach a path no route owns.
const (
	collectionDir  = "../../bruno"
	boundaryFolder = "03-the-boundary"
)

var (
	methodLine = regexp.MustCompile(`(?m)^  method: (\w+)$`)
	urlLine    = regexp.MustCompile(`(?m)^  url: "([^"]*)"$`)
	varRef     = regexp.MustCompile(`\{\{[^}]*\}\}`)
	wildcard   = regexp.MustCompile(`\\\{[^}]*\\\}`)
)

type collectionRequest struct{ file, method, path string }

func readCollection(t *testing.T) []collectionRequest {
	t.Helper()
	var found []collectionRequest
	err := filepath.WalkDir(collectionDir, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() && d.Name() == "environments" {
			return fs.SkipDir
		}
		if d.IsDir() || !strings.HasSuffix(p, ".yml") || d.Name() == "folder.yml" || d.Name() == "opencollection.yml" {
			return nil
		}
		raw, err := os.ReadFile(p)
		if err != nil {
			return err
		}
		text, rel := string(raw), strings.TrimPrefix(p, collectionDir+"/")
		if !strings.Contains(text, "- type: tests\n") {
			t.Errorf("%s has no tests script: bru exits 0 for a request that asserts nothing", rel)
		}
		m, u := methodLine.FindStringSubmatch(text), urlLine.FindStringSubmatch(text)
		if m == nil || u == nil {
			t.Errorf("%s: no method or url line found", rel)
			return nil
		}
		path, _, _ := strings.Cut(varRef.ReplaceAllString(strings.TrimPrefix(u[1], "{{baseUrl}}"), "x"), "?")
		found = append(found, collectionRequest{rel, m[1], path})
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	return found
}

// patternMatcher turns "GET /api/records/{serviceCode}/{key}" into a matcher of
// a method and path.
func patternMatcher(pattern string) (method string, path *regexp.Regexp) {
	method, route, _ := strings.Cut(pattern, " ")
	quoted := wildcard.ReplaceAllString(regexp.QuoteMeta(route), `[^/]+`)
	return method, regexp.MustCompile("^" + quoted + "$")
}

func TestTheCollectionHoldsARequestPerRouteAndATestPerRequest(t *testing.T) {
	s, _ := build(t)
	requests := readCollection(t)
	if len(requests) == 0 {
		t.Fatal("no request found under bruno/")
	}
	for _, pattern := range s.patterns {
		method, path := patternMatcher(pattern)
		reached := false
		for _, r := range requests {
			if !strings.HasPrefix(r.file, boundaryFolder+"/") && r.method == method && path.MatchString(r.path) {
				reached = true
			}
		}
		if !reached {
			t.Errorf("no request outside %s reaches %q: add one to bruno/", boundaryFolder, pattern)
		}
	}
	for _, r := range requests {
		if strings.HasPrefix(r.file, boundaryFolder+"/") {
			continue
		}
		served := false
		for _, pattern := range s.patterns {
			method, path := patternMatcher(pattern)
			served = served || (r.method == method && path.MatchString(r.path))
		}
		if !served {
			t.Errorf("%s sends %s %s, which no route serves: it belongs in %s or goes", r.file, r.method, r.path, boundaryFolder)
		}
	}
}
