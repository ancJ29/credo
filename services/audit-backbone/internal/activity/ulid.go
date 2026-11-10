package activity

import (
	"crypto/rand"
	"io"
	"sync"
	"time"

	"github.com/oklog/ulid/v2"
)

// IDFactory hands out ULIDs that are monotonic within a process.
//
// The ULID is the sort key and a batch inserts many entries in the same
// millisecond, so non-monotonic ids would scramble a batch against itself.
// One process holds the only factory, so the order holds across requests too.
type IDFactory struct {
	mu      sync.Mutex
	entropy io.Reader
}

// NewIDFactory seeds one monotonic reader. Call it once per process.
func NewIDFactory() *IDFactory {
	return &IDFactory{entropy: ulid.Monotonic(rand.Reader, 0)}
}

func (f *IDFactory) New(t time.Time) string {
	f.mu.Lock()
	defer f.mu.Unlock()
	return ulid.MustNew(ulid.Timestamp(t), f.entropy).String()
}
