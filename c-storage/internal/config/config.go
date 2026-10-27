// Package config turns the environment into a typed Config, once, at start-up.
//
// Every Load error is fatal: a misconfigured server that answers 200 looks like
// success to its caller, and this one holds the only copy of the data.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Config is the process's environment.
type Config struct {
	Port string

	// DBPath is the records database; its directory is created on open. A
	// relative path is relative to the working directory, which the process never
	// changes.
	DBPath string

	// InternalKey is x-internal-access-key, which every route but /health needs.
	InternalKey string

	// SuperAdminKey is x-super-admin-key, which the service routes need too.
	SuperAdminKey string
}

// Load reads the environment and validates it. The error names the variable at
// fault, never its value: the reader holds a unit file, and a value may be a key.
func Load() (*Config, error) {
	port, err := portOf("PORT")
	if err != nil {
		return nil, err
	}
	path, err := required("DB_PATH")
	if err != nil {
		return nil, err
	}
	internal, err := required("INTERNAL_ACCESS_KEY")
	if err != nil {
		return nil, err
	}
	admin, err := required("X_SUPER_ADMIN_KEY")
	if err != nil {
		return nil, err
	}
	return &Config{Port: port, DBPath: path, InternalKey: internal, SuperAdminKey: admin}, nil
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
