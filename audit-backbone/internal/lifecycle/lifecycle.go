// Package lifecycle is the process: it opens the database, binds both
// listeners, runs the writer and the retention sweep, and stops them in the one
// order that never fails a write that was already durable. cmd/server keeps
// only the wiring around it, so this package is what the coverage gate reads.
package lifecycle

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/consocia/credo-audit-backbone/internal/activity"
	"github.com/consocia/credo-audit-backbone/internal/batch"
	"github.com/consocia/credo-audit-backbone/internal/config"
	"github.com/consocia/credo-audit-backbone/internal/server"
	"github.com/consocia/credo-audit-backbone/internal/sqlitedb"
)

// shutdownGrace bounds how long in-flight requests have to finish committing
// before the writer is stopped underneath them.
const shutdownGrace = 15 * time.Second

// sweepInterval is how often expired rows are deleted.
const sweepInterval = time.Hour

const readHeaderTimeout = 10 * time.Second

// Run serves until ctx ends. Start-up is fail-fast: a database that will not
// open or a port already taken is an error before anything answers, because a
// server that answers 200 while pointed at no database is the most expensive
// outcome there is — the caller believes it delivered, and this process holds
// the only copy of the data.
func Run(ctx context.Context, cfg *config.Config, buildVersion string) error {
	db, err := sqlitedb.Open(cfg.DBPath, activity.Schema)
	if err != nil {
		return fmt.Errorf("open the activities database: %w", err)
	}
	defer db.Close()

	keyed, err := server.Listen(cfg.Port)
	if err != nil {
		return fmt.Errorf("bind the %s listener: %w", server.Keyed, err)
	}
	open, err := server.Listen(cfg.OpenPort)
	if err != nil {
		keyed.Close()
		return fmt.Errorf("bind the %s listener: %w", server.Open, err)
	}
	return serve(ctx, db, cfg.WriteKey, buildVersion, keyed, open, shutdownGrace)
}

// serve runs the process on two bound listeners until ctx ends or one of them
// stops on its own, which ends the process too: a port that no longer answers
// is a restart, not a half-working service.
func serve(ctx context.Context, db *sql.DB, writeKey, buildVersion string, keyed, open net.Listener, grace time.Duration) error {
	writerCtx, stopWriter := context.WithCancel(context.Background())
	var wg sync.WaitGroup
	writer := batch.New(db)
	wg.Go(func() { writer.Run(writerCtx) })

	store := activity.NewStore(db, writer, activity.NewIDFactory())
	srv := server.Build(writeKey, server.Domains{Reader: store, Writer: store}, buildVersion, time.Now)
	wg.Go(func() { runSweeper(writerCtx, store.Sweep, sweepInterval) })

	listeners := []struct {
		name string
		ln   net.Listener
		http *http.Server
	}{
		{server.Keyed, keyed, &http.Server{Handler: srv.KeyedHandler(), ReadHeaderTimeout: readHeaderTimeout}},
		{server.Open, open, &http.Server{Handler: srv.OpenHandler(), ReadHeaderTimeout: readHeaderTimeout}},
	}
	stopped := make(chan error, len(listeners))
	for _, l := range listeners {
		slog.Info("listening", "listener", l.name, "addr", l.ln.Addr().String(), "buildVersion", buildVersion)
		go func() { stopped <- fmt.Errorf("the %s listener stopped: %w", l.name, l.http.Serve(l.ln)) }()
	}

	var err error
	select {
	case <-ctx.Done():
		slog.Info("shutting down")
	case err = <-stopped:
	}

	// Stop accepting first, let in-flight writes commit, and only then take the
	// writer away — the reverse order fails requests that were already durable
	// in every way except the answer. TestAWriteInFlightAtShutdownCommits.
	shutdownCtx, cancel := context.WithTimeout(context.Background(), grace)
	defer cancel()
	for _, l := range listeners {
		// A request still in flight when the grace runs out is abandoned, and
		// the stop is still a clean one. TestAStopPastItsGraceIsStillClean.
		if serr := l.http.Shutdown(shutdownCtx); serr != nil {
			slog.Error("listener did not stop cleanly", "listener", l.name, "error", serr)
		}
	}
	stopWriter()
	wg.Wait()
	return err
}

// runSweeper is retention: once at start-up, so a box that was down over a
// boundary catches up at once, then on every tick. A failed sweep is logged and
// retried on the next tick: a sweep that silently stops is a store that grows
// forever.
func runSweeper(ctx context.Context, sweep func(context.Context, time.Time) (int, error), every time.Duration) {
	once := func() {
		deleted, err := sweep(ctx, time.Now())
		if err != nil {
			// A sweep the stop cut short is not a failure, and must not read
			// as one in the journal. TestASweepCutShortByTheStopIsNotAFailure.
			if ctx.Err() == nil {
				slog.Error("retention sweep failed", "error", err)
			}
			return
		}
		if deleted > 0 {
			slog.Info("retention sweep", "deleted", deleted, "retentionDays", activity.RetentionDays)
		}
	}

	once()
	t := time.NewTicker(every)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			once()
		}
	}
}
