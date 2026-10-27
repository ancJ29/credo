package config

import (
	"path/filepath"
	"strings"
	"testing"
)

var names = []string{"PORT", "DB_PATH", "INTERNAL_ACCESS_KEY", "X_SUPER_ADMIN_KEY"}

// setEnv gives each case a clean, valid baseline so a test names one fault.
func setEnv(t *testing.T, overrides map[string]string) {
	t.Helper()
	base := map[string]string{
		"PORT":                "3100",
		"DB_PATH":             filepath.Join(t.TempDir(), "c-storage.db"),
		"INTERNAL_ACCESS_KEY": "internal-key",
		"X_SUPER_ADMIN_KEY":   "admin-key",
	}
	for k, v := range overrides {
		base[k] = v
	}
	for _, name := range names {
		t.Setenv(name, base[name])
	}
}

func TestLoadReadsTheEnvironment(t *testing.T) {
	setEnv(t, map[string]string{"DB_PATH": "data/c-storage.db"})
	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	// A relative DB_PATH stays as written.
	want := Config{Port: "3100", DBPath: "data/c-storage.db", InternalKey: "internal-key", SuperAdminKey: "admin-key"}
	if *cfg != want {
		t.Fatalf("Load = %+v, want %+v", *cfg, want)
	}
}

func TestLoadRefusesEachFatalMisconfiguration(t *testing.T) {
	cases := map[string]struct {
		env  map[string]string
		want string
	}{
		"no port":           {map[string]string{"PORT": ""}, "PORT"},
		"junk port":         {map[string]string{"PORT": "http"}, "PORT"},
		"port out of range": {map[string]string{"PORT": "70000"}, "PORT"},
		"no database":       {map[string]string{"DB_PATH": ""}, "DB_PATH"},
		"no internal key":   {map[string]string{"INTERNAL_ACCESS_KEY": "  "}, "INTERNAL_ACCESS_KEY"},
		"no admin key":      {map[string]string{"X_SUPER_ADMIN_KEY": ""}, "X_SUPER_ADMIN_KEY"},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			setEnv(t, tc.env)
			_, err := Load()
			if err == nil {
				t.Fatalf("Load accepted %s", name)
			}
			if !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("error %q does not name %q — an operator has to act on this message", err, tc.want)
			}
		})
	}
}

// An error is read in a journal; the value it is about must not be in it.
func TestLoadNeverPrintsAValue(t *testing.T) {
	setEnv(t, map[string]string{"PORT": "secret-ish"})
	if _, err := Load(); err == nil || strings.Contains(err.Error(), "secret-ish") {
		t.Fatalf("error = %v, want one that names the variable only", err)
	}
}
