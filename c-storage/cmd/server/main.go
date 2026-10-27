// Command server is c-storage: one binary, one listener, one SQLite database.
// It keeps only the wiring; internal/lifecycle is the process. The coverage
// gate leaves this file out (scripts/cover.sh says why).
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"credo/c-storage/internal/config"
	"credo/c-storage/internal/lifecycle"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	cfg, err := config.Load()
	if err != nil {
		slog.Error("invalid configuration", "error", err)
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	// The first signal starts the shutdown; a second, in its grace period, gets the
	// default action and ends the process.
	go func() { <-ctx.Done(); stop() }()
	if err := lifecycle.Run(ctx, cfg); err != nil {
		slog.Error("stopped", "error", err)
		os.Exit(1)
	}
	slog.Info("stopped")
}
