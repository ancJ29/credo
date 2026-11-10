// Package config turns the environment into a typed Config, once, at start-up.
//
// Every Load error is fatal: a misconfigured server that answers 200 looks like
// success to its caller, and this one holds the only copy of the data.
package config

import (
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"
)

// Config is the box's .env: a ship writes PORT, OPEN_PORT and DB_PATH, the rest
// comes from the env's own file.
type Config struct {
	// Port carries the keyed listener, OpenPort the open one.
	Port     string
	OpenPort string

	// DBPath is the activities database; its directory is created on open.
	// ship writes it relative to the unit's WorkingDirectory, and the process
	// never changes directory.
	DBPath string

	// WriteKey is x-internal-access-key for the one keyed route.
	WriteKey string

	LogLevel slog.Level
}

// logLevels are the names LOG_LEVEL takes; unset is info.
var logLevels = map[string]slog.Level{
	"":      slog.LevelInfo,
	"debug": slog.LevelDebug,
	"info":  slog.LevelInfo,
	"warn":  slog.LevelWarn,
	"error": slog.LevelError,
}

// Load reads the environment and validates it. The error names the variable at
// fault, never its value: the reader holds a unit file, and a value may be a key.
func Load() (*Config, error) {
	port, err := portOf("PORT")
	if err != nil {
		return nil, err
	}
	openPort, err := portOf("OPEN_PORT")
	if err != nil {
		return nil, err
	}
	if port == openPort {
		return nil, fmt.Errorf("PORT and OPEN_PORT must differ — the split is the trust boundary")
	}

	path, err := required("DB_PATH")
	if err != nil {
		return nil, err
	}

	key, err := required("ACTIVITY_WRITE_KEY")
	if err != nil {
		return nil, err
	}

	level, ok := logLevels[strings.TrimSpace(os.Getenv("LOG_LEVEL"))]
	if !ok {
		return nil, fmt.Errorf("LOG_LEVEL must be debug, info, warn or error")
	}

	return &Config{Port: port, OpenPort: openPort, DBPath: path, WriteKey: key, LogLevel: level}, nil
}

func required(name string) (string, error) {
	v := strings.TrimSpace(os.Getenv(name))
	if v == "" {
		return "", fmt.Errorf("%s is required", name)
	}
	return v, nil
}

func portOf(name string) (string, error) {
	raw, err := required(name)
	if err != nil {
		return "", err
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < 1 || n > 65535 {
		return "", fmt.Errorf("%s must be a port number, 1 to 65535", name)
	}
	return strconv.Itoa(n), nil
}
