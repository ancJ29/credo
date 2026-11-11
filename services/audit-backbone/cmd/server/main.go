// Command server is the audit backbone: one binary, two listeners, one SQLite
// database. It keeps only the wiring; internal/lifecycle is the process. The
// coverage gate leaves this file out, and scripts/smoke.sh reads back each path
// it keeps.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"credo/audit-backbone/internal/config"
	"credo/audit-backbone/internal/lifecycle"
)

// buildVersion is the commit `make dist` was given (-X main.buildVersion);
// /health answers it, so a ship can compare it with what it shipped.
var buildVersion = "unknown"

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("invalid configuration", "error", err)
		os.Exit(1)
	}
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: cfg.LogLevel})))

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := lifecycle.Run(ctx, cfg, buildVersion); err != nil {
		slog.Error("stopped", "error", err)
		os.Exit(1)
	}
	slog.Info("stopped")
}
