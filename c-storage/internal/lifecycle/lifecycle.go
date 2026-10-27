// Package lifecycle is the process: it opens the database, binds the
// listener, and stops in the one order that never fails a write already under
// way. cmd/server keeps only the wiring around it, so this package is what the
// coverage gate reads.
package lifecycle

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"time"

	"credo/c-storage/internal/config"
	"credo/c-storage/internal/server"
	"credo/c-storage/internal/sqlitedb"
	"credo/c-storage/internal/store"
)

// shutdownGrace bounds how long in-flight requests have to finish before the
// database is closed underneath them.
const shutdownGrace = 15 * time.Second

const readHeaderTimeout = 10 * time.Second

// Run serves until ctx ends. Start-up is fail-fast: a database that will not
// open or a port already taken is an error before anything answers, because a
// server that answers while pointed at no database is the most expensive
// outcome there is.
func Run(ctx context.Context, cfg *config.Config) error {
	db, err := sqlitedb.Open(cfg.DBPath, store.Schema)
	if err != nil {
		return fmt.Errorf("open the records database: %w", err)
	}
	// Closed after serve returns, so after the listener has stopped. Closing
	// the last connection folds the WAL into the main file: a stopped service
	// is one file.
	defer db.Close()

	ln, err := server.Listen(cfg.Port)
	if err != nil {
		return fmt.Errorf("bind the listener: %w", err)
	}
	srv := server.Build(cfg.InternalKey, cfg.SuperAdminKey, store.New(db))
	slog.Info("listening", "addr", ln.Addr().String())
	return serve(ctx, srv.Handler(), ln, shutdownGrace)
}

// serve runs the listener until ctx ends or it stops on its own, which ends
// the process too: a port that no longer answers is a restart.
func serve(ctx context.Context, h http.Handler, ln net.Listener, grace time.Duration) error {
	// DisableGeneralOptionsHandler: net/http would answer `OPTIONS *` itself, 200
	// and without the key, before the gate. TestOptionsStarWithoutTheInternalKeyIs401.
	hs := &http.Server{Handler: h, ReadHeaderTimeout: readHeaderTimeout, DisableGeneralOptionsHandler: true}
	stopped := make(chan error, 1)
	go func() { stopped <- fmt.Errorf("the listener stopped: %w", hs.Serve(ln)) }()

	var err error
	select {
	case <-ctx.Done():
		slog.Info("shutting down")
	case err = <-stopped:
	}

	// Stop accepting and let in-flight requests finish; Run closes the database
	// only after: the reverse order fails a write the caller then retries.
	// TestAWriteInFlightAtShutdownCommits. A request still running when the
	// grace runs out is abandoned, and the stop is still a clean one.
	shutdownCtx, cancel := context.WithTimeout(context.Background(), grace)
	defer cancel()
	if serr := hs.Shutdown(shutdownCtx); serr != nil {
		slog.Error("the listener did not stop cleanly", "error", serr)
	}
	return err
}
