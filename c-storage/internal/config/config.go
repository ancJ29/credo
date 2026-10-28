// Package config turns the environment into a typed Config, once, at start-up.
//
// Every Load error is fatal: a misconfigured server that answers 200 looks like
// success to its caller, and this one holds the only copy of the data.
package config

import (
	"fmt"
	"net/netip"
	"os"
	"strconv"
	"strings"
)

// DefaultListenAddr is where the listener binds when LISTEN_ADDR is unset: the local stack and
// every test stay on loopback.
const DefaultListenAddr = "127.0.0.1"

// Config is the process's environment.
type Config struct {
	Port string

	// ListenAddr is the one IP address the listener binds. Unset, it is loopback.
	ListenAddr string

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
	addr, err := listenAddrOf("LISTEN_ADDR")
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
	return &Config{Port: port, ListenAddr: addr, DBPath: path, InternalKey: internal, SuperAdminKey: admin}, nil
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

// listenAddrOf reads the optional address: unset is loopback, and a set one is a single IP
// address. Never an unspecified one (0.0.0.0, ::), which would leave a firewall as the only wall
// between the network and the port; never a name, a port, a range or a zone.
func listenAddrOf(name string) (string, error) {
	raw := strings.TrimSpace(os.Getenv(name))
	if raw == "" {
		return DefaultListenAddr, nil
	}
	addr, err := netip.ParseAddr(raw)
	if err != nil || addr.IsUnspecified() || addr.Zone() != "" {
		return "", fmt.Errorf("%s must be one specific IP address (not an unspecified one, a name or a port), or unset for loopback", name)
	}
	return addr.String(), nil
}
