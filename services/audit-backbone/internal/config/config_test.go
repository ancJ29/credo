package config

import (
	"log/slog"
	"path/filepath"
	"strings"
	"testing"
)

// setEnv gives each case a clean, valid baseline so a test names one fault.
func setEnv(t *testing.T, overrides map[string]string) {
	t.Helper()
	base := map[string]string{
		"PORT":               "3190",
		"OPEN_PORT":          "3191",
		"DB_PATH":            filepath.Join(t.TempDir(), "activities.db"),
		"ACTIVITY_WRITE_KEY": "write-key",
	}
	for k, v := range overrides {
		base[k] = v
	}
	for _, name := range []string{"PORT", "OPEN_PORT", "DB_PATH", "ACTIVITY_WRITE_KEY", "LOG_LEVEL"} {
		t.Setenv(name, base[name])
	}
}

func TestLoadReadsTheOpsContract(t *testing.T) {
	setEnv(t, map[string]string{"DB_PATH": "data/activities.db"})
	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	// ship writes DB_PATH relative to the unit's WorkingDirectory.
	if cfg.Port != "3190" || cfg.OpenPort != "3191" || cfg.DBPath != "data/activities.db" || cfg.WriteKey != "write-key" {
		t.Fatalf("Load = %+v", cfg)
	}
	if cfg.LogLevel != slog.LevelInfo {
		t.Fatalf("LogLevel = %v, want info when unset", cfg.LogLevel)
	}
}

func TestLoadTakesEachLogLevel(t *testing.T) {
	for name, want := range map[string]slog.Level{
		"debug": slog.LevelDebug, "info": slog.LevelInfo, "warn": slog.LevelWarn, "error": slog.LevelError,
	} {
		setEnv(t, map[string]string{"LOG_LEVEL": name})
		if cfg, err := Load(); err != nil || cfg.LogLevel != want {
			t.Errorf("LOG_LEVEL=%s: %v, %v", name, cfg, err)
		}
	}
}

func TestLoadRefusesEachFatalMisconfiguration(t *testing.T) {
	cases := map[string]struct {
		env  map[string]string
		want string
	}{
		"no port":           {map[string]string{"PORT": ""}, "PORT"},
		"no open port":      {map[string]string{"OPEN_PORT": ""}, "OPEN_PORT"},
		"junk port":         {map[string]string{"PORT": "http"}, "PORT"},
		"port out of range": {map[string]string{"OPEN_PORT": "70000"}, "OPEN_PORT"},
		"one port for both": {map[string]string{"OPEN_PORT": "3190"}, "boundary"},
		"no database":       {map[string]string{"DB_PATH": ""}, "DB_PATH"},
		"no key":            {map[string]string{"ACTIVITY_WRITE_KEY": "  "}, "ACTIVITY_WRITE_KEY"},
		"unknown log level": {map[string]string{"LOG_LEVEL": "warning"}, "LOG_LEVEL"},
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

// An error is read in a journal, so each refusal of a value names its variable
// and never the value. DB_PATH and the key are refused only when empty.
func TestLoadNeverPrintsAValue(t *testing.T) {
	for name, env := range map[string]map[string]string{
		"PORT":      {"PORT": "secret-ish"},
		"OPEN_PORT": {"OPEN_PORT": "secret-ish"},
		"LOG_LEVEL": {"LOG_LEVEL": "secret-ish"},
		"boundary":  {"PORT": "4321", "OPEN_PORT": "4321"},
	} {
		setEnv(t, env)
		_, err := Load()
		if err == nil || !strings.Contains(err.Error(), name) ||
			strings.Contains(err.Error(), "secret-ish") || strings.Contains(err.Error(), "4321") {
			t.Errorf("%s: error = %v, want one that names the variable only", name, err)
		}
	}
}
